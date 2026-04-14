# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Court Command v2 Go backend with authentication, the User/Player entity, role system, Redis sessions, PostgreSQL migrations, and all foundational middleware — producing a deployable skeleton that all future phases build on.

**Architecture:** Go monolith using Chi router, PostgreSQL via pgx/v5 + sqlc for type-safe queries, Goose for migrations, Redis for sessions/pub-sub/caching. Docker Compose orchestrates all services locally. The backend serves a JSON REST API at `/api/v1/`. Auth uses email+password with bcrypt hashing and Redis-backed session cookies.

**Tech Stack:** Go 1.24+, Chi v5, pgx/v5, sqlc, Goose v3, Redis v7, PostgreSQL 17, Docker Compose, Testify (testing)

---

## File Structure

```
new-cc/
├── docker-compose.yml              # PostgreSQL 17 + Redis 7
├── .env.example                     # Environment variable template
├── Makefile                         # Dev commands: run, migrate, sqlc, test
├── backend/
│   ├── go.mod                       # Go module definition
│   ├── go.sum
│   ├── main.go                      # Entrypoint: wires config, DB, Redis, router, starts server
│   ├── sqlc.yaml                    # sqlc configuration
│   ├── config/
│   │   └── config.go                # Environment-based configuration (envconfig)
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 00001_create_users.sql  # First migration: users table
│   │   ├── queries/
│   │   │   └── users.sql            # sqlc query definitions for users
│   │   ├── generated/               # sqlc output (DO NOT EDIT)
│   │   │   ├── db.go
│   │   │   ├── models.go
│   │   │   └── users.sql.go
│   │   ├── db.go                    # Connection pool setup (pgxpool)
│   │   └── migrate.go               # Goose migration runner (embedded SQL)
│   ├── middleware/
│   │   ├── auth.go                  # Session-based auth middleware
│   │   ├── cors.go                  # CORS middleware
│   │   ├── requestid.go             # Request ID middleware (wraps chi)
│   │   ├── logging.go               # Structured JSON logging middleware
│   │   └── error.go                 # Recovery + structured error responses
│   ├── handler/
│   │   ├── health.go                # GET /api/v1/health
│   │   ├── auth.go                  # POST /api/v1/auth/register, /login, /logout, /me
│   │   └── response.go             # JSON response helpers (success, error, paginated)
│   ├── service/
│   │   └── auth.go                  # Auth business logic (register, login, sessions)
│   ├── session/
│   │   └── store.go                 # Redis session store
│   ├── router/
│   │   └── router.go                # Chi router setup, mounts all routes
│   └── testutil/
│       ├── testdb.go                # Test database setup/teardown helpers
│       └── testserver.go            # Test HTTP server helpers
```

---

## Prerequisites

Before starting, ensure the following are installed:

- **Go 1.24+**: `brew install go` (macOS) or download from https://go.dev/dl/
- **Docker + Docker Compose**: Required for PostgreSQL and Redis
- **sqlc**: `brew install sqlc` or `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`
- **goose**: `go install github.com/pressly/goose/v3/cmd/goose@latest`

---

## Task 1: Docker Compose + Environment Config

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `Makefile`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: courtcommand
      POSTGRES_PASSWORD: courtcommand
      POSTGRES_DB: courtcommand
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U courtcommand"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Create `.env.example`**

```bash
# .env.example
DATABASE_URL=postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable
REDIS_URL=redis://localhost:6379/0
PORT=8080
SESSION_SECRET=change-me-to-a-random-64-char-string
CORS_ALLOWED_ORIGINS=http://localhost:5173
ENV=development
```

- [ ] **Step 3: Create `Makefile`**

```makefile
# Makefile
.PHONY: dev up down migrate-up migrate-down migrate-create sqlc test

# Start Docker services
up:
	docker compose up -d

# Stop Docker services
down:
	docker compose down

# Run backend in development mode
dev: up
	cd backend && go run main.go

# Run migrations up
migrate-up: up
	cd backend && goose -dir db/migrations postgres "$(DATABASE_URL)" up

# Run migrations down one step
migrate-down:
	cd backend && goose -dir db/migrations postgres "$(DATABASE_URL)" down

# Create a new migration
migrate-create:
	cd backend && goose -dir db/migrations create $(name) sql

# Generate sqlc code
sqlc:
	cd backend && sqlc generate

# Run tests
test: up
	cd backend && go test ./... -v -count=1

# Include .env if it exists
-include .env
export
```

- [ ] **Step 4: Copy `.env.example` to `.env`**

Run: `cp .env.example .env`

- [ ] **Step 5: Start Docker services and verify**

Run: `make up && sleep 3 && docker compose ps`
Expected: Both `db` and `redis` containers running and healthy.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example Makefile
git commit -m "feat: add Docker Compose (PostgreSQL 17 + Redis 7) and Makefile"
```

Note: `.env` should be gitignored. We'll add `.gitignore` in Task 2.

---

## Task 2: Go Module + Project Skeleton

**Files:**
- Create: `backend/go.mod`
- Create: `backend/main.go` (minimal — just prints "starting")
- Create: `.gitignore`

- [ ] **Step 1: Initialize Go module**

Run (from repo root):
```bash
cd backend && go mod init github.com/court-command/court-command
```

- [ ] **Step 2: Create minimal `backend/main.go`**

```go
// backend/main.go
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("Court Command v2 starting...")
	os.Exit(0)
}
```

- [ ] **Step 3: Create `.gitignore` at repo root**

```gitignore
# .gitignore
.env
*.exe
*.dll
*.so
*.dylib
*.test
*.out
__debug_bin*
vendor/
tmp/
.DS_Store
backend/db/generated/
```

- [ ] **Step 4: Verify the Go module compiles**

Run: `cd backend && go build -o /dev/null .`
Expected: Clean exit, no errors.

- [ ] **Step 5: Commit**

```bash
git add .gitignore backend/go.mod backend/main.go
git commit -m "feat: initialize Go module and project skeleton"
```

---

## Task 3: Configuration Module

**Files:**
- Create: `backend/config/config.go`
- Modify: `backend/go.mod` (new dependency: `github.com/joho/godotenv`)

- [ ] **Step 1: Create `backend/config/config.go`**

```go
// backend/config/config.go
package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DatabaseURL        string
	RedisURL           string
	Port               string
	SessionSecret      string
	CORSAllowedOrigins []string
	Env                string // "development", "production"
}

