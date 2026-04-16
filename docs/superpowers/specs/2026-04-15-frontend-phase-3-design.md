# Frontend Phase 3 Design — Scoring & Match Operations

**Date:** 2026-04-15
**Status:** Approved — implementation to follow
**Depends on:** Backend Phase 4A–4E, Frontend Phase 1 (shell, auth), Frontend Phase 2 (tournaments, divisions)

---

## 1. Purpose

Phase 3 makes the platform usable for live scoring. It adds the referee console (mobile-first), scorekeeper console (stripped-down), match detail page (mixed audience), public scoreboard (venue TVs), quick matches (ephemeral 24hr), match series view, and live WebSocket updates across all surfaces. After Phase 3, a ref can run a full match end-to-end from their phone and spectators can watch live.

## 2. Scope

### In scope
- Referee console (open pool court grid → match setup → scoring UI)
- Scorekeeper console (simplified two-button variant)
- Match detail page (public, mixed audience)
- Public scoreboard route (`/matches/:publicId/scoreboard` — transparent, no chrome)
- Events timeline (reverse-chronological, color-coded, expandable, filterable)
- Match series view-only page
- Quick match creation + list + scoring
- Score override UI (role-gated: td, head_referee, platform_admin)
- WebSocket live updates with smart reconnect
- Keyboard shortcuts + haptic/sound feedback + settings page
- Tournament hub "Courts" tab + inline "Score" buttons on match cards
- Game-over / match-over prompt flow

### Out of scope for Phase 3
- Offline queue (spec: online-only)
- Keyboard shortcut customization beyond hardcoded 1/2/S/Z/T
- Shot-by-shot charting
- Admin activity log viewer (Phase 6)
- Series-level management (create series, assign match types) — read-only only
- MLP team-event flow orchestration

## 3. Architecture

### 3.1 Routes Added

| Route | Purpose | Auth | Component |
|-------|---------|------|-----------|
| `/ref` | Court grid home (open pool) | required | `RefHome` |
| `/ref/courts/:courtId` | Match list for selected court | required | `RefCourtView` |
| `/ref/matches/:publicId` | Match setup → scoring UI | required | `RefMatchConsole` |
| `/scorekeeper` | Court grid, scorekeeper badge | required | `ScorekeeperHome` |
| `/scorekeeper/matches/:publicId` | Stripped scoring UI | required | `ScorekeeperMatchConsole` |
| `/matches/:publicId` | Match detail (mixed audience) | optional | `MatchDetail` |
| `/matches/:publicId/scoreboard` | Transparent scoreboard (TVs/OBS) | public | `MatchScoreboardPage` |
| `/match-series/:publicId` | Series detail (read-only) | optional | `MatchSeriesDetail` |
| `/quick-match` | My quick matches list | required | `QuickMatchList` |
| `/quick-match/new` | Quick match creator | required | `QuickMatchCreate` |
| `/settings/scoring` | Scoring preferences | required | `ScoringSettings` |

Tournament hub: adds a "Courts" tab (5 → 6 tabs).

### 3.2 Shell Behavior on Scoring Routes

The app shell (sidebar + chrome) is hidden on:
- `/matches/:publicId/scoreboard` (full transparent)
- No others — ref/scorekeeper routes keep the shell for navigation, but on mobile the sidebar collapses fully when scoring is active.

### 3.3 Feature Folders

```
frontend/src/features/
├─ scoring/              # shared scoring components
│  ├─ hooks.ts           # match + event hooks
│  ├─ useMatchWebSocket.ts
│  ├─ useScoringPrefs.ts # haptic/sound/keyboard toggles
│  ├─ useKeyboardShortcuts.ts
│  ├─ MatchScoreboard.tsx
│  ├─ ScoringButtons.tsx
│  ├─ ServeIndicator.tsx
│  ├─ GameHistoryBar.tsx
│  ├─ ScoreCall.tsx
│  ├─ MatchSetup.tsx
│  ├─ GameOverConfirmModal.tsx
│  ├─ MatchCompleteBanner.tsx
│  ├─ ScoreOverrideModal.tsx
│  ├─ DisconnectBanner.tsx
│  ├─ TimeoutBadge.tsx
│  └─ EventsTimeline.tsx
├─ referee/              # ref-specific
│  ├─ RefHome.tsx
│  ├─ RefCourtView.tsx
│  ├─ RefMatchConsole.tsx
│  └─ CourtGrid.tsx
├─ scorekeeper/          # scorekeeper-specific
│  ├─ ScorekeeperHome.tsx
│  └─ ScorekeeperMatchConsole.tsx
├─ matches/              # public views
│  ├─ MatchDetail.tsx
│  ├─ MatchScoreboardPage.tsx
│  ├─ MatchDetailHero.tsx
│  └─ MatchInfoPanel.tsx
├─ match-series/
│  └─ MatchSeriesDetail.tsx
└─ quick-match/
   ├─ hooks.ts
   ├─ QuickMatchList.tsx
   ├─ QuickMatchCreate.tsx
   └─ QuickMatchCard.tsx
```

