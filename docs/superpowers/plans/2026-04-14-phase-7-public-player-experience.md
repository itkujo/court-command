# Phase 7: Public & Player Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the player dashboard ("My Court Command"), public tournament/league directory and detail pages, public bracket/schedule views, and the unified global search endpoint. All read-only aggregation from existing data — no new tables.

**Architecture:** New handlers aggregate data from existing services. The player dashboard fetches upcoming matches, active tournaments, recent results, stats, and announcements for the authenticated user. The public directory lists tournaments/leagues filterable by location/date/status. Global search queries across all entity types with privacy enforcement. No new migrations — all data exists.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, PostgreSQL 17

**Depends on:** All prior phases (1-6)

---

## File Structure

```
backend/
├── db/
│   └── queries/
│       ├── dashboard.sql                # Aggregation queries for player dashboard
│       └── search.sql                   # Global search queries
├── handler/
│   ├── dashboard.go                     # Player dashboard endpoints
│   ├── public.go                        # Public directory and detail pages
│   └── search.go                        # Unified global search
├── service/
│   ├── dashboard.go                     # Player dashboard service
│   └── search.go                        # Search service
└── router/
    └── router.go                        # Modified: mount new routes
```

---

## Task 1: Dashboard Queries

**Files:**
- Create: `backend/db/queries/dashboard.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/dashboard.sql

-- name: GetUpcomingMatchesForPlayer :many
SELECT m.* FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team_1_id OR tr.team_id = m.team_2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND tr.left_at IS NULL
  AND m.status IN ('scheduled', 'in_progress')
ORDER BY m.scheduled_at NULLS LAST, m.created_at
LIMIT $2;

-- name: GetActiveRegistrationsForPlayer :many
SELECT r.*, d.name as division_name, d.tournament_id, t.name as tournament_name, t.status as tournament_status
FROM registrations r
JOIN divisions d ON d.id = r.division_id
JOIN tournaments t ON t.id = d.tournament_id
WHERE (r.player_id = $1 OR r.team_id IN (
    SELECT tr.team_id FROM team_rosters tr
    WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
))
AND r.status IN ('approved', 'checked_in')
AND t.status NOT IN ('completed', 'archived', 'cancelled')
ORDER BY t.start_date NULLS LAST;

-- name: GetRecentMatchResultsForPlayer :many
SELECT m.* FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team_1_id OR tr.team_id = m.team_2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND m.status IN ('completed', 'forfeit')
  AND m.is_quick_match = false
ORDER BY m.completed_at DESC
LIMIT $2;

-- name: GetPlayerStatsAggregate :one
SELECT
    COUNT(*) FILTER (WHERE m.status IN ('completed', 'forfeit')) as matches_played,
    COUNT(*) FILTER (WHERE m.winner_id = tr.team_id AND m.status = 'completed') as matches_won,
    COUNT(*) FILTER (WHERE m.loser_id = tr.team_id AND m.status = 'completed') as matches_lost
FROM matches m
JOIN team_rosters tr ON (tr.team_id = m.team_1_id OR tr.team_id = m.team_2_id)
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND m.is_quick_match = false
  AND m.status IN ('completed', 'forfeit');

-- name: GetAnnouncementsForPlayer :many
SELECT a.* FROM announcements a
WHERE a.tournament_id IN (
    SELECT DISTINCT d.tournament_id FROM registrations r
    JOIN divisions d ON d.id = r.division_id
    WHERE (r.player_id = $1 OR r.team_id IN (
        SELECT tr.team_id FROM team_rosters tr
        WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
    ))
    AND r.status IN ('approved', 'checked_in')
)
OR a.league_id IN (
    SELECT DISTINCT t.league_id FROM registrations r
    JOIN divisions d ON d.id = r.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE t.league_id IS NOT NULL
    AND (r.player_id = $1 OR r.team_id IN (
        SELECT tr.team_id FROM team_rosters tr
        WHERE tr.player_id = $1 AND tr.status = 'active' AND tr.left_at IS NULL
    ))
    AND r.status IN ('approved', 'checked_in')
)
ORDER BY a.is_pinned DESC, a.created_at DESC
LIMIT $2;

-- name: GetPlayerTeams :many
SELECT t.*, tr.role as roster_role, tr.jersey_number
FROM teams t
JOIN team_rosters tr ON tr.team_id = t.id
WHERE tr.player_id = $1
  AND tr.status = 'active'
  AND tr.left_at IS NULL
ORDER BY t.name;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/dashboard.sql backend/db/generated/
git commit -m "feat: add player dashboard aggregation queries"
```

