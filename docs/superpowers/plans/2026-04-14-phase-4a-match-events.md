# Phase 4A: Match & Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Match, MatchEvent, and ScoringPreset database tables with migrations, sqlc queries, services, and HTTP handlers — establishing the core data layer that the scoring engine (Phase 4B), WebSocket system (Phase 4C), bracket generator (Phase 4D), and match series (Phase 4E) all build on.

**Architecture:** Three new migrations add `scoring_presets`, `matches`, and `match_events` tables. ScoringPreset stores reusable scoring configurations (10 system presets seeded). Match holds all live scoring state plus bracket wiring. MatchEvent is an append-only event log with full match state snapshots for undo. Services handle CRUD, status transitions, and event recording. Handlers expose REST endpoints under `/api/v1/`.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17

**Depends on:** Phase 1 (auth, middleware, response helpers), Phase 2 (teams, courts), Phase 3 (divisions, pods, tournaments)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 00017_create_scoring_presets.sql
│   │   ├── 00018_create_matches.sql
│   │   └── 00019_create_match_events.sql
│   ├── queries/
│   │   ├── scoring_presets.sql
│   │   ├── matches.sql
│   │   └── match_events.sql
│   └── generated/                    # sqlc output (regenerated)
├── handler/
│   ├── scoring_preset.go
│   └── match.go
├── service/
│   ├── scoring_preset.go
│   └── match.go
└── router/
    └── router.go                     # Modified: mount new route groups
```

---

## Task 1: ScoringPreset Migration

**Files:**
- Create: `backend/db/migrations/00017_create_scoring_presets.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00017_create_scoring_presets.sql