### 3.4 State Management

- **Server state**: TanStack Query (same as Phase 1/2 pattern). Query keys: `['matches', publicId]`, `['match-events', publicId]`, `['courts', courtId, 'matches']`, `['match-series', publicId]`, `['quick-matches']`.
- **Live updates**: `useMatchWebSocket(publicId)` hook merges `match_update` messages into TanStack Query cache via `queryClient.setQueryData`. Also invalidates events query on POINT_SCORED / SIDE_OUT.
- **UI state**: component-local `useState` for modals, wizard steps.
- **User preferences**: `useScoringPrefs()` hook persists to `localStorage` as `cc_scoring_prefs` (JSON: `{ keyboard, haptic, sound }`, all boolean).

### 3.5 API Layer

New hooks in `features/scoring/hooks.ts`:

```ts
// Match queries
useMatch(publicId)                           // GET /api/v1/matches/:publicId
useMatchEvents(publicId)                     // GET /api/v1/matches/:publicId/events
useCourtMatches(courtId)                     // GET /api/v1/courts/:id/matches
useCourtsForTournament(tournamentId)         // GET /api/v1/tournaments/:id/courts

// Match mutations (all keyed by publicId)
useStartMatch()                              // POST /api/v1/matches/:publicId/start
useScorePoint()                              // POST /api/v1/matches/:publicId/point
useSideOut()                                 // POST /api/v1/matches/:publicId/sideout
useUndo()                                    // POST /api/v1/matches/:publicId/undo
useConfirmGameOver()                         // POST /api/v1/matches/:publicId/confirm-game
useConfirmMatchOver()                        // POST /api/v1/matches/:publicId/confirm-match
useCallTimeout()                             // POST /api/v1/matches/:publicId/timeout
usePauseMatch()                              // POST /api/v1/matches/:publicId/pause
useResumeMatch()                             // POST /api/v1/matches/:publicId/resume
useDeclareForfeit()                          // POST /api/v1/matches/:publicId/forfeit
useOverrideScore()                           // POST /api/v1/matches/:publicId/override
useRemovePoint()                             // POST /api/v1/matches/:publicId/remove-point
```

Quick match hooks in `features/quick-match/hooks.ts`:

```ts
useMyQuickMatches()                          // GET /api/v1/quick-matches
useCreateQuickMatch()                        // POST /api/v1/quick-matches
```

Match series hooks in `features/scoring/hooks.ts` (read-only):

```ts
useMatchSeries(publicId)                     // GET /api/v1/match-series/:publicId
```

### 3.6 WebSocket Hook

```ts
function useMatchWebSocket(publicId: string | undefined) {
  // Returns { connectionState, lastMessage }
  // Internally: opens ws connection, handles reconnect with backoff (1s, 2s, 4s, 8s, max 30s)
  // On 'match_update' event: queryClient.setQueryData(['matches', publicId], newData)
  //                          queryClient.invalidateQueries(['match-events', publicId])
  // On disconnect: sets connectionState='disconnected', triggers DisconnectBanner
}
```

Connection states: `'connecting' | 'open' | 'disconnected'`.

### 3.7 Keyboard Shortcuts

Active on ref/scorekeeper console only. Handled by `useKeyboardShortcuts(handlers, enabled)`:

| Key | Side-out mode | Rally mode |
|-----|---------------|-----------|
| `1` | Point (to serving team) | Point team 1 |
| `2` | (no-op) | Point team 2 |
| `S` | Side out | — |
| `Z` | Undo | Undo |
| `T` | Timeout | Timeout |
| `Esc` | Close modals | Close modals |

