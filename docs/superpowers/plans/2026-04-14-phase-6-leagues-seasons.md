# Phase 6: Leagues & Seasons (Standings) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the StandingsEntry table and standings computation system. Compute season standings from tournament results using configurable methods (placement_points, win_loss, match_points, custom). Add standings recomputation triggers, league/season dashboard data endpoints, and division template propagation from league to tournament.

**Architecture:** One new migration adds the `standings_entries` table. A standalone `StandingsService` computes standings from existing Registration/Match data using the Season's `standings_method` and `standings_config`. Standings are recomputed on-demand (TD clicks "Recompute") or automatically when a tournament within the season is completed. Division template propagation is a service method that copies league division templates into a new tournament.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17

**Depends on:** Phase 3 (leagues, seasons, tournaments, divisions, registrations, division templates), Phase 4A (matches)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   └── 00023_create_standings_entries.sql
│   └── queries/
│       └── standings_entries.sql
├── handler/
│   └── standings.go
├── service/
│   ├── standings.go                    # Standings computation engine
│   └── division_template.go           # Division template propagation (if not already in Phase 3)
└── router/
    └── router.go                       # Modified: mount standings routes
```

---

## Task 1: StandingsEntry Migration

**Files:**
- Create: `backend/db/migrations/00023_create_standings_entries.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00023_create_standings_entries.sql

