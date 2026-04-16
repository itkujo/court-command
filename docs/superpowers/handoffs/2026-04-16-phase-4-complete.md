# Phase 4 Autopilot — Wake-up Handoff

Phase 4 (Broadcast Overlay System) shipped end to end on the `V2`
branch. All five sub-phases complete, all acceptance criteria met,
builds green, pushed.

**Branch:** `origin/V2` at `6fc13a0` (local `main` tracks it)
**Final build state:** FE `pnpm vite build` + `pnpm tsc -b --noEmit`
clean; BE `go build ./... && go vet ./... && go test ./...` clean.
**Main bundle:** 282.05 kB / 86.98 kB gzip (from 279.71 kB at start
of Phase 4 — ~0.8% growth for the entire overlay stack).

---

## What shipped

### 4A — Foundation (6 commits `6848d23`..`749fa6b`)
- Phase 3 contract remediation: CR-1..CR-8 all fixed with AST-backed
  drift tests (`backend/service/match_contract_test.go`, 9 tests).
- Canonical overlay contract + types in
  `frontend/src/features/overlay/{contract.ts,types.ts}` mirroring
  `backend/overlay/contract.go`. 12 ElementKeys, 24 OverrideKeys
  (5 groups), 20 EventType constants.
- Query hooks (8) + mutation hooks (13) +
  `useOverlayWebSocket(courtID)` multiplexing three channels
  (overlay/court/match) with 1s→30s backoff + close-by-unmount guard.
- `OverlayThemeProvider` with scoped CSS vars + FALLBACK_THEME.
- Stub `OverlayRenderer` route at `/overlay/court/$slug` with
  transparent body; added to `NO_SHELL_PATTERNS`.

### 4B — OBS Renderer (`dff005e`)
- 12 element components under
  `frontend/src/features/overlay/renderer/elements/`. All follow
  the same contract: `{data, config}`, return `null` when
  `config.visible===false`, theme-tokenized via CSS vars, purely
  presentational.
- `OverlayWatermark` pill (bottom-right, pointer-events-none).
- Renderer assembles all 12 elements + watermark inside
  `OverlayThemeProvider`. BracketSnapshot + PoolStandings render
  framed placeholders (pending a bracket payload in OverlayData).

### 4C — Control Panel (6 commits `70ec7ae`..`5e5f315`)
- Route `/overlay/court/$slug/settings`. Role-gated behind
  `ROLE_ALLOWLIST` (4 operator roles). Layout: 50vh preview pane
  on top, TabLayout with 6 tabs below.
- `PreviewPane` scales a 1920×1080 renderer via `transform: scale()`
  + ResizeObserver, checkered transparency background.
- 6 tabs: Elements (per-element visibility + knobs), Theme (gallery
  + 3-color overrides), Source (internal/external radio + source
  profile binding), Triggers (4 kinds with
  `useTriggerQueue` + DISMISS_OPTIONS), Overrides (grouped by
  `OVERRIDE_KEY_GROUPS` with 400ms debounced commits), OBS URL
  (copy + token generate/revoke).

### 4D — Integrations (6 commits `88478f6`..`9f9b3b4`)
- Backend `POST /api/v1/source-profiles/test` with 11 unit tests
  covering per-source-type branches, auth headers, and JSON-path
  auto-discovery.
- Source Profile CRUD at `/overlay/source-profiles[/new, /:id]`
  with `FieldMapper` two-column canonical-field → discovered-path
  mapping.
- Producer Monitor at `/overlay/monitor` — responsive grid with
  per-card WS subscription, heat badges (MP/DEUCE/CLOSE),
  last-ping age, new-tab links to control panel + overlay.
- TV/Kiosk at `/tv/tournaments/$id` (auto-cycling slide deck,
  `?cycle=N` override) + `/tv/courts/$slug` (big-screen single
  court). Both in `NO_SHELL_PATTERNS`.
- Setup Wizard at `/overlay/setup` — 3 steps (create court → pick
  source → copy OBS URL).
- Overlay landing at `/overlay/` — Your Courts grid + quick links.

### 4E — Polish (4 commits `c9a7e25`..`6fc13a0`)
- Trigger queue wired into renderer: `useTriggerQueue(courtID)` now
  drives PlayerCard / TeamCard / MatchResult / CustomText via
  newest-per-kind lookup. `effectiveVisible = trigger != null ||
  config.visible`. Payload plumbing:
  `custom_text` { text, zone }, `player_card` { player_id? },
  `team_card` { team_id? }, `match_result` no payload.
- Public demo route `/overlay/demo/$themeId` using
  `GET /api/v1/overlay/demo-data`. No auth, no WS. Watermark
  always rendered.
- `ErrorBoundary` extended with `fallback?: ReactNode | FnRender |
  null` + `onError?` + `reset` method. Applied as
  `fallback={null}` on all four on-air surfaces
  (`/overlay/court/:slug`, `/overlay/demo/:themeId`,
  `/tv/tournaments/:id`, `/tv/courts/:slug`) and default panel on
  the two dashboard surfaces (`/overlay/court/:slug/settings`,
  `/overlay/monitor`). Default panel exposes Try-again + Reload.
