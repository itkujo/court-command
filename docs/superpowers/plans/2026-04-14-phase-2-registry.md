# Phase 2: Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Registry subsystem — Player profiles, Teams with roster management, Organizations with membership, Venues with approval workflow, and Courts with streaming support. All entities get full CRUD APIs with proper authorization, pagination, search, and soft deletes.

**Architecture:** Extends the Phase 1 Go monolith. Each entity group gets its own migration, sqlc query file, service, and handler. All follow the same patterns established in Phase 1: Chi router groups, sqlc-generated queries via pgx/v5, Redis sessions for auth, structured JSON responses. Player profiles extend the existing `users` table with additional columns. Teams, Orgs, Venues, and Courts are new tables with join tables for relationships.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, Redis v7, PostgreSQL 17, Docker Compose, Testify

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 00001_create_users.sql          # (Phase 1 — exists)
│   │   ├── 00002_add_player_profile.sql    # Adds profile columns to users
│   │   ├── 00003_create_teams.sql          # teams + team_rosters tables
│   │   ├── 00004_create_organizations.sql  # organizations + org_memberships + org_blocks
│   │   ├── 00005_create_venues.sql         # venues table
│   │   └── 00006_create_courts.sql         # courts table
│   ├── queries/
│   │   ├── users.sql                       # (Phase 1 — modify: add profile queries)
│   │   ├── players.sql                     # Player-specific queries (search, profile)
│   │   ├── teams.sql                       # Team CRUD + search
│   │   ├── team_rosters.sql                # Roster management queries
│   │   ├── organizations.sql               # Org CRUD
│   │   ├── org_memberships.sql             # Membership management
│   │   ├── org_blocks.sql                  # Block management
│   │   ├── venues.sql                      # Venue CRUD + search + approval
│   │   └── courts.sql                      # Court CRUD
│   └── generated/                          # sqlc output (regenerated)
├── handler/
│   ├── health.go                           # (Phase 1 — exists)
│   ├── auth.go                             # (Phase 1 — exists)
│   ├── response.go                         # (Phase 1 — exists)
│   ├── player.go                           # Player profile endpoints
│   ├── team.go                             # Team CRUD endpoints
│   ├── team_roster.go                      # Roster management endpoints
│   ├── organization.go                     # Org CRUD endpoints
│   ├── org_membership.go                   # Membership endpoints
│   ├── venue.go                            # Venue CRUD + approval endpoints
│   └── court.go                            # Court CRUD endpoints
├── service/
│   ├── auth.go                             # (Phase 1 — exists)
│   ├── player.go                           # Player business logic
│   ├── team.go                             # Team + roster business logic
│   ├── organization.go                     # Org + membership business logic
│   └── venue.go                            # Venue + court business logic
├── router/
│   └── router.go                           # (Phase 1 — modify: mount new route groups)
└── middleware/
    └── auth.go                             # (Phase 1 — modify: add RequirePlatformAdmin)
```

---

## Task 1: Player Profile Migration

**Files:**
- Create: `backend/db/migrations/00002_add_player_profile.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00002_add_player_profile.sql

