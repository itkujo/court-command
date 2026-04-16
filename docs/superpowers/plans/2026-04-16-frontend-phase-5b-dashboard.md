# Frontend Phase 5B — Player Dashboard

> **For agentic workers:** Read `docs/superpowers/PHASE_LAUNCH.md` first for codebase patterns and working rules.

**Goal:** Build the authenticated player dashboard at `/dashboard` with 6 sections, and fix D2 (PlayerBrief.id missing).

**Architecture:** New `features/dashboard/` folder. Single API call to `GET /api/v1/dashboard` returns all 6 sections. Each section is a standalone component receiving its slice of data. Reuse Phase 2/3 components (Card, Table, Badge, StatusBadge, InfoRow, AdSlot).

**Tech Stack:** React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Lucide icons.

---

### Task 1: Dashboard hooks + types

**Files:**
- Create: `frontend/src/features/dashboard/hooks.ts`

Single hook: `useDashboard()` calling `GET /api/v1/dashboard`. Returns typed dashboard data.

```typescript
interface DashboardData {
  upcoming_matches: UpcomingMatch[]
  active_registrations: ActiveRegistration[]
  recent_results: RecentResult[]
  stats: PlayerStats
  teams: DashboardTeam[]
  announcements: DashboardAnnouncement[]
}

interface UpcomingMatch {
  id: number
  public_id: string
  tournament_name?: string
  division_name?: string
  court_name?: string
  scheduled_at?: string
  status: string
  team_1_name?: string
  team_2_name?: string
}

interface ActiveRegistration {
  id: number
  tournament_name: string
  division_name: string
  status: string
  registered_at: string
}

interface RecentResult {
  id: number
  public_id: string
  tournament_name?: string
  division_name?: string
  team_1_name?: string
  team_2_name?: string
  team_1_score: number
  team_2_score: number
  winner_team_id?: number
  completed_at?: string
}

interface PlayerStats {
  matches_played: number
  matches_won: number
  matches_lost: number
  win_rate: number
  titles_won: number
}

interface DashboardTeam {
  id: number
  name: string
  short_name: string
  logo_url?: string | null
  role: string
}

interface DashboardAnnouncement {
  id: number
  title: string
  body: string
  tournament_name?: string
  league_name?: string
  created_at: string
  is_pinned: boolean
}
```

- [ ] Step 1: Create hooks.ts with `useDashboard` hook + all types
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add dashboard hooks and types`

---

### Task 2: Dashboard section components

**Files:**
- Create: `frontend/src/features/dashboard/UpcomingMatches.tsx`
- Create: `frontend/src/features/dashboard/ActiveRegistrations.tsx`
- Create: `frontend/src/features/dashboard/RecentResults.tsx`
- Create: `frontend/src/features/dashboard/StatsSummary.tsx`
- Create: `frontend/src/features/dashboard/MyTeams.tsx`
- Create: `frontend/src/features/dashboard/DashboardAnnouncements.tsx`

Each component receives its data slice as props. Pattern:

```tsx
interface Props {
  data: UpcomingMatch[]  // or appropriate type
}

export function UpcomingMatches({ data }: Props) {
  if (data.length === 0) return <EmptyState ... />
  return (
    <Card>
      <h2>Upcoming Matches</h2>
      {/* render list/table */}
    </Card>
  )
}
```

**UpcomingMatches:** Card list with match time, teams, tournament context. Link to `/matches/{publicId}`.
**ActiveRegistrations:** Table with tournament, division, status badge, registered date.
**RecentResults:** Card list with scores, winner highlight, link to match detail.
**StatsSummary:** Grid of stat cards (matches played, W/L, win rate %, titles).
**MyTeams:** Card grid with team logo (Avatar fallback), name, role badge.
**DashboardAnnouncements:** Feed (newest first, pinned at top). Use `RichTextDisplay` for body.

- [ ] Step 1: Create all 6 section components
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add dashboard section components`

---

### Task 3: PlayerDashboard page

**Files:**
- Create: `frontend/src/features/dashboard/PlayerDashboard.tsx`

Assembles all 6 sections. Layout:
1. Header: "My Court Command" + user name
2. Stats row (StatsSummary) — full width
3. Two-column grid: UpcomingMatches (left), ActiveRegistrations (right)
4. Full-width: RecentResults
5. Two-column: MyTeams (left), DashboardAnnouncements (right)
6. `AdSlot` with `responsive-banner` below header

Loading: full-page skeleton. Error: error boundary catch. Empty: individual section empty states.

- [ ] Step 1: Create `PlayerDashboard.tsx`
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add player dashboard page`

---

### Task 4: D2 fix — PlayerBrief.id

**Context:** Phase 4 overlay's PlayerCard trigger matches players by name because `PlayerBrief` in the overlay types lacks an `id` field. The fix is to ensure the backend returns `id` in the player brief and the frontend type includes it.

**Files:**
- Modify: `frontend/src/features/overlay/types.ts` — add `id?: number` to PlayerBrief interface
- Verify: backend `MatchResponse.Team1.Players[]` already includes `id` from `loadTeamSummary` in `service/match.go`

If backend already returns `id` in player objects, this is a 1-line frontend fix. If not, add `ID` to the `PlayerBrief` Go struct.

- [ ] Step 1: Check if backend `loadTeamSummary` returns player `id` (grep `backend/service/match.go` for the roster mapping)
- [ ] Step 2: Add `id` to frontend `PlayerBrief` type
- [ ] Step 3: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 4: Commit: `fix(frontend): add id to PlayerBrief type (D2)`

---

### Task 5: Dashboard route + sidebar update

**Files:**
- Create: `frontend/src/routes/dashboard.tsx`
- Modify: `frontend/src/components/Sidebar.tsx` — ensure Dashboard link exists for logged-in users

Route renders `PlayerDashboard` behind `AuthGuard`. Sidebar should have a "Dashboard" entry (LayoutDashboard icon) near the top of the nav for logged-in users.

- [ ] Step 1: Create route file
- [ ] Step 2: Update Sidebar if needed
- [ ] Step 3: Run `pnpm build` to regenerate route tree
- [ ] Step 4: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 5: Commit: `feat(frontend): add dashboard route + sidebar entry`

---

### Task 6: Verification + push

- [ ] Step 1: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 2: `pnpm build` — succeeds
- [ ] Step 3: Push to origin/V2
- [ ] Step 4: Report final SHA
