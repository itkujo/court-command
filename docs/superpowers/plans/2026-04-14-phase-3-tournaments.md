# Phase 3: Tournaments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full tournament and league management backend — Leagues, Seasons, Division Templates, Tournaments, Divisions, Pods, Registration, Announcements, League Registration, and Season Confirmation — with all CRUD, search, and lifecycle management endpoints.

**Architecture:** Follows Phase 1/2 patterns: Goose SQL migrations, sqlc queries, service layer, Chi HTTP handlers. All entities are independent top-level or join-table entities connected through FKs. Leagues and Tournaments are co-equal pillars. Standalone tournaments (no league/season) are fully supported. Division templates propagate from League to Tournament on creation but are independent after that.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17

**Depends on:** Phase 1 (auth, users, middleware, response helpers) + Phase 2 (teams, orgs, venues, courts, players, slug generation, pagination helpers)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 00007_create_leagues.sql
│   │   ├── 00008_create_seasons.sql
│   │   ├── 00009_create_division_templates.sql
│   │   ├── 00010_create_tournaments.sql
│   │   ├── 00011_create_divisions.sql
│   │   ├── 00012_create_pods.sql
│   │   ├── 00013_create_registrations.sql
│   │   ├── 00014_create_announcements.sql
│   │   ├── 00015_create_league_registrations.sql
│   │   └── 00016_create_season_confirmations.sql
│   ├── queries/
│   │   ├── leagues.sql
│   │   ├── seasons.sql
│   │   ├── division_templates.sql
│   │   ├── tournaments.sql
│   │   ├── divisions.sql
│   │   ├── pods.sql
│   │   ├── registrations.sql
│   │   ├── announcements.sql
│   │   ├── league_registrations.sql
│   │   └── season_confirmations.sql
│   └── generated/          # sqlc regenerated
├── service/
│   ├── league.go
│   ├── season.go
│   ├── tournament.go
│   ├── division.go
│   ├── pod.go
│   ├── registration.go
│   └── announcement.go
├── handler/
│   ├── league.go
│   ├── season.go
│   ├── tournament.go
│   ├── division.go
│   ├── pod.go
│   ├── registration.go
│   └── announcement.go
└── router/
    └── router.go            # Updated with new route groups
```

---

## Task 1: Leagues Migration

**Files:**
- Create: `backend/db/migrations/00007_create_leagues.sql`

- [ ] **Step 1: Create the leagues migration file**

```sql
-- backend/db/migrations/00007_create_leagues.sql