-- +goose Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS handedness TEXT CHECK (handedness IN ('right', 'left', 'ambidextrous'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_brand TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_model TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dupr_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vair_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiver_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_dupr_id ON users(dupr_id) WHERE dupr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_vair_id ON users(vair_id) WHERE vair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_city_state ON users(city, state_province) WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_users_city_state;
DROP INDEX IF EXISTS idx_users_vair_id;
DROP INDEX IF EXISTS idx_users_dupr_id;

ALTER TABLE users DROP COLUMN IF EXISTS is_profile_hidden;
ALTER TABLE users DROP COLUMN IF EXISTS waiver_accepted_at;
ALTER TABLE users DROP COLUMN IF EXISTS medical_notes;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE users DROP COLUMN IF EXISTS vair_id;
ALTER TABLE users DROP COLUMN IF EXISTS dupr_id;
ALTER TABLE users DROP COLUMN IF EXISTS paddle_model;
ALTER TABLE users DROP COLUMN IF EXISTS paddle_brand;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP COLUMN IF EXISTS country;
ALTER TABLE users DROP COLUMN IF EXISTS state_province;
ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE users DROP COLUMN IF EXISTS bio;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS handedness;
ALTER TABLE users DROP COLUMN IF EXISTS gender;
```

- [ ] **Step 2: Run migration to verify**

Run:
```bash
make up && sleep 2
cd backend && DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```
Expected: Migration applied successfully.

Verify:
```bash
docker compose exec db psql -U courtcommand -c "\d users"
```
Expected: All new columns visible.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00002_add_player_profile.sql
git commit -m "feat: add player profile columns to users table"
```

---

## Task 2: Player Profile Queries (sqlc)

**Files:**
- Create: `backend/db/queries/players.sql`
- Modify: `backend/db/queries/users.sql` (add UpdateUserProfile query)

- [ ] **Step 1: Create `backend/db/queries/players.sql`**

```sql
-- backend/db/queries/players.sql

-- name: GetPlayerProfile :one
SELECT * FROM users
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetPlayerByPublicID :one
SELECT * FROM users
WHERE public_id = $1 AND deleted_at IS NULL;

-- name: UpdatePlayerProfile :one
UPDATE users SET
    display_name = COALESCE(sqlc.narg('display_name'), display_name),
    gender = COALESCE(sqlc.narg('gender'), gender),
    handedness = COALESCE(sqlc.narg('handedness'), handedness),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    bio = COALESCE(sqlc.narg('bio'), bio),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    phone = COALESCE(sqlc.narg('phone'), phone),
    paddle_brand = COALESCE(sqlc.narg('paddle_brand'), paddle_brand),
    paddle_model = COALESCE(sqlc.narg('paddle_model'), paddle_model),
    dupr_id = COALESCE(sqlc.narg('dupr_id'), dupr_id),
    vair_id = COALESCE(sqlc.narg('vair_id'), vair_id),
    emergency_contact_name = COALESCE(sqlc.narg('emergency_contact_name'), emergency_contact_name),
    emergency_contact_phone = COALESCE(sqlc.narg('emergency_contact_phone'), emergency_contact_phone),
    medical_notes = COALESCE(sqlc.narg('medical_notes'), medical_notes),
    is_profile_hidden = COALESCE(sqlc.narg('is_profile_hidden'), is_profile_hidden),
    updated_at = now()
WHERE id = @user_id AND deleted_at IS NULL
RETURNING *;

-- name: AcceptWaiver :one
UPDATE users SET
    waiver_accepted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SearchPlayers :many
SELECT * FROM users
WHERE deleted_at IS NULL
  AND status != 'merged'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR first_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR last_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR display_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR public_id = sqlc.narg('query')::TEXT
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY last_name, first_name
LIMIT $1 OFFSET $2;

-- name: CountSearchPlayers :one
SELECT count(*) FROM users
WHERE deleted_at IS NULL
  AND status != 'merged'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR first_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR last_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR display_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR public_id = sqlc.narg('query')::TEXT
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: GetPlayerByDuprID :one
SELECT * FROM users
WHERE dupr_id = $1 AND deleted_at IS NULL;

-- name: GetPlayerByVairID :one
SELECT * FROM users
WHERE vair_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Regenerate sqlc**

Run:
```bash
cd backend && sqlc generate
```
Expected: Clean generation. New files in `db/generated/` for players queries.

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add player profile sqlc queries"
```

---

## Task 3: Player Service

**Files:**
- Create: `backend/service/player.go`

- [ ] **Step 1: Create `backend/service/player.go`**

```go
// backend/service/player.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

// PlayerService handles player profile business logic.
type PlayerService struct {
	queries *generated.Queries
}

// NewPlayerService creates a new PlayerService.
func NewPlayerService(queries *generated.Queries) *PlayerService {
	return &PlayerService{queries: queries}
}

// PlayerProfileResponse is the public representation of a player profile.
type PlayerProfileResponse struct {
	ID              int64   `json:"id"`
	PublicID        string  `json:"public_id"`
	Email           *string `json:"email,omitempty"`
	FirstName       string  `json:"first_name"`
	LastName        string  `json:"last_name"`
	DisplayName     *string `json:"display_name,omitempty"`
	Gender          *string `json:"gender,omitempty"`
	Handedness      *string `json:"handedness,omitempty"`
	AvatarURL       *string `json:"avatar_url,omitempty"`
	Bio             *string `json:"bio,omitempty"`
	City            *string `json:"city,omitempty"`
	StateProvince   *string `json:"state_province,omitempty"`
	Country         *string `json:"country,omitempty"`
	PaddleBrand     *string `json:"paddle_brand,omitempty"`
	PaddleModel     *string `json:"paddle_model,omitempty"`
	DuprID          *string `json:"dupr_id,omitempty"`
	VairID          *string `json:"vair_id,omitempty"`
	IsProfileHidden bool    `json:"is_profile_hidden"`
}

// PrivatePlayerProfileResponse includes sensitive fields visible only to admins/self.
type PrivatePlayerProfileResponse struct {
	PlayerProfileResponse
	DateOfBirth          string  `json:"date_of_birth"`
	Phone                *string `json:"phone,omitempty"`
	EmergencyContactName  *string `json:"emergency_contact_name,omitempty"`
	EmergencyContactPhone *string `json:"emergency_contact_phone,omitempty"`
	MedicalNotes          *string `json:"medical_notes,omitempty"`
	WaiverAcceptedAt      *string `json:"waiver_accepted_at,omitempty"`
	Status                string  `json:"status"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

// toPublicProfile converts a database user row to a public profile response.
func toPublicProfile(u generated.User) PlayerProfileResponse {
	return PlayerProfileResponse{
		ID:              u.ID,
		PublicID:        u.PublicID,
		FirstName:       u.FirstName,
		LastName:        u.LastName,
		DisplayName:     u.DisplayName,
		Gender:          u.Gender,
		Handedness:      u.Handedness,
		AvatarURL:       u.AvatarUrl,
		Bio:             u.Bio,
		City:            u.City,
		StateProvince:   u.StateProvince,
		Country:         u.Country,
		PaddleBrand:     u.PaddleBrand,
		PaddleModel:     u.PaddleModel,
		DuprID:          u.DuprID,
		VairID:          u.VairID,
		IsProfileHidden: u.IsProfileHidden,
	}
}

// toPrivateProfile converts a database user row to a private profile response.
func toPrivateProfile(u generated.User) PrivatePlayerProfileResponse {
	var waiverAt *string
	if u.WaiverAcceptedAt != nil {
		s := u.WaiverAcceptedAt.Format("2006-01-02T15:04:05Z07:00")
		waiverAt = &s
	}

	return PrivatePlayerProfileResponse{
		PlayerProfileResponse: toPublicProfile(u),
		DateOfBirth:           u.DateOfBirth.Format("2006-01-02"),
		Phone:                 u.Phone,
		EmergencyContactName:  u.EmergencyContactName,
		EmergencyContactPhone: u.EmergencyContactPhone,
		MedicalNotes:          u.MedicalNotes,
		WaiverAcceptedAt:      waiverAt,
		Status:                u.Status,
		CreatedAt:             u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:             u.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// GetProfile retrieves a player profile by ID.
// If the requester is the player themselves or an admin, returns full private profile.
// Otherwise returns public profile (or error if hidden).
func (s *PlayerService) GetProfile(ctx context.Context, playerID int64, requesterID int64, requesterRole string) (interface{}, error) {
	user, err := s.queries.GetPlayerProfile(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("player not found")
	}

	isSelf := requesterID == user.ID
	isAdmin := requesterRole == "platform_admin"

	if isSelf || isAdmin {
		return toPrivateProfile(user), nil
	}

	if user.IsProfileHidden {
		// Return minimal info for hidden profiles
		return PlayerProfileResponse{
			ID:        user.ID,
			PublicID:  user.PublicID,
			FirstName: user.FirstName,
			LastName:  user.LastName,
		}, nil
	}

	return toPublicProfile(user), nil
}

// GetProfileByPublicID retrieves a player profile by public ID (CC-XXXXX).
func (s *PlayerService) GetProfileByPublicID(ctx context.Context, publicID string, requesterID int64, requesterRole string) (interface{}, error) {
	user, err := s.queries.GetPlayerByPublicID(ctx, publicID)
	if err != nil {
		return nil, fmt.Errorf("player not found")
	}

	return s.GetProfile(ctx, user.ID, requesterID, requesterRole)
}

// UpdateProfile updates the authenticated user's own profile.
func (s *PlayerService) UpdateProfile(ctx context.Context, userID int64, params generated.UpdatePlayerProfileParams) (PrivatePlayerProfileResponse, error) {
	params.UserID = userID
	user, err := s.queries.UpdatePlayerProfile(ctx, params)
	if err != nil {
		return PrivatePlayerProfileResponse{}, fmt.Errorf("failed to update profile: %w", err)
	}
	return toPrivateProfile(user), nil
}

// AcceptWaiver records the user accepting the platform waiver.
func (s *PlayerService) AcceptWaiver(ctx context.Context, userID int64) (PrivatePlayerProfileResponse, error) {
	user, err := s.queries.AcceptWaiver(ctx, userID)
	if err != nil {
		return PrivatePlayerProfileResponse{}, fmt.Errorf("failed to accept waiver: %w", err)
	}
	return toPrivateProfile(user), nil
}

// SearchPlayers searches for players with optional filters.
func (s *PlayerService) SearchPlayers(ctx context.Context, params generated.SearchPlayersParams) ([]PlayerProfileResponse, int64, error) {
	players, err := s.queries.SearchPlayers(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search players: %w", err)
	}

	count, err := s.queries.CountSearchPlayers(ctx, generated.CountSearchPlayersParams{
		Query:         params.Query,
		City:          params.City,
		StateProvince: params.StateProvince,
		Country:       params.Country,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count players: %w", err)
	}

	profiles := make([]PlayerProfileResponse, len(players))
	for i, p := range players {
		if p.IsProfileHidden {
			profiles[i] = PlayerProfileResponse{
				ID:        p.ID,
				PublicID:  p.PublicID,
				FirstName: p.FirstName,
				LastName:  p.LastName,
			}
		} else {
			profiles[i] = toPublicProfile(p)
		}
	}

	return profiles, count, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add player profile service"
```

---

## Task 4: Player HTTP Handler

**Files:**
- Create: `backend/handler/player.go`

- [ ] **Step 1: Create `backend/handler/player.go`**

```go
// backend/handler/player.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
)

// PlayerHandler handles player profile HTTP requests.
type PlayerHandler struct {
	playerService *service.PlayerService
}

// NewPlayerHandler creates a new PlayerHandler.
func NewPlayerHandler(playerService *service.PlayerService) *PlayerHandler {
	return &PlayerHandler{playerService: playerService}
}

// Routes returns a chi.Router with all player routes mounted.
func (h *PlayerHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/search", h.SearchPlayers)
	r.Get("/me", h.GetMyProfile)
	r.Patch("/me", h.UpdateMyProfile)
	r.Post("/me/waiver", h.AcceptWaiver)
	r.Get("/{playerID}", h.GetPlayer)
	r.Get("/by-public-id/{publicID}", h.GetPlayerByPublicID)

	return r
}

// GetMyProfile returns the authenticated user's own profile.
func (h *PlayerHandler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	profile, err := h.playerService.GetProfile(r.Context(), user.ID, user.ID, user.Role)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, profile)
}

// UpdateMyProfile updates the authenticated user's profile.
func (h *PlayerHandler) UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		DisplayName          *string `json:"display_name"`
		Gender               *string `json:"gender"`
		Handedness           *string `json:"handedness"`
		AvatarURL            *string `json:"avatar_url"`
		Bio                  *string `json:"bio"`
		City                 *string `json:"city"`
		StateProvince        *string `json:"state_province"`
		Country              *string `json:"country"`
		Phone                *string `json:"phone"`
		PaddleBrand          *string `json:"paddle_brand"`
		PaddleModel          *string `json:"paddle_model"`
		DuprID               *string `json:"dupr_id"`
		VairID               *string `json:"vair_id"`
		EmergencyContactName *string `json:"emergency_contact_name"`
		EmergencyContactPhone *string `json:"emergency_contact_phone"`
		MedicalNotes         *string `json:"medical_notes"`
		IsProfileHidden      *bool   `json:"is_profile_hidden"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	// Validate gender if provided
	if body.Gender != nil {
		valid := map[string]bool{"male": true, "female": true, "non_binary": true, "prefer_not_to_say": true}
		if !valid[*body.Gender] {
			WriteError(w, http.StatusBadRequest, "INVALID_GENDER", "Gender must be one of: male, female, non_binary, prefer_not_to_say")
			return
		}
	}

	// Validate handedness if provided
	if body.Handedness != nil {
		valid := map[string]bool{"right": true, "left": true, "ambidextrous": true}
		if !valid[*body.Handedness] {
			WriteError(w, http.StatusBadRequest, "INVALID_HANDEDNESS", "Handedness must be one of: right, left, ambidextrous")
			return
		}
	}

	params := generated.UpdatePlayerProfileParams{
		DisplayName:          body.DisplayName,
		Gender:               body.Gender,
		Handedness:           body.Handedness,
		AvatarUrl:            body.AvatarURL,
		Bio:                  body.Bio,
		City:                 body.City,
		StateProvince:        body.StateProvince,
		Country:              body.Country,
		Phone:                body.Phone,
		PaddleBrand:          body.PaddleBrand,
		PaddleModel:          body.PaddleModel,
		DuprID:               body.DuprID,
		VairID:               body.VairID,
		EmergencyContactName: body.EmergencyContactName,
		EmergencyContactPhone: body.EmergencyContactPhone,
		MedicalNotes:         body.MedicalNotes,
	}

	if body.IsProfileHidden != nil {
		params.IsProfileHidden = body.IsProfileHidden
	}

	profile, err := h.playerService.UpdateProfile(r.Context(), user.ID, params)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, profile)
}

// AcceptWaiver records the user accepting the platform waiver.
func (h *PlayerHandler) AcceptWaiver(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	profile, err := h.playerService.AcceptWaiver(r.Context(), user.ID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "WAIVER_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, profile)
}

// GetPlayer retrieves a player profile by numeric ID.
func (h *PlayerHandler) GetPlayer(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	playerIDStr := chi.URLParam(r, "playerID")
	playerID, err := strconv.ParseInt(playerIDStr, 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	profile, err := h.playerService.GetProfile(r.Context(), playerID, user.ID, user.Role)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, profile)
}

// GetPlayerByPublicID retrieves a player by public ID (CC-XXXXX).
func (h *PlayerHandler) GetPlayerByPublicID(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	publicID := chi.URLParam(r, "publicID")

	profile, err := h.playerService.GetProfileByPublicID(r.Context(), publicID, user.ID, user.Role)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, profile)
}

// SearchPlayers searches for players with optional filters.
func (h *PlayerHandler) SearchPlayers(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	query := r.URL.Query()

	limit := int32(20)
	if l := query.Get("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}

	offset := int32(0)
	if o := query.Get("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	var queryParam, cityParam, stateParam, countryParam *string
	if q := query.Get("q"); q != "" {
		queryParam = &q
	}
	if c := query.Get("city"); c != "" {
		cityParam = &c
	}
	if s := query.Get("state"); s != "" {
		stateParam = &s
	}
	if c := query.Get("country"); c != "" {
		countryParam = &c
	}

	params := generated.SearchPlayersParams{
		Limit:         limit,
		Offset:        offset,
		Query:         queryParam,
		City:          cityParam,
		StateProvince: stateParam,
		Country:       countryParam,
	}

	profiles, total, err := h.playerService.SearchPlayers(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
		return
	}

	WritePaginated(w, http.StatusOK, profiles, total, limit, offset)
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add player profile HTTP handler"
```

---

## Task 5: Teams Migration

**Files:**
- Create: `backend/db/migrations/00003_create_teams.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00003_create_teams.sql

-- +goose Up
CREATE TABLE teams (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    short_name      TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    logo_url        TEXT,
    primary_color   TEXT,
    secondary_color TEXT,
    org_id          BIGINT,
    city            TEXT,
    founded_year    INT,
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_org_id ON teams(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_teams_deleted_at ON teams(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_name ON teams(name) WHERE deleted_at IS NULL;

CREATE TABLE team_rosters (
    id              BIGSERIAL PRIMARY KEY,
    team_id         BIGINT NOT NULL REFERENCES teams(id),
    player_id       BIGINT NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'captain', 'substitute')),
    jersey_number   INT,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, player_id, left_at)
);

CREATE INDEX idx_team_rosters_team ON team_rosters(team_id) WHERE left_at IS NULL;
CREATE INDEX idx_team_rosters_player ON team_rosters(player_id) WHERE left_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS team_rosters;
DROP TABLE IF EXISTS teams;
```

- [ ] **Step 2: Run migration**

Run:
```bash
cd backend && DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```
Expected: Migration applied. `teams` and `team_rosters` tables created.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00003_create_teams.sql
git commit -m "feat: add teams and team_rosters tables"
```

---

## Task 6: Teams + Roster Queries (sqlc)

**Files:**
- Create: `backend/db/queries/teams.sql`
- Create: `backend/db/queries/team_rosters.sql`

- [ ] **Step 1: Create `backend/db/queries/teams.sql`**

```sql
-- backend/db/queries/teams.sql

-- name: CreateTeam :one
INSERT INTO teams (name, short_name, slug, logo_url, primary_color, secondary_color, org_id, city, founded_year, bio)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM teams
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetTeamBySlug :one
SELECT * FROM teams
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateTeam :one
UPDATE teams SET
    name = COALESCE(sqlc.narg('name'), name),
    short_name = COALESCE(sqlc.narg('short_name'), short_name),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    primary_color = COALESCE(sqlc.narg('primary_color'), primary_color),
    secondary_color = COALESCE(sqlc.narg('secondary_color'), secondary_color),
    city = COALESCE(sqlc.narg('city'), city),
    founded_year = COALESCE(sqlc.narg('founded_year'), founded_year),
    bio = COALESCE(sqlc.narg('bio'), bio),
    updated_at = now()
WHERE id = @team_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTeam :exec
UPDATE teams SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListTeams :many
SELECT * FROM teams
WHERE deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountTeams :one
SELECT count(*) FROM teams
WHERE deleted_at IS NULL;

-- name: ListTeamsByOrg :many
SELECT * FROM teams
WHERE org_id = $1 AND deleted_at IS NULL
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: CountTeamsByOrg :one
SELECT count(*) FROM teams
WHERE org_id = $1 AND deleted_at IS NULL;

-- name: SearchTeams :many
SELECT * FROM teams
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR short_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('org_id')::BIGINT IS NULL OR org_id = sqlc.narg('org_id')::BIGINT)
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchTeams :one
SELECT count(*) FROM teams
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    OR short_name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('org_id')::BIGINT IS NULL OR org_id = sqlc.narg('org_id')::BIGINT)
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT);

-- name: CheckTeamSlugExists :one
SELECT count(*) FROM teams
WHERE slug = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Create `backend/db/queries/team_rosters.sql`**

```sql
-- backend/db/queries/team_rosters.sql

-- name: AddPlayerToTeam :one
INSERT INTO team_rosters (team_id, player_id, role, jersey_number)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: RemovePlayerFromTeam :exec
UPDATE team_rosters SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE team_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: UpdateRosterEntry :one
UPDATE team_rosters SET
    role = COALESCE(sqlc.narg('role'), role),
    jersey_number = COALESCE(sqlc.narg('jersey_number'), jersey_number),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = now()
WHERE team_id = @team_id AND player_id = @player_id AND left_at IS NULL
RETURNING *;

-- name: GetActiveRoster :many
SELECT tr.*, u.first_name, u.last_name, u.display_name, u.public_id, u.avatar_url
FROM team_rosters tr
JOIN users u ON u.id = tr.player_id
WHERE tr.team_id = $1 AND tr.left_at IS NULL AND u.deleted_at IS NULL
ORDER BY tr.role, u.last_name;

-- name: GetPlayerTeams :many
SELECT t.*, tr.role AS roster_role, tr.jersey_number, tr.joined_at AS roster_joined_at, tr.status AS roster_status
FROM team_rosters tr
JOIN teams t ON t.id = tr.team_id
WHERE tr.player_id = $1 AND tr.left_at IS NULL AND t.deleted_at IS NULL
ORDER BY t.name;

-- name: CheckPlayerOnTeam :one
SELECT count(*) FROM team_rosters
WHERE team_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: DeactivatePlayerRostersForOrg :exec
UPDATE team_rosters SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE player_id = $1
  AND left_at IS NULL
  AND team_id IN (
    SELECT id FROM teams WHERE org_id = $2 AND deleted_at IS NULL
  );

-- name: CountActiveRoster :one
SELECT count(*) FROM team_rosters
WHERE team_id = $1 AND left_at IS NULL;
```

- [ ] **Step 3: Regenerate sqlc**

Run:
```bash
cd backend && sqlc generate
```
Expected: Clean generation with new team and roster query files.

- [ ] **Step 4: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 5: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add team and roster sqlc queries"
```

---

## Task 7: Team Service

**Files:**
- Create: `backend/service/team.go`

- [ ] **Step 1: Create `backend/service/team.go`**

```go
// backend/service/team.go
package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// TeamService handles team and roster business logic.
type TeamService struct {
	queries *generated.Queries
}

// NewTeamService creates a new TeamService.
func NewTeamService(queries *generated.Queries) *TeamService {
	return &TeamService{queries: queries}
}

// TeamResponse is the public representation of a team.
type TeamResponse struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	ShortName      string  `json:"short_name"`
	Slug           string  `json:"slug"`
	LogoURL        *string `json:"logo_url,omitempty"`
	PrimaryColor   *string `json:"primary_color,omitempty"`
	SecondaryColor *string `json:"secondary_color,omitempty"`
	OrgID          *int64  `json:"org_id,omitempty"`
	City           *string `json:"city,omitempty"`
	FoundedYear    *int32  `json:"founded_year,omitempty"`
	Bio            *string `json:"bio,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// RosterEntryResponse represents a player on a team roster.
type RosterEntryResponse struct {
	PlayerID     int64   `json:"player_id"`
	PublicID     string  `json:"public_id"`
	FirstName    string  `json:"first_name"`
	LastName     string  `json:"last_name"`
	DisplayName  *string `json:"display_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	Role         string  `json:"role"`
	JerseyNumber *int32  `json:"jersey_number,omitempty"`
	JoinedAt     string  `json:"joined_at"`
	Status       string  `json:"status"`
}