-- +goose Up
CREATE TABLE scoring_presets (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    scoring_config  JSONB NOT NULL DEFAULT '{}',
    is_system       BOOLEAN NOT NULL DEFAULT false,
    created_by_user_id BIGINT REFERENCES users(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scoring_presets_active ON scoring_presets (is_active) WHERE is_active = true;
CREATE INDEX idx_scoring_presets_system ON scoring_presets (is_system) WHERE is_system = true;

-- Seed 10 system presets
INSERT INTO scoring_presets (name, description, scoring_config, is_system, is_active) VALUES
(
    'Standard Side-Out (11)',
    'Traditional pickleball scoring to 11, win by 2, best of 3',
    '{"scoring_type": "side_out", "points_to": 11, "win_by": 2, "best_of": 3, "timeouts_per_game": 2, "end_change_points": 6}',
    true, true
),
(
    'Standard Side-Out (15)',
    'Side-out scoring to 15, win by 2, best of 3',
    '{"scoring_type": "side_out", "points_to": 15, "win_by": 2, "best_of": 3, "timeouts_per_game": 2, "end_change_points": 8}',
    true, true
),
(
    'Standard Side-Out (21)',
    'Side-out scoring to 21, win by 2, single game',
    '{"scoring_type": "side_out", "points_to": 21, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 11}',
    true, true
),
(
    'Rally Scoring (11)',
    'Rally scoring to 11, win by 2, best of 3',
    '{"scoring_type": "rally", "points_to": 11, "win_by": 2, "best_of": 3, "timeouts_per_game": 2, "end_change_points": 6}',
    true, true
),
(
    'Rally Scoring (15)',
    'Rally scoring to 15, win by 2, best of 3',
    '{"scoring_type": "rally", "points_to": 15, "win_by": 2, "best_of": 3, "timeouts_per_game": 2, "end_change_points": 8}',
    true, true
),
(
    'Rally Scoring (21)',
    'Rally scoring to 21, win by 2, single game',
    '{"scoring_type": "rally", "points_to": 21, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 11}',
    true, true
),
(
    'MLP Singles',
    'MLP singles format: rally scoring to 21, win by 2, single game',
    '{"scoring_type": "rally", "points_to": 21, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 11}',
    true, true
),
(
    'MLP Doubles',
    'MLP doubles format: rally scoring to 21, win by 2, single game',
    '{"scoring_type": "rally", "points_to": 21, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 11}',
    true, true
),
(
    'MLP Dreambreaker',
    'MLP Dreambreaker tiebreak: rally scoring to 21, win by 2, single game',
    '{"scoring_type": "rally", "points_to": 21, "win_by": 2, "best_of": 1, "timeouts_per_game": 1, "end_change_points": 11}',
    true, true
),
(
    'Quick Play (Single Game)',
    'Quick single game: side-out scoring to 11, win by 2',
    '{"scoring_type": "side_out", "points_to": 11, "win_by": 2, "best_of": 1, "timeouts_per_game": 2, "end_change_points": 6}',
    true, true
);

-- +goose Down
DROP TABLE IF EXISTS scoring_presets;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, 10 preset rows inserted.

- [ ] **Step 3: Verify seed data**

Run: `docker exec -it $(docker ps -q -f name=db) psql -U courtcommand -c "SELECT id, name, is_system FROM scoring_presets;"`
Expected: 10 rows, all `is_system = true`.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/00017_create_scoring_presets.sql
git commit -m "feat: add scoring_presets migration with 10 system presets"
```

---

## Task 2: Match Migration

**Files:**
- Create: `backend/db/migrations/00018_create_matches.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00018_create_matches.sql

-- +goose Up
CREATE TABLE matches (
    id                      BIGSERIAL PRIMARY KEY,
    public_id               UUID NOT NULL DEFAULT gen_random_uuid(),
    division_id             BIGINT REFERENCES divisions(id),
    pod_id                  BIGINT REFERENCES pods(id),
    court_id                BIGINT REFERENCES courts(id),
    match_series_id         BIGINT,  -- FK added in Phase 4E migration
    round                   INT NOT NULL DEFAULT 1,
    match_number            INT NOT NULL DEFAULT 1,
    bracket_side            TEXT CHECK (bracket_side IN ('winners', 'losers', 'grand_finals')),
    scheduled_at            TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'in_progress', 'completed', 'bye', 'forfeit', 'cancelled')),
    team_1_id               BIGINT REFERENCES teams(id),
    team_2_id               BIGINT REFERENCES teams(id),
    team_1_registration_id  BIGINT REFERENCES registrations(id),
    team_2_registration_id  BIGINT REFERENCES registrations(id),
    winner_id               BIGINT REFERENCES teams(id),
    loser_id                BIGINT REFERENCES teams(id),
    team_1_seed             INT,
    team_2_seed             INT,
    scoring_config          JSONB NOT NULL DEFAULT '{}',
    completed_games         JSONB NOT NULL DEFAULT '[]',
    current_game_num        INT NOT NULL DEFAULT 1,
    team_1_score            INT NOT NULL DEFAULT 0,
    team_2_score            INT NOT NULL DEFAULT 0,
    serving_team            INT NOT NULL DEFAULT 1 CHECK (serving_team IN (1, 2)),
    server_number           INT NOT NULL DEFAULT 1 CHECK (server_number IN (1, 2)),
    serving_player_id       BIGINT REFERENCES users(id),
    is_show_court_match     BOOLEAN NOT NULL DEFAULT false,
    is_quick_match          BOOLEAN NOT NULL DEFAULT false,
    is_paused               BOOLEAN NOT NULL DEFAULT false,
    referee_user_id         BIGINT REFERENCES users(id),
    scorekeeper_user_id     BIGINT REFERENCES users(id),
    next_match_id           BIGINT REFERENCES matches(id),
    loser_next_match_id     BIGINT REFERENCES matches(id),
    series_match_type       TEXT CHECK (series_match_type IN ('mens_doubles', 'womens_doubles', 'mixed_doubles', 'singles', 'dreambreaker')),
    court_queue_position    INT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_matches_public_id ON matches (public_id);
CREATE INDEX idx_matches_division ON matches (division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_matches_court ON matches (court_id) WHERE court_id IS NOT NULL;
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_court_queue ON matches (court_id, court_queue_position) WHERE court_id IS NOT NULL AND status IN ('scheduled', 'in_progress');
CREATE INDEX idx_matches_quick ON matches (is_quick_match, created_at) WHERE is_quick_match = true;
CREATE INDEX idx_matches_team1 ON matches (team_1_id) WHERE team_1_id IS NOT NULL;
CREATE INDEX idx_matches_team2 ON matches (team_2_id) WHERE team_2_id IS NOT NULL;
CREATE INDEX idx_matches_series ON matches (match_series_id) WHERE match_series_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS matches;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, `matches` table created with all indexes.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00018_create_matches.sql
git commit -m "feat: add matches table migration with bracket wiring and court queue"
```

---

## Task 3: MatchEvent Migration

**Files:**
- Create: `backend/db/migrations/00019_create_match_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00019_create_match_events.sql

-- +goose Up
CREATE TABLE match_events (
    id                  BIGSERIAL PRIMARY KEY,
    match_id            BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sequence_id         INT NOT NULL,
    event_type          TEXT NOT NULL CHECK (event_type IN (
        'MATCH_STARTED', 'POINT_SCORED', 'POINT_REMOVED', 'SIDE_OUT',
        'GAME_COMPLETE', 'MATCH_COMPLETE', 'TIMEOUT_CALLED', 'TIMEOUT_ENDED',
        'END_CHANGE', 'SUBSTITUTION', 'MATCH_RESET', 'MATCH_CONFIGURED',
        'SCORE_OVERRIDE', 'FORFEIT_DECLARED', 'MATCH_PAUSED', 'MATCH_RESUMED'
    )),
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload             JSONB NOT NULL DEFAULT '{}',
    score_snapshot      JSONB NOT NULL DEFAULT '{}',
    created_by_user_id  BIGINT REFERENCES users(id),
    scored_by_name      TEXT,

    UNIQUE (match_id, sequence_id)
);

CREATE INDEX idx_match_events_match ON match_events (match_id, sequence_id);
CREATE INDEX idx_match_events_type ON match_events (match_id, event_type);

-- +goose Down
DROP TABLE IF EXISTS match_events;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, `match_events` table created.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00019_create_match_events.sql
git commit -m "feat: add match_events table migration with 16 event types"
```

---

## Task 4: ScoringPreset Queries

**Files:**
- Create: `backend/db/queries/scoring_presets.sql`

- [ ] **Step 1: Write sqlc queries**

```sql
-- backend/db/queries/scoring_presets.sql

-- name: GetScoringPreset :one
SELECT * FROM scoring_presets
WHERE id = $1;

-- name: ListScoringPresetsActive :many
SELECT * FROM scoring_presets
WHERE is_active = true
ORDER BY is_system DESC, name ASC;

-- name: ListScoringPresetsAll :many
SELECT * FROM scoring_presets
ORDER BY is_system DESC, name ASC;

-- name: CreateScoringPreset :one
INSERT INTO scoring_presets (
    name, description, scoring_config, is_system, created_by_user_id, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: UpdateScoringPreset :one
UPDATE scoring_presets
SET name = $2,
    description = $3,
    scoring_config = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeactivateScoringPreset :exec
UPDATE scoring_presets
SET is_active = false, updated_at = now()
WHERE id = $1;

-- name: ActivateScoringPreset :exec
UPDATE scoring_presets
SET is_active = true, updated_at = now()
WHERE id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors. New files in `db/generated/` for scoring_presets.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/scoring_presets.sql backend/db/generated/
git commit -m "feat: add sqlc queries for scoring presets"
```

---

## Task 5: Match Queries

**Files:**
- Create: `backend/db/queries/matches.sql`

- [ ] **Step 1: Write sqlc queries**

```sql
-- backend/db/queries/matches.sql

-- name: GetMatch :one
SELECT * FROM matches WHERE id = $1;

-- name: GetMatchByPublicID :one
SELECT * FROM matches WHERE public_id = $1;

-- name: CreateMatch :one
INSERT INTO matches (
    division_id, pod_id, court_id, round, match_number, bracket_side,
    scheduled_at, status, team_1_id, team_2_id,
    team_1_registration_id, team_2_registration_id,
    team_1_seed, team_2_seed, scoring_config,
    is_show_court_match, is_quick_match,
    referee_user_id, scorekeeper_user_id,
    next_match_id, loser_next_match_id, series_match_type,
    court_queue_position, notes
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10,
    $11, $12,
    $13, $14, $15,
    $16, $17,
    $18, $19,
    $20, $21, $22,
    $23, $24
)
RETURNING *;

-- name: UpdateMatchStatus :one
UPDATE matches
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchScoring :one
UPDATE matches
SET team_1_score = $2,
    team_2_score = $3,
    serving_team = $4,
    server_number = $5,
    serving_player_id = $6,
    current_game_num = $7,
    completed_games = $8,
    is_paused = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchResult :one
UPDATE matches
SET status = $2,
    winner_id = $3,
    loser_id = $4,
    completed_at = $5,
    team_1_score = $6,
    team_2_score = $7,
    completed_games = $8,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchTeams :one
UPDATE matches
SET team_1_id = $2,
    team_2_id = $3,
    team_1_registration_id = $4,
    team_2_registration_id = $5,
    team_1_seed = $6,
    team_2_seed = $7,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchCourt :one
UPDATE matches
SET court_id = $2,
    court_queue_position = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchBracketWiring :one
UPDATE matches
SET next_match_id = $2,
    loser_next_match_id = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchNotes :exec
UPDATE matches
SET notes = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateMatchScoringConfig :one
UPDATE matches
SET scoring_config = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchReferee :exec
UPDATE matches
SET referee_user_id = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateMatchStarted :one
UPDATE matches
SET status = 'in_progress',
    started_at = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListMatchesByDivision :many
SELECT * FROM matches
WHERE division_id = $1
ORDER BY round, match_number;

-- name: ListMatchesByPod :many
SELECT * FROM matches
WHERE pod_id = $1
ORDER BY round, match_number;

-- name: ListMatchesByCourt :many
SELECT * FROM matches
WHERE court_id = $1
ORDER BY court_queue_position NULLS LAST, scheduled_at NULLS LAST;

-- name: ListMatchesByCourtActive :many
SELECT * FROM matches
WHERE court_id = $1
  AND status IN ('scheduled', 'in_progress')
ORDER BY court_queue_position NULLS LAST;

-- name: GetActiveMatchOnCourt :one
SELECT * FROM matches
WHERE court_id = $1 AND status = 'in_progress'
LIMIT 1;

-- name: ListMatchesByTeam :many
SELECT * FROM matches
WHERE (team_1_id = $1 OR team_2_id = $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountMatchesByTeam :one
SELECT COUNT(*) FROM matches
WHERE team_1_id = $1 OR team_2_id = $1;

-- name: ListMatchesByTournament :many
SELECT m.* FROM matches m
JOIN divisions d ON m.division_id = d.id
WHERE d.tournament_id = $1
ORDER BY m.round, m.match_number;

-- name: ListQuickMatches :many
SELECT * FROM matches
WHERE is_quick_match = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: DeleteExpiredQuickMatches :exec
DELETE FROM matches
WHERE is_quick_match = true
  AND created_at < now() - INTERVAL '24 hours'
  AND status IN ('completed', 'cancelled');

-- name: GetMatchForUpdate :one
SELECT * FROM matches
WHERE id = $1
FOR UPDATE;

-- name: GetMatchByPublicIDForUpdate :one
SELECT * FROM matches
WHERE public_id = $1
FOR UPDATE;

-- name: CountMatchesByDivision :one
SELECT COUNT(*) FROM matches WHERE division_id = $1;

-- name: CountMatchesByDivisionAndStatus :one
SELECT COUNT(*) FROM matches WHERE division_id = $1 AND status = $2;

-- name: ListMatchesByNextMatch :many
SELECT * FROM matches WHERE next_match_id = $1;

-- name: ListMatchesByLoserNextMatch :many
SELECT * FROM matches WHERE loser_next_match_id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/matches.sql backend/db/generated/
git commit -m "feat: add sqlc queries for matches"
```

---

## Task 6: MatchEvent Queries

**Files:**
- Create: `backend/db/queries/match_events.sql`

- [ ] **Step 1: Write sqlc queries**

```sql
-- backend/db/queries/match_events.sql

-- name: CreateMatchEvent :one
INSERT INTO match_events (
    match_id, sequence_id, event_type, payload, score_snapshot,
    created_by_user_id, scored_by_name
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetLatestMatchEvent :one
SELECT * FROM match_events
WHERE match_id = $1
ORDER BY sequence_id DESC
LIMIT 1;

-- name: GetMatchEventBySequence :one
SELECT * FROM match_events
WHERE match_id = $1 AND sequence_id = $2;

-- name: GetPreviousMatchEvent :one
SELECT * FROM match_events
WHERE match_id = $1 AND sequence_id < $2
ORDER BY sequence_id DESC
LIMIT 1;

-- name: ListMatchEvents :many
SELECT * FROM match_events
WHERE match_id = $1
ORDER BY sequence_id ASC;

-- name: ListMatchEventsByType :many
SELECT * FROM match_events
WHERE match_id = $1 AND event_type = $2
ORDER BY sequence_id ASC;

-- name: CountMatchEvents :one
SELECT COUNT(*) FROM match_events WHERE match_id = $1;

-- name: GetNextSequenceID :one
SELECT COALESCE(MAX(sequence_id), 0) + 1 AS next_seq
FROM match_events
WHERE match_id = $1;

-- name: DeleteMatchEventsAfterSequence :exec
DELETE FROM match_events
WHERE match_id = $1 AND sequence_id > $2;

-- name: DeleteAllMatchEvents :exec
DELETE FROM match_events WHERE match_id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/match_events.sql backend/db/generated/
git commit -m "feat: add sqlc queries for match events"
```

---

## Task 7: ScoringPreset Service

**Files:**
- Create: `backend/service/scoring_preset.go`

- [ ] **Step 1: Write the service**

```go
// backend/service/scoring_preset.go
package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/court-command/court-command/backend/db/generated"
)

type ScoringPresetService struct {
	queries *generated.Queries
}

func NewScoringPresetService(queries *generated.Queries) *ScoringPresetService {
	return &ScoringPresetService{queries: queries}
}

type CreateScoringPresetInput struct {
	Name          string          `json:"name"`
	Description   *string         `json:"description"`
	ScoringConfig json.RawMessage `json:"scoring_config"`
	CreatedByID   int64           `json:"created_by_user_id"`
}

func (s *ScoringPresetService) Create(ctx context.Context, input CreateScoringPresetInput) (generated.ScoringPreset, error) {
	if input.Name == "" {
		return generated.ScoringPreset{}, fmt.Errorf("name is required")
	}
	if len(input.ScoringConfig) == 0 {
		return generated.ScoringPreset{}, fmt.Errorf("scoring_config is required")
	}

	// Validate scoring_config is valid JSON with required fields
	var config map[string]interface{}
	if err := json.Unmarshal(input.ScoringConfig, &config); err != nil {
		return generated.ScoringPreset{}, fmt.Errorf("scoring_config must be valid JSON: %w", err)
	}
	requiredFields := []string{"scoring_type", "points_to", "win_by", "best_of"}
	for _, field := range requiredFields {
		if _, ok := config[field]; !ok {
			return generated.ScoringPreset{}, fmt.Errorf("scoring_config missing required field: %s", field)
		}
	}

	return s.queries.CreateScoringPreset(ctx, generated.CreateScoringPresetParams{
		Name:            input.Name,
		Description:     input.Description,
		ScoringConfig:   input.ScoringConfig,
		IsSystem:        false,
		CreatedByUserID: &input.CreatedByID,
		IsActive:        true,
	})
}

func (s *ScoringPresetService) GetByID(ctx context.Context, id int64) (generated.ScoringPreset, error) {
	return s.queries.GetScoringPreset(ctx, id)
}

func (s *ScoringPresetService) ListActive(ctx context.Context) ([]generated.ScoringPreset, error) {
	return s.queries.ListScoringPresetsActive(ctx)
}

func (s *ScoringPresetService) ListAll(ctx context.Context) ([]generated.ScoringPreset, error) {
	return s.queries.ListScoringPresetsAll(ctx)
}

type UpdateScoringPresetInput struct {
	ID            int64           `json:"id"`
	Name          string          `json:"name"`
	Description   *string         `json:"description"`
	ScoringConfig json.RawMessage `json:"scoring_config"`
}

func (s *ScoringPresetService) Update(ctx context.Context, input UpdateScoringPresetInput) (generated.ScoringPreset, error) {
	preset, err := s.queries.GetScoringPreset(ctx, input.ID)
	if err != nil {
		return generated.ScoringPreset{}, fmt.Errorf("preset not found: %w", err)
	}
	if preset.IsSystem {
		return generated.ScoringPreset{}, fmt.Errorf("cannot modify system presets")
	}

	if input.Name == "" {
		return generated.ScoringPreset{}, fmt.Errorf("name is required")
	}

	// Validate scoring_config
	var config map[string]interface{}
	if err := json.Unmarshal(input.ScoringConfig, &config); err != nil {
		return generated.ScoringPreset{}, fmt.Errorf("scoring_config must be valid JSON: %w", err)
	}

	return s.queries.UpdateScoringPreset(ctx, generated.UpdateScoringPresetParams{
		ID:            input.ID,
		Name:          input.Name,
		Description:   input.Description,
		ScoringConfig: input.ScoringConfig,
	})
}

func (s *ScoringPresetService) Deactivate(ctx context.Context, id int64) error {
	preset, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return fmt.Errorf("preset not found: %w", err)
	}
	if preset.IsSystem {
		// System presets can be deactivated but not deleted
	}
	return s.queries.DeactivateScoringPreset(ctx, id)
}

func (s *ScoringPresetService) Activate(ctx context.Context, id int64) error {
	return s.queries.ActivateScoringPreset(ctx, id)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/scoring_preset.go
git commit -m "feat: add scoring preset service"
```

---

## Task 8: ScoringPreset Handler

**Files:**
- Create: `backend/handler/scoring_preset.go`

- [ ] **Step 1: Write the handler**

```go
// backend/handler/scoring_preset.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
)

type ScoringPresetHandler struct {
	service *service.ScoringPresetService
}

func NewScoringPresetHandler(svc *service.ScoringPresetService) *ScoringPresetHandler {
	return &ScoringPresetHandler{service: svc}
}

func (h *ScoringPresetHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public: list active presets
	r.Get("/", h.ListActive)
	r.Get("/{presetID}", h.GetByID)

	// Admin: full management
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Put("/{presetID}", h.Update)
		r.Post("/{presetID}/deactivate", h.Deactivate)
		r.Post("/{presetID}/activate", h.Activate)
		r.Get("/all", h.ListAll)
	})

	return r
}

func (h *ScoringPresetHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	presets, err := h.service.ListActive(r.Context())
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to list presets")
		return
	}
	SuccessResponse(w, http.StatusOK, presets)
}