---

## Task 2: Search Queries

**Files:**
- Create: `backend/db/queries/search.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/search.sql

-- name: SearchPlayersGlobal :many
SELECT id, public_id, first_name, last_name, display_name, city, state_province, is_profile_hidden
FROM users
WHERE deleted_at IS NULL
  AND status = 'active'
  AND is_profile_hidden = false
  AND (
    first_name ILIKE '%' || $1 || '%'
    OR last_name ILIKE '%' || $1 || '%'
    OR display_name ILIKE '%' || $1 || '%'
    OR public_id = $1
  )
ORDER BY last_name, first_name
LIMIT $2;

-- name: SearchTeamsGlobal :many
SELECT id, name, short_name, slug, logo_url, primary_color, org_id
FROM teams
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || $1 || '%'
    OR short_name ILIKE '%' || $1 || '%'
  )
ORDER BY name
LIMIT $2;

-- name: SearchOrganizationsGlobal :many
SELECT id, name, slug, logo_url, city, state_province, country
FROM organizations
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || $1 || '%'
  )
ORDER BY name
LIMIT $2;

-- name: SearchTournamentsGlobal :many
SELECT id, public_id, name, slug, status, start_date, end_date, venue_id, logo_url
FROM tournaments
WHERE deleted_at IS NULL
  AND status NOT IN ('draft', 'cancelled')
  AND (
    name ILIKE '%' || $1 || '%'
  )
ORDER BY start_date DESC
LIMIT $2;

-- name: SearchLeaguesGlobal :many
SELECT id, public_id, name, slug, status, logo_url, city, state_province, country
FROM leagues
WHERE deleted_at IS NULL
  AND status NOT IN ('draft', 'cancelled')
  AND (
    name ILIKE '%' || $1 || '%'
  )
ORDER BY name
LIMIT $2;

-- name: SearchVenuesGlobal :many
SELECT id, name, slug, city, state_province, country, logo_url
FROM venues
WHERE deleted_at IS NULL
  AND status = 'published'
  AND (
    name ILIKE '%' || $1 || '%'
    OR city ILIKE '%' || $1 || '%'
  )
ORDER BY name
LIMIT $2;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/search.sql backend/db/generated/
git commit -m "feat: add global search queries"
```

---

## Task 3: Dashboard Service