-- +goose Up
CREATE TABLE standings_entries (
    id                  BIGSERIAL PRIMARY KEY,
    season_id           BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    division_id         BIGINT NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    registration_id     BIGINT REFERENCES registrations(id),
    team_id             BIGINT REFERENCES teams(id),
    player_id           BIGINT REFERENCES users(id),
    points              INT NOT NULL DEFAULT 0,
    matches_played      INT NOT NULL DEFAULT 0,
    matches_won         INT NOT NULL DEFAULT 0,
    matches_lost        INT NOT NULL DEFAULT 0,
    games_won           INT NOT NULL DEFAULT 0,
    games_lost          INT NOT NULL DEFAULT 0,
    point_differential  INT NOT NULL DEFAULT 0,
    tournaments_played  INT NOT NULL DEFAULT 0,
    rank                INT NOT NULL DEFAULT 0,
    is_withdrawn        BOOLEAN NOT NULL DEFAULT false,
    override_points     INT,
    override_reason     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_standings_season ON standings_entries (season_id);
CREATE INDEX idx_standings_division ON standings_entries (division_id);
CREATE INDEX idx_standings_season_division ON standings_entries (season_id, division_id);
CREATE INDEX idx_standings_rank ON standings_entries (season_id, division_id, rank);
CREATE UNIQUE INDEX idx_standings_unique ON standings_entries (season_id, division_id, COALESCE(team_id, 0), COALESCE(player_id, 0));

-- +goose Down
DROP TABLE IF EXISTS standings_entries;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00023_create_standings_entries.sql
git commit -m "feat: add standings_entries table migration"
```

---

## Task 2: StandingsEntry Queries

**Files:**
- Create: `backend/db/queries/standings_entries.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/standings_entries.sql

-- name: UpsertStandingsEntry :one
INSERT INTO standings_entries (
    season_id, division_id, registration_id, team_id, player_id,
    points, matches_played, matches_won, matches_lost,
    games_won, games_lost, point_differential, tournaments_played, rank
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (season_id, division_id, COALESCE(team_id, 0), COALESCE(player_id, 0))
DO UPDATE SET
    registration_id = EXCLUDED.registration_id,
    points = EXCLUDED.points,
    matches_played = EXCLUDED.matches_played,
    matches_won = EXCLUDED.matches_won,
    matches_lost = EXCLUDED.matches_lost,
    games_won = EXCLUDED.games_won,
    games_lost = EXCLUDED.games_lost,
    point_differential = EXCLUDED.point_differential,
    tournaments_played = EXCLUDED.tournaments_played,
    rank = EXCLUDED.rank,
    updated_at = now()
RETURNING *;

-- name: GetStandingsBySeasonAndDivision :many
SELECT * FROM standings_entries
WHERE season_id = $1 AND division_id = $2
ORDER BY rank;

-- name: GetStandingsBySeason :many
SELECT * FROM standings_entries
WHERE season_id = $1
ORDER BY division_id, rank;

-- name: GetStandingsEntryByID :one
SELECT * FROM standings_entries WHERE id = $1;

-- name: UpdateStandingsOverride :one
UPDATE standings_entries
SET override_points = $2,
    override_reason = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ClearStandingsOverride :one
UPDATE standings_entries
SET override_points = NULL,
    override_reason = NULL,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MarkStandingsWithdrawn :one
UPDATE standings_entries
SET is_withdrawn = true, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteStandingsBySeasonAndDivision :exec
DELETE FROM standings_entries
WHERE season_id = $1 AND division_id = $2;

-- name: DeleteStandingsBySeason :exec
DELETE FROM standings_entries
WHERE season_id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/standings_entries.sql backend/db/generated/
git commit -m "feat: add standings_entries sqlc queries"
```

---

## Task 3: Standings Computation Service

**Files:**
- Create: `backend/service/standings.go`

- [ ] **Step 1: Create the standings service**

```go
// backend/service/standings.go
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StandingsService computes and manages season standings.
type StandingsService struct {
	pool    *pgxpool.Pool
	queries *generated.Queries
}

// NewStandingsService creates a new StandingsService.
func NewStandingsService(pool *pgxpool.Pool, queries *generated.Queries) *StandingsService {
	return &StandingsService{pool: pool, queries: queries}
}

// StandingsMethod defines how standings are computed.
type StandingsMethod string

const (
	MethodPlacementPoints StandingsMethod = "placement_points"
	MethodWinLoss         StandingsMethod = "win_loss"
	MethodMatchPoints     StandingsMethod = "match_points"
	MethodCustom          StandingsMethod = "custom"
)

// PlacementPointsConfig configures the placement_points method.
type PlacementPointsConfig struct {
	PointsTable        map[int]int `json:"points_table"`        // placement → points (e.g. {1: 10, 2: 7, 3: 5})
	ParticipationPoints int        `json:"participation_points"` // points for entering
}

// WinLossConfig configures the win_loss method.
type WinLossConfig struct {
	Tiebreakers []string `json:"tiebreakers"` // ordered list: "point_differential", "head_to_head", "games_won"
}

// MatchPointsConfig configures the match_points method.
type MatchPointsConfig struct {
	Win        int `json:"win"`
	Loss       int `json:"loss"`
	ForfeitWin int `json:"forfeit_win"`
	ForfeitLoss int `json:"forfeit_loss"`
	Bye        int `json:"bye"`
}

// standingsRow is an intermediate computation row.
type standingsRow struct {
	TeamID           int64
	PlayerID         int64
	RegistrationID   int64
	Points           int
	MatchesPlayed    int
	MatchesWon       int
	MatchesLost      int
	GamesWon         int
	GamesLost        int
	PointDiff        int
	TournamentsPlayed int
	IsWithdrawn      bool
	OverridePoints   *int
}

// RecomputeForSeasonDivision recomputes standings for a specific season and division.
// It aggregates data from all tournaments in the season that have matching divisions.
func (s *StandingsService) RecomputeForSeasonDivision(ctx context.Context, seasonID int64, divisionID int64) ([]generated.StandingsEntry, error) {
	// Get the season to determine standings method
	season, err := s.queries.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, fmt.Errorf("get season: %w", err)
	}

	method := StandingsMethod(season.StandingsMethod)

	// Get all tournaments in this season
	tournaments, err := s.queries.ListTournamentsBySeason(ctx, pgtype.Int8{Int64: seasonID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("list tournaments: %w", err)
	}

	// Aggregate standings across all completed tournaments
	rowMap := make(map[string]*standingsRow) // key: "team:{id}" or "player:{id}"

	for _, tournament := range tournaments {
		if tournament.Status != "completed" {
			continue
		}

		// Find matching divisions in this tournament
		divisions, err := s.queries.ListDivisionsByTournament(ctx, tournament.ID)
		if err != nil {
			continue
		}

		for _, div := range divisions {
			// Match divisions by name (league template → tournament division)
			// This is a simplification; in practice, divisions may have a template_id link
			if div.ID != divisionID {
				continue
			}

			// Get registrations and their final placements
			registrations, err := s.queries.ListRegistrationsByDivision(ctx, generated.ListRegistrationsByDivisionParams{
				DivisionID: div.ID,
				Limit:      1000,
				Offset:     0,
			})
			if err != nil {
				continue
			}

			for _, reg := range registrations {
				if reg.Status == "withdrawn" || reg.Status == "rejected" || reg.Status == "no_show" {
					continue
				}

				key := s.registrationKey(reg)
				row, ok := rowMap[key]
				if !ok {
					row = &standingsRow{
						TeamID:   reg.TeamID.Int64,
						PlayerID: reg.PlayerID.Int64,
					}
					if reg.TeamID.Valid {
						row.TeamID = reg.TeamID.Int64
					}
					if reg.PlayerID.Valid {
						row.PlayerID = reg.PlayerID.Int64
					}
					row.RegistrationID = reg.ID
					rowMap[key] = row
				}

				row.TournamentsPlayed++

				// Compute match stats for this registration
				matches, err := s.queries.ListMatchesByTeamInDivision(ctx, generated.ListMatchesByTeamInDivisionParams{
					DivisionID: pgtype.Int8{Int64: div.ID, Valid: true},
					Team1ID:    reg.TeamID,
				})
				if err == nil {
					for _, m := range matches {
						if m.Status != "completed" && m.Status != "forfeit" {
							continue
						}
						row.MatchesPlayed++
						if m.WinnerID.Valid && ((reg.TeamID.Valid && m.WinnerID.Int64 == reg.TeamID.Int64) ||
							(reg.PlayerID.Valid && m.WinnerID.Int64 == reg.PlayerID.Int64)) {
							row.MatchesWon++
						} else {
							row.MatchesLost++
						}

						// Parse completed games for game-level stats
						var games []struct {
							ScoreTeam1 int `json:"score_team_1"`
							ScoreTeam2 int `json:"score_team_2"`
							Winner     int `json:"winner"`
						}
						if err := json.Unmarshal(m.CompletedGames, &games); err == nil {
							for _, g := range games {
								isTeam1 := reg.TeamID.Valid && m.Team1ID.Valid && reg.TeamID.Int64 == m.Team1ID.Int64
								if isTeam1 {
									row.GamesWon += g.ScoreTeam1
									row.GamesLost += g.ScoreTeam2
									row.PointDiff += g.ScoreTeam1 - g.ScoreTeam2
								} else {
									row.GamesWon += g.ScoreTeam2
									row.GamesLost += g.ScoreTeam1
									row.PointDiff += g.ScoreTeam2 - g.ScoreTeam1
								}
							}
						}
					}
				}

				// Apply method-specific points
				switch method {
				case MethodPlacementPoints:
					var config PlacementPointsConfig
					if err := json.Unmarshal(season.StandingsConfig, &config); err == nil {
						if reg.FinalPlacement.Valid {
							if pts, ok := config.PointsTable[int(reg.FinalPlacement.Int32)]; ok {
								row.Points += pts
							}
						}
						row.Points += config.ParticipationPoints
					}
				case MethodWinLoss:
					// Points = wins (tiebreakers handled at ranking)
					row.Points = row.MatchesWon
				case MethodMatchPoints:
					var config MatchPointsConfig
					if err := json.Unmarshal(season.StandingsConfig, &config); err == nil {
						row.Points += row.MatchesWon * config.Win
						row.Points += row.MatchesLost * config.Loss
						// Forfeits and byes would need separate match status checks
					}
				}
			}
		}
	}

	// Convert to sorted slice and assign ranks
	rows := make([]*standingsRow, 0, len(rowMap))
	for _, row := range rowMap {
		// Apply override if present
		if row.OverridePoints != nil {
			row.Points = *row.OverridePoints
		}
		rows = append(rows, row)
	}

	// Sort by points descending, then by tiebreakers
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Points != rows[j].Points {
			return rows[i].Points > rows[j].Points
		}
		// Default tiebreaker: point differential
		if rows[i].PointDiff != rows[j].PointDiff {
			return rows[i].PointDiff > rows[j].PointDiff
		}
		// Then games won
		return rows[i].GamesWon > rows[j].GamesWon
	})

	// Assign ranks
	for i, row := range rows {
		row.Points = row.Points // Already set
		_ = i                  // rank assigned below
	}

	// Delete existing entries and upsert new ones
	if err := s.queries.DeleteStandingsBySeasonAndDivision(ctx, generated.DeleteStandingsBySeasonAndDivisionParams{
		SeasonID:   seasonID,
		DivisionID: divisionID,
	}); err != nil {
		return nil, fmt.Errorf("clear standings: %w", err)
	}

	results := make([]generated.StandingsEntry, 0, len(rows))
	for i, row := range rows {
		entry, err := s.queries.UpsertStandingsEntry(ctx, generated.UpsertStandingsEntryParams{
			SeasonID:         seasonID,
			DivisionID:       divisionID,
			RegistrationID:   pgtype.Int8{Int64: row.RegistrationID, Valid: row.RegistrationID > 0},
			TeamID:           pgtype.Int8{Int64: row.TeamID, Valid: row.TeamID > 0},
			PlayerID:         pgtype.Int8{Int64: row.PlayerID, Valid: row.PlayerID > 0},
			Points:           int32(row.Points),
			MatchesPlayed:    int32(row.MatchesPlayed),
			MatchesWon:       int32(row.MatchesWon),
			MatchesLost:      int32(row.MatchesLost),
			GamesWon:         int32(row.GamesWon),
			GamesLost:        int32(row.GamesLost),
			PointDifferential: int32(row.PointDiff),
			TournamentsPlayed: int32(row.TournamentsPlayed),
			Rank:             int32(i + 1),
		})
		if err != nil {
			return nil, fmt.Errorf("upsert entry: %w", err)
		}
		results = append(results, entry)
	}

	return results, nil
}