func (h *ScoringPresetHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	presets, err := h.service.ListAll(r.Context())
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to list presets")
		return
	}
	SuccessResponse(w, http.StatusOK, presets)
}

func (h *ScoringPresetHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "presetID"), 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID")
		return
	}

	preset, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Preset not found")
		return
	}
	SuccessResponse(w, http.StatusOK, preset)
}

func (h *ScoringPresetHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		ErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var input service.CreateScoringPresetInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	input.CreatedByID = user.ID

	preset, err := h.service.Create(r.Context(), input)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusCreated, preset)
}

func (h *ScoringPresetHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "presetID"), 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID")
		return
	}

	var input service.UpdateScoringPresetInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	input.ID = id

	preset, err := h.service.Update(r.Context(), input)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, preset)
}

func (h *ScoringPresetHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "presetID"), 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID")
		return
	}

	if err := h.service.Deactivate(r.Context(), id); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, map[string]string{"status": "deactivated"})
}

func (h *ScoringPresetHandler) Activate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "presetID"), 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid preset ID")
		return
	}

	if err := h.service.Activate(r.Context(), id); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, map[string]string{"status": "activated"})
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/scoring_preset.go
git commit -m "feat: add scoring preset HTTP handler"
```

---

## Task 9: Match Service

**Files:**
- Create: `backend/service/match.go`

- [ ] **Step 1: Write the service**

```go
// backend/service/match.go
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/backend/db/generated"
)