-- +goose Up
CREATE TABLE leagues (
    id              BIGSERIAL PRIMARY KEY,
    public_id       TEXT NOT NULL DEFAULT 'CC-' || nextval('public_id_seq')::TEXT,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'active', 'archived', 'cancelled')),
    logo_url        TEXT,
    banner_url      TEXT,
    description     TEXT,
    website_url     TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    city            TEXT,
    state_province  TEXT,
    country         TEXT,
    rules_document_url TEXT,
    social_links    JSONB DEFAULT '{}',
    sponsor_info    JSONB DEFAULT '[]',
    notes           TEXT,
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_leagues_slug ON leagues(slug);
CREATE INDEX idx_leagues_public_id ON leagues(public_id);
CREATE INDEX idx_leagues_status ON leagues(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leagues_created_by ON leagues(created_by_user_id);
CREATE INDEX idx_leagues_deleted_at ON leagues(id) WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS leagues;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

Expected: Migration 00007 applied successfully.

- [ ] **Step 3: Verify table exists**

```bash
docker exec -it court-command-db psql -U courtcommand -c "\d leagues"
```

Expected: Table with all columns listed above.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/00007_create_leagues.sql
git commit -m "feat: add leagues migration (00007)"
```

---

## Task 2: Seasons Migration

**Files:**
- Create: `backend/db/migrations/00008_create_seasons.sql`

- [ ] **Step 1: Create the seasons migration file**

```sql
-- backend/db/migrations/00008_create_seasons.sql

-- +goose Up
CREATE TABLE seasons (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    league_id       BIGINT NOT NULL REFERENCES leagues(id),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    start_date      DATE,
    end_date        DATE,
    description     TEXT,
    notes           TEXT,
    roster_confirmation_deadline TIMESTAMPTZ,
    standings_method TEXT DEFAULT 'placement_points'
                    CHECK (standings_method IN ('placement_points', 'win_loss', 'match_points', 'custom')),
    standings_config JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE (league_id, slug)
);

CREATE INDEX idx_seasons_league ON seasons(league_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_seasons_status ON seasons(status) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS seasons;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00008_create_seasons.sql
git commit -m "feat: add seasons migration (00008)"
```

---

## Task 3: Division Templates Migration

**Files:**
- Create: `backend/db/migrations/00009_create_division_templates.sql`

Division templates are lightweight copies of Division fields owned by a League. When a Tournament is created within a League, these templates are cloned into actual Division records. After cloning, tournament divisions are independent.

- [ ] **Step 1: Create the division templates migration file**

```sql
-- backend/db/migrations/00009_create_division_templates.sql

-- +goose Up
CREATE TABLE division_templates (
    id                  BIGSERIAL PRIMARY KEY,
    league_id           BIGINT NOT NULL REFERENCES leagues(id),
    name                TEXT NOT NULL,
    format              TEXT NOT NULL CHECK (format IN ('singles', 'doubles', 'mixed_doubles', 'team_match')),
    gender_restriction  TEXT CHECK (gender_restriction IN ('open', 'mens', 'womens', 'mixed')),
    age_restriction     JSONB,
    skill_min           DOUBLE PRECISION,
    skill_max           DOUBLE PRECISION,
    rating_system       TEXT CHECK (rating_system IN ('dupr', 'vair', 'self_rated', 'none')),
    bracket_format      TEXT NOT NULL CHECK (bracket_format IN (
        'single_elimination', 'double_elimination', 'round_robin', 'pool_play', 'pool_to_bracket'
    )),
    scoring_format      TEXT,
    max_teams           INT,
    max_roster_size     INT,
    entry_fee_amount    NUMERIC(10, 2),
    entry_fee_currency  TEXT DEFAULT 'USD',
    seed_method         TEXT CHECK (seed_method IN ('manual', 'rating', 'random')),
    registration_mode   TEXT DEFAULT 'open' CHECK (registration_mode IN ('open', 'invite_only')),
    auto_approve        BOOLEAN DEFAULT true,
    auto_promote_waitlist BOOLEAN DEFAULT true,
    grand_finals_reset  BOOLEAN DEFAULT true,
    advancement_count   INT DEFAULT 2,
    allow_self_check_in BOOLEAN DEFAULT false,
    allow_ref_player_add BOOLEAN DEFAULT false,
    report_to_dupr      BOOLEAN DEFAULT false,
    report_to_vair      BOOLEAN DEFAULT false,
    sort_order          INT DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_division_templates_league ON division_templates(league_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS division_templates;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00009_create_division_templates.sql
git commit -m "feat: add division templates migration (00009)"
```

---

## Task 4: Tournaments Migration

**Files:**
- Create: `backend/db/migrations/00010_create_tournaments.sql`

- [ ] **Step 1: Create the tournaments migration file**

```sql
-- backend/db/migrations/00010_create_tournaments.sql

-- +goose Up
CREATE TABLE tournaments (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           TEXT NOT NULL DEFAULT 'CC-' || nextval('public_id_seq')::TEXT,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'published', 'registration_open',
                            'registration_closed', 'in_progress',
                            'completed', 'archived', 'cancelled'
                        )),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    venue_id            BIGINT REFERENCES venues(id),
    league_id           BIGINT REFERENCES leagues(id),
    season_id           BIGINT REFERENCES seasons(id),
    description         TEXT,
    logo_url            TEXT,
    banner_url          TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    website_url         TEXT,
    registration_open_at  TIMESTAMPTZ,
    registration_close_at TIMESTAMPTZ,
    max_participants    INT,
    rules_document_url  TEXT,
    cancellation_reason TEXT,
    social_links        JSONB DEFAULT '{}',
    notes               TEXT,
    sponsor_info        JSONB DEFAULT '[]',
    show_registrations  BOOLEAN DEFAULT true,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    td_user_id          BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tournaments_slug ON tournaments(slug);
CREATE INDEX idx_tournaments_public_id ON tournaments(public_id);
CREATE INDEX idx_tournaments_status ON tournaments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_league ON tournaments(league_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_season ON tournaments(season_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_venue ON tournaments(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by_user_id);
CREATE INDEX idx_tournaments_td ON tournaments(td_user_id) WHERE td_user_id IS NOT NULL;
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_deleted_at ON tournaments(id) WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS tournaments;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00010_create_tournaments.sql
git commit -m "feat: add tournaments migration (00010)"
```

---

## Task 5: Divisions Migration

**Files:**
- Create: `backend/db/migrations/00011_create_divisions.sql`

- [ ] **Step 1: Create the divisions migration file**

```sql
-- backend/db/migrations/00011_create_divisions.sql

-- +goose Up
CREATE TABLE divisions (
    id                  BIGSERIAL PRIMARY KEY,
    tournament_id       BIGINT NOT NULL REFERENCES tournaments(id),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    format              TEXT NOT NULL CHECK (format IN ('singles', 'doubles', 'mixed_doubles', 'team_match')),
    gender_restriction  TEXT CHECK (gender_restriction IN ('open', 'mens', 'womens', 'mixed')),
    age_restriction     JSONB,
    skill_min           DOUBLE PRECISION,
    skill_max           DOUBLE PRECISION,
    rating_system       TEXT CHECK (rating_system IN ('dupr', 'vair', 'self_rated', 'none')),
    bracket_format      TEXT NOT NULL CHECK (bracket_format IN (
        'single_elimination', 'double_elimination', 'round_robin', 'pool_play', 'pool_to_bracket'
    )),
    scoring_format      TEXT,
    max_teams           INT,
    max_roster_size     INT,
    entry_fee_amount    NUMERIC(10, 2),
    entry_fee_currency  TEXT DEFAULT 'USD',
    check_in_open       BOOLEAN DEFAULT false,
    allow_self_check_in BOOLEAN DEFAULT false,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'registration_open', 'registration_closed',
                            'seeding', 'in_progress', 'completed'
                        )),
    seed_method         TEXT CHECK (seed_method IN ('manual', 'rating', 'random')),
    sort_order          INT DEFAULT 0,
    notes               TEXT,
    auto_approve        BOOLEAN DEFAULT true,
    registration_mode   TEXT DEFAULT 'open' CHECK (registration_mode IN ('open', 'invite_only')),
    auto_promote_waitlist BOOLEAN DEFAULT true,
    grand_finals_reset  BOOLEAN DEFAULT true,
    advancement_count   INT DEFAULT 2,
    current_phase       TEXT CHECK (current_phase IN ('pool', 'bracket')),
    report_to_dupr      BOOLEAN DEFAULT false,
    report_to_vair      BOOLEAN DEFAULT false,
    allow_ref_player_add BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    UNIQUE (tournament_id, slug)
);

CREATE INDEX idx_divisions_tournament ON divisions(tournament_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_divisions_status ON divisions(status) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS divisions;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00011_create_divisions.sql
git commit -m "feat: add divisions migration (00011)"
```

---

## Task 6: Pods Migration

**Files:**
- Create: `backend/db/migrations/00012_create_pods.sql`

- [ ] **Step 1: Create the pods migration file**

```sql
-- backend/db/migrations/00012_create_pods.sql

-- +goose Up
CREATE TABLE pods (
    id              BIGSERIAL PRIMARY KEY,
    division_id     BIGINT NOT NULL REFERENCES divisions(id),
    name            TEXT NOT NULL,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE (division_id, name)
);

CREATE INDEX idx_pods_division ON pods(division_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS pods;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00012_create_pods.sql
git commit -m "feat: add pods migration (00012)"
```

---

## Task 7: Registrations Migration

**Files:**
- Create: `backend/db/migrations/00013_create_registrations.sql`

- [ ] **Step 1: Create the registrations migration file**

```sql
-- backend/db/migrations/00013_create_registrations.sql

-- +goose Up
CREATE TABLE registrations (
    id                  BIGSERIAL PRIMARY KEY,
    division_id         BIGINT NOT NULL REFERENCES divisions(id),
    team_id             BIGINT REFERENCES teams(id),
    player_id           BIGINT REFERENCES users(id),
    registered_by_user_id BIGINT NOT NULL REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'approved', 'waitlisted', 'withdrawn',
                            'rejected', 'checked_in', 'no_show', 'withdrawn_mid_tournament'
                        )),
    seed                INT,
    final_placement     INT,
    registration_notes  TEXT,
    admin_notes         TEXT,
    seeking_partner     BOOLEAN DEFAULT false,
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    withdrawn_at        TIMESTAMPTZ,
    checked_in_at       TIMESTAMPTZ,

    -- At least one of team_id or player_id must be set
    CHECK (team_id IS NOT NULL OR player_id IS NOT NULL)
);

CREATE INDEX idx_registrations_division ON registrations(division_id);
CREATE INDEX idx_registrations_team ON registrations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_registrations_player ON registrations(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_registrations_status ON registrations(division_id, status);
CREATE UNIQUE INDEX idx_registrations_unique_team ON registrations(division_id, team_id)
    WHERE team_id IS NOT NULL AND status NOT IN ('withdrawn', 'rejected');
CREATE UNIQUE INDEX idx_registrations_unique_player ON registrations(division_id, player_id)
    WHERE player_id IS NOT NULL AND status NOT IN ('withdrawn', 'rejected');

-- +goose Down
DROP TABLE IF EXISTS registrations;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00013_create_registrations.sql
git commit -m "feat: add registrations migration (00013)"
```

---

## Task 8: Announcements Migration

**Files:**
- Create: `backend/db/migrations/00014_create_announcements.sql`

- [ ] **Step 1: Create the announcements migration file**

```sql
-- backend/db/migrations/00014_create_announcements.sql

-- +goose Up
CREATE TABLE announcements (
    id                  BIGSERIAL PRIMARY KEY,
    tournament_id       BIGINT REFERENCES tournaments(id),
    league_id           BIGINT REFERENCES leagues(id),
    division_id         BIGINT REFERENCES divisions(id),
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    is_pinned           BOOLEAN DEFAULT false,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    -- At least one scope must be set
    CHECK (tournament_id IS NOT NULL OR league_id IS NOT NULL)
);

CREATE INDEX idx_announcements_tournament ON announcements(tournament_id)
    WHERE tournament_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_league ON announcements(league_id)
    WHERE league_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_division ON announcements(division_id)
    WHERE division_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_announcements_pinned ON announcements(is_pinned, created_at DESC)
    WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS announcements;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00014_create_announcements.sql
git commit -m "feat: add announcements migration (00014)"
```

---

## Task 9: League Registrations Migration

**Files:**
- Create: `backend/db/migrations/00015_create_league_registrations.sql`

- [ ] **Step 1: Create the league registrations migration file**

```sql
-- backend/db/migrations/00015_create_league_registrations.sql

-- +goose Up
CREATE TABLE league_registrations (
    id              BIGSERIAL PRIMARY KEY,
    league_id       BIGINT NOT NULL REFERENCES leagues(id),
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'withdrawn')),
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,

    UNIQUE (league_id, org_id)
);

CREATE INDEX idx_league_registrations_league ON league_registrations(league_id);
CREATE INDEX idx_league_registrations_org ON league_registrations(org_id);

-- +goose Down
DROP TABLE IF EXISTS league_registrations;
```

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00015_create_league_registrations.sql
git commit -m "feat: add league registrations migration (00015)"
```

---

## Task 10: Season Confirmations Migration

**Files:**
- Create: `backend/db/migrations/00016_create_season_confirmations.sql`

- [ ] **Step 1: Create the season confirmations migration file**

```sql
-- backend/db/migrations/00016_create_season_confirmations.sql

-- +goose Up
CREATE TABLE season_confirmations (
    id              BIGSERIAL PRIMARY KEY,
    season_id       BIGINT NOT NULL REFERENCES seasons(id),
    team_id         BIGINT NOT NULL REFERENCES teams(id),
    division_id     BIGINT NOT NULL REFERENCES divisions(id),
    confirmed       BOOLEAN DEFAULT false,
    confirmed_at    TIMESTAMPTZ,
    deadline        TIMESTAMPTZ NOT NULL,

    UNIQUE (season_id, team_id, division_id)
);

CREATE INDEX idx_season_confirmations_season ON season_confirmations(season_id);
CREATE INDEX idx_season_confirmations_team ON season_confirmations(team_id);

-- +goose Down
DROP TABLE IF EXISTS season_confirmations;
```

Note: `season_confirmations.division_id` references `divisions(id)`. This means season confirmations point to a specific tournament's division. This is intentional — a team confirms participation in a specific division within that season's tournament.

- [ ] **Step 2: Run migration**

```bash
cd backend && go run . migrate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00016_create_season_confirmations.sql
git commit -m "feat: add season confirmations migration (00016)"
```

---

## Task 11: League Queries

**Files:**
- Create: `backend/db/queries/leagues.sql`

- [ ] **Step 1: Create league query definitions**

```sql
-- backend/db/queries/leagues.sql

-- name: CreateLeague :one
INSERT INTO leagues (
    name, slug, status, logo_url, banner_url, description, website_url,
    contact_email, contact_phone, city, state_province, country,
    rules_document_url, social_links, sponsor_info, notes, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
) RETURNING *;

-- name: GetLeagueByID :one
SELECT * FROM leagues WHERE id = $1 AND deleted_at IS NULL;

-- name: GetLeagueBySlug :one
SELECT * FROM leagues WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetLeagueByPublicID :one
SELECT * FROM leagues WHERE public_id = $1 AND deleted_at IS NULL;

-- name: ListLeagues :many
SELECT * FROM leagues
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountLeagues :one
SELECT COUNT(*) FROM leagues WHERE deleted_at IS NULL;

-- name: SearchLeagues :many
SELECT * FROM leagues
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR city ILIKE '%' || @search_term::TEXT || '%'
    OR state_province ILIKE '%' || @search_term::TEXT || '%'
    OR country ILIKE '%' || @search_term::TEXT || '%'
  )
ORDER BY name ASC
LIMIT $1 OFFSET $2;

-- name: CountSearchLeagues :one
SELECT COUNT(*) FROM leagues
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR city ILIKE '%' || @search_term::TEXT || '%'
    OR state_province ILIKE '%' || @search_term::TEXT || '%'
    OR country ILIKE '%' || @search_term::TEXT || '%'
  );

-- name: UpdateLeague :one
UPDATE leagues SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    status = COALESCE(sqlc.narg('status'), status),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    banner_url = COALESCE(sqlc.narg('banner_url'), banner_url),
    description = COALESCE(sqlc.narg('description'), description),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    rules_document_url = COALESCE(sqlc.narg('rules_document_url'), rules_document_url),
    social_links = COALESCE(sqlc.narg('social_links'), social_links),
    sponsor_info = COALESCE(sqlc.narg('sponsor_info'), sponsor_info),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteLeague :exec
UPDATE leagues SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListLeaguesByCreator :many
SELECT * FROM leagues
WHERE created_by_user_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLeaguesByCreator :one
SELECT COUNT(*) FROM leagues
WHERE created_by_user_id = $1 AND deleted_at IS NULL;

-- name: SlugExistsLeague :one
SELECT EXISTS(SELECT 1 FROM leagues WHERE slug = $1 AND deleted_at IS NULL);
```

- [ ] **Step 2: Run sqlc generate**

```bash
cd backend && sqlc generate
```

Expected: No errors. New league types and methods appear in `db/generated/`.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/leagues.sql backend/db/generated/
git commit -m "feat: add league sqlc queries"
```

---

## Task 12: Season Queries

**Files:**
- Create: `backend/db/queries/seasons.sql`

- [ ] **Step 1: Create season query definitions**

```sql
-- backend/db/queries/seasons.sql

-- name: CreateSeason :one
INSERT INTO seasons (
    name, slug, league_id, status, start_date, end_date, description,
    notes, roster_confirmation_deadline, standings_method, standings_config
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetSeasonByID :one
SELECT * FROM seasons WHERE id = $1 AND deleted_at IS NULL;

-- name: GetSeasonBySlug :one
SELECT * FROM seasons WHERE league_id = $1 AND slug = $2 AND deleted_at IS NULL;

-- name: ListSeasonsByLeague :many
SELECT * FROM seasons
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY start_date DESC NULLS LAST, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSeasonsByLeague :one
SELECT COUNT(*) FROM seasons
WHERE league_id = $1 AND deleted_at IS NULL;

-- name: UpdateSeason :one
UPDATE seasons SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    status = COALESCE(sqlc.narg('status'), status),
    start_date = COALESCE(sqlc.narg('start_date'), start_date),
    end_date = COALESCE(sqlc.narg('end_date'), end_date),
    description = COALESCE(sqlc.narg('description'), description),
    notes = COALESCE(sqlc.narg('notes'), notes),
    roster_confirmation_deadline = COALESCE(sqlc.narg('roster_confirmation_deadline'), roster_confirmation_deadline),
    standings_method = COALESCE(sqlc.narg('standings_method'), standings_method),
    standings_config = COALESCE(sqlc.narg('standings_config'), standings_config),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteSeason :exec
UPDATE seasons SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SlugExistsSeason :one
SELECT EXISTS(SELECT 1 FROM seasons WHERE league_id = $1 AND slug = $2 AND deleted_at IS NULL);
```

- [ ] **Step 2: Run sqlc generate**

```bash
cd backend && sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/seasons.sql backend/db/generated/
git commit -m "feat: add season sqlc queries"
```

---

## Task 13: Division Template Queries

**Files:**
- Create: `backend/db/queries/division_templates.sql`

- [ ] **Step 1: Create division template query definitions**

```sql
-- backend/db/queries/division_templates.sql

-- name: CreateDivisionTemplate :one
INSERT INTO division_templates (
    league_id, name, format, gender_restriction, age_restriction,
    skill_min, skill_max, rating_system, bracket_format, scoring_format,
    max_teams, max_roster_size, entry_fee_amount, entry_fee_currency,
    seed_method, registration_mode, auto_approve, auto_promote_waitlist,
    grand_finals_reset, advancement_count, allow_self_check_in,
    allow_ref_player_add, report_to_dupr, report_to_vair, sort_order, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25, $26
) RETURNING *;

-- name: GetDivisionTemplateByID :one
SELECT * FROM division_templates WHERE id = $1 AND deleted_at IS NULL;

-- name: ListDivisionTemplatesByLeague :many
SELECT * FROM division_templates
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdateDivisionTemplate :one
UPDATE division_templates SET
    name = COALESCE(sqlc.narg('name'), name),
    format = COALESCE(sqlc.narg('format'), format),
    gender_restriction = COALESCE(sqlc.narg('gender_restriction'), gender_restriction),
    age_restriction = COALESCE(sqlc.narg('age_restriction'), age_restriction),
    skill_min = COALESCE(sqlc.narg('skill_min'), skill_min),
    skill_max = COALESCE(sqlc.narg('skill_max'), skill_max),
    rating_system = COALESCE(sqlc.narg('rating_system'), rating_system),
    bracket_format = COALESCE(sqlc.narg('bracket_format'), bracket_format),
    scoring_format = COALESCE(sqlc.narg('scoring_format'), scoring_format),
    max_teams = COALESCE(sqlc.narg('max_teams'), max_teams),
    max_roster_size = COALESCE(sqlc.narg('max_roster_size'), max_roster_size),
    entry_fee_amount = COALESCE(sqlc.narg('entry_fee_amount'), entry_fee_amount),
    entry_fee_currency = COALESCE(sqlc.narg('entry_fee_currency'), entry_fee_currency),
    seed_method = COALESCE(sqlc.narg('seed_method'), seed_method),
    registration_mode = COALESCE(sqlc.narg('registration_mode'), registration_mode),
    auto_approve = COALESCE(sqlc.narg('auto_approve'), auto_approve),
    auto_promote_waitlist = COALESCE(sqlc.narg('auto_promote_waitlist'), auto_promote_waitlist),
    grand_finals_reset = COALESCE(sqlc.narg('grand_finals_reset'), grand_finals_reset),
    advancement_count = COALESCE(sqlc.narg('advancement_count'), advancement_count),
    allow_self_check_in = COALESCE(sqlc.narg('allow_self_check_in'), allow_self_check_in),
    allow_ref_player_add = COALESCE(sqlc.narg('allow_ref_player_add'), allow_ref_player_add),
    report_to_dupr = COALESCE(sqlc.narg('report_to_dupr'), report_to_dupr),
    report_to_vair = COALESCE(sqlc.narg('report_to_vair'), report_to_vair),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteDivisionTemplate :exec
UPDATE division_templates SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Run sqlc generate**

```bash
cd backend && sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/division_templates.sql backend/db/generated/
git commit -m "feat: add division template sqlc queries"
```

---

## Task 14: Tournament Queries

**Files:**
- Create: `backend/db/queries/tournaments.sql`

- [ ] **Step 1: Create tournament query definitions**

```sql
-- backend/db/queries/tournaments.sql

-- name: CreateTournament :one
INSERT INTO tournaments (
    name, slug, status, start_date, end_date, venue_id, league_id, season_id,
    description, logo_url, banner_url, contact_email, contact_phone, website_url,
    registration_open_at, registration_close_at, max_participants,
    rules_document_url, social_links, notes, sponsor_info,
    show_registrations, created_by_user_id, td_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
) RETURNING *;

-- name: GetTournamentByID :one
SELECT * FROM tournaments WHERE id = $1 AND deleted_at IS NULL;

-- name: GetTournamentBySlug :one
SELECT * FROM tournaments WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetTournamentByPublicID :one
SELECT * FROM tournaments WHERE public_id = $1 AND deleted_at IS NULL;

-- name: ListTournaments :many
SELECT * FROM tournaments
WHERE deleted_at IS NULL
ORDER BY start_date DESC
LIMIT $1 OFFSET $2;

-- name: CountTournaments :one
SELECT COUNT(*) FROM tournaments WHERE deleted_at IS NULL;

-- name: ListTournamentsByLeague :many
SELECT * FROM tournaments
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY start_date DESC
LIMIT $2 OFFSET $3;

-- name: CountTournamentsByLeague :one
SELECT COUNT(*) FROM tournaments
WHERE league_id = $1 AND deleted_at IS NULL;

-- name: ListTournamentsBySeason :many
SELECT * FROM tournaments
WHERE season_id = $1 AND deleted_at IS NULL
ORDER BY start_date ASC;

-- name: ListTournamentsByCreator :many
SELECT * FROM tournaments
WHERE (created_by_user_id = $1 OR td_user_id = $1) AND deleted_at IS NULL
ORDER BY start_date DESC
LIMIT $2 OFFSET $3;

-- name: CountTournamentsByCreator :one
SELECT COUNT(*) FROM tournaments
WHERE (created_by_user_id = $1 OR td_user_id = $1) AND deleted_at IS NULL;

-- name: SearchTournaments :many
SELECT * FROM tournaments
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR description ILIKE '%' || @search_term::TEXT || '%'
  )
ORDER BY start_date DESC
LIMIT $1 OFFSET $2;

-- name: CountSearchTournaments :one
SELECT COUNT(*) FROM tournaments
WHERE deleted_at IS NULL
  AND (
    name ILIKE '%' || @search_term::TEXT || '%'
    OR description ILIKE '%' || @search_term::TEXT || '%'
  );

-- name: UpdateTournament :one
UPDATE tournaments SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    status = COALESCE(sqlc.narg('status'), status),
    start_date = COALESCE(sqlc.narg('start_date'), start_date),
    end_date = COALESCE(sqlc.narg('end_date'), end_date),
    venue_id = COALESCE(sqlc.narg('venue_id'), venue_id),
    league_id = COALESCE(sqlc.narg('league_id'), league_id),
    season_id = COALESCE(sqlc.narg('season_id'), season_id),
    description = COALESCE(sqlc.narg('description'), description),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    banner_url = COALESCE(sqlc.narg('banner_url'), banner_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    registration_open_at = COALESCE(sqlc.narg('registration_open_at'), registration_open_at),
    registration_close_at = COALESCE(sqlc.narg('registration_close_at'), registration_close_at),
    max_participants = COALESCE(sqlc.narg('max_participants'), max_participants),
    rules_document_url = COALESCE(sqlc.narg('rules_document_url'), rules_document_url),
    cancellation_reason = COALESCE(sqlc.narg('cancellation_reason'), cancellation_reason),
    social_links = COALESCE(sqlc.narg('social_links'), social_links),
    notes = COALESCE(sqlc.narg('notes'), notes),
    sponsor_info = COALESCE(sqlc.narg('sponsor_info'), sponsor_info),
    show_registrations = COALESCE(sqlc.narg('show_registrations'), show_registrations),
    td_user_id = COALESCE(sqlc.narg('td_user_id'), td_user_id),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTournament :exec
UPDATE tournaments SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SlugExistsTournament :one
SELECT EXISTS(SELECT 1 FROM tournaments WHERE slug = $1 AND deleted_at IS NULL);

-- name: ListTournamentsByStatus :many
SELECT * FROM tournaments
WHERE status = $1 AND deleted_at IS NULL
ORDER BY start_date ASC
LIMIT $2 OFFSET $3;

-- name: CountTournamentsByStatus :one
SELECT COUNT(*) FROM tournaments
WHERE status = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Run sqlc generate**

```bash
cd backend && sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/tournaments.sql backend/db/generated/
git commit -m "feat: add tournament sqlc queries"
```

---

## Task 15: Division Queries

**Files:**
- Create: `backend/db/queries/divisions.sql`

- [ ] **Step 1: Create division query definitions**

```sql
-- backend/db/queries/divisions.sql

-- name: CreateDivision :one
INSERT INTO divisions (
    tournament_id, name, slug, format, gender_restriction, age_restriction,
    skill_min, skill_max, rating_system, bracket_format, scoring_format,
    max_teams, max_roster_size, entry_fee_amount, entry_fee_currency,
    check_in_open, allow_self_check_in, status, seed_method, sort_order,
    notes, auto_approve, registration_mode, auto_promote_waitlist,
    grand_finals_reset, advancement_count, current_phase,
    report_to_dupr, report_to_vair, allow_ref_player_add
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
) RETURNING *;

-- name: GetDivisionByID :one
SELECT * FROM divisions WHERE id = $1 AND deleted_at IS NULL;

-- name: GetDivisionBySlug :one
SELECT * FROM divisions
WHERE tournament_id = $1 AND slug = $2 AND deleted_at IS NULL;

-- name: ListDivisionsByTournament :many
SELECT * FROM divisions
WHERE tournament_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdateDivision :one
UPDATE divisions SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    format = COALESCE(sqlc.narg('format'), format),
    gender_restriction = COALESCE(sqlc.narg('gender_restriction'), gender_restriction),
    age_restriction = COALESCE(sqlc.narg('age_restriction'), age_restriction),
    skill_min = COALESCE(sqlc.narg('skill_min'), skill_min),
    skill_max = COALESCE(sqlc.narg('skill_max'), skill_max),
    rating_system = COALESCE(sqlc.narg('rating_system'), rating_system),
    bracket_format = COALESCE(sqlc.narg('bracket_format'), bracket_format),
    scoring_format = COALESCE(sqlc.narg('scoring_format'), scoring_format),
    max_teams = COALESCE(sqlc.narg('max_teams'), max_teams),
    max_roster_size = COALESCE(sqlc.narg('max_roster_size'), max_roster_size),
    entry_fee_amount = COALESCE(sqlc.narg('entry_fee_amount'), entry_fee_amount),
    entry_fee_currency = COALESCE(sqlc.narg('entry_fee_currency'), entry_fee_currency),
    check_in_open = COALESCE(sqlc.narg('check_in_open'), check_in_open),
    allow_self_check_in = COALESCE(sqlc.narg('allow_self_check_in'), allow_self_check_in),
    status = COALESCE(sqlc.narg('status'), status),
    seed_method = COALESCE(sqlc.narg('seed_method'), seed_method),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    auto_approve = COALESCE(sqlc.narg('auto_approve'), auto_approve),
    registration_mode = COALESCE(sqlc.narg('registration_mode'), registration_mode),
    auto_promote_waitlist = COALESCE(sqlc.narg('auto_promote_waitlist'), auto_promote_waitlist),
    grand_finals_reset = COALESCE(sqlc.narg('grand_finals_reset'), grand_finals_reset),
    advancement_count = COALESCE(sqlc.narg('advancement_count'), advancement_count),
    current_phase = COALESCE(sqlc.narg('current_phase'), current_phase),
    report_to_dupr = COALESCE(sqlc.narg('report_to_dupr'), report_to_dupr),
    report_to_vair = COALESCE(sqlc.narg('report_to_vair'), report_to_vair),
    allow_ref_player_add = COALESCE(sqlc.narg('allow_ref_player_add'), allow_ref_player_add),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteDivision :exec
UPDATE divisions SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SlugExistsDivision :one
SELECT EXISTS(SELECT 1 FROM divisions WHERE tournament_id = $1 AND slug = $2 AND deleted_at IS NULL);

-- name: CountDivisionsByTournament :one
SELECT COUNT(*) FROM divisions
WHERE tournament_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Run sqlc generate**

```bash
cd backend && sqlc generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/divisions.sql backend/db/generated/
git commit -m "feat: add division sqlc queries"
```

---

## Task 16: Pod, Registration, Announcement, LeagueRegistration, SeasonConfirmation Queries

**Files:**
- Create: `backend/db/queries/pods.sql`
- Create: `backend/db/queries/registrations.sql`
- Create: `backend/db/queries/announcements.sql`
- Create: `backend/db/queries/league_registrations.sql`
- Create: `backend/db/queries/season_confirmations.sql`

- [ ] **Step 1: Create pod query definitions**

```sql
-- backend/db/queries/pods.sql

-- name: CreatePod :one
INSERT INTO pods (division_id, name, sort_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPodByID :one
SELECT * FROM pods WHERE id = $1 AND deleted_at IS NULL;

-- name: ListPodsByDivision :many
SELECT * FROM pods
WHERE division_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdatePod :one
UPDATE pods SET
    name = COALESCE(sqlc.narg('name'), name),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeletePod :exec
UPDATE pods SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: CountPodsByDivision :one
SELECT COUNT(*) FROM pods
WHERE division_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Create registration query definitions**

```sql
-- backend/db/queries/registrations.sql

-- name: CreateRegistration :one
INSERT INTO registrations (
    division_id, team_id, player_id, registered_by_user_id,
    status, seed, registration_notes, admin_notes, seeking_partner
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetRegistrationByID :one
SELECT * FROM registrations WHERE id = $1;

-- name: ListRegistrationsByDivision :many
SELECT * FROM registrations
WHERE division_id = $1
ORDER BY seed ASC NULLS LAST, registered_at ASC
LIMIT $2 OFFSET $3;

-- name: CountRegistrationsByDivision :one
SELECT COUNT(*) FROM registrations WHERE division_id = $1;

-- name: CountRegistrationsByDivisionAndStatus :one
SELECT COUNT(*) FROM registrations
WHERE division_id = $1 AND status = $2;

-- name: ListRegistrationsByDivisionAndStatus :many
SELECT * FROM registrations
WHERE division_id = $1 AND status = $2
ORDER BY seed ASC NULLS LAST, registered_at ASC
LIMIT $3 OFFSET $4;

-- name: ListRegistrationsByPlayer :many
SELECT r.* FROM registrations r
JOIN divisions d ON d.id = r.division_id
JOIN tournaments t ON t.id = d.tournament_id
WHERE r.player_id = $1
ORDER BY t.start_date DESC
LIMIT $2 OFFSET $3;

-- name: CountRegistrationsByPlayer :one
SELECT COUNT(*) FROM registrations WHERE player_id = $1;

-- name: ListRegistrationsByTeam :many
SELECT r.* FROM registrations r
JOIN divisions d ON d.id = r.division_id
JOIN tournaments t ON t.id = d.tournament_id
WHERE r.team_id = $1
ORDER BY t.start_date DESC
LIMIT $2 OFFSET $3;

-- name: CountRegistrationsByTeam :one
SELECT COUNT(*) FROM registrations WHERE team_id = $1;

-- name: UpdateRegistrationStatus :one
UPDATE registrations SET
    status = $2,
    approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END,
    withdrawn_at = CASE WHEN $2 IN ('withdrawn', 'withdrawn_mid_tournament') THEN NOW() ELSE withdrawn_at END,
    checked_in_at = CASE WHEN $2 = 'checked_in' THEN NOW() ELSE checked_in_at END
WHERE id = $1
RETURNING *;

-- name: UpdateRegistrationSeed :one
UPDATE registrations SET seed = $2
WHERE id = $1
RETURNING *;

-- name: UpdateRegistrationPlacement :one
UPDATE registrations SET final_placement = $2
WHERE id = $1
RETURNING *;

-- name: UpdateRegistrationAdminNotes :one
UPDATE registrations SET admin_notes = $2
WHERE id = $1
RETURNING *;

-- name: BulkUpdateNoShow :exec
UPDATE registrations SET status = 'no_show'
WHERE division_id = $1
  AND status NOT IN ('checked_in', 'withdrawn', 'rejected', 'withdrawn_mid_tournament');

-- name: GetNextWaitlisted :one
SELECT * FROM registrations
WHERE division_id = $1 AND status = 'waitlisted'
ORDER BY registered_at ASC
LIMIT 1;

-- name: ListSeekingPartner :many
SELECT * FROM registrations
WHERE division_id = $1 AND seeking_partner = true
  AND status IN ('pending', 'approved')
ORDER BY registered_at ASC;
```

- [ ] **Step 3: Create announcement query definitions**

```sql
-- backend/db/queries/announcements.sql

-- name: CreateAnnouncement :one
INSERT INTO announcements (
    tournament_id, league_id, division_id, title, body,
    is_pinned, created_by_user_id
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAnnouncementByID :one
SELECT * FROM announcements WHERE id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByTournament :many
SELECT * FROM announcements
WHERE tournament_id = $1 AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAnnouncementsByTournament :one
SELECT COUNT(*) FROM announcements
WHERE tournament_id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByLeague :many
SELECT * FROM announcements
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAnnouncementsByLeague :one
SELECT COUNT(*) FROM announcements
WHERE league_id = $1 AND deleted_at IS NULL;

-- name: ListAnnouncementsByDivision :many
SELECT * FROM announcements
WHERE division_id = $1 AND deleted_at IS NULL
ORDER BY is_pinned DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateAnnouncement :one
UPDATE announcements SET
    title = COALESCE(sqlc.narg('title'), title),
    body = COALESCE(sqlc.narg('body'), body),
    is_pinned = COALESCE(sqlc.narg('is_pinned'), is_pinned),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteAnnouncement :exec
UPDATE announcements SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 4: Create league registration query definitions**

```sql
-- backend/db/queries/league_registrations.sql

-- name: CreateLeagueRegistration :one
INSERT INTO league_registrations (league_id, org_id, status, notes)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLeagueRegistrationByID :one
SELECT * FROM league_registrations WHERE id = $1;

-- name: GetLeagueRegistrationByLeagueAndOrg :one
SELECT * FROM league_registrations
WHERE league_id = $1 AND org_id = $2;

-- name: ListLeagueRegistrationsByLeague :many
SELECT * FROM league_registrations
WHERE league_id = $1
ORDER BY registered_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLeagueRegistrationsByLeague :one
SELECT COUNT(*) FROM league_registrations WHERE league_id = $1;

-- name: ListLeagueRegistrationsByOrg :many
SELECT * FROM league_registrations
WHERE org_id = $1
ORDER BY registered_at DESC;

-- name: UpdateLeagueRegistrationStatus :one
UPDATE league_registrations SET
    status = $2,
    approved_at = CASE WHEN $2 = 'active' AND approved_at IS NULL THEN NOW() ELSE approved_at END
WHERE id = $1
RETURNING *;

-- name: UpdateLeagueRegistrationNotes :one
UPDATE league_registrations SET notes = $2
WHERE id = $1
RETURNING *;
```

- [ ] **Step 5: Create season confirmation query definitions**

```sql
-- backend/db/queries/season_confirmations.sql

-- name: CreateSeasonConfirmation :one
INSERT INTO season_confirmations (season_id, team_id, division_id, deadline)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetSeasonConfirmationByID :one
SELECT * FROM season_confirmations WHERE id = $1;

-- name: ListSeasonConfirmationsBySeason :many
SELECT * FROM season_confirmations
WHERE season_id = $1
ORDER BY deadline ASC;

-- name: ListSeasonConfirmationsByTeam :many
SELECT * FROM season_confirmations
WHERE team_id = $1
ORDER BY deadline ASC;

-- name: ConfirmSeasonParticipation :one
UPDATE season_confirmations SET
    confirmed = true,
    confirmed_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListUnconfirmedBySeasonPastDeadline :many
SELECT * FROM season_confirmations
WHERE season_id = $1 AND confirmed = false AND deadline < NOW();
```

- [ ] **Step 6: Run sqlc generate**

```bash
cd backend && sqlc generate
```

Expected: No errors. All new types generated in `db/generated/`.

- [ ] **Step 7: Commit**

```bash
git add backend/db/queries/pods.sql backend/db/queries/registrations.sql \
       backend/db/queries/announcements.sql backend/db/queries/league_registrations.sql \
       backend/db/queries/season_confirmations.sql backend/db/generated/
git commit -m "feat: add pod, registration, announcement, league registration, season confirmation queries"
```

---

## Task 17: League Service

**Files:**
- Create: `backend/service/league.go`

- [ ] **Step 1: Create the league service**

```go
// backend/service/league.go
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/court-command/court-command/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
)

type LeagueService struct {
	queries *generated.Queries
}

func NewLeagueService(queries *generated.Queries) *LeagueService {
	return &LeagueService{queries: queries}
}

type CreateLeagueInput struct {
	Name             string
	Description      *string
	LogoURL          *string
	BannerURL        *string
	WebsiteURL       *string
	ContactEmail     *string
	ContactPhone     *string
	City             *string
	StateProvince    *string
	Country          *string
	RulesDocumentURL *string
	SocialLinks      []byte // JSON
	SponsorInfo      []byte // JSON
	Notes            *string
}

func (s *LeagueService) Create(ctx context.Context, input CreateLeagueInput, createdByUserID int64) (*generated.League, error) {
	slug, err := s.generateUniqueSlug(ctx, input.Name)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}

	league, err := s.queries.CreateLeague(ctx, generated.CreateLeagueParams{
		Name:             input.Name,
		Slug:             slug,
		Status:           "draft",
		LogoUrl:          input.LogoURL,
		BannerUrl:        input.BannerURL,
		Description:      input.Description,
		WebsiteUrl:       input.WebsiteURL,
		ContactEmail:     input.ContactEmail,
		ContactPhone:     input.ContactPhone,
		City:             input.City,
		StateProvince:    input.StateProvince,
		Country:          input.Country,
		RulesDocumentUrl: input.RulesDocumentURL,
		SocialLinks:      input.SocialLinks,
		SponsorInfo:      input.SponsorInfo,
		Notes:            input.Notes,
		CreatedByUserID:  createdByUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("create league: %w", err)
	}

	return &league, nil
}

func (s *LeagueService) GetByID(ctx context.Context, id int64) (*generated.League, error) {
	league, err := s.queries.GetLeagueByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get league: %w", err)
	}
	return &league, nil
}

func (s *LeagueService) GetBySlug(ctx context.Context, slug string) (*generated.League, error) {
	league, err := s.queries.GetLeagueBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("get league by slug: %w", err)
	}
	return &league, nil
}

func (s *LeagueService) GetByPublicID(ctx context.Context, publicID string) (*generated.League, error) {
	league, err := s.queries.GetLeagueByPublicID(ctx, publicID)
	if err != nil {
		return nil, fmt.Errorf("get league by public id: %w", err)
	}
	return &league, nil
}

func (s *LeagueService) List(ctx context.Context, limit, offset int32) ([]generated.League, int64, error) {
	leagues, err := s.queries.ListLeagues(ctx, generated.ListLeaguesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list leagues: %w", err)
	}
	count, err := s.queries.CountLeagues(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count leagues: %w", err)
	}
	return leagues, count, nil
}

func (s *LeagueService) Search(ctx context.Context, term string, limit, offset int32) ([]generated.League, int64, error) {
	leagues, err := s.queries.SearchLeagues(ctx, generated.SearchLeaguesParams{
		SearchTerm: term,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("search leagues: %w", err)
	}
	count, err := s.queries.CountSearchLeagues(ctx, term)
	if err != nil {
		return nil, 0, fmt.Errorf("count search leagues: %w", err)
	}
	return leagues, count, nil
}

func (s *LeagueService) Update(ctx context.Context, id int64, params generated.UpdateLeagueParams) (*generated.League, error) {
	params.ID = id
	league, err := s.queries.UpdateLeague(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update league: %w", err)
	}
	return &league, nil
}

func (s *LeagueService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteLeague(ctx, id)
}

// UpdateStatus validates the league status transition and updates.
func (s *LeagueService) UpdateStatus(ctx context.Context, id int64, newStatus string) (*generated.League, error) {
	league, err := s.queries.GetLeagueByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get league: %w", err)
	}

	if !isValidLeagueStatusTransition(league.Status, newStatus) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", league.Status, newStatus)
	}

	updated, err := s.queries.UpdateLeague(ctx, generated.UpdateLeagueParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("update league status: %w", err)
	}
	return &updated, nil
}

func isValidLeagueStatusTransition(from, to string) bool {
	transitions := map[string][]string{
		"draft":     {"published", "cancelled"},
		"published": {"active", "cancelled"},
		"active":    {"archived", "cancelled"},
		"archived":  {},
		"cancelled": {},
	}
	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *LeagueService) ListByCreator(ctx context.Context, userID int64, limit, offset int32) ([]generated.League, int64, error) {
	leagues, err := s.queries.ListLeaguesByCreator(ctx, generated.ListLeaguesByCreatorParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list leagues by creator: %w", err)
	}
	count, err := s.queries.CountLeaguesByCreator(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("count leagues by creator: %w", err)
	}
	return leagues, count, nil
}

func (s *LeagueService) generateUniqueSlug(ctx context.Context, name string) (string, error) {
	base := generateSlug(name)
	slug := base

	for i := 1; ; i++ {
		exists, err := s.queries.SlugExistsLeague(ctx, slug)
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
```

Note: `generateSlug` is the shared function from Phase 2's `service/team.go` that lowercases, replaces spaces with hyphens, and strips non-alphanumeric characters. If it was defined only in `team.go`, it should be extracted to a shared `service/slug.go` file. The executing agent should check if it exists and either reuse it or extract it.

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/league.go
git commit -m "feat: add league service"
```

---

## Task 18: Tournament Service

**Files:**
- Create: `backend/service/tournament.go`

- [ ] **Step 1: Create the tournament service**

```go
// backend/service/tournament.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type TournamentService struct {
	queries *generated.Queries
}

func NewTournamentService(queries *generated.Queries) *TournamentService {
	return &TournamentService{queries: queries}
}

type CreateTournamentInput struct {
	Name               string
	StartDate          string // YYYY-MM-DD
	EndDate            string // YYYY-MM-DD
	VenueID            *int64
	LeagueID           *int64
	SeasonID           *int64
	Description        *string
	LogoURL            *string
	BannerURL          *string
	ContactEmail       *string
	ContactPhone       *string
	WebsiteURL         *string
	RegistrationOpenAt *string // RFC3339
	RegistrationCloseAt *string
	MaxParticipants    *int32
	RulesDocumentURL   *string
	SocialLinks        []byte
	Notes              *string
	SponsorInfo        []byte
	ShowRegistrations  *bool
	TdUserID           *int64
}

func (s *TournamentService) Create(ctx context.Context, input CreateTournamentInput, createdByUserID int64) (*generated.Tournament, error) {
	slug, err := s.generateUniqueSlug(ctx, input.Name)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}

	tournament, err := s.queries.CreateTournament(ctx, generated.CreateTournamentParams{
		Name:               input.Name,
		Slug:               slug,
		Status:             "draft",
		StartDate:          parseDate(input.StartDate),
		EndDate:            parseDate(input.EndDate),
		VenueID:            input.VenueID,
		LeagueID:           input.LeagueID,
		SeasonID:           input.SeasonID,
		Description:        input.Description,
		LogoUrl:            input.LogoURL,
		BannerUrl:          input.BannerURL,
		ContactEmail:       input.ContactEmail,
		ContactPhone:       input.ContactPhone,
		WebsiteUrl:         input.WebsiteURL,
		RegistrationOpenAt: parseOptionalTimestamp(input.RegistrationOpenAt),
		RegistrationCloseAt: parseOptionalTimestamp(input.RegistrationCloseAt),
		MaxParticipants:    input.MaxParticipants,
		RulesDocumentUrl:   input.RulesDocumentURL,
		SocialLinks:        input.SocialLinks,
		Notes:              input.Notes,
		SponsorInfo:        input.SponsorInfo,
		ShowRegistrations:  input.ShowRegistrations,
		CreatedByUserID:    createdByUserID,
		TdUserID:           input.TdUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("create tournament: %w", err)
	}

	return &tournament, nil
}

func (s *TournamentService) GetByID(ctx context.Context, id int64) (*generated.Tournament, error) {
	t, err := s.queries.GetTournamentByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get tournament: %w", err)
	}
	return &t, nil
}

func (s *TournamentService) GetBySlug(ctx context.Context, slug string) (*generated.Tournament, error) {
	t, err := s.queries.GetTournamentBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("get tournament by slug: %w", err)
	}
	return &t, nil
}

func (s *TournamentService) GetByPublicID(ctx context.Context, publicID string) (*generated.Tournament, error) {
	t, err := s.queries.GetTournamentByPublicID(ctx, publicID)
	if err != nil {
		return nil, fmt.Errorf("get tournament by public id: %w", err)
	}
	return &t, nil
}

func (s *TournamentService) List(ctx context.Context, limit, offset int32) ([]generated.Tournament, int64, error) {
	tournaments, err := s.queries.ListTournaments(ctx, generated.ListTournamentsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list tournaments: %w", err)
	}
	count, err := s.queries.CountTournaments(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count tournaments: %w", err)
	}
	return tournaments, count, nil
}

func (s *TournamentService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]generated.Tournament, int64, error) {
	tournaments, err := s.queries.ListTournamentsByLeague(ctx, generated.ListTournamentsByLeagueParams{
		LeagueID: &leagueID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list tournaments by league: %w", err)
	}
	count, err := s.queries.CountTournamentsByLeague(ctx, &leagueID)
	if err != nil {
		return nil, 0, fmt.Errorf("count tournaments by league: %w", err)
	}
	return tournaments, count, nil
}

func (s *TournamentService) ListByCreator(ctx context.Context, userID int64, limit, offset int32) ([]generated.Tournament, int64, error) {
	tournaments, err := s.queries.ListTournamentsByCreator(ctx, generated.ListTournamentsByCreatorParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list tournaments by creator: %w", err)
	}
	count, err := s.queries.CountTournamentsByCreator(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("count tournaments by creator: %w", err)
	}
	return tournaments, count, nil
}

func (s *TournamentService) Search(ctx context.Context, term string, limit, offset int32) ([]generated.Tournament, int64, error) {
	tournaments, err := s.queries.SearchTournaments(ctx, generated.SearchTournamentsParams{
		SearchTerm: term,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("search tournaments: %w", err)
	}
	count, err := s.queries.CountSearchTournaments(ctx, term)
	if err != nil {
		return nil, 0, fmt.Errorf("count search tournaments: %w", err)
	}
	return tournaments, count, nil
}

func (s *TournamentService) Update(ctx context.Context, id int64, params generated.UpdateTournamentParams) (*generated.Tournament, error) {
	params.ID = id
	t, err := s.queries.UpdateTournament(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update tournament: %w", err)
	}
	return &t, nil
}

func (s *TournamentService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteTournament(ctx, id)
}

func (s *TournamentService) UpdateStatus(ctx context.Context, id int64, newStatus string, cancellationReason *string) (*generated.Tournament, error) {
	t, err := s.queries.GetTournamentByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get tournament: %w", err)
	}

	if !isValidTournamentStatusTransition(t.Status, newStatus) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", t.Status, newStatus)
	}

	params := generated.UpdateTournamentParams{
		ID:     id,
		Status: &newStatus,
	}
	if newStatus == "cancelled" && cancellationReason != nil {
		params.CancellationReason = cancellationReason
	}

	updated, err := s.queries.UpdateTournament(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update tournament status: %w", err)
	}
	return &updated, nil
}

// IsTD checks if userID is the TD or creator of the tournament.
func (s *TournamentService) IsTD(ctx context.Context, tournamentID, userID int64) (bool, error) {
	t, err := s.queries.GetTournamentByID(ctx, tournamentID)
	if err != nil {
		return false, fmt.Errorf("get tournament: %w", err)
	}
	if t.CreatedByUserID == userID {
		return true, nil
	}
	if t.TdUserID != nil && *t.TdUserID == userID {
		return true, nil
	}
	return false, nil
}

// Clone creates a new tournament based on an existing one.
// Copies: name (prefixed), venue, description, divisions, sponsor info, rules doc.
// Does NOT copy: seeds, brackets, matches, dates.
func (s *TournamentService) Clone(ctx context.Context, sourceID int64, newName, startDate, endDate string, includeRegistrations bool, createdByUserID int64) (*generated.Tournament, error) {
	source, err := s.queries.GetTournamentByID(ctx, sourceID)
	if err != nil {
		return nil, fmt.Errorf("get source tournament: %w", err)
	}

	slug, err := s.generateUniqueSlug(ctx, newName)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}

	clone, err := s.queries.CreateTournament(ctx, generated.CreateTournamentParams{
		Name:             newName,
		Slug:             slug,
		Status:           "draft",
		StartDate:        parseDate(startDate),
		EndDate:          parseDate(endDate),
		VenueID:          source.VenueID,
		LeagueID:         source.LeagueID,
		SeasonID:         nil, // clone doesn't inherit season
		Description:      source.Description,
		LogoUrl:          source.LogoUrl,
		BannerUrl:        source.BannerUrl,
		ContactEmail:     source.ContactEmail,
		ContactPhone:     source.ContactPhone,
		WebsiteUrl:       source.WebsiteUrl,
		RulesDocumentUrl: source.RulesDocumentUrl,
		SocialLinks:      source.SocialLinks,
		SponsorInfo:      source.SponsorInfo,
		ShowRegistrations: &source.ShowRegistrations,
		CreatedByUserID:  createdByUserID,
		TdUserID:         nil,
	})
	if err != nil {
		return nil, fmt.Errorf("create clone: %w", err)
	}

	// Clone divisions
	divisions, err := s.queries.ListDivisionsByTournament(ctx, sourceID)
	if err != nil {
		return nil, fmt.Errorf("list source divisions: %w", err)
	}

	for _, div := range divisions {
		newDiv, err := s.queries.CreateDivision(ctx, generated.CreateDivisionParams{
			TournamentID:      clone.ID,
			Name:              div.Name,
			Slug:              div.Slug,
			Format:            div.Format,
			GenderRestriction: div.GenderRestriction,
			AgeRestriction:    div.AgeRestriction,
			SkillMin:          div.SkillMin,
			SkillMax:          div.SkillMax,
			RatingSystem:      div.RatingSystem,
			BracketFormat:     div.BracketFormat,
			ScoringFormat:     div.ScoringFormat,
			MaxTeams:          div.MaxTeams,
			MaxRosterSize:     div.MaxRosterSize,
			EntryFeeAmount:    div.EntryFeeAmount,
			EntryFeeCurrency:  div.EntryFeeCurrency,
			Status:            "draft",
			SeedMethod:        div.SeedMethod,
			SortOrder:         div.SortOrder,
			Notes:             div.Notes,
			AutoApprove:       div.AutoApprove,
			RegistrationMode:  div.RegistrationMode,
			AutoPromoteWaitlist: div.AutoPromoteWaitlist,
			GrandFinalsReset:  div.GrandFinalsReset,
			AdvancementCount:  div.AdvancementCount,
			ReportToDupr:      div.ReportToDupr,
			ReportToVair:      div.ReportToVair,
			AllowRefPlayerAdd: div.AllowRefPlayerAdd,
		})
		if err != nil {
			return nil, fmt.Errorf("clone division %s: %w", div.Name, err)
		}

		// Optionally clone registrations
		if includeRegistrations {
			regs, err := s.queries.ListRegistrationsByDivisionAndStatus(ctx, generated.ListRegistrationsByDivisionAndStatusParams{
				DivisionID: div.ID,
				Status:     "approved",
				Limit:      10000,
				Offset:     0,
			})
			if err != nil {
				return nil, fmt.Errorf("list registrations for clone: %w", err)
			}

			newStatus := "pending"
			if div.AutoApprove {
				newStatus = "approved"
			}

			for _, reg := range regs {
				_, err := s.queries.CreateRegistration(ctx, generated.CreateRegistrationParams{
					DivisionID:        newDiv.ID,
					TeamID:            reg.TeamID,
					PlayerID:          reg.PlayerID,
					RegisteredByUserID: reg.RegisteredByUserID,
					Status:            newStatus,
					SeekingPartner:    reg.SeekingPartner,
				})
				if err != nil {
					return nil, fmt.Errorf("clone registration: %w", err)
				}
			}
		}
	}

	return &clone, nil
}