// Load reads configuration from environment variables.
// It loads .env file if present (development convenience).
func Load() (*Config, error) {
	// Load .env file if it exists (ignore error if missing)
	_ = godotenv.Load("../.env")

	cfg := &Config{
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		RedisURL:      os.Getenv("REDIS_URL"),
		Port:          os.Getenv("PORT"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
		Env:           os.Getenv("ENV"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("SESSION_SECRET is required")
	}
	if cfg.Env == "" {
		cfg.Env = "development"
	}

	origins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if origins != "" {
		cfg.CORSAllowedOrigins = strings.Split(origins, ",")
	}

	return cfg, nil
}

// IsDevelopment returns true if running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}
```

- [ ] **Step 2: Add godotenv dependency**

Run: `cd backend && go get github.com/joho/godotenv`

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./config/...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add configuration module with env loading"
```

---

## Task 4: Database Connection Pool

**Files:**
- Create: `backend/db/db.go`
- Modify: `backend/go.mod` (new dependency: `github.com/jackc/pgx/v5`)

- [ ] **Step 1: Create `backend/db/db.go`**

```go
// backend/db/db.go
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect creates a new PostgreSQL connection pool.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return pool, nil
}
```

- [ ] **Step 2: Add pgx dependency**

Run: `cd backend && go get github.com/jackc/pgx/v5`

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./db/...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add PostgreSQL connection pool via pgx"
```

---

## Task 5: Migration Runner (Goose)

**Files:**
- Create: `backend/db/migrate.go`
- Create: `backend/db/migrations/00001_create_users.sql`
- Modify: `backend/go.mod` (new dependencies: goose, lib/pq for goose's sql.DB requirement)

- [ ] **Step 1: Create `backend/db/migrations/00001_create_users.sql`**

```sql
-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for CC-XXXXX public IDs
CREATE SEQUENCE IF NOT EXISTS user_public_id_seq START 10000;

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    public_id       TEXT NOT NULL UNIQUE DEFAULT 'CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'),
    email           TEXT UNIQUE,
    password_hash   TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   DATE NOT NULL,
    display_name    TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'unclaimed', 'merged')),
    merged_into_id  BIGINT REFERENCES users(id),
    role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('platform_admin', 'player')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_public_id ON users(public_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_dedup ON users(first_name, last_name, date_of_birth) WHERE status != 'merged' AND deleted_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS users;
DROP SEQUENCE IF EXISTS user_public_id_seq;
```

- [ ] **Step 2: Create `backend/db/migrate.go`**

```go
// backend/db/migrate.go
package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
	_ "github.com/jackc/pgx/v5/stdlib" // pgx driver for database/sql
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// RunMigrations applies all pending migrations using embedded SQL files.
func RunMigrations(ctx context.Context, databaseURL string) error {
	goose.SetBaseFS(embedMigrations)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("setting goose dialect: %w", err)
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("opening database for migrations: %w", err)
	}
	defer db.Close()

	if err := goose.UpContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}

	return nil
}
```

- [ ] **Step 3: Add goose dependency**

Run: `cd backend && go get github.com/pressly/goose/v3`

- [ ] **Step 4: Verify compilation**

Run: `cd backend && go build ./db/...`
Expected: Clean exit.

- [ ] **Step 5: Run migrations against Docker PostgreSQL**

Run (from repo root):
```bash
make up && sleep 2
cd backend && go run -run-migrations-only . 2>/dev/null || \
  DATABASE_URL="postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable" \
  goose -dir db/migrations postgres "$DATABASE_URL" up
```

Alternative (verify with psql):
```bash
docker compose exec db psql -U courtcommand -c "\dt"
```
Expected: `users` table listed.

- [ ] **Step 6: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add Goose migrations with users table"
```

---

## Task 6: sqlc Configuration + User Queries

**Files:**
- Create: `backend/sqlc.yaml`
- Create: `backend/db/queries/users.sql`
- Generate: `backend/db/generated/` (via `sqlc generate`)

- [ ] **Step 1: Create `backend/sqlc.yaml`**

```yaml
# backend/sqlc.yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "db/queries/"
    schema: "db/migrations/"
    gen:
      go:
        package: "generated"
        out: "db/generated"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
        overrides:
          - db_type: "timestamptz"
            go_type: "time.Time"
          - db_type: "date"
            go_type: "time.Time"
          - db_type: "text"
            nullable: true
            go_type:
              type: "*string"
```

- [ ] **Step 2: Create `backend/db/queries/users.sql`**

```sql
-- backend/db/queries/users.sql

-- name: CreateUser :one
INSERT INTO users (
    email, password_hash, first_name, last_name, date_of_birth, display_name, role
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 AND deleted_at IS NULL;

-- name: GetUserByPublicID :one
SELECT * FROM users
WHERE public_id = $1 AND deleted_at IS NULL;

-- name: UpdateUser :one
UPDATE users SET
    first_name = COALESCE(sqlc.narg('first_name'), first_name),
    last_name = COALESCE(sqlc.narg('last_name'), last_name),
    display_name = COALESCE(sqlc.narg('display_name'), display_name),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateUserStatus :one
UPDATE users SET
    status = $2,
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteUser :exec
UPDATE users SET
    deleted_at = now(),
    updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListUsers :many
SELECT * FROM users
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUsers :one
SELECT count(*) FROM users
WHERE deleted_at IS NULL;

-- name: CheckDuplicateUser :one
SELECT count(*) FROM users
WHERE first_name = $1
  AND last_name = $2
  AND date_of_birth = $3
  AND status != 'merged'
  AND deleted_at IS NULL;
```