type MatchService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

func NewMatchService(queries *generated.Queries, pool *pgxpool.Pool) *MatchService {
	return &MatchService{queries: queries, pool: pool}
}

// --- Score snapshot helpers ---

type ScoreSnapshot struct {
	TeamOneScore   int             `json:"team_1_score"`
	TeamTwoScore   int             `json:"team_2_score"`
	ServingTeam    int             `json:"serving_team"`
	ServerNumber   int             `json:"server_number"`
	CurrentGameNum int             `json:"current_game_num"`
	CompletedGames json.RawMessage `json:"completed_games"`
	Status         string          `json:"status"`
	IsPaused       bool            `json:"is_paused"`
}

func snapshotFromMatch(m generated.Match) ScoreSnapshot {
	return ScoreSnapshot{
		TeamOneScore:   int(m.TeamOneScore),
		TeamTwoScore:   int(m.TeamTwoScore),
		ServingTeam:    int(m.ServingTeam),
		ServerNumber:   int(m.ServerNumber),
		CurrentGameNum: int(m.CurrentGameNum),
		CompletedGames: m.CompletedGames,
		Status:         m.Status,
		IsPaused:       m.IsPaused,
	}
}

func snapshotToJSON(s ScoreSnapshot) json.RawMessage {
	b, _ := json.Marshal(s)
	return b
}

