# Phase 4E: MatchSeries & Quick Match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the MatchSeries entity for MLP-style team-format events (where a single "series" contains multiple individual matches — men's doubles, women's doubles, mixed doubles, singles, dreambreaker), and implement Quick Match (ephemeral standalone scoring with 24-hour auto-delete). Also add the background cleanup job for expired quick matches.

**Architecture:** One new migration creates the `match_series` table and adds the FK constraint from `matches.match_series_id`. MatchSeries mirrors the bracket wiring pattern of Match (next_series_id, loser_next_series_id) but at the series level. Quick Match creation is a thin wrapper around the existing Match service — sets `is_quick_match: true`, creates inline team names if needed, and a background goroutine periodically deletes expired quick matches.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17, Redis 7

**Depends on:** Phase 4A (matches table, match service), Phase 4B (scoring engine), Phase 4C (WebSocket pub/sub), Phase 4D (bracket generation — MatchSeries uses same bracket patterns)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   └── 00020_create_match_series.sql
│   └── queries/
│       ├── match_series.sql
│       └── matches.sql                 # Modified: add quick match queries
├── handler/
│   ├── match_series.go
│   └── match.go                        # Modified: add quick match endpoints
├── service/
│   ├── match_series.go
│   └── match.go                        # Modified: add quick match methods
├── jobs/
│   └── cleanup.go                      # Background cleanup goroutine
└── router/
    └── router.go                       # Modified: mount new route groups
```

---

## Task 1: MatchSeries Migration

**Files:**
- Create: `backend/db/migrations/00020_create_match_series.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00020_create_match_series.sql

-- +goose Up
CREATE TABLE match_series (
    id                          BIGSERIAL PRIMARY KEY,
    public_id                   UUID NOT NULL DEFAULT gen_random_uuid(),
    division_id                 BIGINT NOT NULL REFERENCES divisions(id),
    pod_id                      BIGINT REFERENCES pods(id),
    court_id                    BIGINT REFERENCES courts(id),
    round                       INT NOT NULL DEFAULT 1,
    match_number                INT NOT NULL DEFAULT 1,
    bracket_side                TEXT CHECK (bracket_side IN ('winners', 'losers', 'grand_finals')),
    scheduled_at                TIMESTAMPTZ,
    started_at                  TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,
    status                      TEXT NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'in_progress', 'completed', 'bye', 'forfeit', 'cancelled')),
    team_1_id                   BIGINT REFERENCES teams(id),
    team_2_id                   BIGINT REFERENCES teams(id),
    team_1_registration_id      BIGINT REFERENCES registrations(id),
    team_2_registration_id      BIGINT REFERENCES registrations(id),
    winner_id                   BIGINT REFERENCES teams(id),
    loser_id                    BIGINT REFERENCES teams(id),
    series_config               JSONB NOT NULL DEFAULT '{"best_of": 3, "match_types": ["mens_doubles", "womens_doubles", "mixed_doubles"]}',
    series_score_team_1         INT NOT NULL DEFAULT 0,
    series_score_team_2         INT NOT NULL DEFAULT 0,
    next_series_id              BIGINT REFERENCES match_series(id),
    loser_next_series_id        BIGINT REFERENCES match_series(id),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_match_series_public_id ON match_series (public_id);
CREATE INDEX idx_match_series_division ON match_series (division_id);
CREATE INDEX idx_match_series_court ON match_series (court_id) WHERE court_id IS NOT NULL;
CREATE INDEX idx_match_series_status ON match_series (status);
CREATE INDEX idx_match_series_team1 ON match_series (team_1_id) WHERE team_1_id IS NOT NULL;
CREATE INDEX idx_match_series_team2 ON match_series (team_2_id) WHERE team_2_id IS NOT NULL;

-- Add FK constraint from matches.match_series_id to match_series.id
ALTER TABLE matches ADD CONSTRAINT fk_matches_match_series
    FOREIGN KEY (match_series_id) REFERENCES match_series(id);

-- +goose Down
ALTER TABLE matches DROP CONSTRAINT IF EXISTS fk_matches_match_series;
DROP TABLE IF EXISTS match_series;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, `match_series` table created, FK constraint added to `matches`.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00020_create_match_series.sql
git commit -m "feat: add match_series table and FK from matches"
```

---

## Task 2: MatchSeries Queries

**Files:**
- Create: `backend/db/queries/match_series.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/match_series.sql