func toTeamResponse(t generated.Team) TeamResponse {
	return TeamResponse{
		ID:             t.ID,
		Name:           t.Name,
		ShortName:      t.ShortName,
		Slug:           t.Slug,
		LogoURL:        t.LogoUrl,
		PrimaryColor:   t.PrimaryColor,
		SecondaryColor: t.SecondaryColor,
		OrgID:          t.OrgID,
		City:           t.City,
		FoundedYear:    t.FoundedYear,
		Bio:            t.Bio,
		CreatedAt:      t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      t.UpdatedAt.Format(time.RFC3339),
	}
}

// generateSlug creates a URL-safe slug from a name, appending a suffix if needed.
var slugRegexp = regexp.MustCompile(`[^a-z0-9]+`)

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = slugRegexp.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "team"
	}
	return slug
}

// CreateTeam creates a new team.
func (s *TeamService) CreateTeam(ctx context.Context, params generated.CreateTeamParams) (TeamResponse, error) {
	// Validate short_name length
	if len(params.ShortName) < 2 || len(params.ShortName) > 4 {
		return TeamResponse{}, fmt.Errorf("short_name must be 2-4 characters")
	}
	params.ShortName = strings.ToUpper(params.ShortName)

	// Generate slug
	params.Slug = generateSlug(params.Name)

	// Check for slug collision and append number if needed
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}
		count, err := s.queries.CheckTeamSlugExists(ctx, candidate)
		if err != nil {
			return TeamResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			break
		}
	}

	team, err := s.queries.CreateTeam(ctx, params)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("failed to create team: %w", err)
	}

	return toTeamResponse(team), nil
}

// GetTeam retrieves a team by ID.
func (s *TeamService) GetTeam(ctx context.Context, teamID int64) (TeamResponse, error) {
	team, err := s.queries.GetTeamByID(ctx, teamID)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("team not found")
	}
	return toTeamResponse(team), nil
}

// GetTeamBySlug retrieves a team by slug.
func (s *TeamService) GetTeamBySlug(ctx context.Context, slug string) (TeamResponse, error) {
	team, err := s.queries.GetTeamBySlug(ctx, slug)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("team not found")
	}
	return toTeamResponse(team), nil
}

// UpdateTeam updates a team's details.
func (s *TeamService) UpdateTeam(ctx context.Context, teamID int64, params generated.UpdateTeamParams) (TeamResponse, error) {
	params.TeamID = teamID

	// Validate short_name if provided
	if params.ShortName != nil {
		if len(*params.ShortName) < 2 || len(*params.ShortName) > 4 {
			return TeamResponse{}, fmt.Errorf("short_name must be 2-4 characters")
		}
		upper := strings.ToUpper(*params.ShortName)
		params.ShortName = &upper
	}

	team, err := s.queries.UpdateTeam(ctx, params)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("failed to update team: %w", err)
	}
	return toTeamResponse(team), nil
}

// DeleteTeam soft-deletes a team.
func (s *TeamService) DeleteTeam(ctx context.Context, teamID int64) error {
	return s.queries.SoftDeleteTeam(ctx, teamID)
}

// ListTeams lists teams with pagination.
func (s *TeamService) ListTeams(ctx context.Context, limit, offset int32) ([]TeamResponse, int64, error) {
	teams, err := s.queries.ListTeams(ctx, generated.ListTeamsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list teams: %w", err)
	}

	count, err := s.queries.CountTeams(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count teams: %w", err)
	}

	result := make([]TeamResponse, len(teams))
	for i, t := range teams {
		result[i] = toTeamResponse(t)
	}

	return result, count, nil
}

// SearchTeams searches teams with filters.
func (s *TeamService) SearchTeams(ctx context.Context, params generated.SearchTeamsParams) ([]TeamResponse, int64, error) {
	teams, err := s.queries.SearchTeams(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search teams: %w", err)
	}

	count, err := s.queries.CountSearchTeams(ctx, generated.CountSearchTeamsParams{
		Query: params.Query,
		OrgID: params.OrgID,
		City:  params.City,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count teams: %w", err)
	}

	result := make([]TeamResponse, len(teams))
	for i, t := range teams {
		result[i] = toTeamResponse(t)
	}

	return result, count, nil
}

// AddPlayerToTeam adds a player to a team's roster.
func (s *TeamService) AddPlayerToTeam(ctx context.Context, teamID, playerID int64, role string, jerseyNumber *int32) (generated.TeamRoster, error) {
	// Validate role
	validRoles := map[string]bool{"player": true, "captain": true, "substitute": true}
	if !validRoles[role] {
		return generated.TeamRoster{}, fmt.Errorf("role must be one of: player, captain, substitute")
	}

	// Check if player is already on team
	count, err := s.queries.CheckPlayerOnTeam(ctx, generated.CheckPlayerOnTeamParams{
		TeamID:   teamID,
		PlayerID: playerID,
	})
	if err != nil {
		return generated.TeamRoster{}, fmt.Errorf("failed to check roster: %w", err)
	}
	if count > 0 {
		return generated.TeamRoster{}, fmt.Errorf("player is already on this team")
	}

	entry, err := s.queries.AddPlayerToTeam(ctx, generated.AddPlayerToTeamParams{
		TeamID:       teamID,
		PlayerID:     playerID,
		Role:         role,
		JerseyNumber: jerseyNumber,
	})
	if err != nil {
		return generated.TeamRoster{}, fmt.Errorf("failed to add player to team: %w", err)
	}

	return entry, nil
}

// RemovePlayerFromTeam removes a player from a team's roster.
func (s *TeamService) RemovePlayerFromTeam(ctx context.Context, teamID, playerID int64) error {
	return s.queries.RemovePlayerFromTeam(ctx, generated.RemovePlayerFromTeamParams{
		TeamID:   teamID,
		PlayerID: playerID,
	})
}

// GetRoster returns the active roster for a team.
func (s *TeamService) GetRoster(ctx context.Context, teamID int64) ([]RosterEntryResponse, error) {
	rows, err := s.queries.GetActiveRoster(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get roster: %w", err)
	}

	result := make([]RosterEntryResponse, len(rows))
	for i, r := range rows {
		result[i] = RosterEntryResponse{
			PlayerID:     r.PlayerID,
			PublicID:     r.PublicID,
			FirstName:    r.FirstName,
			LastName:     r.LastName,
			DisplayName:  r.DisplayName,
			AvatarURL:    r.AvatarUrl,
			Role:         r.Role,
			JerseyNumber: r.JerseyNumber,
			JoinedAt:     r.JoinedAt.Format(time.RFC3339),
			Status:       r.Status,
		}
	}

	return result, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add team and roster service"
```

---

## Task 8: Team HTTP Handler

**Files:**
- Create: `backend/handler/team.go`
- Create: `backend/handler/team_roster.go`

- [ ] **Step 1: Create `backend/handler/team.go`**

```go
// backend/handler/team.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
)

// TeamHandler handles team HTTP requests.
type TeamHandler struct {
	teamService *service.TeamService
}

// NewTeamHandler creates a new TeamHandler.
func NewTeamHandler(teamService *service.TeamService) *TeamHandler {
	return &TeamHandler{teamService: teamService}
}

// Routes returns a chi.Router with all team routes mounted.
func (h *TeamHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListTeams)
	r.Get("/search", h.SearchTeams)
	r.Post("/", h.CreateTeam)
	r.Get("/{teamID}", h.GetTeam)
	r.Get("/by-slug/{slug}", h.GetTeamBySlug)
	r.Patch("/{teamID}", h.UpdateTeam)
	r.Delete("/{teamID}", h.DeleteTeam)

	// Roster sub-routes
	r.Get("/{teamID}/roster", h.GetRoster)
	r.Post("/{teamID}/roster", h.AddPlayerToTeam)
	r.Delete("/{teamID}/roster/{playerID}", h.RemovePlayerFromTeam)

	return r
}

// CreateTeam creates a new team.
func (h *TeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name           string  `json:"name"`
		ShortName      string  `json:"short_name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		OrgID          *int64  `json:"org_id"`
		City           *string `json:"city"`
		FoundedYear    *int32  `json:"founded_year"`
		Bio            *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" || body.ShortName == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name and short_name are required")
		return
	}

	params := generated.CreateTeamParams{
		Name:           body.Name,
		ShortName:      body.ShortName,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		OrgID:          body.OrgID,
		City:           body.City,
		FoundedYear:    body.FoundedYear,
		Bio:            body.Bio,
	}

	team, err := h.teamService.CreateTeam(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, team)
}

// GetTeam retrieves a team by ID.
func (h *TeamHandler) GetTeam(w http.ResponseWriter, r *http.Request) {
	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	team, err := h.teamService.GetTeam(r.Context(), teamID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, team)
}

// GetTeamBySlug retrieves a team by slug.
func (h *TeamHandler) GetTeamBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	team, err := h.teamService.GetTeamBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, team)
}

// UpdateTeam updates a team.
func (h *TeamHandler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	var body struct {
		Name           *string `json:"name"`
		ShortName      *string `json:"short_name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		City           *string `json:"city"`
		FoundedYear    *int32  `json:"founded_year"`
		Bio            *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateTeamParams{
		TeamID:         teamID,
		Name:           body.Name,
		ShortName:      body.ShortName,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		City:           body.City,
		FoundedYear:    body.FoundedYear,
		Bio:            body.Bio,
	}

	team, err := h.teamService.UpdateTeam(r.Context(), teamID, params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, team)
}

// DeleteTeam soft-deletes a team.
func (h *TeamHandler) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	if err := h.teamService.DeleteTeam(r.Context(), teamID); err != nil {
		WriteError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "team deleted"})
}

// ListTeams lists teams with pagination.
func (h *TeamHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	teams, total, err := h.teamService.ListTeams(r.Context(), limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	WritePaginated(w, http.StatusOK, teams, total, limit, offset)
}

// SearchTeams searches teams with filters.
func (h *TeamHandler) SearchTeams(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	query := r.URL.Query()

	var queryParam, cityParam *string
	var orgIDParam *int64
	if q := query.Get("q"); q != "" {
		queryParam = &q
	}
	if c := query.Get("city"); c != "" {
		cityParam = &c
	}
	if o := query.Get("org_id"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 64); err == nil {
			orgIDParam = &v
		}
	}

	params := generated.SearchTeamsParams{
		Limit:  limit,
		Offset: offset,
		Query:  queryParam,
		OrgID:  orgIDParam,
		City:   cityParam,
	}

	teams, total, err := h.teamService.SearchTeams(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "SEARCH_FAILED", err.Error())
		return
	}

	WritePaginated(w, http.StatusOK, teams, total, limit, offset)
}