func isValidTournamentStatusTransition(from, to string) bool {
	// cancelled is reachable from any state except draft
	if to == "cancelled" && from != "draft" {
		return true
	}

	transitions := map[string][]string{
		"draft":               {"published"},
		"published":           {"registration_open"},
		"registration_open":   {"registration_closed"},
		"registration_closed": {"in_progress"},
		"in_progress":         {"completed"},
		"completed":           {"archived"},
		"archived":            {},
		"cancelled":           {},
	}
	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *TournamentService) generateUniqueSlug(ctx context.Context, name string) (string, error) {
	base := generateSlug(name)
	slug := base

	for i := 1; ; i++ {
		exists, err := s.queries.SlugExistsTournament(ctx, slug)
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
```

Note: `parseDate` and `parseOptionalTimestamp` are helper functions that parse date/time strings into pgtype values. The executing agent should add these to a shared `service/helpers.go` file if they don't already exist.

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/service/tournament.go
git commit -m "feat: add tournament service with clone support"
```

---

## Task 19: Division Service

**Files:**
- Create: `backend/service/division.go`

- [ ] **Step 1: Create the division service**

```go
// backend/service/division.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type DivisionService struct {
	queries *generated.Queries
}

func NewDivisionService(queries *generated.Queries) *DivisionService {
	return &DivisionService{queries: queries}
}

func (s *DivisionService) Create(ctx context.Context, params generated.CreateDivisionParams) (*generated.Division, error) {
	slug, err := s.generateUniqueSlug(ctx, params.TournamentID, params.Name)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}
	params.Slug = slug

	div, err := s.queries.CreateDivision(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create division: %w", err)
	}
	return &div, nil
}

func (s *DivisionService) GetByID(ctx context.Context, id int64) (*generated.Division, error) {
	div, err := s.queries.GetDivisionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get division: %w", err)
	}
	return &div, nil
}

func (s *DivisionService) GetBySlug(ctx context.Context, tournamentID int64, slug string) (*generated.Division, error) {
	div, err := s.queries.GetDivisionBySlug(ctx, generated.GetDivisionBySlugParams{
		TournamentID: tournamentID,
		Slug:         slug,
	})
	if err != nil {
		return nil, fmt.Errorf("get division by slug: %w", err)
	}
	return &div, nil
}

func (s *DivisionService) ListByTournament(ctx context.Context, tournamentID int64) ([]generated.Division, error) {
	divs, err := s.queries.ListDivisionsByTournament(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("list divisions: %w", err)
	}
	return divs, nil
}

func (s *DivisionService) Update(ctx context.Context, id int64, params generated.UpdateDivisionParams) (*generated.Division, error) {
	params.ID = id
	div, err := s.queries.UpdateDivision(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update division: %w", err)
	}
	return &div, nil
}

func (s *DivisionService) UpdateStatus(ctx context.Context, id int64, newStatus string) (*generated.Division, error) {
	div, err := s.queries.GetDivisionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get division: %w", err)
	}

	if !isValidDivisionStatusTransition(div.Status, newStatus) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", div.Status, newStatus)
	}

	updated, err := s.queries.UpdateDivision(ctx, generated.UpdateDivisionParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("update division status: %w", err)
	}
	return &updated, nil
}

func (s *DivisionService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteDivision(ctx, id)
}

// CreateFromTemplate creates a Division from a DivisionTemplate, used when creating
// a tournament within a league.
func (s *DivisionService) CreateFromTemplate(ctx context.Context, tournamentID int64, template generated.DivisionTemplate) (*generated.Division, error) {
	slug, err := s.generateUniqueSlug(ctx, tournamentID, template.Name)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}

	div, err := s.queries.CreateDivision(ctx, generated.CreateDivisionParams{
		TournamentID:      tournamentID,
		Name:              template.Name,
		Slug:              slug,
		Format:            template.Format,
		GenderRestriction: template.GenderRestriction,
		AgeRestriction:    template.AgeRestriction,
		SkillMin:          template.SkillMin,
		SkillMax:          template.SkillMax,
		RatingSystem:      template.RatingSystem,
		BracketFormat:     template.BracketFormat,
		ScoringFormat:     template.ScoringFormat,
		MaxTeams:          template.MaxTeams,
		MaxRosterSize:     template.MaxRosterSize,
		EntryFeeAmount:    template.EntryFeeAmount,
		EntryFeeCurrency:  template.EntryFeeCurrency,
		Status:            "draft",
		SeedMethod:        template.SeedMethod,
		SortOrder:         template.SortOrder,
		Notes:             template.Notes,
		AutoApprove:       template.AutoApprove,
		RegistrationMode:  template.RegistrationMode,
		AutoPromoteWaitlist: template.AutoPromoteWaitlist,
		GrandFinalsReset:  template.GrandFinalsReset,
		AdvancementCount:  template.AdvancementCount,
		AllowSelfCheckIn:  template.AllowSelfCheckIn,
		AllowRefPlayerAdd: template.AllowRefPlayerAdd,
		ReportToDupr:      template.ReportToDupr,
		ReportToVair:      template.ReportToVair,
	})
	if err != nil {
		return nil, fmt.Errorf("create division from template: %w", err)
	}
	return &div, nil
}

func isValidDivisionStatusTransition(from, to string) bool {
	transitions := map[string][]string{
		"draft":               {"registration_open"},
		"registration_open":   {"registration_closed"},
		"registration_closed": {"seeding"},
		"seeding":             {"in_progress"},
		"in_progress":         {"completed"},
		"completed":           {},
	}
	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *DivisionService) generateUniqueSlug(ctx context.Context, tournamentID int64, name string) (string, error) {
	base := generateSlug(name)
	slug := base

	for i := 1; ; i++ {
		exists, err := s.queries.SlugExistsDivision(ctx, generated.SlugExistsDivisionParams{
			TournamentID: tournamentID,
			Slug:         slug,
		})
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/service/division.go
git commit -m "feat: add division service with template support"
```

---

## Task 20: Registration Service

**Files:**
- Create: `backend/service/registration.go`

- [ ] **Step 1: Create the registration service**

```go
// backend/service/registration.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type RegistrationService struct {
	queries *generated.Queries
}

func NewRegistrationService(queries *generated.Queries) *RegistrationService {
	return &RegistrationService{queries: queries}
}

type RegisterInput struct {
	DivisionID        int64
	TeamID            *int64
	PlayerID          *int64
	RegistrationNotes *string
	SeekingPartner    bool
}

func (s *RegistrationService) Register(ctx context.Context, input RegisterInput, registeredByUserID int64) (*generated.Registration, error) {
	// Validate: at least one of team or player
	if input.TeamID == nil && input.PlayerID == nil {
		return nil, fmt.Errorf("either team_id or player_id must be provided")
	}

	// Get division to check registration rules
	div, err := s.queries.GetDivisionByID(ctx, input.DivisionID)
	if err != nil {
		return nil, fmt.Errorf("get division: %w", err)
	}

	// Check division accepts registrations
	if div.Status != "registration_open" && div.RegistrationMode != "invite_only" {
		return nil, fmt.Errorf("division is not accepting registrations (status: %s)", div.Status)
	}

	// Check capacity
	if div.MaxTeams != nil {
		count, err := s.queries.CountRegistrationsByDivisionAndStatus(ctx, generated.CountRegistrationsByDivisionAndStatusParams{
			DivisionID: input.DivisionID,
			Status:     "approved",
		})
		if err != nil {
			return nil, fmt.Errorf("count registrations: %w", err)
		}
		if int32(count) >= *div.MaxTeams {
			// Waitlist instead of reject
			return s.createRegistration(ctx, input, registeredByUserID, "waitlisted")
		}
	}

	// Determine initial status
	status := "pending"
	if div.AutoApprove {
		status = "approved"
	}

	return s.createRegistration(ctx, input, registeredByUserID, status)
}

func (s *RegistrationService) createRegistration(ctx context.Context, input RegisterInput, registeredByUserID int64, status string) (*generated.Registration, error) {
	reg, err := s.queries.CreateRegistration(ctx, generated.CreateRegistrationParams{
		DivisionID:        input.DivisionID,
		TeamID:            input.TeamID,
		PlayerID:          input.PlayerID,
		RegisteredByUserID: registeredByUserID,
		Status:            status,
		RegistrationNotes: input.RegistrationNotes,
		SeekingPartner:    input.SeekingPartner,
	})
	if err != nil {
		return nil, fmt.Errorf("create registration: %w", err)
	}
	return &reg, nil
}

func (s *RegistrationService) GetByID(ctx context.Context, id int64) (*generated.Registration, error) {
	reg, err := s.queries.GetRegistrationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get registration: %w", err)
	}
	return &reg, nil
}

func (s *RegistrationService) ListByDivision(ctx context.Context, divisionID int64, limit, offset int32) ([]generated.Registration, int64, error) {
	regs, err := s.queries.ListRegistrationsByDivision(ctx, generated.ListRegistrationsByDivisionParams{
		DivisionID: divisionID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list registrations: %w", err)
	}
	count, err := s.queries.CountRegistrationsByDivision(ctx, divisionID)
	if err != nil {
		return nil, 0, fmt.Errorf("count registrations: %w", err)
	}
	return regs, count, nil
}

func (s *RegistrationService) ListByDivisionAndStatus(ctx context.Context, divisionID int64, status string, limit, offset int32) ([]generated.Registration, int64, error) {
	regs, err := s.queries.ListRegistrationsByDivisionAndStatus(ctx, generated.ListRegistrationsByDivisionAndStatusParams{
		DivisionID: divisionID,
		Status:     status,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list registrations by status: %w", err)
	}
	count, err := s.queries.CountRegistrationsByDivisionAndStatus(ctx, generated.CountRegistrationsByDivisionAndStatusParams{
		DivisionID: divisionID,
		Status:     status,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("count registrations by status: %w", err)
	}
	return regs, count, nil
}

func (s *RegistrationService) UpdateStatus(ctx context.Context, id int64, newStatus string) (*generated.Registration, error) {
	reg, err := s.queries.UpdateRegistrationStatus(ctx, generated.UpdateRegistrationStatusParams{
		ID:     id,
		Status: newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("update registration status: %w", err)
	}

	// If someone withdrew and waitlist auto-promote is on, promote next
	if newStatus == "withdrawn" || newStatus == "rejected" {
		div, err := s.queries.GetDivisionByID(ctx, reg.DivisionID)
		if err == nil && div.AutoPromoteWaitlist {
			next, err := s.queries.GetNextWaitlisted(ctx, reg.DivisionID)
			if err == nil {
				s.queries.UpdateRegistrationStatus(ctx, generated.UpdateRegistrationStatusParams{
					ID:     next.ID,
					Status: "approved",
				})
			}
		}
	}

	return &reg, nil
}

func (s *RegistrationService) UpdateSeed(ctx context.Context, id int64, seed int32) (*generated.Registration, error) {
	reg, err := s.queries.UpdateRegistrationSeed(ctx, generated.UpdateRegistrationSeedParams{
		ID:   id,
		Seed: &seed,
	})
	if err != nil {
		return nil, fmt.Errorf("update seed: %w", err)
	}
	return &reg, nil
}

func (s *RegistrationService) UpdatePlacement(ctx context.Context, id int64, placement int32) (*generated.Registration, error) {
	reg, err := s.queries.UpdateRegistrationPlacement(ctx, generated.UpdateRegistrationPlacementParams{
		ID:             id,
		FinalPlacement: &placement,
	})
	if err != nil {
		return nil, fmt.Errorf("update placement: %w", err)
	}
	return &reg, nil
}

// BulkNoShow marks all non-checked-in registrations as no_show for a division.
// Called when TD starts a division.
func (s *RegistrationService) BulkNoShow(ctx context.Context, divisionID int64) error {
	return s.queries.BulkUpdateNoShow(ctx, divisionID)
}

func (s *RegistrationService) ListSeekingPartner(ctx context.Context, divisionID int64) ([]generated.Registration, error) {
	return s.queries.ListSeekingPartner(ctx, divisionID)
}

func (s *RegistrationService) CheckIn(ctx context.Context, id int64) (*generated.Registration, error) {
	return s.UpdateStatus(ctx, id, "checked_in")
}

func (s *RegistrationService) WithdrawMidTournament(ctx context.Context, id int64) (*generated.Registration, error) {
	return s.UpdateStatus(ctx, id, "withdrawn_mid_tournament")
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/service/registration.go
git commit -m "feat: add registration service with waitlist promotion"
```

---

## Task 21: Season, Pod, and Announcement Services

**Files:**
- Create: `backend/service/season.go`
- Create: `backend/service/pod.go`
- Create: `backend/service/announcement.go`

- [ ] **Step 1: Create the season service**

```go
// backend/service/season.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type SeasonService struct {
	queries *generated.Queries
}

func NewSeasonService(queries *generated.Queries) *SeasonService {
	return &SeasonService{queries: queries}
}

func (s *SeasonService) Create(ctx context.Context, params generated.CreateSeasonParams) (*generated.Season, error) {
	slug, err := s.generateUniqueSlug(ctx, params.LeagueID, params.Name)
	if err != nil {
		return nil, fmt.Errorf("generate slug: %w", err)
	}
	params.Slug = slug

	season, err := s.queries.CreateSeason(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create season: %w", err)
	}
	return &season, nil
}

func (s *SeasonService) GetByID(ctx context.Context, id int64) (*generated.Season, error) {
	season, err := s.queries.GetSeasonByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get season: %w", err)
	}
	return &season, nil
}

func (s *SeasonService) GetBySlug(ctx context.Context, leagueID int64, slug string) (*generated.Season, error) {
	season, err := s.queries.GetSeasonBySlug(ctx, generated.GetSeasonBySlugParams{
		LeagueID: leagueID,
		Slug:     slug,
	})
	if err != nil {
		return nil, fmt.Errorf("get season by slug: %w", err)
	}
	return &season, nil
}

func (s *SeasonService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]generated.Season, int64, error) {
	seasons, err := s.queries.ListSeasonsByLeague(ctx, generated.ListSeasonsByLeagueParams{
		LeagueID: leagueID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list seasons: %w", err)
	}
	count, err := s.queries.CountSeasonsByLeague(ctx, leagueID)
	if err != nil {
		return nil, 0, fmt.Errorf("count seasons: %w", err)
	}
	return seasons, count, nil
}

func (s *SeasonService) Update(ctx context.Context, id int64, params generated.UpdateSeasonParams) (*generated.Season, error) {
	params.ID = id
	season, err := s.queries.UpdateSeason(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update season: %w", err)
	}
	return &season, nil
}

func (s *SeasonService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteSeason(ctx, id)
}

func (s *SeasonService) UpdateStatus(ctx context.Context, id int64, newStatus string) (*generated.Season, error) {
	season, err := s.queries.GetSeasonByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get season: %w", err)
	}

	if !isValidSeasonStatusTransition(season.Status, newStatus) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", season.Status, newStatus)
	}

	updated, err := s.queries.UpdateSeason(ctx, generated.UpdateSeasonParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("update season status: %w", err)
	}
	return &updated, nil
}

func isValidSeasonStatusTransition(from, to string) bool {
	transitions := map[string][]string{
		"draft":     {"active"},
		"active":    {"completed"},
		"completed": {"archived"},
		"archived":  {},
	}
	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *SeasonService) generateUniqueSlug(ctx context.Context, leagueID int64, name string) (string, error) {
	base := generateSlug(name)
	slug := base

	for i := 1; ; i++ {
		exists, err := s.queries.SlugExistsSeason(ctx, generated.SlugExistsSeasonParams{
			LeagueID: leagueID,
			Slug:     slug,
		})
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
```

- [ ] **Step 2: Create the pod service**

```go
// backend/service/pod.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type PodService struct {
	queries *generated.Queries
}

func NewPodService(queries *generated.Queries) *PodService {
	return &PodService{queries: queries}
}

func (s *PodService) Create(ctx context.Context, divisionID int64, name string, sortOrder int32) (*generated.Pod, error) {
	pod, err := s.queries.CreatePod(ctx, generated.CreatePodParams{
		DivisionID: divisionID,
		Name:       name,
		SortOrder:  sortOrder,
	})
	if err != nil {
		return nil, fmt.Errorf("create pod: %w", err)
	}
	return &pod, nil
}

func (s *PodService) GetByID(ctx context.Context, id int64) (*generated.Pod, error) {
	pod, err := s.queries.GetPodByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get pod: %w", err)
	}
	return &pod, nil
}

func (s *PodService) ListByDivision(ctx context.Context, divisionID int64) ([]generated.Pod, error) {
	pods, err := s.queries.ListPodsByDivision(ctx, divisionID)
	if err != nil {
		return nil, fmt.Errorf("list pods: %w", err)
	}
	return pods, nil
}

func (s *PodService) Update(ctx context.Context, id int64, params generated.UpdatePodParams) (*generated.Pod, error) {
	params.ID = id
	pod, err := s.queries.UpdatePod(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update pod: %w", err)
	}
	return &pod, nil
}

func (s *PodService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeletePod(ctx, id)
}
```

- [ ] **Step 3: Create the announcement service**

```go
// backend/service/announcement.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

type AnnouncementService struct {
	queries *generated.Queries
}

func NewAnnouncementService(queries *generated.Queries) *AnnouncementService {
	return &AnnouncementService{queries: queries}
}

type CreateAnnouncementInput struct {
	TournamentID *int64
	LeagueID     *int64
	DivisionID   *int64
	Title        string
	Body         string
	IsPinned     bool
}

func (s *AnnouncementService) Create(ctx context.Context, input CreateAnnouncementInput, createdByUserID int64) (*generated.Announcement, error) {
	// Validate: at least one scope
	if input.TournamentID == nil && input.LeagueID == nil {
		return nil, fmt.Errorf("at least one of tournament_id or league_id must be set")
	}

	ann, err := s.queries.CreateAnnouncement(ctx, generated.CreateAnnouncementParams{
		TournamentID:   input.TournamentID,
		LeagueID:       input.LeagueID,
		DivisionID:     input.DivisionID,
		Title:          input.Title,
		Body:           input.Body,
		IsPinned:       input.IsPinned,
		CreatedByUserID: createdByUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("create announcement: %w", err)
	}
	return &ann, nil
}

func (s *AnnouncementService) GetByID(ctx context.Context, id int64) (*generated.Announcement, error) {
	ann, err := s.queries.GetAnnouncementByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get announcement: %w", err)
	}
	return &ann, nil
}

func (s *AnnouncementService) ListByTournament(ctx context.Context, tournamentID int64, limit, offset int32) ([]generated.Announcement, int64, error) {
	anns, err := s.queries.ListAnnouncementsByTournament(ctx, generated.ListAnnouncementsByTournamentParams{
		TournamentID: &tournamentID,
		Limit:        limit,
		Offset:       offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list announcements: %w", err)
	}
	count, err := s.queries.CountAnnouncementsByTournament(ctx, &tournamentID)
	if err != nil {
		return nil, 0, fmt.Errorf("count announcements: %w", err)
	}
	return anns, count, nil
}

func (s *AnnouncementService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]generated.Announcement, int64, error) {
	anns, err := s.queries.ListAnnouncementsByLeague(ctx, generated.ListAnnouncementsByLeagueParams{
		LeagueID: &leagueID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list announcements by league: %w", err)
	}
	count, err := s.queries.CountAnnouncementsByLeague(ctx, &leagueID)
	if err != nil {
		return nil, 0, fmt.Errorf("count announcements by league: %w", err)
	}
	return anns, count, nil
}

func (s *AnnouncementService) Update(ctx context.Context, id int64, params generated.UpdateAnnouncementParams) (*generated.Announcement, error) {
	params.ID = id
	ann, err := s.queries.UpdateAnnouncement(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update announcement: %w", err)
	}
	return &ann, nil
}

func (s *AnnouncementService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteAnnouncement(ctx, id)
}
```

- [ ] **Step 4: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add backend/service/season.go backend/service/pod.go backend/service/announcement.go
git commit -m "feat: add season, pod, and announcement services"
```

---

## Task 22: League HTTP Handler

**Files:**
- Create: `backend/handler/league.go`

- [ ] **Step 1: Create the league handler**

```go
// backend/handler/league.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type LeagueHandler struct {
	leagueSvc *service.LeagueService
}

func NewLeagueHandler(leagueSvc *service.LeagueService) *LeagueHandler {
	return &LeagueHandler{leagueSvc: leagueSvc}
}

func (h *LeagueHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.List)
	r.Get("/search", h.Search)
	r.Get("/{leagueID}", h.GetByID)
	r.Get("/slug/{slug}", h.GetBySlug)
	r.Get("/public-id/{publicID}", h.GetByPublicID)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Get("/mine", h.ListMine)
	})

	// League-owner routes (creator or league admin)
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Patch("/{leagueID}", h.Update)
		r.Delete("/{leagueID}", h.Delete)
		r.Post("/{leagueID}/status", h.UpdateStatus)
	})

	return r
}