// --- CRUD ---

type CreateMatchInput struct {
	DivisionID            *int64          `json:"division_id"`
	PodID                 *int64          `json:"pod_id"`
	CourtID               *int64          `json:"court_id"`
	Round                 int32           `json:"round"`
	MatchNumber           int32           `json:"match_number"`
	BracketSide           *string         `json:"bracket_side"`
	ScheduledAt           *time.Time      `json:"scheduled_at"`
	Status                string          `json:"status"`
	TeamOneID             *int64          `json:"team_1_id"`
	TeamTwoID             *int64          `json:"team_2_id"`
	TeamOneRegistrationID *int64          `json:"team_1_registration_id"`
	TeamTwoRegistrationID *int64          `json:"team_2_registration_id"`
	TeamOneSeed           *int32          `json:"team_1_seed"`
	TeamTwoSeed           *int32          `json:"team_2_seed"`
	ScoringConfig         json.RawMessage `json:"scoring_config"`
	IsShowCourtMatch      bool            `json:"is_show_court_match"`
	IsQuickMatch          bool            `json:"is_quick_match"`
	RefereeUserID         *int64          `json:"referee_user_id"`
	ScorekeeperUserID     *int64          `json:"scorekeeper_user_id"`
	NextMatchID           *int64          `json:"next_match_id"`
	LoserNextMatchID      *int64          `json:"loser_next_match_id"`
	SeriesMatchType       *string         `json:"series_match_type"`
	CourtQueuePosition    *int32          `json:"court_queue_position"`
	Notes                 *string         `json:"notes"`
}

func (s *MatchService) Create(ctx context.Context, input CreateMatchInput) (generated.Match, error) {
	if input.Status == "" {
		input.Status = "scheduled"
	}
	if len(input.ScoringConfig) == 0 {
		input.ScoringConfig = json.RawMessage(`{}`)
	}

	return s.queries.CreateMatch(ctx, generated.CreateMatchParams{
		DivisionID:            input.DivisionID,
		PodID:                 input.PodID,
		CourtID:               input.CourtID,
		Round:                 input.Round,
		MatchNumber:           input.MatchNumber,
		BracketSide:           input.BracketSide,
		ScheduledAt:           input.ScheduledAt,
		Status:                input.Status,
		TeamOneID:             input.TeamOneID,
		TeamTwoID:             input.TeamTwoID,
		TeamOneRegistrationID: input.TeamOneRegistrationID,
		TeamTwoRegistrationID: input.TeamTwoRegistrationID,
		TeamOneSeed:           input.TeamOneSeed,
		TeamTwoSeed:           input.TeamTwoSeed,
		ScoringConfig:         input.ScoringConfig,
		IsShowCourtMatch:      input.IsShowCourtMatch,
		IsQuickMatch:          input.IsQuickMatch,
		RefereeUserID:         input.RefereeUserID,
		ScorekeeperUserID:     input.ScorekeeperUserID,
		NextMatchID:           input.NextMatchID,
		LoserNextMatchID:      input.LoserNextMatchID,
		SeriesMatchType:       input.SeriesMatchType,
		CourtQueuePosition:    input.CourtQueuePosition,
		Notes:                 input.Notes,
	})
}

func (s *MatchService) GetByID(ctx context.Context, id int64) (generated.Match, error) {
	return s.queries.GetMatch(ctx, id)
}

func (s *MatchService) GetByPublicID(ctx context.Context, publicID uuid.UUID) (generated.Match, error) {
	return s.queries.GetMatchByPublicID(ctx, publicID)
}

func (s *MatchService) ListByDivision(ctx context.Context, divisionID int64) ([]generated.Match, error) {
	return s.queries.ListMatchesByDivision(ctx, &divisionID)
}

func (s *MatchService) ListByPod(ctx context.Context, podID int64) ([]generated.Match, error) {
	return s.queries.ListMatchesByPod(ctx, &podID)
}

func (s *MatchService) ListByCourt(ctx context.Context, courtID int64) ([]generated.Match, error) {
	return s.queries.ListMatchesByCourt(ctx, &courtID)
}

func (s *MatchService) ListByTeam(ctx context.Context, teamID int64, limit, offset int32) ([]generated.Match, int64, error) {
	matches, err := s.queries.ListMatchesByTeam(ctx, generated.ListMatchesByTeamParams{
		TeamOneID: &teamID,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return nil, 0, err
	}
	count, err := s.queries.CountMatchesByTeam(ctx, &teamID)
	if err != nil {
		return nil, 0, err
	}
	return matches, count, nil
}

// --- Status transitions ---

var allowedMatchTransitions = map[string][]string{
	"scheduled":   {"in_progress", "bye", "forfeit", "cancelled"},
	"in_progress": {"completed", "forfeit", "cancelled"},
	"bye":         {},
	"completed":   {},
	"forfeit":     {},
	"cancelled":   {"scheduled"},
}

func (s *MatchService) UpdateStatus(ctx context.Context, id int64, newStatus string) (generated.Match, error) {
	match, err := s.queries.GetMatch(ctx, id)
	if err != nil {
		return generated.Match{}, fmt.Errorf("match not found: %w", err)
	}

	allowed, ok := allowedMatchTransitions[match.Status]
	if !ok {
		return generated.Match{}, fmt.Errorf("unknown current status: %s", match.Status)
	}
	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return generated.Match{}, fmt.Errorf("cannot transition from %s to %s", match.Status, newStatus)
	}

	return s.queries.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
		ID:     id,
		Status: newStatus,
	})
}