// GetRoster returns the active roster for a team.
func (h *TeamHandler) GetRoster(w http.ResponseWriter, r *http.Request) {
	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	roster, err := h.teamService.GetRoster(r.Context(), teamID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "ROSTER_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, roster)
}

// AddPlayerToTeam adds a player to a team's roster.
func (h *TeamHandler) AddPlayerToTeam(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	var body struct {
		PlayerID     int64  `json:"player_id"`
		Role         string `json:"role"`
		JerseyNumber *int32 `json:"jersey_number"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.PlayerID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "player_id is required")
		return
	}

	if body.Role == "" {
		body.Role = "player"
	}

	entry, err := h.teamService.AddPlayerToTeam(r.Context(), teamID, body.PlayerID, body.Role, body.JerseyNumber)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "ADD_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, entry)
}

// RemovePlayerFromTeam removes a player from a team's roster.
func (h *TeamHandler) RemovePlayerFromTeam(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	if err := h.teamService.RemovePlayerFromTeam(r.Context(), teamID, playerID); err != nil {
		WriteError(w, http.StatusInternalServerError, "REMOVE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "player removed from team"})
}

// parsePagination extracts limit and offset from query parameters.
func parsePagination(r *http.Request) (int32, int32) {
	query := r.URL.Query()

	limit := int32(20)
	if l := query.Get("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}

	offset := int32(0)
	if o := query.Get("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	return limit, offset
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add team HTTP handler with roster management"
```

---

## Task 9: Organizations Migration

**Files:**
- Create: `backend/db/migrations/00004_create_organizations.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00004_create_organizations.sql

-- +goose Up
CREATE TABLE organizations (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    logo_url        TEXT,
    primary_color   TEXT,
    secondary_color TEXT,
    website_url     TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    city            TEXT,
    state_province  TEXT,
    country         TEXT,
    bio             TEXT,
    founded_year    INT,
    social_links    JSONB DEFAULT '{}',
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_orgs_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_name ON organizations(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_created_by ON organizations(created_by_user_id);

-- Add FK from teams.org_id to organizations.id
ALTER TABLE teams ADD CONSTRAINT fk_teams_org FOREIGN KEY (org_id) REFERENCES organizations(id);

CREATE TABLE org_memberships (
    id              BIGSERIAL PRIMARY KEY,
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    player_id       BIGINT NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, player_id, left_at)
);

CREATE INDEX idx_org_memberships_org ON org_memberships(org_id) WHERE left_at IS NULL;
CREATE INDEX idx_org_memberships_player ON org_memberships(player_id) WHERE left_at IS NULL;

CREATE TABLE org_blocks (
    id              BIGSERIAL PRIMARY KEY,
    player_id       BIGINT NOT NULL REFERENCES users(id),
    org_id          BIGINT NOT NULL REFERENCES organizations(id),
    blocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, org_id)
);

CREATE INDEX idx_org_blocks_player ON org_blocks(player_id);

-- +goose Down
DROP TABLE IF EXISTS org_blocks;
DROP TABLE IF EXISTS org_memberships;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS fk_teams_org;
DROP TABLE IF EXISTS organizations;
```

- [ ] **Step 2: Run migration**

Run:
```bash
cd backend && DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```
Expected: Migration applied. `organizations`, `org_memberships`, `org_blocks` tables created. FK added to `teams`.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00004_create_organizations.sql
git commit -m "feat: add organizations, memberships, and blocks tables"
```

---

## Task 10: Organization Queries (sqlc)

**Files:**
- Create: `backend/db/queries/organizations.sql`
- Create: `backend/db/queries/org_memberships.sql`
- Create: `backend/db/queries/org_blocks.sql`

- [ ] **Step 1: Create `backend/db/queries/organizations.sql`**

```sql
-- backend/db/queries/organizations.sql

-- name: CreateOrganization :one
INSERT INTO organizations (name, slug, logo_url, primary_color, secondary_color, website_url, contact_email, contact_phone, city, state_province, country, bio, founded_year, social_links, created_by_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: GetOrgByID :one
SELECT * FROM organizations
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetOrgBySlug :one
SELECT * FROM organizations
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateOrg :one
UPDATE organizations SET
    name = COALESCE(sqlc.narg('name'), name),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    primary_color = COALESCE(sqlc.narg('primary_color'), primary_color),
    secondary_color = COALESCE(sqlc.narg('secondary_color'), secondary_color),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    bio = COALESCE(sqlc.narg('bio'), bio),
    founded_year = COALESCE(sqlc.narg('founded_year'), founded_year),
    social_links = COALESCE(sqlc.narg('social_links'), social_links),
    updated_at = now()
WHERE id = @org_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteOrg :exec
UPDATE organizations SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListOrgs :many
SELECT * FROM organizations
WHERE deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountOrgs :one
SELECT count(*) FROM organizations
WHERE deleted_at IS NULL;

-- name: SearchOrgs :many
SELECT * FROM organizations
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchOrgs :one
SELECT count(*) FROM organizations
WHERE deleted_at IS NULL
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: CheckOrgSlugExists :one
SELECT count(*) FROM organizations
WHERE slug = $1 AND deleted_at IS NULL;

-- name: ListOrgsByUser :many
SELECT o.*, om.role AS membership_role
FROM organizations o
JOIN org_memberships om ON om.org_id = o.id
WHERE om.player_id = $1 AND om.left_at IS NULL AND o.deleted_at IS NULL
ORDER BY o.name;
```

- [ ] **Step 2: Create `backend/db/queries/org_memberships.sql`**

```sql
-- backend/db/queries/org_memberships.sql

-- name: AddMemberToOrg :one
INSERT INTO org_memberships (org_id, player_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RemoveMemberFromOrg :exec
UPDATE org_memberships SET
    left_at = now(),
    status = 'inactive',
    updated_at = now()
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: UpdateMemberRole :one
UPDATE org_memberships SET
    role = $3,
    updated_at = now()
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL
RETURNING *;

-- name: GetOrgMembers :many
SELECT om.*, u.first_name, u.last_name, u.display_name, u.public_id, u.avatar_url, u.email
FROM org_memberships om
JOIN users u ON u.id = om.player_id
WHERE om.org_id = $1 AND om.left_at IS NULL AND u.deleted_at IS NULL
ORDER BY om.role DESC, u.last_name;

-- name: CheckMemberInOrg :one
SELECT count(*) FROM org_memberships
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: GetMemberRole :one
SELECT role FROM org_memberships
WHERE org_id = $1 AND player_id = $2 AND left_at IS NULL;

-- name: GetPlayerOrgs :many
SELECT o.*, om.role AS membership_role, om.joined_at AS membership_joined_at
FROM org_memberships om
JOIN organizations o ON o.id = om.org_id
WHERE om.player_id = $1 AND om.left_at IS NULL AND o.deleted_at IS NULL
ORDER BY o.name;
```

- [ ] **Step 3: Create `backend/db/queries/org_blocks.sql`**

```sql
-- backend/db/queries/org_blocks.sql

-- name: BlockOrg :one
INSERT INTO org_blocks (player_id, org_id)
VALUES ($1, $2)
ON CONFLICT (player_id, org_id) DO NOTHING
RETURNING *;

-- name: UnblockOrg :exec
DELETE FROM org_blocks
WHERE player_id = $1 AND org_id = $2;

-- name: IsOrgBlocked :one
SELECT count(*) FROM org_blocks
WHERE player_id = $1 AND org_id = $2;

-- name: GetBlockedOrgs :many
SELECT ob.*, o.name, o.slug, o.logo_url
FROM org_blocks ob
JOIN organizations o ON o.id = ob.org_id
WHERE ob.player_id = $1 AND o.deleted_at IS NULL
ORDER BY ob.blocked_at DESC;
```

- [ ] **Step 4: Regenerate sqlc**

Run:
```bash
cd backend && sqlc generate
```
Expected: Clean generation.

- [ ] **Step 5: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 6: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add organization, membership, and block sqlc queries"
```

---

## Task 11: Organization Service

**Files:**
- Create: `backend/service/organization.go`

- [ ] **Step 1: Create `backend/service/organization.go`**

```go
// backend/service/organization.go
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// OrganizationService handles organization business logic.
type OrganizationService struct {
	queries *generated.Queries
}

// NewOrganizationService creates a new OrganizationService.
func NewOrganizationService(queries *generated.Queries) *OrganizationService {
	return &OrganizationService{queries: queries}
}

// OrgResponse is the public representation of an organization.
type OrgResponse struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	Slug           string  `json:"slug"`
	LogoURL        *string `json:"logo_url,omitempty"`
	PrimaryColor   *string `json:"primary_color,omitempty"`
	SecondaryColor *string `json:"secondary_color,omitempty"`
	WebsiteURL     *string `json:"website_url,omitempty"`
	ContactEmail   *string `json:"contact_email,omitempty"`
	ContactPhone   *string `json:"contact_phone,omitempty"`
	City           *string `json:"city,omitempty"`
	StateProvince  *string `json:"state_province,omitempty"`
	Country        *string `json:"country,omitempty"`
	Bio            *string `json:"bio,omitempty"`
	FoundedYear    *int32  `json:"founded_year,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// OrgMemberResponse represents a member of an organization.
type OrgMemberResponse struct {
	PlayerID    int64   `json:"player_id"`
	PublicID    string  `json:"public_id"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Email       *string `json:"email,omitempty"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joined_at"`
	Status      string  `json:"status"`
}

func toOrgResponse(o generated.Organization) OrgResponse {
	return OrgResponse{
		ID:             o.ID,
		Name:           o.Name,
		Slug:           o.Slug,
		LogoURL:        o.LogoUrl,
		PrimaryColor:   o.PrimaryColor,
		SecondaryColor: o.SecondaryColor,
		WebsiteURL:     o.WebsiteUrl,
		ContactEmail:   o.ContactEmail,
		ContactPhone:   o.ContactPhone,
		City:           o.City,
		StateProvince:  o.StateProvince,
		Country:        o.Country,
		Bio:            o.Bio,
		FoundedYear:    o.FoundedYear,
		CreatedAt:      o.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      o.UpdatedAt.Format(time.RFC3339),
	}
}

// CreateOrg creates a new organization. The creator automatically becomes an admin member.
func (s *OrganizationService) CreateOrg(ctx context.Context, params generated.CreateOrganizationParams) (OrgResponse, error) {
	// Generate slug
	params.Slug = generateSlug(params.Name)

	// Check for slug collision
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}
		count, err := s.queries.CheckOrgSlugExists(ctx, candidate)
		if err != nil {
			return OrgResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			break
		}
	}

	org, err := s.queries.CreateOrganization(ctx, params)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to create organization: %w", err)
	}

	// Add creator as admin member
	_, err = s.queries.AddMemberToOrg(ctx, generated.AddMemberToOrgParams{
		OrgID:    org.ID,
		PlayerID: params.CreatedByUserID,
		Role:     "admin",
	})
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to add creator as admin: %w", err)
	}

	return toOrgResponse(org), nil
}

// GetOrg retrieves an organization by ID.
func (s *OrganizationService) GetOrg(ctx context.Context, orgID int64) (OrgResponse, error) {
	org, err := s.queries.GetOrgByID(ctx, orgID)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("organization not found")
	}
	return toOrgResponse(org), nil
}

// GetOrgBySlug retrieves an organization by slug.
func (s *OrganizationService) GetOrgBySlug(ctx context.Context, slug string) (OrgResponse, error) {
	org, err := s.queries.GetOrgBySlug(ctx, slug)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("organization not found")
	}
	return toOrgResponse(org), nil
}

// UpdateOrg updates an organization's details. Requires admin role in the org.
func (s *OrganizationService) UpdateOrg(ctx context.Context, orgID int64, requesterID int64, requesterRole string, params generated.UpdateOrgParams) (OrgResponse, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return OrgResponse{}, err
	}

	params.OrgID = orgID
	org, err := s.queries.UpdateOrg(ctx, params)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to update organization: %w", err)
	}
	return toOrgResponse(org), nil
}

// DeleteOrg soft-deletes an organization.
func (s *OrganizationService) DeleteOrg(ctx context.Context, orgID int64, requesterID int64, requesterRole string) error {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return err
	}
	return s.queries.SoftDeleteOrg(ctx, orgID)
}

// ListOrgs lists organizations with pagination.
func (s *OrganizationService) ListOrgs(ctx context.Context, limit, offset int32) ([]OrgResponse, int64, error) {
	orgs, err := s.queries.ListOrgs(ctx, generated.ListOrgsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list organizations: %w", err)
	}

	count, err := s.queries.CountOrgs(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count organizations: %w", err)
	}

	result := make([]OrgResponse, len(orgs))
	for i, o := range orgs {
		result[i] = toOrgResponse(o)
	}

	return result, count, nil
}

// AddMember adds a player to an organization.
func (s *OrganizationService) AddMember(ctx context.Context, orgID, playerID int64, role string, requesterID int64, requesterRole string) (generated.OrgMembership, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return generated.OrgMembership{}, err
	}

	// Check if player has blocked this org
	blocked, err := s.queries.IsOrgBlocked(ctx, generated.IsOrgBlockedParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to check block status: %w", err)
	}
	if blocked > 0 {
		return generated.OrgMembership{}, fmt.Errorf("this player is unavailable")
	}

	// Check if already a member
	existing, err := s.queries.CheckMemberInOrg(ctx, generated.CheckMemberInOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to check membership: %w", err)
	}
	if existing > 0 {
		return generated.OrgMembership{}, fmt.Errorf("player is already a member of this organization")
	}

	validRoles := map[string]bool{"member": true, "admin": true}
	if !validRoles[role] {
		return generated.OrgMembership{}, fmt.Errorf("role must be one of: member, admin")
	}

	member, err := s.queries.AddMemberToOrg(ctx, generated.AddMemberToOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
		Role:     role,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to add member: %w", err)
	}

	return member, nil
}

