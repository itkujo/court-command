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

### Frontend Phase 1: Shell, Auth, Registry

- Vite + React 19 + TanStack Router + TanStack Query + Tailwind CSS v4
- Toggleable sidebar app shell (collapsed 56px icon rail / expanded 220px, mobile overlay mode)
- Centered-card auth pages (Login, Register)
- Registry CRUD for Players, Teams, Organizations, Venues, Courts
- Shared primitive components (Button, Input, Select, DateInput, Textarea, FormField, Badge, Avatar, Skeleton)
- Compound components (Modal, ConfirmDialog, Toast, Table, Card, SearchInput, EmptyState, ErrorBoundary, ThemeToggle, Pagination)
- Dark/light theme with system preference + user override (CSS custom properties)
- Community theme presets (Catppuccin, Dracula, Nord, Gruvbox, Tokyo Night, One Dark, Solarized)
- AdSlot component for non-overlay, non-settings pages (6 IAB sizes)

### Frontend Phase 2: Tournaments & Leagues

- Tournament create wizard (3-step: Basic Info → Divisions → Review)
- Tournament detail hub with tabbed layout (Overview, Divisions, Registrations, Announcements, Settings, Courts)
- Division detail (Overview, Registrations, Seeds, Bracket/Pools)
- League detail hub (Overview, Seasons, Division Templates, Registrations, Announcements)
- Season detail with tournaments list + confirmations
- Registration management (approve/reject/waitlist, bulk no-show, check-in)
- Tournament clone feature
- Shared components (InfoRow, StatusBadge, TabLayout, ImageUpload, RichTextDisplay, SponsorEditor, ScoringPresetPicker, VenuePicker)
- Inline file upload on Phase 1 entity forms (team logo, org logo, venue logo/photo/map)

### Frontend Phase 3: Scoring & Match Operations

- Referee console with mobile-first portrait + tablet landscape layouts
- Scorekeeper console (simplified ref with auto-confirm)
- Open-pool court model (any ref can enter any court, soft lock only)
- Scoring primitives (MatchScoreboard, ScoringButtons, ServeIndicator, ScoreCall, GameHistoryBar, TimeoutBadge)
- Keyboard shortcuts (1/2 point, S side-out, Z undo, T timeout) with input-focus guard
- Haptic + sound feedback (50ms vibrate, synthesized 100ms WebAudio tick), toggleable
- WebSocket hook with exponential reconnect (1s→30s capped) and attempt counter
- Score preferences persisted to localStorage (`cc_scoring_prefs`)
- Game-over + match-over confirmation modals with re-prompt-on-continue
- Match-complete banner
- Score override modal (role-gated: platform_admin, tournament_director, head_referee)
- Match detail page (public, optional auth) with hero + info panel + events timeline
- OBS scoreboard page (transparent background, no chrome)
- Match series detail (read-only for team-format MLP-style events)
- Events timeline (filterable, expandable, color-coded borders)
- Disconnect banner with attempt counter
- Quick Match (ephemeral 24hr matches, no tournament context)
- Scoring settings page (keyboard/haptic/sound toggles)
- Tournament Courts tab + inline Score buttons on bracket match cards

### Frontend Phase 4A: Overlay Foundation

**Contract remediation (CR-1..CR-8)** — 9 contract tests added (`backend/service/match_contract_test.go`) to prevent regression. See prevention rules in `docs/superpowers/lessons/2026-04-16-phase-3-review-defects.md`.

- `backend/service/events.go` — 20 canonical `EventType*` constants (lowercase snake_case). Every match-event writer + reader now references a constant, not a string literal.
- `broadcastMatchUpdate` now takes a pre-enriched `MatchResponse` argument (no more internal double enrichment on scoring hot path; ~10 DB round-trips saved per scoring action)
- `applyEngineResult` returns the enriched response; every scoring caller (ScorePoint, SideOut, RemovePoint, ConfirmGameOver, ConfirmMatchOver, CallTimeout, PauseMatch, ResumeMatch, DeclareForfeit) passes it straight through
- `MatchResponse.ScoredByName` removed (was declared but never populated)
- `MatchEventResponse` shape: `timestamp` + nested `score_snapshot` instead of flat scalars + bare `created_at`. Legacy `created_at` alias retained for backwards read compatibility
- `ScoreSnapshot` uses `*int32` for serving-team/server-number so the wire form is clean JSON (not pgtype blobs)
- `ConfirmMatchOver` now returns a validation error when games are tied and no explicit `winner_team_id` is provided (was silently committing a match with NULL winner)
- `ListCourts` (platform-wide, non-tournament) now enriches `active_match` + `on_deck_match` per court row (previously only the per-tournament variant enriched)
- Frontend `EventType` union, `EVENT_META`, `summarizeEvent` rewritten to match backend constants exactly. `MatchInfoPanel` stripped of the phantom `scored_by_name` row.

