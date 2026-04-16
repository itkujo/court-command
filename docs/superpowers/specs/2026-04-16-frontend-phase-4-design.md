# Frontend Phase 4 Design — Broadcast Overlay System

**Status:** Approved (all 15 brainstorm questions locked)
**Backend dependency:** Phase 4A–4E backend is already shipped. This phase consumes the existing `/overlay/*` and `/source-profiles/*` API surface and adds critical contract-level fixes carried over from Phase 3 review.
**Scope:** 8 frontend surfaces for the Court Command Overlay product (the second standalone product referenced throughout the main spec).

---

## 1. Product Context

Phase 4 delivers the broadcast/overlay suite. This is Product 2 from the main spec — it can be sold standalone or bundled with Court Command (Product 1). Every surface must:

1. Work with or without a Court Command match (third-party API via Source Profile).
2. Render at exactly 1920×1080 inside an OBS browser source, with transparent page background.
3. Receive config changes and match state changes over WebSocket without page reloads.
4. Display the free-tier watermark when the court is unlicensed; hide it when licensed.
5. Never expose internal auth state in public renderer routes.

## 2. Route Map (11 new routes)

| Route | Component | Auth | Notes |
|---|---|---|---|
| `/overlay/court/{slug}` | `OverlayRenderer` | Public (+ optional `?token=…`) | OBS browser source. Transparent body. No chrome. |
| `/overlay/court/{slug}/settings` | `ControlPanel` | Required (broadcast-operator role or above) | Split-screen preview + 6 tabs |
| `/overlay/monitor` | `ProducerMonitor` | Required | Global fallback view |
| `/overlay/monitor?tournament={id}` | `ProducerMonitor` | Required | Tournament-scoped grid |
| `/overlay/setup` | `OverlaySetupWizard` | Required | 3-step bare-court onboarding |
| `/overlay/source-profiles` | `SourceProfileList` | Required | CRUD list |
| `/overlay/source-profiles/new` | `SourceProfileEditor` | Required | Create |
| `/overlay/source-profiles/{id}` | `SourceProfileEditor` | Required | Edit / deactivate |
| `/tv/tournaments/{id}` | `TVKioskBracket` | Public | Auto-cycles bracket + standings + schedule |
| `/tv/courts/{slug}` | `TVKioskCourt` | Public | Same theme as overlay, chromed for big displays |
| `/overlay/demo/{themeId}` | `OverlayDemo` | Public | Theme preview for marketing / debugging |

Sidebar stub `{ label: 'Overlay', icon: Tv, path: '/overlay' }` resolves to a simple landing that links to source-profiles + monitor + setup wizard.

## 3. Architecture

### 3.1 Folder structure

```
frontend/src/features/overlay/
├── hooks.ts                     # useOverlayConfig, useOverlayData, useOverlayWebSocket, source-profile hooks
├── types.ts                     # Canonical OverlayData, CourtOverlayConfig, SourceProfile, Theme types
├── contract.ts                  # Frozen JSON-field constants (matches backend/overlay/contract.go)
├── renderer/
│   ├── OverlayRenderer.tsx      # Route component. Reads config + data + subscribes WS.
│   ├── OverlayWatermark.tsx     # Bottom-right POWERED BY pill
│   ├── ThemeProvider.tsx        # Maps theme_id + color palette → CSS custom properties
│   └── elements/
│       ├── ScoreboardElement.tsx
│       ├── LowerThirdElement.tsx
│       ├── PlayerCardElement.tsx
│       ├── TeamCardElement.tsx
│       ├── SponsorBugElement.tsx
│       ├── TournamentBugElement.tsx
│       ├── ComingUpNextElement.tsx
│       ├── MatchResultElement.tsx
│       ├── CustomTextElement.tsx
│       ├── BracketSnapshotElement.tsx
│       ├── PoolStandingsElement.tsx
│       └── SeriesScoreElement.tsx
├── control/
│   ├── ControlPanel.tsx         # Route component. Top: preview. Bottom: tabs.
│   ├── PreviewPane.tsx          # Renders same OverlayRenderer, scaled.
│   ├── tabs/
│   │   ├── ElementsTab.tsx      # Visibility + per-element settings
│   │   ├── ThemeTab.tsx         # Theme picker + palette picker + custom hex
│   │   ├── SourceTab.tsx        # Data source: internal match vs Source Profile
│   │   ├── TriggersTab.tsx      # Manual fire: player card, team card, match result, custom text
│   │   ├── OverridesTab.tsx     # Per-field override toggles + warning banner
│   │   └── ObsUrlTab.tsx        # Copy OBS URL + token management
│   └── triggers/
│       ├── TriggerQueue.tsx     # Active triggers list with dismiss buttons
│       └── useTriggerQueue.ts   # Per-trigger state, manual-dismiss default, optional auto-dismiss
├── monitor/
│   ├── ProducerMonitor.tsx      # Grid of court cards with live scores + heat badges
│   └── CourtMonitorCard.tsx     # One card per court
├── tv/
│   ├── TVKioskBracket.tsx       # Tournament-scoped rotation: bracket → standings → schedule
│   ├── TVKioskCourt.tsx         # Single court live display (chromed)
│   └── useSlideRotation.ts      # Configurable cycle timer (default 20s per slide)
├── wizard/
│   ├── OverlaySetupWizard.tsx   # 3-step router
│   ├── Step1CreateCourt.tsx
│   ├── Step2PickDataSource.tsx  # Court Command match OR External API + Source Profile
│   └── Step3CopyObsUrl.tsx
├── source-profiles/
│   ├── SourceProfileList.tsx
│   ├── SourceProfileEditor.tsx  # Create + edit in same component
│   ├── FieldMapper.tsx          # Auto-discover + manual-edit side-by-side form
│   └── useAutoDiscover.ts       # Hits tester endpoint, extracts JSON paths
└── demo/
    └── OverlayDemo.tsx          # Marketing-facing theme preview
```

