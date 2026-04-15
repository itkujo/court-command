# Changelog

All notable changes to Court Command v2 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] - Backend Complete, Frontend Pending

### Phase 1: Foundation

**Infrastructure**
- PostgreSQL 17 + Redis 7 via Docker Compose
- Go module (`github.com/court-command/court-command`) with Chi v5 router
- Multi-stage Docker build for production deployment
- Makefile with `dev`, `full`, `test`, and `build` targets

**Authentication & Sessions**
- Email + password registration with bcrypt hashing
- Redis-backed session store with 30-day TTL (`cc_session` cookie)
- Session-based auth middleware (`RequireAuth`, `RequireRole`, `OptionalAuth`)
- Public ID system (CC-XXXXX format) for external user identification

**Core Infrastructure**
- Goose embedded migrations (SQL files in binary)
- sqlc type-safe query generation with pgx/v5
- Structured JSON logging via `slog`
- Typed service errors (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`)
- JSON response helpers with pagination support
- CORS, request ID, body size limit, and panic recovery middleware
- Graceful shutdown on SIGINT/SIGTERM
- Health check endpoint (DB + Redis ping)

### Phase 2: Registry

**Players**
- Player profiles with 17 optional fields (handedness, paddle, bio, emergency contact, etc.)
- Privacy controls (hidden profiles show minimal data to non-admins)
- Waiver acceptance tracking
- Player search with fuzzy name matching, public ID, DUPR/VAIR ID lookup

**Teams**
- Team CRUD with auto-generated slugs and collision handling
- `TeamRoster` join table replacing v1's JSON array approach
- Roster management (add/remove players, roles: player/captain/substitute, jersey numbers)
- Team search by name, org, location

**Organizations**
- Organization CRUD with transactional creator-as-admin membership
- Org membership management (add, remove, role updates, leave)
- Player blocking system (blocked orgs get generic "unavailable" message)
- Roster cascading on org departure

**Venues & Courts**
- Venue creation with approval workflow (draft -> pending_review -> published)
- Court management with venue-scoped and floating (venue-less) courts
- Stream URL auto-detection (YouTube, Twitch, Vimeo, HLS)
- Surface types, show court designation, temporary court support

### Phase 3: Tournaments

**Leagues & Seasons**
- League CRUD with status lifecycle (draft -> published -> active -> archived)
- Season management with multiple concurrent seasons per league
- Division templates on leagues (propagate to tournaments)
- League registration for organizations
- Season roster confirmation workflow

**Tournaments**
- Tournament CRUD with 8-state lifecycle + cancellation from any non-draft state
- Division management with bracket format, scoring config, gender/age/skill restrictions
- Pod (pool) system for round-robin and pool-to-bracket formats
- Registration with auto-approve, capacity checks, waitlisting, and auto-promotion
- Free agent registration (seeking partner flag)
- Check-in flow with bulk no-show handling
- Tournament cloning with optional registration copying (transactional)
- Announcements system (tournament-scoped and league-scoped, with division targeting)

### Phase 4: Scoring Engine

**Match & Events (4A)**
- Match entity with full bracket wiring (`next_match_id`, `loser_next_match_id`)
- 10 system scoring presets (side-out 11/15/21, rally 11/15/21, MLP formats)
- Match event log with 16 event types and snapshot-based undo
- Court queue positioning system

**Scoring Engine (4B)**
- Stateless `ScoringEngine` with side-out and rally scoring modes
- Automatic game-over and match-over detection with ref confirmation prompts
- End change detection at configurable thresholds
- Serve rotation tracking (team + server number + player identity)
- Point removal with full audit trail
- Timeout tracking (configurable per-game count, advisory warnings)
- Match pause/resume (visual only)
- Forfeit declaration
- Score call generation ("4-7-2" side-out, "4-7" rally)
- 41 unit tests covering all engine paths

**WebSocket Infrastructure (4C)**
- Redis Pub/Sub backbone with 6 channel types (match, court, division, tournament, league, overlay)
- WebSocket handler with gorilla/websocket (ping/pong keepalive, write deadlines)
- Real-time match state broadcast on every scoring action
- Court queue update broadcasts

**Bracket Generation & Court Queue (4D)**
- Single elimination with proper tournament seeding and bye distribution
- Double elimination with winners/losers bracket wiring
- Round robin with circle-method scheduling
- Transactional bracket generation with automatic bye advancement
- Bracket progression (winner/loser auto-slotted into next matches)
- Court queue management (assign, remove, reorder with persistent positioning)
- 13 bracket unit tests

**Match Series & Quick Match (4E)**
- MLP-style MatchSeries wrapper for team-format events
- Series auto-completion when win threshold reached
- Auto child-match creation from `series_config` (match types or count-based)
- Remaining child match cancellation on series completion/forfeit
- Quick Match: ephemeral standalone scoring with 24-hour auto-cleanup
- Background cleanup job (hourly goroutine)

### Phase 5: Overlay / Broadcast System

**Overlay Rendering**
- Canonical overlay data contract (`OverlayData` struct) with 30+ fields
- Match-to-overlay data resolver (teams, players, scores, series, division context)
- Demo data for preview rendering without live matches
- Per-court data overrides (Broadcast Operator can override any overlay field in real-time)
- Idle state rendering (court name or branding when no match active)

**Themes**
- 6 curated themes: Classic, Modern, Minimal, Bold, Dark, Broadcast Pro
- Color override support (primary/secondary/accent replace theme defaults)
- Theme registry with validation

**Overlay Configuration**
- Per-court overlay config stored server-side (overlay page is pure renderer)
- Element visibility toggles with per-element animation controls
- Overlay token authentication (optional, revocable, constant-time comparison)
- Real-time config push via `overlay:{court_id}` WebSocket channel

**Third-Party Integration**
- Source Profile entity for external API connections
- Polling support with 4 auth types (none, API key, bearer, basic)
- Webhook receiver with HMAC-SHA256 signature validation
- Visual field mapping (external API fields -> canonical overlay slots)
- Data broadcast to overlay subscribers on webhook receipt

### Phase 6: Leagues & Seasons (Standings)

- Configurable standings computation (win/loss points, draws, tiebreakers)
- Standings recomputation from match results
- Manual standings override with reason tracking
- Team withdrawal from standings (preserves completed results)

### Phase 7: Public & Player Experience

- Player dashboard ("My Court Command"): upcoming matches, active registrations, recent results, stats, announcements, teams
- Global search across players, teams, orgs, tournaments, leagues, venues (top 5 per type)
- Public tournament directory with status filtering
- Public league directory
- Public venue directory (published venues only)
- Entity detail pages by slug

### Phase 8: Admin & Platform Management

- Platform Admin panel with user management (search, view, role assignment, suspend/ban with session revocation)
- Venue approval queue (pending review list, approve/reject)
- Activity logging with filtered queries (by user, entity type, action, date range)
- API key management (generation with `ccapi_` prefix, SHA-256 hashed storage, expiration, usage tracking, 10-key-per-user limit)
- API key authentication middleware for external consumers
- Rate limiting middleware with sliding window and `Retry-After` headers
- File upload system (local disk, 2MB-10MB, content-type detection from file bytes)
- Safe static file serving (no directory listing, path traversal prevention, `X-Content-Type-Options: nosniff`)
- System stats endpoint (user, tournament, league, match, venue counts)

### Cross-Cutting

- 29 database migrations (PostgreSQL 17)
- 127 Go source files
- ~170+ REST API endpoints
- 6 WebSocket channels for real-time updates
- 62 automated tests (41 engine unit + 13 bracket unit + 8 integration)
- Multi-stage Docker build with health checks
- Docker Compose for development (db + redis) and full stack deployment

---

## [v1] - Legacy (Reference Only)

The v1 codebase (`old-cc/`) was a single-match live scoring app with:
- Python/FastAPI backend, React 19 frontend
- One hardcoded Ticker overlay (540x180 px)
- Basic court registry and player/team CRUD
- No tournaments, leagues, brackets, or scheduling
- No authentication

v2 is a complete ground-up rebuild. v1 code is preserved in `old-cc/` for reference only.
