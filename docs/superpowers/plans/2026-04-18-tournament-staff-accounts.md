# Tournament Staff Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create dedicated referee and scorekeeper user accounts when a tournament is created, display their credentials in a Staff tab, and scope their ref console view to only that tournament's courts.

**Architecture:** New `tournament_staff` junction table links tournaments to auto-created user accounts, storing the raw password so TDs can share credentials. The tournament service creates staff accounts transactionally during `CreateTournament`. A new handler serves staff endpoints. The frontend adds a Staff tab to tournament detail and modifies RefHome to scope courts by tournament assignment.

**Tech Stack:** Go (chi router, pgx, sqlc, bcrypt), React (TanStack Query, TanStack Router), PostgreSQL

---

## File Map

### Files to Create
| File | Purpose |
|------|---------|
| `backend/db/migrations/00038_create_tournament_staff.sql` | Migration: `tournament_staff` table |
| `backend/db/queries/tournament_staff.sql` | sqlc queries for tournament staff CRUD |
| `backend/service/tournament_staff.go` | Service layer for staff operations |
| `backend/handler/tournament_staff.go` | HTTP handler for staff endpoints |
| `frontend/src/features/tournaments/TournamentStaff.tsx` | Staff tab UI component |

### Files to Modify
| File | Change |
|------|--------|
| `backend/service/tournament.go` | Update `Create()` to auto-create staff accounts in a transaction |
| `backend/router/router.go` | Add `TournamentStaffHandler` to Config, mount staff routes |
| `backend/main.go` | Wire `TournamentStaffService` and `TournamentStaffHandler` |
| `backend/handler/auth.go` | Add `GET /me/tournament-staff` endpoint |
| `backend/service/auth.go` | Add `GetMyTournamentStaff()` method |
| `frontend/src/features/tournaments/hooks.ts` | Add `useTournamentStaff`, `useRegenerateStaffPassword` hooks |
| `frontend/src/features/tournaments/TournamentDetail.tsx` | Add Staff tab |
| `frontend/src/features/scoring/hooks.ts` | Add `useMyTournamentAssignment()` hook |
| `frontend/src/features/referee/RefHome.tsx` | Scope courts by tournament for staff users |

### Files to Regenerate
| File | How |
|------|-----|
| `backend/db/generated/tournament_staff.sql.go` | `sqlc generate` |
| `backend/db/generated/models.go` | `sqlc generate` (adds `TournamentStaff` model) |
| `frontend/src/routeTree.gen.ts` | `pnpm dev` (no new routes needed, existing route) |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/db/migrations/00038_create_tournament_staff.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- +goose Up
CREATE TABLE tournament_staff (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('referee', 'scorekeeper')),
    raw_password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tournament_id, role)
);

CREATE INDEX idx_tournament_staff_tournament ON tournament_staff(tournament_id);
CREATE INDEX idx_tournament_staff_user ON tournament_staff(user_id);

-- +goose Down
DROP TABLE IF EXISTS tournament_staff;
```

- [ ] **Step 2: Verify migration compiles with goose**

Run: `cd backend && go build ./...`
Expected: No errors (migrations are embedded via `//go:embed`)

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/00038_create_tournament_staff.sql
git commit -m "feat: add tournament_staff migration"
```

---

## Task 2: sqlc Queries

**Files:**
- Create: `backend/db/queries/tournament_staff.sql`
- Regenerate: `backend/db/generated/` (via `sqlc generate`)

- [ ] **Step 1: Create the query file**

```sql
-- name: CreateTournamentStaffEntry :one
INSERT INTO tournament_staff (tournament_id, user_id, role, raw_password)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTournamentStaff :many
SELECT ts.id, ts.tournament_id, ts.user_id, ts.role, ts.raw_password, ts.created_at,
       u.first_name, u.last_name, u.email, u.public_id
FROM tournament_staff ts
JOIN users u ON u.id = ts.user_id
WHERE ts.tournament_id = $1
ORDER BY ts.role ASC;

-- name: GetTournamentStaffByUserID :one
SELECT ts.id, ts.tournament_id, ts.user_id, ts.role, ts.raw_password, ts.created_at,
       t.name as tournament_name
FROM tournament_staff ts
JOIN tournaments t ON t.id = ts.tournament_id
WHERE ts.user_id = $1;

-- name: UpdateTournamentStaffPassword :one
UPDATE tournament_staff
SET raw_password = $1
WHERE tournament_id = $2 AND role = $3
RETURNING *;

