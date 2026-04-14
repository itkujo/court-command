# Phase 5: Broadcast / Overlay System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend API for the broadcast overlay system: CourtOverlayConfig entity, SourceProfile entity for third-party API adapters, overlay data endpoint (canonical contract), webhook receiver, overlay token authentication, and overlay control panel API endpoints. This phase establishes the data layer and REST/WS APIs that a frontend overlay renderer consumes.

**Architecture:** Two new migrations create `court_overlay_configs` and `source_profiles`. The overlay subsystem lives in isolated Go packages (`backend/overlay/`) following the extraction-ready principle — it imports from core packages but nothing outside imports from it. A dedicated overlay handler serves the canonical match data contract for overlay rendering, the control panel API for Broadcast Operators, and a webhook receiver for third-party data sources. Overlay config changes are broadcast via the existing `overlay:{court_id}` WebSocket channel (Phase 4C).

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17, Redis 7

**Depends on:** Phase 1 (auth, middleware), Phase 2 (courts, teams), Phase 4A (matches), Phase 4C (WebSocket pub/sub)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 00021_create_court_overlay_configs.sql
│   │   └── 00022_create_source_profiles.sql
│   └── queries/
│       ├── court_overlay_configs.sql
│       └── source_profiles.sql
├── overlay/                              # Isolated overlay package (extraction-ready)
│   ├── contract.go                       # Canonical overlay data contract types
│   ├── resolver.go                       # Resolves canonical data from match/court/teams
│   ├── poller.go                         # Polls external APIs via Source Profiles
│   ├── webhook.go                        # Webhook receiver + validation
│   └── themes.go                         # Theme registry (hardcoded theme definitions)
├── handler/
│   ├── overlay.go                        # Overlay data + config + control panel endpoints
│   └── source_profile.go                 # Source Profile CRUD
├── service/
│   ├── overlay.go                        # Overlay config service
│   └── source_profile.go                 # Source Profile service
└── router/
    └── router.go                         # Modified: mount overlay routes
```

---

## Task 1: CourtOverlayConfig Migration

**Files:**
- Create: `backend/db/migrations/00021_create_court_overlay_configs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00021_create_court_overlay_configs.sql

