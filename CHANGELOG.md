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

### Frontend Phase 4B: OBS Renderer — 12 Element Components

All 12 canonical overlay element components live under `frontend/src/features/overlay/renderer/elements/` with a barrel index. Each component accepts `{ data, config }`, returns `null` when `config.visible===false`, and is purely presentational (no queries, no cross-component state). All animation + color styling is scoped to the `OverlayThemeProvider` via `--overlay-*` CSS custom properties so operators can re-theme without touching component code.

- **`Scoreboard`** (bottom-left) — core broadcast element. TeamRow with color bar + short name + initials + AnimatedScore (300ms pulse on value change), ServeIndicator triangle, GameHistoryDots, TimeoutPips, MatchContextBar. Match-over glow via boxShadow transition when `match_status === 'completed'`. Paused badge in context strip when `is_paused`.
- **`LowerThird`** (bottom banner) — slide-up-from-bottom (cubic-bezier spring) entry. Title + matchup + round context.
- **`PlayerCard`** (center-bottom) — scale-in (back-out spring) + team-colored border + initials avatar. Manual-dismiss by default; Phase 4E wires trigger-driven player selection.
- **`TeamCard`** (center-bottom) — dual-column side-by-side rosters. Same spring entry as PlayerCard.
- **`SponsorBug`** (top-right) — cross-fade rotator on `rotation_seconds` cadence (default 8s, clamped min 1s). Prefers `config.logos`, falls back to `data.sponsor_logos`. Graceful image-error handling. Tier badge shown when present.
- **`TournamentBug`** (top-left) — static badge. Prefers `tournament_logo_url` over `league_logo_url`; degrades to text-only.
- **`ComingUpNext`** (top-center) — slide-down-from-top. Only visible when `data.next_match` is populated.
- **`MatchResult`** (center-full) — auto_show_delay_seconds delay → scale-in spring + radial glow + CSS-only confetti field. Dismisses after `auto_dismiss_seconds` (default 30s matching backend). Winner picked via `game_wins` compare; silent no-op on ties (CR-8 tie-guard backstop).
- **`CustomText`** (configurable zone) — strict zone allow-list: `'top'|'bottom'|'center'|'top-left'|'top-right'|'bottom-left'|'bottom-right'` (invalid input → `'bottom'` fallback). Fade-in.
- **`BracketSnapshot`** (center-full) — framed placeholder in Phase 4B. Full bracket rendering ships when the backend adds a bracket payload to `OverlayData`.
- **`PoolStandings`** (center-full) — same pattern: framed placeholder; live rows ship alongside tournament payload extension.
- **`SeriesScore`** (top-right below sponsor) — dot-grid best-of indicator. Dot pulse animation (400ms spring) on team win-count increment. Hidden when `data.series_score` is null.

**`OverlayRenderer`** now composes all 12 in deterministic render order (fixed-position corners → card overlays → full-center narrative → operator free-form → watermark). Guard added: returns `null` when `configQuery.data` is absent so no unconfigured flicker reaches air.

Chunk size: `court._slug` grew from ~23 kB to 30.57 kB (gzip 7.95 kB). Main bundle unchanged at 279.71 kB / 86.21 kB gzip.

### Frontend Phase 4C: Overlay Control Panel

Broadcast operator surface at `/overlay/court/$slug/settings` — a split-screen layout with a live, CSS-scaled `OverlayRenderer` preview on top (50 vh) and a six-tab control deck underneath. Role-gated to `broadcast_operator`, `tournament_director`, `head_referee`, and `platform_admin`.