func (h *LeagueHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	var input service.CreateLeagueInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if input.Name == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_NAME", "Name is required")
		return
	}

	league, err := h.leagueSvc.Create(r.Context(), input, user.ID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	RespondJSON(w, http.StatusCreated, league)
}

func (h *LeagueHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	league, err := h.leagueSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}

	RespondJSON(w, http.StatusOK, league)
}

func (h *LeagueHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	league, err := h.leagueSvc.GetBySlug(r.Context(), slug)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}
	RespondJSON(w, http.StatusOK, league)
}

func (h *LeagueHandler) GetByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")
	league, err := h.leagueSvc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}
	RespondJSON(w, http.StatusOK, league)
}

func (h *LeagueHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	leagues, total, err := h.leagueSvc.List(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, leagues, total, limit, offset)
}

func (h *LeagueHandler) Search(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("q")
	if term == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_QUERY", "Search query 'q' is required")
		return
	}
	limit, offset := parsePagination(r)
	leagues, total, err := h.leagueSvc.Search(r.Context(), term, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, leagues, total, limit, offset)
}

func (h *LeagueHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	limit, offset := parsePagination(r)
	leagues, total, err := h.leagueSvc.ListByCreator(r.Context(), user.ID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, leagues, total, limit, offset)
}