-- +goose Up
CREATE TABLE court_overlay_configs (
    id              BIGSERIAL PRIMARY KEY,
    court_id        BIGINT NOT NULL UNIQUE REFERENCES courts(id) ON DELETE CASCADE,
    theme_id        TEXT NOT NULL DEFAULT 'classic',
    color_overrides JSONB NOT NULL DEFAULT '{}',
    elements        JSONB NOT NULL DEFAULT '{
        "scoreboard": {"visible": true, "auto_animate": true},
        "lower_third": {"visible": false, "auto_animate": true},
        "player_card": {"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
        "team_card": {"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
        "sponsor_bug": {"visible": false, "auto_animate": true, "rotation_seconds": 15, "logos": []},
        "tournament_bug": {"visible": true, "auto_animate": true},
        "coming_up_next": {"visible": false, "auto_animate": true},
        "match_result": {"visible": false, "auto_animate": true, "auto_show_delay_seconds": 5, "auto_dismiss_seconds": 30},
        "custom_text": {"visible": false, "auto_animate": true, "text": "", "auto_dismiss_seconds": 0},
        "bracket_snapshot": {"visible": false, "auto_animate": true},
        "pool_standings": {"visible": false, "auto_animate": true},
        "series_score": {"visible": false, "auto_animate": true}
    }',
    source_profile_id BIGINT,
    overlay_token     TEXT,
    show_branding     BOOLEAN NOT NULL DEFAULT true,
    match_result_delay_seconds INT NOT NULL DEFAULT 30,
    idle_display      TEXT NOT NULL DEFAULT 'court_name'
                      CHECK (idle_display IN ('court_name', 'branding', 'none')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_court_overlay_configs_court ON court_overlay_configs (court_id);
CREATE INDEX idx_court_overlay_configs_token ON court_overlay_configs (overlay_token) WHERE overlay_token IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS court_overlay_configs;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, `court_overlay_configs` table created.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00021_create_court_overlay_configs.sql
git commit -m "feat: add court_overlay_configs table migration"
```

---

## Task 2: SourceProfile Migration

**Files:**
- Create: `backend/db/migrations/00022_create_source_profiles.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00022_create_source_profiles.sql

-- +goose Up
CREATE TABLE source_profiles (
    id                    BIGSERIAL PRIMARY KEY,
    name                  TEXT NOT NULL,
    created_by_user_id    BIGINT NOT NULL REFERENCES users(id),
    source_type           TEXT NOT NULL DEFAULT 'court_command'
                          CHECK (source_type IN ('court_command', 'rest_api', 'webhook')),
    api_url               TEXT,
    webhook_secret        TEXT,
    auth_type             TEXT NOT NULL DEFAULT 'none'
                          CHECK (auth_type IN ('none', 'api_key', 'bearer', 'basic')),
    auth_config           JSONB NOT NULL DEFAULT '{}',
    poll_interval_seconds INT DEFAULT 5,
    field_mapping         JSONB NOT NULL DEFAULT '{}',
    is_active             BOOLEAN NOT NULL DEFAULT true,
    last_poll_at          TIMESTAMPTZ,
    last_poll_status      TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_source_profiles_user ON source_profiles (created_by_user_id);
CREATE INDEX idx_source_profiles_active ON source_profiles (is_active) WHERE is_active = true;

-- Add FK from court_overlay_configs to source_profiles
ALTER TABLE court_overlay_configs ADD CONSTRAINT fk_overlay_source_profile
    FOREIGN KEY (source_profile_id) REFERENCES source_profiles(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE court_overlay_configs DROP CONSTRAINT IF EXISTS fk_overlay_source_profile;
DROP TABLE IF EXISTS source_profiles;
```

- [ ] **Step 2: Run migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: Migration applied, `source_profiles` table created, FK added.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00022_create_source_profiles.sql
git commit -m "feat: add source_profiles table and FK from overlay configs"
```

---

## Task 3: CourtOverlayConfig Queries

**Files:**
- Create: `backend/db/queries/court_overlay_configs.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/court_overlay_configs.sql

-- name: CreateOverlayConfig :one
INSERT INTO court_overlay_configs (
    court_id, theme_id, color_overrides, elements,
    source_profile_id, overlay_token, show_branding,
    match_result_delay_seconds, idle_display
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetOverlayConfigByCourtID :one
SELECT * FROM court_overlay_configs WHERE court_id = $1;

-- name: GetOverlayConfigByToken :one
SELECT * FROM court_overlay_configs WHERE overlay_token = $1;

-- name: UpdateOverlayConfig :one
UPDATE court_overlay_configs
SET theme_id = $2,
    color_overrides = $3,
    elements = $4,
    source_profile_id = $5,
    show_branding = $6,
    match_result_delay_seconds = $7,
    idle_display = $8,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayTheme :one
UPDATE court_overlay_configs
SET theme_id = $2,
    color_overrides = $3,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayElements :one
UPDATE court_overlay_configs
SET elements = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlayToken :one
UPDATE court_overlay_configs
SET overlay_token = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: UpdateOverlaySourceProfile :one
UPDATE court_overlay_configs
SET source_profile_id = $2,
    updated_at = now()
WHERE court_id = $1
RETURNING *;

-- name: DeleteOverlayConfig :exec
DELETE FROM court_overlay_configs WHERE court_id = $1;

-- name: OverlayConfigExists :one
SELECT EXISTS(SELECT 1 FROM court_overlay_configs WHERE court_id = $1) AS exists;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/court_overlay_configs.sql backend/db/generated/
git commit -m "feat: add court overlay config sqlc queries"
```

---

## Task 4: SourceProfile Queries

**Files:**
- Create: `backend/db/queries/source_profiles.sql`

- [ ] **Step 1: Create the queries file**

```sql
-- backend/db/queries/source_profiles.sql

-- name: CreateSourceProfile :one
INSERT INTO source_profiles (
    name, created_by_user_id, source_type, api_url, webhook_secret,
    auth_type, auth_config, poll_interval_seconds, field_mapping
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetSourceProfileByID :one
SELECT * FROM source_profiles WHERE id = $1;

-- name: ListSourceProfilesByUser :many
SELECT * FROM source_profiles
WHERE created_by_user_id = $1
ORDER BY created_at DESC;

-- name: ListActiveSourceProfiles :many
SELECT * FROM source_profiles
WHERE is_active = true
ORDER BY name;

-- name: UpdateSourceProfile :one
UPDATE source_profiles
SET name = $2,
    source_type = $3,
    api_url = $4,
    webhook_secret = $5,
    auth_type = $6,
    auth_config = $7,
    poll_interval_seconds = $8,
    field_mapping = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateSourceProfilePollStatus :exec
UPDATE source_profiles
SET last_poll_at = now(),
    last_poll_status = $2,
    updated_at = now()
WHERE id = $1;

-- name: DeactivateSourceProfile :one
UPDATE source_profiles
SET is_active = false, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteSourceProfile :exec
DELETE FROM source_profiles WHERE id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/db/queries/source_profiles.sql backend/db/generated/
git commit -m "feat: add source profile sqlc queries"
```

---

## Task 5: Canonical Overlay Data Contract

**Files:**
- Create: `backend/overlay/contract.go`

- [ ] **Step 1: Create the contract types**

```go
// backend/overlay/contract.go
package overlay

// OverlayData is the canonical data contract that all overlay renderers consume.
// Whether data comes from Court Command's own match system or a third-party API,
// it gets normalized into this structure before reaching the overlay.
type OverlayData struct {
	MatchStatus         string           `json:"match_status"`          // scheduled, in_progress, completed, bye, forfeit, cancelled, idle
	Team1               OverlayTeamData  `json:"team_1"`
	Team2               OverlayTeamData  `json:"team_2"`
	ServingTeam         int              `json:"serving_team"`          // 1 or 2
	ServerNumber        int              `json:"server_number"`         // 1 or 2
	CurrentGame         int              `json:"current_game"`
	CompletedGames      []GameResult     `json:"completed_games"`
	TimeoutsRemaining1  int              `json:"timeouts_remaining_1"`
	TimeoutsRemaining2  int              `json:"timeouts_remaining_2"`
	DivisionName        string           `json:"division_name"`
	TournamentName      string           `json:"tournament_name"`
	LeagueName          string           `json:"league_name"`
	RoundLabel          string           `json:"round_label"`
	MatchInfo           string           `json:"match_info"`
	SponsorLogos        []SponsorLogo    `json:"sponsor_logos"`
	TournamentLogoURL   string           `json:"tournament_logo_url"`
	LeagueLogoURL       string           `json:"league_logo_url"`
	IsPaused            bool             `json:"is_paused"`
	SeriesScore         *SeriesScoreData `json:"series_score,omitempty"` // Only set for series matches
	NextMatch           *NextMatchData   `json:"next_match,omitempty"`   // From court queue
	CourtName           string           `json:"court_name"`
}

// OverlayTeamData represents one team's data for overlay rendering.
type OverlayTeamData struct {
	Name      string        `json:"name"`
	ShortName string        `json:"short_name"`
	Score     int           `json:"score"`
	Color     string        `json:"color"`      // hex, e.g. "#3b82f6"
	LogoURL   string        `json:"logo_url"`
	Players   []PlayerBrief `json:"players"`
	GameWins  int           `json:"game_wins"`
}

// PlayerBrief is minimal player info for overlay display.
type PlayerBrief struct {
	Name string `json:"name"`
}

// GameResult holds per-game scores.
type GameResult struct {
	GameNum     int `json:"game_num"`
	ScoreTeam1  int `json:"score_team_1"`
	ScoreTeam2  int `json:"score_team_2"`
	Winner      int `json:"winner"` // 1 or 2
}

// SponsorLogo represents a sponsor for overlay display.
type SponsorLogo struct {
	Name    string `json:"name"`
	LogoURL string `json:"logo_url"`
	LinkURL string `json:"link_url"`
	Tier    string `json:"tier"`
}

// SeriesScoreData is the MLP-style series tally.
type SeriesScoreData struct {
	Team1Wins int `json:"team_1_wins"`
	Team2Wins int `json:"team_2_wins"`
	BestOf    int `json:"best_of"`
}

// NextMatchData is the "coming up next" info from the court queue.
type NextMatchData struct {
	Team1Name    string `json:"team_1_name"`
	Team2Name    string `json:"team_2_name"`
	DivisionName string `json:"division_name"`
	RoundLabel   string `json:"round_label"`
}

// DemoData returns a hardcoded sample OverlayData for preview rendering
// when no live match is active.
func DemoData() OverlayData {
	return OverlayData{
		MatchStatus: "in_progress",
		Team1: OverlayTeamData{
			Name:      "Fire Aces",
			ShortName: "FIRE",
			Score:     7,
			Color:     "#dc2626",
			LogoURL:   "",
			Players:   []PlayerBrief{{Name: "Alex Johnson"}, {Name: "Sam Rivera"}},
			GameWins:  1,
		},
		Team2: OverlayTeamData{
			Name:      "Thunder Smash",
			ShortName: "THDR",
			Score:     5,
			Color:     "#2563eb",
			LogoURL:   "",
			Players:   []PlayerBrief{{Name: "Jordan Lee"}, {Name: "Casey Morgan"}},
			GameWins:  0,
		},
		ServingTeam:        1,
		ServerNumber:       2,
		CurrentGame:        2,
		CompletedGames:     []GameResult{{GameNum: 1, ScoreTeam1: 11, ScoreTeam2: 9, Winner: 1}},
		TimeoutsRemaining1: 1,
		TimeoutsRemaining2: 2,
		DivisionName:       "Open Doubles",
		TournamentName:     "Summer Slam 2026",
		LeagueName:         "Metro Pickleball League",
		RoundLabel:         "Semifinal",
		MatchInfo:          "Court 3 · Best of 3",
		SponsorLogos:       []SponsorLogo{{Name: "JOOLA", LogoURL: "", Tier: "title"}},
		TournamentLogoURL:  "",
		LeagueLogoURL:      "",
		IsPaused:           false,
		CourtName:          "Court 3",
	}
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/overlay/contract.go
git commit -m "feat: add canonical overlay data contract and demo data"
```

---

## Task 6: Theme Registry

**Files:**
- Create: `backend/overlay/themes.go`

- [ ] **Step 1: Create the theme registry**

```go
// backend/overlay/themes.go
package overlay

// Theme defines a curated overlay visual theme.
type Theme struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Defaults    ThemeDefaults     `json:"defaults"`
}

// ThemeDefaults holds the default CSS custom property values for a theme.
type ThemeDefaults struct {
	Primary        string `json:"primary"`         // --primary
	Secondary      string `json:"secondary"`       // --secondary
	Accent         string `json:"accent"`          // --accent
	Background     string `json:"background"`      // --bg
	Text           string `json:"text"`            // --text
	FontFamily     string `json:"font_family"`     // --font-family
	BorderRadius   string `json:"border_radius"`   // --radius
	AnimationStyle string `json:"animation_style"` // slide, fade, scale, none
}

// AllThemes is the registry of available themes.
var AllThemes = []Theme{
	{
		ID:          "classic",
		Name:        "Classic",
		Description: "Traditional broadcast look with clean lines and solid backgrounds",
		Defaults: ThemeDefaults{
			Primary:        "#1e3a5f",
			Secondary:      "#ffffff",
			Accent:         "#e63946",
			Background:     "#0a0a0a",
			Text:           "#ffffff",
			FontFamily:     "'Inter', sans-serif",
			BorderRadius:   "4px",
			AnimationStyle: "slide",
		},
	},
	{
		ID:          "modern",
		Name:        "Modern",
		Description: "Contemporary design with rounded corners and soft shadows",
		Defaults: ThemeDefaults{
			Primary:        "#3b82f6",
			Secondary:      "#f8fafc",
			Accent:         "#f59e0b",
			Background:     "#111827",
			Text:           "#f9fafb",
			FontFamily:     "'Plus Jakarta Sans', sans-serif",
			BorderRadius:   "12px",
			AnimationStyle: "fade",
		},
	},
	{
		ID:          "minimal",
		Name:        "Minimal",
		Description: "Clean, understated design with maximum readability",
		Defaults: ThemeDefaults{
			Primary:        "#18181b",
			Secondary:      "#fafafa",
			Accent:         "#22c55e",
			Background:     "transparent",
			Text:           "#ffffff",
			FontFamily:     "'Geist', sans-serif",
			BorderRadius:   "2px",
			AnimationStyle: "fade",
		},
	},
	{
		ID:          "bold",
		Name:        "Bold",
		Description: "High-contrast design with strong colors and thick borders",
		Defaults: ThemeDefaults{
			Primary:        "#dc2626",
			Secondary:      "#fef2f2",
			Accent:         "#facc15",
			Background:     "#000000",
			Text:           "#ffffff",
			FontFamily:     "'Oswald', sans-serif",
			BorderRadius:   "0px",
			AnimationStyle: "scale",
		},
	},
	{
		ID:          "dark",
		Name:        "Dark",
		Description: "Sleek dark theme optimized for OBS chroma-free overlays",
		Defaults: ThemeDefaults{
			Primary:        "#6366f1",
			Secondary:      "#1e1b4b",
			Accent:         "#818cf8",
			Background:     "rgba(0,0,0,0.85)",
			Text:           "#e2e8f0",
			FontFamily:     "'JetBrains Mono', monospace",
			BorderRadius:   "8px",
			AnimationStyle: "slide",
		},
	},
	{
		ID:          "broadcast_pro",
		Name:        "Broadcast Pro",
		Description: "Professional TV broadcast style with gradient accents",
		Defaults: ThemeDefaults{
			Primary:        "#0f172a",
			Secondary:      "#f1f5f9",
			Accent:         "#0ea5e9",
			Background:     "#020617",
			Text:           "#ffffff",
			FontFamily:     "'Roboto Condensed', sans-serif",
			BorderRadius:   "6px",
			AnimationStyle: "slide",
		},
	},
}

// GetTheme returns a theme by ID, or the classic theme if not found.
func GetTheme(id string) Theme {
	for _, t := range AllThemes {
		if t.ID == id {
			return t
		}
	}
	return AllThemes[0] // classic as fallback
}

// ListThemeIDs returns all available theme IDs.
func ListThemeIDs() []string {
	ids := make([]string, len(AllThemes))
	for i, t := range AllThemes {
		ids[i] = t.ID
	}
	return ids
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/overlay/themes.go
git commit -m "feat: add overlay theme registry with 6 curated themes"
```

---

## Task 7: Overlay Data Resolver

**Files:**
- Create: `backend/overlay/resolver.go`

- [ ] **Step 1: Create the resolver**

The resolver transforms internal Court Command data (match, teams, court, division, tournament, league) into the canonical OverlayData contract.

```go
// backend/overlay/resolver.go
package overlay

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
)

// Resolver transforms internal data into the canonical OverlayData contract.
type Resolver struct {
	queries *generated.Queries
}

// NewResolver creates a new Resolver.
func NewResolver(queries *generated.Queries) *Resolver {
	return &Resolver{queries: queries}
}

// ResolveFromMatch builds OverlayData from a Match and its related entities.
func (r *Resolver) ResolveFromMatch(ctx context.Context, match generated.Match) (OverlayData, error) {
	data := OverlayData{
		MatchStatus:  match.Status,
		ServingTeam:  int(match.ServingTeam),
		ServerNumber: int(match.ServerNumber),
		CurrentGame:  int(match.CurrentGameNum),
		IsPaused:     match.IsPaused,
	}

	// Parse completed games
	if len(match.CompletedGames) > 0 {
		var games []GameResult
		if err := json.Unmarshal(match.CompletedGames, &games); err == nil {
			data.CompletedGames = games
		}
	}
	if data.CompletedGames == nil {
		data.CompletedGames = []GameResult{}
	}

	// Parse scoring config for timeouts
	if len(match.ScoringConfig) > 0 {
		var config struct {
			TimeoutsPerGame int `json:"timeouts_per_game"`
		}
		if err := json.Unmarshal(match.ScoringConfig, &config); err == nil {
			// Default timeouts — actual remaining would need event tracking
			data.TimeoutsRemaining1 = config.TimeoutsPerGame
			data.TimeoutsRemaining2 = config.TimeoutsPerGame
		}
	}

	// Resolve team 1
	if match.Team1ID.Valid {
		team, err := r.queries.GetTeamByID(ctx, match.Team1ID.Int64)
		if err == nil {
			data.Team1 = r.teamToOverlay(team, int(match.Team1Score))
			data.Team1.GameWins = r.countGameWins(data.CompletedGames, 1)
		}
	}

	// Resolve team 2
	if match.Team2ID.Valid {
		team, err := r.queries.GetTeamByID(ctx, match.Team2ID.Int64)
		if err == nil {
			data.Team2 = r.teamToOverlay(team, int(match.Team2Score))
			data.Team2.GameWins = r.countGameWins(data.CompletedGames, 2)
		}
	}

	// Resolve division → tournament → league chain
	if match.DivisionID.Valid {
		div, err := r.queries.GetDivisionByID(ctx, match.DivisionID.Int64)
		if err == nil {
			data.DivisionName = div.Name
			data.RoundLabel = fmt.Sprintf("Round %d", match.Round)

			// Get tournament
			tournament, err := r.queries.GetTournamentByID(ctx, div.TournamentID)
			if err == nil {
				data.TournamentName = tournament.Name
				if tournament.LogoUrl.Valid {
					data.TournamentLogoURL = tournament.LogoUrl.String
				}

				// Parse sponsor info
				if len(tournament.SponsorInfo) > 0 {
					var sponsors []SponsorLogo
					if err := json.Unmarshal(tournament.SponsorInfo, &sponsors); err == nil {
						data.SponsorLogos = sponsors
					}
				}

				// Get league if present
				if tournament.LeagueID.Valid {
					league, err := r.queries.GetLeagueByID(ctx, tournament.LeagueID.Int64)
					if err == nil {
						data.LeagueName = league.Name
						if league.LogoUrl.Valid {
							data.LeagueLogoURL = league.LogoUrl.String
						}
					}
				}
			}
		}
	}

	if data.SponsorLogos == nil {
		data.SponsorLogos = []SponsorLogo{}
	}

	// Resolve court name
	if match.CourtID.Valid {
		court, err := r.queries.GetCourtByID(ctx, match.CourtID.Int64)
		if err == nil {
			data.CourtName = court.Name
		}
	}

	// Resolve match info
	data.MatchInfo = r.buildMatchInfo(match)

	// Resolve series score if this is a series match
	if match.MatchSeriesID.Valid {
		series, err := r.queries.GetMatchSeriesByID(ctx, match.MatchSeriesID.Int64)
		if err == nil {
			var config SeriesConfig
			if err := json.Unmarshal(series.SeriesConfig, &config); err == nil {
				data.SeriesScore = &SeriesScoreData{
					Team1Wins: int(series.SeriesScoreTeam1),
					Team2Wins: int(series.SeriesScoreTeam2),
					BestOf:    config.BestOf,
				}
			}
		}
	}

	return data, nil
}

// ResolveIdle returns overlay data for when no match is active.
func (r *Resolver) ResolveIdle(ctx context.Context, courtID int64) OverlayData {
	data := OverlayData{
		MatchStatus:    "idle",
		CompletedGames: []GameResult{},
		SponsorLogos:   []SponsorLogo{},
	}

	court, err := r.queries.GetCourtByID(ctx, courtID)
	if err == nil {
		data.CourtName = court.Name
	}

	return data
}

func (r *Resolver) teamToOverlay(team generated.Team, score int) OverlayTeamData {
	t := OverlayTeamData{
		Name:      team.Name,
		Score:     score,
		Players:   []PlayerBrief{},
	}
	if team.ShortName.Valid {
		t.ShortName = team.ShortName.String
	}
	if team.PrimaryColor.Valid {
		t.Color = team.PrimaryColor.String
	}
	if team.LogoUrl.Valid {
		t.LogoURL = team.LogoUrl.String
	}

	// Load roster players
	roster, err := r.queries.GetTeamRoster(ctx, team.ID)
	if err == nil {
		for _, member := range roster {
			user, err := r.queries.GetUserByID(ctx, member.PlayerID)
			if err == nil {
				name := user.FirstName + " " + user.LastName
				if user.DisplayName.Valid {
					name = user.DisplayName.String
				}
				t.Players = append(t.Players, PlayerBrief{Name: name})
			}
		}
	}

	return t
}

func (r *Resolver) countGameWins(games []GameResult, team int) int {
	wins := 0
	for _, g := range games {
		if g.Winner == team {
			wins++
		}
	}
	return wins
}

func (r *Resolver) buildMatchInfo(match generated.Match) string {
	var config struct {
		BestOf int `json:"best_of"`
	}
	if err := json.Unmarshal(match.ScoringConfig, &config); err == nil && config.BestOf > 1 {
		return fmt.Sprintf("Best of %d", config.BestOf)
	}
	return ""
}
```

**Note for executing agent:** The `teamToOverlay` method references `ctx` which is not a parameter. The executing agent should add `ctx context.Context` as a parameter to `teamToOverlay` and update the call sites in `ResolveFromMatch` to pass `ctx`. Also, `GetTeamRoster` and `GetUserByID` query names may differ from Phase 2 — the executing agent should check the actual generated query names and adjust.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors (after fixing the ctx issue noted above).

- [ ] **Step 3: Commit**

```bash
git add backend/overlay/resolver.go
git commit -m "feat: add overlay data resolver for canonical contract"
```

---

## Task 8: Overlay Service

**Files:**
- Create: `backend/service/overlay.go`

- [ ] **Step 1: Create the overlay service**

```go
// backend/service/overlay.go
package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/court-command/court-command/backend/overlay"
	"github.com/court-command/court-command/backend/pubsub"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OverlayService manages overlay configurations.
type OverlayService struct {
	pool     *pgxpool.Pool
	queries  *generated.Queries
	resolver *overlay.Resolver
	ps       *pubsub.PubSub
}

// NewOverlayService creates a new OverlayService.
func NewOverlayService(pool *pgxpool.Pool, queries *generated.Queries, resolver *overlay.Resolver, ps *pubsub.PubSub) *OverlayService {
	return &OverlayService{pool: pool, queries: queries, resolver: resolver, ps: ps}
}

// GetOrCreateConfig returns the overlay config for a court, creating a default one if it doesn't exist.
func (s *OverlayService) GetOrCreateConfig(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.GetOverlayConfigByCourtID(ctx, courtID)
	if err == nil {
		return config, nil
	}

	// Create default config
	defaultElements, _ := json.Marshal(map[string]interface{}{
		"scoreboard":      map[string]interface{}{"visible": true, "auto_animate": true},
		"lower_third":     map[string]interface{}{"visible": false, "auto_animate": true},
		"player_card":     map[string]interface{}{"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
		"team_card":       map[string]interface{}{"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
		"sponsor_bug":     map[string]interface{}{"visible": false, "auto_animate": true, "rotation_seconds": 15, "logos": []interface{}{}},
		"tournament_bug":  map[string]interface{}{"visible": true, "auto_animate": true},
		"coming_up_next":  map[string]interface{}{"visible": false, "auto_animate": true},
		"match_result":    map[string]interface{}{"visible": false, "auto_animate": true, "auto_show_delay_seconds": 5, "auto_dismiss_seconds": 30},
		"custom_text":     map[string]interface{}{"visible": false, "auto_animate": true, "text": "", "auto_dismiss_seconds": 0},
		"bracket_snapshot": map[string]interface{}{"visible": false, "auto_animate": true},
		"pool_standings":  map[string]interface{}{"visible": false, "auto_animate": true},
		"series_score":    map[string]interface{}{"visible": false, "auto_animate": true},
	})

	config, err = s.queries.CreateOverlayConfig(ctx, generated.CreateOverlayConfigParams{
		CourtID:                  courtID,
		ThemeID:                  "classic",
		ColorOverrides:           []byte("{}"),
		Elements:                 defaultElements,
		ShowBranding:             true,
		MatchResultDelaySeconds:  30,
		IdleDisplay:              "court_name",
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("create default overlay config: %w", err)
	}

	return config, nil
}

// UpdateTheme updates the theme and color overrides for a court's overlay.
func (s *OverlayService) UpdateTheme(ctx context.Context, courtID int64, themeID string, colorOverrides json.RawMessage) (generated.CourtOverlayConfig, error) {
	// Validate theme exists
	_ = overlay.GetTheme(themeID) // returns classic as fallback, which is fine

	if colorOverrides == nil {
		colorOverrides = []byte("{}")
	}

	config, err := s.queries.UpdateOverlayTheme(ctx, generated.UpdateOverlayThemeParams{
		CourtID:        courtID,
		ThemeID:        themeID,
		ColorOverrides: colorOverrides,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update theme: %w", err)
	}

	// Broadcast config change
	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// UpdateElements updates the element visibility/settings for a court's overlay.
func (s *OverlayService) UpdateElements(ctx context.Context, courtID int64, elements json.RawMessage) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.UpdateOverlayElements(ctx, generated.UpdateOverlayElementsParams{
		CourtID:  courtID,
		Elements: elements,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update elements: %w", err)
	}

	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// GenerateToken generates a new overlay access token for a court.
func (s *OverlayService) GenerateToken(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	token, err := generateSecureToken()
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("generate token: %w", err)
	}

	config, err := s.queries.UpdateOverlayToken(ctx, generated.UpdateOverlayTokenParams{
		CourtID:      courtID,
		OverlayToken: pgtype.Text{String: token, Valid: true},
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update token: %w", err)
	}

	return config, nil
}

// RevokeToken removes the overlay access token for a court (makes overlay fully public).
func (s *OverlayService) RevokeToken(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.UpdateOverlayToken(ctx, generated.UpdateOverlayTokenParams{
		CourtID:      courtID,
		OverlayToken: pgtype.Text{Valid: false},
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("revoke token: %w", err)
	}

	return config, nil
}

// ValidateToken checks if the provided token matches the court's overlay token.
// Returns nil if valid, error if invalid. If no token is set on the config, any access is allowed.
func (s *OverlayService) ValidateToken(ctx context.Context, courtID int64, token string) error {
	config, err := s.queries.GetOverlayConfigByCourtID(ctx, courtID)
	if err != nil {
		return errors.New("overlay config not found")
	}

	// If no token set, overlay is public
	if !config.OverlayToken.Valid {
		return nil
	}

	// Token required but not provided
	if token == "" {
		return errors.New("overlay token required")
	}

	// Compare
	if config.OverlayToken.String != token {
		return errors.New("invalid overlay token")
	}

	return nil
}

// SetSourceProfile links a source profile to a court's overlay config.
func (s *OverlayService) SetSourceProfile(ctx context.Context, courtID int64, sourceProfileID *int64) (generated.CourtOverlayConfig, error) {
	var spID pgtype.Int8
	if sourceProfileID != nil {
		spID = pgtype.Int8{Int64: *sourceProfileID, Valid: true}
	}

	config, err := s.queries.UpdateOverlaySourceProfile(ctx, generated.UpdateOverlaySourceProfileParams{
		CourtID:         courtID,
		SourceProfileID: spID,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("set source profile: %w", err)
	}

	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// GetOverlayData returns the canonical overlay data for a court.
// If the court has an active match, resolves from match data.
// Otherwise returns idle data or demo data.
func (s *OverlayService) GetOverlayData(ctx context.Context, courtID int64, useDemoData bool) (overlay.OverlayData, error) {
	// Check for active match on this court
	matches, err := s.queries.ListMatchesByCourt(ctx, generated.ListMatchesByCourtParams{
		CourtID: pgtype.Int8{Int64: courtID, Valid: true},
		Status:  "in_progress",
	})
	if err == nil && len(matches) > 0 {
		return s.resolver.ResolveFromMatch(ctx, matches[0])
	}

	// No active match
	if useDemoData {
		return overlay.DemoData(), nil
	}

	return s.resolver.ResolveIdle(ctx, courtID), nil
}

func (s *OverlayService) broadcastConfigChange(ctx context.Context, courtID int64, config generated.CourtOverlayConfig) {
	if s.ps == nil {
		return
	}
	channel := fmt.Sprintf("overlay:%d", courtID)
	data, _ := json.Marshal(map[string]interface{}{
		"type":    "config_update",
		"channel": channel,
		"data":    config,
	})
	_ = s.ps.Publish(ctx, channel, data)
}

func generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
```

**Note for executing agent:** The `ListMatchesByCourt` query with status filter may not exist exactly as called. The executing agent should check the Phase 4A queries for the correct query name and parameters, or add a new query if needed.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/overlay.go
git commit -m "feat: add OverlayService with config management, token auth, and data resolution"
```

---

## Task 9: SourceProfile Service

**Files:**
- Create: `backend/service/source_profile.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/source_profile.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/backend/db/generated"
)

// SourceProfileService handles Source Profile CRUD.
type SourceProfileService struct {
	queries *generated.Queries
}

// NewSourceProfileService creates a new SourceProfileService.
func NewSourceProfileService(queries *generated.Queries) *SourceProfileService {
	return &SourceProfileService{queries: queries}
}

// Create creates a new Source Profile.
func (s *SourceProfileService) Create(ctx context.Context, params generated.CreateSourceProfileParams) (generated.SourceProfile, error) {
	return s.queries.CreateSourceProfile(ctx, params)
}

// GetByID returns a Source Profile by ID.
func (s *SourceProfileService) GetByID(ctx context.Context, id int64) (generated.SourceProfile, error) {
	return s.queries.GetSourceProfileByID(ctx, id)
}

// ListByUser returns all Source Profiles created by a user.
func (s *SourceProfileService) ListByUser(ctx context.Context, userID int64) ([]generated.SourceProfile, error) {
	return s.queries.ListSourceProfilesByUser(ctx, userID)
}

// Update updates a Source Profile.
func (s *SourceProfileService) Update(ctx context.Context, params generated.UpdateSourceProfileParams) (generated.SourceProfile, error) {
	return s.queries.UpdateSourceProfile(ctx, params)
}

// Deactivate deactivates a Source Profile.
func (s *SourceProfileService) Deactivate(ctx context.Context, id int64) (generated.SourceProfile, error) {
	return s.queries.DeactivateSourceProfile(ctx, id)
}

// Delete deletes a Source Profile.
func (s *SourceProfileService) Delete(ctx context.Context, id int64) error {
	return s.queries.DeleteSourceProfile(ctx, id)
}

// UpdatePollStatus records the result of a poll attempt.
func (s *SourceProfileService) UpdatePollStatus(ctx context.Context, id int64, status string) error {
	return s.queries.UpdateSourceProfilePollStatus(ctx, generated.UpdateSourceProfilePollStatusParams{
		ID:             id,
		LastPollStatus: pgtype.Text{String: status, Valid: true},
	})
}
```

**Note for executing agent:** Add the missing import for `pgtype` (`github.com/jackc/pgx/v5/pgtype`). Remove the unused `fmt` import if not used.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/service/source_profile.go
git commit -m "feat: add SourceProfileService with CRUD and poll status"
```

---

## Task 10: Webhook Receiver

**Files:**
- Create: `backend/overlay/webhook.go`

- [ ] **Step 1: Create the webhook handler**

```go
// backend/overlay/webhook.go
package overlay

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// WebhookPayload is the expected shape of incoming webhook data.
// The actual fields are mapped via the Source Profile's field_mapping config.
type WebhookPayload struct {
	RawData json.RawMessage `json:"data"`
}

// ValidateWebhookSignature checks the HMAC-SHA256 signature of the webhook body.
// The signature should be in the X-Webhook-Signature header.
func ValidateWebhookSignature(body []byte, signature string, secret string) error {
	if secret == "" {
		// No secret configured — accept all
		return nil
	}
	if signature == "" {
		return errors.New("missing webhook signature")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid webhook signature")
	}

	return nil
}

// ReadWebhookBody reads and returns the webhook request body, limited to 1MB.
func ReadWebhookBody(r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, err
	}
	return body, nil
}

// ApplyFieldMapping transforms raw external data into canonical OverlayData
// using the field_mapping configuration from a Source Profile.
// The mapping is a JSON object where keys are canonical field names and values
// are dot-path expressions into the raw data (e.g., "score.home" → team_1_score).
func ApplyFieldMapping(rawData json.RawMessage, fieldMapping json.RawMessage) (OverlayData, error) {
	var data OverlayData
	var raw map[string]interface{}
	var mapping map[string]string

	if err := json.Unmarshal(rawData, &raw); err != nil {
		return data, errors.New("invalid raw data JSON")
	}
	if err := json.Unmarshal(fieldMapping, &mapping); err != nil {
		return data, errors.New("invalid field mapping JSON")
	}

	// Apply simple top-level mappings
	// For v2, we support flat key mappings only (no nested dot-path resolution)
	// The frontend mapping UI ensures these are correct
	for canonical, sourcePath := range mapping {
		val, ok := raw[sourcePath]
		if !ok {
			continue
		}

		switch canonical {
		case "match_status":
			if s, ok := val.(string); ok {
				data.MatchStatus = s
			}
		case "team_1_name":
			if s, ok := val.(string); ok {
				data.Team1.Name = s
			}
		case "team_1_short_name":
			if s, ok := val.(string); ok {
				data.Team1.ShortName = s
			}
		case "team_1_score":
			if f, ok := val.(float64); ok {
				data.Team1.Score = int(f)
			}
		case "team_1_color":
			if s, ok := val.(string); ok {
				data.Team1.Color = s
			}
		case "team_1_logo_url":
			if s, ok := val.(string); ok {
				data.Team1.LogoURL = s
			}
		case "team_2_name":
			if s, ok := val.(string); ok {
				data.Team2.Name = s
			}
		case "team_2_short_name":
			if s, ok := val.(string); ok {
				data.Team2.ShortName = s
			}
		case "team_2_score":
			if f, ok := val.(float64); ok {
				data.Team2.Score = int(f)
			}
		case "team_2_color":
			if s, ok := val.(string); ok {
				data.Team2.Color = s
			}
		case "team_2_logo_url":
			if s, ok := val.(string); ok {
				data.Team2.LogoURL = s
			}
		case "serving_team":
			if f, ok := val.(float64); ok {
				data.ServingTeam = int(f)
			}
		case "server_number":
			if f, ok := val.(float64); ok {
				data.ServerNumber = int(f)
			}
		case "current_game":
			if f, ok := val.(float64); ok {
				data.CurrentGame = int(f)
			}
		case "division_name":
			if s, ok := val.(string); ok {
				data.DivisionName = s
			}
		case "tournament_name":
			if s, ok := val.(string); ok {
				data.TournamentName = s
			}
		case "league_name":
			if s, ok := val.(string); ok {
				data.LeagueName = s
			}
		case "round_label":
			if s, ok := val.(string); ok {
				data.RoundLabel = s
			}
		case "match_info":
			if s, ok := val.(string); ok {
				data.MatchInfo = s
			}
		}
	}

	// Ensure slices are initialized
	if data.CompletedGames == nil {
		data.CompletedGames = []GameResult{}
	}
	if data.SponsorLogos == nil {
		data.SponsorLogos = []SponsorLogo{}
	}
	if data.Team1.Players == nil {
		data.Team1.Players = []PlayerBrief{}
	}
	if data.Team2.Players == nil {
		data.Team2.Players = []PlayerBrief{}
	}

	return data, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/overlay/webhook.go
git commit -m "feat: add webhook receiver with HMAC validation and field mapping"
```

---

## Task 11: External API Poller

**Files:**
- Create: `backend/overlay/poller.go`

- [ ] **Step 1: Create the poller**

```go
// backend/overlay/poller.go
package overlay

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Poller periodically fetches data from external APIs configured in Source Profiles.
type Poller struct {
	client *http.Client
}

// NewPoller creates a new Poller with sensible defaults.
func NewPoller() *Poller {
	return &Poller{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// PollResult holds the result of a single poll attempt.
type PollResult struct {
	Data   json.RawMessage
	Status string // "ok", "error", "timeout"
	Error  error
}

// Poll fetches data from an external API using the provided configuration.
func (p *Poller) Poll(ctx context.Context, apiURL string, authType string, authConfig json.RawMessage) PollResult {
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("create request: %w", err)}
	}

	// Apply authentication
	if err := p.applyAuth(req, authType, authConfig); err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("apply auth: %w", err)}
	}

	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return PollResult{Status: "timeout", Error: fmt.Errorf("request failed: %w", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return PollResult{Status: "error", Error: fmt.Errorf("unexpected status: %d", resp.StatusCode)}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("read body: %w", err)}
	}

	return PollResult{Data: json.RawMessage(body), Status: "ok"}
}

func (p *Poller) applyAuth(req *http.Request, authType string, authConfig json.RawMessage) error {
	switch authType {
	case "none":
		return nil
	case "api_key":
		var config struct {
			HeaderName string `json:"header_name"`
			Key        string `json:"key"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		if config.HeaderName == "" {
			config.HeaderName = "X-API-Key"
		}
		req.Header.Set(config.HeaderName, config.Key)
	case "bearer":
		var config struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+config.Token)
	case "basic":
		var config struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		req.SetBasicAuth(config.Username, config.Password)
	}
	return nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/overlay/poller.go
git commit -m "feat: add external API poller with auth support"
```

---

## Task 12: Overlay Handler

**Files:**
- Create: `backend/handler/overlay.go`

- [ ] **Step 1: Create the overlay handler**

```go
// backend/handler/overlay.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/overlay"
	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
)

// OverlayHandler handles overlay-related HTTP requests.
type OverlayHandler struct {
	overlayService       *service.OverlayService
	sourceProfileService *service.SourceProfileService
}

// NewOverlayHandler creates a new OverlayHandler.
func NewOverlayHandler(overlayService *service.OverlayService, sourceProfileService *service.SourceProfileService) *OverlayHandler {
	return &OverlayHandler{
		overlayService:       overlayService,
		sourceProfileService: sourceProfileService,
	}
}

// Routes returns the Chi routes for overlay endpoints.
// These are public routes (overlay data) and authenticated routes (control panel).
func (h *OverlayHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public overlay data endpoint (consumed by overlay renderer)
	r.Get("/court/{courtID}/data", h.GetOverlayData)

	// Themes (public)
	r.Get("/themes", h.ListThemes)
	r.Get("/themes/{themeID}", h.GetTheme)

	// Demo data (public)
	r.Get("/demo-data", h.GetDemoData)

	// Webhook receiver (no auth — uses webhook secret validation)
	r.Post("/webhook/{courtID}", h.ReceiveWebhook)

	// Authenticated control panel routes
	r.Route("/court/{courtID}/config", func(r chi.Router) {
		// Note: auth middleware should already be applied by the router
		r.Get("/", h.GetConfig)
		r.Put("/theme", h.UpdateTheme)
		r.Put("/elements", h.UpdateElements)
		r.Post("/token/generate", h.GenerateToken)
		r.Delete("/token", h.RevokeToken)
		r.Put("/source-profile", h.SetSourceProfile)
	})

	return r
}

func (h *OverlayHandler) parseCourtID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
}