// GetStandings returns current standings for a season and division.
func (s *StandingsService) GetStandings(ctx context.Context, seasonID int64, divisionID int64) ([]generated.StandingsEntry, error) {
	return s.queries.GetStandingsBySeasonAndDivision(ctx, generated.GetStandingsBySeasonAndDivisionParams{
		SeasonID:   seasonID,
		DivisionID: divisionID,
	})
}

// GetSeasonStandings returns all standings for a season across all divisions.
func (s *StandingsService) GetSeasonStandings(ctx context.Context, seasonID int64) ([]generated.StandingsEntry, error) {
	return s.queries.GetStandingsBySeason(ctx, seasonID)
}

// OverrideEntry manually overrides a standings entry's points.
func (s *StandingsService) OverrideEntry(ctx context.Context, entryID int64, points int, reason string) (generated.StandingsEntry, error) {
	return s.queries.UpdateStandingsOverride(ctx, generated.UpdateStandingsOverrideParams{
		ID:             entryID,
		OverridePoints: pgtype.Int4{Int32: int32(points), Valid: true},
		OverrideReason: pgtype.Text{String: reason, Valid: true},
	})
}

// ClearOverride removes a manual override from a standings entry.
func (s *StandingsService) ClearOverride(ctx context.Context, entryID int64) (generated.StandingsEntry, error) {
	return s.queries.ClearStandingsOverride(ctx, entryID)
}