// StartMatch transitions a match to in_progress and records a MATCH_STARTED event.
func (s *MatchService) StartMatch(ctx context.Context, matchID int64, userID *int64, scoredByName *string) (generated.Match, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return generated.Match{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return generated.Match{}, fmt.Errorf("match not found: %w", err)
	}

	if match.Status != "scheduled" {
		return generated.Match{}, fmt.Errorf("match must be in scheduled status to start, got: %s", match.Status)
	}

	now := time.Now()
	match, err = qtx.UpdateMatchStarted(ctx, generated.UpdateMatchStartedParams{
		ID:        matchID,
		StartedAt: &now,
	})
	if err != nil {
		return generated.Match{}, fmt.Errorf("update match: %w", err)
	}

	// Record MATCH_STARTED event
	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return generated.Match{}, fmt.Errorf("get next seq: %w", err)
	}

	snapshot := snapshotToJSON(snapshotFromMatch(match))
	_, err = qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      int32(nextSeq),
		EventType:       "MATCH_STARTED",
		Payload:         json.RawMessage(`{}`),
		ScoreSnapshot:   snapshot,
		CreatedByUserID: userID,
		ScoredByName:    scoredByName,
	})
	if err != nil {
		return generated.Match{}, fmt.Errorf("create event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return generated.Match{}, fmt.Errorf("commit: %w", err)
	}

	return match, nil
}

// --- Event recording ---

func (s *MatchService) RecordEvent(ctx context.Context, matchID int64, eventType string, payload json.RawMessage, userID *int64, scoredByName *string) (generated.Match, generated.MatchEvent, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("match not found: %w", err)
	}

	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("get next seq: %w", err)
	}

	snapshot := snapshotToJSON(snapshotFromMatch(match))

	event, err := qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      int32(nextSeq),
		EventType:       eventType,
		Payload:         payload,
		ScoreSnapshot:   snapshot,
		CreatedByUserID: userID,
		ScoredByName:    scoredByName,
	})
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("create event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("commit: %w", err)
	}

	return match, event, nil
}

// Undo rolls back to the previous event's snapshot.
func (s *MatchService) Undo(ctx context.Context, matchID int64) (generated.Match, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return generated.Match{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return generated.Match{}, fmt.Errorf("match not found: %w", err)
	}

	latest, err := qtx.GetLatestMatchEvent(ctx, matchID)
	if err != nil {
		return generated.Match{}, fmt.Errorf("no events to undo: %w", err)
	}

	if latest.SequenceID <= 1 {
		return generated.Match{}, fmt.Errorf("cannot undo past the first event")
	}

	// Get the previous event's snapshot
	prev, err := qtx.GetPreviousMatchEvent(ctx, generated.GetPreviousMatchEventParams{
		MatchID:    matchID,
		SequenceID: latest.SequenceID,
	})
	if err != nil {
		return generated.Match{}, fmt.Errorf("previous event not found: %w", err)
	}

	// Parse the snapshot and restore match state
	var snapshot ScoreSnapshot
	if err := json.Unmarshal(prev.ScoreSnapshot, &snapshot); err != nil {
		return generated.Match{}, fmt.Errorf("parse snapshot: %w", err)
	}

	match, err = qtx.UpdateMatchScoring(ctx, generated.UpdateMatchScoringParams{
		ID:              matchID,
		TeamOneScore:    int32(snapshot.TeamOneScore),
		TeamTwoScore:    int32(snapshot.TeamTwoScore),
		ServingTeam:     int32(snapshot.ServingTeam),
		ServerNumber:    int32(snapshot.ServerNumber),
		ServingPlayerID: match.ServingPlayerID, // preserve
		CurrentGameNum:  int32(snapshot.CurrentGameNum),
		CompletedGames:  snapshot.CompletedGames,
		IsPaused:        snapshot.IsPaused,
	})
	if err != nil {
		return generated.Match{}, fmt.Errorf("restore match: %w", err)
	}

	// If status changed, update it
	if snapshot.Status != match.Status {
		match, err = qtx.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
			ID:     matchID,
			Status: snapshot.Status,
		})
		if err != nil {
			return generated.Match{}, fmt.Errorf("restore status: %w", err)
		}
	}

	// Delete the undone event
	if err := qtx.DeleteMatchEventsAfterSequence(ctx, generated.DeleteMatchEventsAfterSequenceParams{
		MatchID:    matchID,
		SequenceID: prev.SequenceID,
	}); err != nil {
		return generated.Match{}, fmt.Errorf("delete events: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return generated.Match{}, fmt.Errorf("commit: %w", err)
	}

	return match, nil
}

// GetMatchEvents returns all events for a match.
func (s *MatchService) GetMatchEvents(ctx context.Context, matchID int64) ([]generated.MatchEvent, error) {
	return s.queries.ListMatchEvents(ctx, matchID)
}

// --- Court assignment ---

func (s *MatchService) AssignToCourt(ctx context.Context, matchID, courtID int64, queuePosition *int32) (generated.Match, error) {
	return s.queries.UpdateMatchCourt(ctx, generated.UpdateMatchCourtParams{
		ID:                 matchID,
		CourtID:            &courtID,
		CourtQueuePosition: queuePosition,
	})
}

// --- Quick match cleanup ---

func (s *MatchService) CleanupExpiredQuickMatches(ctx context.Context) error {
	return s.queries.DeleteExpiredQuickMatches(ctx)
}
```

- [ ] **Step 2: Install uuid dependency**

Run: `cd backend && go get github.com/google/uuid`
Expected: Added to go.mod.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/service/match.go backend/go.mod backend/go.sum
git commit -m "feat: add match service with CRUD, events, undo, status transitions"
```

---

## Task 10: Match Handler

**Files:**
- Create: `backend/handler/match.go`

- [ ] **Step 1: Write the handler**