// GetOverlayData handles GET /api/v1/overlay/court/{courtID}/data
// Public endpoint (token-validated if configured).
func (h *OverlayHandler) GetOverlayData(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	// Validate overlay token if present
	token := r.URL.Query().Get("token")
	if err := h.overlayService.ValidateToken(r.Context(), courtID, token); err != nil {
		respondError(w, http.StatusForbidden, "INVALID_TOKEN", err.Error())
		return
	}

	useDemoData := r.URL.Query().Get("demo") == "true"

	data, err := h.overlayService.GetOverlayData(r.Context(), courtID, useDemoData)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "RESOLVE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, data)
}

// GetConfig handles GET /api/v1/overlay/court/{courtID}/config
func (h *OverlayHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.GetOrCreateConfig(r.Context(), courtID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// UpdateTheme handles PUT /api/v1/overlay/court/{courtID}/config/theme
func (h *OverlayHandler) UpdateTheme(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		ThemeID        string          `json:"theme_id"`
		ColorOverrides json.RawMessage `json:"color_overrides"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.ThemeID == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "theme_id is required")
		return
	}

	config, err := h.overlayService.UpdateTheme(r.Context(), courtID, req.ThemeID, req.ColorOverrides)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// UpdateElements handles PUT /api/v1/overlay/court/{courtID}/config/elements
func (h *OverlayHandler) UpdateElements(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		Elements json.RawMessage `json:"elements"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	config, err := h.overlayService.UpdateElements(r.Context(), courtID, req.Elements)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// GenerateToken handles POST /api/v1/overlay/court/{courtID}/config/token/generate
func (h *OverlayHandler) GenerateToken(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.GenerateToken(r.Context(), courtID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "TOKEN_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// RevokeToken handles DELETE /api/v1/overlay/court/{courtID}/config/token
func (h *OverlayHandler) RevokeToken(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.RevokeToken(r.Context(), courtID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "REVOKE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// SetSourceProfile handles PUT /api/v1/overlay/court/{courtID}/config/source-profile
func (h *OverlayHandler) SetSourceProfile(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		SourceProfileID *int64 `json:"source_profile_id"` // null to clear
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	config, err := h.overlayService.SetSourceProfile(r.Context(), courtID, req.SourceProfileID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, config)
}

// ListThemes handles GET /api/v1/overlay/themes
func (h *OverlayHandler) ListThemes(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, overlay.AllThemes)
}

// GetTheme handles GET /api/v1/overlay/themes/{themeID}
func (h *OverlayHandler) GetTheme(w http.ResponseWriter, r *http.Request) {
	themeID := chi.URLParam(r, "themeID")
	theme := overlay.GetTheme(themeID)
	respondJSON(w, http.StatusOK, theme)
}

// GetDemoData handles GET /api/v1/overlay/demo-data
func (h *OverlayHandler) GetDemoData(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, overlay.DemoData())
}

// ReceiveWebhook handles POST /api/v1/overlay/webhook/{courtID}
func (h *OverlayHandler) ReceiveWebhook(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	// Get overlay config to find source profile
	config, err := h.overlayService.GetOrCreateConfig(r.Context(), courtID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CONFIG_ERROR", "Failed to get overlay config")
		return
	}

	if !config.SourceProfileID.Valid {
		respondError(w, http.StatusBadRequest, "NO_SOURCE", "No source profile configured for this court")
		return
	}

	// Get source profile for webhook secret and field mapping
	profile, err := h.sourceProfileService.GetByID(r.Context(), config.SourceProfileID.Int64)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "PROFILE_ERROR", "Source profile not found")
		return
	}

	if profile.SourceType != "webhook" {
		respondError(w, http.StatusBadRequest, "WRONG_TYPE", "Source profile is not configured for webhooks")
		return
	}

	// Read and validate webhook body
	body, err := overlay.ReadWebhookBody(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "READ_FAILED", "Failed to read webhook body")
		return
	}

	// Validate signature
	signature := r.Header.Get("X-Webhook-Signature")
	webhookSecret := ""
	if profile.WebhookSecret.Valid {
		webhookSecret = profile.WebhookSecret.String
	}
	if err := overlay.ValidateWebhookSignature(body, signature, webhookSecret); err != nil {
		respondError(w, http.StatusForbidden, "INVALID_SIGNATURE", err.Error())
		return
	}

	// Apply field mapping to transform external data into canonical format
	overlayData, err := overlay.ApplyFieldMapping(json.RawMessage(body), profile.FieldMapping)
	if err != nil {
		respondError(w, http.StatusBadRequest, "MAPPING_FAILED", err.Error())
		return
	}

	// Broadcast the transformed data to the overlay WS channel
	// The overlay renderer will pick it up via the overlay:{court_id} channel
	// We reuse the overlay service's broadcast mechanism
	_ = overlayData // TODO for executing agent: broadcast overlayData to overlay:{courtID} WS channel

	respondJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}
```

**Note for executing agent:** The webhook handler's last TODO should be resolved by calling the pubsub service to publish the transformed overlay data to the `overlay:{courtID}` channel. The exact method depends on how the pubsub is wired — reference Phase 4C's PubSub service.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/overlay.go
git commit -m "feat: add overlay handler with data, config, themes, and webhook endpoints"
```

---

## Task 13: SourceProfile Handler

**Files:**
- Create: `backend/handler/source_profile.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/source_profile.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
	"github.com/court-command/court-command/backend/db/generated"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// SourceProfileHandler handles Source Profile CRUD.
type SourceProfileHandler struct {
	service *service.SourceProfileService
}

// NewSourceProfileHandler creates a new SourceProfileHandler.
func NewSourceProfileHandler(service *service.SourceProfileService) *SourceProfileHandler {
	return &SourceProfileHandler{service: service}
}

// Routes returns the Chi routes for source profiles.
func (h *SourceProfileHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListMine)
	r.Post("/", h.Create)
	r.Get("/{profileID}", h.GetByID)
	r.Put("/{profileID}", h.Update)
	r.Delete("/{profileID}", h.Delete)
	r.Post("/{profileID}/deactivate", h.Deactivate)

	return r
}

func (h *SourceProfileHandler) parseProfileID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "profileID"), 10, 64)
}

// ListMine handles GET /api/v1/source-profiles
func (h *SourceProfileHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profiles, err := h.service.ListByUser(r.Context(), user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list source profiles")
		return
	}

	respondJSON(w, http.StatusOK, profiles)
}

// Create handles POST /api/v1/source-profiles
func (h *SourceProfileHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var req struct {
		Name                string          `json:"name"`
		SourceType          string          `json:"source_type"`
		ApiURL              *string         `json:"api_url"`
		WebhookSecret       *string         `json:"webhook_secret"`
		AuthType            string          `json:"auth_type"`
		AuthConfig          json.RawMessage `json:"auth_config"`
		PollIntervalSeconds *int32          `json:"poll_interval_seconds"`
		FieldMapping        json.RawMessage `json:"field_mapping"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "name is required")
		return
	}

	params := generated.CreateSourceProfileParams{
		Name:             req.Name,
		CreatedByUserID:  user.ID,
		SourceType:       req.SourceType,
		AuthType:         req.AuthType,
	}

	if params.SourceType == "" {
		params.SourceType = "court_command"
	}
	if params.AuthType == "" {
		params.AuthType = "none"
	}

	if req.ApiURL != nil {
		params.ApiUrl = pgtype.Text{String: *req.ApiURL, Valid: true}
	}
	if req.WebhookSecret != nil {
		params.WebhookSecret = pgtype.Text{String: *req.WebhookSecret, Valid: true}
	}
	if req.AuthConfig != nil {
		params.AuthConfig = req.AuthConfig
	} else {
		params.AuthConfig = []byte("{}")
	}
	if req.PollIntervalSeconds != nil {
		params.PollIntervalSeconds = pgtype.Int4{Int32: *req.PollIntervalSeconds, Valid: true}
	}
	if req.FieldMapping != nil {
		params.FieldMapping = req.FieldMapping
	} else {
		params.FieldMapping = []byte("{}")
	}

	profile, err := h.service.Create(r.Context(), params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, profile)
}