- [ ] **Step 3: Install sqlc if needed and generate code**

Run:
```bash
which sqlc || go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
cd backend && sqlc generate
```
Expected: Files generated in `backend/db/generated/` — `db.go`, `models.go`, `users.sql.go`.

- [ ] **Step 4: Verify generated code compiles**

Run: `cd backend && go build ./db/generated/...`
Expected: Clean exit.

- [ ] **Step 5: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add sqlc config and user query definitions"
```

Note: We commit generated files so that CI and other developers don't need sqlc installed to build. The `.gitignore` entry for `db/generated/` should be REMOVED — we want these tracked.

---

## Task 7: Redis Session Store

**Files:**
- Create: `backend/session/store.go`
- Modify: `backend/go.mod` (new dependency: `github.com/redis/go-redis/v9`)

- [ ] **Step 1: Create `backend/session/store.go`**

```go
// backend/session/store.go
package session

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// SessionTTL is the lifetime of a session.
	SessionTTL = 30 * 24 * time.Hour // 30 days

	// SessionPrefix is the Redis key prefix for sessions.
	SessionPrefix = "session:"

	// SessionCookieName is the name of the session cookie.
	SessionCookieName = "cc_session"
)

// Data holds the session payload stored in Redis.
type Data struct {
	UserID    int64  `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	PublicID  string `json:"public_id"`
	CreatedAt int64  `json:"created_at"`
}

// Store manages sessions in Redis.
type Store struct {
	client *redis.Client
}

// NewStore creates a new session store backed by Redis.
func NewStore(redisURL string) (*Store, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("pinging redis: %w", err)
	}

	return &Store{client: client}, nil
}

// Create generates a new session token, stores session data in Redis, and returns the token.
func (s *Store) Create(ctx context.Context, data *Data) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", fmt.Errorf("generating session token: %w", err)
	}

	data.CreatedAt = time.Now().Unix()

	payload, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("marshaling session data: %w", err)
	}

	key := SessionPrefix + token
	if err := s.client.Set(ctx, key, payload, SessionTTL).Err(); err != nil {
		return "", fmt.Errorf("storing session: %w", err)
	}

	return token, nil
}

// Get retrieves session data by token. Returns nil if the session does not exist or has expired.
func (s *Store) Get(ctx context.Context, token string) (*Data, error) {
	key := SessionPrefix + token

	payload, err := s.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Session not found or expired
	}
	if err != nil {
		return nil, fmt.Errorf("getting session: %w", err)
	}

	var data Data
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil, fmt.Errorf("unmarshaling session data: %w", err)
	}

	return &data, nil
}

// Delete removes a session by token (logout).
func (s *Store) Delete(ctx context.Context, token string) error {
	key := SessionPrefix + token
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("deleting session: %w", err)
	}
	return nil
}

// DeleteAllForUser removes all sessions for a given user ID.
// Used for suspend/ban flows where we need instant session revocation.
func (s *Store) DeleteAllForUser(ctx context.Context, userID int64) error {
	// Scan for all sessions and check each one.
	// In production at scale, consider maintaining a user->sessions index.
	var cursor uint64
	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, SessionPrefix+"*", 100).Result()
		if err != nil {
			return fmt.Errorf("scanning sessions: %w", err)
		}

		for _, key := range keys {
			payload, err := s.client.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}
			var data Data
			if err := json.Unmarshal(payload, &data); err != nil {
				continue
			}
			if data.UserID == userID {
				s.client.Del(ctx, key)
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return nil
}

// Close closes the Redis client connection.
func (s *Store) Close() error {
	return s.client.Close()
}

// Client returns the underlying Redis client for use by other subsystems.
func (s *Store) Client() *redis.Client {
	return s.client
}

// generateToken creates a cryptographically random 32-byte hex token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
```

- [ ] **Step 2: Add go-redis dependency**

Run: `cd backend && go get github.com/redis/go-redis/v9`

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./session/...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add Redis session store"
```

---

## Task 8: JSON Response Helpers

**Files:**
- Create: `backend/handler/response.go`

- [ ] **Step 1: Create `backend/handler/response.go`**

```go
// backend/handler/response.go
package handler

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse is the structured error format returned by all API endpoints.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains the error code, message, and optional details.
type ErrorDetail struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// PaginatedResponse wraps a list response with pagination metadata.
type PaginatedResponse struct {
	Data       interface{}        `json:"data"`
	Pagination PaginationMetadata `json:"pagination"`
}

// PaginationMetadata contains pagination cursor information.
type PaginationMetadata struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// Success writes a 200 OK JSON response.
func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

// Created writes a 201 Created JSON response.
func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, data)
}

// NoContent writes a 204 No Content response.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Paginated writes a paginated JSON response.
func Paginated(w http.ResponseWriter, data interface{}, total int64, limit, offset int) {
	JSON(w, http.StatusOK, PaginatedResponse{
		Data: data,
		Pagination: PaginationMetadata{
			Total:  total,
			Limit:  limit,
			Offset: offset,
		},
	})
}

// WriteError writes a structured error response.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	})
}

// BadRequest writes a 400 error response.
func BadRequest(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, "bad_request", message)
}

// Unauthorized writes a 401 error response.
func Unauthorized(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, "unauthorized", message)
}

// Forbidden writes a 403 error response.
func Forbidden(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusForbidden, "forbidden", message)
}

// NotFound writes a 404 error response.
func NotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, "not_found", message)
}