```go
// backend/handler/match.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
)

type MatchHandler struct {
	service *service.MatchService
}

func NewMatchHandler(svc *service.MatchService) *MatchHandler {
	return &MatchHandler{service: svc}
}

func (h *MatchHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public: read-only match data
	r.Get("/{matchPublicID}", h.GetByPublicID)
	r.Get("/{matchPublicID}/events", h.GetEvents)

	// Authenticated: match management
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Post("/{matchPublicID}/start", h.Start)
		r.Post("/{matchPublicID}/status", h.UpdateStatus)
		r.Post("/{matchPublicID}/undo", h.Undo)
		r.Post("/{matchPublicID}/event", h.RecordEvent)
		r.Put("/{matchPublicID}/court", h.AssignCourt)
		r.Put("/{matchPublicID}/scoring-config", h.UpdateScoringConfig)
		r.Put("/{matchPublicID}/notes", h.UpdateNotes)
		r.Put("/{matchPublicID}/referee", h.UpdateReferee)
	})

	return r
}

// Nested routes for listing matches by context
func (h *MatchHandler) DivisionRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByDivision)
	return r
}

func (h *MatchHandler) CourtRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByCourt)
	r.Get("/active", h.GetActiveByCourt)
	return r
}

func (h *MatchHandler) TeamRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByTeam)
	return r
}

func (h *MatchHandler) GetByPublicID(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}
	SuccessResponse(w, http.StatusOK, match)
}

func (h *MatchHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	events, err := h.service.GetMatchEvents(r.Context(), match.ID)
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to get events")
		return
	}
	SuccessResponse(w, http.StatusOK, events)
}

func (h *MatchHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input service.CreateMatchInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	match, err := h.service.Create(r.Context(), input)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusCreated, match)
}

func (h *MatchHandler) Start(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	user := middleware.GetUserFromContext(r.Context())
	var userID *int64
	if user != nil {
		userID = &user.ID
	}

	var body struct {
		ScoredByName *string `json:"scored_by_name"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	result, err := h.service.StartMatch(r.Context(), match.ID, userID, body.ScoredByName)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, result)
}

func (h *MatchHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	result, err := h.service.UpdateStatus(r.Context(), match.ID, body.Status)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, result)
}

func (h *MatchHandler) Undo(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	result, err := h.service.Undo(r.Context(), match.ID)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, result)
}

func (h *MatchHandler) RecordEvent(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		EventType    string          `json:"event_type"`
		Payload      json.RawMessage `json:"payload"`
		ScoredByName *string         `json:"scored_by_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	user := middleware.GetUserFromContext(r.Context())
	var userID *int64
	if user != nil {
		userID = &user.ID
	}

	if len(body.Payload) == 0 {
		body.Payload = json.RawMessage(`{}`)
	}

	result, event, err := h.service.RecordEvent(r.Context(), match.ID, body.EventType, body.Payload, userID, body.ScoredByName)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, map[string]interface{}{
		"match": result,
		"event": event,
	})
}

func (h *MatchHandler) AssignCourt(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		CourtID       int64  `json:"court_id"`
		QueuePosition *int32 `json:"queue_position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	result, err := h.service.AssignToCourt(r.Context(), match.ID, body.CourtID, body.QueuePosition)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	SuccessResponse(w, http.StatusOK, result)
}

func (h *MatchHandler) UpdateScoringConfig(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		ScoringConfig json.RawMessage `json:"scoring_config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	result, err := h.service.queries.UpdateMatchScoringConfig(r.Context(), generated.UpdateMatchScoringConfigParams{
		ID:            match.ID,
		ScoringConfig: body.ScoringConfig,
	})
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to update config")
		return
	}
	SuccessResponse(w, http.StatusOK, result)
}

func (h *MatchHandler) UpdateNotes(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		Notes *string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if err := h.service.queries.UpdateMatchNotes(r.Context(), generated.UpdateMatchNotesParams{
		ID:    match.ID,
		Notes: body.Notes,
	}); err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to update notes")
		return
	}
	SuccessResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *MatchHandler) UpdateReferee(w http.ResponseWriter, r *http.Request) {
	publicIDStr := chi.URLParam(r, "matchPublicID")
	publicID, err := uuid.Parse(publicIDStr)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid match public ID")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "Match not found")
		return
	}

	var body struct {
		RefereeUserID *int64 `json:"referee_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if err := h.service.queries.UpdateMatchReferee(r.Context(), generated.UpdateMatchRefereeParams{
		ID:            match.ID,
		RefereeUserID: body.RefereeUserID,
	}); err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to update referee")
		return
	}
	SuccessResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

// --- Context-scoped list handlers ---

func (h *MatchHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionIDStr := chi.URLParam(r, "divisionID")
	divisionID, err := strconv.ParseInt(divisionIDStr, 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	matches, err := h.service.ListByDivision(r.Context(), divisionID)
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to list matches")
		return
	}
	SuccessResponse(w, http.StatusOK, matches)
}

func (h *MatchHandler) ListByCourt(w http.ResponseWriter, r *http.Request) {
	courtIDStr := chi.URLParam(r, "courtID")
	courtID, err := strconv.ParseInt(courtIDStr, 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	matches, err := h.service.ListByCourt(r.Context(), courtID)
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to list matches")
		return
	}
	SuccessResponse(w, http.StatusOK, matches)
}

