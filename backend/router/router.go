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
	})

	return r
}
