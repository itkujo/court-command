# Phase 8: Admin & Platform Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Platform Admin panel API, unified audit log (ActivityLog), API key management for external consumers, file upload system, user management (suspend/ban), player merge approval, venue approval, and rate limiting for API keys.

**Architecture:** Three new migrations add `activity_logs`, `api_keys`, and a file upload tracking table. ActivityLog is append-only. API keys provide read-only scoped access with Redis-backed rate limiting. File upload uses a single endpoint with local disk storage (S3-compatible later). Platform Admin endpoints aggregate existing data with admin-specific filtering.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, PostgreSQL 17, Redis 7

**Depends on:** All prior phases (1-7)

---

## File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 00024_create_activity_logs.sql
│   │   ├── 00025_create_api_keys.sql
│   │   └── 00026_create_uploads.sql
│   └── queries/
│       ├── activity_logs.sql
│       ├── api_keys.sql
│       └── uploads.sql
├── handler/
│   ├── admin.go                         # Platform Admin endpoints
│   ├── api_key.go                       # API key management
│   └── upload.go                        # File upload
├── service/
│   ├── activity_log.go                  # Activity logging
│   ├── api_key.go                       # API key service
│   └── upload.go                        # File upload service
├── middleware/
│   ├── api_key.go                       # API key auth middleware
│   └── rate_limit.go                    # Redis rate limiter
├── uploads/                             # Local file storage directory (gitignored)
└── router/
    └── router.go                        # Modified: mount admin routes
```

---

## Task 1: ActivityLog Migration

**Files:**
- Create: `backend/db/migrations/00024_create_activity_logs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00024_create_activity_logs.sql

-- +goose Up
CREATE TABLE activity_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   BIGINT REFERENCES users(id),
    action          TEXT NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       BIGINT,
    details         JSONB NOT NULL DEFAULT '{}',
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_actor ON activity_logs (actor_user_id);
CREATE INDEX idx_activity_logs_target ON activity_logs (target_type, target_id);
CREATE INDEX idx_activity_logs_action ON activity_logs (action);
CREATE INDEX idx_activity_logs_created ON activity_logs (created_at);

-- +goose Down
DROP TABLE IF EXISTS activity_logs;
```

- [ ] **Step 2: Run migration and commit**

```bash
cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up
git add backend/db/migrations/00024_create_activity_logs.sql
git commit -m "feat: add activity_logs table migration"
```

---

## Task 2: API Keys Migration

**Files:**
- Create: `backend/db/migrations/00025_create_api_keys.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00025_create_api_keys.sql