-- name: CreateMatchSeries :one
INSERT INTO match_series (
    division_id, pod_id, court_id, round, match_number, bracket_side,
    scheduled_at, status, team_1_id, team_2_id,
    team_1_registration_id, team_2_registration_id,
    series_config, next_series_id, loser_next_series_id, notes
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10,
    $11, $12,
    $13, $14, $15, $16
)
RETURNING *;

-- name: GetMatchSeriesByID :one
SELECT * FROM match_series WHERE id = $1;

-- name: GetMatchSeriesByPublicID :one
SELECT * FROM match_series WHERE public_id = $1;

-- name: ListMatchSeriesByDivision :many
SELECT * FROM match_series
WHERE division_id = $1
ORDER BY round, match_number;

-- name: ListMatchSeriesByPod :many
SELECT * FROM match_series
WHERE pod_id = $1
ORDER BY round, match_number;

-- name: ListMatchSeriesByCourt :many
SELECT * FROM match_series
WHERE court_id = $1 AND status IN ('scheduled', 'in_progress')
ORDER BY scheduled_at NULLS LAST;

-- name: UpdateMatchSeriesStatus :one
UPDATE match_series
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesStarted :one
UPDATE match_series
SET status = 'in_progress', started_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesCompleted :one
UPDATE match_series
SET status = 'completed',
    completed_at = now(),
    winner_id = $2,
    loser_id = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesScore :one
UPDATE match_series
SET series_score_team_1 = $2,
    series_score_team_2 = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesTeams :one
UPDATE match_series
SET team_1_id = $2,
    team_2_id = $3,
    team_1_registration_id = $4,
    team_2_registration_id = $5,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesCourt :one
UPDATE match_series
SET court_id = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchSeriesNextWiring :exec
UPDATE match_series
SET next_series_id = $2,
    loser_next_series_id = $3,
    updated_at = now()
WHERE id = $1;

-- name: GetMatchesBySeriesID :many
SELECT * FROM matches
WHERE match_series_id = $1
ORDER BY match_number;

-- name: DeleteMatchSeries :exec
DELETE FROM match_series WHERE id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors, `db/generated/` updated with match_series types and queries.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/match_series.sql backend/db/generated/
git commit -m "feat: add match_series sqlc queries"
```

---

## Task 3: Quick Match Queries

**Files:**
- Modify: `backend/db/queries/matches.sql`

- [ ] **Step 1: Add quick match queries to the existing matches.sql file**

Append the following to the end of `backend/db/queries/matches.sql`:

```sql
-- name: CreateQuickMatch :one
INSERT INTO matches (
    status, team_1_id, team_2_id, court_id,
    scoring_config, is_quick_match, referee_user_id
) VALUES (
    'scheduled', $1, $2, $3,
    $4, true, $5
)
RETURNING *;

-- name: ListExpiredQuickMatches :many
SELECT id FROM matches
WHERE is_quick_match = true
  AND created_at < now() - interval '24 hours';

-- name: DeleteQuickMatchByID :exec
DELETE FROM matches WHERE id = $1 AND is_quick_match = true;

-- name: ListActiveQuickMatches :many
SELECT * FROM matches
WHERE is_quick_match = true
  AND status IN ('scheduled', 'in_progress')
ORDER BY created_at DESC;

-- name: ListQuickMatchesByUser :many
SELECT * FROM matches
WHERE is_quick_match = true
  AND referee_user_id = $1
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors, new quick match query functions generated.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/matches.sql backend/db/generated/
git commit -m "feat: add quick match sqlc queries"
```

---

## Task 4: MatchSeries Service

**Files:**
- Create: `backend/service/match_series.go`

- [ ] **Step 1: Create the MatchSeries service**

```go
// backend/service/match_series.go
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SeriesConfig defines the structure of match_series.series_config JSON.
type SeriesConfig struct {
	BestOf     int      `json:"best_of"`
	MatchTypes []string `json:"match_types"` // e.g. ["mens_doubles", "womens_doubles", "mixed_doubles", "singles", "dreambreaker"]
}

// MatchSeriesService handles MatchSeries lifecycle.
type MatchSeriesService struct {
	pool    *pgxpool.Pool
	queries *generated.Queries
}

// NewMatchSeriesService creates a new MatchSeriesService.
func NewMatchSeriesService(pool *pgxpool.Pool, queries *generated.Queries) *MatchSeriesService {
	return &MatchSeriesService{pool: pool, queries: queries}
}

// Create creates a new MatchSeries.
func (s *MatchSeriesService) Create(ctx context.Context, params generated.CreateMatchSeriesParams) (generated.MatchSery, error) {
	return s.queries.CreateMatchSeries(ctx, params)
}