func (h *LeagueHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var params generated.UpdateLeagueParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	league, err := h.leagueSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, league)
}

func (h *LeagueHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	if err := h.leagueSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *LeagueHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	league, err := h.leagueSvc.UpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "STATUS_TRANSITION_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, league)
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler/league.go
git commit -m "feat: add league HTTP handler"
```

---

## Task 23: Tournament HTTP Handler

**Files:**
- Create: `backend/handler/tournament.go`

- [ ] **Step 1: Create the tournament handler**

```go
// backend/handler/tournament.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type TournamentHandler struct {
	tournamentSvc *service.TournamentService
	divisionSvc   *service.DivisionService
}

func NewTournamentHandler(tournamentSvc *service.TournamentService, divisionSvc *service.DivisionService) *TournamentHandler {
	return &TournamentHandler{
		tournamentSvc: tournamentSvc,
		divisionSvc:   divisionSvc,
	}
}

func (h *TournamentHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.List)
	r.Get("/search", h.Search)
	r.Get("/{tournamentID}", h.GetByID)
	r.Get("/slug/{slug}", h.GetBySlug)
	r.Get("/public-id/{publicID}", h.GetByPublicID)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Get("/mine", h.ListMine)
	})

	// TD routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Patch("/{tournamentID}", h.Update)
		r.Delete("/{tournamentID}", h.Delete)
		r.Post("/{tournamentID}/status", h.UpdateStatus)
		r.Post("/{tournamentID}/clone", h.Clone)
	})

	return r
}