// GetByID handles GET /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	profileID, err := h.parseProfileID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	profile, err := h.service.GetByID(r.Context(), profileID)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "Source profile not found")
		return
	}

	respondJSON(w, http.StatusOK, profile)
}

// Update handles PUT /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	profileID, err := h.parseProfileID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	var req struct {
		Name                string          `json:"name"`
		SourceType          string          `json:"source_type"`
		ApiURL              *string         `json:"api_url"`
		WebhookSecret       *string         `json:"webhook_secret"`
		AuthType            string          `json:"auth_type"`
		AuthConfig          json.RawMessage `json:"auth_config"`
		PollIntervalSeconds *int32          `json:"poll_interval_seconds"`
		FieldMapping        json.RawMessage `json:"field_mapping"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	params := generated.UpdateSourceProfileParams{
		ID:         profileID,
		Name:       req.Name,
		SourceType: req.SourceType,
		AuthType:   req.AuthType,
	}

	if req.ApiURL != nil {
		params.ApiUrl = pgtype.Text{String: *req.ApiURL, Valid: true}
	}
	if req.WebhookSecret != nil {
		params.WebhookSecret = pgtype.Text{String: *req.WebhookSecret, Valid: true}
	}
	if req.AuthConfig != nil {
		params.AuthConfig = req.AuthConfig
	} else {
		params.AuthConfig = []byte("{}")
	}
	if req.PollIntervalSeconds != nil {
		params.PollIntervalSeconds = pgtype.Int4{Int32: *req.PollIntervalSeconds, Valid: true}
	}
	if req.FieldMapping != nil {
		params.FieldMapping = req.FieldMapping
	} else {
		params.FieldMapping = []byte("{}")
	}

	profile, err := h.service.Update(r.Context(), params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, profile)
}

// Delete handles DELETE /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	profileID, err := h.parseProfileID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	if err := h.service.Delete(r.Context(), profileID); err != nil {
		respondError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Deactivate handles POST /api/v1/source-profiles/{profileID}/deactivate
func (h *SourceProfileHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	profileID, err := h.parseProfileID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	profile, err := h.service.Deactivate(r.Context(), profileID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "DEACTIVATE_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, profile)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/handler/source_profile.go
git commit -m "feat: add SourceProfileHandler with CRUD endpoints"
```