**Files:**
- Create: `backend/service/dashboard.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/dashboard.go
package service

import (
	"context"

	"github.com/court-command/court-command/backend/db/generated"
)

// DashboardData holds all data for the player dashboard.
type DashboardData struct {
	UpcomingMatches      []generated.Match                       `json:"upcoming_matches"`
	ActiveRegistrations  []generated.GetActiveRegistrationsForPlayerRow `json:"active_registrations"`
	RecentResults        []generated.Match                       `json:"recent_results"`
	Stats                generated.GetPlayerStatsAggregateRow    `json:"stats"`
	Announcements        []generated.Announcement                `json:"announcements"`
	Teams                []generated.GetPlayerTeamsRow           `json:"teams"`
}

// DashboardService aggregates data for the player dashboard.
type DashboardService struct {
	queries *generated.Queries
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(queries *generated.Queries) *DashboardService {
	return &DashboardService{queries: queries}
}

// GetDashboard returns the full player dashboard data.
func (s *DashboardService) GetDashboard(ctx context.Context, userID int64) (DashboardData, error) {
	var data DashboardData

	// Upcoming matches (limit 10)
	upcoming, err := s.queries.GetUpcomingMatchesForPlayer(ctx, generated.GetUpcomingMatchesForPlayerParams{
		PlayerID: userID,
		Limit:    10,
	})
	if err == nil {
		data.UpcomingMatches = upcoming
	}
	if data.UpcomingMatches == nil {
		data.UpcomingMatches = []generated.Match{}
	}

	// Active tournament registrations
	active, err := s.queries.GetActiveRegistrationsForPlayer(ctx, userID)
	if err == nil {
		data.ActiveRegistrations = active
	}
	if data.ActiveRegistrations == nil {
		data.ActiveRegistrations = []generated.GetActiveRegistrationsForPlayerRow{}
	}

	// Recent match results (limit 20)
	recent, err := s.queries.GetRecentMatchResultsForPlayer(ctx, generated.GetRecentMatchResultsForPlayerParams{
		PlayerID: userID,
		Limit:    20,
	})
	if err == nil {
		data.RecentResults = recent
	}
	if data.RecentResults == nil {
		data.RecentResults = []generated.Match{}
	}

	// Stats aggregate
	stats, err := s.queries.GetPlayerStatsAggregate(ctx, userID)
	if err == nil {
		data.Stats = stats
	}

	// Announcements from registered tournaments/leagues (limit 20)
	announcements, err := s.queries.GetAnnouncementsForPlayer(ctx, generated.GetAnnouncementsForPlayerParams{
		PlayerID: userID,
		Limit:    20,
	})
	if err == nil {
		data.Announcements = announcements
	}
	if data.Announcements == nil {
		data.Announcements = []generated.Announcement{}
	}

	// Player's teams
	teams, err := s.queries.GetPlayerTeams(ctx, userID)
	if err == nil {
		data.Teams = teams
	}
	if data.Teams == nil {
		data.Teams = []generated.GetPlayerTeamsRow{}
	}

	return data, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/dashboard.go
git commit -m "feat: add player dashboard service"
```

---

## Task 4: Search Service

**Files:**
- Create: `backend/service/search.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/search.go
package service

import (
	"context"

	"github.com/court-command/court-command/backend/db/generated"
)

// SearchResults holds grouped search results.
type SearchResults struct {
	Players       []generated.SearchPlayersGlobalRow       `json:"players"`
	Teams         []generated.SearchTeamsGlobalRow         `json:"teams"`
	Organizations []generated.SearchOrganizationsGlobalRow `json:"organizations"`
	Tournaments   []generated.SearchTournamentsGlobalRow   `json:"tournaments"`
	Leagues       []generated.SearchLeaguesGlobalRow       `json:"leagues"`
	Venues        []generated.SearchVenuesGlobalRow        `json:"venues"`
}

// SearchService handles global search across all entity types.
type SearchService struct {
	queries *generated.Queries
}

// NewSearchService creates a new SearchService.
func NewSearchService(queries *generated.Queries) *SearchService {
	return &SearchService{queries: queries}
}

// Search performs a global search across all entity types.
// Returns top 5 results per type.
func (s *SearchService) Search(ctx context.Context, query string) (SearchResults, error) {
	var results SearchResults
	limit := int32(5)

	// Search all entity types in parallel would be ideal,
	// but sequential is fine for v2 — optimize later if needed

	players, err := s.queries.SearchPlayersGlobal(ctx, generated.SearchPlayersGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Players = players
	}
	if results.Players == nil {
		results.Players = []generated.SearchPlayersGlobalRow{}
	}

	teams, err := s.queries.SearchTeamsGlobal(ctx, generated.SearchTeamsGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Teams = teams
	}
	if results.Teams == nil {
		results.Teams = []generated.SearchTeamsGlobalRow{}
	}

	orgs, err := s.queries.SearchOrganizationsGlobal(ctx, generated.SearchOrganizationsGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Organizations = orgs
	}
	if results.Organizations == nil {
		results.Organizations = []generated.SearchOrganizationsGlobalRow{}
	}

	tournaments, err := s.queries.SearchTournamentsGlobal(ctx, generated.SearchTournamentsGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Tournaments = tournaments
	}
	if results.Tournaments == nil {
		results.Tournaments = []generated.SearchTournamentsGlobalRow{}
	}

	leagues, err := s.queries.SearchLeaguesGlobal(ctx, generated.SearchLeaguesGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Leagues = leagues
	}
	if results.Leagues == nil {
		results.Leagues = []generated.SearchLeaguesGlobalRow{}
	}

	venues, err := s.queries.SearchVenuesGlobal(ctx, generated.SearchVenuesGlobalParams{
		Column1: query,
		Limit:   limit,
	})
	if err == nil {
		results.Venues = venues
	}
	if results.Venues == nil {
		results.Venues = []generated.SearchVenuesGlobalRow{}
	}

	return results, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/search.go
git commit -m "feat: add global search service"
```