// RemoveMember removes a player from an organization.
// Also deactivates their roster entries on all teams in this org.
func (s *OrganizationService) RemoveMember(ctx context.Context, orgID, playerID int64, requesterID int64, requesterRole string) error {
	isSelf := requesterID == playerID
	if !isSelf {
		if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
			return err
		}
	}

	// Deactivate team roster entries for this org
	if err := s.queries.DeactivatePlayerRostersForOrg(ctx, generated.DeactivatePlayerRostersForOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	}); err != nil {
		return fmt.Errorf("failed to deactivate roster entries: %w", err)
	}

	return s.queries.RemoveMemberFromOrg(ctx, generated.RemoveMemberFromOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	})
}

// GetMembers returns all active members of an organization.
func (s *OrganizationService) GetMembers(ctx context.Context, orgID int64) ([]OrgMemberResponse, error) {
	rows, err := s.queries.GetOrgMembers(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get members: %w", err)
	}

	result := make([]OrgMemberResponse, len(rows))
	for i, r := range rows {
		result[i] = OrgMemberResponse{
			PlayerID:    r.PlayerID,
			PublicID:    r.PublicID,
			FirstName:   r.FirstName,
			LastName:    r.LastName,
			DisplayName: r.DisplayName,
			AvatarURL:   r.AvatarUrl,
			Email:       r.Email,
			Role:        r.Role,
			JoinedAt:    r.JoinedAt.Format(time.RFC3339),
			Status:      r.Status,
		}
	}

	return result, nil
}

// BlockOrg allows a player to block an organization from adding them.
func (s *OrganizationService) BlockOrg(ctx context.Context, playerID, orgID int64) error {
	// Remove membership first if it exists
	_ = s.queries.RemoveMemberFromOrg(ctx, generated.RemoveMemberFromOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	})

	// Deactivate roster entries
	_ = s.queries.DeactivatePlayerRostersForOrg(ctx, generated.DeactivatePlayerRostersForOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})

	_, err := s.queries.BlockOrg(ctx, generated.BlockOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
	if err != nil {
		return fmt.Errorf("failed to block organization: %w", err)
	}

	return nil
}

// UnblockOrg removes an organization block.
func (s *OrganizationService) UnblockOrg(ctx context.Context, playerID, orgID int64) error {
	return s.queries.UnblockOrg(ctx, generated.UnblockOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
}

// requireOrgAdmin checks if the requester is an admin of the org or a platform admin.
func (s *OrganizationService) requireOrgAdmin(ctx context.Context, orgID, requesterID int64, requesterRole string) error {
	if requesterRole == "platform_admin" {
		return nil
	}

	role, err := s.queries.GetMemberRole(ctx, generated.GetMemberRoleParams{
		OrgID:    orgID,
		PlayerID: requesterID,
	})
	if err != nil || role != "admin" {
		return fmt.Errorf("you must be an organization admin to perform this action")
	}

	return nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add organization service with membership and block logic"
```

---

## Task 12: Organization HTTP Handler

**Files:**
- Create: `backend/handler/organization.go`
- Create: `backend/handler/org_membership.go`

- [ ] **Step 1: Create `backend/handler/organization.go`**

```go
// backend/handler/organization.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
)

// OrgHandler handles organization HTTP requests.
type OrgHandler struct {
	orgService *service.OrganizationService
}

// NewOrgHandler creates a new OrgHandler.
func NewOrgHandler(orgService *service.OrganizationService) *OrgHandler {
	return &OrgHandler{orgService: orgService}
}

// Routes returns a chi.Router with all organization routes mounted.
func (h *OrgHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListOrgs)
	r.Post("/", h.CreateOrg)
	r.Get("/{orgID}", h.GetOrg)
	r.Get("/by-slug/{slug}", h.GetOrgBySlug)
	r.Patch("/{orgID}", h.UpdateOrg)
	r.Delete("/{orgID}", h.DeleteOrg)

	// Member sub-routes
	r.Get("/{orgID}/members", h.GetMembers)
	r.Post("/{orgID}/members", h.AddMember)
	r.Delete("/{orgID}/members/{playerID}", h.RemoveMember)
	r.Patch("/{orgID}/members/{playerID}/role", h.UpdateMemberRole)

	// Player self-service
	r.Post("/{orgID}/leave", h.LeaveSelf)
	r.Post("/{orgID}/block", h.BlockOrg)
	r.Delete("/{orgID}/block", h.UnblockOrg)

	return r
}

// CreateOrg creates a new organization. The creator becomes the Org Admin.
func (h *OrgHandler) CreateOrg(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name           string  `json:"name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		WebsiteURL     *string `json:"website_url"`
		ContactEmail   *string `json:"contact_email"`
		ContactPhone   *string `json:"contact_phone"`
		City           *string `json:"city"`
		StateProvince  *string `json:"state_province"`
		Country        *string `json:"country"`
		Bio            *string `json:"bio"`
		FoundedYear    *int32  `json:"founded_year"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	params := generated.CreateOrganizationParams{
		Name:            body.Name,
		LogoUrl:         body.LogoURL,
		PrimaryColor:    body.PrimaryColor,
		SecondaryColor:  body.SecondaryColor,
		WebsiteUrl:      body.WebsiteURL,
		ContactEmail:    body.ContactEmail,
		ContactPhone:    body.ContactPhone,
		City:            body.City,
		StateProvince:   body.StateProvince,
		Country:         body.Country,
		Bio:             body.Bio,
		FoundedYear:     body.FoundedYear,
		CreatedByUserID: user.ID,
	}

	org, err := h.orgService.CreateOrg(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, org)
}

// GetOrg retrieves an organization by ID.
func (h *OrgHandler) GetOrg(w http.ResponseWriter, r *http.Request) {
	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	org, err := h.orgService.GetOrg(r.Context(), orgID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, org)
}

// GetOrgBySlug retrieves an organization by slug.
func (h *OrgHandler) GetOrgBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	org, err := h.orgService.GetOrgBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, org)
}

