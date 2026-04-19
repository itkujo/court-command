# Ghost CMS Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Ghost CMS as the news platform for Court Command — backend settings, frontend widgets, Docker config, Ghost theme, and navigation updates.

**Architecture:** Ghost runs standalone at `news.courtcommand.com`. Court Command stores Ghost connection config in a `site_settings` table. Frontend fetches config from a public endpoint, then calls Ghost Content API directly (no backend proxy). Compact headline widgets render in 3 placements.

**Tech Stack:** Go 1.26 + Chi v5 + PostgreSQL 17 (backend), React 19 + TanStack Query + Tailwind CSS v4 (frontend), Ghost 5 (CMS), Docker Compose (dev infra), Handlebars (Ghost theme)

---

## File Structure

### New Files

```
backend/
  db/migrations/00039_create_site_settings.sql   # Migration: site_settings table
  service/settings.go                             # SettingsService: Get, GetByKey, Update
  service/settings_test.go                        # Unit tests for SettingsService
  handler/settings.go                             # HTTP handlers for 3 endpoints
  handler/settings_test.go                        # Integration tests for settings API

frontend/src/
  hooks/useGhostConfig.ts                         # Hook: fetch Ghost URL + API key
  hooks/useGhostPosts.ts                          # Hook: fetch posts from Ghost Content API
  components/NewsWidget.tsx                        # Reusable news headline widget
  features/admin/AdminSettings.tsx                 # Admin settings form page
  routes/admin/settings.tsx                        # Route: /admin/settings

ghost-theme/
  package.json                                    # Theme metadata
  default.hbs                                     # Layout override with CC nav chrome
  index.hbs                                       # Homepage (stock Casper)
  post.hbs                                        # Single post (stock Casper)
  partials/cc-sidebar.hbs                         # Desktop sidebar
  partials/cc-header.hbs                          # Top header bar
  partials/cc-bottom-nav.hbs                      # Mobile bottom nav
  partials/cc-category-tabs.hbs                   # Category filter tabs/pills
  assets/css/cc-nav.css                           # Navigation chrome styles
```

### Modified Files

```
backend/router/router.go                          # Add SettingsHandler to Config + routes
backend/main.go                                   # Wire SettingsService + SettingsHandler
docker-compose.yml                                # Add Ghost service + volume

frontend/src/components/Sidebar.tsx                # Add external link support + News link
frontend/src/features/admin/AdminDashboard.tsx     # Add Settings card
frontend/src/features/public/PublicLanding.tsx      # Add NewsWidget to homepage
frontend/src/features/dashboard/PlayerDashboard.tsx # Add news widgets to dashboard
frontend/src/features/registry/players/PlayerDetail.tsx # Add NewsWidget to player profile
```

---

### Task 1: Database Migration — `site_settings` Table

**Files:**
- Create: `backend/db/migrations/00039_create_site_settings.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- +goose Up
CREATE TABLE site_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (key, value) VALUES
    ('ghost_url', ''),
    ('ghost_content_api_key', '');

-- +goose Down
DROP TABLE IF EXISTS site_settings;
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up`
Expected: `OK 00039_create_site_settings.sql`

- [ ] **Step 3: Verify the table exists**

Run: `psql "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" -c "SELECT * FROM site_settings;"`
Expected: 2 rows (`ghost_url` and `ghost_content_api_key`), both with empty string values.

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/00039_create_site_settings.sql
git commit -m "feat: add site_settings migration (00039)"
```

---

### Task 2: Backend Service — `SettingsService`

**Files:**
- Create: `backend/service/settings.go`
- Test: `backend/service/settings_test.go`

- [ ] **Step 1: Write the failing test for GetAll**

Create `backend/service/settings_test.go`:

```go
package service

import (
	"context"
	"testing"

	"github.com/court-command/court-command/testutil"
)

func TestSettingsService_GetAll(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	// Re-seed defaults after cleaning
	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := NewSettingsService(pool)
	settings, err := svc.GetAll(context.Background())
	if err != nil {
		t.Fatalf("GetAll: %v", err)
	}

	if len(settings) != 2 {
		t.Fatalf("expected 2 settings, got %d", len(settings))
	}
	if settings["ghost_url"] != "" {
		t.Errorf("expected empty ghost_url, got %q", settings["ghost_url"])
	}
	if settings["ghost_content_api_key"] != "" {
		t.Errorf("expected empty ghost_content_api_key, got %q", settings["ghost_content_api_key"])
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && go test ./service/ -run TestSettingsService_GetAll -v`
Expected: FAIL — `NewSettingsService` not defined.

- [ ] **Step 3: Implement SettingsService**

Create `backend/service/settings.go`:

```go
package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SettingsService manages key-value site settings.
type SettingsService struct {
	pool *pgxpool.Pool
}

// NewSettingsService creates a new SettingsService.
func NewSettingsService(pool *pgxpool.Pool) *SettingsService {
	return &SettingsService{pool: pool}
}

// GetAll returns all settings as a map.
func (s *SettingsService) GetAll(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM site_settings ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("query site_settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan site_settings row: %w", err)
		}
		settings[k] = v
	}
	return settings, rows.Err()
}