func (h *MatchHandler) GetActiveByCourt(w http.ResponseWriter, r *http.Request) {
	courtIDStr := chi.URLParam(r, "courtID")
	courtID, err := strconv.ParseInt(courtIDStr, 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	match, err := h.service.queries.GetActiveMatchOnCourt(r.Context(), &courtID)
	if err != nil {
		ErrorResponse(w, http.StatusNotFound, "NOT_FOUND", "No active match on this court")
		return
	}
	SuccessResponse(w, http.StatusOK, match)
}

func (h *MatchHandler) ListByTeam(w http.ResponseWriter, r *http.Request) {
	teamIDStr := chi.URLParam(r, "teamID")
	teamID, err := strconv.ParseInt(teamIDStr, 10, 64)
	if err != nil {
		ErrorResponse(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	limit, offset := parsePagination(r)

	matches, total, err := h.service.ListByTeam(r.Context(), teamID, limit, offset)
	if err != nil {
		ErrorResponse(w, http.StatusInternalServerError, "INTERNAL", "Failed to list matches")
		return
	}
	PaginatedResponse(w, http.StatusOK, matches, total, limit, offset)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/match.go
git commit -m "feat: add match HTTP handler with CRUD, events, undo, court assignment"
```

---

## Task 11: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Add route groups for scoring presets and matches**

Add the following route mounts to the existing router setup in `backend/router/router.go`:

```go
// In the router setup function, add these route groups:

// Scoring Presets
r.Route("/api/v1/scoring-presets", func(r chi.Router) {
    r.Mount("/", scoringPresetHandler.Routes())
})

// Matches (primary routes)
r.Route("/api/v1/matches", func(r chi.Router) {
    r.Mount("/", matchHandler.Routes())
})

// Nested match routes under divisions
r.Route("/api/v1/divisions/{divisionID}/matches", func(r chi.Router) {
    r.Mount("/", matchHandler.DivisionRoutes())
})

// Nested match routes under courts
r.Route("/api/v1/courts/{courtID}/matches", func(r chi.Router) {
    r.Mount("/", matchHandler.CourtRoutes())
})

// Nested match routes under teams
r.Route("/api/v1/teams/{teamID}/matches", func(r chi.Router) {
    r.Mount("/", matchHandler.TeamRoutes())
})
```

The router setup function needs to accept the new handlers as parameters. Update the function signature and `main.go` to create `ScoringPresetService`, `MatchService`, `ScoringPresetHandler`, and `MatchHandler` and pass them through.

- [ ] **Step 2: Update main.go to create and wire services/handlers**

Add to `main.go` after existing service/handler initialization:

```go
// After existing service/handler setup:
scoringPresetSvc := service.NewScoringPresetService(queries)
matchSvc := service.NewMatchService(queries, pool)

scoringPresetHandler := handler.NewScoringPresetHandler(scoringPresetSvc)
matchHandler := handler.NewMatchHandler(matchSvc)
```

Pass these to the router setup function.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire scoring preset and match routes into router"
```

---

## Task 12: Smoke Test

- [ ] **Step 1: Start services**

Run: `docker compose up -d && cd backend && go run main.go`
Expected: Server starts, migrations applied (19 total).

- [ ] **Step 2: Register a user**

Run: `curl -s -X POST http://localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"ref@test.com","password":"password123","first_name":"Ref","last_name":"Test","date_of_birth":"1990-01-01"}' | jq .`
Expected: User created, session cookie returned.

- [ ] **Step 3: Save session cookie and list scoring presets**

Run: `curl -s -b cookies.txt http://localhost:8080/api/v1/scoring-presets | jq '.data | length'`
Expected: `10` (all system presets).

- [ ] **Step 4: Create a custom scoring preset**

Run: `curl -s -X POST -b cookies.txt http://localhost:8080/api/v1/scoring-presets -H 'Content-Type: application/json' -d '{"name":"Custom Rally 15","description":"Custom rally format","scoring_config":{"scoring_type":"rally","points_to":15,"win_by":2,"best_of":3,"timeouts_per_game":2,"end_change_points":8}}' | jq .data.name`
Expected: `"Custom Rally 15"`

- [ ] **Step 5: Create a match**

Run: `curl -s -X POST -b cookies.txt http://localhost:8080/api/v1/matches -H 'Content-Type: application/json' -d '{"round":1,"match_number":1,"status":"scheduled","is_quick_match":true,"scoring_config":{"scoring_type":"side_out","points_to":11,"win_by":2,"best_of":3}}' | jq .data.public_id`
Expected: A UUID string.

- [ ] **Step 6: Start the match**

Run: `curl -s -X POST -b cookies.txt http://localhost:8080/api/v1/matches/{PUBLIC_ID}/start -H 'Content-Type: application/json' -d '{}' | jq .data.status`
Expected: `"in_progress"`

- [ ] **Step 7: Record an event**

Run: `curl -s -X POST -b cookies.txt http://localhost:8080/api/v1/matches/{PUBLIC_ID}/event -H 'Content-Type: application/json' -d '{"event_type":"POINT_SCORED","payload":{"team":1}}' | jq .data.event.event_type`
Expected: `"POINT_SCORED"`

- [ ] **Step 8: Get events**

Run: `curl -s http://localhost:8080/api/v1/matches/{PUBLIC_ID}/events | jq '.data | length'`
Expected: `2` (MATCH_STARTED + POINT_SCORED).

- [ ] **Step 9: Undo**

Run: `curl -s -X POST -b cookies.txt http://localhost:8080/api/v1/matches/{PUBLIC_ID}/undo | jq .data.status`
Expected: `"in_progress"` (state restored to pre-point).

- [ ] **Step 10: Commit final**

```bash
git add -A
git commit -m "feat: Phase 4A complete — Match, MatchEvent, ScoringPreset entities"
```

---

## API Endpoints Summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/scoring-presets` | No | List active presets |
| `GET` | `/api/v1/scoring-presets/{id}` | No | Get preset by ID |
| `GET` | `/api/v1/scoring-presets/all` | Yes | List all presets (including inactive) |
| `POST` | `/api/v1/scoring-presets` | Yes | Create custom preset |
| `PUT` | `/api/v1/scoring-presets/{id}` | Yes | Update preset (non-system only) |
| `POST` | `/api/v1/scoring-presets/{id}/deactivate` | Yes | Deactivate preset |
| `POST` | `/api/v1/scoring-presets/{id}/activate` | Yes | Activate preset |
| `GET` | `/api/v1/matches/{publicID}` | No | Get match by public ID |
| `GET` | `/api/v1/matches/{publicID}/events` | No | Get match event log |
| `POST` | `/api/v1/matches` | Yes | Create match |
| `POST` | `/api/v1/matches/{publicID}/start` | Yes | Start match |
| `POST` | `/api/v1/matches/{publicID}/status` | Yes | Update match status |
| `POST` | `/api/v1/matches/{publicID}/undo` | Yes | Undo last event |
| `POST` | `/api/v1/matches/{publicID}/event` | Yes | Record event |
| `PUT` | `/api/v1/matches/{publicID}/court` | Yes | Assign to court |
| `PUT` | `/api/v1/matches/{publicID}/scoring-config` | Yes | Update scoring config |
| `PUT` | `/api/v1/matches/{publicID}/notes` | Yes | Update notes |
| `PUT` | `/api/v1/matches/{publicID}/referee` | Yes | Assign referee |
| `GET` | `/api/v1/divisions/{id}/matches` | No | List matches by division |
| `GET` | `/api/v1/courts/{id}/matches` | No | List matches by court |
| `GET` | `/api/v1/courts/{id}/matches/active` | No | Get active match on court |
| `GET` | `/api/v1/teams/{id}/matches` | No | List matches by team |

**Total: 22 new endpoints**