- **`PreviewPane`** (`frontend/src/features/overlay/PreviewPane.tsx`) — ResizeObserver-backed scaled canvas. Renders `<OverlayRenderer fullscreen={false}>` at design resolution 1920×1080 inside a checkered transparency background, scales by `transform: scale(k)` to fit available width. `pointer-events: none` so the control deck below receives input. Shares TanStack Query cache with the live renderer, so WebSocket pushes update both surfaces simultaneously. Scale readout fades after 2 s.
- **Elements tab** — all 12 canonical elements grouped into 4 zones (Core, Branding, Cards & callouts, Tournament context). Visibility toggle per row (accessible `role="switch"` + `aria-checked`), expandable drawer per element with kind-specific knobs: SponsorBug (`rotation_seconds` slider + `auto_animate`), PlayerCard/TeamCard (`auto_dismiss_seconds`), MatchResult (`auto_show_delay_seconds` + `auto_dismiss_seconds`), CustomText (text + zone + dismiss). Writes debounce at 400 ms into `PUT /overlay/court/{courtID}/config/elements`.
- **Theme tab** — theme gallery grid sourced from `GET /overlay/themes` (6 backend themes), plus three custom-color inputs (primary/secondary/accent) with paired `<input type="color">` and hex text inputs. Color changes debounce at 300 ms; theme selection flushes immediately. Reset-overrides button restores theme defaults.
- **Source tab** — internal (CC match) vs external (source profile) radio. Internal mode uses `useCourtMatches` and surfaces the active match summary plus a collapsible list of scheduled/warming-up matches. External mode uses `useSourceProfiles`, renders profile metadata (type, API URL, poll cadence, last-poll timestamp), and degrades to a "Create profile" CTA when none exist. Auto-binds to the first active profile when switching modes. `LiveDataStatus` derives freshness from `useOverlayData().dataUpdatedAt` with a 1 Hz ticker for the "N seconds ago" readout.
- **Triggers tab** (`useTriggerQueue` hook in `frontend/src/features/overlay/useTriggerQueue.ts`) — four one-shot trigger buttons (Player Card, Team Card, Match Result, Custom Text). Each opens a kind-specific drawer with auto-dismiss options (Manual / 5 s / 10 s / 30 s). Active triggers render in a countdown list with per-item dismiss plus Dismiss All. Queue persists in `sessionStorage` (key `cc:overlay:trigger-queue:{courtID}`) and drops expired auto triggers on reload. Single shared 250 ms interval ticks only when an auto trigger is active. Phase 4E wires triggers into `OverlayRenderer` so payloads reach the element components.
- **Overrides tab** — warning banner + Clear All when any override is active. Override rows grouped per `OVERRIDE_KEY_GROUPS` (Team 1, Team 2, Match context, Branding, Match state). Per-row: checkbox toggle, live value readout, specialized value input (color picker for `_color` keys, `Select` for `match_status` / `serving_team` / `server_number`, numeric input for score/game-wins keys, plain text otherwise), and a Revert button. Writes debounce at 400 ms into `PUT /overlay/court/{courtID}/config/data-overrides`; Clear All goes through a `ConfirmDialog` into the DELETE endpoint.
- **OBS URL tab** — full overlay URL copy-to-clipboard (`${origin}/overlay/court/${slug}?token=…`), masked token readout with show/hide toggle, Generate/Rotate/Revoke controls. Revoke runs through a `ConfirmDialog` (danger variant). Free-tier watermark warning banner mirrors the renderer's current `isLicensed = false` default (Phase 6 wires real licensing).

Commits: `70ec7ae` (route + preview), `e8668ee` (Elements), `e5ec5bf` (Theme), `320d4e5` (Source + OBS URL), `9bbbbec` (Triggers + `useTriggerQueue`), and the Overrides commit that follows. Settings chunk size: ~57 kB / 15 kB gzip; main bundle unchanged.

### Frontend Phase 4D: Source Profiles, Producer Monitor, TV/Kiosk, Setup Wizard

The operator-facing surfaces around the renderer + control panel. Five integration points shipped in six commits, plus the backend endpoint the Source Profile editor depends on.

- **Backend `POST /api/v1/source-profiles/test`** (`backend/service/source_profile.go`, `backend/handler/source_profile.go`) — validates a connection before the profile is saved. Handles the three source types distinctly: `court_command` always reports success, `webhook` reports success iff `webhook_secret` is non-empty (nothing to contact), `rest_api` issues a real `GET` with a 10 s timeout and 1 MiB body cap, then JSON-parses and returns `discovered_paths` (dot-notation, arrays become `[0]` suffixed, max depth 8, max 200 leaves, sorted) plus a truncated `sample_payload`. Auth wiring covers `bearer` (token → `Authorization: Bearer`), `api_key` (configurable header, defaults `X-API-Key`), and `basic` (base64 `username:password`). 11 unit tests cover path discovery, per-source-type branches, HTTP error pass-through, and auth-header application (`backend/service/source_profile_test.go`).
- **Source Profile CRUD** (`/overlay/source-profiles`, `/overlay/source-profiles/new`, `/overlay/source-profiles/$profileID`) — list view with type icon column (Database/Globe/Webhook), status derived from `is_active` + `last_poll_status`, relative `last_poll` readout, and a ConfirmDialog delete flow. Editor (`SourceProfileEditor.tsx`) combines a three-card source-type picker, conditional auth subsections (bearer/api_key/basic/none), polling cadence, and a `FieldMapper` sub-component that two-columns canonical overlay fields against a Select of discovered JSON paths (with a `Custom…` fallback that flips into a freetext input). Test Connection button populates the Select dropdowns without clobbering manual edits and renders a collapsible `sample_payload` preview.
- **Producer Monitor** (`/overlay/monitor?tournament={id}`) — responsive grid (1/2/3/4 columns) of `CourtMonitorCard`s, each self-subscribing to `overlay:`, `court:`, and (when an active match exists) `match:` WebSocket channels so the heat classification stays live. `classifyHeat` returns `match_point` / `deuce` / `close` / `none` based on `points_to_win`, `win_by`, and current score gap, rendered via `HeatBadge` with Flame/Scale/Radio icons. A tournament filter, activity filter (all/live/idle), and debounced search narrow the grid; live/offline/connecting indicator shows `Live` under 2 s or `N s/m/h` relative age. Cards link to the control panel and raw overlay in new tabs.
- **TV/Kiosk surfaces** (`frontend/src/features/overlay/tv/`) — two shell-less fullscreen views for venue displays, both added to `NO_SHELL_PATTERNS` in `__root.tsx`:
  - `/tv/tournaments/$id` (`TVKioskBracket`) — auto-cycling slide deck built from `useGetTournament` + `useListDivisions` + `useCourtsForTournament`. Hero slide (logo/banner + date range + Divisions/Courts-in-play stats), one slide per Division (round-robin/pool-play renders a matches grid, everything else renders bracket columns grouped by round), and a Courts slide sorted active → on-deck → idle. Cycles every 20 s by default; override with `?cycle=N` (clamped to ≥1 s). Progress dots in the TV header; `useSlideRotation` hook handles the timer, pauseability, count-change index clamping, and unmount cleanup.
  - `/tv/courts/$slug` (`TVKioskCourt`) — big-screen single-court view wrapping `<OverlayRenderer fullscreen={false} />` with a black chrome header (court name + tournament/division/round) and `OverlayWatermark` bottom-right.