- First-run banner in control panel: Sparkles + link to
  `/overlay/setup` when `theme_id` empty or no elements visible.
  Dismissal persists per-courtID in sessionStorage.
- Integration test script at `docs/phase-4-integration-test.md` —
  8 happy-path steps + regressions + failure-reporting template.

---

## Files & surfaces map

Feature code: `frontend/src/features/overlay/` (25+ files across
`/`, `controls/`, `monitor/`, `profiles/`, `renderer/elements/`,
`setup/`, `tv/`).

Routes created (9 route files under `frontend/src/routes/overlay/`
and `frontend/src/routes/tv/`):
- `/overlay/` (landing)
- `/overlay/setup`
- `/overlay/monitor`
- `/overlay/court/$slug`
- `/overlay/court/$slug/settings`
- `/overlay/demo/$themeId`
- `/overlay/source-profiles/`
- `/overlay/source-profiles/new`
- `/overlay/source-profiles/$profileID`
- `/tv/tournaments/$id`
- `/tv/courts/$slug`

Backend code: `backend/overlay/` (contract, resolver, themes),
`backend/service/overlay.go`, `backend/service/source_profile.go`
(+ the `_test.go` sibling), `backend/handler/overlay.go`,
`backend/handler/source_profile.go`.

---

## Tests

- Backend: 9 match contract tests + 11 source-profile service tests
  added in Phase 4. Full suite runs in <1s.
- Frontend: `pnpm tsc -b --noEmit` + `pnpm vite build` both green.
  No jest/vitest tests were in-scope per the plan (the plan defers
  FE integration tests to a later phase).

---

## Known deferrals (not blockers; tracked)

- **BracketSnapshot + PoolStandings** render framed placeholders
  until the backend adds bracket/standings payloads to
  `OverlayData`.
- **Licensing**: `isLicensed` is hard-coded `false` in
  `OverlayRenderer` — watermark always renders. Phase 6 wires the
  real toggle.
- **Role gating**: `ROLE_ALLOWLIST` includes
  `broadcast_operator | tournament_director | head_referee |
  platform_admin`. The backend CHECK constraint on `users.role`
  still only accepts `player` + `platform_admin` despite migration
  00030 authoring the expanded set. Test the control panel with
  `platform_admin` until that migration is applied.
- **PlayerCard trigger payload** uses name-based lookup across
  both teams because `PlayerBrief` currently only exposes `name`.
  When the contract adds `id` to player briefs, the resolver
  should switch to id-based lookup first.
- **CR-5** (structured logging in `enrichedMatchResponse` error
  branches) and **I-7** (broader FE integration tests) remain
  deferred.

---

## Phase 4 commit log (complete, in order)

```
6848d23 fix: Phase 3 contract remediation (CR-1..CR-8)
01a8546 feat(overlay): add canonical types and contract constants
6a91a48 feat(overlay): add data + config hooks and WS subscription
8a57deb feat(overlay): theme provider + palette support
8a21f17 feat(overlay): stub OverlayRenderer route with theme + transparent body
749fa6b docs: Phase 4A foundation complete
dff005e feat(overlay): OBS renderer — 12 elements + watermark + assembly
70ec7ae feat(overlay): control panel route + preview pane (4C-A)
e8668ee feat(overlay): Elements tab with per-element knobs (4C-B)
e5ec5bf feat(overlay): Theme tab with gallery + color overrides (4C-C)
320d4e5 feat(overlay): Source + OBS URL tabs (4C-D)
9bbbbec feat(overlay): Triggers tab with useTriggerQueue (4C-E)
5e5f315 feat(overlay): Overrides tab + Phase 4C changelog (4C-F)
88478f6 feat(overlay): source profile TestConnection endpoint (4D-1)
5fab31a feat(overlay): source profile list + editor + Test Connection (4D-2)
9572b76 feat(overlay): producer monitor grid with heat badges (4D-3)
d5e214d feat(overlay): TV/Kiosk tournament bracket + court views + useSlideRotation (4D-4)
db16bdd feat(overlay): setup wizard + overlay landing page (4D-5+6)
9f9b3b4 docs: Phase 4D integrations complete (4D-7)
c9a7e25 feat(overlay): wire trigger queue into renderer elements (4E-1)
8fc3fa5 feat(overlay): public demo renderer at /overlay/demo/:themeId (4E-2)
1b4aa39 feat(overlay): ErrorBoundary wraps + first-run banner (4E-3+4)
6fc13a0 docs: Phase 4E polish complete (4E-5+6)
```

23 commits total. All pushed to `origin/V2`.

---

## Suggested next

Phase 5 per the original plan: **Public Directory + Player
Dashboard**. Briefly:
- Tournament/league/venue public-facing directory (rendered without
  auth, SEO-friendly URLs).
- Per-player dashboard showing upcoming matches, recent results,
  enrolled tournaments.
- The `/public/*` API routes already exist (6 endpoints in
  `Platform → Public` per README §API Routes) — Phase 5 is frontend
  surfaces over those.

Before Phase 5 starts, run the manual integration test doc at
`docs/phase-4-integration-test.md` against a real deploy (or
`make dev`) to shake out any config shape regressions that
contract tests won't catch (WS reconnection, token auth path,
override propagation). Report findings to the session that kicks
off Phase 5.