func (h *TournamentHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	var input service.CreateTournamentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if input.Name == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_NAME", "Name is required")
		return
	}
	if input.StartDate == "" || input.EndDate == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_DATES", "Start and end dates are required")
		return
	}

	tournament, err := h.tournamentSvc.Create(r.Context(), input, user.ID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	// If tournament is within a league, clone division templates
	if input.LeagueID != nil {
		// Division template cloning is handled by the division service
		// The executing agent should wire DivisionTemplateService here
		// to fetch templates by league and call divisionSvc.CreateFromTemplate
	}

	RespondJSON(w, http.StatusCreated, tournament)
}

func (h *TournamentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}
	tournament, err := h.tournamentSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}
	RespondJSON(w, http.StatusOK, tournament)
}

func (h *TournamentHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	tournament, err := h.tournamentSvc.GetBySlug(r.Context(), slug)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}
	RespondJSON(w, http.StatusOK, tournament)
}

func (h *TournamentHandler) GetByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")
	tournament, err := h.tournamentSvc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}
	RespondJSON(w, http.StatusOK, tournament)
}

func (h *TournamentHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	// Optional filter by league
	if leagueIDStr := r.URL.Query().Get("league_id"); leagueIDStr != "" {
		leagueID, err := strconv.ParseInt(leagueIDStr, 10, 64)
		if err != nil {
			RespondError(w, http.StatusBadRequest, "INVALID_LEAGUE_ID", "Invalid league_id")
			return
		}
		tournaments, total, err := h.tournamentSvc.ListByLeague(r.Context(), leagueID, limit, offset)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
			return
		}
		RespondPaginated(w, http.StatusOK, tournaments, total, limit, offset)
		return
	}

	tournaments, total, err := h.tournamentSvc.List(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, tournaments, total, limit, offset)
}