---

## Task 14: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Mount overlay and source profile routes**

Add the following route groups to `backend/router/router.go`:

```go
// Overlay routes (mixed public and authenticated)
r.Route("/api/v1/overlay", func(r chi.Router) {
    // Public routes (overlay data, themes, demo, webhook)
    r.Get("/court/{courtID}/data", overlayHandler.GetOverlayData)
    r.Get("/themes", overlayHandler.ListThemes)
    r.Get("/themes/{themeID}", overlayHandler.GetTheme)
    r.Get("/demo-data", overlayHandler.GetDemoData)
    r.Post("/webhook/{courtID}", overlayHandler.ReceiveWebhook)

    // Authenticated control panel routes
    r.Group(func(r chi.Router) {
        r.Use(authMiddleware)
        r.Get("/court/{courtID}/config", overlayHandler.GetConfig)
        r.Put("/court/{courtID}/config/theme", overlayHandler.UpdateTheme)
        r.Put("/court/{courtID}/config/elements", overlayHandler.UpdateElements)
        r.Post("/court/{courtID}/config/token/generate", overlayHandler.GenerateToken)
        r.Delete("/court/{courtID}/config/token", overlayHandler.RevokeToken)
        r.Put("/court/{courtID}/config/source-profile", overlayHandler.SetSourceProfile)
    })
})

// Source Profile routes (authenticated)
r.Route("/api/v1/source-profiles", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Mount("/", sourceProfileHandler.Routes())
})
```

