# Frontend Phase 4A — Foundation Plan

**Spec:** `docs/superpowers/specs/2026-04-16-frontend-phase-4-design.md`
**Lessons to apply:** `docs/superpowers/lessons/2026-04-16-phase-3-review-defects.md`
**Blocking:** All subsequent sub-phases depend on 4A completion.

## Task 1 — Phase 3 Contract Remediation (BLOCKING)

Before any Phase 4 code, fix the 7 Phase 3 review defects (CR-1/2/3/4/6/7/8) and add contract tests. Reference: `docs/superpowers/plans/2026-04-14-progress.md` Phase 3 review section.

### 1a. Event type casing (CR-1)
- Extract `EventType_*` string constants in `backend/service/match.go` (or new `backend/service/events.go`)
- Canonical casing: lowercase snake_case (matches current DB writer convention)
- Update every writer to use the constant
- Update every reader to use the constant (`backend/service/match.go:313` TIMEOUT_CALLED → constant for `timeout`)
- Frontend `frontend/src/features/scoring/types.ts` EventType union must exactly match the constant set
- Frontend `EVENT_META` and `summarizeEvent` keys aligned

### 1b. MatchEventResponse shape (CR-2)
- Backend: `backend/service/match.go` MatchEventResponse struct — add JSON tag `"timestamp"` alias for `CreatedAt`; gather `Team1Score/Team2Score/SetScores/CurrentSet/CurrentGame/ServingTeam/ServerNumber` into a nested `ScoreSnapshot` struct serialized as `"score_snapshot"`
- Frontend: `frontend/src/features/scoring/types.ts` MatchEvent reads `timestamp` and `score_snapshot`

### 1c. Timeout typo (CR-3)
- `backend/service/match.go:313` — replace uppercase `"TIMEOUT_CALLED"` query with lowercase `"timeout"` (using the 1a constant)

### 1d. Double enrichment (CR-4)
- `backend/service/match.go` `broadcastMatchUpdate` — accept already-enriched `MatchResponse` instead of re-running enrichment
- Every caller: enrich once, pass to both WS broadcast and HTTP response
- Net saving: ~10 DB round-trips per scoring action

### 1e. ListCourts enrichment (CR-6)
- `backend/service/venue.go` `ListCourts` — populate `ActiveMatch` + `OnDeckMatch` matching `ListCourtsByTournament`
- `backend/handler/venue.go` passes through
- Frontend `useAllCourts` (in `frontend/src/features/scoring/hooks.ts`) reads the enriched fields

### 1f. ScoredByName removal (CR-7)
- `backend/service/match.go` MatchResponse — remove `ScoredByName` field
- `backend/service/match.go` wherever it was populated — remove population code (it was never populating anyway)
- Frontend `frontend/src/features/scoring/types.ts` Match — remove `scored_by_name`
- Remove any frontend UI that reads `match.scored_by_name`

### 1g. Winner tie rejection (CR-8)
- `backend/service/match.go` `ConfirmMatchOver` — when `winnerTeamID == 0 && loserTeamID == 0` and set_scores are tied, return `ValidationError("cannot confirm match with tied games; provide explicit winner_team_id")`
- Caller (handler + frontend) must handle the new 400 response; frontend shows a "Pick winner" modal
- Frontend `useConfirmMatchOver` accepts optional `winnerTeamId` param

### 1h. Contract test file (new)
- Create `backend/service/match_contract_test.go`
- 5–7 test assertions:
  1. `TestEventTypeConstants_MatchWriters` — every writer uses a const from `EventType_*`
  2. `TestMatchResponse_MarshalContract` — marshal a known MatchResponse, compare JSON keys to frozen expected set
  3. `TestMatchEventResponse_MarshalContract` — same for events, verify `timestamp` + `score_snapshot` keys exist
  4. `TestEnrichedMatchResponse_SingleRun` — mock DB, run a scoring action, assert enrichment was called exactly once
  5. `TestListCourts_IncludesActiveMatch` — seed court + match, call ListCourts, assert active_match present
  6. `TestConfirmMatchOver_RejectsTie` — tied games + no winner_team_id → 400
  7. `TestScoreSnapshot_Symmetry` — round-trip snapshot through JSON; fields preserved

### Verification
- `go build ./...` clean
- `go vet ./...` clean
- `go test ./...` green (all 7 new tests pass)
- `pnpm tsc -b --noEmit` clean
- `pnpm build` clean

### Commit
`fix: Phase 3 contract remediation (CR-1..CR-8 from lessons doc)`

---

## Task 2 — Canonical types + contract.ts

### 2a. `frontend/src/features/overlay/contract.ts`
Mirror `backend/overlay/contract.go`. Declare every JSON field name as a `const` string. Example:

```ts
export const OVERLAY_DATA_FIELDS = {
  matchStatus: 'match_status',
  team1Name: 'team_1_name',
  team1Score: 'team_1_score',
  // ... every field
} as const
```

This is the single-source-of-truth the Phase 3 reviewers flagged as missing.

### 2b. `frontend/src/features/overlay/types.ts`
Canonical TypeScript types matching backend:

```ts
export interface OverlayData { /* mirrors backend OverlayData */ }
export interface CourtOverlayConfig { /* mirrors backend CourtOverlayConfig */ }
export interface SourceProfile { /* mirrors backend SourceProfile */ }
export interface Theme { /* mirrors backend Theme */ }
export type ElementKey =
  | 'scoreboard' | 'lower_third' | 'player_card' | 'team_card'
  | 'sponsor_bug' | 'tournament_bug' | 'coming_up_next' | 'match_result'
  | 'custom_text' | 'bracket_snapshot' | 'pool_standings' | 'series_score'
```

