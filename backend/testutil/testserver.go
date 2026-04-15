package testutil

import (
	"net/http/httptest"
	"os"
	"testing"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/handler"
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

	authService := service.NewAuthService(pool, store)
	playerService := service.NewPlayerService(queries)
	teamService := service.NewTeamService(queries)
	orgService := service.NewOrganizationService(queries, pool)
	venueService := service.NewVenueService(queries)

	authHandler := handler.NewAuthHandler(authService, false)
	healthHandler := handler.NewHealthHandler(pool, store.Client())
	playerHandler := handler.NewPlayerHandler(playerService)
	teamHandler := handler.NewTeamHandler(teamService)
	orgHandler := handler.NewOrgHandler(orgService)
	venueHandler := handler.NewVenueHandler(venueService)
	courtHandler := handler.NewCourtHandler(venueService)

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
	})

	ts := httptest.NewServer(r)

	t.Cleanup(func() {
		ts.Close()
		store.Close()
	})

	return ts
}