-- +goose Up
CREATE TABLE api_keys (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      TEXT NOT NULL,
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    scope           TEXT NOT NULL DEFAULT 'global'
                    CHECK (scope IN ('global', 'league', 'tournament', 'organization')),
    scope_id        BIGINT,
    rate_limit      INT NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_user ON api_keys (created_by_user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys (key_prefix);

-- +goose Down
DROP TABLE IF EXISTS api_keys;
```

- [ ] **Step 2: Run migration and commit**

```bash
cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up
git add backend/db/migrations/00025_create_api_keys.sql
git commit -m "feat: add api_keys table migration"
```

---

## Task 3: Uploads Migration

**Files:**
- Create: `backend/db/migrations/00026_create_uploads.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/db/migrations/00026_create_uploads.sql

-- +goose Up
CREATE TABLE uploads (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    url             TEXT NOT NULL,
    uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uploads_user ON uploads (uploaded_by_user_id);

-- +goose Down
DROP TABLE IF EXISTS uploads;
```

- [ ] **Step 2: Run migration and commit**

```bash
cd backend && goose -dir db/migrations postgres "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" up
git add backend/db/migrations/00026_create_uploads.sql
git commit -m "feat: add uploads table migration"
```

---

## Task 4: Queries

**Files:**
- Create: `backend/db/queries/activity_logs.sql`
- Create: `backend/db/queries/api_keys.sql`
- Create: `backend/db/queries/uploads.sql`

- [ ] **Step 1: Activity log queries**

```sql
-- backend/db/queries/activity_logs.sql

-- name: CreateActivityLog :one
INSERT INTO activity_logs (actor_user_id, action, target_type, target_id, details, ip_address)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListActivityLogs :many
SELECT * FROM activity_logs
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListActivityLogsByActor :many
SELECT * FROM activity_logs
WHERE actor_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActivityLogsByTarget :many
SELECT * FROM activity_logs
WHERE target_type = $1 AND target_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListActivityLogsByAction :many
SELECT * FROM activity_logs
WHERE action = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

- [ ] **Step 2: API key queries**

```sql
-- backend/db/queries/api_keys.sql

-- name: CreateApiKey :one
INSERT INTO api_keys (name, key_hash, key_prefix, created_by_user_id, scope, scope_id, rate_limit, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetApiKeyByHash :one
SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true;

-- name: ListApiKeysByUser :many
SELECT * FROM api_keys WHERE created_by_user_id = $1 ORDER BY created_at DESC;

-- name: ListAllApiKeys :many
SELECT * FROM api_keys ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: DeactivateApiKey :one
UPDATE api_keys SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *;

-- name: UpdateApiKeyLastUsed :exec
UPDATE api_keys SET last_used_at = now() WHERE id = $1;

-- name: DeleteApiKey :exec
DELETE FROM api_keys WHERE id = $1;
```

- [ ] **Step 3: Upload queries**

```sql
-- backend/db/queries/uploads.sql

-- name: CreateUpload :one
INSERT INTO uploads (filename, original_name, content_type, size_bytes, url, uploaded_by_user_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUploadByID :one
SELECT * FROM uploads WHERE id = $1;

-- name: ListUploadsByUser :many
SELECT * FROM uploads WHERE uploaded_by_user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: DeleteUpload :exec
DELETE FROM uploads WHERE id = $1;
```

- [ ] **Step 4: Regenerate sqlc and commit**

```bash
cd backend && sqlc generate
git add backend/db/queries/activity_logs.sql backend/db/queries/api_keys.sql backend/db/queries/uploads.sql backend/db/generated/
git commit -m "feat: add activity log, API key, and upload sqlc queries"
```

---

## Task 5: ActivityLog Service

**Files:**
- Create: `backend/service/activity_log.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/activity_log.go
package service

import (
	"context"
	"encoding/json"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
)

// ActivityLogService handles audit logging.
type ActivityLogService struct {
	queries *generated.Queries
}

// NewActivityLogService creates a new ActivityLogService.
func NewActivityLogService(queries *generated.Queries) *ActivityLogService {
	return &ActivityLogService{queries: queries}
}

// Log records an activity log entry.
func (s *ActivityLogService) Log(ctx context.Context, actorUserID int64, action string, targetType string, targetID int64, details interface{}, ipAddress string) error {
	detailsJSON, _ := json.Marshal(details)

	_, err := s.queries.CreateActivityLog(ctx, generated.CreateActivityLogParams{
		ActorUserID: pgtype.Int8{Int64: actorUserID, Valid: actorUserID > 0},
		Action:      action,
		TargetType:  targetType,
		TargetID:    pgtype.Int8{Int64: targetID, Valid: targetID > 0},
		Details:     detailsJSON,
		IpAddress:   pgtype.Text{String: ipAddress, Valid: ipAddress != ""},
	})
	return err
}

// ListAll returns paginated activity logs.
func (s *ActivityLogService) ListAll(ctx context.Context, limit, offset int32) ([]generated.ActivityLog, error) {
	return s.queries.ListActivityLogs(ctx, generated.ListActivityLogsParams{Limit: limit, Offset: offset})
}

// ListByActor returns activity logs for a specific user.
func (s *ActivityLogService) ListByActor(ctx context.Context, userID int64, limit, offset int32) ([]generated.ActivityLog, error) {
	return s.queries.ListActivityLogsByActor(ctx, generated.ListActivityLogsByActorParams{
		ActorUserID: pgtype.Int8{Int64: userID, Valid: true},
		Limit:       limit,
		Offset:      offset,
	})
}

// ListByTarget returns activity logs for a specific target.
func (s *ActivityLogService) ListByTarget(ctx context.Context, targetType string, targetID int64, limit, offset int32) ([]generated.ActivityLog, error) {
	return s.queries.ListActivityLogsByTarget(ctx, generated.ListActivityLogsByTargetParams{
		TargetType: targetType,
		TargetID:   pgtype.Int8{Int64: targetID, Valid: true},
		Limit:      limit,
		Offset:     offset,
	})
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/service/activity_log.go
git commit -m "feat: add ActivityLogService"
```

---

## Task 6: API Key Service

**Files:**
- Create: `backend/service/api_key.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/api_key.go
package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
)

// ApiKeyService handles API key management.
type ApiKeyService struct {
	queries *generated.Queries
}

// NewApiKeyService creates a new ApiKeyService.
func NewApiKeyService(queries *generated.Queries) *ApiKeyService {
	return &ApiKeyService{queries: queries}
}

// CreateKeyResult holds the generated key (shown once) and the DB record.
type CreateKeyResult struct {
	Key    string              `json:"key"`     // The actual API key — shown only once
	Record generated.ApiKey   `json:"record"`
}

// Create generates a new API key and stores its hash.
func (s *ApiKeyService) Create(ctx context.Context, name string, userID int64, scope string, scopeID *int64, rateLimit int, expiresAt *pgtype.Timestamptz) (CreateKeyResult, error) {
	// Generate random key: cc_sk_<32 hex chars>
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return CreateKeyResult{}, fmt.Errorf("generate key: %w", err)
	}
	key := "cc_sk_" + hex.EncodeToString(randomBytes)
	prefix := key[:14] // "cc_sk_" + first 8 hex chars

	// Hash for storage
	hash := sha256.Sum256([]byte(key))
	keyHash := hex.EncodeToString(hash[:])

	params := generated.CreateApiKeyParams{
		Name:            name,
		KeyHash:         keyHash,
		KeyPrefix:       prefix,
		CreatedByUserID: userID,
		Scope:           scope,
		RateLimit:       int32(rateLimit),
	}

	if scopeID != nil {
		params.ScopeID = pgtype.Int8{Int64: *scopeID, Valid: true}
	}
	if expiresAt != nil {
		params.ExpiresAt = *expiresAt
	}

	record, err := s.queries.CreateApiKey(ctx, params)
	if err != nil {
		return CreateKeyResult{}, fmt.Errorf("create key: %w", err)
	}

	return CreateKeyResult{Key: key, Record: record}, nil
}

// ValidateKey checks if a key is valid and returns the key record.
func (s *ApiKeyService) ValidateKey(ctx context.Context, key string) (generated.ApiKey, error) {
	hash := sha256.Sum256([]byte(key))
	keyHash := hex.EncodeToString(hash[:])

	record, err := s.queries.GetApiKeyByHash(ctx, keyHash)
	if err != nil {
		return generated.ApiKey{}, fmt.Errorf("invalid API key")
	}

	// Check expiration
	if record.ExpiresAt.Valid && record.ExpiresAt.Time.Before(time.Now()) {
		return generated.ApiKey{}, fmt.Errorf("API key expired")
	}

	// Update last used
	_ = s.queries.UpdateApiKeyLastUsed(ctx, record.ID)

	return record, nil
}

// ListByUser returns all API keys for a user (without showing the key itself).
func (s *ApiKeyService) ListByUser(ctx context.Context, userID int64) ([]generated.ApiKey, error) {
	return s.queries.ListApiKeysByUser(ctx, userID)
}

// Deactivate deactivates an API key.
func (s *ApiKeyService) Deactivate(ctx context.Context, keyID int64) (generated.ApiKey, error) {
	return s.queries.DeactivateApiKey(ctx, keyID)
}
```

**Note for executing agent:** Add `time` import for the expiration check.

- [ ] **Step 2: Commit**

```bash
git add backend/service/api_key.go
git commit -m "feat: add ApiKeyService with key generation and validation"
```

---

## Task 7: Upload Service

**Files:**
- Create: `backend/service/upload.go`

- [ ] **Step 1: Create the service**

```go
// backend/service/upload.go
package service

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/court-command/court-command/backend/db/generated"
)

// UploadService handles file uploads.
type UploadService struct {
	queries   *generated.Queries
	uploadDir string
	baseURL   string
}

// NewUploadService creates a new UploadService.
func NewUploadService(queries *generated.Queries, uploadDir string, baseURL string) *UploadService {
	return &UploadService{queries: queries, uploadDir: uploadDir, baseURL: baseURL}
}

// MaxFileSize is the maximum upload size (2MB).
const MaxFileSize = 2 << 20

// AllowedContentTypes lists accepted image types.
var AllowedContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/svg+xml": true,
}

// Upload stores a file and records it in the database.
func (s *UploadService) Upload(ctx context.Context, file multipart.File, header *multipart.FileHeader, userID int64) (generated.Upload, error) {
	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if !AllowedContentTypes[contentType] {
		return generated.Upload{}, fmt.Errorf("unsupported file type: %s", contentType)
	}

	// Validate size
	if header.Size > MaxFileSize {
		return generated.Upload{}, fmt.Errorf("file too large: %d bytes (max %d)", header.Size, MaxFileSize)
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".bin"
	}
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), randomHex(8), ext)

	// Ensure upload directory exists
	if err := os.MkdirAll(s.uploadDir, 0755); err != nil {
		return generated.Upload{}, fmt.Errorf("create upload dir: %w", err)
	}

	// Write file
	dst, err := os.Create(filepath.Join(s.uploadDir, filename))
	if err != nil {
		return generated.Upload{}, fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return generated.Upload{}, fmt.Errorf("write file: %w", err)
	}

	// Build URL
	url := strings.TrimRight(s.baseURL, "/") + "/uploads/" + filename

	// Record in DB
	upload, err := s.queries.CreateUpload(ctx, generated.CreateUploadParams{
		Filename:         filename,
		OriginalName:     header.Filename,
		ContentType:      contentType,
		SizeBytes:        header.Size,
		Url:              url,
		UploadedByUserID: userID,
	})
	if err != nil {
		// Clean up file on DB error
		os.Remove(filepath.Join(s.uploadDir, filename))
		return generated.Upload{}, fmt.Errorf("record upload: %w", err)
	}

	return upload, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}
```

**Note for executing agent:** Add `crypto/rand` import for `randomHex`.

- [ ] **Step 2: Commit**

```bash
git add backend/service/upload.go
git commit -m "feat: add file upload service with local disk storage"
```

---

## Task 8: API Key Middleware

**Files:**
- Create: `backend/middleware/api_key.go`

- [ ] **Step 1: Create the middleware**

```go
// backend/middleware/api_key.go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/court-command/court-command/backend/db/generated"
	"github.com/court-command/court-command/backend/service"
)

type apiKeyContextKey struct{}

// GetApiKeyFromContext returns the API key from the request context.
func GetApiKeyFromContext(ctx context.Context) *generated.ApiKey {
	if key, ok := ctx.Value(apiKeyContextKey{}).(*generated.ApiKey); ok {
		return key
	}
	return nil
}

// ApiKeyAuth creates middleware that authenticates requests via API key.
// API key should be provided as Bearer token: "Authorization: Bearer cc_sk_..."
// or as X-API-Key header.
func ApiKeyAuth(apiKeyService *service.ApiKeyService) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := extractApiKey(r)
			if key == "" {
				http.Error(w, `{"error":{"code":"MISSING_API_KEY","message":"API key required"}}`, http.StatusUnauthorized)
				return
			}

			record, err := apiKeyService.ValidateKey(r.Context(), key)
			if err != nil {
				http.Error(w, `{"error":{"code":"INVALID_API_KEY","message":"Invalid or expired API key"}}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), apiKeyContextKey{}, &record)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractApiKey(r *http.Request) string {
	// Check Authorization header
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	// Check X-API-Key header
	if key := r.Header.Get("X-API-Key"); key != "" {
		return key
	}

	return ""
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/middleware/api_key.go
git commit -m "feat: add API key authentication middleware"
```

---

## Task 9: Rate Limiting Middleware

**Files:**
- Create: `backend/middleware/rate_limit.go`

- [ ] **Step 1: Create the middleware**

```go
// backend/middleware/rate_limit.go
package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimit creates middleware that rate-limits API key requests.
// Uses Redis sliding window: key = "ratelimit:{api_key_id}", window = 1 minute.
func RateLimit(rdb *redis.Client) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := GetApiKeyFromContext(r.Context())
			if apiKey == nil {
				// No API key in context — skip rate limiting
				next.ServeHTTP(w, r)
				return
			}

			ctx := r.Context()
			redisKey := fmt.Sprintf("ratelimit:%d", apiKey.ID)
			limit := int64(apiKey.RateLimit)

			// Increment counter
			count, err := rdb.Incr(ctx, redisKey).Result()
			if err != nil {
				// Redis error — allow request but log
				next.ServeHTTP(w, r)
				return
			}

			// Set expiry on first request in window
			if count == 1 {
				rdb.Expire(ctx, redisKey, 1*time.Minute)
			}

			// Check limit
			if count > limit {
				ttl, _ := rdb.TTL(ctx, redisKey).Result()
				w.Header().Set("Retry-After", strconv.Itoa(int(ttl.Seconds())+1))
				w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
				w.Header().Set("X-RateLimit-Remaining", "0")
				http.Error(w, `{"error":{"code":"RATE_LIMITED","message":"Too many requests"}}`, http.StatusTooManyRequests)
				return
			}

			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(limit-count, 10))

			next.ServeHTTP(w, r)
		})
	}
}
```

**Note for executing agent:** Remove unused `context` import if Go complains (it's used implicitly via `r.Context()`).

- [ ] **Step 2: Commit**

```bash
git add backend/middleware/rate_limit.go
git commit -m "feat: add Redis-backed rate limiting middleware"
```

---

## Task 10: Admin Handler

**Files:**
- Create: `backend/handler/admin.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/admin.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// AdminHandler handles Platform Admin endpoints.
type AdminHandler struct {
	queries          *generated.Queries
	activityService  *service.ActivityLogService
	apiKeyService    *service.ApiKeyService
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(queries *generated.Queries, activityService *service.ActivityLogService, apiKeyService *service.ApiKeyService) *AdminHandler {
	return &AdminHandler{queries: queries, activityService: activityService, apiKeyService: apiKeyService}
}

// Routes returns the Chi routes for admin endpoints.
func (h *AdminHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// User management
	r.Get("/users", h.ListUsers)
	r.Get("/users/{userID}", h.GetUser)
	r.Put("/users/{userID}/role", h.UpdateRole)
	r.Post("/users/{userID}/suspend", h.SuspendUser)
	r.Post("/users/{userID}/ban", h.BanUser)
	r.Post("/users/{userID}/reinstate", h.ReinstateUser)

	// Venue approval
	r.Get("/venues/pending", h.ListPendingVenues)
	r.Post("/venues/{venueID}/approve", h.ApproveVenue)
	r.Post("/venues/{venueID}/reject", h.RejectVenue)

	// Activity logs
	r.Get("/activity", h.ListActivityLogs)

	// API keys
	r.Get("/api-keys", h.ListAllApiKeys)
	r.Post("/api-keys", h.CreateApiKey)
	r.Delete("/api-keys/{keyID}", h.DeactivateApiKey)

	// System stats
	r.Get("/stats", h.GetSystemStats)

	return r
}

// ListUsers handles GET /api/v1/admin/users
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("q")
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)
	if limit <= 0 { limit = 20 }

	users, err := h.queries.SearchUsers(r.Context(), generated.SearchUsersParams{
		Column1: search,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	respondJSON(w, http.StatusOK, users)
}

// GetUser handles GET /api/v1/admin/users/{userID}
func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	user, err := h.queries.GetUserByID(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}
	respondJSON(w, http.StatusOK, user)
}