// GetByID returns a MatchSeries by internal ID.
func (s *MatchSeriesService) GetByID(ctx context.Context, id int64) (generated.MatchSery, error) {
	return s.queries.GetMatchSeriesByID(ctx, id)
}

// GetByPublicID returns a MatchSeries by public UUID.
func (s *MatchSeriesService) GetByPublicID(ctx context.Context, publicID pgtype.UUID) (generated.MatchSery, error) {
	return s.queries.GetMatchSeriesByPublicID(ctx, publicID)
}

// ListByDivision returns all series in a division.
func (s *MatchSeriesService) ListByDivision(ctx context.Context, divisionID int64) ([]generated.MatchSery, error) {
	return s.queries.ListMatchSeriesByDivision(ctx, divisionID)
}

// ListByPod returns all series in a pod.
func (s *MatchSeriesService) ListByPod(ctx context.Context, podID pgtype.Int8) ([]generated.MatchSery, error) {
	return s.queries.ListMatchSeriesByPod(ctx, podID)
}

// GetMatches returns all individual matches within a series.
func (s *MatchSeriesService) GetMatches(ctx context.Context, seriesID int64) ([]generated.Match, error) {
	return s.queries.GetMatchesBySeriesID(ctx, pgtype.Int8{Int64: seriesID, Valid: true})
}

// StartSeries transitions a series to in_progress, creates child matches, and starts the first one.
func (s *MatchSeriesService) StartSeries(ctx context.Context, seriesID int64, matchService *MatchService) (generated.MatchSery, error) {
	series, err := s.queries.GetMatchSeriesByID(ctx, seriesID)
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("get series: %w", err)
	}

	if series.Status != "scheduled" {
		return generated.MatchSery{}, errors.New("series must be in 'scheduled' status to start")
	}

	if !series.Team1ID.Valid || !series.Team2ID.Valid {
		return generated.MatchSery{}, errors.New("both teams must be assigned before starting a series")
	}

	// Parse series config
	var config SeriesConfig
	if err := json.Unmarshal(series.SeriesConfig, &config); err != nil {
		return generated.MatchSery{}, fmt.Errorf("parse series config: %w", err)
	}

	if len(config.MatchTypes) == 0 {
		return generated.MatchSery{}, errors.New("series config must define at least one match type")
	}

	// Use a transaction to create all child matches
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// Mark series as in_progress
	updatedSeries, err := qtx.UpdateMatchSeriesStarted(ctx, seriesID)
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("start series: %w", err)
	}

	// Create child matches — one per match type in the config
	for i, matchType := range config.MatchTypes {
		createParams := generated.CreateMatchParams{
			DivisionID:            pgtype.Int8{Int64: series.DivisionID, Valid: true},
			PodID:                 series.PodID,
			CourtID:               series.CourtID,
			MatchSeriesID:         pgtype.Int8{Int64: seriesID, Valid: true},
			Round:                 int32(series.Round),
			MatchNumber:           int32(i + 1),
			Status:                "scheduled",
			Team1ID:               series.Team1ID,
			Team2ID:               series.Team2ID,
			Team1RegistrationID:   series.Team1RegistrationID,
			Team2RegistrationID:   series.Team2RegistrationID,
			ScoringConfig:         []byte("{}"), // TD configures each match's scoring separately or inherits division default
			SeriesMatchType:       pgtype.Text{String: matchType, Valid: true},
			IsQuickMatch:          false,
		}
		_, err := qtx.CreateMatch(ctx, createParams)
		if err != nil {
			return generated.MatchSery{}, fmt.Errorf("create child match %d (%s): %w", i+1, matchType, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return generated.MatchSery{}, fmt.Errorf("commit tx: %w", err)
	}

	return updatedSeries, nil
}

// RecordMatchResult updates the series score after a child match completes.
// Returns the updated series. If the series is now complete (one team reaches best_of threshold),
// marks the series as completed with winner/loser.
func (s *MatchSeriesService) RecordMatchResult(ctx context.Context, seriesID int64, winningTeamID int64) (generated.MatchSery, error) {
	series, err := s.queries.GetMatchSeriesByID(ctx, seriesID)
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("get series: %w", err)
	}

	if series.Status != "in_progress" {
		return generated.MatchSery{}, errors.New("series must be in 'in_progress' status")
	}

	// Parse config for best_of
	var config SeriesConfig
	if err := json.Unmarshal(series.SeriesConfig, &config); err != nil {
		return generated.MatchSery{}, fmt.Errorf("parse series config: %w", err)
	}

	// Update scores
	newTeam1Score := series.SeriesScoreTeam1
	newTeam2Score := series.SeriesScoreTeam2
	if winningTeamID == series.Team1ID.Int64 {
		newTeam1Score++
	} else if winningTeamID == series.Team2ID.Int64 {
		newTeam2Score++
	} else {
		return generated.MatchSery{}, errors.New("winning team ID must match team_1 or team_2 of the series")
	}

	// Update score
	updatedSeries, err := s.queries.UpdateMatchSeriesScore(ctx, generated.UpdateMatchSeriesScoreParams{
		ID:               seriesID,
		SeriesScoreTeam1: newTeam1Score,
		SeriesScoreTeam2: newTeam2Score,
	})
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("update series score: %w", err)
	}

	// Check if series is complete
	winsNeeded := int32((config.BestOf / 2) + 1) // e.g. best_of 3 → need 2 wins
	if newTeam1Score >= winsNeeded || newTeam2Score >= winsNeeded {
		var winnerID, loserID int64
		if newTeam1Score >= winsNeeded {
			winnerID = series.Team1ID.Int64
			loserID = series.Team2ID.Int64
		} else {
			winnerID = series.Team2ID.Int64
			loserID = series.Team1ID.Int64
		}

		updatedSeries, err = s.queries.UpdateMatchSeriesCompleted(ctx, generated.UpdateMatchSeriesCompletedParams{
			ID:       seriesID,
			WinnerID: pgtype.Int8{Int64: winnerID, Valid: true},
			LoserID:  pgtype.Int8{Int64: loserID, Valid: true},
		})
		if err != nil {
			return generated.MatchSery{}, fmt.Errorf("complete series: %w", err)
		}

		// Cancel remaining scheduled child matches
		matches, err := s.queries.GetMatchesBySeriesID(ctx, pgtype.Int8{Int64: seriesID, Valid: true})
		if err != nil {
			return generated.MatchSery{}, fmt.Errorf("get child matches: %w", err)
		}
		for _, m := range matches {
			if m.Status == "scheduled" {
				_, _ = s.queries.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
					ID:     m.ID,
					Status: "cancelled",
				})
			}
		}
	}

	return updatedSeries, nil
}