Disabled when any input is focused.

### 3.8 Haptic & Sound

`useScoringPrefs()` returns `{ haptic, sound, keyboard, toggleHaptic, toggleSound, toggleKeyboard }`.

On successful Point/Side Out/Undo:
- If `haptic && navigator.vibrate`: `navigator.vibrate(50)`
- If `sound`: play short 100ms tick via WebAudio (synthesized, no asset file)

## 4. Component Detail

### 4.1 `MatchScoreboard` (core scoring UI)

**Props:**
```ts
{
  match: Match
  mode: 'ref' | 'scorekeeper'
  orientation: 'portrait' | 'landscape'
  onPoint: (team?: 1 | 2) => void
  onSideOut: () => void
  onUndo: () => void
  onTimeout: (team: 1 | 2) => void
  onMenu?: () => void
  disabled?: boolean   // when WS disconnected
}
```

**Portrait layout (Layout A, from brainstorm mockup):**
- Header row: match info (division, round, court) + menu button
- Team 1 card (full-width): label + name + big score + server dot (if serving)
- Team 2 card (full-width): same
- Score call bar: "7 · 4 · 1" for side-out, "7 · 4" for rally
- Action row: POINT (green, big) + SIDE OUT (red, big) — or POINT T1 + POINT T2 for rally
- Secondary action row: Undo + Timeout + Menu (smaller)

**Landscape layout (tablet):**
- Left column (50%): Team 1 (big)
- Right column (50%): Team 2 (big)
- Center stack between (or overlaid if no room):
  - Score call
  - Action buttons centered
  - Undo/Timeout/Menu below

Auto-selects via `useIsMobile()` + `window.matchMedia('(orientation: landscape)')`.

### 4.2 `MatchSetup`

Shows before status=in_progress:
- Match header (teams, division, court, scoring preset confirmation)
- Roster panels (from Match.team_1/team_2 participants data) — ref can swap starting server
- First server dropdown (team 1 / team 2 / player)
- Optional "Scored by" text field (audit — stored on Match via setStartedBy)
- "Begin Match" button (green, prominent)

### 4.3 `CourtGrid`

Grid of court cards (min 2 cols mobile, 3+ cols desktop). Each card shows:
- Court name + optional stream indicator
- Status: `available` (grey), `in_progress` (green + pulsing dot), `on_deck` (amber)
- Live score badge when in_progress: "7–4 • G2"
- Team names truncated
- Tap → go to ref/scorekeeper match console

Subscribes to `/ws/courts/:courtId` channel for live status updates.

### 4.4 `EventsTimeline`

Props: `{ events: MatchEvent[] }`.

Each event row:
- Icon (typed: point=trophy, sideout=swap, timeout=pause, etc.)
- Event type label + timestamp
- One-line summary (computed per type)
- Expand chevron → reveals payload JSON + score snapshot
- Color-coded left border (green/red/yellow/grey)

Controls:
- Filter dropdown by event type (multi-select)
- "Newest first" (default) / "Oldest first" toggle
- Compact mode toggle (hide details)

### 4.5 `GameOverConfirmModal`

Triggered when scoring response flags `gameOverDetected: true`:
- Title: "Game Over?"
- Body: "Team X wins game Y, Z–W. Confirm to end the game."
- Actions: `End Game` (primary) / `Continue Scoring` (secondary)
- On End Game: `useConfirmGameOver` mutation
- On Continue: dismissed; re-shows on next point past threshold

### 4.6 `ScoreOverrideModal`

Role-gated (td, head_referee, platform_admin). Opens from kebab menu.

- Per-game score inputs (one row per game including current)
- Team 1 score + Team 2 score + Winner dropdown per game
- Required "Reason" textarea (min 10 chars)
- Submit → `useOverrideScore` mutation → SCORE_OVERRIDE event
- Warning banner if match status=completed: "This will modify a final match"

### 4.7 `DisconnectBanner`

Full-width red banner, sticky at top of scoring routes:
- Message: "Connection lost — reconnecting..." + attempt counter
- Dismissible? No — persists until reconnect
- When reconnect succeeds: green "Reconnected" flash for 2s then disappears
- While visible: scoring buttons throughout UI are disabled

### 4.8 `MatchDetail` (public)