// Conflict writes a 409 error response.
func Conflict(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusConflict, "conflict", message)
}

// InternalError writes a 500 error response.
func InternalError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusInternalServerError, "internal_error", message)
}

// DecodeJSON reads and decodes a JSON request body into the given target.
// Returns an error message string if decoding fails, or empty string on success.
func DecodeJSON(r *http.Request, target interface{}) string {
	if r.Body == nil {
		return "request body is required"
	}

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		return "invalid JSON: " + err.Error()
	}

	return ""
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./handler/...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add JSON response helpers"
```

---

## Task 9: Middleware Stack

**Files:**
- Create: `backend/middleware/requestid.go`
- Create: `backend/middleware/logging.go`
- Create: `backend/middleware/cors.go`
- Create: `backend/middleware/error.go`
- Create: `backend/middleware/auth.go`

- [ ] **Step 1: Create `backend/middleware/requestid.go`**

```go
// backend/middleware/requestid.go
package middleware

import (
	"context"
	"net/http"

	chimw "github.com/go-chi/chi/v5/middleware"
)

type contextKey string

const requestIDKey contextKey = "request_id"

// RequestID wraps chi's RequestID middleware and also stores the ID in context
// for structured logging.
func RequestID(next http.Handler) http.Handler {
	return chimw.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := chimw.GetReqID(r.Context())
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	}))
}

// GetRequestID retrieves the request ID from context.
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}
```

- [ ] **Step 2: Create `backend/middleware/logging.go`**

```go
// backend/middleware/logging.go
package middleware

import (
	"log/slog"
	"net/http"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// StructuredLogger logs each request as structured JSON using slog.
func StructuredLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap the response writer to capture status code
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"bytes", ww.BytesWritten(),
			"request_id", GetRequestID(r.Context()),
			"remote_addr", r.RemoteAddr,
		)
	})
}
```

- [ ] **Step 3: Create `backend/middleware/cors.go`**

```go
// backend/middleware/cors.go
package middleware

import (
	"net/http"
	"strings"
)

// CORS returns a middleware that handles CORS headers.
// allowedOrigins is a list of allowed origins. Empty list means deny all cross-origin requests.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	originSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.TrimSpace(o)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if origin != "" && originSet[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Create `backend/middleware/error.go`**

```go
// backend/middleware/error.go
package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// Recoverer catches panics and returns a structured 500 error response.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				reqID := chimw.GetReqID(r.Context())

				slog.Error("panic recovered",
					"error", rvr,
					"request_id", reqID,
					"stack", string(debug.Stack()),
				)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "internal_error",
						"message": "an unexpected error occurred",
					},
				})
			}
		}()

		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 5: Create `backend/middleware/auth.go`**

```go
// backend/middleware/auth.go
package middleware

import (
	"context"
	"net/http"

	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/session"
)

type sessionContextKey struct{}

// SessionData returns the session data from the request context, or nil if not authenticated.
func SessionData(ctx context.Context) *session.Data {
	if data, ok := ctx.Value(sessionContextKey{}).(*session.Data); ok {
		return data
	}
	return nil
}