- **Setup Wizard** (`/overlay/setup`) — 3-step onboarding funnel for creating a standalone broadcast court from scratch. Step 1 creates the court (`useCreateFloatingCourt` → `POST /api/v1/courts`) with show-court/standard toggle and notes. Step 2 picks a data source: either CC native scoring (auto, no extra config) or External, which inlines a minimal source-profile editor (REST_API or WEBHOOK, bearer auth for REST, webhook-URL + shared secret display for WEBHOOK) and chains `useCreateSourceProfile` + `useUpdateSourceProfileBinding`. Step 3 renders the generated OBS URL with copy-to-clipboard, plus tiles into the preview and control panel.
- **Overlay landing page** (`/overlay/`) — linked from the existing Sidebar `Broadcast → Overlay` entry. Welcomes operators, offers three QuickLink cards (Setup wizard, Producer monitor, Source profiles) with Sparkles/Activity/Database icons, and lists Your Courts as a responsive CourtTile grid with Live/Paused/Idle status dots and Control panel + Overlay links. Empty state points at `/overlay/setup`.

Commits: `88478f6` (TestConnection endpoint), `5fab31a` (Source Profile CRUD + Test Connection UI), `9572b76` (Producer Monitor), `d5e214d` (TV/Kiosk bracket + court + `useSlideRotation`), `db16bdd` (Setup Wizard + overlay landing). Main bundle unchanged at ~281 kB / 86.6 kB gzip. New route chunks: `source-profiles` 5.3 kB / 2.2 kB gzip, `SourceProfileEditor` 13.6 kB / 4.3 kB gzip, `monitor` 12.6 kB / 3.8 kB gzip, `tv-tournaments` + `tv-courts` chunks under 10 kB each.

### Frontend Phase 4E: Polish — Triggers, Demo, Resilience, Integration

Final Phase 4 pass: wires the operator trigger queue into the renderer, ships a public demo route, hardens all Phase 4 surfaces with error boundaries, and nudges fresh operators toward the setup wizard.