Sections:
1. **Hero** (`MatchDetailHero`): big score, team names, live badge if in_progress
2. **Match info panel**: division, round, court, scoring format, referee
3. **Team rosters** (both teams)
4. **Games breakdown** (per-game table)
5. **Events timeline** (collapsible, initially closed)
6. **Admin actions** (role-gated): Score Override button

No edit actions for non-admins. Auth optional (public route).

### 4.9 `MatchScoreboardPage`

Minimal transparent page for venue TVs / OBS:
- Body background: transparent
- Single large scoreboard component sized to viewport
- No header, no nav, no footer
- Subscribes to `useMatchWebSocket` for live updates
- Auto-refreshes match state on mount

## 5. Data Flow Examples

### 5.1 Ref scores a point
1. Ref taps POINT in ref console
2. `useScorePoint.mutate({ publicId })` fires
3. Backend processes, returns updated match + `gameOverDetected` flag
4. Mutation's onSuccess updates query cache and fires haptic + sound
5. Backend publishes to `match_update` channel
6. All other subscribers (match detail, scoreboard page, other refs' consoles) receive update via `useMatchWebSocket`
7. If `gameOverDetected`: `GameOverConfirmModal` shows in ref console

### 5.2 Disconnect + reconnect
1. Network drops
2. `useMatchWebSocket` detects close → `connectionState='disconnected'`
3. `DisconnectBanner` appears; scoring buttons disabled (via `disabled` prop derived from `connectionState !== 'open'`)
4. Hook retries with backoff (1s, 2s, 4s, 8s...)
5. On reconnect: `connectionState='open'` → banner dismisses → refetch match via `queryClient.invalidateQueries(['matches', publicId])`
6. Buttons re-enabled

## 6. Error Handling

- All mutations use `HandleServiceError` mapping (from Phase 1 infra)
- Conflict errors (e.g., match not in_progress) show toast + refetch match
- Forbidden errors (e.g., ref role insufficient) show toast
- Validation errors on override: inline field errors in modal
- Network errors: toast + stay in current state

## 7. Accessibility

- All buttons labeled (aria-label for icon-only)
- Score announcements via `aria-live="polite"` region (when score changes)
- Keyboard shortcuts documented in settings page
- Color is not the only signal for server indicator (text label + icon)
- High-contrast score text (WCAG AA minimum)
- Touch targets ≥ 48px on mobile

## 8. Performance

- Match event pagination (load last 50, "Load older" button)
- Memoize heavy renderers (timeline rows, court cards)
- WebSocket payload ~1–2 KB per update — no concern
- Debounce identical rapid updates (<50ms apart)

## 9. Testing Strategy

Unit tests deferred to Phase 7 (polish). This phase uses manual + smoke tests:
- Backend integration tests already cover scoring engine
- Frontend: manual smoke across ref console, match detail, scoreboard, quick match

## 10. Rollout / Integration Points

- Tournament hub: add "Courts" tab (new `TournamentCourts.tsx` component using `CourtGrid`)
- Division detail: match rows gain inline "Score" button (TD/ref only)
- Sidebar: add top-level "Scoring" section with Ref Console + Quick Match links
- Phase 1 player dashboard (Phase 5) will link to completed matches — forward compatible via match detail route

## 11. Sub-Phase Breakdown (Execution Plan)

| Sub-phase | Scope | Files |
|-----------|-------|-------|
| 3A | Scoring hooks + WS hook + prefs + shared scoring components (MatchScoreboard, ScoringButtons, ScoreCall, etc.) | ~12 files |
| 3B | Ref console (RefHome, RefCourtView, RefMatchConsole, CourtGrid, MatchSetup) + Scorekeeper variant | ~8 files |
| 3C | Match detail + public scoreboard + events timeline + MatchSeries detail | ~7 files |
| 3D | WebSocket reconnect + disconnect banner + tournament Courts tab + inline Score buttons | ~5 files + edits |
| 3E | Quick match + score override + game-over prompt + settings page + polish | ~8 files |

Each sub-phase commits independently. Reviews after each.

## 12. Open Questions / Deferred

None blocking. Minor items deferred to Phase 3 polish or later:
- Ref "Take over" soft-lock UI (simple toast initially, full lock coordination in Phase 6+)
- Multi-series bracket progression UI (not in Phase 3)
- Referee audit log by `scored_by_name` (data captured; viewer deferred)

---