func (h *TournamentHandler) Search(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("q")
	if term == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_QUERY", "Search query 'q' is required")
		return
	}
	limit, offset := parsePagination(r)
	tournaments, total, err := h.tournamentSvc.Search(r.Context(), term, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, tournaments, total, limit, offset)
}

func (h *TournamentHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	limit, offset := parsePagination(r)
	tournaments, total, err := h.tournamentSvc.ListByCreator(r.Context(), user.ID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, tournaments, total, limit, offset)
}

func (h *TournamentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var params generated.UpdateTournamentParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	tournament, err := h.tournamentSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, tournament)
}

func (h *TournamentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}
	if err := h.tournamentSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *TournamentHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		Status             string  `json:"status"`
		CancellationReason *string `json:"cancellation_reason,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	tournament, err := h.tournamentSvc.UpdateStatus(r.Context(), id, body.Status, body.CancellationReason)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "STATUS_TRANSITION_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, tournament)
}

func (h *TournamentHandler) Clone(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		Name                 string `json:"name"`
		StartDate            string `json:"start_date"`
		EndDate              string `json:"end_date"`
		IncludeRegistrations bool   `json:"include_registrations"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if body.Name == "" || body.StartDate == "" || body.EndDate == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_FIELDS", "name, start_date, end_date required")
		return
	}

	clone, err := h.tournamentSvc.Clone(r.Context(), id, body.Name, body.StartDate, body.EndDate, body.IncludeRegistrations, user.ID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CLONE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, clone)
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler/tournament.go
git commit -m "feat: add tournament HTTP handler with clone"
```

---

## Task 24: Division HTTP Handler

**Files:**
- Create: `backend/handler/division.go`

- [ ] **Step 1: Create the division handler**

Division routes are nested under tournaments: `/api/v1/tournaments/{tournamentID}/divisions/...`

```go
// backend/handler/division.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type DivisionHandler struct {
	divisionSvc *service.DivisionService
}

func NewDivisionHandler(divisionSvc *service.DivisionService) *DivisionHandler {
	return &DivisionHandler{divisionSvc: divisionSvc}
}

// Routes returns a chi.Router for division endpoints.
// These are mounted as sub-routes under /tournaments/{tournamentID}/divisions
func (h *DivisionHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByTournament)
	r.Get("/{divisionID}", h.GetByID)
	r.Get("/slug/{slug}", h.GetBySlug)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Patch("/{divisionID}", h.Update)
		r.Delete("/{divisionID}", h.Delete)
		r.Post("/{divisionID}/status", h.UpdateStatus)
	})

	return r
}

func (h *DivisionHandler) Create(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var params generated.CreateDivisionParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	params.TournamentID = tournamentID

	if params.Name == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_NAME", "Name is required")
		return
	}

	div, err := h.divisionSvc.Create(r.Context(), params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, div)
}

func (h *DivisionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}
	div, err := h.divisionSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Division not found")
		return
	}
	RespondJSON(w, http.StatusOK, div)
}

func (h *DivisionHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}
	slug := chi.URLParam(r, "slug")
	div, err := h.divisionSvc.GetBySlug(r.Context(), tournamentID, slug)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Division not found")
		return
	}
	RespondJSON(w, http.StatusOK, div)
}

func (h *DivisionHandler) ListByTournament(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}
	divs, err := h.divisionSvc.ListByTournament(r.Context(), tournamentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, divs)
}

func (h *DivisionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var params generated.UpdateDivisionParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	div, err := h.divisionSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, div)
}

func (h *DivisionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}
	if err := h.divisionSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *DivisionHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	div, err := h.divisionSvc.UpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "STATUS_TRANSITION_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, div)
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler/division.go
git commit -m "feat: add division HTTP handler"
```

---

## Task 25: Registration HTTP Handler

**Files:**
- Create: `backend/handler/registration.go`

Registration routes are nested under divisions: `/api/v1/divisions/{divisionID}/registrations/...`

- [ ] **Step 1: Create the registration handler**

```go
// backend/handler/registration.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type RegistrationHandler struct {
	registrationSvc *service.RegistrationService
}

func NewRegistrationHandler(registrationSvc *service.RegistrationService) *RegistrationHandler {
	return &RegistrationHandler{registrationSvc: registrationSvc}
}

// Routes returns a chi.Router for registration endpoints.
// Mounted under /divisions/{divisionID}/registrations
func (h *RegistrationHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByDivision)
	r.Get("/seeking-partner", h.ListSeekingPartner)
	r.Get("/{registrationID}", h.GetByID)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Register)
		r.Post("/{registrationID}/status", h.UpdateStatus)
		r.Patch("/{registrationID}/seed", h.UpdateSeed)
		r.Patch("/{registrationID}/placement", h.UpdatePlacement)
		r.Patch("/{registrationID}/admin-notes", h.UpdateAdminNotes)
		r.Post("/{registrationID}/check-in", h.CheckIn)
		r.Post("/{registrationID}/withdraw-mid", h.WithdrawMidTournament)
		r.Post("/bulk-no-show", h.BulkNoShow)
	})

	return r
}

func (h *RegistrationHandler) Register(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var input service.RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	input.DivisionID = divisionID

	reg, err := h.registrationSvc.Register(r.Context(), input, user.ID)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "REGISTER_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, reg)
}

func (h *RegistrationHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}
	reg, err := h.registrationSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Registration not found")
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	limit, offset := parsePagination(r)

	// Optional status filter
	statusFilter := r.URL.Query().Get("status")
	if statusFilter != "" {
		regs, total, err := h.registrationSvc.ListByDivisionAndStatus(r.Context(), divisionID, statusFilter, limit, offset)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
			return
		}
		RespondPaginated(w, http.StatusOK, regs, total, limit, offset)
		return
	}

	regs, total, err := h.registrationSvc.ListByDivision(r.Context(), divisionID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, regs, total, limit, offset)
}

func (h *RegistrationHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	reg, err := h.registrationSvc.UpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "STATUS_UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) UpdateSeed(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	var body struct {
		Seed int32 `json:"seed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	reg, err := h.registrationSvc.UpdateSeed(r.Context(), id, body.Seed)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "SEED_UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) UpdatePlacement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	var body struct {
		Placement int32 `json:"final_placement"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	reg, err := h.registrationSvc.UpdatePlacement(r.Context(), id, body.Placement)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "PLACEMENT_UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) UpdateAdminNotes(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	var body struct {
		AdminNotes string `json:"admin_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	reg, err := h.registrationSvc.queries.UpdateRegistrationAdminNotes(r.Context(), generated.UpdateRegistrationAdminNotesParams{
		ID:         id,
		AdminNotes: &body.AdminNotes,
	})
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}
	reg, err := h.registrationSvc.CheckIn(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CHECKIN_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) WithdrawMidTournament(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}
	reg, err := h.registrationSvc.WithdrawMidTournament(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "WITHDRAW_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, reg)
}

func (h *RegistrationHandler) BulkNoShow(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}
	if err := h.registrationSvc.BulkNoShow(r.Context(), divisionID); err != nil {
		RespondError(w, http.StatusInternalServerError, "BULK_NO_SHOW_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "done"})
}

func (h *RegistrationHandler) ListSeekingPartner(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}
	regs, err := h.registrationSvc.ListSeekingPartner(r.Context(), divisionID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, regs)
}
```

Note: The `UpdateAdminNotes` handler accesses `h.registrationSvc.queries` directly. The executing agent should add an `UpdateAdminNotes` method to the RegistrationService instead to maintain proper encapsulation.

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler/registration.go
git commit -m "feat: add registration HTTP handler"
```

---

## Task 26: Season, Pod, Announcement, LeagueRegistration, SeasonConfirmation Handlers

**Files:**
- Create: `backend/handler/season.go`
- Create: `backend/handler/pod.go`
- Create: `backend/handler/announcement.go`

- [ ] **Step 1: Create the season handler**

Season routes nested under leagues: `/api/v1/leagues/{leagueID}/seasons/...`

```go
// backend/handler/season.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type SeasonHandler struct {
	seasonSvc *service.SeasonService
}

func NewSeasonHandler(seasonSvc *service.SeasonService) *SeasonHandler {
	return &SeasonHandler{seasonSvc: seasonSvc}
}

func (h *SeasonHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByLeague)
	r.Get("/{seasonID}", h.GetByID)
	r.Get("/slug/{slug}", h.GetBySlug)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Patch("/{seasonID}", h.Update)
		r.Delete("/{seasonID}", h.Delete)
		r.Post("/{seasonID}/status", h.UpdateStatus)
	})

	return r
}

func (h *SeasonHandler) Create(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var params generated.CreateSeasonParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	params.LeagueID = leagueID

	if params.Name == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_NAME", "Name is required")
		return
	}

	season, err := h.seasonSvc.Create(r.Context(), params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, season)
}

func (h *SeasonHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}
	season, err := h.seasonSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Season not found")
		return
	}
	RespondJSON(w, http.StatusOK, season)
}

func (h *SeasonHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}
	slug := chi.URLParam(r, "slug")
	season, err := h.seasonSvc.GetBySlug(r.Context(), leagueID, slug)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Season not found")
		return
	}
	RespondJSON(w, http.StatusOK, season)
}

func (h *SeasonHandler) ListByLeague(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}
	limit, offset := parsePagination(r)
	seasons, total, err := h.seasonSvc.ListByLeague(r.Context(), leagueID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, seasons, total, limit, offset)
}

func (h *SeasonHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}
	var params generated.UpdateSeasonParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	season, err := h.seasonSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, season)
}

func (h *SeasonHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}
	if err := h.seasonSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *SeasonHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	season, err := h.seasonSvc.UpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "STATUS_TRANSITION_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, season)
}
```

- [ ] **Step 2: Create the pod handler**

Pod routes nested under divisions: `/api/v1/divisions/{divisionID}/pods/...`

```go
// backend/handler/pod.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type PodHandler struct {
	podSvc *service.PodService
}

func NewPodHandler(podSvc *service.PodService) *PodHandler {
	return &PodHandler{podSvc: podSvc}
}

func (h *PodHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByDivision)
	r.Get("/{podID}", h.GetByID)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Patch("/{podID}", h.Update)
		r.Delete("/{podID}", h.Delete)
	})

	return r
}

func (h *PodHandler) Create(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	var body struct {
		Name      string `json:"name"`
		SortOrder int32  `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	if body.Name == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_NAME", "Name is required")
		return
	}

	pod, err := h.podSvc.Create(r.Context(), divisionID, body.Name, body.SortOrder)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, pod)
}

func (h *PodHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}
	pod, err := h.podSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Pod not found")
		return
	}
	RespondJSON(w, http.StatusOK, pod)
}

func (h *PodHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}
	pods, err := h.podSvc.ListByDivision(r.Context(), divisionID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, pods)
}

func (h *PodHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}
	var params generated.UpdatePodParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	pod, err := h.podSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, pod)
}

func (h *PodHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "podID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid pod ID")
		return
	}
	if err := h.podSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

- [ ] **Step 3: Create the announcement handler**

```go
// backend/handler/announcement.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

type AnnouncementHandler struct {
	announcementSvc *service.AnnouncementService
}

func NewAnnouncementHandler(announcementSvc *service.AnnouncementService) *AnnouncementHandler {
	return &AnnouncementHandler{announcementSvc: announcementSvc}
}

// TournamentAnnouncementRoutes for mounting under /tournaments/{tournamentID}/announcements
func (h *AnnouncementHandler) TournamentAnnouncementRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByTournament)
	r.Get("/{announcementID}", h.GetByID)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.CreateForTournament)
		r.Patch("/{announcementID}", h.Update)
		r.Delete("/{announcementID}", h.Delete)
	})

	return r
}

// LeagueAnnouncementRoutes for mounting under /leagues/{leagueID}/announcements
func (h *AnnouncementHandler) LeagueAnnouncementRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByLeague)
	r.Get("/{announcementID}", h.GetByID)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.CreateForLeague)
		r.Patch("/{announcementID}", h.Update)
		r.Delete("/{announcementID}", h.Delete)
	})

	return r
}

func (h *AnnouncementHandler) CreateForTournament(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var input service.CreateAnnouncementInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	input.TournamentID = &tournamentID

	if input.Title == "" || input.Body == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_FIELDS", "Title and body are required")
		return
	}

	ann, err := h.announcementSvc.Create(r.Context(), input, user.ID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, ann)
}

func (h *AnnouncementHandler) CreateForLeague(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var input service.CreateAnnouncementInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	input.LeagueID = &leagueID

	if input.Title == "" || input.Body == "" {
		RespondError(w, http.StatusBadRequest, "MISSING_FIELDS", "Title and body are required")
		return
	}

	ann, err := h.announcementSvc.Create(r.Context(), input, user.ID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, ann)
}

func (h *AnnouncementHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}
	ann, err := h.announcementSvc.GetByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Announcement not found")
		return
	}
	RespondJSON(w, http.StatusOK, ann)
}

func (h *AnnouncementHandler) ListByTournament(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}
	limit, offset := parsePagination(r)
	anns, total, err := h.announcementSvc.ListByTournament(r.Context(), tournamentID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, anns, total, limit, offset)
}

func (h *AnnouncementHandler) ListByLeague(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}
	limit, offset := parsePagination(r)
	anns, total, err := h.announcementSvc.ListByLeague(r.Context(), leagueID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondPaginated(w, http.StatusOK, anns, total, limit, offset)
}

func (h *AnnouncementHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}
	var params generated.UpdateAnnouncementParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	ann, err := h.announcementSvc.Update(r.Context(), id, params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, ann)
}

func (h *AnnouncementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}
	if err := h.announcementSvc.Delete(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

- [ ] **Step 4: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add backend/handler/season.go backend/handler/pod.go backend/handler/announcement.go
git commit -m "feat: add season, pod, and announcement HTTP handlers"
```

---

## Task 27: Division Template Handler + League Registration Handler

**Files:**
- Create: `backend/handler/division_template.go`

Division template routes nested under leagues: `/api/v1/leagues/{leagueID}/division-templates/...`
League registration routes nested under leagues: `/api/v1/leagues/{leagueID}/registrations/...`

- [ ] **Step 1: Create division template handler**

```go
// backend/handler/division_template.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/go-chi/chi/v5"
)