// MarkWithdrawn marks a standings entry as withdrawn.
func (s *StandingsService) MarkWithdrawn(ctx context.Context, entryID int64) (generated.StandingsEntry, error) {
	return s.queries.MarkStandingsWithdrawn(ctx, entryID)
}

func (s *StandingsService) registrationKey(reg generated.Registration) string {
	if reg.TeamID.Valid {
		return fmt.Sprintf("team:%d", reg.TeamID.Int64)
	}
	return fmt.Sprintf("player:%d", reg.PlayerID.Int64)
}
```

**Note for executing agent:** The `ListMatchesByTeamInDivision` query may not exist in Phase 4A's queries. The executing agent should add it to `backend/db/queries/matches.sql`:
```sql
-- name: ListMatchesByTeamInDivision :many
SELECT * FROM matches
WHERE division_id = $1 AND (team_1_id = $2 OR team_2_id = $2)
ORDER BY created_at;
```
The `ListTournamentsBySeason` query needs to exist in Phase 3's queries — it may be named differently. Check and adjust.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/standings.go
git commit -m "feat: add standings computation service with configurable methods"
```

---

## Task 4: Standings Handler

**Files:**
- Create: `backend/handler/standings.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/standings.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
)

// StandingsHandler handles standings HTTP requests.
type StandingsHandler struct {
	standingsService *service.StandingsService
}

// NewStandingsHandler creates a new StandingsHandler.
func NewStandingsHandler(standingsService *service.StandingsService) *StandingsHandler {
	return &StandingsHandler{standingsService: standingsService}
}

// Routes returns the Chi routes for standings.
func (h *StandingsHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/season/{seasonID}", h.GetSeasonStandings)
	r.Get("/season/{seasonID}/division/{divisionID}", h.GetDivisionStandings)
	r.Post("/season/{seasonID}/division/{divisionID}/recompute", h.Recompute)
	r.Put("/entries/{entryID}/override", h.Override)
	r.Delete("/entries/{entryID}/override", h.ClearOverride)
	r.Post("/entries/{entryID}/withdraw", h.MarkWithdrawn)

	return r
}

// GetSeasonStandings handles GET /api/v1/standings/season/{seasonID}
func (h *StandingsHandler) GetSeasonStandings(w http.ResponseWriter, r *http.Request) {
	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	standings, err := h.standingsService.GetSeasonStandings(r.Context(), seasonID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, standings)
}

// GetDivisionStandings handles GET /api/v1/standings/season/{seasonID}/division/{divisionID}
func (h *StandingsHandler) GetDivisionStandings(w http.ResponseWriter, r *http.Request) {
	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	standings, err := h.standingsService.GetStandings(r.Context(), seasonID, divisionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, standings)
}

// Recompute handles POST /api/v1/standings/season/{seasonID}/division/{divisionID}/recompute
func (h *StandingsHandler) Recompute(w http.ResponseWriter, r *http.Request) {
	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	standings, err := h.standingsService.RecomputeForSeasonDivision(r.Context(), seasonID, divisionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "RECOMPUTE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, standings)
}

// Override handles PUT /api/v1/standings/entries/{entryID}/override
func (h *StandingsHandler) Override(w http.ResponseWriter, r *http.Request) {
	entryID, err := strconv.ParseInt(chi.URLParam(r, "entryID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid entry ID")
		return
	}

	var req struct {
		Points int    `json:"points"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.Reason == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "reason is required")
		return
	}

	entry, err := h.standingsService.OverrideEntry(r.Context(), entryID, req.Points, req.Reason)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "OVERRIDE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, entry)
}