// UpdateOrg updates an organization.
func (h *OrgHandler) UpdateOrg(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	var body struct {
		Name           *string `json:"name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		WebsiteURL     *string `json:"website_url"`
		ContactEmail   *string `json:"contact_email"`
		ContactPhone   *string `json:"contact_phone"`
		City           *string `json:"city"`
		StateProvince  *string `json:"state_province"`
		Country        *string `json:"country"`
		Bio            *string `json:"bio"`
		FoundedYear    *int32  `json:"founded_year"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateOrgParams{
		Name:           body.Name,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		WebsiteUrl:     body.WebsiteURL,
		ContactEmail:   body.ContactEmail,
		ContactPhone:   body.ContactPhone,
		City:           body.City,
		StateProvince:  body.StateProvince,
		Country:        body.Country,
		Bio:            body.Bio,
		FoundedYear:    body.FoundedYear,
	}

	org, err := h.orgService.UpdateOrg(r.Context(), orgID, user.ID, user.Role, params)
	if err != nil {
		WriteError(w, http.StatusForbidden, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, org)
}

// DeleteOrg soft-deletes an organization.
func (h *OrgHandler) DeleteOrg(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.DeleteOrg(r.Context(), orgID, user.ID, user.Role); err != nil {
		WriteError(w, http.StatusForbidden, "DELETE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "organization deleted"})
}

// ListOrgs lists organizations with pagination.
func (h *OrgHandler) ListOrgs(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	orgs, total, err := h.orgService.ListOrgs(r.Context(), limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	WritePaginated(w, http.StatusOK, orgs, total, limit, offset)
}

// GetMembers returns all active members of an organization.
func (h *OrgHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	members, err := h.orgService.GetMembers(r.Context(), orgID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "MEMBERS_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, members)
}

// AddMember adds a player to an organization.
func (h *OrgHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	var body struct {
		PlayerID int64  `json:"player_id"`
		Role     string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.PlayerID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "player_id is required")
		return
	}

	if body.Role == "" {
		body.Role = "member"
	}

	member, err := h.orgService.AddMember(r.Context(), orgID, body.PlayerID, body.Role, user.ID, user.Role)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "ADD_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, member)
}

// RemoveMember removes a player from an organization.
func (h *OrgHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	if err := h.orgService.RemoveMember(r.Context(), orgID, playerID, user.ID, user.Role); err != nil {
		WriteError(w, http.StatusForbidden, "REMOVE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "member removed"})
}

// UpdateMemberRole updates a member's role in an organization.
func (h *OrgHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	var body struct {
		Role string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	member, err := h.orgService.UpdateMemberRole(r.Context(), orgID, playerID, body.Role, user.ID, user.Role)
	if err != nil {
		WriteError(w, http.StatusForbidden, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, member)
}

// LeaveSelf allows a player to leave an organization voluntarily.
func (h *OrgHandler) LeaveSelf(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.RemoveMember(r.Context(), orgID, user.ID, user.ID, user.Role); err != nil {
		WriteError(w, http.StatusInternalServerError, "LEAVE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "left organization"})
}

// BlockOrg allows a player to block an organization.
func (h *OrgHandler) BlockOrg(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.BlockOrg(r.Context(), user.ID, orgID); err != nil {
		WriteError(w, http.StatusInternalServerError, "BLOCK_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "organization blocked"})
}

// UnblockOrg removes an organization block.
func (h *OrgHandler) UnblockOrg(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.UnblockOrg(r.Context(), user.ID, orgID); err != nil {
		WriteError(w, http.StatusInternalServerError, "UNBLOCK_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "organization unblocked"})
}
```

Note: The `UpdateMemberRole` method needs to be added to the `OrganizationService`. Add this to `backend/service/organization.go`:

```go
// UpdateMemberRole updates a member's role in an organization.
func (s *OrganizationService) UpdateMemberRole(ctx context.Context, orgID, playerID int64, role string, requesterID int64, requesterRole string) (generated.OrgMembership, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return generated.OrgMembership{}, err
	}

	validRoles := map[string]bool{"member": true, "admin": true}
	if !validRoles[role] {
		return generated.OrgMembership{}, fmt.Errorf("role must be one of: member, admin")
	}

	member, err := s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
		OrgID:    orgID,
		PlayerID: playerID,
		Role:     role,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to update member role: %w", err)
	}

	return member, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add organization HTTP handler with membership management"
```

---

## Task 13: Venues Migration

**Files:**
- Create: `backend/db/migrations/00005_create_venues.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00005_create_venues.sql

-- +goose Up
CREATE TABLE venues (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
    address_line_1      TEXT,
    address_line_2      TEXT,
    city                TEXT,
    state_province      TEXT,
    country             TEXT,
    postal_code         TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    timezone            TEXT,
    website_url         TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    logo_url            TEXT,
    photo_url           TEXT,
    venue_map_url       TEXT,
    description         TEXT,
    surface_types       JSONB DEFAULT '[]',
    amenities           JSONB DEFAULT '[]',
    org_id              BIGINT REFERENCES organizations(id),
    managed_by_user_id  BIGINT REFERENCES users(id),
    bio                 TEXT,
    notes               TEXT,
    created_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_venues_slug ON venues(slug);
CREATE INDEX idx_venues_status ON venues(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_deleted_at ON venues(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_name ON venues(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_location ON venues(latitude, longitude) WHERE deleted_at IS NULL AND latitude IS NOT NULL;
CREATE INDEX idx_venues_org_id ON venues(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_venues_managed_by ON venues(managed_by_user_id) WHERE managed_by_user_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS venues;
```

- [ ] **Step 2: Run migration**

Run:
```bash
cd backend && DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```
Expected: Migration applied. `venues` table created.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00005_create_venues.sql
git commit -m "feat: add venues table with approval workflow"
```

---

## Task 14: Courts Migration

**Files:**
- Create: `backend/db/migrations/00006_create_courts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00006_create_courts.sql

-- +goose Up
CREATE TABLE courts (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    venue_id        BIGINT REFERENCES venues(id),
    surface_type    TEXT CHECK (surface_type IN ('indoor_hard', 'outdoor_concrete', 'outdoor_sport_court', 'outdoor_wood', 'temporary', 'other')),
    is_show_court   BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_temporary    BOOLEAN NOT NULL DEFAULT false,
    sort_order      INT NOT NULL DEFAULT 0,
    notes           TEXT,
    stream_url      TEXT,
    stream_type     TEXT CHECK (stream_type IN ('youtube', 'twitch', 'vimeo', 'hls', 'other')),
    stream_is_live  BOOLEAN NOT NULL DEFAULT false,
    stream_title    TEXT,
    created_by_user_id BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- Slug is unique within a venue, but floating courts (venue_id IS NULL) have globally unique slugs
CREATE UNIQUE INDEX idx_courts_slug_venue ON courts(venue_id, slug) WHERE venue_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_courts_slug_global ON courts(slug) WHERE venue_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_courts_venue_id ON courts(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX idx_courts_deleted_at ON courts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_courts_active ON courts(is_active) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS courts;
```

- [ ] **Step 2: Run migration**

Run:
```bash
cd backend && DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```
Expected: Migration applied. `courts` table created.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00006_create_courts.sql
git commit -m "feat: add courts table with streaming and venue scoping"
```

---

## Task 15: Venue + Court Queries (sqlc)

**Files:**
- Create: `backend/db/queries/venues.sql`
- Create: `backend/db/queries/courts.sql`

- [ ] **Step 1: Create `backend/db/queries/venues.sql`**

```sql
-- backend/db/queries/venues.sql

-- name: CreateVenue :one
INSERT INTO venues (name, slug, status, address_line_1, address_line_2, city, state_province, country, postal_code, latitude, longitude, timezone, website_url, contact_email, contact_phone, logo_url, photo_url, venue_map_url, description, surface_types, amenities, org_id, managed_by_user_id, bio, notes, created_by_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
RETURNING *;

-- name: GetVenueByID :one
SELECT * FROM venues
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetVenueBySlug :one
SELECT * FROM venues
WHERE slug = $1 AND deleted_at IS NULL;

-- name: UpdateVenue :one
UPDATE venues SET
    name = COALESCE(sqlc.narg('name'), name),
    address_line_1 = COALESCE(sqlc.narg('address_line_1'), address_line_1),
    address_line_2 = COALESCE(sqlc.narg('address_line_2'), address_line_2),
    city = COALESCE(sqlc.narg('city'), city),
    state_province = COALESCE(sqlc.narg('state_province'), state_province),
    country = COALESCE(sqlc.narg('country'), country),
    postal_code = COALESCE(sqlc.narg('postal_code'), postal_code),
    latitude = COALESCE(sqlc.narg('latitude'), latitude),
    longitude = COALESCE(sqlc.narg('longitude'), longitude),
    timezone = COALESCE(sqlc.narg('timezone'), timezone),
    website_url = COALESCE(sqlc.narg('website_url'), website_url),
    contact_email = COALESCE(sqlc.narg('contact_email'), contact_email),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    logo_url = COALESCE(sqlc.narg('logo_url'), logo_url),
    photo_url = COALESCE(sqlc.narg('photo_url'), photo_url),
    venue_map_url = COALESCE(sqlc.narg('venue_map_url'), venue_map_url),
    description = COALESCE(sqlc.narg('description'), description),
    surface_types = COALESCE(sqlc.narg('surface_types'), surface_types),
    amenities = COALESCE(sqlc.narg('amenities'), amenities),
    bio = COALESCE(sqlc.narg('bio'), bio),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = now()
WHERE id = @venue_id AND deleted_at IS NULL
RETURNING *;

-- name: UpdateVenueStatus :one
UPDATE venues SET
    status = $2,
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteVenue :exec
UPDATE venues SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListVenues :many
SELECT * FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountVenues :one
SELECT count(*) FROM venues
WHERE deleted_at IS NULL
  AND (sqlc.narg('status')::TEXT IS NULL OR status = sqlc.narg('status')::TEXT);

-- name: SearchVenues :many
SELECT * FROM venues
WHERE deleted_at IS NULL
  AND status = 'published'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT)
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountSearchVenues :one
SELECT count(*) FROM venues
WHERE deleted_at IS NULL
  AND status = 'published'
  AND (
    sqlc.narg('query')::TEXT IS NULL
    OR name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
  )
  AND (sqlc.narg('city')::TEXT IS NULL OR city ILIKE sqlc.narg('city')::TEXT)
  AND (sqlc.narg('state_province')::TEXT IS NULL OR state_province = sqlc.narg('state_province')::TEXT)
  AND (sqlc.narg('country')::TEXT IS NULL OR country = sqlc.narg('country')::TEXT);

-- name: ListPendingVenues :many
SELECT * FROM venues
WHERE status = 'pending_review' AND deleted_at IS NULL
ORDER BY created_at
LIMIT $1 OFFSET $2;

-- name: CountPendingVenues :one
SELECT count(*) FROM venues
WHERE status = 'pending_review' AND deleted_at IS NULL;

-- name: CheckVenueSlugExists :one
SELECT count(*) FROM venues
WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetVenueCourtCount :one
SELECT count(*) FROM courts
WHERE venue_id = $1 AND deleted_at IS NULL;
```

- [ ] **Step 2: Create `backend/db/queries/courts.sql`**

```sql
-- backend/db/queries/courts.sql

-- name: CreateCourt :one
INSERT INTO courts (name, slug, venue_id, surface_type, is_show_court, is_active, is_temporary, sort_order, notes, stream_url, stream_type, stream_is_live, stream_title, created_by_user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: GetCourtByID :one
SELECT * FROM courts
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetCourtBySlug :one
SELECT * FROM courts
WHERE slug = $1 AND venue_id = $2 AND deleted_at IS NULL;

-- name: GetFloatingCourtBySlug :one
SELECT * FROM courts
WHERE slug = $1 AND venue_id IS NULL AND deleted_at IS NULL;

-- name: UpdateCourt :one
UPDATE courts SET
    name = COALESCE(sqlc.narg('name'), name),
    surface_type = COALESCE(sqlc.narg('surface_type'), surface_type),
    is_show_court = COALESCE(sqlc.narg('is_show_court'), is_show_court),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    is_temporary = COALESCE(sqlc.narg('is_temporary'), is_temporary),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    stream_url = COALESCE(sqlc.narg('stream_url'), stream_url),
    stream_type = COALESCE(sqlc.narg('stream_type'), stream_type),
    stream_is_live = COALESCE(sqlc.narg('stream_is_live'), stream_is_live),
    stream_title = COALESCE(sqlc.narg('stream_title'), stream_title),
    updated_at = now()
WHERE id = @court_id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteCourt :exec
UPDATE courts SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListCourtsByVenue :many
SELECT * FROM courts
WHERE venue_id = $1 AND deleted_at IS NULL
ORDER BY sort_order, name;

-- name: ListFloatingCourts :many
SELECT * FROM courts
WHERE venue_id IS NULL AND deleted_at IS NULL
ORDER BY name
LIMIT $1 OFFSET $2;

-- name: CountFloatingCourts :one
SELECT count(*) FROM courts
WHERE venue_id IS NULL AND deleted_at IS NULL;

-- name: CheckCourtSlugInVenue :one
SELECT count(*) FROM courts
WHERE slug = $1 AND venue_id = $2 AND deleted_at IS NULL;

-- name: CheckFloatingCourtSlug :one
SELECT count(*) FROM courts
WHERE slug = $1 AND venue_id IS NULL AND deleted_at IS NULL;

-- name: ArchiveTemporaryCourts :exec
UPDATE courts SET
    deleted_at = now(),
    updated_at = now()
WHERE venue_id = $1 AND is_temporary = true AND deleted_at IS NULL;
```

- [ ] **Step 3: Regenerate sqlc**

Run:
```bash
cd backend && sqlc generate
```
Expected: Clean generation.

- [ ] **Step 4: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 5: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add venue and court sqlc queries"
```

---

## Task 16: Venue + Court Service

**Files:**
- Create: `backend/service/venue.go`

- [ ] **Step 1: Create `backend/service/venue.go`**

```go
// backend/service/venue.go
package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// VenueService handles venue and court business logic.
type VenueService struct {
	queries *generated.Queries
}

// NewVenueService creates a new VenueService.
func NewVenueService(queries *generated.Queries) *VenueService {
	return &VenueService{queries: queries}
}

// VenueResponse is the public representation of a venue.
type VenueResponse struct {
	ID              int64    `json:"id"`
	Name            string   `json:"name"`
	Slug            string   `json:"slug"`
	Status          string   `json:"status"`
	AddressLine1    *string  `json:"address_line_1,omitempty"`
	AddressLine2    *string  `json:"address_line_2,omitempty"`
	City            *string  `json:"city,omitempty"`
	StateProvince   *string  `json:"state_province,omitempty"`
	Country         *string  `json:"country,omitempty"`
	PostalCode      *string  `json:"postal_code,omitempty"`
	Latitude        *float64 `json:"latitude,omitempty"`
	Longitude       *float64 `json:"longitude,omitempty"`
	Timezone        *string  `json:"timezone,omitempty"`
	WebsiteURL      *string  `json:"website_url,omitempty"`
	ContactEmail    *string  `json:"contact_email,omitempty"`
	ContactPhone    *string  `json:"contact_phone,omitempty"`
	LogoURL         *string  `json:"logo_url,omitempty"`
	PhotoURL        *string  `json:"photo_url,omitempty"`
	VenueMapURL     *string  `json:"venue_map_url,omitempty"`
	Description     *string  `json:"description,omitempty"`
	Bio             *string  `json:"bio,omitempty"`
	OrgID           *int64   `json:"org_id,omitempty"`
	ManagedByUserID *int64   `json:"managed_by_user_id,omitempty"`
	CourtCount      int64    `json:"court_count"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

// CourtResponse is the public representation of a court.
type CourtResponse struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	Slug          string  `json:"slug"`
	VenueID       *int64  `json:"venue_id,omitempty"`
	SurfaceType   *string `json:"surface_type,omitempty"`
	IsShowCourt   bool    `json:"is_show_court"`
	IsActive      bool    `json:"is_active"`
	IsTemporary   bool    `json:"is_temporary"`
	SortOrder     int32   `json:"sort_order"`
	StreamURL     *string `json:"stream_url,omitempty"`
	StreamType    *string `json:"stream_type,omitempty"`
	StreamIsLive  bool    `json:"stream_is_live"`
	StreamTitle   *string `json:"stream_title,omitempty"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

func toVenueResponse(v generated.Venue, courtCount int64) VenueResponse {
	return VenueResponse{
		ID:              v.ID,
		Name:            v.Name,
		Slug:            v.Slug,
		Status:          v.Status,
		AddressLine1:    v.AddressLine1,
		AddressLine2:    v.AddressLine2,
		City:            v.City,
		StateProvince:   v.StateProvince,
		Country:         v.Country,
		PostalCode:      v.PostalCode,
		Latitude:        v.Latitude,
		Longitude:       v.Longitude,
		Timezone:        v.Timezone,
		WebsiteURL:      v.WebsiteUrl,
		ContactEmail:    v.ContactEmail,
		ContactPhone:    v.ContactPhone,
		LogoURL:         v.LogoUrl,
		PhotoURL:        v.PhotoUrl,
		VenueMapURL:     v.VenueMapUrl,
		Description:     v.Description,
		Bio:             v.Bio,
		OrgID:           v.OrgID,
		ManagedByUserID: v.ManagedByUserID,
		CourtCount:      courtCount,
		CreatedAt:       v.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       v.UpdatedAt.Format(time.RFC3339),
	}
}

func toCourtResponse(c generated.Court) CourtResponse {
	return CourtResponse{
		ID:           c.ID,
		Name:         c.Name,
		Slug:         c.Slug,
		VenueID:      c.VenueID,
		SurfaceType:  c.SurfaceType,
		IsShowCourt:  c.IsShowCourt,
		IsActive:     c.IsActive,
		IsTemporary:  c.IsTemporary,
		SortOrder:    c.SortOrder,
		StreamURL:    c.StreamUrl,
		StreamType:   c.StreamType,
		StreamIsLive: c.StreamIsLive,
		StreamTitle:  c.StreamTitle,
		CreatedAt:    c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    c.UpdatedAt.Format(time.RFC3339),
	}
}

// DetectStreamType auto-detects stream platform from URL.
func DetectStreamType(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.Contains(lower, "youtube.com") || strings.Contains(lower, "youtu.be"):
		return "youtube"
	case strings.Contains(lower, "twitch.tv"):
		return "twitch"
	case strings.Contains(lower, "vimeo.com"):
		return "vimeo"
	case strings.HasSuffix(lower, ".m3u8"):
		return "hls"
	default:
		return "other"
	}
}

// CreateVenue creates a new venue in draft status.
func (s *VenueService) CreateVenue(ctx context.Context, params generated.CreateVenueParams) (VenueResponse, error) {
	params.Slug = generateSlug(params.Name)
	params.Status = "draft"

	// Check slug collision
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}
		count, err := s.queries.CheckVenueSlugExists(ctx, candidate)
		if err != nil {
			return VenueResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			break
		}
	}

	venue, err := s.queries.CreateVenue(ctx, params)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to create venue: %w", err)
	}

	return toVenueResponse(venue, 0), nil
}

// GetVenue retrieves a venue by ID with court count.
func (s *VenueService) GetVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("venue not found")
	}

	courtCount, _ := s.queries.GetVenueCourtCount(ctx, &venue.ID)

	return toVenueResponse(venue, courtCount), nil
}

// SubmitVenueForReview changes venue status from draft to pending_review.
func (s *VenueService) SubmitVenueForReview(ctx context.Context, venueID int64, requesterID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("venue not found")
	}

	if venue.CreatedByUserID != requesterID {
		return VenueResponse{}, fmt.Errorf("only the venue creator can submit for review")
	}

	if venue.Status != "draft" {
		return VenueResponse{}, fmt.Errorf("venue must be in draft status to submit for review")
	}

	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "pending_review",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to update status: %w", err)
	}

	courtCount, _ := s.queries.GetVenueCourtCount(ctx, &updated.ID)
	return toVenueResponse(updated, courtCount), nil
}

// ApproveVenue changes venue status from pending_review to published. Platform Admin only.
func (s *VenueService) ApproveVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("venue not found")
	}

	if venue.Status != "pending_review" {
		return VenueResponse{}, fmt.Errorf("venue must be pending review to approve")
	}

	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "published",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to approve venue: %w", err)
	}

	courtCount, _ := s.queries.GetVenueCourtCount(ctx, &updated.ID)
	return toVenueResponse(updated, courtCount), nil
}

// RejectVenue changes venue status back to draft. Platform Admin only.
func (s *VenueService) RejectVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "draft",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to reject venue: %w", err)
	}

	courtCount, _ := s.queries.GetVenueCourtCount(ctx, &updated.ID)
	return toVenueResponse(updated, courtCount), nil
}

// CreateCourt creates a new court, optionally attached to a venue.
func (s *VenueService) CreateCourt(ctx context.Context, params generated.CreateCourtParams) (CourtResponse, error) {
	params.Slug = generateSlug(params.Name)

	// Auto-detect stream type if URL provided
	if params.StreamUrl != nil && *params.StreamUrl != "" {
		st := DetectStreamType(*params.StreamUrl)
		params.StreamType = &st
	}

	// Check slug collision (scoped to venue or global for floating)
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}

		var count int64
		var err error
		if params.VenueID != nil {
			count, err = s.queries.CheckCourtSlugInVenue(ctx, generated.CheckCourtSlugInVenueParams{
				Slug:    candidate,
				VenueID: params.VenueID,
			})
		} else {
			count, err = s.queries.CheckFloatingCourtSlug(ctx, candidate)
		}
		if err != nil {
			return CourtResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			break
		}
	}

	court, err := s.queries.CreateCourt(ctx, params)
	if err != nil {
		return CourtResponse{}, fmt.Errorf("failed to create court: %w", err)
	}

	return toCourtResponse(court), nil
}

// GetCourt retrieves a court by ID.
func (s *VenueService) GetCourt(ctx context.Context, courtID int64) (CourtResponse, error) {
	court, err := s.queries.GetCourtByID(ctx, courtID)
	if err != nil {
		return CourtResponse{}, fmt.Errorf("court not found")
	}
	return toCourtResponse(court), nil
}

// ListCourtsByVenue lists all courts for a venue.
func (s *VenueService) ListCourtsByVenue(ctx context.Context, venueID int64) ([]CourtResponse, error) {
	courts, err := s.queries.ListCourtsByVenue(ctx, &venueID)
	if err != nil {
		return nil, fmt.Errorf("failed to list courts: %w", err)
	}

	result := make([]CourtResponse, len(courts))
	for i, c := range courts {
		result[i] = toCourtResponse(c)
	}

	return result, nil
}

// DeleteCourt soft-deletes a court.
func (s *VenueService) DeleteCourt(ctx context.Context, courtID int64) error {
	return s.queries.SoftDeleteCourt(ctx, courtID)
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add venue and court service with approval workflow"
```

---

## Task 17: Venue + Court HTTP Handlers

**Files:**
- Create: `backend/handler/venue.go`
- Create: `backend/handler/court.go`

- [ ] **Step 1: Create `backend/handler/venue.go`**

```go
// backend/handler/venue.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
)

// VenueHandler handles venue HTTP requests.
type VenueHandler struct {
	venueService *service.VenueService
}

// NewVenueHandler creates a new VenueHandler.
func NewVenueHandler(venueService *service.VenueService) *VenueHandler {
	return &VenueHandler{venueService: venueService}
}

// Routes returns a chi.Router with all venue routes mounted.
func (h *VenueHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListVenues)
	r.Post("/", h.CreateVenue)
	r.Get("/{venueID}", h.GetVenue)
	r.Patch("/{venueID}", h.UpdateVenue)
	r.Delete("/{venueID}", h.DeleteVenue)
	r.Post("/{venueID}/submit-for-review", h.SubmitForReview)
	r.Post("/{venueID}/approve", h.ApproveVenue)
	r.Post("/{venueID}/reject", h.RejectVenue)

	// Court sub-routes under venue
	r.Get("/{venueID}/courts", h.ListCourts)
	r.Post("/{venueID}/courts", h.CreateCourtForVenue)

	return r
}

// CreateVenue creates a new venue in draft status.
func (h *VenueHandler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name            string   `json:"name"`
		AddressLine1    *string  `json:"address_line_1"`
		AddressLine2    *string  `json:"address_line_2"`
		City            *string  `json:"city"`
		StateProvince   *string  `json:"state_province"`
		Country         *string  `json:"country"`
		PostalCode      *string  `json:"postal_code"`
		Latitude        *float64 `json:"latitude"`
		Longitude       *float64 `json:"longitude"`
		Timezone        *string  `json:"timezone"`
		WebsiteURL      *string  `json:"website_url"`
		ContactEmail    *string  `json:"contact_email"`
		ContactPhone    *string  `json:"contact_phone"`
		LogoURL         *string  `json:"logo_url"`
		PhotoURL        *string  `json:"photo_url"`
		VenueMapURL     *string  `json:"venue_map_url"`
		Description     *string  `json:"description"`
		Bio             *string  `json:"bio"`
		Notes           *string  `json:"notes"`
		OrgID           *int64   `json:"org_id"`
		ManagedByUserID *int64   `json:"managed_by_user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	params := generated.CreateVenueParams{
		Name:            body.Name,
		AddressLine1:    body.AddressLine1,
		AddressLine2:    body.AddressLine2,
		City:            body.City,
		StateProvince:   body.StateProvince,
		Country:         body.Country,
		PostalCode:      body.PostalCode,
		Latitude:        body.Latitude,
		Longitude:       body.Longitude,
		Timezone:        body.Timezone,
		WebsiteUrl:      body.WebsiteURL,
		ContactEmail:    body.ContactEmail,
		ContactPhone:    body.ContactPhone,
		LogoUrl:         body.LogoURL,
		PhotoUrl:        body.PhotoURL,
		VenueMapUrl:     body.VenueMapURL,
		Description:     body.Description,
		Bio:             body.Bio,
		Notes:           body.Notes,
		OrgID:           body.OrgID,
		ManagedByUserID: body.ManagedByUserID,
		CreatedByUserID: user.ID,
	}

	venue, err := h.venueService.CreateVenue(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, venue)
}

// GetVenue retrieves a venue by ID.
func (h *VenueHandler) GetVenue(w http.ResponseWriter, r *http.Request) {
	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.GetVenue(r.Context(), venueID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, venue)
}

// UpdateVenue updates a venue.
func (h *VenueHandler) UpdateVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	var body struct {
		Name         *string  `json:"name"`
		AddressLine1 *string  `json:"address_line_1"`
		AddressLine2 *string  `json:"address_line_2"`
		City         *string  `json:"city"`
		StateProvince *string `json:"state_province"`
		Country      *string  `json:"country"`
		PostalCode   *string  `json:"postal_code"`
		Latitude     *float64 `json:"latitude"`
		Longitude    *float64 `json:"longitude"`
		Timezone     *string  `json:"timezone"`
		WebsiteURL   *string  `json:"website_url"`
		ContactEmail *string  `json:"contact_email"`
		ContactPhone *string  `json:"contact_phone"`
		LogoURL      *string  `json:"logo_url"`
		PhotoURL     *string  `json:"photo_url"`
		VenueMapURL  *string  `json:"venue_map_url"`
		Description  *string  `json:"description"`
		Bio          *string  `json:"bio"`
		Notes        *string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateVenueParams{
		VenueID:       venueID,
		Name:          body.Name,
		AddressLine1:  body.AddressLine1,
		AddressLine2:  body.AddressLine2,
		City:          body.City,
		StateProvince: body.StateProvince,
		Country:       body.Country,
		PostalCode:    body.PostalCode,
		Latitude:      body.Latitude,
		Longitude:     body.Longitude,
		Timezone:      body.Timezone,
		WebsiteUrl:    body.WebsiteURL,
		ContactEmail:  body.ContactEmail,
		ContactPhone:  body.ContactPhone,
		LogoUrl:       body.LogoURL,
		PhotoUrl:      body.PhotoURL,
		VenueMapUrl:   body.VenueMapURL,
		Description:   body.Description,
		Bio:           body.Bio,
		Notes:         body.Notes,
	}

	venue, err := h.venueService.UpdateVenue(r.Context(), venueID, params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, venue)
}

// DeleteVenue soft-deletes a venue.
func (h *VenueHandler) DeleteVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	if err := h.venueService.DeleteVenue(r.Context(), venueID); err != nil {
		WriteError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "venue deleted"})
}

// ListVenues lists venues with pagination.
func (h *VenueHandler) ListVenues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	venues, total, err := h.venueService.ListVenues(r.Context(), limit, offset, status)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	WritePaginated(w, http.StatusOK, venues, total, limit, offset)
}

// SubmitForReview changes venue from draft to pending_review.
func (h *VenueHandler) SubmitForReview(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.SubmitVenueForReview(r.Context(), venueID, user.ID)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "SUBMIT_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, venue)
}

// ApproveVenue approves a venue (Platform Admin only).
func (h *VenueHandler) ApproveVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil || user.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Platform Admin only")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.ApproveVenue(r.Context(), venueID)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "APPROVE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, venue)
}

// RejectVenue rejects a venue (Platform Admin only).
func (h *VenueHandler) RejectVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil || user.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Platform Admin only")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.RejectVenue(r.Context(), venueID)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "REJECT_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, venue)
}

// ListCourts lists courts for a venue.
func (h *VenueHandler) ListCourts(w http.ResponseWriter, r *http.Request) {
	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	courts, err := h.venueService.ListCourtsByVenue(r.Context(), venueID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, courts)
}

// CreateCourtForVenue creates a court attached to a venue.
func (h *VenueHandler) CreateCourtForVenue(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	var body struct {
		Name        string  `json:"name"`
		SurfaceType *string `json:"surface_type"`
		IsShowCourt *bool   `json:"is_show_court"`
		IsTemporary *bool   `json:"is_temporary"`
		SortOrder   *int32  `json:"sort_order"`
		Notes       *string `json:"notes"`
		StreamURL   *string `json:"stream_url"`
		StreamTitle *string `json:"stream_title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	isShowCourt := false
	if body.IsShowCourt != nil {
		isShowCourt = *body.IsShowCourt
	}
	isTemporary := false
	if body.IsTemporary != nil {
		isTemporary = *body.IsTemporary
	}
	sortOrder := int32(0)
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}

	params := generated.CreateCourtParams{
		Name:             body.Name,
		VenueID:          &venueID,
		SurfaceType:      body.SurfaceType,
		IsShowCourt:      isShowCourt,
		IsActive:         true,
		IsTemporary:      isTemporary,
		SortOrder:        sortOrder,
		Notes:            body.Notes,
		StreamUrl:        body.StreamURL,
		StreamTitle:      body.StreamTitle,
		CreatedByUserID:  &user.ID,
	}

	court, err := h.venueService.CreateCourt(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, court)
}
```

- [ ] **Step 2: Create `backend/handler/court.go`**

```go
// backend/handler/court.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
)

// CourtHandler handles standalone court HTTP requests (floating courts).
type CourtHandler struct {
	venueService *service.VenueService
}

// NewCourtHandler creates a new CourtHandler.
func NewCourtHandler(venueService *service.VenueService) *CourtHandler {
	return &CourtHandler{venueService: venueService}
}

// Routes returns a chi.Router with court routes.
func (h *CourtHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.CreateFloatingCourt)
	r.Get("/{courtID}", h.GetCourt)
	r.Patch("/{courtID}", h.UpdateCourt)
	r.Delete("/{courtID}", h.DeleteCourt)

	return r
}

// CreateFloatingCourt creates a court without a venue (for overlay-only use).
func (h *CourtHandler) CreateFloatingCourt(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name        string  `json:"name"`
		SurfaceType *string `json:"surface_type"`
		Notes       *string `json:"notes"`
		StreamURL   *string `json:"stream_url"`
		StreamTitle *string `json:"stream_title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	params := generated.CreateCourtParams{
		Name:            body.Name,
		VenueID:         nil, // floating court
		SurfaceType:     body.SurfaceType,
		IsShowCourt:     false,
		IsActive:        true,
		IsTemporary:     false,
		SortOrder:       0,
		Notes:           body.Notes,
		StreamUrl:       body.StreamURL,
		StreamTitle:     body.StreamTitle,
		CreatedByUserID: &user.ID,
	}

	court, err := h.venueService.CreateCourt(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusCreated, court)
}

// GetCourt retrieves a court by ID.
func (h *CourtHandler) GetCourt(w http.ResponseWriter, r *http.Request) {
	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	court, err := h.venueService.GetCourt(r.Context(), courtID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, court)
}

// UpdateCourt updates a court.
func (h *CourtHandler) UpdateCourt(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var body struct {
		Name         *string `json:"name"`
		SurfaceType  *string `json:"surface_type"`
		IsShowCourt  *bool   `json:"is_show_court"`
		IsActive     *bool   `json:"is_active"`
		IsTemporary  *bool   `json:"is_temporary"`
		SortOrder    *int32  `json:"sort_order"`
		Notes        *string `json:"notes"`
		StreamURL    *string `json:"stream_url"`
		StreamType   *string `json:"stream_type"`
		StreamIsLive *bool   `json:"stream_is_live"`
		StreamTitle  *string `json:"stream_title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	// Auto-detect stream type if URL changes
	if body.StreamURL != nil && *body.StreamURL != "" && body.StreamType == nil {
		st := service.DetectStreamType(*body.StreamURL)
		body.StreamType = &st
	}

	params := generated.UpdateCourtParams{
		CourtID:      courtID,
		Name:         body.Name,
		SurfaceType:  body.SurfaceType,
		IsShowCourt:  body.IsShowCourt,
		IsActive:     body.IsActive,
		IsTemporary:  body.IsTemporary,
		SortOrder:    body.SortOrder,
		Notes:        body.Notes,
		StreamUrl:    body.StreamURL,
		StreamType:   body.StreamType,
		StreamIsLive: body.StreamIsLive,
		StreamTitle:  body.StreamTitle,
	}

	court, err := h.venueService.UpdateCourt(r.Context(), courtID, params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, court)
}

// DeleteCourt soft-deletes a court.
func (h *CourtHandler) DeleteCourt(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	if err := h.venueService.DeleteCourt(r.Context(), courtID); err != nil {
		WriteError(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}

	WriteSuccess(w, http.StatusOK, map[string]string{"message": "court deleted"})
}
```

Note: Add `UpdateVenue`, `DeleteVenue`, `ListVenues`, and `UpdateCourt` methods to `VenueService` in `backend/service/venue.go`:

```go
// UpdateVenue updates a venue's details.
func (s *VenueService) UpdateVenue(ctx context.Context, venueID int64, params generated.UpdateVenueParams) (VenueResponse, error) {
	params.VenueID = venueID
	venue, err := s.queries.UpdateVenue(ctx, params)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to update venue: %w", err)
	}
	courtCount, _ := s.queries.GetVenueCourtCount(ctx, &venue.ID)
	return toVenueResponse(venue, courtCount), nil
}

// DeleteVenue soft-deletes a venue.
func (s *VenueService) DeleteVenue(ctx context.Context, venueID int64) error {
	return s.queries.SoftDeleteVenue(ctx, venueID)
}

// ListVenues lists venues with pagination and optional status filter.
func (s *VenueService) ListVenues(ctx context.Context, limit, offset int32, status *string) ([]VenueResponse, int64, error) {
	venues, err := s.queries.ListVenues(ctx, generated.ListVenuesParams{
		Limit:  limit,
		Offset: offset,
		Status: status,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list venues: %w", err)
	}

	count, err := s.queries.CountVenues(ctx, generated.CountVenuesParams{
		Status: status,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count venues: %w", err)
	}

	result := make([]VenueResponse, len(venues))
	for i, v := range venues {
		courtCount, _ := s.queries.GetVenueCourtCount(ctx, &v.ID)
		result[i] = toVenueResponse(v, courtCount)
	}

	return result, count, nil
}

// UpdateCourt updates a court's details.
func (s *VenueService) UpdateCourt(ctx context.Context, courtID int64, params generated.UpdateCourtParams) (CourtResponse, error) {
	params.CourtID = courtID
	court, err := s.queries.UpdateCourt(ctx, params)
	if err != nil {
		return CourtResponse{}, fmt.Errorf("failed to update court: %w", err)
	}
	return toCourtResponse(court), nil
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add venue and court HTTP handlers"
```

---

## Task 18: Middleware Update — RequirePlatformAdmin

**Files:**
- Modify: `backend/middleware/auth.go`

- [ ] **Step 1: Add RequirePlatformAdmin middleware to `backend/middleware/auth.go`**

Add the following function to the existing `auth.go` file:

```go
// RequirePlatformAdmin is middleware that requires the user to be a platform admin.
func RequirePlatformAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"Not authenticated"}}`, http.StatusUnauthorized)
			return
		}
		if user.Role != "platform_admin" {
			http.Error(w, `{"error":{"code":"FORBIDDEN","message":"Platform Admin required"}}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add RequirePlatformAdmin middleware"
```

---

## Task 19: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Update `backend/router/router.go` to mount all new route groups**

The existing router from Phase 1 mounts auth and health routes. Add the new entity routes:

```go
// In the Setup function, after existing auth routes, add:

// Player routes (authenticated)
playerService := service.NewPlayerService(queries)
playerHandler := handler.NewPlayerHandler(playerService)
r.Route("/api/v1/players", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Mount("/", playerHandler.Routes())
})

// Team routes (authenticated)
teamService := service.NewTeamService(queries)
teamHandler := handler.NewTeamHandler(teamService)
r.Route("/api/v1/teams", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Mount("/", teamHandler.Routes())
})

// Organization routes (authenticated)
orgService := service.NewOrganizationService(queries)
orgHandler := handler.NewOrgHandler(orgService)
r.Route("/api/v1/organizations", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Mount("/", orgHandler.Routes())
})

// Venue routes (mixed auth — some public reads, some require auth)
venueService := service.NewVenueService(queries)
venueHandler := handler.NewVenueHandler(venueService)
r.Route("/api/v1/venues", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Mount("/", venueHandler.Routes())
})

// Court routes (authenticated — standalone/floating courts)
courtHandler := handler.NewCourtHandler(venueService)
r.Route("/api/v1/courts", func(r chi.Router) {
    r.Use(middleware.RequireAuth)
    r.Mount("/", courtHandler.Routes())
})
```

Note: The exact integration depends on how Phase 1's router is structured (constructor params, etc.). The service and handler instantiation follows the same pattern as `AuthService` / `AuthHandler` from Phase 1.

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: mount player, team, org, venue, and court routes"
```

---

## Task 20: Integration Smoke Test

**Files:**
- None (manual verification)

- [ ] **Step 1: Start the full stack**

Run:
```bash
make up && sleep 3 && cd backend && go run main.go &
sleep 2
```

- [ ] **Step 2: Register a test user**

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","first_name":"Jane","last_name":"Doe","date_of_birth":"1990-05-15"}' | jq
```
Expected: 201 with user data.

- [ ] **Step 3: Login and save session cookie**

```bash
curl -s -c cookies.txt -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' | jq
```

- [ ] **Step 4: Update player profile**

```bash
curl -s -b cookies.txt -X PATCH http://localhost:8080/api/v1/players/me \
  -H "Content-Type: application/json" \
  -d '{"city":"Dallas","state_province":"TX","handedness":"right","paddle_brand":"Selkirk"}' | jq
```
Expected: 200 with updated profile fields.

- [ ] **Step 5: Create a team**

```bash
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"Dallas Dinkers","short_name":"DDK"}' | jq
```
Expected: 201 with team data including auto-generated slug.

- [ ] **Step 6: Create an organization**

```bash
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"North Texas Pickleball Club","city":"Dallas","state_province":"TX","country":"US"}' | jq
```
Expected: 201 with org data. Creator auto-added as admin member.

- [ ] **Step 7: Create a venue**

```bash
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/venues \
  -H "Content-Type: application/json" \
  -d '{"name":"Chicken N Pickle Dallas","city":"Dallas","state_province":"TX","timezone":"America/Chicago"}' | jq
```
Expected: 201 with venue in `draft` status.

- [ ] **Step 8: Create a court within the venue**

```bash
# Use venue ID from step 7
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/venues/1/courts \
  -H "Content-Type: application/json" \
  -d '{"name":"Court 1","surface_type":"indoor_hard"}' | jq
```
Expected: 201 with court data.

- [ ] **Step 9: Create a floating court (no venue)**

```bash
curl -s -b cookies.txt -X POST http://localhost:8080/api/v1/courts \
  -H "Content-Type: application/json" \
  -d '{"name":"Streaming Court","stream_url":"https://youtube.com/live/abc123"}' | jq
```
Expected: 201 with `venue_id: null` and `stream_type: "youtube"`.

- [ ] **Step 10: Search players**

```bash
curl -s -b cookies.txt "http://localhost:8080/api/v1/players/search?q=Jane" | jq
```
Expected: Paginated results with Jane Doe.

- [ ] **Step 11: Cleanup**

```bash
kill %1 2>/dev/null  # Stop the Go server
rm -f cookies.txt
```

---

## Task 21: Final Verification

- [ ] **Step 1: Run full compilation check**

Run: `cd backend && go build ./...`
Expected: Clean exit.

- [ ] **Step 2: Run any existing Phase 1 tests**

Run: `cd backend && go test ./... -v -count=1`
Expected: All Phase 1 tests still pass.

- [ ] **Step 3: Update `.gitignore` if needed**

Verify `backend/db/generated/` is in `.gitignore` (added in Phase 1).

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: complete Phase 2 — Registry (players, teams, orgs, venues, courts)"
```

---

## API Endpoints Summary (Phase 2)

### Players
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/players/me` | Get own profile (private) |
| `PATCH` | `/api/v1/players/me` | Update own profile |
| `POST` | `/api/v1/players/me/waiver` | Accept platform waiver |
| `GET` | `/api/v1/players/{playerID}` | Get player profile |
| `GET` | `/api/v1/players/by-public-id/{publicID}` | Get player by CC-XXXXX |
| `GET` | `/api/v1/players/search` | Search players |

### Teams
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/teams` | List teams |
| `POST` | `/api/v1/teams` | Create team |
| `GET` | `/api/v1/teams/{teamID}` | Get team |
| `GET` | `/api/v1/teams/by-slug/{slug}` | Get team by slug |
| `PATCH` | `/api/v1/teams/{teamID}` | Update team |
| `DELETE` | `/api/v1/teams/{teamID}` | Delete team |
| `GET` | `/api/v1/teams/search` | Search teams |
| `GET` | `/api/v1/teams/{teamID}/roster` | Get team roster |
| `POST` | `/api/v1/teams/{teamID}/roster` | Add player to roster |
| `DELETE` | `/api/v1/teams/{teamID}/roster/{playerID}` | Remove player from roster |

### Organizations
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/organizations` | List organizations |
| `POST` | `/api/v1/organizations` | Create organization (becomes admin) |
| `GET` | `/api/v1/organizations/{orgID}` | Get organization |
| `GET` | `/api/v1/organizations/by-slug/{slug}` | Get org by slug |
| `PATCH` | `/api/v1/organizations/{orgID}` | Update organization |
| `DELETE` | `/api/v1/organizations/{orgID}` | Delete organization |
| `GET` | `/api/v1/organizations/{orgID}/members` | List members |
| `POST` | `/api/v1/organizations/{orgID}/members` | Add member |
| `DELETE` | `/api/v1/organizations/{orgID}/members/{playerID}` | Remove member |
| `PATCH` | `/api/v1/organizations/{orgID}/members/{playerID}/role` | Update member role |
| `POST` | `/api/v1/organizations/{orgID}/leave` | Leave org (self) |
| `POST` | `/api/v1/organizations/{orgID}/block` | Block org |
| `DELETE` | `/api/v1/organizations/{orgID}/block` | Unblock org |

### Venues
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/venues` | List venues |
| `POST` | `/api/v1/venues` | Create venue (draft) |
| `GET` | `/api/v1/venues/{venueID}` | Get venue |
| `PATCH` | `/api/v1/venues/{venueID}` | Update venue |
| `DELETE` | `/api/v1/venues/{venueID}` | Delete venue |
| `POST` | `/api/v1/venues/{venueID}/submit-for-review` | Submit for review |
| `POST` | `/api/v1/venues/{venueID}/approve` | Approve (Platform Admin) |
| `POST` | `/api/v1/venues/{venueID}/reject` | Reject (Platform Admin) |
| `GET` | `/api/v1/venues/{venueID}/courts` | List venue courts |
| `POST` | `/api/v1/venues/{venueID}/courts` | Create court in venue |

### Courts (standalone)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/courts` | Create floating court |
| `GET` | `/api/v1/courts/{courtID}` | Get court |
| `PATCH` | `/api/v1/courts/{courtID}` | Update court |
| `DELETE` | `/api/v1/courts/{courtID}` | Delete court |