**Overlay types + contract constants** (`frontend/src/features/overlay/contract.ts`, `types.ts`)
- `OVERLAY_FIELD` (21), `OVERRIDE_KEY` (24) + grouped UI ordering, `ELEMENT_KEY` (12), `MATCH_STATUS` (7), `SOURCE_TYPE`, `AUTH_TYPE`, `IDLE_DISPLAY`, `SPONSOR_TIER`, `OVERLAY_WS_EVENT` — every stringly-typed value lives here
- `OverlayData`, `OverlayTeamData`, `GameResult`, `SponsorLogo`, `SeriesScoreData`, `NextMatchData` mirror `backend/overlay/contract.go`
- `CourtOverlayConfig`, `ElementsConfig`, `ColorOverrides`, `DataOverrides`, `Theme`, `SourceProfile`, `OverlayTrigger`, `OverlayWSMessage` mirror the DB + wire shapes
- `normalizeSourceProfileID`, `normalizePollInterval`, `normalizeTimestamptz` helpers accept either plain or pgtype-wrapped values so consumers never see raw pgtype blobs

**Overlay data + config hooks** (`frontend/src/features/overlay/hooks.ts`, `useOverlayWebSocket.ts`)
- Queries: `useOverlayConfig`, `useOverlayData`, `useOverlayDataBySlug` (client-side slug→courtID resolve), `useThemes`, `useTheme`, `useDemoData`, `useSourceProfiles`, `useSourceProfile`
- Mutations: `useUpdateTheme`, `useUpdateElements`, `useUpdateDataOverrides`, `useClearDataOverrides`, `useUpdateSourceProfileBinding`, `useGenerateOverlayToken`, `useRevokeOverlayToken`, `useCreateSourceProfile`, `useUpdateSourceProfile`, `useDeactivateSourceProfile`, `useDeleteSourceProfile`, `useTestSourceProfileConnection` (backend `/test` endpoint mounted in Phase 4D)
- `useOverlayWebSocket(courtID, {enabled, matchPublicID, onMessage})` multiplexes 3 channels (`overlay:{id}`, `court:{id}`, optional `match:{publicID}`) with exponential backoff 1s→30s per channel, close-by-unmount guard, aggregate connection state. Cache-merges `overlay_data`, `config_update`, `match_update` events into TanStack Query.

**Theme provider** (`frontend/src/features/overlay/ThemeProvider.tsx`)
- `<OverlayThemeProvider themeId overrides fullscreen>` applies scoped CSS custom properties (`--overlay-primary/secondary/accent/bg/text/font-family/radius/animation-style`) on a wrapper div — NOT `:root` so the control-panel preview pane doesn't leak overlay colors into app chrome
- Auto-transparent background detection (`transparent`, `rgba(0,0,0,0...)` → no backdrop fill) for chroma-key-ready themes
- `useOverlayTheme()` / `useOverlayThemeOptional()` expose resolved theme to element components for animation-style-driven transitions
- Fallback classic palette baked in so there's no unstyled flicker during theme query

**Overlay renderer stub + route** (`frontend/src/features/overlay/OverlayRenderer.tsx`, `OverlayWatermark.tsx`, `routes/overlay/court.$slug.tsx`)
- New shell-less route `/overlay/court/$slug` (added to `__root.tsx` NO_SHELL_PATTERNS alongside `/overlay/demo/$themeId` for Phase 4E)
- Transparent body via effect (cleanup restores prior styles) only when `fullscreen={true}` — preview pane embeds don't mutate global styles
- `OverlayWatermark` "Powered By Court Command" free-tier badge (conditionally gated on `isLicensed`; hardcoded false pending Phase 6 licensing)
- Visual stub body renders slug + match status in resolved theme colors so operators can confirm theme switching end-to-end. Phase 4B replaces with the 12 element components.

### Known Deferred Defects (Phase 3)

Resolved in Phase 4A Task 1 remediation batch (commit `6848d23`). Items that remain deferred to later phases:

- **CR-5** Structured logging in `enrichedMatchResponse` error branches — Phase 7 tech debt
- **I-7** Test backfill — partially addressed by Phase 4A contract tests; broader integration tests still pending

Original Phase 3 defect items, now resolved:

- **CR-1** Event type casing inconsistent (backend writers vs frontend `EventType` union)
- **CR-2** `MatchEventResponse` wire shape mismatch (`timestamp` / `score_snapshot`)
- **CR-3** Timeout event type typo (reader queries `"TIMEOUT_CALLED"`, writer emits `"timeout"`)
- **CR-4** Double enrichment on scoring hot path (~10 extra DB round-trips per point)
- **CR-6** Platform-wide `ListCourts` returns unenriched courts (no `active_match`)
- **CR-7** `MatchResponse.ScoredByName` declared but never populated
- **CR-8** Winner inference tie case falls through silently (match committed without `winner_team_id`)

Deferred as Phase 7 tech debt:
- **CR-5** Structured logging in `enrichedMatchResponse` error branches
- **I-7** Test backfill for contract invariants (no tests accompanied the remediation commits)

See `docs/superpowers/lessons/2026-04-16-phase-3-review-defects.md` for prevention checklist.

---

## [v1] - Legacy (Reference Only)

The v1 codebase (`old-cc/`) was a single-match live scoring app with:
- Python/FastAPI backend, React 19 frontend
- One hardcoded Ticker overlay (540x180 px)
- Basic court registry and player/team CRUD
- No tournaments, leagues, brackets, or scheduling
- No authentication

v2 is a complete ground-up rebuild. v1 code is preserved in `old-cc/` for reference only.
