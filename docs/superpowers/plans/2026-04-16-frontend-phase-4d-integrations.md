# Frontend Phase 4D — Source Profiles + Monitor + TV + Wizard

**Spec:** `docs/superpowers/specs/2026-04-16-frontend-phase-4-design.md` §6, §7, §8, §9
**Depends on:** Phase 4C complete

## Scope

Four independent surfaces:
1. Source Profile CRUD
2. Producer Monitor
3. TV/Kiosk views
4. Bare-Court Setup Wizard

Each can be built in any order; recommend this order for clean dependency flow.

---

## Part 1 — Source Profile CRUD

### Task 1.1 — SourceProfileList
`frontend/src/features/overlay/source-profiles/SourceProfileList.tsx`
Route: `/overlay/source-profiles` → `frontend/src/routes/overlay/source-profiles/index.tsx`

Table columns: Name, Type, Status, Last Poll, Active Courts Count.
Bulk actions: "Deactivate Selected".
Per-row: Edit + Deactivate.
Create button routes to `/overlay/source-profiles/new`.

### Task 1.2 — SourceProfileEditor
`frontend/src/features/overlay/source-profiles/SourceProfileEditor.tsx`
Routes:
- `/overlay/source-profiles/new` → `frontend/src/routes/overlay/source-profiles/new.tsx`
- `/overlay/source-profiles/$id` → `frontend/src/routes/overlay/source-profiles/$id.tsx`

Single component for create + edit (detect by id param).
Fields:
- Name (required)
- Source type: radio (REST API / Webhook / Static)
- If REST API:
  - API URL
  - Auth type (none / api-key / bearer / basic)
  - Auth credentials (conditional fields)
  - Poll interval (default 5s)
- Field Mapper (see 1.3)
- Save / Cancel / Test Connection buttons

### Task 1.3 — FieldMapper
`frontend/src/features/overlay/source-profiles/FieldMapper.tsx`

Two-column layout:
- **Left column:** canonical overlay fields from `contract.ts` (labels like "Team 1 Name", "Team 1 Score", etc.)
- **Right column:** per-field dropdown of discovered JSON paths + free-text input for manual path

Test Connection button hits `POST /api/v1/source-profiles/test` with URL + auth → returns discovered JSON paths → dropdown options populate.

Discovered paths preserve manual edits; only new suggestions appear.

### Task 1.4 — Smoke test
Create a profile against a mock REST endpoint (use `httpbin.org/get` or local mock). Verify:
- Save persists
- Edit loads saved state
- Test Connection returns paths
- Field mapping persists across page reload
- Deactivate removes from list

---

## Part 2 — Producer Monitor

### Task 2.1 — ProducerMonitor
`frontend/src/features/overlay/monitor/ProducerMonitor.tsx`
Route: `/overlay/monitor` → `frontend/src/routes/overlay/monitor.tsx`

Reads `?tournament={id}` query param (via `Route.useSearch()`).
- If set: hits `GET /api/v1/tournaments/:id/courts` (existing endpoint from Phase 3 remediation)
- If not set: hits `GET /api/v1/courts`

Renders responsive grid. 2 cols tablet, 3-4 cols desktop. Uses `useAllCourts()` or tournament-scoped variant.

Subscribes via `useOverlayWebSocket` to each court's channels (one subscription per court).

### Task 2.2 — CourtMonitorCard
`frontend/src/features/overlay/monitor/CourtMonitorCard.tsx`

Per-card:
- Court name + slug
- Active match summary: teams + score + game number + round
- Data source indicator: "Internal" or "External: {profile_name}"
- Heat badges:
  - **Match Point:** red pill "MP"
  - **Deuce:** amber pill "DEUCE"
  - **Close Game:** blue pill "CLOSE" (within 2 points)
- Last WS ping: "Live · 2s ago" or "Offline · 15m ago"
- Click card → opens `/overlay/court/{slug}/settings` in new tab

Heat badge logic:
```ts
const isMatchPoint = Math.max(team1Score, team2Score) >= pointsToWin - 1 && Math.abs(team1Score - team2Score) >= winBy
const isDeuce = team1Score === team2Score && team1Score >= pointsToWin - 1
const isClose = Math.abs(team1Score - team2Score) <= 2 && Math.max(team1Score, team2Score) >= pointsToWin - 5
```