-- name: DeleteTournamentStaffByTournamentAndRole :exec
DELETE FROM tournament_staff
WHERE tournament_id = $1 AND role = $2;
```

- [ ] **Step 2: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: No errors. New file `backend/db/generated/tournament_staff.sql.go` created. `models.go` updated with `TournamentStaff` struct.

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add backend/db/queries/tournament_staff.sql backend/db/generated/
git commit -m "feat: add sqlc queries for tournament staff"
```

---

## Task 3: Tournament Staff Service

**Files:**
- Create: `backend/service/tournament_staff.go`

- [ ] **Step 1: Create the service file**

```go
package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/court-command/court-command/db/generated"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const passwordLength = 16

type TournamentStaffService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

func NewTournamentStaffService(queries *generated.Queries, pool *pgxpool.Pool) *TournamentStaffService {
	return &TournamentStaffService{queries: queries, pool: pool}
}

type StaffMemberResponse struct {
	ID           int64     `json:"id"`
	TournamentID int64     `json:"tournament_id"`
	UserID       int64     `json:"user_id"`
	Role         string    `json:"role"`
	RawPassword  string    `json:"raw_password"`
	Email        *string   `json:"email"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	PublicID     string    `json:"public_id"`
	CreatedAt    time.Time `json:"created_at"`
}

type MyTournamentAssignment struct {
	TournamentID   int64  `json:"tournament_id"`
	TournamentName string `json:"tournament_name"`
	Role           string `json:"role"`
}

func generatePassword() (string, error) {
	result := make([]byte, passwordLength)
	for i := range result {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordChars))))
		if err != nil {
			return "", fmt.Errorf("generating random password: %w", err)
		}
		result[i] = passwordChars[idx.Int64()]
	}
	return string(result), nil
}

func (s *TournamentStaffService) CreateStaffAccounts(ctx context.Context, tournamentID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	roles := []struct {
		emailPrefix string
		role        string
		firstName   string
	}{
		{"ref", "referee", "Referee"},
		{"score", "scorekeeper", "Scorekeeper"},
	}

	for _, r := range roles {
		rawPassword, err := generatePassword()
		if err != nil {
			return err
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}

		email := fmt.Sprintf("%s%d@cc.dev", r.emailPrefix, tournamentID)
		lastName := fmt.Sprintf("T-%d", tournamentID)

		user, err := qtx.CreateUser(ctx, generated.CreateUserParams{
			Email:        &email,
			PasswordHash: string(hash),
			FirstName:    r.firstName,
			LastName:     lastName,
			Role:         r.role,
		})
		if err != nil {
			return fmt.Errorf("creating %s user: %w", r.role, err)
		}

		_, err = qtx.CreateTournamentStaffEntry(ctx, generated.CreateTournamentStaffEntryParams{
			TournamentID: tournamentID,
			UserID:       user.ID,
			Role:         r.role,
			RawPassword:  rawPassword,
		})
		if err != nil {
			return fmt.Errorf("creating %s staff entry: %w", r.role, err)
		}
	}

	return tx.Commit(ctx)
}

func (s *TournamentStaffService) GetStaff(ctx context.Context, tournamentID int64) ([]StaffMemberResponse, error) {
	rows, err := s.queries.GetTournamentStaff(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("getting tournament staff: %w", err)
	}

	result := make([]StaffMemberResponse, len(rows))
	for i, row := range rows {
		result[i] = StaffMemberResponse{
			ID:           row.ID,
			TournamentID: row.TournamentID,
			UserID:       row.UserID,
			Role:         row.Role,
			RawPassword:  row.RawPassword,
			Email:        row.Email,
			FirstName:    row.FirstName,
			LastName:     row.LastName,
			PublicID:     row.PublicID,
			CreatedAt:    row.CreatedAt,
		}
	}
	return result, nil
}