// UpdateRole handles PUT /api/v1/admin/users/{userID}/role
func (h *AdminHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	user, err := h.queries.UpdateUserRole(r.Context(), generated.UpdateUserRoleParams{
		ID:   userID,
		Role: req.Role,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "user.role_updated", "user", userID,
		map[string]string{"new_role": req.Role}, r.RemoteAddr)

	respondJSON(w, http.StatusOK, user)
}

// SuspendUser handles POST /api/v1/admin/users/{userID}/suspend
func (h *AdminHandler) SuspendUser(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "reason is required")
		return
	}

	user, err := h.queries.UpdateUserStatus(r.Context(), generated.UpdateUserStatusParams{
		ID:     userID,
		Status: "suspended",
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "SUSPEND_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "user.suspended", "user", userID,
		map[string]string{"reason": req.Reason}, r.RemoteAddr)

	respondJSON(w, http.StatusOK, user)
}

// BanUser handles POST /api/v1/admin/users/{userID}/ban
func (h *AdminHandler) BanUser(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "reason is required")
		return
	}

	user, err := h.queries.UpdateUserStatus(r.Context(), generated.UpdateUserStatusParams{
		ID:     userID,
		Status: "banned",
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "BAN_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "user.banned", "user", userID,
		map[string]string{"reason": req.Reason}, r.RemoteAddr)

	respondJSON(w, http.StatusOK, user)
}