type DivisionTemplateHandler struct {
	queries *generated.Queries
}

func NewDivisionTemplateHandler(queries *generated.Queries) *DivisionTemplateHandler {
	return &DivisionTemplateHandler{queries: queries}
}

func (h *DivisionTemplateHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByLeague)
	r.Get("/{templateID}", h.GetByID)

	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Post("/", h.Create)
		r.Patch("/{templateID}", h.Update)
		r.Delete("/{templateID}", h.Delete)
	})

	return r
}

func (h *DivisionTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var params generated.CreateDivisionTemplateParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	params.LeagueID = leagueID

	template, err := h.queries.CreateDivisionTemplate(r.Context(), params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusCreated, template)
}

func (h *DivisionTemplateHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
		return
	}
	template, err := h.queries.GetDivisionTemplateByID(r.Context(), id)
	if err != nil {
		RespondError(w, http.StatusNotFound, "NOT_FOUND", "Division template not found")
		return
	}
	RespondJSON(w, http.StatusOK, template)
}

func (h *DivisionTemplateHandler) ListByLeague(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}
	templates, err := h.queries.ListDivisionTemplatesByLeague(r.Context(), leagueID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, templates)
}

func (h *DivisionTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
		return
	}
	var params generated.UpdateDivisionTemplateParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}
	params.ID = id
	template, err := h.queries.UpdateDivisionTemplate(r.Context(), params)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, template)
}

func (h *DivisionTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
		return
	}
	if err := h.queries.SoftDeleteDivisionTemplate(r.Context(), id); err != nil {
		RespondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/handler/division_template.go
git commit -m "feat: add division template HTTP handler"
```

---

## Task 28: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Update router to mount all Phase 3 route groups**

Add the following route mounts inside the `/api/v1` group in `router.go`. The exact structure depends on what Phase 1 and Phase 2 established. The executing agent should follow the existing pattern.

New route groups to add:

```go
// Leagues
r.Mount("/leagues", leagueHandler.Routes())

// League sub-routes (nested)
r.Route("/leagues/{leagueID}", func(r chi.Router) {
    r.Mount("/seasons", seasonHandler.Routes())
    r.Mount("/division-templates", divisionTemplateHandler.Routes())
    r.Mount("/announcements", announcementHandler.LeagueAnnouncementRoutes())
    // League registrations (org registration into league)
    r.Mount("/registrations", leagueRegistrationRoutes(queries))
})

// Tournaments
r.Mount("/tournaments", tournamentHandler.Routes())

// Tournament sub-routes (nested)
r.Route("/tournaments/{tournamentID}", func(r chi.Router) {
    r.Mount("/divisions", divisionHandler.Routes())
    r.Mount("/announcements", announcementHandler.TournamentAnnouncementRoutes())
})

// Division sub-routes (nested)
r.Route("/divisions/{divisionID}", func(r chi.Router) {
    r.Mount("/registrations", registrationHandler.Routes())
    r.Mount("/pods", podHandler.Routes())
})
```

The executing agent needs to:
1. Create all service instances in `main.go` (LeagueService, SeasonService, TournamentService, DivisionService, PodService, RegistrationService, AnnouncementService)
2. Create all handler instances in `main.go`
3. Pass them to the router setup function
4. Wire league registration routes inline or as a small handler

For league registrations, create a simple inline route group or small handler since the entity is thin:

```go
func leagueRegistrationRoutes(queries *generated.Queries) chi.Router {
    r := chi.NewRouter()

    r.Get("/", func(w http.ResponseWriter, r *http.Request) {
        leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
        if err != nil {
            handler.RespondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
            return
        }
        limit, offset := handler.ParsePagination(r)
        regs, err := queries.ListLeagueRegistrationsByLeague(r.Context(), generated.ListLeagueRegistrationsByLeagueParams{
            LeagueID: leagueID,
            Limit:    limit,
            Offset:   offset,
        })
        if err != nil {
            handler.RespondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
            return
        }
        count, _ := queries.CountLeagueRegistrationsByLeague(r.Context(), leagueID)
        handler.RespondPaginated(w, http.StatusOK, regs, count, limit, offset)
    })

    // ... POST, PATCH for status, etc. following same pattern

    return r
}
```

- [ ] **Step 2: Update main.go to create services and handlers**

Add service and handler instantiation following the Phase 1/2 pattern. The exact code depends on how `main.go` currently wires things.

- [ ] **Step 3: Verify build**

```bash
cd backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire Phase 3 routes into router"
```

---

## Task 29: Integration Smoke Test

- [ ] **Step 1: Start the server**

```bash
docker compose up -d
cd backend && go run . migrate && go run .
```

- [ ] **Step 2: Register a test user and get session cookie**

```bash
curl -c cookies.txt -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"td@test.com","password":"Test1234!","first_name":"Test","last_name":"Director","date_of_birth":"1990-01-15"}'
```

Expected: 201 with user JSON, `cc_session` cookie saved.

- [ ] **Step 3: Create a league**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/leagues \
  -H "Content-Type: application/json" \
  -d '{"name":"Dallas Pickleball League","city":"Dallas","state_province":"TX","country":"US"}'
```

Expected: 201 with league JSON including auto-generated slug and public_id.

- [ ] **Step 4: Create a season under the league**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/leagues/1/seasons \
  -H "Content-Type: application/json" \
  -d '{"name":"Summer 2026","start_date":"2026-06-01","end_date":"2026-08-31"}'
```

Expected: 201 with season JSON.

- [ ] **Step 5: Create a tournament**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name":"Dallas Open 2026","start_date":"2026-07-15","end_date":"2026-07-17","league_id":1,"season_id":1}'
```

Expected: 201 with tournament JSON.

- [ ] **Step 6: Create a division under the tournament**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/tournaments/1/divisions \
  -H "Content-Type: application/json" \
  -d '{"name":"Mens Doubles 4.0+","format":"doubles","gender_restriction":"mens","bracket_format":"double_elimination","skill_min":4.0}'
```

Expected: 201 with division JSON.

- [ ] **Step 7: Create a registration in the division**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/divisions/1/registrations \
  -H "Content-Type: application/json" \
  -d '{"player_id":1}'
```

Expected: 201 with registration JSON (status should be "approved" since auto_approve defaults to true).

- [ ] **Step 8: Create an announcement**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/tournaments/1/announcements \
  -H "Content-Type: application/json" \
  -d '{"title":"Welcome!","body":"Tournament schedule posted.","is_pinned":true}'
```

Expected: 201 with announcement JSON.

- [ ] **Step 9: Clone the tournament**

```bash
curl -b cookies.txt -X POST http://localhost:8080/api/v1/tournaments/1/clone \
  -H "Content-Type: application/json" \
  -d '{"name":"Dallas Open Fall 2026","start_date":"2026-10-15","end_date":"2026-10-17","include_registrations":true}'
```

Expected: 201 with cloned tournament. Verify divisions were copied and registration was cloned.

- [ ] **Step 10: Verify the clone has divisions**

```bash
curl http://localhost:8080/api/v1/tournaments/2/divisions
```

Expected: 200 with array containing "Mens Doubles 4.0+" division.

- [ ] **Step 11: Clean up**

```bash
rm cookies.txt
```

---

## Task 30: Final Verification

- [ ] **Step 1: Run build**

```bash
cd backend && go build ./...
```

Expected: No errors.

- [ ] **Step 2: Run all tests**

```bash
cd backend && go test ./...
```

Expected: All tests pass (Phase 1 + Phase 2 tests still passing).

- [ ] **Step 3: Verify migration count**

```bash
ls backend/db/migrations/
```

Expected: 16 migration files (00001 through 00016).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 3 — tournaments, leagues, seasons, divisions, pods, registrations, announcements"
```

---

## API Endpoint Summary

### Leagues (7 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/leagues` | Create league (auth) |
| GET | `/api/v1/leagues` | List leagues (public) |
| GET | `/api/v1/leagues/search?q=` | Search leagues (public) |
| GET | `/api/v1/leagues/mine` | List my leagues (auth) |
| GET | `/api/v1/leagues/{id}` | Get by ID (public) |
| GET | `/api/v1/leagues/slug/{slug}` | Get by slug (public) |
| GET | `/api/v1/leagues/public-id/{publicID}` | Get by public ID (public) |
| PATCH | `/api/v1/leagues/{id}` | Update (auth) |
| DELETE | `/api/v1/leagues/{id}` | Soft delete (auth) |
| POST | `/api/v1/leagues/{id}/status` | Update status (auth) |

### Seasons (7 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/leagues/{leagueID}/seasons` | Create (auth) |
| GET | `/api/v1/leagues/{leagueID}/seasons` | List by league (public) |
| GET | `/api/v1/leagues/{leagueID}/seasons/{id}` | Get by ID (public) |
| GET | `/api/v1/leagues/{leagueID}/seasons/slug/{slug}` | Get by slug (public) |
| PATCH | `/api/v1/leagues/{leagueID}/seasons/{id}` | Update (auth) |
| DELETE | `/api/v1/leagues/{leagueID}/seasons/{id}` | Delete (auth) |
| POST | `/api/v1/leagues/{leagueID}/seasons/{id}/status` | Update status (auth) |

### Division Templates (5 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/leagues/{leagueID}/division-templates` | Create (auth) |
| GET | `/api/v1/leagues/{leagueID}/division-templates` | List (public) |
| GET | `/api/v1/leagues/{leagueID}/division-templates/{id}` | Get by ID (public) |
| PATCH | `/api/v1/leagues/{leagueID}/division-templates/{id}` | Update (auth) |
| DELETE | `/api/v1/leagues/{leagueID}/division-templates/{id}` | Delete (auth) |

### Tournaments (12 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/tournaments` | Create (auth) |
| GET | `/api/v1/tournaments` | List (public, optional `?league_id=` filter) |
| GET | `/api/v1/tournaments/search?q=` | Search (public) |
| GET | `/api/v1/tournaments/mine` | List my tournaments (auth) |
| GET | `/api/v1/tournaments/{id}` | Get by ID (public) |
| GET | `/api/v1/tournaments/slug/{slug}` | Get by slug (public) |
| GET | `/api/v1/tournaments/public-id/{publicID}` | Get by public ID (public) |
| PATCH | `/api/v1/tournaments/{id}` | Update (auth) |
| DELETE | `/api/v1/tournaments/{id}` | Soft delete (auth) |
| POST | `/api/v1/tournaments/{id}/status` | Update status (auth) |
| POST | `/api/v1/tournaments/{id}/clone` | Clone tournament (auth) |

### Divisions (7 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/tournaments/{tournamentID}/divisions` | Create (auth) |
| GET | `/api/v1/tournaments/{tournamentID}/divisions` | List (public) |
| GET | `/api/v1/tournaments/{tournamentID}/divisions/{id}` | Get by ID (public) |
| GET | `/api/v1/tournaments/{tournamentID}/divisions/slug/{slug}` | Get by slug (public) |
| PATCH | `/api/v1/tournaments/{tournamentID}/divisions/{id}` | Update (auth) |
| DELETE | `/api/v1/tournaments/{tournamentID}/divisions/{id}` | Delete (auth) |
| POST | `/api/v1/tournaments/{tournamentID}/divisions/{id}/status` | Update status (auth) |

### Pods (5 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/divisions/{divisionID}/pods` | Create (auth) |
| GET | `/api/v1/divisions/{divisionID}/pods` | List (public) |
| GET | `/api/v1/divisions/{divisionID}/pods/{id}` | Get by ID (public) |
| PATCH | `/api/v1/divisions/{divisionID}/pods/{id}` | Update (auth) |
| DELETE | `/api/v1/divisions/{divisionID}/pods/{id}` | Delete (auth) |

### Registrations (10 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/divisions/{divisionID}/registrations` | Register (auth) |
| GET | `/api/v1/divisions/{divisionID}/registrations` | List (public, optional `?status=` filter) |
| GET | `/api/v1/divisions/{divisionID}/registrations/seeking-partner` | List free agents (public) |
| GET | `/api/v1/divisions/{divisionID}/registrations/{id}` | Get by ID (public) |
| POST | `/api/v1/divisions/{divisionID}/registrations/{id}/status` | Update status (auth) |
| PATCH | `/api/v1/divisions/{divisionID}/registrations/{id}/seed` | Update seed (auth) |
| PATCH | `/api/v1/divisions/{divisionID}/registrations/{id}/placement` | Update placement (auth) |
| PATCH | `/api/v1/divisions/{divisionID}/registrations/{id}/admin-notes` | Update admin notes (auth) |
| POST | `/api/v1/divisions/{divisionID}/registrations/{id}/check-in` | Check in (auth) |
| POST | `/api/v1/divisions/{divisionID}/registrations/{id}/withdraw-mid` | Withdraw mid-tournament (auth) |
| POST | `/api/v1/divisions/{divisionID}/registrations/bulk-no-show` | Mark no-shows (auth) |

### Announcements (scoped to tournament or league)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/tournaments/{tournamentID}/announcements` | Create (auth) |
| GET | `/api/v1/tournaments/{tournamentID}/announcements` | List (public) |
| POST | `/api/v1/leagues/{leagueID}/announcements` | Create (auth) |
| GET | `/api/v1/leagues/{leagueID}/announcements` | List (public) |
| GET | `.../announcements/{id}` | Get by ID (public) |
| PATCH | `.../announcements/{id}` | Update (auth) |
| DELETE | `.../announcements/{id}` | Delete (auth) |

### League Registrations
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/leagues/{leagueID}/registrations` | Register org (auth) |
| GET | `/api/v1/leagues/{leagueID}/registrations` | List (public) |
| PATCH | `/api/v1/leagues/{leagueID}/registrations/{id}/status` | Update status (auth) |

**Total: ~65 new endpoints**