### Commit
`feat(overlay): add canonical types and contract constants`

---

## Task 3 — Hooks: useOverlayConfig, useOverlayData, useOverlayWebSocket

### 3a. `frontend/src/features/overlay/hooks.ts`

Three TanStack Query hooks matching Phase 3 patterns:

```ts
export function useOverlayConfig(courtSlug: string) {
  return useQuery({
    queryKey: ['overlay', courtSlug, 'config'],
    queryFn: () => apiGet<CourtOverlayConfig>(`/api/v1/overlay/court/${courtSlug}/config`),
    staleTime: 0,
  })
}

export function useOverlayData(courtSlug: string, token?: string) {
  const url = `/api/v1/overlay/court/${courtSlug}/data${token ? `?token=${encodeURIComponent(token)}` : ''}`
  return useQuery({
    queryKey: ['overlay', courtSlug, 'data', token],
    queryFn: () => apiGet<OverlayData>(url),
    staleTime: 0,
    retry: false, // don't thrash public endpoint
  })
}
```

Mutations:
```ts
export function useUpdateTheme() { /* PUT /overlay/court/:slug/config/theme */ }
export function useUpdateElements() { /* PUT /overlay/court/:slug/config/elements */ }
export function useUpdateDataOverrides() { /* PUT /overlay/court/:slug/config/data-overrides */ }
export function useUpdateSourceProfile() { /* PUT /overlay/court/:slug/config/source-profile */ }
export function useGenerateToken() { /* POST /overlay/court/:slug/config/token/generate */ }
export function useRevokeToken() { /* DELETE /overlay/court/:slug/config/token */ }
export function useClearDataOverrides() { /* DELETE /overlay/court/:slug/config/data-overrides */ }
```

Source Profile hooks:
```ts
export function useSourceProfiles() { /* GET /source-profiles/ */ }
export function useSourceProfile(id: number) { /* GET /source-profiles/:id */ }
export function useCreateSourceProfile() { /* POST /source-profiles/ */ }
export function useUpdateSourceProfile() { /* PUT /source-profiles/:id */ }
export function useDeleteSourceProfile() { /* DELETE /source-profiles/:id */ }
export function useDeactivateSourceProfile() { /* POST /source-profiles/:id/deactivate */ }
```

### 3b. `frontend/src/features/overlay/useOverlayWebSocket.ts`

Copy Phase 3 `useMatchWebSocket` pattern. Subscribe to three channels:
- `/ws/overlay/{courtID}`
- `/ws/court/{courtID}`
- `/ws/match/{publicID}` (if match active)

Exponential backoff 1s→30s. On every message, dispatch `queryClient.invalidateQueries({queryKey:['overlay', courtSlug]})`.

### Commit
`feat(overlay): add data + config hooks and WS subscription`

---

## Task 4 — Themes

### 4a. Fetch themes
Add `useThemes()` hook hitting `GET /api/v1/overlay/themes`.

### 4b. `frontend/src/features/overlay/renderer/ThemeProvider.tsx`
Accepts `theme: Theme` + `palette: ColorPalette` + `customColors?: Record<string,string>`. Applies to `document.documentElement.style.setProperty()` on mount, cleans up on unmount.

Palette source: Phase 1 `frontend/src/lib/themes.ts` (11 presets: Court Command default, Catppuccin Latte/Frappe/Macchiato/Mocha, Dracula, Nord, Gruvbox, Tokyo Night, One Dark, Solarized).

### Commit
`feat(overlay): theme provider + palette support`

---

## Task 5 — Stub OverlayRenderer

### 5a. `frontend/src/features/overlay/renderer/OverlayRenderer.tsx`
Route component. Reads params + token. Fetches config + data. Wraps in ThemeProvider. Renders placeholder text `"Overlay for {slug}"`. Actual elements come in 4B.

### 5b. Route file: `frontend/src/routes/overlay/court.$slug.tsx`
```tsx
export const Route = createFileRoute('/overlay/court/$slug')({
  component: OverlayRenderer,
})
```

### 5c. Transparent body
In the route component, set `document.body.style.background = 'transparent'` on mount. Clean up on unmount. (Same pattern as Phase 3 `MatchScoreboardPage.tsx:18`.)

### 5d. Smoke test
Start dev server, navigate to `/overlay/court/test-slug`, verify:
- Page renders without errors
- Body is transparent (check DevTools)
- If court doesn't exist, graceful error state
- If court exists with demo data, placeholder shows

### Commit
`feat(overlay): stub OverlayRenderer route with theme + transparent body`

---

## Task 6 — Documentation

### 6a. Update CHANGELOG.md
Add Phase 4A section listing the 7 Phase 3 remediations + foundation work.

### 6b. Update progress.md
Add Phase 4A section confirming foundation complete, 4B is next.

### Commit
`docs: Phase 4A foundation complete`

---

## Phase 4A Acceptance

- [ ] All 7 Phase 3 defects fixed; 7 contract tests green
- [ ] Canonical types + contract.ts file in place
- [ ] 3 data hooks + 7 mutation hooks + WS hook working
- [ ] ThemeProvider applies CSS custom properties
- [ ] `/overlay/court/{slug}` route exists with transparent body
- [ ] `pnpm tsc -b --noEmit` clean
- [ ] `pnpm build` clean
- [ ] `go build ./...` + `go vet ./...` + `go test ./...` clean
- [ ] CHANGELOG + progress.md updated

**Estimated: 1 full day (8 hours) — 4 hours for carry-over remediation, 4 hours for foundation**