func (s *TournamentStaffService) RegeneratePassword(ctx context.Context, tournamentID int64, role string) (*StaffMemberResponse, error) {
	if role != "referee" && role != "scorekeeper" {
		return nil, NewValidation("role must be 'referee' or 'scorekeeper'")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	rawPassword, err := generatePassword()
	if err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	// Update raw password in tournament_staff
	staffEntry, err := qtx.UpdateTournamentStaffPassword(ctx, generated.UpdateTournamentStaffPasswordParams{
		RawPassword:  rawPassword,
		TournamentID: tournamentID,
		Role:         role,
	})
	if err != nil {
		return nil, NewNotFound("staff entry not found")
	}

	// Update password hash on the user record
	_, err = qtx.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           staffEntry.UserID,
		PasswordHash: string(hash),
	})
	if err != nil {
		return nil, fmt.Errorf("updating user password: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	// Fetch full staff list to return the updated entry
	staff, err := s.GetStaff(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	for _, m := range staff {
		if m.Role == role {
			return &m, nil
		}
	}
	return nil, NewNotFound("staff entry not found after update")
}

func (s *TournamentStaffService) GetAssignmentByUserID(ctx context.Context, userID int64) (*MyTournamentAssignment, error) {
	row, err := s.queries.GetTournamentStaffByUserID(ctx, userID)
	if err != nil {
		return nil, NewNotFound("no tournament assignment found")
	}
	return &MyTournamentAssignment{
		TournamentID:   row.TournamentID,
		TournamentName: row.TournamentName,
		Role:           row.Role,
	}, nil
}
```

**Important:** This file references `UpdateUserPassword` which doesn't exist yet. We need to add it.

- [ ] **Step 2: Add `UpdateUserPassword` query to users.sql**

Add to the end of `backend/db/queries/users.sql`:

```sql
-- name: UpdateUserPassword :one
UPDATE users
SET password_hash = $2, updated_at = now()
WHERE id = $1
RETURNING *;
```

- [ ] **Step 3: Run sqlc generate**

Run: `cd backend && sqlc generate`
Expected: Clean generation

- [ ] **Step 4: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add backend/service/tournament_staff.go backend/db/queries/users.sql backend/db/generated/
git commit -m "feat: add tournament staff service with password generation"
```

---

## Task 4: Tournament Staff Handler

**Files:**
- Create: `backend/handler/tournament_staff.go`

- [ ] **Step 1: Create the handler file**

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

type TournamentStaffHandler struct {
	staffSvc      *service.TournamentStaffService
	tournamentSvc *service.TournamentService
}

func NewTournamentStaffHandler(staffSvc *service.TournamentStaffService, tournamentSvc *service.TournamentService) *TournamentStaffHandler {
	return &TournamentStaffHandler{staffSvc: staffSvc, tournamentSvc: tournamentSvc}
}

func (h *TournamentStaffHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.GetStaff)
	r.Post("/regenerate/{role}", h.RegeneratePassword)
	return r
}

func (h *TournamentStaffHandler) GetStaff(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid tournament ID")
		return
	}

	// Only TD or platform_admin can view staff credentials
	isTD, err := h.tournamentSvc.IsTD(r.Context(), tournamentID, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !isTD && sess.Role != "platform_admin" {
		Forbidden(w, "only tournament directors and admins can view staff accounts")
		return
	}

	staff, err := h.staffSvc.GetStaff(r.Context(), tournamentID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, staff)
}

func (h *TournamentStaffHandler) RegeneratePassword(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid tournament ID")
		return
	}

	role := chi.URLParam(r, "role")

	// Only TD or platform_admin can regenerate passwords
	isTD, err := h.tournamentSvc.IsTD(r.Context(), tournamentID, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !isTD && sess.Role != "platform_admin" {
		Forbidden(w, "only tournament directors and admins can regenerate staff passwords")
		return
	}

	updated, err := h.staffSvc.RegeneratePassword(r.Context(), tournamentID, role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, updated)
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Clean build (handler won't be wired yet, but should compile)

- [ ] **Step 3: Commit**

```bash
git add backend/handler/tournament_staff.go
git commit -m "feat: add tournament staff HTTP handler"
```

---

## Task 5: Update Tournament Create to Auto-Create Staff

**Files:**
- Modify: `backend/service/tournament.go` — `Create()` method

- [ ] **Step 1: Add `staffService` field to `TournamentService`**

In `backend/service/tournament.go`, update the struct and constructor:

Change the struct definition (around line 14-17) from:
```go
type TournamentService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}
```
to:
```go
type TournamentService struct {
	queries      *generated.Queries
	pool         *pgxpool.Pool
	staffService *TournamentStaffService
}
```

Change the constructor from:
```go
func NewTournamentService(queries *generated.Queries, pool *pgxpool.Pool) *TournamentService {
	return &TournamentService{queries: queries, pool: pool}
}
```
to:
```go
func NewTournamentService(queries *generated.Queries, pool *pgxpool.Pool, staffService *TournamentStaffService) *TournamentService {
	return &TournamentService{queries: queries, pool: pool, staffService: staffService}
}
```

- [ ] **Step 2: Add staff creation to `Create()` method**

After the `s.queries.CreateTournament(ctx, params)` call and before the return in `Create()`, add:

```go
	// Auto-create staff accounts (ref + scorekeeper)
	if err := s.staffService.CreateStaffAccounts(ctx, tournament.ID); err != nil {
		return TournamentResponse{}, fmt.Errorf("creating staff accounts: %w", err)
	}
```

- [ ] **Step 3: Update main.go wiring**

In `backend/main.go`, update the service creation order. The `TournamentStaffService` must be created before `TournamentService`:

Find where `tournamentService` is created and change from:
```go
tournamentService := service.NewTournamentService(queries, pool)
```
to:
```go
tournamentStaffService := service.NewTournamentStaffService(queries, pool)
tournamentService := service.NewTournamentService(queries, pool, tournamentStaffService)
```

Also create the handler and add it to the router config. After `tournamentHandler` creation, add:
```go
tournamentStaffHandler := handler.NewTournamentStaffHandler(tournamentStaffService, tournamentService)
```

Add `TournamentStaffHandler` to the `router.Config` struct initialization.

- [ ] **Step 4: Update router Config struct and mount routes**

In `backend/router/router.go`, add `TournamentStaffHandler` to the `Config` struct:
```go
TournamentStaffHandler *handler.TournamentStaffHandler
```

Mount the staff routes inside the `/tournaments` route group, after the courts routes:
```go
r.Route("/{tournamentID}/staff", func(r chi.Router) {
    r.Mount("/", cfg.TournamentStaffHandler.Routes())
})
```

- [ ] **Step 5: Verify compilation**

Run: `cd backend && go build ./... && go vet ./...`
Expected: Clean build and vet

- [ ] **Step 6: Commit**

```bash
git add backend/service/tournament.go backend/main.go backend/router/router.go
git commit -m "feat: auto-create staff accounts on tournament creation"
```

---

## Task 6: Auth Endpoint for Tournament Assignment

**Files:**
- Modify: `backend/handler/auth.go`
- Modify: `backend/service/auth.go`
- Modify: `backend/router/router.go` (if needed for new auth route)

- [ ] **Step 1: Add staff service dependency to AuthService**

In `backend/service/auth.go`, update `AuthService` to accept a staff service. Add a field:
```go
type AuthService struct {
	db           *pgxpool.Pool
	queries      *generated.Queries
	sessionStore *session.Store
	staffQueries *generated.Queries // reuse queries for staff lookups
}
```

Actually, since `AuthService` already has `queries`, just add a method that uses the existing queries:

```go
func (s *AuthService) GetMyTournamentStaff(ctx context.Context, userID int64) (*TournamentStaffAssignment, error) {
	row, err := s.queries.GetTournamentStaffByUserID(ctx, userID)
	if err != nil {
		return nil, NewNotFound("no tournament assignment found")
	}
	return &TournamentStaffAssignment{
		TournamentID:   row.TournamentID,
		TournamentName: row.TournamentName,
		Role:           row.Role,
	}, nil
}

type TournamentStaffAssignment struct {
	TournamentID   int64  `json:"tournament_id"`
	TournamentName string `json:"tournament_name"`
	Role           string `json:"role"`
}
```

- [ ] **Step 2: Add handler method to AuthHandler**

In `backend/handler/auth.go`, add:

```go
func (h *AuthHandler) MyTournamentStaff(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	assignment, err := h.authService.GetMyTournamentStaff(r.Context(), sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, assignment)
}
```

- [ ] **Step 3: Register the route**

In `backend/handler/auth.go`, find the `Routes()` method for `AuthHandler` (or in `router.go` where auth routes are mounted). Add inside the `RequireAuth` group:

```go
r.Get("/me/tournament-staff", cfg.AuthHandler.MyTournamentStaff)
```

This goes in `backend/router/router.go` in the auth route group, inside the RequireAuth section alongside `GET /me`.

- [ ] **Step 4: Verify compilation**

Run: `cd backend && go build ./... && go vet ./...`
Expected: Clean build and vet

- [ ] **Step 5: Commit**

```bash
git add backend/service/auth.go backend/handler/auth.go backend/router/router.go
git commit -m "feat: add /me/tournament-staff endpoint for staff assignment lookup"
```

---

## Task 7: Frontend Hooks

**Files:**
- Modify: `frontend/src/features/tournaments/hooks.ts`
- Modify: `frontend/src/features/scoring/hooks.ts`

- [ ] **Step 1: Add staff types and hooks to tournament hooks**

At the end of `frontend/src/features/tournaments/hooks.ts`, add:

```tsx
// --- Tournament Staff ---

export interface TournamentStaffMember {
  id: number
  tournament_id: number
  user_id: number
  role: string
  raw_password: string
  email: string | null
  first_name: string
  last_name: string
  public_id: string
  created_at: string
}

export function useTournamentStaff(tournamentId: number) {
  return useQuery<TournamentStaffMember[]>({
    queryKey: ['tournaments', tournamentId, 'staff'],
    queryFn: () => apiGet<TournamentStaffMember[]>(`/api/v1/tournaments/${tournamentId}/staff`),
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRegenerateStaffPassword(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: string) =>
      apiPost<TournamentStaffMember>(`/api/v1/tournaments/${tournamentId}/staff/regenerate/${role}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId, 'staff'] })
    },
  })
}
```

- [ ] **Step 2: Add tournament assignment hook to scoring hooks**

At the end of `frontend/src/features/scoring/hooks.ts`, add:

```tsx
export interface MyTournamentAssignment {
  tournament_id: number
  tournament_name: string
  role: string
}

