# Phase 7C — D1 Bracket/Pool Overlay Data + Final Documentation

> **For agentic workers:** Execute tasks in order. This completes the entire project.

**Goal:** Wire BracketSnapshot + PoolStandings overlay elements to real data. Ship final documentation.

---

### Task 1: Backend — Add bracket/pool fields to OverlayData

**Files:**
- Modify: `backend/overlay/contract.go` — add BracketData + PoolData to OverlayData struct

Add these types:
```go
type BracketMatchBrief struct {
    Round        int    `json:"round"`
    MatchNumber  int    `json:"match_number"`
    Team1Name    string `json:"team_1_name"`
    Team1Seed    int    `json:"team_1_seed"`
    Team2Name    string `json:"team_2_name"`
    Team2Seed    int    `json:"team_2_seed"`
    Team1Score   int    `json:"team_1_score"`
    Team2Score   int    `json:"team_2_score"`
    Status       string `json:"status"`
    Winner       string `json:"winner"`
}

type BracketData struct {
    DivisionName  string              `json:"division_name"`
    BracketFormat string              `json:"bracket_format"`
    Matches       []BracketMatchBrief `json:"matches"`
}

type PodStandingEntry struct {
    TeamName  string `json:"team_name"`
    Wins      int    `json:"wins"`
    Losses    int    `json:"losses"`
    PointDiff int    `json:"point_diff"`
    Rank      int    `json:"rank"`
}

type PodData struct {
    PodName   string             `json:"pod_name"`
    Standings []PodStandingEntry `json:"standings"`
}

type PoolData struct {
    DivisionName string    `json:"division_name"`
    Pods         []PodData `json:"pods"`
}
```

Add to OverlayData:
```go
BracketData *BracketData `json:"bracket_data,omitempty"`
PoolData    *PoolData    `json:"pool_data,omitempty"`
```

- [ ] Add types and fields
- [ ] `go build ./...` must pass
- [ ] Commit

### Task 2: Backend — Populate bracket/pool in resolver

**Files:**
- Modify: `backend/overlay/resolver.go` — populate BracketData/PoolData when division is present

In `ResolveFromMatch`:
- After existing division/tournament lookups, if `match.DivisionID` is valid:
  - Fetch all matches in that division via `r.queries.ListMatchesByDivision`
  - If bracket_format is `single_elimination` or `double_elimination`: build BracketData
  - If bracket_format is `round_robin` or `pool_play`: fetch pods + standings, build PoolData
- Use existing query patterns — don't add new sqlc queries unless needed
- Log warnings on failures (per CR-5 convention)

- [ ] Implement bracket data population
- [ ] Implement pool data population
- [ ] `go build ./... && go vet ./...` must pass
- [ ] Commit

### Task 3: Backend — Add to DemoData

**Files:**
- Modify: `backend/overlay/contract.go` — extend DemoData() with sample bracket + pool

Add sample BracketData with 4 matches (2 semifinals + 1 final + 1 placeholder) and sample PoolData with 2 pods of 4 teams each.

- [ ] Add demo data
- [ ] `go build ./...` must pass
- [ ] `go test ./...` must pass
- [ ] Commit

### Task 4: Frontend — Update overlay types

**Files:**
- Modify: `frontend/src/features/overlay/types.ts` — add BracketData + PoolData types

Mirror the Go types in TypeScript:
```typescript
interface BracketMatchBrief {
  round: number
  match_number: number
  team_1_name: string
  team_1_seed: number
  team_2_name: string
  team_2_seed: number
  team_1_score: number
  team_2_score: number
  status: string
  winner: string
}

interface BracketData {
  division_name: string
  bracket_format: string
  matches: BracketMatchBrief[]
}

interface PodStandingEntry {
  team_name: string
  wins: number
  losses: number
  point_diff: number
  rank: number
}

interface PodData {
  pod_name: string
  standings: PodStandingEntry[]
}

interface PoolData {
  division_name: string
  pods: PodData[]
}
```

Add to OverlayData interface:
```typescript
bracket_data?: BracketData | null
pool_data?: PoolData | null
```

- [ ] Add types
- [ ] `pnpm tsc -b --noEmit` must pass
- [ ] Commit

### Task 5: Frontend — Wire BracketSnapshot + PoolStandings renderers

**Files:**
- Modify: `frontend/src/features/overlay/renderer/elements/BracketSnapshot.tsx` (or similar path)
- Modify: `frontend/src/features/overlay/renderer/elements/PoolStandings.tsx` (or similar path)

Wire these existing placeholder components to read from `overlayData.bracket_data` and `overlayData.pool_data`. Render bracket matches in a visual tree (or simplified table). Render pool standings as a ranked table per pod.

- [ ] Wire BracketSnapshot
- [ ] Wire PoolStandings
- [ ] `pnpm tsc -b --noEmit && pnpm build` must pass
- [ ] Commit

### Task 6: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

Add Phase 7 section covering:
- Accessibility fixes (keyboard, focus, labels, contrast, images)
- Performance (lazy loading, React.memo, cache tuning)
- PWA (manifest, service worker, offline banner, install prompt)
- D1 bracket/pool overlay data pipeline
- Note: "All 7 frontend phases + 8 backend phases complete. Product ready for testing."

- [ ] Update CHANGELOG
- [ ] Commit

### Task 7: Update progress.md

**Files:**
- Modify: `docs/superpowers/plans/2026-04-14-progress.md`

Append Phase 7 completion section:
- Sub-phase status (7A/7B/7C)
- Commit SHAs
- Spec deviations
- Deferred items (should be none — D1 resolved)
- Final project status: ALL PHASES COMPLETE

- [ ] Update progress doc
- [ ] Commit

### Task 8: Update PHASE_LAUNCH.md

**Files:**
- Modify: `docs/superpowers/PHASE_LAUNCH.md`

Mark Phase 7 as DONE. Update status table. Note: "All phases complete. Product in testing."

- [ ] Update launch doc
- [ ] Commit

### Task 9: Final verification + push

- [ ] `pnpm tsc -b --noEmit` — 0 errors
- [ ] `pnpm build` — 0 errors, note bundle size
- [ ] `go build ./... && go vet ./... && go test ./...` — all pass
- [ ] `git push origin main:V2`
- [ ] Report final SHA + verification tails