// DeclareForfeit forfeits a series for the specified team.
func (s *MatchSeriesService) DeclareForfeit(ctx context.Context, seriesID int64, forfeitingTeamID int64) (generated.MatchSery, error) {
	series, err := s.queries.GetMatchSeriesByID(ctx, seriesID)
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("get series: %w", err)
	}

	var winnerID, loserID int64
	if forfeitingTeamID == series.Team1ID.Int64 {
		winnerID = series.Team2ID.Int64
		loserID = series.Team1ID.Int64
	} else if forfeitingTeamID == series.Team2ID.Int64 {
		winnerID = series.Team1ID.Int64
		loserID = series.Team2ID.Int64
	} else {
		return generated.MatchSery{}, errors.New("forfeiting team must be team_1 or team_2")
	}

	// Mark series as forfeit
	updatedSeries, err := s.queries.UpdateMatchSeriesCompleted(ctx, generated.UpdateMatchSeriesCompletedParams{
		ID:       seriesID,
		WinnerID: pgtype.Int8{Int64: winnerID, Valid: true},
		LoserID:  pgtype.Int8{Int64: loserID, Valid: true},
	})
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("complete series as forfeit: %w", err)
	}

	// Update status to forfeit
	updatedSeries, err = s.queries.UpdateMatchSeriesStatus(ctx, generated.UpdateMatchSeriesStatusParams{
		ID:     seriesID,
		Status: "forfeit",
	})
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("set forfeit status: %w", err)
	}

	// Cancel all scheduled child matches
	matches, err := s.queries.GetMatchesBySeriesID(ctx, pgtype.Int8{Int64: seriesID, Valid: true})
	if err != nil {
		return generated.MatchSery{}, fmt.Errorf("get child matches: %w", err)
	}
	for _, m := range matches {
		if m.Status == "scheduled" {
			_, _ = s.queries.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
				ID:     m.ID,
				Status: "cancelled",
			})
		}
	}

	return updatedSeries, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/match_series.go