// ClearOverride handles DELETE /api/v1/standings/entries/{entryID}/override
func (h *StandingsHandler) ClearOverride(w http.ResponseWriter, r *http.Request) {
	entryID, err := strconv.ParseInt(chi.URLParam(r, "entryID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid entry ID")
		return
	}

	entry, err := h.standingsService.ClearOverride(r.Context(), entryID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CLEAR_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, entry)
}

// MarkWithdrawn handles POST /api/v1/standings/entries/{entryID}/withdraw
func (h *StandingsHandler) MarkWithdrawn(w http.ResponseWriter, r *http.Request) {
	entryID, err := strconv.ParseInt(chi.URLParam(r, "entryID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid entry ID")
		return
	}

	entry, err := h.standingsService.MarkWithdrawn(r.Context(), entryID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "WITHDRAW_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, entry)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/standings.go
git commit -m "feat: add standings handler with recompute, override, and withdraw"
```

---

## Task 5: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Mount standings routes**

Add to `backend/router/router.go`:

```go
// Standings routes (authenticated)
r.Route("/api/v1/standings", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Mount("/", standingsHandler.Routes())
})
```

Wire `StandingsService` and `StandingsHandler` in `main.go`.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire standings routes"
```

---

## Task 6: Integration Smoke Test

- [ ] **Step 1: Start application**

Run: `docker compose up -d && cd backend && go run .`
Expected: Server starts, 23 migrations applied.

- [ ] **Step 2: Get standings (empty)**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/standings/season/1 | jq .
```

Expected: Empty array (no tournaments completed yet).

- [ ] **Step 3: Trigger recompute**

```bash
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/standings/season/1/division/1/recompute | jq .
```

Expected: Empty standings array (no data to compute from).

- [ ] **Step 4: Clean up**

```bash
docker compose down
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full build**

Run: `cd backend && go build ./...`
Expected: Clean build.

- [ ] **Step 2: sqlc generate**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Migration count**

Run: `ls backend/db/migrations/*.sql | wc -l`
Expected: 23.

- [ ] **Step 4: Final commit**

```bash
git add -A && git status && git commit -m "chore: phase 6 final cleanup"
```

---

## Summary

Phase 6 adds:

### New table:
- `standings_entries` — computed season standings per division (points, W/L, games, tiebreakers, rank, overrides)

### Standings computation:
- 4 configurable methods: `placement_points`, `win_loss`, `match_points`, `custom`
- Aggregates from all completed tournaments in a season
- Tiebreaker chain: points → point differential → games won
- Manual override with required reason field
- Withdrawn flag for mid-season dropouts

### New endpoints (6):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/standings/season/{seasonID}` | All standings for a season |
| `GET` | `/api/v1/standings/season/{seasonID}/division/{divisionID}` | Division standings |
| `POST` | `/api/v1/standings/season/{seasonID}/division/{divisionID}/recompute` | Recompute standings |
| `PUT` | `/api/v1/standings/entries/{entryID}/override` | Manual override |
| `DELETE` | `/api/v1/standings/entries/{entryID}/override` | Clear override |
| `POST` | `/api/v1/standings/entries/{entryID}/withdraw` | Mark withdrawn |