- **Trigger queue → renderer** (`frontend/src/features/overlay/OverlayRenderer.tsx` + 4 element components) — `useTriggerQueue(courtID)` now drives `PlayerCard`, `TeamCard`, `MatchResult`, and `CustomText` via a newest-per-kind lookup. Each element gains a `trigger?: OverlayTrigger | null` prop and computes `effectiveVisible = trigger != null || config.visible`, so triggers force-show the element for their auto-dismiss lifetime without mutating `config.elements[kind].visible`. `CustomText` honours `trigger.payload.text` + `trigger.payload.zone`. `PlayerCard` falls back to a name-based lookup across both teams before defaulting to the serving team's `server_number` index. `TeamCard` accepts `payload.team_id` (`'1'|1|'2'|2`) to show a single column instead of both. `MatchResult` force-fires regardless of `MATCH_STATUS.COMPLETED` so operators can preview the celebration on demand.
- **Public demo route** `/overlay/demo/$themeId` (`frontend/src/features/overlay/OverlayDemo.tsx`, `frontend/src/routes/overlay/demo.$themeId.tsx`) — no auth, no court, no WebSocket. Drives off `useDemoData()` (`GET /api/v1/overlay/demo-data`) and renders a curated subset of elements (scoreboard, lower third, sponsor bug, tournament bug, coming-up-next, series score) plus null-trigger cards so each theme's palette and typography can be previewed in isolation. `OverlayWatermark` is **always** visible on demo — never makes the free-tier preview look licensed. Route pattern was already in `__root.tsx` `NO_SHELL_PATTERNS`.
- **Error boundaries on every Phase 4 surface** (`frontend/src/components/ErrorBoundary.tsx`) — now accepts `fallback?: ReactNode | ((error, reset) => ReactNode) | null` plus `onError?: (err) => void`. `fallback={null}` renders nothing (used for on-air surfaces where a crash panel would leak into broadcast). The default fallback now exposes both Try again (resets boundary state) and Reload page (full refresh). Wrapped:
  - `/overlay/court/$slug` (OBS renderer) — `fallback={null}`
  - `/overlay/demo/$themeId` (public demo) — `fallback={null}`
  - `/tv/tournaments/$id` (kiosk bracket) — `fallback={null}`
  - `/tv/courts/$slug` (kiosk court) — `fallback={null}`
  - `/overlay/court/$slug/settings` (control panel) — default panel
  - `/overlay/monitor` (producer monitor) — default panel
- **First-run banner in control panel** — dismissible Sparkles-iconed banner appears when `config.theme_id` is empty OR no elements are visible. Links to `/overlay/setup` to relaunch the wizard. Dismissal persists per-courtID in `sessionStorage` under key `cc:overlay:first-run-dismissed:{courtID}` so it doesn't nag mid-session.
- **Integration test script** (`docs/phase-4-integration-test.md`) — 8-step walkthrough covering court creation, OBS URL, live scoring via WS, triggers, overrides, and token revocation; plus a regressions block covering monitor, TV/Kiosk, source profiles, and demo.

Commits: `c9a7e25` (trigger wiring), `8fc3fa5` (demo route), `1b4aa39` (ErrorBoundary wraps + first-run banner), plus the docs commit that closes 4E. Main bundle 282.05 kB / 86.98 kB gzip (+0.5 kB from 4D). `OverlayRenderer` chunk 27.89 kB / 6.91 kB gzip (+2.6 kB — trigger prop plumbing).

### Phase 4 CR-9: JSON byte-column contract remediation

Discovered during the end-to-end API smoke test against a live backend: three `[]byte` fields on `generated.CourtOverlayConfig` (`color_overrides`, `elements`, `data_overrides`) and two on `generated.SourceProfile` (`auth_config`, `field_mapping`) were serialised by Go's default `encoding/json` as **base64 strings** instead of structured JSON objects. The frontend declared these as parsed objects (`ColorOverrides`, `ElementsConfig`, `DataOverrides`, `Record<string, unknown>`, `Record<string, string>`) and accessed them directly, so the entire Phase 4 control panel + renderer would have been broken end-to-end against a real backend.

Root cause: the AST-based contract tests added in Phase 4A Task 1 validated struct shape + field names but never performed a real HTTP round-trip — precisely the Phase 3 **RC2** lesson repeating.

Fix (`backend/service/overlay_response.go` new, `backend/handler/overlay.go` + `backend/handler/source_profile.go` + `backend/service/overlay.go` modified):

- New `service.CourtOverlayConfigResponse` + `service.SourceProfileResponse` wrappers with the byte-column fields retyped as `json.RawMessage` (which has passthrough `MarshalJSON` — same storage, canonical JSON output).
- `service.ToOverlayConfigResponse` / `ToSourceProfileResponse` / `ToSourceProfileResponses` helpers; empty bytes normalise to `{}` so clients never see `null` for a persisted empty object.
- All 8 overlay config handlers (`GetConfig`, `UpdateTheme`, `UpdateElements`, `GenerateToken`, `RevokeToken`, `SetSourceProfile`, `UpdateDataOverrides`, `ClearDataOverrides`) wrap responses through `ToOverlayConfigResponse`.
- All 5 source-profile handlers that return a profile (`ListMine`, `Create`, `GetByID`, `Update`, `Deactivate`) wrap through `ToSourceProfileResponse(s)`.
- `OverlayService.broadcastConfigChange` now publishes the response shape on WebSocket `config_update` events so live frontends receive clean JSON matching the REST shape.

Verification: `go build && go vet && go test ./...` clean. End-to-end smoke test (16 steps) now fully green — `color_overrides`, `elements`, `data_overrides` render as JSON objects on GET /config; `field_mapping` renders as a dict on source profile responses; triggers, overrides, token generation/revocation, and `POST /source-profiles/test` (HTTP 200, 4 discovered paths, sample payload) all functional.

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