The executing agent should:
1. Create `overlayHandler` and `sourceProfileHandler` in the router setup, passing the required services
2. Create the `OverlayService` and `SourceProfileService` in `main.go` and pass to the router
3. Create the `overlay.Resolver` and `overlay.Poller` instances and pass to the overlay service

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire overlay and source profile routes"
```

---

## Task 15: Integration Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start the application**

Run: `docker compose up -d && cd backend && go run .`
Expected: Server starts, migrations applied (22 total).

- [ ] **Step 2: Authenticate**

```bash
curl -s -c cookies.txt http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"td@test.com","password":"test1234"}' | jq .
```

- [ ] **Step 3: List themes**

```bash
curl -s http://localhost:8080/api/v1/overlay/themes | jq .
```

Expected: Array of 6 themes.

- [ ] **Step 4: Get demo data**

```bash
curl -s http://localhost:8080/api/v1/overlay/demo-data | jq .
```

Expected: Full canonical overlay data with sample teams/scores.

- [ ] **Step 5: Create a court and get overlay config**

```bash
# Create a floating court
curl -s -b cookies.txt http://localhost:8080/api/v1/courts \
  -H "Content-Type: application/json" \
  -d '{"name":"OBS Court 1"}' | jq .

# Get overlay config (auto-creates default)
curl -s -b cookies.txt http://localhost:8080/api/v1/overlay/court/1/config | jq .
```

Expected: Default overlay config with classic theme and all elements.

- [ ] **Step 6: Update theme**

```bash
curl -s -b cookies.txt -X PUT http://localhost:8080/api/v1/overlay/court/1/config/theme \
  -H "Content-Type: application/json" \
  -d '{"theme_id":"modern","color_overrides":{"primary":"#ff0000"}}' | jq .