---

## Task 5: Dashboard Handler

**Files:**
- Create: `backend/handler/dashboard.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/dashboard.go
package handler

import (
	"net/http"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
)

// DashboardHandler handles player dashboard requests.
type DashboardHandler struct {
	dashboardService *service.DashboardService
}

// NewDashboardHandler creates a new DashboardHandler.
func NewDashboardHandler(dashboardService *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboardService: dashboardService}
}

// Routes returns the Chi routes for the dashboard.
func (h *DashboardHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.GetDashboard)
	return r
}

// GetDashboard handles GET /api/v1/dashboard
func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	data, err := h.dashboardService.GetDashboard(r.Context(), user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "DASHBOARD_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, data)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/handler/dashboard.go
git commit -m "feat: add player dashboard handler"
```

---

## Task 6: Search Handler

**Files:**
- Create: `backend/handler/search.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/search.go
package handler

import (
	"net/http"

	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
)

// SearchHandler handles global search requests.
type SearchHandler struct {
	searchService *service.SearchService
}

// NewSearchHandler creates a new SearchHandler.
func NewSearchHandler(searchService *service.SearchService) *SearchHandler {
	return &SearchHandler{searchService: searchService}
}

// Routes returns the Chi routes for search.
func (h *SearchHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.Search)
	return r
}

// Search handles GET /api/v1/search?q={query}
func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		respondError(w, http.StatusBadRequest, "MISSING_QUERY", "q parameter is required")
		return
	}

	if len(query) < 2 {
		respondError(w, http.StatusBadRequest, "QUERY_TOO_SHORT", "Query must be at least 2 characters")
		return
	}

	results, err := h.searchService.Search(r.Context(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, results)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/handler/search.go
git commit -m "feat: add global search handler"
```

---

## Task 7: Public Directory Handler