git commit -m "feat: add MatchSeriesService with lifecycle management"
```

---

## Task 5: MatchSeries Handler

**Files:**
- Create: `backend/handler/match_series.go`

- [ ] **Step 1: Create the MatchSeries handler**

```go
// backend/handler/match_series.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// MatchSeriesHandler handles HTTP requests for match series.
type MatchSeriesHandler struct {
	seriesService *service.MatchSeriesService
	matchService  *service.MatchService
}

// NewMatchSeriesHandler creates a new MatchSeriesHandler.
func NewMatchSeriesHandler(seriesService *service.MatchSeriesService, matchService *service.MatchService) *MatchSeriesHandler {
	return &MatchSeriesHandler{seriesService: seriesService, matchService: matchService}
}

// Routes returns the Chi routes for match series.
func (h *MatchSeriesHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByDivision)
	r.Post("/", h.Create)
	r.Get("/{seriesID}", h.GetByID)
	r.Post("/{seriesID}/start", h.Start)
	r.Get("/{seriesID}/matches", h.GetMatches)
	r.Post("/{seriesID}/forfeit", h.DeclareForfeit)

	return r
}

func (h *MatchSeriesHandler) parseSeriesID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
}

// ListByDivision handles GET /api/v1/divisions/{divisionID}/series
func (h *MatchSeriesHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionIDStr := chi.URLParam(r, "divisionID")
	divisionID, err := strconv.ParseInt(divisionIDStr, 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	series, err := h.seriesService.ListByDivision(r.Context(), divisionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list series")
		return
	}

	respondJSON(w, http.StatusOK, series)
}

// Create handles POST /api/v1/divisions/{divisionID}/series
func (h *MatchSeriesHandler) Create(w http.ResponseWriter, r *http.Request) {
	divisionIDStr := chi.URLParam(r, "divisionID")
	divisionID, err := strconv.ParseInt(divisionIDStr, 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var req struct {
		PodID                 *int64          `json:"pod_id"`
		CourtID               *int64          `json:"court_id"`
		Round                 int32           `json:"round"`
		MatchNumber           int32           `json:"match_number"`
		BracketSide           *string         `json:"bracket_side"`
		ScheduledAt           *string         `json:"scheduled_at"`
		Team1ID               *int64          `json:"team_1_id"`
		Team2ID               *int64          `json:"team_2_id"`
		Team1RegistrationID   *int64          `json:"team_1_registration_id"`
		Team2RegistrationID   *int64          `json:"team_2_registration_id"`
		SeriesConfig          json.RawMessage `json:"series_config"`
		NextSeriesID          *int64          `json:"next_series_id"`
		LoserNextSeriesID     *int64          `json:"loser_next_series_id"`
		Notes                 *string         `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	params := generated.CreateMatchSeriesParams{
		DivisionID:  divisionID,
		Round:       req.Round,
		MatchNumber: req.MatchNumber,
		Status:      "scheduled",
	}

	if req.PodID != nil {
		params.PodID = pgtype.Int8{Int64: *req.PodID, Valid: true}
	}
	if req.CourtID != nil {
		params.CourtID = pgtype.Int8{Int64: *req.CourtID, Valid: true}
	}
	if req.BracketSide != nil {
		params.BracketSide = pgtype.Text{String: *req.BracketSide, Valid: true}
	}
	if req.ScheduledAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ScheduledAt)
		if err != nil {
			respondError(w, http.StatusBadRequest, "INVALID_DATE", "Invalid scheduled_at format")
			return
		}
		params.ScheduledAt = pgtype.Timestamptz{Time: t, Valid: true}
	}
	if req.Team1ID != nil {
		params.Team1ID = pgtype.Int8{Int64: *req.Team1ID, Valid: true}
	}
	if req.Team2ID != nil {
		params.Team2ID = pgtype.Int8{Int64: *req.Team2ID, Valid: true}
	}
	if req.Team1RegistrationID != nil {
		params.Team1RegistrationID = pgtype.Int8{Int64: *req.Team1RegistrationID, Valid: true}
	}
	if req.Team2RegistrationID != nil {
		params.Team2RegistrationID = pgtype.Int8{Int64: *req.Team2RegistrationID, Valid: true}
	}
	if req.SeriesConfig != nil {
		params.SeriesConfig = req.SeriesConfig
	}
	if req.NextSeriesID != nil {
		params.NextSeriesID = pgtype.Int8{Int64: *req.NextSeriesID, Valid: true}
	}
	if req.LoserNextSeriesID != nil {
		params.LoserNextSeriesID = pgtype.Int8{Int64: *req.LoserNextSeriesID, Valid: true}
	}
	if req.Notes != nil {
		params.Notes = pgtype.Text{String: *req.Notes, Valid: true}
	}

	series, err := h.seriesService.Create(r.Context(), params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, series)
}

// GetByID handles GET /api/v1/divisions/{divisionID}/series/{seriesID}
func (h *MatchSeriesHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	seriesID, err := h.parseSeriesID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid series ID")
		return
	}

	series, err := h.seriesService.GetByID(r.Context(), seriesID)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Series not found")
		return
	}

	respondJSON(w, http.StatusOK, series)
}

// Start handles POST /api/v1/divisions/{divisionID}/series/{seriesID}/start
func (h *MatchSeriesHandler) Start(w http.ResponseWriter, r *http.Request) {
	seriesID, err := h.parseSeriesID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid series ID")
		return
	}

	series, err := h.seriesService.StartSeries(r.Context(), seriesID, h.matchService)
	if err != nil {
		respondError(w, http.StatusBadRequest, "START_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, series)
}

// GetMatches handles GET /api/v1/divisions/{divisionID}/series/{seriesID}/matches
func (h *MatchSeriesHandler) GetMatches(w http.ResponseWriter, r *http.Request) {
	seriesID, err := h.parseSeriesID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid series ID")
		return
	}

	matches, err := h.seriesService.GetMatches(r.Context(), seriesID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list matches")
		return
	}

	respondJSON(w, http.StatusOK, matches)
}

// DeclareForfeit handles POST /api/v1/divisions/{divisionID}/series/{seriesID}/forfeit
func (h *MatchSeriesHandler) DeclareForfeit(w http.ResponseWriter, r *http.Request) {
	seriesID, err := h.parseSeriesID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid series ID")
		return
	}

	var req struct {
		ForfeitingTeamID int64  `json:"forfeiting_team_id"`
		Reason           string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.ForfeitingTeamID == 0 {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "forfeiting_team_id is required")
		return
	}

	series, err := h.seriesService.DeclareForfeit(r.Context(), seriesID, req.ForfeitingTeamID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "FORFEIT_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, series)
}
```

Note: This handler uses `respondJSON` and `respondError` from the existing handler helpers created in Phase 1. It also references `generated.CreateMatchSeriesParams` — the executing agent should add the proper import for `github.com/court-command/court-command/backend/db/generated` and `time`.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/match_series.go
git commit -m "feat: add MatchSeriesHandler with CRUD and lifecycle endpoints"
```

---

## Task 6: Quick Match Service

**Files:**
- Modify: `backend/service/match.go`

- [ ] **Step 1: Add Quick Match methods to MatchService**

Add the following methods to the existing `MatchService` in `backend/service/match.go`:

```go
// CreateQuickMatch creates an ephemeral quick match (auto-deletes after 24 hours).
func (s *MatchService) CreateQuickMatch(ctx context.Context, params CreateQuickMatchParams) (generated.Match, error) {
	// Quick matches can optionally link to existing teams or use inline names
	// For existing teams, team_1_id and team_2_id are set
	// For inline, teams are created ad-hoc (or just names stored — handled by caller)

	if params.ScoringConfig == nil {
		// Default to Quick Play preset
		params.ScoringConfig = json.RawMessage(`{"scoring_type": "side_out", "points_to": 11, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 6}`)
	}

	match, err := s.queries.CreateQuickMatch(ctx, generated.CreateQuickMatchParams{
		Team1ID:       params.Team1ID,
		Team2ID:       params.Team2ID,
		CourtID:       params.CourtID,
		ScoringConfig: params.ScoringConfig,
		RefereeUserID: params.RefereeUserID,
	})
	if err != nil {
		return generated.Match{}, fmt.Errorf("create quick match: %w", err)
	}

	return match, nil
}

// ListQuickMatchesByUser returns active quick matches created by a specific user.
func (s *MatchService) ListQuickMatchesByUser(ctx context.Context, userID int64) ([]generated.Match, error) {
	return s.queries.ListQuickMatchesByUser(ctx, pgtype.Int8{Int64: userID, Valid: true})
}

// CleanupExpiredQuickMatches deletes quick matches older than 24 hours.
// Returns the number of matches deleted.
func (s *MatchService) CleanupExpiredQuickMatches(ctx context.Context) (int, error) {
	expired, err := s.queries.ListExpiredQuickMatches(ctx)
	if err != nil {
		return 0, fmt.Errorf("list expired: %w", err)
	}

	deleted := 0
	for _, id := range expired {
		if err := s.queries.DeleteQuickMatchByID(ctx, id); err != nil {
			// Log and continue — don't fail the whole batch
			continue
		}
		deleted++
	}

	return deleted, nil
}

// CreateQuickMatchParams holds parameters for creating a quick match.
type CreateQuickMatchParams struct {
	Team1ID       pgtype.Int8         `json:"team_1_id"`
	Team2ID       pgtype.Int8         `json:"team_2_id"`
	CourtID       pgtype.Int8         `json:"court_id"`
	ScoringConfig json.RawMessage     `json:"scoring_config"`
	RefereeUserID pgtype.Int8         `json:"referee_user_id"`
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/match.go
git commit -m "feat: add quick match methods to MatchService"
```

---

## Task 7: Quick Match Handler

**Files:**
- Modify: `backend/handler/match.go`

- [ ] **Step 1: Add Quick Match endpoints to MatchHandler**

Add the following methods to the existing `MatchHandler` in `backend/handler/match.go`. Also add routes to the existing `Routes()` method.

Add to `Routes()`:

```go
// Quick Match sub-routes
r.Route("/quick", func(r chi.Router) {
    r.Post("/", h.CreateQuickMatch)
    r.Get("/mine", h.ListMyQuickMatches)
})
```

Handler methods:

```go
// CreateQuickMatch handles POST /api/v1/matches/quick
func (h *MatchHandler) CreateQuickMatch(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var req struct {
		Team1ID       *int64          `json:"team_1_id"`
		Team2ID       *int64          `json:"team_2_id"`
		CourtID       *int64          `json:"court_id"`
		ScoringConfig json.RawMessage `json:"scoring_config"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	params := service.CreateQuickMatchParams{
		RefereeUserID: pgtype.Int8{Int64: user.ID, Valid: true},
	}

	if req.Team1ID != nil {
		params.Team1ID = pgtype.Int8{Int64: *req.Team1ID, Valid: true}
	}
	if req.Team2ID != nil {
		params.Team2ID = pgtype.Int8{Int64: *req.Team2ID, Valid: true}
	}
	if req.CourtID != nil {
		params.CourtID = pgtype.Int8{Int64: *req.CourtID, Valid: true}
	}
	if req.ScoringConfig != nil {
		params.ScoringConfig = req.ScoringConfig
	}

	match, err := h.matchService.CreateQuickMatch(r.Context(), params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, match)
}

// ListMyQuickMatches handles GET /api/v1/matches/quick/mine
func (h *MatchHandler) ListMyQuickMatches(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	matches, err := h.matchService.ListQuickMatchesByUser(r.Context(), user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list quick matches")
		return
	}

	respondJSON(w, http.StatusOK, matches)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/match.go
git commit -m "feat: add quick match endpoints to MatchHandler"
```

---

## Task 8: Cleanup Job

**Files:**
- Create: `backend/jobs/cleanup.go`

- [ ] **Step 1: Create the cleanup job**

```go
// backend/jobs/cleanup.go
package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/court-command/court-command/backend/service"
)

// StartCleanupJob starts a background goroutine that periodically cleans up
// expired quick matches. It runs every hour and deletes quick matches older
// than 24 hours.
func StartCleanupJob(ctx context.Context, matchService *service.MatchService, logger *slog.Logger) {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		logger.Info("cleanup job started", "interval", "1h")

		// Run once immediately on startup
		runCleanup(ctx, matchService, logger)

		for {
			select {
			case <-ctx.Done():
				logger.Info("cleanup job stopped")
				return
			case <-ticker.C:
				runCleanup(ctx, matchService, logger)
			}
		}
	}()
}

func runCleanup(ctx context.Context, matchService *service.MatchService, logger *slog.Logger) {
	deleted, err := matchService.CleanupExpiredQuickMatches(ctx)
	if err != nil {
		logger.Error("quick match cleanup failed", "error", err)
		return
	}
	if deleted > 0 {
		logger.Info("cleaned up expired quick matches", "count", deleted)
	}
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/jobs/cleanup.go
git commit -m "feat: add background cleanup job for expired quick matches"
```

---

## Task 9: Router Wiring

**Files:**
- Modify: `backend/router/router.go`
- Modify: `backend/main.go`

- [ ] **Step 1: Mount MatchSeries routes**

In `backend/router/router.go`, add the match series route group inside the authenticated section:

```go
// Inside the authenticated group, nested under divisions:
// /api/v1/divisions/{divisionID}/series
r.Route("/divisions/{divisionID}/series", func(r chi.Router) {
    r.Mount("/", matchSeriesHandler.Routes())
})
```

Note: The executing agent should wire this alongside the existing division routes. The `matchSeriesHandler` needs to be passed to the router setup function.

- [ ] **Step 2: Wire cleanup job in main.go**

In `backend/main.go`, after the server starts, add:

```go
// Start background jobs
jobs.StartCleanupJob(ctx, matchService, logger)
```

The `ctx` here should be the same context used for graceful shutdown (derived from signal handling). Import `github.com/court-command/court-command/backend/jobs`.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire match series routes and cleanup job"
```

---

## Task 10: Integration Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start the application**

Run: `docker compose up -d && cd backend && go run .`
Expected: Server starts, cleanup job log message appears, migrations applied.

- [ ] **Step 2: Create a user and get auth**

```bash
# Register
curl -s http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"td@test.com","password":"test1234","first_name":"Test","last_name":"TD","date_of_birth":"1990-01-01"}' | jq .

# Login (save cookie)
curl -s -c cookies.txt http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"td@test.com","password":"test1234"}' | jq .
```

Expected: User created and logged in.

- [ ] **Step 3: Create a quick match**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/matches/quick \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Expected: Quick match created with `is_quick_match: true`, default scoring config.

- [ ] **Step 4: List my quick matches**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/matches/quick/mine | jq .
```

Expected: Array with the quick match just created.

- [ ] **Step 5: Create prerequisite entities for series test**

```bash
# Create a tournament, division (format: team_match)
# This requires league, season, venue setup — use existing endpoints from Phase 3
# Simplified: just create a tournament with a team_match division

# Create tournament
curl -s -b cookies.txt http://localhost:8080/api/v1/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name":"MLP Test","start_date":"2026-05-01","end_date":"2026-05-02"}' | jq .

# Note the tournament ID, then create a division
curl -s -b cookies.txt http://localhost:8080/api/v1/tournaments/1/divisions \
  -H "Content-Type: application/json" \
  -d '{"name":"Premier","format":"team_match","bracket_format":"single_elimination"}' | jq .
```

Expected: Tournament and division created.

- [ ] **Step 6: Create a match series**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/divisions/1/series \
  -H "Content-Type: application/json" \
  -d '{"round":1,"match_number":1,"series_config":{"best_of":3,"match_types":["mens_doubles","womens_doubles","mixed_doubles"]}}' | jq .
```

Expected: Series created with status "scheduled".

- [ ] **Step 7: Verify series get**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/divisions/1/series/1 | jq .
```

Expected: Series returned with all fields.

- [ ] **Step 8: Clean up**

```bash
rm cookies.txt
# Stop server with Ctrl+C
docker compose down
```

- [ ] **Step 9: Commit**

No new files — this was manual verification only.

---

## Task 11: Final Verification

**Files:** None

- [ ] **Step 1: Run full build**

Run: `cd backend && go build ./...`
Expected: Clean build, no errors.

- [ ] **Step 2: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: No errors, all queries valid.

- [ ] **Step 3: Check migration count**

Run: `ls backend/db/migrations/*.sql | wc -l`
Expected: 20 (00001 through 00020).

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git add -A
git status
# If clean: done. If changes: commit with appropriate message
git commit -m "chore: phase 4E final cleanup"
```

---

## Summary

Phase 4E adds:
- **MatchSeries** table with full bracket wiring (next_series_id, loser_next_series_id)
- FK constraint from matches.match_series_id → match_series.id
- Series lifecycle: scheduled → start (creates child matches) → in_progress → complete (when team reaches win threshold)
- Series forfeit with automatic cancellation of remaining matches
- **Quick Match**: ephemeral matches with `is_quick_match: true`, auto-delete after 24 hours
- **Background cleanup job**: hourly goroutine deleting expired quick matches
- 8 new endpoints (6 series + 2 quick match)

### New endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/divisions/{divisionID}/series` | List series in division |
| `POST` | `/api/v1/divisions/{divisionID}/series` | Create series |
| `GET` | `/api/v1/divisions/{divisionID}/series/{seriesID}` | Get series |
| `POST` | `/api/v1/divisions/{divisionID}/series/{seriesID}/start` | Start series (creates child matches) |
| `GET` | `/api/v1/divisions/{divisionID}/series/{seriesID}/matches` | List child matches |
| `POST` | `/api/v1/divisions/{divisionID}/series/{seriesID}/forfeit` | Forfeit series |
| `POST` | `/api/v1/matches/quick` | Create quick match |
| `GET` | `/api/v1/matches/quick/mine` | List my quick matches |