```

Expected: Config returned with updated theme.

- [ ] **Step 7: Generate and validate token**

```bash
# Generate token
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/overlay/court/1/config/token/generate | jq .

# Try accessing data without token (should fail)
curl -s http://localhost:8080/api/v1/overlay/court/1/data | jq .

# Try with correct token (from generate response)
curl -s "http://localhost:8080/api/v1/overlay/court/1/data?token=<TOKEN>" | jq .
```

- [ ] **Step 8: Create source profile**

```bash
curl -s -b cookies.txt http://localhost:8080/api/v1/source-profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Test External API","source_type":"rest_api","api_url":"https://example.com/api/match","auth_type":"bearer","auth_config":{"token":"test123"},"poll_interval_seconds":5,"field_mapping":{"team_1_name":"home_team","team_2_name":"away_team","team_1_score":"home_score","team_2_score":"away_score"}}' | jq .
```

Expected: Source profile created.

- [ ] **Step 9: Clean up**

```bash
rm cookies.txt
docker compose down
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full build**

Run: `cd backend && go build ./...`
Expected: Clean build.

- [ ] **Step 2: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: No errors.

- [ ] **Step 3: Check migration count**

Run: `ls backend/db/migrations/*.sql | wc -l`
Expected: 22 (00001 through 00022).

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
git commit -m "chore: phase 5 final cleanup"
```

---

## Summary

Phase 5 adds the broadcast overlay system backend:

### New tables:
- `court_overlay_configs` — per-court overlay settings (theme, elements, token, branding, source profile)
- `source_profiles` — third-party API adapter configuration (auth, polling, field mapping)

### New packages:
- `backend/overlay/` — extraction-ready overlay subsystem (contract, resolver, poller, webhook, themes)

### New endpoints (19 total):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/overlay/court/{courtID}/data` | Canonical overlay data (public, token-validated) |
| `GET` | `/api/v1/overlay/court/{courtID}/config` | Get overlay config (auth) |
| `PUT` | `/api/v1/overlay/court/{courtID}/config/theme` | Update theme + colors (auth) |
| `PUT` | `/api/v1/overlay/court/{courtID}/config/elements` | Update element visibility (auth) |
| `POST` | `/api/v1/overlay/court/{courtID}/config/token/generate` | Generate overlay token (auth) |
| `DELETE` | `/api/v1/overlay/court/{courtID}/config/token` | Revoke overlay token (auth) |
| `PUT` | `/api/v1/overlay/court/{courtID}/config/source-profile` | Link source profile (auth) |
| `GET` | `/api/v1/overlay/themes` | List available themes (public) |
| `GET` | `/api/v1/overlay/themes/{themeID}` | Get theme details (public) |
| `GET` | `/api/v1/overlay/demo-data` | Demo overlay data (public) |
| `POST` | `/api/v1/overlay/webhook/{courtID}` | Receive webhook data (secret-validated) |
| `GET` | `/api/v1/source-profiles` | List my profiles (auth) |
| `POST` | `/api/v1/source-profiles` | Create profile (auth) |
| `GET` | `/api/v1/source-profiles/{profileID}` | Get profile (auth) |
| `PUT` | `/api/v1/source-profiles/{profileID}` | Update profile (auth) |
| `DELETE` | `/api/v1/source-profiles/{profileID}` | Delete profile (auth) |
| `POST` | `/api/v1/source-profiles/{profileID}/deactivate` | Deactivate profile (auth) |

### Key patterns:
- Overlay data resolver transforms internal CC data → canonical contract
- External API poller supports 4 auth types (none, api_key, bearer, basic)
- Webhook receiver validates HMAC-SHA256 signatures and applies field mapping
- 6 curated themes with CSS custom property overrides
- Overlay token for optional access restriction (public by default)
- Config changes broadcast via `overlay:{court_id}` WS channel (Phase 4C)
- Demo data always available for preview rendering
