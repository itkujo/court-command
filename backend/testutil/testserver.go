package testutil

import (
	"net/http/httptest"
	"os"
	"testing"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/overlay"
	"github.com/court-command/court-command/router"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestServer creates an httptest.Server wired with all real dependencies.
// Uses Redis DB 1 to avoid colliding with dev data.
func TestServer(t *testing.T, pool *pgxpool.Pool) *httptest.Server {
	t.Helper()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/1" // Use DB 1 for tests
	}

	store, err := session.NewStore(redisURL)
	if err != nil {
		t.Fatalf("creating session store: %v", err)
	}

	queries := generated.New(pool)

	// Phase 1+2 services
	authService := service.NewAuthService(pool, store)
	playerService := service.NewPlayerService(queries)
	teamService := service.NewTeamService(queries)
	orgService := service.NewOrganizationService(queries, pool)
	venueService := service.NewVenueService(queries)

	// Phase 3 services
	leagueService := service.NewLeagueService(queries)
	tournamentStaffService := service.NewTournamentStaffService(queries, pool)
	tournamentService := service.NewTournamentService(queries, pool, tournamentStaffService)
	divisionService := service.NewDivisionService(queries)
	registrationService := service.NewRegistrationService(queries)
	seasonService := service.NewSeasonService(queries)
	podService := service.NewPodService(queries)
	announcementService := service.NewAnnouncementService(queries)

	// Phase 4A services
	scoringPresetService := service.NewScoringPresetService(queries)
	matchService := service.NewMatchService(queries, pool, nil, nil)
	venueService.SetMatchService(matchService)

	// Phase 4D services
	bracketService := service.NewBracketService(queries, pool)
	courtQueueService := service.NewCourtQueueService(queries, pool, nil)

	// Phase 1+2 handlers
	authHandler := handler.NewAuthHandler(authService, false)
	healthHandler := handler.NewHealthHandler(pool, store.Client())
	playerHandler := handler.NewPlayerHandler(playerService)
	teamHandler := handler.NewTeamHandler(teamService)
	orgHandler := handler.NewOrgHandler(orgService, teamService)
	venueHandler := handler.NewVenueHandler(venueService)
	courtHandler := handler.NewCourtHandler(venueService)

	// Phase 3 handlers
	leagueHandler := handler.NewLeagueHandler(leagueService)
	tournamentHandler := handler.NewTournamentHandler(tournamentService)
	tournamentStaffHandler := handler.NewTournamentStaffHandler(tournamentStaffService, tournamentService)
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
	matchSeriesService := service.NewMatchSeriesService(queries, pool, nil)
	matchSeriesHandler := handler.NewMatchSeriesHandler(matchSeriesService)
	quickMatchHandler := handler.NewQuickMatchHandler(matchService)

	// Phase 6: Standings
	standingsService := service.NewStandingsService(queries)
	standingsHandler := handler.NewStandingsHandler(standingsService)

	// Phase 7: Public & Player Experience
	dashboardService := service.NewDashboardService(queries)
	searchService := service.NewSearchService(queries)

	// Phase 5: Overlay (pass nil for pubsub in tests)
	overlayResolver := overlay.NewResolver(queries, nil)
	overlayService := service.NewOverlayService(pool, queries, overlayResolver, nil)
	sourceProfileService := service.NewSourceProfileService(queries)
	overlayHandler := handler.NewOverlayHandler(overlayService, sourceProfileService)
	sourceProfileHandler := handler.NewSourceProfileHandler(sourceProfileService)

	// Phase 7: Handlers
	dashboardHandler := handler.NewDashboardHandler(dashboardService)
	searchHandler := handler.NewSearchHandler(searchService)
	publicHandler := handler.NewPublicHandler(queries)
	publicHandler.SetMatchService(matchService)
	publicHandler.SetDivisionService(divisionService)
	publicHandler.SetVenueService(venueService)
	publicHandler.SetSeasonService(seasonService)
	publicHandler.SetTournamentService(tournamentService)

	// Phase 8: Admin & Platform Management
	activityLogService := service.NewActivityLogService(queries)
	apiKeyService := service.NewApiKeyService(queries)
	uploadService := service.NewUploadService(queries, t.TempDir())
	adminHandler := handler.NewAdminHandler(queries, activityLogService, apiKeyService, store, uploadService)
	uploadHandler := handler.NewUploadHandler(uploadService)

	r := router.New(&router.Config{
		DB:             pool,
		SessionStore:   store,
		Redis:          store.Client(),
		AllowedOrigins: []string{"http://localhost:5173"},
		AuthHandler:    authHandler,
		HealthHandler:  healthHandler,
		PlayerHandler:  playerHandler,
		TeamHandler:    teamHandler,
		OrgHandler:     orgHandler,
		VenueHandler:   venueHandler,
		CourtHandler:   courtHandler,
		SecureCookie:   false,

		// Phase 3
		LeagueHandler:          leagueHandler,
		TournamentHandler:      tournamentHandler,
		TournamentStaffHandler: tournamentStaffHandler,
		DivisionHandler:        divisionHandler,
		RegistrationHandler:    registrationHandler,
		SeasonHandler:          seasonHandler,
		PodHandler:             podHandler,
		AnnouncementHandler:    announcementHandler,
		DivTemplateHandler:     divTemplateHandler,
		LeagueRegHandler:       leagueRegHandler,

		// Phase 4A
		ScoringPresetHandler: scoringPresetHandler,
		MatchHandler:         matchHandler,

		// Phase 4D
		BracketHandler:    bracketHandler,
		CourtQueueHandler: courtQueueHandler,

		// Phase 4E
		MatchSeriesHandler: matchSeriesHandler,
		QuickMatchHandler:  quickMatchHandler,

		// Phase 5
		OverlayHandler:       overlayHandler,
		SourceProfileHandler: sourceProfileHandler,

		// Phase 6
		StandingsHandler: standingsHandler,

		// Phase 7
		DashboardHandler: dashboardHandler,
		SearchHandler:    searchHandler,
		PublicHandler:    publicHandler,

		// Phase 8
		AdminHandler:  adminHandler,
		UploadHandler: uploadHandler,
		ApiKeySvc:     apiKeyService,
	})

	ts := httptest.NewServer(r)

	t.Cleanup(func() {
		ts.Close()
		store.Close()
	})

	return ts
}