**Files:**
- Create: `backend/handler/public.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/public.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/go-chi/chi/v5"
)

// PublicHandler handles unauthenticated public directory endpoints.
type PublicHandler struct {
	queries *generated.Queries
}

// NewPublicHandler creates a new PublicHandler.
func NewPublicHandler(queries *generated.Queries) *PublicHandler {
	return &PublicHandler{queries: queries}
}

// Routes returns the Chi routes for public endpoints.
func (h *PublicHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Tournament directory
	r.Get("/tournaments", h.ListTournaments)
	r.Get("/tournaments/{slug}", h.GetTournamentBySlug)

	// League directory
	r.Get("/leagues", h.ListLeagues)
	r.Get("/leagues/{slug}", h.GetLeagueBySlug)

	// Venue directory
	r.Get("/venues", h.ListVenues)
	r.Get("/venues/{slug}", h.GetVenueBySlug)

	return r
}

// ListTournaments handles GET /api/v1/public/tournaments
// Filterable by status, location, date range
func (h *PublicHandler) ListTournaments(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)

	if limit <= 0 || limit > 50 {
		limit = 20
	}

	// Use existing search/list queries from Phase 3
	// The executing agent should use the appropriate query based on filters
	var tournaments []generated.Tournament
	var err error

	if status != "" {
		tournaments, err = h.queries.ListTournamentsByStatus(ctx, generated.ListTournamentsByStatusParams{
			Status: status,
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	} else {
		tournaments, err = h.queries.SearchTournaments(ctx, generated.SearchTournamentsParams{
			Column1: "%", // match all
			Limit:   int32(limit),
			Offset:  int32(offset),
		})
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, tournaments)
}

// GetTournamentBySlug handles GET /api/v1/public/tournaments/{slug}
func (h *PublicHandler) GetTournamentBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	tournament, err := h.queries.GetTournamentBySlug(ctx, slug)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}

	// Only show published tournaments publicly
	if tournament.Status == "draft" {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}

	respondJSON(w, http.StatusOK, tournament)
}

// ListLeagues handles GET /api/v1/public/leagues
func (h *PublicHandler) ListLeagues(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)

	if limit <= 0 || limit > 50 {
		limit = 20
	}

	leagues, err := h.queries.SearchLeagues(ctx, generated.SearchLeaguesParams{
		Column1: "%",
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, leagues)
}

// GetLeagueBySlug handles GET /api/v1/public/leagues/{slug}
func (h *PublicHandler) GetLeagueBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	league, err := h.queries.GetLeagueBySlug(ctx, slug)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}

	if league.Status == "draft" {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}

	respondJSON(w, http.StatusOK, league)
}

// ListVenues handles GET /api/v1/public/venues
func (h *PublicHandler) ListVenues(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)

	if limit <= 0 || limit > 50 {
		limit = 20
	}

	venues, err := h.queries.SearchVenues(ctx, generated.SearchVenuesParams{
		Column1: "%",
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, venues)
}

// GetVenueBySlug handles GET /api/v1/public/venues/{slug}
func (h *PublicHandler) GetVenueBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	venue, err := h.queries.GetVenueBySlug(ctx, slug)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Venue not found")
		return
	}

	if venue.Status != "published" {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Venue not found")
		return
	}

	respondJSON(w, http.StatusOK, venue)
}
```

**Note for executing agent:** The `ctx` variable is used without being defined — it should be `r.Context()` in all query calls. The query names (`ListTournamentsByStatus`, `SearchTournaments`, `GetTournamentBySlug`, `SearchLeagues`, `GetLeagueBySlug`, `SearchVenues`, `GetVenueBySlug`) may differ from Phase 3 — check actual generated query names and adjust. Some queries may need to be added to Phase 3's query files.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors (after fixing ctx references).

- [ ] **Step 3: Commit**

```bash
git add backend/handler/public.go
git commit -m "feat: add public directory handler for tournaments, leagues, venues"
```

---

## Task 8: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Mount new routes**

```go
// Player dashboard (authenticated)
r.Route("/api/v1/dashboard", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Mount("/", dashboardHandler.Routes())
})

// Global search (public — can be accessed without auth)
r.Route("/api/v1/search", func(r chi.Router) {
    r.Mount("/", searchHandler.Routes())
})

// Public directory (no auth)
r.Route("/api/v1/public", func(r chi.Router) {
    r.Mount("/", publicHandler.Routes())
})
```

- [ ] **Step 2: Wire services and handlers in main.go**

- [ ] **Step 3: Verify and commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire dashboard, search, and public directory routes"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full build**

Run: `cd backend && go build ./...`

- [ ] **Step 2: sqlc generate**

Run: `cd backend && sqlc generate`

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: phase 7 final cleanup"
```

---

## Summary

Phase 7 adds:

### No new tables — all aggregation from existing data.

### New endpoints (9):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/dashboard` | Player dashboard (auth) |
| `GET` | `/api/v1/search?q={query}` | Global search (public) |
| `GET` | `/api/v1/public/tournaments` | Tournament directory |
| `GET` | `/api/v1/public/tournaments/{slug}` | Tournament detail |
| `GET` | `/api/v1/public/leagues` | League directory |
| `GET` | `/api/v1/public/leagues/{slug}` | League detail |
| `GET` | `/api/v1/public/venues` | Venue directory |
| `GET` | `/api/v1/public/venues/{slug}` | Venue detail |

### Dashboard sections:
- Upcoming matches, active registrations, recent results, stats aggregate, announcements, teams