export function useMyTournamentAssignment() {
  return useQuery<MyTournamentAssignment>({
    queryKey: ['auth', 'tournament-staff'],
    queryFn: () => apiGet<MyTournamentAssignment>('/api/v1/auth/me/tournament-staff'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/tournaments/hooks.ts frontend/src/features/scoring/hooks.ts
git commit -m "feat: add frontend hooks for tournament staff and assignment"
```

---

## Task 8: TournamentStaff Component

**Files:**
- Create: `frontend/src/features/tournaments/TournamentStaff.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { useTournamentStaff, useRegenerateStaffPassword } from './hooks'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'

interface TournamentStaffProps {
  tournamentId: number
}

function StaffCard({
  member,
  onRegenerate,
  isRegenerating,
}: {
  member: {
    role: string
    email: string | null
    raw_password: string
    first_name: string
    public_id: string
  }
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast } = useToast()

  const roleLabel = member.role === 'referee' ? 'Referee' : 'Scorekeeper'
  const badgeVariant = member.role === 'referee' ? 'info' : 'success'

  function handleCopy() {
    const text = `Email: ${member.email}\nPassword: ${member.raw_password}`
    navigator.clipboard.writeText(text).then(() => {
      toast('success', 'Credentials copied to clipboard')
    }).catch(() => {
      toast('error', 'Failed to copy credentials')
    })
  }

  function handleConfirmRegenerate() {
    setConfirmOpen(false)
    onRegenerate()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {roleLabel}
        </h3>
        <Badge variant={badgeVariant}>{roleLabel}</Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Email
          </label>
          <p className="font-mono text-sm text-gray-900 dark:text-white">
            {member.email}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Password
          </label>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-gray-900 dark:text-white">
              {showPassword ? member.raw_password : '••••••••••••••••'}
            </p>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          Copy Credentials
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          loading={isRegenerating}
        >
          Regenerate Password
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Regenerate Password"
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          This will generate a new password for the {roleLabel.toLowerCase()} account.
          The old password will stop working immediately. Are you sure?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmRegenerate}>
            Regenerate
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export function TournamentStaff({ tournamentId }: TournamentStaffProps) {
  const { data: staff, isLoading, error } = useTournamentStaff(tournamentId)
  const regenerate = useRegenerateStaffPassword(tournamentId)
  const { toast } = useToast()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        Failed to load staff accounts. Please try again.
      </div>
    )
  }

  if (!staff || staff.length === 0) {
    return (
      <EmptyState
        title="No Staff Accounts"
        description="Staff accounts were not created for this tournament."
      />
    )
  }

  function handleRegenerate(role: string) {
    regenerate.mutate(role, {
      onSuccess: () => {
        toast('success', 'Password regenerated successfully')
      },
      onError: () => {
        toast('error', 'Failed to regenerate password')
      },
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Staff Accounts
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          These accounts are auto-created for tournament staff. Share the
          credentials with your referee and scorekeeper.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {staff.map((member) => (
          <StaffCard
            key={member.id}
            member={member}
            onRegenerate={() => handleRegenerate(member.role)}
            isRegenerating={regenerate.isPending && regenerate.variables === member.role}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tournaments/TournamentStaff.tsx
git commit -m "feat: add TournamentStaff component with credential display"
```

---

## Task 9: Add Staff Tab to TournamentDetail

**Files:**
- Modify: `frontend/src/features/tournaments/TournamentDetail.tsx`

- [ ] **Step 1: Import TournamentStaff component**

Add import at the top of the file alongside other feature imports:
```tsx
import { TournamentStaff } from './TournamentStaff'
```

- [ ] **Step 2: Add Staff tab to tabs array**

Find the tabs array and add a `'staff'` entry between `'announcements'` and `'settings'`:

```tsx
const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'divisions', label: 'Divisions', count: divisionCount },
    { id: 'courts', label: 'Courts' },
    { id: 'registrations', label: 'Registrations' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'staff', label: 'Staff' },
    { id: 'settings', label: 'Settings' },
]
```

- [ ] **Step 3: Add Staff tab content rendering**

Find the switch/conditional block that renders tab content. Add the staff case:

```tsx
{activeTab === 'staff' && tournament && (
    <TournamentStaff tournamentId={tournament.id} />
)}
```

Place this between the announcements and settings rendering blocks.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tournaments/TournamentDetail.tsx
git commit -m "feat: add Staff tab to tournament detail page"
```

---

## Task 10: Scope Ref Console to Tournament Courts

**Files:**
- Modify: `frontend/src/features/referee/RefHome.tsx`

- [ ] **Step 1: Import auth hook and tournament assignment hook**

Add these imports to the top of RefHome.tsx:

```tsx
import { useAuth } from '../auth/hooks'
import { useMyTournamentAssignment, useCourtsForTournament } from '../scoring/hooks'
```

- [ ] **Step 2: Add conditional court fetching**

Inside the `RefHome` component function, add auth-based logic. Replace the single `useAllCourts()` call with conditional fetching:

```tsx
const { user } = useAuth()
const isStaffRole = user?.role === 'referee' || user?.role === 'scorekeeper'
const assignment = useMyTournamentAssignment()

// Use tournament-scoped courts for staff users, all courts otherwise
const allCourts = useAllCourts()
const tournamentCourts = useCourtsForTournament(
  assignment.data?.tournament_id ?? 0
)

const courtsQuery = isStaffRole && assignment.data
  ? tournamentCourts
  : allCourts
```

Then use `courtsQuery` instead of the previous `allCourts` result throughout the component — for loading state, error state, and `groupCourtsByVenue(courtsQuery.data?.items ?? [])`.

- [ ] **Step 3: Show tournament name in header for staff users**

If `isStaffRole && assignment.data`, update the heading to show:

```tsx
<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
  {isStaffRole && assignment.data
    ? `Referee Console — ${assignment.data.tournament_name}`
    : 'Referee Console'}
</h1>
```

- [ ] **Step 4: Handle assignment loading state**

If `isStaffRole` and `assignment.isLoading`, show a loading skeleton before the court grid. This prevents a flash of "all courts" before the assignment loads.

```tsx
if (isStaffRole && assignment.isLoading) {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48" />
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/referee/RefHome.tsx
git commit -m "feat: scope ref console to tournament courts for staff users"
```

---

## Task 11: Full Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Backend build and vet**

Run: `cd backend && go build ./... && go vet ./...`
Expected: Clean build, no warnings

- [ ] **Step 2: Frontend type check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: No type errors

- [ ] **Step 3: Frontend production build**

Run: `cd frontend && pnpm build`
Expected: Clean build with no errors

- [ ] **Step 4: Final commit — squash or amend if needed**

If all tasks were committed individually, create a final combined commit:

```bash
git add -A
git commit -m "feat: auto-create tournament staff accounts (ref + scorekeeper) with scoped court access"
```

- [ ] **Step 5: Push**

```bash
git push origin V2
```

---

## Task 12: Manual Testing

- [ ] **Step 1: Run migrations and seed**

```bash
make seed
```

- [ ] **Step 2: Test staff tab visibility**

1. Log in as `td@courtcommand.com` / `TestPass123!`
2. Navigate to a tournament detail page
3. Click the "Staff" tab
4. Verify both Referee and Scorekeeper cards display with email + password
5. Click "Show" to reveal password
6. Click "Copy Credentials" — verify clipboard contains email + password
7. Click "Regenerate Password" — confirm dialog appears, confirm, verify new password shown

- [ ] **Step 3: Test scoped ref console**

1. Copy the referee email from the Staff tab (e.g., `ref42@cc.dev`)
2. Log out, log in with that email and the displayed password
3. Navigate to the referee console
4. Verify the header shows "Referee Console — [Tournament Name]"
5. Verify only courts assigned to that tournament are visible
6. Log out, log in as a platform_admin
7. Verify the referee console shows all courts (no scoping)
