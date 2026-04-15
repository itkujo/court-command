// backend/router/router.go
package router

import (
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/session"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Config holds the dependencies needed to build the router.
type Config struct {
	DB             *pgxpool.Pool
	SessionStore   *session.Store
	Redis          *redis.Client
	AllowedOrigins []string
	AuthHandler    *handler.AuthHandler
	HealthHandler  *handler.HealthHandler
	PlayerHandler  *handler.PlayerHandler
	TeamHandler    *handler.TeamHandler
	OrgHandler     *handler.OrgHandler
	VenueHandler   *handler.VenueHandler
	CourtHandler   *handler.CourtHandler
	SecureCookie   bool

	// Phase 3 handlers
	LeagueHandler       *handler.LeagueHandler
	TournamentHandler   *handler.TournamentHandler
	DivisionHandler     *handler.DivisionHandler
	RegistrationHandler *handler.RegistrationHandler
	SeasonHandler       *handler.SeasonHandler
	PodHandler          *handler.PodHandler
	AnnouncementHandler *handler.AnnouncementHandler
	DivTemplateHandler  *handler.DivisionTemplateHandler
	LeagueRegHandler    *handler.LeagueRegistrationHandler

	// Phase 4A handlers
	ScoringPresetHandler *handler.ScoringPresetHandler
	MatchHandler         *handler.MatchHandler

	// Phase 4D handlers
	BracketHandler    *handler.BracketHandler
	CourtQueueHandler *handler.CourtQueueHandler

	// Phase 4E handlers
	MatchSeriesHandler *handler.MatchSeriesHandler
	QuickMatchHandler  *handler.QuickMatchHandler

	// Phase 5: Overlay
	OverlayHandler       *handler.OverlayHandler
	SourceProfileHandler *handler.SourceProfileHandler

	// Phase 6: Standings
	StandingsHandler *handler.StandingsHandler

	// Phase 4C: WebSocket
	WSHandler chi.Router
}

// New creates a chi.Router with all middleware and routes mounted.
func New(cfg *Config) chi.Router {
	r := chi.NewRouter()

	// Global middleware stack
	r.Use(middleware.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.StructuredLogger)
	r.Use(middleware.Recoverer)
	r.Use(chimw.CleanPath)
	r.Use(chimw.Timeout(60 * time.Second))
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.MaxBodySize(1 << 20)) // 1 MB default limit

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes (no auth required)
		r.Get("/health", cfg.HealthHandler.Check)

		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", cfg.AuthHandler.Register)
			r.Post("/login", cfg.AuthHandler.Login)
			r.Post("/logout", cfg.AuthHandler.Logout)

			// Authenticated auth routes
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.SessionStore))
				r.Get("/me", cfg.AuthHandler.Me)
			})
		})

		// Player routes (authenticated)
		r.Route("/players", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.PlayerHandler.Routes())
		})

		// Team routes (authenticated)
		r.Route("/teams", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.TeamHandler.Routes())
		})

		// Organization routes (authenticated)
		r.Route("/organizations", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.OrgHandler.Routes())
		})

		// Venue routes (authenticated)
		r.Route("/venues", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.VenueHandler.Routes())
		})

		// Court routes (authenticated — standalone/floating courts)
		r.Route("/courts", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.CourtHandler.Routes())
		})

		// --- Phase 3 routes ---

		// League routes (mixed auth: public reads, handler-level auth on writes)
		r.Route("/leagues", func(r chi.Router) {
			r.Mount("/", cfg.LeagueHandler.Routes())

			// League sub-resources (auth checked by handlers)
			r.Route("/{leagueID}/seasons", func(r chi.Router) {
				r.Mount("/", cfg.SeasonHandler.Routes())
			})
			r.Route("/{leagueID}/division-templates", func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.SessionStore))
				r.Mount("/", cfg.DivTemplateHandler.Routes())
			})
			r.Route("/{leagueID}/announcements", func(r chi.Router) {
				r.Mount("/", cfg.AnnouncementHandler.LeagueAnnouncementRoutes())
			})
			r.Route("/{leagueID}/registrations", func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.SessionStore))
				r.Mount("/", cfg.LeagueRegHandler.Routes())
			})
		})

		// Tournament routes (mixed auth: public reads, handler-level auth on writes)
		r.Route("/tournaments", func(r chi.Router) {
			r.Mount("/", cfg.TournamentHandler.Routes())

			// Tournament sub-resources (auth checked by handlers)
			r.Route("/{tournamentID}/divisions", func(r chi.Router) {
				r.Mount("/", cfg.DivisionHandler.Routes())
			})
			r.Route("/{tournamentID}/announcements", func(r chi.Router) {
				r.Mount("/", cfg.AnnouncementHandler.TournamentAnnouncementRoutes())
			})
		})

		// Division sub-resources (registrations and pods — auth checked by handlers)
		r.Route("/divisions/{divisionID}/registrations", func(r chi.Router) {
			r.Mount("/", cfg.RegistrationHandler.Routes())
		})
		r.Route("/divisions/{divisionID}/pods", func(r chi.Router) {
			r.Mount("/", cfg.PodHandler.Routes())
		})

		// Division-scoped matches
		r.Route("/divisions/{divisionID}/matches", func(r chi.Router) {
			r.Mount("/", cfg.MatchHandler.DivisionRoutes())
		})

		// --- Phase 4A routes ---

		// Scoring presets (mixed auth: public reads, handler-level auth on writes)
		r.Route("/scoring-presets", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.ScoringPresetHandler.Routes())
		})

		// Matches (authenticated)
		r.Route("/matches", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.MatchHandler.Routes())
		})

		// Court-scoped matches
		r.Route("/courts/{courtID}/matches", func(r chi.Router) {
			r.Mount("/", cfg.MatchHandler.CourtRoutes())
		})

		// --- Phase 4D routes ---

		// Bracket generation (authenticated)
		r.Route("/divisions/{divisionID}/bracket", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.BracketHandler.Routes())
		})

		// Court queue (mixed: GET public, writes authenticated by handler)
		r.Route("/courts/{courtID}/queue", func(r chi.Router) {
			r.Mount("/", cfg.CourtQueueHandler.Routes())
		})

		// Team-scoped matches
		r.Route("/teams/{teamID}/matches", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.MatchHandler.TeamRoutes())
		})

		// --- Phase 4E routes ---

		// Match series (authenticated)
		r.Route("/match-series", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.MatchSeriesHandler.Routes())
		})

		// Division-scoped match series
		r.Route("/divisions/{divisionID}/match-series", func(r chi.Router) {
			r.Mount("/", cfg.MatchSeriesHandler.DivisionRoutes())
		})

		// Quick matches (authenticated)
		r.Route("/quick-matches", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.QuickMatchHandler.Routes())
		})

		// --- Phase 6 routes ---

		// Standings (mixed auth: public reads, handler-level auth on writes)
		r.Route("/standings", func(r chi.Router) {
			r.Mount("/", cfg.StandingsHandler.Routes())
		})

		// --- Phase 5 routes ---

		// Overlay routes (mixed public and authenticated)
		r.Route("/overlay", func(r chi.Router) {
			// Public routes (overlay data, themes, demo, webhook)
			r.Get("/court/{courtID}/data", cfg.OverlayHandler.GetOverlayData)
			r.Get("/themes", cfg.OverlayHandler.ListThemes)
			r.Get("/themes/{themeID}", cfg.OverlayHandler.GetTheme)
			r.Get("/demo-data", cfg.OverlayHandler.GetDemoData)
			r.Post("/webhook/{courtID}", cfg.OverlayHandler.ReceiveWebhook)

			// Authenticated control panel routes
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.SessionStore))
				r.Get("/court/{courtID}/config", cfg.OverlayHandler.GetConfig)
				r.Put("/court/{courtID}/config/theme", cfg.OverlayHandler.UpdateTheme)
				r.Put("/court/{courtID}/config/elements", cfg.OverlayHandler.UpdateElements)
				r.Post("/court/{courtID}/config/token/generate", cfg.OverlayHandler.GenerateToken)
				r.Delete("/court/{courtID}/config/token", cfg.OverlayHandler.RevokeToken)
				r.Put("/court/{courtID}/config/source-profile", cfg.OverlayHandler.SetSourceProfile)
				r.Put("/court/{courtID}/config/data-overrides", cfg.OverlayHandler.UpdateDataOverrides)
				r.Delete("/court/{courtID}/config/data-overrides", cfg.OverlayHandler.ClearDataOverrides)
			})
		})

		// Source Profile routes (authenticated)
		r.Route("/source-profiles", func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg.SessionStore))
			r.Mount("/", cfg.SourceProfileHandler.Routes())
		})
	})

	// WebSocket routes (outside API versioning — protocol is inherently versioned)
	if cfg.WSHandler != nil {
		r.Mount("/ws", cfg.WSHandler)
	}

	return r
}