### 3.2 Contract boundary

Frontend `contract.ts` re-declares every JSON field name that crosses the backend boundary, using `as const`. This is the single source of truth the Phase 3 reviewers flagged as missing. Any backend response renames force a compile error in this file, which fails typecheck on every PR. The file mirrors `backend/overlay/contract.go` and `backend/service/match.go:MatchResponse`.

### 3.3 Data flow

```
OverlayRenderer
  ├── GET /api/v1/overlay/court/{slug}/data        → OverlayData (canonical shape)
  ├── GET /api/v1/overlay/court/{slug}/config      → CourtOverlayConfig (elements map, theme, overrides, token)
  └── WS /ws/overlay/{courtID} + /ws/court/{courtID} + /ws/match/{public_id}
       → any incoming payload invalidates corresponding TanStack Query cache
       → React re-renders; no manual state mutation
```

**Cache strategy:** TanStack Query keys `['overlay', slug, 'data']`, `['overlay', slug, 'config']`. WS push triggers `queryClient.invalidateQueries`. `staleTime: 0` on overlay data (matches Phase 3 pattern).

**Preview pane (C)** reuses the same `OverlayRenderer` component. Wrapped in a `<div style="transform: scale(N); width:1920px; height:1080px; pointer-events:none">`. Scale is computed from parent width. No iframe, no duplicate React tree. This matches Q14's locked decision.

### 3.4 Theme system

Themes are fetched from `GET /api/v1/overlay/themes`. Each theme declares:
- `id`, `name`, `description`
- `font_family`, `layout_proportions`
- Default color palette (`--color-bg`, `--color-accent`, `--color-text-on-dark`, etc.)