// GetGhostConfig returns only Ghost-related settings.
func (s *SettingsService) GetGhostConfig(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT key, value FROM site_settings WHERE key IN ('ghost_url', 'ghost_content_api_key') ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("query ghost config: %w", err)
	}
	defer rows.Close()

	config := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan ghost config row: %w", err)
		}
		config[k] = v
	}
	return config, rows.Err()
}

// Update updates one or more settings. Returns an error if any key does not exist.
func (s *SettingsService) Update(ctx context.Context, updates map[string]string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for k, v := range updates {
		tag, err := tx.Exec(ctx,
			`UPDATE site_settings SET value = $1, updated_at = NOW() WHERE key = $2`, v, k)
		if err != nil {
			return fmt.Errorf("update setting %q: %w", k, err)
		}
		if tag.RowsAffected() == 0 {
			return &ValidationError{Message: fmt.Sprintf("unknown setting key: %s", k)}
		}
	}

	return tx.Commit(ctx)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && go test ./service/ -run TestSettingsService_GetAll -v`
Expected: PASS

- [ ] **Step 5: Write failing test for Update**

Add to `backend/service/settings_test.go`:

```go
func TestSettingsService_Update(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := NewSettingsService(pool)

	// Update ghost_url
	err = svc.Update(context.Background(), map[string]string{
		"ghost_url": "https://news.courtcommand.com",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	// Verify
	settings, err := svc.GetAll(context.Background())
	if err != nil {
		t.Fatalf("GetAll after update: %v", err)
	}
	if settings["ghost_url"] != "https://news.courtcommand.com" {
		t.Errorf("expected updated ghost_url, got %q", settings["ghost_url"])
	}
}

func TestSettingsService_Update_UnknownKey(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := NewSettingsService(pool)

	err = svc.Update(context.Background(), map[string]string{
		"nonexistent_key": "value",
	})
	if err == nil {
		t.Fatal("expected error for unknown key, got nil")
	}

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestSettingsService_GetGhostConfig(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', 'https://news.example.com'), ('ghost_content_api_key', 'abc123')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := NewSettingsService(pool)
	config, err := svc.GetGhostConfig(context.Background())
	if err != nil {
		t.Fatalf("GetGhostConfig: %v", err)
	}
	if config["ghost_url"] != "https://news.example.com" {
		t.Errorf("ghost_url = %q, want %q", config["ghost_url"], "https://news.example.com")
	}
	if config["ghost_content_api_key"] != "abc123" {
		t.Errorf("ghost_content_api_key = %q, want %q", config["ghost_content_api_key"], "abc123")
	}
}
```

Note: Add `"errors"` to the import block at the top of the test file.

- [ ] **Step 6: Run all settings tests**

Run: `cd backend && go test ./service/ -run TestSettingsService -v`
Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/service/settings.go backend/service/settings_test.go
git commit -m "feat: add SettingsService with GetAll, GetGhostConfig, Update"
```

---

### Task 3: Backend Handler — Settings API Endpoints

**Files:**
- Create: `backend/handler/settings.go`
- Test: `backend/handler/settings_test.go`

- [ ] **Step 1: Write the failing test for GET /api/v1/admin/settings**

Create `backend/handler/settings_test.go`:

```go
package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/court-command/court-command/testutil"
)

func TestGetAdminSettings(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	ts, adminCookie := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	req, _ := http.NewRequest("GET", ts.URL+"/api/v1/admin/settings", nil)
	req.Header.Set("Cookie", adminCookie)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /admin/settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Data struct {
			Settings map[string]string `json:"settings"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Data.Settings["ghost_url"] != "" {
		t.Errorf("expected empty ghost_url, got %q", body.Data.Settings["ghost_url"])
	}
}
```

Note: `TestServerWithAdmin` may not exist yet. If `testutil.TestServer` returns a server with an admin user cookie, use that. Otherwise, the test should create an admin user and log in. Check the existing `testutil` package — if there's no admin helper, you'll need to create the user and session manually following the pattern in `auth_test.go`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && go test ./handler/ -run TestGetAdminSettings -v`
Expected: FAIL — handler not defined.

- [ ] **Step 3: Implement SettingsHandler**

Create `backend/handler/settings.go`:

```go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/court-command/court-command/service"
)

// SettingsHandler handles site settings API endpoints.
type SettingsHandler struct {
	svc *service.SettingsService
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(svc *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{svc: svc}
}

// GetAll returns all settings (admin only).
func (h *SettingsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetAll(r.Context())
	if err != nil {
		InternalError(w, "failed to load settings")
		return
	}
	Success(w, map[string]any{"settings": settings})
}

// Update updates one or more settings (admin only).
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "INVALID_JSON", "invalid request body")
		return
	}
	if len(body) == 0 {
		BadRequest(w, "EMPTY_BODY", "no settings to update")
		return
	}

	if err := h.svc.Update(r.Context(), body); err != nil {
		HandleServiceError(w, err)
		return
	}

	// Return updated settings
	settings, err := h.svc.GetAll(r.Context())
	if err != nil {
		InternalError(w, "failed to load settings after update")
		return
	}
	Success(w, map[string]any{"settings": settings})
}

// GetGhostConfig returns Ghost-related settings (public, no auth).
func (h *SettingsHandler) GetGhostConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.svc.GetGhostConfig(r.Context())
	if err != nil {
		InternalError(w, "failed to load ghost config")
		return
	}
	Success(w, config)
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && go test ./handler/ -run TestGetAdminSettings -v`
Expected: Likely still FAIL because the handler isn't wired into the router yet. That's OK — move to step 5.

- [ ] **Step 5: Write test for PUT /api/v1/admin/settings**

Add to `backend/handler/settings_test.go`:

```go
func TestUpdateAdminSettings(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	ts, adminCookie := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	payload := `{"ghost_url":"https://news.courtcommand.com","ghost_content_api_key":"abc123"}`
	req, _ := http.NewRequest("PUT", ts.URL+"/api/v1/admin/settings", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", adminCookie)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT /admin/settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Data struct {
			Settings map[string]string `json:"settings"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Data.Settings["ghost_url"] != "https://news.courtcommand.com" {
		t.Errorf("ghost_url = %q, want %q", body.Data.Settings["ghost_url"], "https://news.courtcommand.com")
	}
}

func TestGetGhostConfig_Public(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', 'https://news.courtcommand.com'), ('ghost_content_api_key', 'abc123')`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	ts, _ := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	// No auth cookie — public endpoint
	resp, err := http.Get(ts.URL + "/api/v1/settings/ghost")
	if err != nil {
		t.Fatalf("GET /settings/ghost: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Data map[string]string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Data["ghost_url"] != "https://news.courtcommand.com" {
		t.Errorf("ghost_url = %q", body.Data["ghost_url"])
	}
	if body.Data["ghost_content_api_key"] != "abc123" {
		t.Errorf("ghost_content_api_key = %q", body.Data["ghost_content_api_key"])
	}
}
```

- [ ] **Step 6: Commit handler (tests will pass after wiring in Task 4)**

```bash
git add backend/handler/settings.go backend/handler/settings_test.go
git commit -m "feat: add SettingsHandler with admin + public endpoints"
```

---

### Task 4: Wire Settings into Router + main.go

**Files:**
- Modify: `backend/router/router.go:21-83` (Config struct) and `:349-357` (admin routes)
- Modify: `backend/main.go:155-229` (service/handler creation + router config)

- [ ] **Step 1: Add SettingsHandler to router Config struct**

In `backend/router/router.go`, add a new field after `AdHandler *handler.AdHandler` (line 79):

```go
	// CMS Settings
	SettingsHandler *handler.SettingsHandler
```

- [ ] **Step 2: Add settings routes to the router**

In `backend/router/router.go`, inside the admin `r.Route("/admin", ...)` block (after line 356, before the closing `})`), add:

```go
			if cfg.SettingsHandler != nil {
				r.Get("/settings", cfg.SettingsHandler.GetAll)
				r.Put("/settings", cfg.SettingsHandler.Update)
			}
```

Then add the public ghost config route. Inside the main `/api/v1` route group (after the admin block ends at line 357, before the ads public routes at line 359), add:

```go
		// Public settings endpoint (no auth)
		if cfg.SettingsHandler != nil {
			r.Get("/settings/ghost", cfg.SettingsHandler.GetGhostConfig)
		}
```

- [ ] **Step 3: Wire service + handler in main.go**

In `backend/main.go`, after the Phase 8 services block (after line 162, `adHandler := ...`), add:

```go
	// CMS Settings
	settingsService := service.NewSettingsService(pool)
	settingsHandler := handler.NewSettingsHandler(settingsService)
```

Then in the `router.New(&router.Config{...})` block, after `AdHandler: adHandler,` (line 225), add:

```go
		// CMS Settings
		SettingsHandler: settingsHandler,
```

- [ ] **Step 4: Verify build compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 5: Run all tests**

Run: `cd backend && go test ./... -v -count=1`
Expected: All tests pass including the new settings tests.

Note: If `TestServerWithAdmin` doesn't exist in the testutil package, you'll need to check the existing `testutil/testserver.go` for how admin sessions are created. The existing `testutil.TestServer(t, pool)` likely returns a test server. You may need to create an admin user and get a session cookie by calling the auth endpoints directly in the test. Follow the pattern from `auth_test.go`.

- [ ] **Step 6: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire SettingsHandler into router and main.go"
```

---

### Task 5: Docker — Add Ghost Service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add Ghost service to docker-compose.yml**

After the `redis` service block (after line 29) and before the `backend` service block, add:

```yaml
  ghost:
    image: ghost:5
    ports:
      - "2368:2368"
    environment:
      url: http://localhost:2368
      database__client: sqlite3
      database__connection__filename: /var/lib/ghost/content/data/ghost.db
    volumes:
      - ghost_content:/var/lib/ghost/content
```

Add `ghost_content:` to the `volumes:` section at the bottom (after `uploads:`):

```yaml
  ghost_content:
```

- [ ] **Step 2: Update the comment at top**

Update line 2 to include Ghost:

```yaml
# Development: `docker compose up` (db + redis + ghost, run backend locally)
```

- [ ] **Step 3: Verify Docker Compose config**

Run: `docker compose config --quiet`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Ghost 5 service to docker-compose.yml"
```

---

### Task 6: Frontend — Ghost Config Hook

**Files:**
- Create: `frontend/src/hooks/useGhostConfig.ts`

- [ ] **Step 1: Create the useGhostConfig hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'

interface GhostConfig {
  ghost_url: string
  ghost_content_api_key: string
}

export function useGhostConfig() {
  const query = useQuery<GhostConfig>({
    queryKey: ['ghost-config'],
    queryFn: () => apiGet<GhostConfig>('/api/v1/settings/ghost'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const ghostUrl = query.data?.ghost_url ?? ''
  const apiKey = query.data?.ghost_content_api_key ?? ''
  const isConfigured = ghostUrl !== '' && apiKey !== ''

  return {
    ghostUrl,
    apiKey,
    isConfigured,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors related to useGhostConfig.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGhostConfig.ts
git commit -m "feat: add useGhostConfig hook"
```

---

### Task 7: Frontend — Ghost Posts Hook

**Files:**
- Create: `frontend/src/hooks/useGhostPosts.ts`

- [ ] **Step 1: Create the useGhostPosts hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useGhostConfig } from './useGhostConfig'

