// backend/main.go
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/court-command/court-command/config"
	"github.com/court-command/court-command/db"
	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/jobs"
	"github.com/court-command/court-command/pubsub"
	"github.com/court-command/court-command/router"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
	"github.com/court-command/court-command/ws"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	slog.Info("running database migrations")
	if err := db.RunMigrations(ctx, cfg.DatabaseURL); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	sessionStore, err := session.NewStore(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	defer sessionStore.Close()

	queries := generated.New(pool)

	// Phase 1+2 services
	authService := service.NewAuthService(pool, sessionStore)
	playerService := service.NewPlayerService(queries)
	teamService := service.NewTeamService(queries)
	orgService := service.NewOrganizationService(queries, pool)
	venueService := service.NewVenueService(queries)

	// Phase 3 services
	leagueService := service.NewLeagueService(queries)
	tournamentService := service.NewTournamentService(queries, pool)
	divisionService := service.NewDivisionService(queries)
	registrationService := service.NewRegistrationService(queries)
	seasonService := service.NewSeasonService(queries)
	podService := service.NewPodService(queries)
	announcementService := service.NewAnnouncementService(queries)

	// Phase 4C: pub/sub for real-time updates
	ps := pubsub.New(sessionStore.Client(), logger)

	// Phase 4A services
	scoringPresetService := service.NewScoringPresetService(queries)
	matchService := service.NewMatchService(queries, pool, ps)

	// Phase 4D services
	bracketService := service.NewBracketService(queries, pool)
	courtQueueService := service.NewCourtQueueService(queries, ps)

	// Phase 1+2 handlers
	secureCookie := !cfg.IsDevelopment()
	authHandler := handler.NewAuthHandler(authService, secureCookie)
	healthHandler := handler.NewHealthHandler(pool, sessionStore.Client())
	playerHandler := handler.NewPlayerHandler(playerService)
	teamHandler := handler.NewTeamHandler(teamService)
	orgHandler := handler.NewOrgHandler(orgService)
	venueHandler := handler.NewVenueHandler(venueService)
	courtHandler := handler.NewCourtHandler(venueService)

	// Phase 3 handlers
	leagueHandler := handler.NewLeagueHandler(leagueService)
	tournamentHandler := handler.NewTournamentHandler(tournamentService)
	divisionHandler := handler.NewDivisionHandler(divisionService)
	registrationHandler := handler.NewRegistrationHandler(registrationService)
	seasonHandler := handler.NewSeasonHandler(seasonService)
	podHandler := handler.NewPodHandler(podService)
	announcementHandler := handler.NewAnnouncementHandler(announcementService)
	divTemplateHandler := handler.NewDivisionTemplateHandler(queries)
	leagueRegHandler := handler.NewLeagueRegistrationHandler(queries)

	// Phase 4A handlers
	scoringPresetHandler := handler.NewScoringPresetHandler(scoringPresetService)
	matchHandler := handler.NewMatchHandler(matchService)

	// Phase 4D handlers
	bracketHandler := handler.NewBracketHandler(bracketService)
	courtQueueHandler := handler.NewCourtQueueHandler(courtQueueService)

	// Phase 4E services + handlers
	matchSeriesService := service.NewMatchSeriesService(queries, pool, ps)
	matchSeriesHandler := handler.NewMatchSeriesHandler(matchSeriesService)
	quickMatchHandler := handler.NewQuickMatchHandler(matchService)

	// Phase 4C: WebSocket handler
	wsHandler := ws.NewHandler(ps, logger)

	// Start background jobs
	jobs.StartQuickMatchCleanup(ctx, matchService, logger)

	r := router.New(&router.Config{
		DB:             pool,
		SessionStore:   sessionStore,
		Redis:          sessionStore.Client(),
		AllowedOrigins: cfg.CORSAllowedOrigins,
		AuthHandler:    authHandler,
		HealthHandler:  healthHandler,
		PlayerHandler:  playerHandler,
		TeamHandler:    teamHandler,
		OrgHandler:     orgHandler,
		VenueHandler:   venueHandler,
		CourtHandler:   courtHandler,
		SecureCookie:   secureCookie,

		// Phase 3
		LeagueHandler:       leagueHandler,
		TournamentHandler:   tournamentHandler,
		DivisionHandler:     divisionHandler,
		RegistrationHandler: registrationHandler,
		SeasonHandler:       seasonHandler,
		PodHandler:          podHandler,
		AnnouncementHandler: announcementHandler,
		DivTemplateHandler:  divTemplateHandler,
		LeagueRegHandler:    leagueRegHandler,

		// Phase 4A
		ScoringPresetHandler: scoringPresetHandler,
		MatchHandler:         matchHandler,

		// Phase 4D
		BracketHandler:    bracketHandler,
		CourtQueueHandler: courtQueueHandler,

		// Phase 4E
		MatchSeriesHandler: matchSeriesHandler,
		QuickMatchHandler:  quickMatchHandler,

		// Phase 4C
		WSHandler: wsHandler.Routes(),
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down server")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
	}()

	slog.Info("server starting", "port", cfg.Port, "env", cfg.Env)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