`ThemeProvider` applies theme CSS custom properties to `document.documentElement`. Operator-selected color palette (from Phase 1's 11 community presets: Catppuccin Latte/Frappe/Macchiato/Mocha, Dracula, Nord, Gruvbox, Tokyo Night, One Dark, Solarized, Court Command default) overrides individual tokens. Custom hex inputs in the Theme tab override further.

### 3.5 Watermark

`OverlayWatermark` renders a fixed-position pill:
```tsx
<div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 text-white text-xs font-medium tracking-wide rounded-full opacity-70 uppercase">
  Powered By Court Command
</div>
```

Visibility flag: `config.is_licensed` on `CourtOverlayConfig`. When `false` (default for all free-tier courts), watermark renders. When `true`, it does not.

TV/Kiosk view uses the identical component in the same bottom-right corner.

### 3.6 WebSocket subscription

`useOverlayWebSocket(courtID, publicID?)`:
- Connects to `/ws/overlay/{courtID}` for config changes
- Connects to `/ws/court/{courtID}` for court-level state (match assignment changes)
- Connects to `/ws/match/{publicID}` if a match is active
- Exponential backoff (1s→30s, matches Phase 3 `useMatchWebSocket`)
- Uses the shared `useWebSocket` utility extracted in 4A (copy from Phase 3 reference, use the same pattern)
- On message: parse envelope `{type, channel, data}`, map to query invalidation by channel prefix

## 4. Element Specifications (12 elements)

All elements are pure presentational components. They read from the current `OverlayData`, do not hold their own state, and render `null` when their config `visible=false`. Each element owns its own animations via Motion library (already in Phase 1 tech stack).

| Element | Zone | Animations |
|---|---|---|
| **Scoreboard** | Bottom-left (fixed) | Score pulse on change, game-over flash, match-over winner glow |
| **Lower Third** | Bottom-full-width banner | Slide-up-from-bottom on show; fade out on hide |
| **Player Card** | Center-bottom overlay | Scale-in on trigger; auto-dismiss respects Q13 (MANUAL by default) |
| **Team Card** | Center-bottom overlay | Same as Player Card |
| **Sponsor Bug** | Top-right corner | Fade crossfade on sponsor rotation (if multiple) |
| **Tournament Bug** | Top-left corner | Static |
| **Coming Up Next** | Top-center | Slide-down-from-top on show |
| **Match Result** | Center-full | Confetti or winner glow; fade out |
| **Custom Text** | Configurable zone | Fade in / fade out |
| **Bracket Snapshot** | Center-full overlay | Fade-in; scroll-reveal rounds |
| **Pool Standings** | Center-full overlay | Table row stagger in |
| **Series Score** | Top-right (below bug if present) | Dot pulse on game completion |

Per-element config schema (lives in `config.elements[elementKey]`):
```ts
{
  visible: boolean
  // element-specific fields, e.g.:
  // scoreboard: {serve_indicator_visible: true, game_history_visible: true}
  // sponsor_bug: {rotation_ms: 8000, sponsor_pool: [...] }
}
```

## 5. Control Panel Tabs (6 tabs)

### Elements tab
- Checkbox list of all 12 elements, grouped by zone
- Drag-to-reorder within zone where overlapping elements exist
- Per-element expand: see element-specific settings

### Theme tab
- Theme gallery (grid of 6–8 themes, thumbnail + name + description)
- Color palette picker: 11 community palettes (Phase 1 reuse)
- Custom 3 hex inputs (primary, secondary, accent)
- Preview updates live

### Source tab
- Radio: "Internal Court Command match" vs "External API (Source Profile)"
- If internal: dropdown of active tournament matches scheduled to this court
- If external: dropdown of Source Profiles; "+ New Source Profile" link
- Shows current data source + last update timestamp

### Triggers tab
- 4 buttons: "Show Player Card", "Show Team Card", "Show Match Result", "Show Custom Text"
- Each opens a drawer with the element-specific fields + auto-dismiss dropdown
- Active triggers list with manual "Hide" buttons
- Default auto-dismiss: **MANUAL** (Q13). Dropdown options: Manual, 5s, 10s, 30s.

### Overrides tab
- Every canonical `OverlayData` field rendered as row: label + current value + toggle + override value input
- Warning banner when any override is active: "⚠ Data overrides are active. Real match data is being suppressed."
- "Clear All Overrides" button
- Per-override "Revert" button

### OBS URL tab
- Copy-to-clipboard field: `https://.../overlay/court/{slug}?token={token}`
- Token management: show/regenerate/revoke
- Free-tier warning if `is_licensed=false`: "This court will display the POWERED BY watermark. Upgrade to remove."

## 6. Producer Monitor

Read-only grid. Each card:
- Court name + slug
- Live match summary (teams + score + game + game-point/match-point heat badge)
- Deuce badge
- Close-game badge (within 2 points)
- Source: "Court Command Match" or "External API: {profile_name}"
- Last WS ping timestamp

Grid responsive: 2 cols tablet, 3-4 cols desktop. Refresh rate: live via WS, polling fallback every 10s.

Tournament-scoped: `?tournament={id}` filters to courts attached to that tournament's venue.

## 7. TV/Kiosk Bracket View

Auto-cycles slides:
1. Bracket for active divisions
2. Pool standings (if pool play in progress)
3. Schedule of upcoming matches (next 10)

Default cycle: 20s per slide. Configurable via `?cycle=30` query param.

Reuses Phase 2 bracket component + Phase 2 standings component + Phase 2 schedule list. Strips nav/chrome. Full 1920×1080 design. Ambient background from theme.

Watermark pill: bottom-right, same as overlay.

## 8. Bare-Court Setup Wizard

Three steps, linear progress:

### Step 1: Create Court
- Name (required)
- Slug (auto-generated, editable)
- POST `/api/v1/courts` with `standalone: true`

### Step 2: Pick Data Source
- Radio: "Court Command Match" vs "External API"
- If Court Command: skip to step 3 (source = internal)
- If External API:
  - URL (required)
  - Auth type (none / api-key / bearer / basic)
  - Auth credentials (conditional on auth type)
  - Test Connection button → hits `POST /api/v1/source-profiles/test` → shows discovered fields
  - Field Mapper inline (or link to fuller editor)
  - Save as Source Profile

### Step 3: Copy OBS URL
- Displays final overlay URL
- Copy-to-clipboard
- "Open Preview" button → new tab to `/overlay/court/{slug}`
- "Go to Control Panel" button → `/overlay/court/{slug}/settings`

## 9. Source Profile CRUD

### List page
- Table: Name, Type (Court Command / REST API / Webhook), Status, Last poll, Active courts using this profile
- Bulk actions: deactivate selected

### Editor page
- Name field
- Source type radio
- API URL, auth type, auth fields
- **FieldMapper component** (auto-discover + manual edit):
  - Left column: canonical overlay fields (`match_status`, `team_1_name`, `team_1_score`, etc. — full list in `contract.ts`)
  - Right column: dropdown per field, populated with JSON paths discovered from Test Connection
  - Manual edit: operator can type a custom path (e.g., `data.scores.home`)
  - Test button re-runs discovery; dropdowns re-populate without losing manual edits
  - Save persists entire profile

### Deactivation
- Soft-delete pattern; courts using this profile fall back to DemoData
- Warning dialog before deactivate

## 10. Authorization

| Surface | Role required |
|---|---|
| `/overlay/court/{slug}` (renderer) | Public; `?token=` required if config has token |
| `/overlay/court/{slug}/settings` | broadcast-operator, tournament-director, head-referee, platform-admin |
| `/overlay/monitor` | same as settings |
| `/overlay/setup` | any logged-in user (creates their own standalone court) |
| `/overlay/source-profiles/*` | authenticated; must own the profile or have admin role |
| `/tv/tournaments/{id}` | Public |

Role check via `useAuth()`. Frontend gating mirrors backend; backend is the source of truth.

## 11. Free Tier / Paid Tier

Controlled by `CourtOverlayConfig.is_licensed`:
- `false` (default): watermark visible on renderer + TV/Kiosk
- `true`: watermark hidden
- Backend endpoint to flip `is_licensed` lives in admin API; not in scope for Phase 4 frontend. Phase 4 reads the flag.

## 12. Phase 3 Defects to Fix (4A Task 1)

Per Q15, 4A Task 1 includes all seven Phase 3 contract-level defects before any Phase 4 work begins. This is a carry-over remediation, **blocking** every subsequent task.

| Defect | Fix |
|---|---|
| **CR-1** Event type casing mismatch | Normalize all event type strings. Add `EventType_*` Go constants. Update backend writers and readers. Update frontend `EventType` union + `EVENT_META` + `summarizeEvent`. |
| **CR-2** MatchEventResponse shape mismatch | Add JSON tag aliases: `created_at` → `timestamp`, flat score fields → nested `score_snapshot`. Regenerate frontend types. |
| **CR-3** Timeout event typo | Fix `backend/service/match.go:313`: `"TIMEOUT_CALLED"` → `"timeout"`. |
| **CR-4** Double enrichment on hot path | Hoist enrichment out of `broadcastMatchUpdate`; pass pre-enriched match in. Saves ~10 DB round-trips per point scored. |
| **CR-6** ListCourts not enriched | Add `CourtSummary.active_match` + `CourtSummary.on_deck_match` to `GET /api/v1/courts` response. Match the pattern already in `ListCourtsByTournament`. |
| **CR-7** `MatchResponse.ScoredByName` unpopulated | Remove field from `MatchResponse` (never populated end-to-end). Update frontend consumers. |
| **CR-8** Winner/loser tie case skips UpdateMatchResult | Change `ConfirmMatchOver` to raise `ValidationError` on tie. Require explicit `winner_team_id` from caller when game count is tied. |

**New test file:** `backend/service/match_contract_test.go` with 5–7 invariant assertions:
1. Event types match the const set
2. `MatchResponse` fields match contract expectations after marshal/unmarshal
3. `enrichedMatchResponse` only runs once per scoring action
4. `ListCourts` populates `active_match`
5. `ConfirmMatchOver` rejects tied game counts
6. `MatchEventResponse` includes `timestamp` and `score_snapshot`
7. All three WS channels deliver the expected event types

## 13. Sub-Phase Split

Per Q12, 4A–4E matches the Phase 3 rhythm.

### 4A — Foundation (blocking; ~1 full day)
1. Phase 3 carry-over: CR-1/2/3/4/6/7/8 + contract tests
2. Canonical TypeScript types (`types.ts`, `contract.ts`)
3. Three hooks: `useOverlayConfig`, `useOverlayData`, `useOverlayWebSocket`
4. Fetch all themes; seed `ThemeProvider` with backend theme list
5. Stub `OverlayRenderer` returning DemoData placeholder

### 4B — OBS Renderer (~1.5 days)
1. `OverlayRenderer` route at `/overlay/court/{slug}` with transparent body
2. All 12 elements
3. `ThemeProvider` with palette support
4. `OverlayWatermark` gated on `is_licensed`
5. WS subscription wiring
6. Token query param support

### 4C — Control Panel (~1.5 days)
1. Route at `/overlay/court/{slug}/settings`
2. Split-screen layout with scaled `PreviewPane`
3. Six tabs: Elements, Theme, Source, Triggers, Overrides, OBS URL
4. PUT mutations to config endpoints
5. Token management UI

### 4D — Source Profiles + Monitor + TV + Wizard (~1.5 days)
1. Source Profile CRUD pages (list + editor)
2. `FieldMapper` with auto-discover
3. Producer Monitor at `/overlay/monitor`
4. TV/Kiosk at `/tv/tournaments/{id}` + `/tv/courts/{slug}`
5. Bare-court wizard at `/overlay/setup`

### 4E — Polish (~1 day)
1. Trigger auto-dismiss timers (Q13: manual default, 5s/10s/30s dropdown)
2. `is_licensed` toggle wiring in admin (if admin exists) — otherwise ship-ready for Phase 6
3. First-run wizard detection for brand-new courts
4. a11y audit: keyboard navigation across control panel tabs, focus rings, aria-live for triggers
5. Sidebar Overlay landing page (links to monitor + source-profiles + setup)
6. Documentation updates: CHANGELOG, progress.md, README section on overlays

## 14. Acceptance Criteria

Phase 4 is complete when:

- [ ] All 11 routes render without console errors on a fresh dev env
- [ ] OBS browser source can load `/overlay/court/{slug}` and render full overlay with WS updates propagating live score changes
- [ ] Control panel preview scales correctly on tablet + desktop + ultrawide
- [ ] Source Profile auto-discovery works against a mock REST API
- [ ] Producer Monitor shows multiple courts with heat badges updating live
- [ ] TV/Kiosk cycles through slides on a 20s cadence by default
- [ ] Bare-court wizard flow succeeds end-to-end on a new browser session
- [ ] All 7 Phase 3 defects verified fixed via `match_contract_test.go` green
- [ ] `pnpm tsc -b --noEmit` clean, `pnpm build` clean
- [ ] `go build ./...` + `go vet ./...` + `go test ./...` clean
- [ ] WCAG 2.2 AA on control panel surfaces (renderer is WCAG-exempt — it's chromeless broadcast output)
- [ ] CHANGELOG.md + progress.md updated

## 15. Out of Scope

- Drag-to-position individual elements (fixed zones per Q2)
- Per-element animation customization beyond what theme defines
- Custom theme authoring (operators pick from shipped themes; theme-builder UI is a v3 feature)
- Playlist / schedule for rotating overlays across match changes (handled manually for now)
- Multi-language overlays (English only)
- Video/GIF layers (static graphics only)
- Audio cues on overlays (broadcast audio is OBS's domain)

---

**This document is the single source of truth for Phase 4. Any deviation must be recorded in a follow-up design note committed alongside the change.**