### Task 2.3 — Smoke test
Open monitor with multiple active matches; verify:
- All courts display
- Heat badges update live as matches progress
- Clicking card opens settings in new tab
- Tournament filter works

---

## Part 3 — TV/Kiosk Views

### Task 3.1 — TVKioskBracket
`frontend/src/features/overlay/tv/TVKioskBracket.tsx`
Route: `/tv/tournaments/$id` → `frontend/src/routes/tv/tournaments.$id.tsx`

Full-screen 1920×1080. No chrome. Auto-cycles slides:
1. Bracket (Phase 2 component, read-only mode)
2. Pool standings (Phase 2 component)
3. Schedule (Phase 2 component, next 10 matches)

`useSlideRotation` hook with configurable interval (default 20s). Reads `?cycle=30` query param for override.

Ambient theme: use default theme CSS properties. Bottom-right: `OverlayWatermark` from renderer (if tournament not licensed).

### Task 3.2 — TVKioskCourt
`frontend/src/features/overlay/tv/TVKioskCourt.tsx`
Route: `/tv/courts/$slug` → `frontend/src/routes/tv/courts.$slug.tsx`

Single-court big-screen version. Reuses renderer elements but with larger scale + chromed background.

### Task 3.3 — useSlideRotation
```tsx
export function useSlideRotation(slides: number, intervalMs = 20000) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % slides), intervalMs)
    return () => clearInterval(t)
  }, [slides, intervalMs])
  return index
}
```

### Task 3.4 — Smoke test
Open TV view on a big display; verify:
- No nav/chrome
- Slides cycle correctly
- No console errors after 5 minutes of continuous rotation
- Watermark appears/hides correctly based on licensing

---

## Part 4 — Bare-Court Setup Wizard

### Task 4.1 — OverlaySetupWizard
`frontend/src/features/overlay/wizard/OverlaySetupWizard.tsx`
Route: `/overlay/setup` → `frontend/src/routes/overlay/setup.tsx`

State: `{ step: 1 | 2 | 3, court: Court | null, sourceProfile: SourceProfile | null }`.

Renders current step's component. Progress bar at top.

### Task 4.2 — Step1CreateCourt
Fields:
- Name (required)
- Slug (auto-generated from name, editable)

On Next: `POST /api/v1/courts` with `{name, slug, standalone: true}`. Store court in wizard state.

### Task 4.3 — Step2PickDataSource
Radio:
- **Court Command Match** — next click goes to Step 3
- **External API** — inline mini-editor for a Source Profile:
  - API URL, auth, Test Connection → Field Mapper inline
  - On save: `POST /api/v1/source-profiles/`, store profile in wizard state
  - Also `PUT /api/v1/overlay/court/${slug}/config/source-profile` with new profile id

### Task 4.4 — Step3CopyObsUrl
Displays:
- `https://{origin}/overlay/court/{slug}`
- Copy-to-clipboard button
- "Preview" button → opens URL in new tab
- "Go to Control Panel" button → `/overlay/court/{slug}/settings`

### Task 4.5 — Smoke test
Full flow end-to-end on a fresh account. Verify:
- Step 1 creates court
- Step 2 external API saves profile and binds to court
- Step 3 copies URL; overlay preview renders with data

---

## Task 5 — Sidebar Overlay landing

The Phase 1 sidebar has a stub for `/overlay`. Update to a proper landing:

`frontend/src/routes/overlay/index.tsx`:
- Links to:
  - Monitor (`/overlay/monitor`)
  - Source Profiles (`/overlay/source-profiles`)
  - Setup Wizard (`/overlay/setup`)
- If user has existing courts: list them with "Open Control Panel" buttons

---

## Task 6 — Documentation

Update CHANGELOG + progress.md with Phase 4D completion.

## Phase 4D Acceptance

- [ ] Source Profile CRUD working end-to-end
- [ ] Field Mapper auto-discovers against a mock API
- [ ] Producer Monitor shows live heat badges
- [ ] TV/Kiosk cycles slides on a 20s default
- [ ] Bare-court wizard succeeds on a fresh account
- [ ] Sidebar landing works
- [ ] `pnpm tsc -b --noEmit` clean
- [ ] `pnpm build` clean

**Estimated: 1.5 days**