// ReinstateUser handles POST /api/v1/admin/users/{userID}/reinstate
func (h *AdminHandler) ReinstateUser(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	user, err := h.queries.UpdateUserStatus(r.Context(), generated.UpdateUserStatusParams{
		ID:     userID,
		Status: "active",
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "REINSTATE_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "user.reinstated", "user", userID, nil, r.RemoteAddr)

	respondJSON(w, http.StatusOK, user)
}

// ListPendingVenues handles GET /api/v1/admin/venues/pending
func (h *AdminHandler) ListPendingVenues(w http.ResponseWriter, r *http.Request) {
	venues, err := h.queries.ListVenuesByStatus(r.Context(), "pending_review")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	respondJSON(w, http.StatusOK, venues)
}

// ApproveVenue handles POST /api/v1/admin/venues/{venueID}/approve
func (h *AdminHandler) ApproveVenue(w http.ResponseWriter, r *http.Request) {
	venueID, _ := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	venue, err := h.queries.UpdateVenueStatus(r.Context(), generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "published",
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "APPROVE_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "venue.approved", "venue", venueID, nil, r.RemoteAddr)

	respondJSON(w, http.StatusOK, venue)
}

// RejectVenue handles POST /api/v1/admin/venues/{venueID}/reject
func (h *AdminHandler) RejectVenue(w http.ResponseWriter, r *http.Request) {
	venueID, _ := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	venue, err := h.queries.UpdateVenueStatus(r.Context(), generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "draft",
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "REJECT_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "venue.rejected", "venue", venueID,
		map[string]string{"reason": req.Reason}, r.RemoteAddr)

	respondJSON(w, http.StatusOK, venue)
}

// ListActivityLogs handles GET /api/v1/admin/activity
func (h *AdminHandler) ListActivityLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)
	if limit <= 0 { limit = 50 }

	logs, err := h.activityService.ListAll(r.Context(), int32(limit), int32(offset))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	respondJSON(w, http.StatusOK, logs)
}

// ListAllApiKeys handles GET /api/v1/admin/api-keys
func (h *AdminHandler) ListAllApiKeys(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)
	if limit <= 0 { limit = 50 }

	keys, err := h.queries.ListAllApiKeys(r.Context(), generated.ListAllApiKeysParams{
		Limit: int32(limit), Offset: int32(offset),
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	respondJSON(w, http.StatusOK, keys)
}

// CreateApiKey handles POST /api/v1/admin/api-keys
func (h *AdminHandler) CreateApiKey(w http.ResponseWriter, r *http.Request) {
	actor := middleware.GetUserFromContext(r.Context())

	var req struct {
		Name      string `json:"name"`
		Scope     string `json:"scope"`
		ScopeID   *int64 `json:"scope_id"`
		RateLimit int    `json:"rate_limit"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "MISSING_FIELD", "name is required")
		return
	}
	if req.Scope == "" { req.Scope = "global" }
	if req.RateLimit <= 0 { req.RateLimit = 100 }

	result, err := h.apiKeyService.Create(r.Context(), req.Name, actor.ID, req.Scope, req.ScopeID, req.RateLimit, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "api_key.created", "api_key", result.Record.ID,
		map[string]string{"name": req.Name, "scope": req.Scope}, r.RemoteAddr)

	respondJSON(w, http.StatusCreated, result)
}

// DeactivateApiKey handles DELETE /api/v1/admin/api-keys/{keyID}
func (h *AdminHandler) DeactivateApiKey(w http.ResponseWriter, r *http.Request) {
	keyID, _ := strconv.ParseInt(chi.URLParam(r, "keyID"), 10, 64)
	actor := middleware.GetUserFromContext(r.Context())

	key, err := h.apiKeyService.Deactivate(r.Context(), keyID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "DEACTIVATE_FAILED", err.Error())
		return
	}

	_ = h.activityService.Log(r.Context(), actor.ID, "api_key.deactivated", "api_key", keyID, nil, r.RemoteAddr)

	respondJSON(w, http.StatusOK, key)
}

// GetSystemStats handles GET /api/v1/admin/stats
func (h *AdminHandler) GetSystemStats(w http.ResponseWriter, r *http.Request) {
	// The executing agent should add count queries for each entity type
	// For now, return a placeholder structure
	stats := map[string]interface{}{
		"total_users":       0,
		"total_tournaments": 0,
		"total_leagues":     0,
		"total_matches":     0,
		"total_venues":      0,
		"total_courts":      0,
		"total_teams":       0,
		"total_orgs":        0,
	}
	respondJSON(w, http.StatusOK, stats)
}
```

**Note for executing agent:** Add the missing import for `generated` package. The `SearchUsers`, `UpdateUserRole`, `UpdateUserStatus`, `ListVenuesByStatus`, `UpdateVenueStatus` queries may not exist — check Phase 1 and Phase 2 query files and add if missing. The `GetSystemStats` method should be updated with actual COUNT queries.

- [ ] **Step 2: Commit**

```bash
git add backend/handler/admin.go
git commit -m "feat: add Platform Admin handler"
```

---

## Task 11: Upload Handler

**Files:**
- Create: `backend/handler/upload.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handler/upload.go
package handler

import (
	"net/http"

	"github.com/court-command/court-command/backend/middleware"
	"github.com/court-command/court-command/backend/service"
	"github.com/go-chi/chi/v5"
)

// UploadHandler handles file upload requests.
type UploadHandler struct {
	uploadService *service.UploadService
}

// NewUploadHandler creates a new UploadHandler.
func NewUploadHandler(uploadService *service.UploadService) *UploadHandler {
	return &UploadHandler{uploadService: uploadService}
}

// Routes returns the Chi routes for uploads.
func (h *UploadHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", h.Upload)
	return r
}

// Upload handles POST /api/v1/upload
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	// Parse multipart form (max 2MB + overhead)
	if err := r.ParseMultipartForm(3 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "PARSE_FAILED", "Failed to parse upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "MISSING_FILE", "file field is required")
		return
	}
	defer file.Close()

	upload, err := h.uploadService.Upload(r.Context(), file, header, user.ID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "UPLOAD_FAILED", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, upload)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/handler/upload.go
git commit -m "feat: add file upload handler"
```

---

## Task 12: Router Wiring

**Files:**
- Modify: `backend/router/router.go`

- [ ] **Step 1: Mount all new routes**

```go
// Admin routes (Platform Admin only)
r.Route("/api/v1/admin", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Use(requirePlatformAdmin) // from Phase 2
    r.Mount("/", adminHandler.Routes())
})

// File upload (authenticated)
r.Route("/api/v1/upload", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Mount("/", uploadHandler.Routes())
})

// API key management (user's own keys)
r.Route("/api/v1/api-keys", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Get("/", apiKeyHandler.ListMine)
    r.Post("/", apiKeyHandler.Create)
    r.Delete("/{keyID}", apiKeyHandler.Deactivate)
})

// External API routes (API key auth + rate limiting)
r.Route("/api/v1/external", func(r chi.Router) {
    r.Use(middleware.ApiKeyAuth(apiKeyService))
    r.Use(middleware.RateLimit(redisClient))
    // Read-only endpoints — mirror of public data
    r.Get("/tournaments", publicHandler.ListTournaments)
    r.Get("/leagues", publicHandler.ListLeagues)
    r.Get("/matches/{matchID}", matchHandler.GetByID)
    // ... add more as needed
})

// Static file serving for uploads
r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))
```

- [ ] **Step 2: Wire all services in main.go**

- [ ] **Step 3: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: wire admin, upload, API key, and external API routes"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Full build**

Run: `cd backend && go build ./...`

- [ ] **Step 2: sqlc generate**

Run: `cd backend && sqlc generate`

- [ ] **Step 3: Migration count**

Run: `ls backend/db/migrations/*.sql | wc -l`
Expected: 26 (00001 through 00026).

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: phase 8 final cleanup — all phases complete"
```

---

## Summary

Phase 8 adds:

### New tables:
- `activity_logs` — unified audit trail (action, target, actor, details, IP)
- `api_keys` — external API access tokens (hashed, scoped, rate-limited)
- `uploads` — file upload tracking

### New middleware:
- `ApiKeyAuth` — authenticates requests via API key (Bearer or X-API-Key)
- `RateLimit` — Redis sliding window rate limiter for API key requests

### New endpoints (20+):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/users` | List/search users |
| `GET` | `/api/v1/admin/users/{userID}` | Get user details |
| `PUT` | `/api/v1/admin/users/{userID}/role` | Update user role |
| `POST` | `/api/v1/admin/users/{userID}/suspend` | Suspend user |
| `POST` | `/api/v1/admin/users/{userID}/ban` | Ban user |
| `POST` | `/api/v1/admin/users/{userID}/reinstate` | Reinstate user |
| `GET` | `/api/v1/admin/venues/pending` | List pending venues |
| `POST` | `/api/v1/admin/venues/{venueID}/approve` | Approve venue |
| `POST` | `/api/v1/admin/venues/{venueID}/reject` | Reject venue |
| `GET` | `/api/v1/admin/activity` | List activity logs |
| `GET` | `/api/v1/admin/api-keys` | List all API keys |
| `POST` | `/api/v1/admin/api-keys` | Create API key |
| `DELETE` | `/api/v1/admin/api-keys/{keyID}` | Deactivate API key |
| `GET` | `/api/v1/admin/stats` | System statistics |
| `POST` | `/api/v1/upload` | Upload file |
| `GET` | `/api/v1/api-keys` | List my API keys |
| `POST` | `/api/v1/api-keys` | Create my API key |
| `DELETE` | `/api/v1/api-keys/{keyID}` | Deactivate my key |
| `GET` | `/api/v1/external/*` | External API (read-only, rate-limited) |

### Total migration count: 26
### Total API endpoint count across all phases: ~170+