interface GhostTag {
  id: string
  name: string
  slug: string
}

export interface GhostPost {
  id: string
  title: string
  slug: string
  excerpt: string
  feature_image: string | null
  published_at: string
  tags: GhostTag[]
}

interface GhostPostsResponse {
  posts: GhostPost[]
}

interface UseGhostPostsOptions {
  tag?: string
  limit?: number
  enabled?: boolean
}

export function useGhostPosts({ tag, limit = 3, enabled = true }: UseGhostPostsOptions = {}) {
  const { ghostUrl, apiKey, isConfigured } = useGhostConfig()

  const query = useQuery<GhostPost[]>({
    queryKey: ['ghost-posts', ghostUrl, tag, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        key: apiKey,
        limit: String(limit),
        include: 'tags',
        fields: 'id,title,slug,excerpt,feature_image,published_at',
      })
      if (tag) {
        params.set('filter', `tag:${tag}`)
      }

      const res = await fetch(`${ghostUrl}/ghost/api/content/posts/?${params}`)
      if (!res.ok) {
        throw new Error(`Ghost API error: ${res.status}`)
      }
      const data: GhostPostsResponse = await res.json()
      return data.posts ?? []
    },
    enabled: enabled && isConfigured,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return {
    posts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    isConfigured,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGhostPosts.ts
git commit -m "feat: add useGhostPosts hook for Ghost Content API"
```

---

### Task 8: Frontend — NewsWidget Component

**Files:**
- Create: `frontend/src/components/NewsWidget.tsx`

- [ ] **Step 1: Create the NewsWidget component**

```tsx
import { ExternalLink, Newspaper } from 'lucide-react'
import { useGhostPosts } from '../hooks/useGhostPosts'
import type { GhostPost } from '../hooks/useGhostPosts'
import { useGhostConfig } from '../hooks/useGhostConfig'

interface NewsWidgetProps {
  title: string
  tag?: string
  limit?: number
  viewAllUrl?: string
  emptyMessage?: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function PostCard({ post, ghostUrl }: { post: GhostPost; ghostUrl: string }) {
  const articleUrl = `${ghostUrl}/${post.slug}`
  const primaryTag = post.tags?.[0]

  return (
    <a
      href={articleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-(--color-bg-hover)"
    >
      {post.feature_image ? (
        <img
          src={post.feature_image}
          alt=""
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-(--color-bg-primary)">
          <Newspaper className="h-5 w-5 text-(--color-text-muted)" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-(--color-text-primary)">
          {post.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-(--color-text-muted)">
          {primaryTag && (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400">
              {primaryTag.name}
            </span>
          )}
          <span>{timeAgo(post.published_at)}</span>
        </div>
      </div>
    </a>
  )
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-(--color-bg-primary)" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-(--color-bg-primary)" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-(--color-bg-primary)" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NewsWidget({
  title,
  tag,
  limit = 3,
  viewAllUrl,
  emptyMessage = 'No news articles yet',
}: NewsWidgetProps) {
  const { ghostUrl } = useGhostConfig()
  const { posts, isLoading, isError, isConfigured } = useGhostPosts({ tag, limit })

  // Don't render anything if Ghost isn't configured
  if (!isConfigured && !isLoading) return null

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-card) p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">{title}</h3>
        {viewAllUrl && (
          <a
            href={viewAllUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={limit} />}

      {isError && (
        <p className="py-4 text-center text-sm text-(--color-text-muted)">
          Unable to load news
        </p>
      )}

      {!isLoading && !isError && posts.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Newspaper className="h-6 w-6 text-(--color-text-muted)" />
          <p className="text-sm text-(--color-text-muted)">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && !isError && posts.length > 0 && (
        <div className="space-y-1">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} ghostUrl={ghostUrl} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NewsWidget.tsx
git commit -m "feat: add NewsWidget component with loading/error/empty states"
```

---

### Task 9: Frontend — Admin Settings Page

**Files:**
- Create: `frontend/src/features/admin/AdminSettings.tsx`
- Create: `frontend/src/routes/admin/settings.tsx`
- Modify: `frontend/src/features/admin/AdminDashboard.tsx:75-96` (add Settings card)

- [ ] **Step 1: Create the AdminSettings component**

Create `frontend/src/features/admin/AdminSettings.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle, Loader2 } from 'lucide-react'
import { Card } from '../../components/Card'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { apiGet, apiPut } from '../../lib/api'

interface SettingsData {
  settings: Record<string, string>
}

function useAdminSettings() {
  return useQuery<SettingsData>({
    queryKey: ['admin-settings'],
    queryFn: () => apiGet<SettingsData>('/api/v1/admin/settings'),
  })
}

function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiPut<SettingsData>('/api/v1/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['ghost-config'] })
    },
  })
}

export function AdminSettings() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useAdminSettings()
  const mutation = useUpdateSettings()
  const [ghostUrl, setGhostUrl] = useState('')
  const [ghostApiKey, setGhostApiKey] = useState('')

  useEffect(() => {
    if (data?.settings) {
      setGhostUrl(data.settings.ghost_url ?? '')
      setGhostApiKey(data.settings.ghost_content_api_key ?? '')
    }
  }, [data])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        ghost_url: ghostUrl.trim(),
        ghost_content_api_key: ghostApiKey.trim(),
      },
      {
        onSuccess: () => toast('success', 'Settings saved'),
        onError: () => toast('error', 'Failed to save settings'),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Settings</h1>
        <Card>
          <div className="flex flex-col items-center gap-3 py-8">
            <AlertCircle className="h-8 w-8 text-(--color-error)" />
            <p className="text-(--color-text-secondary)">Failed to load settings</p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium text-(--color-accent) hover:underline"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-(--color-text-primary)">Settings</h1>

      <Card className="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-(--color-border) pb-3">
            <Settings className="h-5 w-5 text-(--color-text-muted)" />
            <h2 className="text-lg font-semibold text-(--color-text-primary)">
              Ghost CMS
            </h2>
          </div>

          <div>
            <label
              htmlFor="ghost-url"
              className="mb-1 block text-sm font-medium text-(--color-text-secondary)"
            >
              Ghost URL
            </label>
            <input
              id="ghost-url"
              type="url"
              value={ghostUrl}
              onChange={(e) => setGhostUrl(e.target.value)}
              placeholder="https://news.courtcommand.com"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
          </div>

          <div>
            <label
              htmlFor="ghost-api-key"
              className="mb-1 block text-sm font-medium text-(--color-text-secondary)"
            >
              Content API Key
            </label>
            <input
              id="ghost-api-key"
              type="text"
              value={ghostApiKey}
              onChange={(e) => setGhostApiKey(e.target.value)}
              placeholder="Content API key from Ghost Admin"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <p className="mt-1 text-xs text-(--color-text-muted)">
              Found in Ghost Admin under Settings &rarr; Integrations &rarr; Custom
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create the route file**

Create `frontend/src/routes/admin/settings.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '../../features/admin/AdminGuard'
import { AdminSettings } from '../../features/admin/AdminSettings'

export const Route = createFileRoute('/admin/settings')({
  component: () => (
    <AdminGuard>
      <AdminSettings />
    </AdminGuard>
  ),
})
```

- [ ] **Step 3: Add Settings card to AdminDashboard**

In `frontend/src/features/admin/AdminDashboard.tsx`, add `Settings` to the lucide import (line 1-14). Then in the `getStatCards` function (line 75-96), add a new card after the Activity Log card (after line 94):

```typescript
    { label: 'Settings', value: -1, icon: Settings, to: '/admin/settings' },
```

- [ ] **Step 4: Regenerate the route tree**

Run: `cd frontend && npx tsr generate`
Expected: `routeTree.gen.ts` updated with the new `/admin/settings` route.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/admin/AdminSettings.tsx frontend/src/routes/admin/settings.tsx frontend/src/features/admin/AdminDashboard.tsx frontend/src/routeTree.gen.ts
git commit -m "feat: add admin settings page with Ghost CMS configuration"
```

---

### Task 10: Frontend — Sidebar News Link

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx:1-10` (imports), `:28-29` (NavItem interface), `:99-106` (publicNavGroups), `:248-261` (link rendering)

- [ ] **Step 1: Add `href` to NavItem interface and Newspaper icon import**

In `frontend/src/components/Sidebar.tsx`:

Update the lucide import (line 7-10) to add `Newspaper`:

```typescript
import {
  LayoutDashboard, Trophy, Medal, MapPin, Users, UsersRound, Building2, Tv, Menu, ChevronLeft, LogOut,
  Gavel, ClipboardList, Zap, Search, LogIn, Shield, Home, FolderKanban, Newspaper,
} from 'lucide-react'
```

Update the `NavItem` interface (line 28) to add an optional `href` for external links:

```typescript
interface NavItem { label: string; icon: typeof LayoutDashboard; path: string; href?: string }
```

- [ ] **Step 2: Add News to publicNavGroups**

Update `publicNavGroups` (lines 99-106) to add a News item in the Browse section:

```typescript
const publicNavGroups: NavGroup[] = [
  { items: [{ label: 'Home', icon: Home, path: '/' }] },
  { label: 'Browse', items: [
    { label: 'Leagues', icon: Medal, path: '/public/leagues' },
    { label: 'Tournaments', icon: Trophy, path: '/public/tournaments' },
    { label: 'Venues', icon: MapPin, path: '/public/venues' },
    { label: 'News', icon: Newspaper, path: '/news', href: 'https://news.courtcommand.com' },
  ]},
]
```

- [ ] **Step 3: Update link rendering to support external links**

In the nav items rendering section (around lines 248-261), update to conditionally render `<a>` for external links:

Replace the existing `{group.items.map((item) => {` block with:

```tsx
            {group.items.map((item) => {
              const active = isActive(item.path)
              const className = cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', expanded ? '' : 'justify-center px-2',
                active ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary)'
              )

              if (item.href) {
                return (
                  <a key={item.path} href={item.href} target="_blank" rel="noopener noreferrer"
                    className={className}
                    title={!expanded ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {expanded && <span>{item.label}</span>}
                  </a>
                )
              }

              return (
                <Link key={item.path} to={item.path}
                  className={className}
                  title={!expanded ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {expanded && <span>{item.label}</span>}
                </Link>
              )
            })}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: add News external link to sidebar navigation"
```

---

### Task 11: Frontend — Widget Placements

**Files:**
- Modify: `frontend/src/features/public/PublicLanding.tsx`
- Modify: `frontend/src/features/dashboard/PlayerDashboard.tsx`
- Modify: `frontend/src/features/registry/players/PlayerDetail.tsx`

- [ ] **Step 1: Add NewsWidget to PublicLanding (homepage)**

In `frontend/src/features/public/PublicLanding.tsx`, add the import at the top:

```typescript
import { NewsWidget } from '../../components/NewsWidget'
```

Then add the NewsWidget after the hero and ad slot section, before the directory sections. Look for where the `DirectorySection` components begin and insert the widget above them. Add it as a standalone section in the `space-y-10` flow:

```tsx
      <NewsWidget
        title="Latest News"
        limit={3}
        viewAllUrl="https://news.courtcommand.com"
      />
```

- [ ] **Step 2: Add NewsWidgets to PlayerDashboard**

In `frontend/src/features/dashboard/PlayerDashboard.tsx`, add the import:

```typescript
import { NewsWidget } from '../../components/NewsWidget'
```

After the last section in the dashboard content (after the Teams+Announcements grid), add a new bottom row with two news widgets side by side:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NewsWidget
              title="Tournament News"
              tag="tournament-news"
              limit={3}
              viewAllUrl="https://news.courtcommand.com/tag/tournament-news"
            />
            <NewsWidget
              title="League Updates"
              tag="league-updates"
              limit={3}
              viewAllUrl="https://news.courtcommand.com/tag/league-updates"
            />
          </div>
```

- [ ] **Step 3: Add NewsWidget to PlayerDetail**

In `frontend/src/features/registry/players/PlayerDetail.tsx`, add the import:

```typescript
import { NewsWidget } from '../../components/NewsWidget'
```

Add the widget before the AdSlot at the bottom. The player detail needs the player's slug for the tag filter. Look at how the player data is accessed (likely `player.slug` or similar) and add:

```tsx
        <NewsWidget
          title="Player Headlines"
          tag={`player-${player.slug || player.public_id}`}
          limit={3}
          emptyMessage="No articles mentioning this player yet"
        />
```

Note: Check what identifier the player object uses. If there's no `slug` field, use `public_id` or construct from the player's name. The Ghost tag convention is `player-{identifier}`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/public/PublicLanding.tsx frontend/src/features/dashboard/PlayerDashboard.tsx frontend/src/features/registry/players/PlayerDetail.tsx
git commit -m "feat: add NewsWidget to homepage, dashboard, and player profiles"
```

---

### Task 12: Ghost Theme — Casper Fork

**Files:**
- Create: `ghost-theme/package.json`
- Create: `ghost-theme/default.hbs`
- Create: `ghost-theme/index.hbs`
- Create: `ghost-theme/post.hbs`
- Create: `ghost-theme/partials/cc-sidebar.hbs`
- Create: `ghost-theme/partials/cc-header.hbs`
- Create: `ghost-theme/partials/cc-bottom-nav.hbs`
- Create: `ghost-theme/partials/cc-category-tabs.hbs`
- Create: `ghost-theme/assets/css/cc-nav.css`

- [ ] **Step 1: Create package.json**

Create `ghost-theme/package.json`:

```json
{
  "name": "court-command-casper",
  "description": "Court Command News theme — Casper fork with shared navigation chrome",
  "version": "1.0.0",
  "engines": {
    "ghost": ">=5.0.0"
  },
  "license": "MIT",
  "config": {
    "posts_per_page": 15,
    "image_sizes": {
      "xxs": { "width": 30 },
      "xs": { "width": 100 },
      "s": { "width": 300 },
      "m": { "width": 600 },
      "l": { "width": 1000 },
      "xl": { "width": 2000 }
    }
  }
}
```

- [ ] **Step 2: Create cc-sidebar.hbs partial**

Create `ghost-theme/partials/cc-sidebar.hbs`:

```handlebars
<nav class="cc-sidebar" aria-label="Court Command Navigation">
  <div class="cc-sidebar__logo">
    <a href="https://courtcommand.com">
      <span class="cc-sidebar__logo-text">CC</span>
    </a>
  </div>
  <ul class="cc-sidebar__nav">
    <li><a href="https://courtcommand.com" class="cc-sidebar__link"><span class="cc-sidebar__icon">&#8962;</span><span class="cc-sidebar__label">Home</span></a></li>
    <li><a href="https://courtcommand.com/public/tournaments" class="cc-sidebar__link"><span class="cc-sidebar__icon">&#127942;</span><span class="cc-sidebar__label">Tournaments</span></a></li>
    <li><a href="https://courtcommand.com/public/leagues" class="cc-sidebar__link"><span class="cc-sidebar__icon">&#127941;</span><span class="cc-sidebar__label">Leagues</span></a></li>
    <li><a href="/" class="cc-sidebar__link cc-sidebar__link--active"><span class="cc-sidebar__icon">&#128240;</span><span class="cc-sidebar__label">News</span></a></li>
    <li><a href="https://courtcommand.com/public/venues" class="cc-sidebar__link"><span class="cc-sidebar__icon">&#128205;</span><span class="cc-sidebar__label">Venues</span></a></li>
  </ul>
</nav>
```

- [ ] **Step 3: Create cc-header.hbs partial**

Create `ghost-theme/partials/cc-header.hbs`:

```handlebars
<header class="cc-header">
  <a href="/" class="cc-header__brand">
    <span class="cc-header__logo">CC</span>
    <span class="cc-header__title">Court Command <span class="cc-header__accent">News</span></span>
  </a>
</header>
```

- [ ] **Step 4: Create cc-bottom-nav.hbs partial**

Create `ghost-theme/partials/cc-bottom-nav.hbs`:

```handlebars
<nav class="cc-bottom-nav" aria-label="Mobile Navigation">
  <a href="https://courtcommand.com" class="cc-bottom-nav__item">
    <span class="cc-bottom-nav__icon">&#8962;</span>
    <span class="cc-bottom-nav__label">Home</span>
  </a>
  <a href="https://courtcommand.com/public/events" class="cc-bottom-nav__item">
    <span class="cc-bottom-nav__icon">&#127942;</span>
    <span class="cc-bottom-nav__label">Events</span>
  </a>
  <a href="https://courtcommand.com/public/live" class="cc-bottom-nav__item">
    <span class="cc-bottom-nav__icon">&#9889;</span>
    <span class="cc-bottom-nav__label">Live</span>
  </a>
  <a href="/" class="cc-bottom-nav__item cc-bottom-nav__item--active">
    <span class="cc-bottom-nav__icon">&#128240;</span>
    <span class="cc-bottom-nav__label">News</span>
  </a>
  <a href="https://courtcommand.com/login" class="cc-bottom-nav__item">
    <span class="cc-bottom-nav__icon">&#128100;</span>
    <span class="cc-bottom-nav__label">Sign In</span>
  </a>
</nav>
```

- [ ] **Step 5: Create cc-category-tabs.hbs partial**

Create `ghost-theme/partials/cc-category-tabs.hbs`:

```handlebars
<div class="cc-category-tabs">
  <a href="/" class="cc-category-tabs__tab{{#unless tag}} cc-category-tabs__tab--active{{/unless}}">All Stories</a>
  <a href="/tag/tournament-news/" class="cc-category-tabs__tab{{#has tag="tournament-news"}} cc-category-tabs__tab--active{{/has}}">Tournament News</a>
  <a href="/tag/player-spotlight/" class="cc-category-tabs__tab{{#has tag="player-spotlight"}} cc-category-tabs__tab--active{{/has}}">Player Spotlight</a>
  <a href="/tag/league-updates/" class="cc-category-tabs__tab{{#has tag="league-updates"}} cc-category-tabs__tab--active{{/has}}">League Updates</a>
</div>
```

- [ ] **Step 6: Create cc-nav.css**

Create `ghost-theme/assets/css/cc-nav.css`:

```css
/* Court Command Navigation Chrome */

:root {
  --cc-nav-bg: #0f172a;
  --cc-nav-text: #94a3b8;
  --cc-nav-text-hover: #e2e8f0;
  --cc-nav-accent: #22d3ee;
  --cc-sidebar-width: 220px;
}

/* === Sidebar (Desktop) === */
.cc-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--cc-sidebar-width);
  background: var(--cc-nav-bg);
  padding: 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  z-index: 100;
  border-right: 1px solid rgba(148, 163, 184, 0.1);
}

.cc-sidebar__logo {
  padding: 0.5rem 0.75rem 1.5rem;
}

.cc-sidebar__logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--cc-nav-accent);
  text-decoration: none;
}

.cc-sidebar__logo a {
  text-decoration: none;
}

.cc-sidebar__nav {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cc-sidebar__link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  color: var(--cc-nav-text);
  text-decoration: none;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.cc-sidebar__link:hover {
  background: rgba(148, 163, 184, 0.1);
  color: var(--cc-nav-text-hover);
}

.cc-sidebar__link--active {
  background: rgba(34, 211, 238, 0.1);
  color: var(--cc-nav-accent);
  font-weight: 500;
}

.cc-sidebar__icon {
  font-size: 1.125rem;
  width: 1.5rem;
  text-align: center;
}

/* === Header === */
.cc-header {
  background: var(--cc-nav-bg);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.cc-header__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
}

.cc-header__logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--cc-nav-accent);
}

.cc-header__title {
  font-size: 1rem;
  font-weight: 600;
  color: #e2e8f0;
}

.cc-header__accent {
  color: var(--cc-nav-accent);
}

/* === Category Tabs === */
.cc-category-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: var(--cc-nav-bg);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.cc-category-tabs__tab {
  flex-shrink: 0;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--cc-nav-text);
  text-decoration: none;
  transition: all 0.15s;
  white-space: nowrap;
}

.cc-category-tabs__tab:hover {
  background: rgba(148, 163, 184, 0.1);
  color: var(--cc-nav-text-hover);
}

.cc-category-tabs__tab--active {
  background: rgba(34, 211, 238, 0.15);
  color: var(--cc-nav-accent);
}

/* === Bottom Nav (Mobile) === */
.cc-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--cc-nav-bg);
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding: 0.5rem 0;
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  z-index: 100;
}

.cc-bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.25rem;
  color: var(--cc-nav-text);
  text-decoration: none;
  font-size: 0.625rem;
  transition: color 0.15s;
}

.cc-bottom-nav__item:hover,
.cc-bottom-nav__item--active {
  color: var(--cc-nav-accent);
}

.cc-bottom-nav__icon {
  font-size: 1.25rem;
}

/* === Layout === */
.cc-layout {
  display: flex;
  min-height: 100vh;
}

.cc-layout__main {
  flex: 1;
  margin-left: var(--cc-sidebar-width);
}

/* === Responsive === */
@media (max-width: 767px) {
  .cc-sidebar {
    display: none;
  }

  .cc-bottom-nav {
    display: flex;
    justify-content: space-around;
  }

  .cc-layout__main {
    margin-left: 0;
    padding-bottom: 4rem; /* space for bottom nav */
  }
}
```

- [ ] **Step 7: Create default.hbs layout**

Create `ghost-theme/default.hbs`:

```handlebars
<!DOCTYPE html>
<html lang="{{@site.lang}}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{meta_title}}</title>
    <link rel="stylesheet" href="{{asset "css/cc-nav.css"}}">
    {{ghost_head}}
</head>
<body class="{{body_class}}">
    {{> cc-sidebar}}

    <div class="cc-layout">
        <div class="cc-layout__main">
            {{> cc-header}}
            {{> cc-category-tabs}}
            <main>
                {{{body}}}
            </main>
        </div>
    </div>

    {{> cc-bottom-nav}}
    {{ghost_foot}}
</body>
</html>
```

- [ ] **Step 8: Create index.hbs (homepage)**

Create `ghost-theme/index.hbs`:

```handlebars
{{!< default}}

<div class="gh-container" style="max-width: 720px; margin: 0 auto; padding: 2rem 1rem;">
    {{#foreach posts}}
    <article class="post-card" style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb;">
        {{#if feature_image}}
        <a href="{{url}}">
            <img src="{{feature_image}}" alt="{{title}}" style="width: 100%; border-radius: 0.5rem; margin-bottom: 1rem;">
        </a>
        {{/if}}
        <h2 style="margin: 0 0 0.5rem; font-size: 1.375rem;">
            <a href="{{url}}" style="color: #1e293b; text-decoration: none;">{{title}}</a>
        </h2>
        <p style="color: #64748b; font-size: 0.9375rem; line-height: 1.6; margin: 0 0 0.75rem;">{{excerpt words="30"}}</p>
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: #94a3b8;">
            {{#foreach tags limit="1"}}
            <span style="background: rgba(34,211,238,0.1); color: #22d3ee; padding: 0.125rem 0.5rem; border-radius: 9999px;">{{name}}</span>
            {{/foreach}}
            <time datetime="{{date format="YYYY-MM-DD"}}">{{date format="MMM D, YYYY"}}</time>
        </div>
    </article>
    {{/foreach}}

    {{pagination}}
</div>
```

- [ ] **Step 9: Create post.hbs (single article)**

Create `ghost-theme/post.hbs`:

```handlebars
{{!< default}}

<article class="gh-article" style="max-width: 720px; margin: 0 auto; padding: 2rem 1rem;">
    <header style="margin-bottom: 2rem;">
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            {{#foreach tags}}
            <a href="{{url}}" style="background: rgba(34,211,238,0.1); color: #22d3ee; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8125rem; text-decoration: none;">{{name}}</a>
            {{/foreach}}
        </div>
        <h1 style="font-size: 2rem; font-weight: 700; color: #1e293b; margin: 0 0 1rem;">{{title}}</h1>
        <div style="display: flex; align-items: center; gap: 0.75rem; color: #64748b; font-size: 0.875rem;">
            {{#primary_author}}
            <span>By {{name}}</span>
            {{/primary_author}}
            <time datetime="{{date format="YYYY-MM-DD"}}">{{date format="MMMM D, YYYY"}}</time>
        </div>
    </header>

    {{#if feature_image}}
    <figure style="margin: 0 0 2rem;">
        <img src="{{feature_image}}" alt="{{title}}" style="width: 100%; border-radius: 0.5rem;">
    </figure>
    {{/if}}

    <div class="gh-content" style="font-size: 1.0625rem; line-height: 1.75; color: #334155;">
        {{content}}
    </div>
</article>
```

- [ ] **Step 10: Commit the Ghost theme**

```bash
git add ghost-theme/
git commit -m "feat: add Ghost theme (Casper fork) with Court Command navigation chrome"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Run backend build**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 2: Run backend vet**

Run: `cd backend && go vet ./...`
Expected: No issues.

- [ ] **Step 3: Run backend tests**

Run: `cd backend && go test ./... -v -count=1`
Expected: All tests pass.

- [ ] **Step 4: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run frontend build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Verify Docker Compose config**

Run: `docker compose config --quiet`
Expected: No errors (validates Ghost service added correctly).

- [ ] **Step 7: Final commit (if any uncommitted changes)**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "chore: final verification cleanup"
```