// RequireAuth is a middleware that requires a valid session cookie.
// If the session is invalid or missing, it returns 401 Unauthorized.
func RequireAuth(store *session.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(session.SessionCookieName)
			if err != nil {
				handler.Unauthorized(w, "authentication required")
				return
			}

			data, err := store.Get(r.Context(), cookie.Value)
			if err != nil {
				handler.InternalError(w, "session lookup failed")
				return
			}
			if data == nil {
				handler.Unauthorized(w, "session expired or invalid")
				return
			}

			ctx := context.WithValue(r.Context(), sessionContextKey{}, data)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that checks the authenticated user has one of the allowed roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			data := SessionData(r.Context())
			if data == nil {
				handler.Unauthorized(w, "authentication required")
				return
			}

			if !roleSet[data.Role] {
				handler.Forbidden(w, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 6: Add chi dependency**

Run: `cd backend && go get github.com/go-chi/chi/v5`

- [ ] **Step 7: Verify all middleware compiles**

Run: `cd backend && go build ./middleware/...`
Expected: Clean exit.

- [ ] **Step 8: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add middleware stack (auth, CORS, logging, recovery, request ID)"
```

---

## Task 10: Auth Service

**Files:**
- Create: `backend/service/auth.go`
- Modify: `backend/go.mod` (new dependency: `golang.org/x/crypto` for bcrypt)

- [ ] **Step 1: Create `backend/service/auth.go`**

```go
// backend/service/auth.go
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/session"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// AuthService handles user registration and authentication.
type AuthService struct {
	db           *pgxpool.Pool
	queries      *generated.Queries
	sessionStore *session.Store
}

// NewAuthService creates a new AuthService.
func NewAuthService(db *pgxpool.Pool, sessionStore *session.Store) *AuthService {
	return &AuthService{
		db:           db,
		queries:      generated.New(db),
		sessionStore: sessionStore,
	}
}

// RegisterInput contains the fields required to register a new user.
type RegisterInput struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"` // YYYY-MM-DD format
}

// Validate checks that all required fields are present and valid.
func (in *RegisterInput) Validate() error {
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	in.FirstName = strings.TrimSpace(in.FirstName)
	in.LastName = strings.TrimSpace(in.LastName)

	if in.Email == "" {
		return errors.New("email is required")
	}
	if !strings.Contains(in.Email, "@") {
		return errors.New("email is invalid")
	}
	if in.Password == "" {
		return errors.New("password is required")
	}
	if len(in.Password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if in.FirstName == "" {
		return errors.New("first_name is required")
	}
	if in.LastName == "" {
		return errors.New("last_name is required")
	}
	if in.DateOfBirth == "" {
		return errors.New("date_of_birth is required")
	}
	if _, err := time.Parse("2006-01-02", in.DateOfBirth); err != nil {
		return errors.New("date_of_birth must be in YYYY-MM-DD format")
	}
	return nil
}

// UserResponse is the public representation of a user (no password hash).
type UserResponse struct {
	ID          int64      `json:"id"`
	PublicID    string     `json:"public_id"`
	Email       *string    `json:"email,omitempty"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	DisplayName *string    `json:"display_name,omitempty"`
	DateOfBirth string     `json:"date_of_birth"`
	Status      string     `json:"status"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Register creates a new user account and returns a session token.
func (s *AuthService) Register(ctx context.Context, input *RegisterInput) (*UserResponse, string, error) {
	if err := input.Validate(); err != nil {
		return nil, "", fmt.Errorf("validation: %w", err)
	}

	// Check for existing email
	_, err := s.queries.GetUserByEmail(ctx, &input.Email)
	if err == nil {
		return nil, "", fmt.Errorf("validation: email already registered")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, "", fmt.Errorf("checking email: %w", err)
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("hashing password: %w", err)
	}

	dob, _ := time.Parse("2006-01-02", input.DateOfBirth) // already validated

	user, err := s.queries.CreateUser(ctx, generated.CreateUserParams{
		Email:        &input.Email,
		PasswordHash: string(hash),
		FirstName:    input.FirstName,
		LastName:     input.LastName,
		DateOfBirth:  dob,
		DisplayName:  nil,
		Role:         "player",
	})
	if err != nil {
		return nil, "", fmt.Errorf("creating user: %w", err)
	}

	// Create session
	token, err := s.sessionStore.Create(ctx, &session.Data{
		UserID:   user.ID,
		Email:    input.Email,
		Role:     user.Role,
		PublicID: user.PublicID,
	})
	if err != nil {
		return nil, "", fmt.Errorf("creating session: %w", err)
	}

	return userToResponse(&user), token, nil
}

// LoginInput contains the fields required to log in.
type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login authenticates a user by email and password, returns a session token.
func (s *AuthService) Login(ctx context.Context, input *LoginInput) (*UserResponse, string, error) {
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	if input.Email == "" || input.Password == "" {
		return nil, "", fmt.Errorf("validation: email and password are required")
	}

	user, err := s.queries.GetUserByEmail(ctx, &input.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", fmt.Errorf("validation: invalid email or password")
	}
	if err != nil {
		return nil, "", fmt.Errorf("looking up user: %w", err)
	}

	if user.Status != "active" {
		return nil, "", fmt.Errorf("validation: account is %s", user.Status)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, "", fmt.Errorf("validation: invalid email or password")
	}

	token, err := s.sessionStore.Create(ctx, &session.Data{
		UserID:   user.ID,
		Email:    input.Email,
		Role:     user.Role,
		PublicID: user.PublicID,
	})
	if err != nil {
		return nil, "", fmt.Errorf("creating session: %w", err)
	}

	return userToResponse(&user), token, nil
}

// Logout invalidates the given session token.
func (s *AuthService) Logout(ctx context.Context, token string) error {
	return s.sessionStore.Delete(ctx, token)
}

// GetCurrentUser retrieves the user for the given session data.
func (s *AuthService) GetCurrentUser(ctx context.Context, sessionData *session.Data) (*UserResponse, error) {
	user, err := s.queries.GetUserByID(ctx, sessionData.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("not_found: user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("looking up user: %w", err)
	}

	return userToResponse(&user), nil
}

// userToResponse converts a database user row to the public response format.
func userToResponse(u *generated.User) *UserResponse {
	resp := &UserResponse{
		ID:          u.ID,
		PublicID:    u.PublicID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		DisplayName: u.DisplayName,
		DateOfBirth: u.DateOfBirth.Format("2006-01-02"),
		Status:      u.Status,
		Role:        u.Role,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
	return resp
}
```

- [ ] **Step 2: Add bcrypt dependency**

Run: `cd backend && go get golang.org/x/crypto`

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./service/...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add auth service (register, login, logout)"
```

---

## Task 11: Auth HTTP Handler

**Files:**
- Create: `backend/handler/auth.go`

- [ ] **Step 1: Create `backend/handler/auth.go`**

```go
// backend/handler/auth.go
package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService *service.AuthService
	secureCookie bool
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService, secureCookie bool) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		secureCookie: secureCookie,
	}
}

// Register handles POST /api/v1/auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input service.RegisterInput
	if errMsg := DecodeJSON(r, &input); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	user, token, err := h.authService.Register(r.Context(), &input)
	if err != nil {
		if strings.HasPrefix(err.Error(), "validation:") {
			BadRequest(w, strings.TrimPrefix(err.Error(), "validation: "))
			return
		}
		InternalError(w, "registration failed")
		return
	}

	h.setSessionCookie(w, token)
	Created(w, user)
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input service.LoginInput
	if errMsg := DecodeJSON(r, &input); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	user, token, err := h.authService.Login(r.Context(), &input)
	if err != nil {
		if strings.HasPrefix(err.Error(), "validation:") {
			BadRequest(w, strings.TrimPrefix(err.Error(), "validation: "))
			return
		}
		InternalError(w, "login failed")
		return
	}

	h.setSessionCookie(w, token)
	Success(w, user)
}

// Logout handles POST /api/v1/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(session.SessionCookieName)
	if err != nil {
		NoContent(w)
		return
	}

	_ = h.authService.Logout(r.Context(), cookie.Value)

	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})

	NoContent(w)
}

// Me handles GET /api/v1/auth/me.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	sessionData := middleware.SessionData(r.Context())
	if sessionData == nil {
		Unauthorized(w, "not authenticated")
		return
	}

	user, err := h.authService.GetCurrentUser(r.Context(), sessionData)
	if err != nil {
		if strings.HasPrefix(err.Error(), "not_found:") {
			NotFound(w, "user not found")
			return
		}
		InternalError(w, "failed to fetch user")
		return
	}

	Success(w, user)
}

// setSessionCookie writes the session token as an HTTP-only cookie.
func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()), // 30 days
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./handler/...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add auth HTTP handler (register, login, logout, me)"
```

---

## Task 12: Health Check Handler

**Files:**
- Create: `backend/handler/health.go`

- [ ] **Step 1: Create `backend/handler/health.go`**

```go
// backend/handler/health.go
package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// HealthHandler provides health check endpoints.
type HealthHandler struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler(db *pgxpool.Pool, redis *redis.Client) *HealthHandler {
	return &HealthHandler{db: db, redis: redis}
}

// Check handles GET /api/v1/health.
func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	status := "ok"
	dbStatus := "ok"
	redisStatus := "ok"

	if err := h.db.Ping(ctx); err != nil {
		dbStatus = "error"
		status = "degraded"
	}

	if err := h.redis.Ping(ctx).Err(); err != nil {
		redisStatus = "error"
		status = "degraded"
	}

	statusCode := http.StatusOK
	if status != "ok" {
		statusCode = http.StatusServiceUnavailable
	}

	JSON(w, statusCode, map[string]interface{}{
		"status": status,
		"services": map[string]string{
			"database": dbStatus,
			"redis":    redisStatus,
		},
	})
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./handler/...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add health check endpoint"
```

---

## Task 13: Router Assembly

**Files:**
- Create: `backend/router/router.go`

- [ ] **Step 1: Create `backend/router/router.go`**

```go
// backend/router/router.go
package router

import (
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/middleware"
	"github.com/court-command/court-command/session"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Config holds all dependencies needed by the router.
type Config struct {
	DB              *pgxpool.Pool
	SessionStore    *session.Store
	Redis           *redis.Client
	AllowedOrigins  []string
	AuthHandler     *handler.AuthHandler
	HealthHandler   *handler.HealthHandler
	SecureCookie    bool
}

// New creates and configures the Chi router with all routes and middleware.
func New(cfg *Config) chi.Router {
	r := chi.NewRouter()

	// Global middleware stack
	r.Use(middleware.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.StructuredLogger)
	r.Use(middleware.Recoverer)
	r.Use(chimw.CleanPath)
	r.Use(chimw.Timeout(60 * time.Second))
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes (no auth required)
		r.Get("/health", cfg.HealthHandler.Check)

		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", cfg.AuthHandler.Register)
			r.Post("/login", cfg.AuthHandler.Login)
			r.Post("/logout", cfg.AuthHandler.Logout)

			// Authenticated auth routes
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAuth(cfg.SessionStore))
				r.Get("/me", cfg.AuthHandler.Me)
			})
		})
	})

	return r
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && go build ./router/...`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add Chi router assembly with route mounting"
```

---

## Task 14: Main Entrypoint

**Files:**
- Modify: `backend/main.go`

- [ ] **Step 1: Rewrite `backend/main.go` to wire everything together**

```go
// backend/main.go
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/court-command/court-command/config"
	"github.com/court-command/court-command/db"
	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/router"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

func main() {
	// Structured JSON logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Run database migrations
	slog.Info("running database migrations")
	if err := db.RunMigrations(ctx, cfg.DatabaseURL); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Connect to PostgreSQL
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Connect to Redis (via session store)
	sessionStore, err := session.NewStore(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	defer sessionStore.Close()

	// Initialize services
	authService := service.NewAuthService(pool, sessionStore)

	// Initialize handlers
	secureCookie := !cfg.IsDevelopment()
	authHandler := handler.NewAuthHandler(authService, secureCookie)
	healthHandler := handler.NewHealthHandler(pool, sessionStore.Client())

	// Build router
	r := router.New(&router.Config{
		DB:             pool,
		SessionStore:   sessionStore,
		Redis:          sessionStore.Client(),
		AllowedOrigins: cfg.CORSAllowedOrigins,
		AuthHandler:    authHandler,
		HealthHandler:  healthHandler,
		SecureCookie:   secureCookie,
	})

	// Start HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down server")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
	}()

	slog.Info("server starting", "port", cfg.Port, "env", cfg.Env)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
```

- [ ] **Step 2: Verify full project compiles**

Run: `cd backend && go mod tidy && go build .`
Expected: Clean exit, binary produced.

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "feat: wire main entrypoint with graceful shutdown"
```

---

## Task 15: Integration Smoke Test

**Files:**
- None (manual verification)

- [ ] **Step 1: Start the full stack**

Run (from repo root):
```bash
make up && sleep 3 && cd backend && go run main.go &
sleep 2
```
Expected: Server logs "server starting" with port=8080.

- [ ] **Step 2: Test health endpoint**

Run: `curl -s http://localhost:8080/api/v1/health | jq .`
Expected:
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

- [ ] **Step 3: Test user registration**

Run:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","first_name":"Test","last_name":"User","date_of_birth":"1990-01-15"}' \
  -c cookies.txt | jq .
```
Expected: 201 response with user object including `public_id` starting with "CC-", `role: "player"`, `status: "active"`. Cookie file should contain `cc_session`.

- [ ] **Step 4: Test /me endpoint**

Run:
```bash
curl -s http://localhost:8080/api/v1/auth/me -b cookies.txt | jq .
```
Expected: 200 response with same user object.

- [ ] **Step 5: Test login**

Run:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies2.txt | jq .
```
Expected: 200 response with user object.

- [ ] **Step 6: Test logout**

Run:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/logout -b cookies.txt -c cookies.txt
curl -s http://localhost:8080/api/v1/auth/me -b cookies.txt | jq .
```
Expected: First call returns 204. Second call returns 401 unauthorized.

- [ ] **Step 7: Test duplicate registration**

Run:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","first_name":"Test","last_name":"User","date_of_birth":"1990-01-15"}' | jq .
```
Expected: 400 response with "email already registered" message.

- [ ] **Step 8: Test validation errors**

Run:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"bad","password":"short"}' | jq .
```
Expected: 400 response with validation error message.

- [ ] **Step 9: Stop the server and clean up**

Run: `kill %1 2>/dev/null; rm -f cookies.txt cookies2.txt`

- [ ] **Step 10: Commit (no file changes — this was a verification step)**

No commit needed unless fixes were applied.

---

## Task 16: Test Utilities

**Files:**
- Create: `backend/testutil/testdb.go`
- Create: `backend/testutil/testserver.go`

- [ ] **Step 1: Create `backend/testutil/testdb.go`**

```go
// backend/testutil/testdb.go
package testutil

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/court-command/court-command/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDB creates a connection to the test database and runs migrations.
// It returns a pool and a cleanup function.
// Requires DATABASE_URL to be set (typically pointing to the Docker Compose PostgreSQL).
func TestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://courtcommand:courtcommand@localhost:5432/courtcommand?sslmode=disable"
	}

	ctx := context.Background()

	// Run migrations
	if err := db.RunMigrations(ctx, databaseURL); err != nil {
		t.Fatalf("running migrations: %v", err)
	}

	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connecting to database: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// CleanTable truncates the given table. Useful for test isolation.
func CleanTable(t *testing.T, pool *pgxpool.Pool, table string) {
	t.Helper()
	_, err := pool.Exec(context.Background(), fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
	if err != nil {
		t.Fatalf("truncating table %s: %v", table, err)
	}
}
```

- [ ] **Step 2: Create `backend/testutil/testserver.go`**

```go
// backend/testutil/testserver.go
package testutil

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/court-command/court-command/handler"
	"github.com/court-command/court-command/router"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestServer creates a test HTTP server with all routes configured.
// Returns the httptest.Server and a cleanup function.
func TestServer(t *testing.T, pool *pgxpool.Pool) *httptest.Server {
	t.Helper()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/1" // Use DB 1 for tests
	}

	store, err := session.NewStore(redisURL)
	if err != nil {
		t.Fatalf("creating session store: %v", err)
	}

	authService := service.NewAuthService(pool, store)
	authHandler := handler.NewAuthHandler(authService, false)
	healthHandler := handler.NewHealthHandler(pool, store.Client())

	r := router.New(&router.Config{
		DB:             pool,
		SessionStore:   store,
		Redis:          store.Client(),
		AllowedOrigins: []string{"http://localhost:5173"},
		AuthHandler:    authHandler,
		HealthHandler:  healthHandler,
		SecureCookie:   false,
	})

	ts := httptest.NewServer(r)

	t.Cleanup(func() {
		ts.Close()
		store.Close()
	})

	return ts
}

// DoRequest is a helper that sends an HTTP request to the test server.
func DoRequest(t *testing.T, method, url string, body *http.Request) *http.Response {
	t.Helper()
	// This is intentionally left as a stub — callers use standard http.Client directly.
	return nil
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend && go build ./testutil/...`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
cd backend && git add -A && git commit -m "feat: add test utilities (testdb, testserver)"
```

---

## Task 17: Auth Integration Tests

**Files:**
- Create: `backend/handler/auth_test.go`

- [ ] **Step 1: Write auth integration tests**

```go
// backend/handler/auth_test.go
package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/court-command/court-command/testutil"
)

func TestRegister(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	body := map[string]string{
		"email":         "register@test.com",
		"password":      "password123",
		"first_name":    "Register",
		"last_name":     "Test",
		"date_of_birth": "1990-05-20",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("POST /auth/register: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["public_id"] == nil || result["public_id"] == "" {
		t.Error("expected public_id to be set")
	}
	if result["role"] != "player" {
		t.Errorf("expected role=player, got %v", result["role"])
	}
	if result["status"] != "active" {
		t.Errorf("expected status=active, got %v", result["status"])
	}

	// Check session cookie was set
	cookies := resp.Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "cc_session" {
			found = true
			if c.Value == "" {
				t.Error("session cookie is empty")
			}
		}
	}
	if !found {
		t.Error("expected cc_session cookie to be set")
	}
}

func TestRegisterDuplicate(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	body := map[string]string{
		"email":         "dup@test.com",
		"password":      "password123",
		"first_name":    "Dup",
		"last_name":     "Test",
		"date_of_birth": "1990-01-01",
	}
	b, _ := json.Marshal(body)

	// First registration should succeed
	resp1, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	resp1.Body.Close()
	if resp1.StatusCode != http.StatusCreated {
		t.Fatalf("first register expected 201, got %d", resp1.StatusCode)
	}

	// Second registration should fail
	b, _ = json.Marshal(body)
	resp2, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("duplicate register expected 400, got %d", resp2.StatusCode)
	}
}

func TestRegisterValidation(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	tests := []struct {
		name string
		body map[string]string
	}{
		{"missing email", map[string]string{"password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"invalid email", map[string]string{"email": "bad", "password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"short password", map[string]string{"email": "a@b.com", "password": "short", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"missing first_name", map[string]string{"email": "a@b.com", "password": "password123", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"missing last_name", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "date_of_birth": "1990-01-01"}},
		{"missing dob", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "last_name": "B"}},
		{"invalid dob", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "not-a-date"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.body)
			resp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
			resp.Body.Close()
			if resp.StatusCode != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", resp.StatusCode)
			}
		})
	}
}

func TestLoginAndMe(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register a user first
	regBody := map[string]string{
		"email":         "login@test.com",
		"password":      "password123",
		"first_name":    "Login",
		"last_name":     "Test",
		"date_of_birth": "1985-12-25",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	regResp.Body.Close()

	// Login
	loginBody := map[string]string{
		"email":    "login@test.com",
		"password": "password123",
	}
	b, _ = json.Marshal(loginBody)
	loginResp, _ := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(b))
	defer loginResp.Body.Close()

	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("login expected 200, got %d", loginResp.StatusCode)
	}

	// Extract session cookie
	var sessionCookie *http.Cookie
	for _, c := range loginResp.Cookies() {
		if c.Name == "cc_session" {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie after login")
	}

	// Call /me with session cookie
	meReq, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	meReq.AddCookie(sessionCookie)

	client := &http.Client{}
	meResp, err := client.Do(meReq)
	if err != nil {
		t.Fatalf("GET /auth/me: %v", err)
	}
	defer meResp.Body.Close()

	if meResp.StatusCode != http.StatusOK {
		t.Fatalf("/me expected 200, got %d", meResp.StatusCode)
	}

	var user map[string]interface{}
	json.NewDecoder(meResp.Body).Decode(&user)

	if user["email"] != "login@test.com" {
		t.Errorf("expected email=login@test.com, got %v", user["email"])
	}
	if user["first_name"] != "Login" {
		t.Errorf("expected first_name=Login, got %v", user["first_name"])
	}
}

func TestMeWithoutAuth(t *testing.T) {
	pool := testutil.TestDB(t)
	ts := testutil.TestServer(t, pool)

	resp, _ := http.Get(ts.URL + "/api/v1/auth/me")
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestLogout(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register
	regBody := map[string]string{
		"email":         "logout@test.com",
		"password":      "password123",
		"first_name":    "Logout",
		"last_name":     "Test",
		"date_of_birth": "1995-06-15",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	var sessionCookie *http.Cookie
	for _, c := range regResp.Cookies() {
		if c.Name == "cc_session" {
			sessionCookie = c
		}
	}
	regResp.Body.Close()

	// Logout
	logoutReq, _ := http.NewRequest("POST", ts.URL+"/api/v1/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	logoutResp, _ := client.Do(logoutReq)
	logoutResp.Body.Close()

	if logoutResp.StatusCode != http.StatusNoContent {
		t.Fatalf("logout expected 204, got %d", logoutResp.StatusCode)
	}

	// /me should now fail
	meReq, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	meReq.AddCookie(sessionCookie) // Same cookie, but session should be gone
	meResp, _ := client.Do(meReq)
	meResp.Body.Close()

	if meResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("/me after logout expected 401, got %d", meResp.StatusCode)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register
	regBody := map[string]string{
		"email":         "wrongpw@test.com",
		"password":      "password123",
		"first_name":    "Wrong",
		"last_name":     "Password",
		"date_of_birth": "1988-03-10",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	regResp.Body.Close()

	// Login with wrong password
	loginBody := map[string]string{
		"email":    "wrongpw@test.com",
		"password": "wrongpassword",
	}
	b, _ = json.Marshal(loginBody)
	loginResp, _ := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(b))
	loginResp.Body.Close()

	if loginResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("wrong password expected 400, got %d", loginResp.StatusCode)
	}
}

func TestHealthEndpoint(t *testing.T) {
	pool := testutil.TestDB(t)
	ts := testutil.TestServer(t, pool)

	resp, err := http.Get(ts.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", result["status"])
	}
}
```

- [ ] **Step 2: Add testify dependency (if needed for future tests) and run tests**

Run:
```bash
cd backend && go mod tidy && go test ./handler/ -v -count=1
```
Expected: All 8 tests pass (TestRegister, TestRegisterDuplicate, TestRegisterValidation, TestLoginAndMe, TestMeWithoutAuth, TestLogout, TestLoginWrongPassword, TestHealthEndpoint).

- [ ] **Step 3: Commit**

```bash
cd backend && git add -A && git commit -m "test: add auth integration tests"
```

---

## Task 18: Final Verification + Remove Generated Files from .gitignore

**Files:**
- Modify: `.gitignore` (remove `backend/db/generated/` line)

- [ ] **Step 1: Update `.gitignore` to track generated sqlc files**

Remove the line `backend/db/generated/` from `.gitignore`. Generated sqlc files should be committed so that CI and other developers don't need sqlc installed to build.

Updated `.gitignore`:
```gitignore
# .gitignore
.env
*.exe
*.dll
*.so
*.dylib
*.test
*.out
__debug_bin*
vendor/
tmp/
.DS_Store
```

- [ ] **Step 2: Run full test suite**

Run:
```bash
make up && sleep 2 && cd backend && go test ./... -v -count=1
```
Expected: All tests pass.

- [ ] **Step 3: Run go vet and check for issues**

Run: `cd backend && go vet ./...`
Expected: No issues.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: track sqlc generated files, final Phase 1 verification"
```

---

## Summary

Phase 1 produces a deployable Go backend with:

| Feature | Status |
|---|---|
| Docker Compose (PostgreSQL 17 + Redis 7) | ✅ |
| Go project skeleton with Chi router | ✅ |
| Configuration from environment variables | ✅ |
| PostgreSQL connection pool (pgx) | ✅ |
| Goose migrations (embedded SQL) | ✅ |
| sqlc type-safe queries | ✅ |
| `users` table with public ID (CC-XXXXX) | ✅ |
| Redis session store | ✅ |
| Auth: register, login, logout, /me | ✅ |
| Middleware: request ID, logging, CORS, recovery, auth | ✅ |
| Health check endpoint | ✅ |
| Structured JSON error responses | ✅ |
| JSON response helpers (success, error, paginated) | ✅ |
| Graceful shutdown | ✅ |
| Test utilities (testdb, testserver) | ✅ |
| Integration tests for auth flow | ✅ |

**Total tasks:** 18
**Endpoints created:** 5 (`/health`, `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`)
**Tables created:** 1 (`users`)

**Next phase:** Phase 2 — Registry (Players, Teams, Organizations, Venues, Courts)
