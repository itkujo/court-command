# Frontend Phase 3B — Referee + Scorekeeper Consoles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the referee console (open pool court grid → court view → match setup → scoring UI) and the simplified scorekeeper variant. Wire keyboard shortcuts, haptic/sound feedback, and the WebSocket hook from Phase 3A. Add the new routes for `/ref` and `/scorekeeper`.

**Architecture:** Re-use the components and hooks built in Phase 3A. New components (`CourtGrid`, `RefHome`, `RefCourtView`, `RefMatchConsole`, `ScorekeeperHome`, `ScorekeeperMatchConsole`) live under `frontend/src/features/referee/` and `frontend/src/features/scorekeeper/`. Routes use TanStack Router file-based routing.

**Tech Stack:** React 19, TanStack Router (file-based), TanStack Query 5, lucide-react, Tailwind v4. Same conventions as prior phases.

**Depends on:** Phase 3A (hooks + shared components must be merged).

---

## Conventions Recap

- Imports: relative paths (NO `@/` aliases)
- Auth: `const auth = useAuth()` from `frontend/src/features/auth/hooks.ts`
- Toast: `const { toast } = useToast(); toast('success', 'message')`
- Modal: `<Modal open onClose title>{children}</Modal>`
- Routes: `createFileRoute('/path')({ component })`, params via `Route.useParams()`
- After creating route files, run `npx @tanstack/router-cli generate` (the Vite plugin will also auto-regenerate during `pnpm dev`)
- Conventional commits per task

---

## File Structure (this sub-phase only)

```
frontend/src/features/referee/
├─ CourtGrid.tsx
├─ RefHome.tsx
├─ RefCourtView.tsx
└─ RefMatchConsole.tsx

frontend/src/features/scorekeeper/
├─ ScorekeeperHome.tsx
└─ ScorekeeperMatchConsole.tsx

frontend/src/routes/
├─ ref/
│  ├─ index.tsx
│  ├─ courts.$courtId.tsx
│  └─ matches.$publicId.tsx
└─ scorekeeper/
   ├─ index.tsx
   └─ matches.$publicId.tsx
```

Possible Sidebar update (Phase 3D handles full sidebar wiring; for this phase, you may add the two top-level links if it helps testing).

---

## Backend endpoints used (recap from Phase 3 spec)

- `GET /api/v1/courts/:id/matches`
- `GET /api/v1/tournaments/:id/courts` (for court grid scoping; for now Ref/Scorekeeper home shows the union of all courts the user can see — simple `GET /api/v1/courts` if it exists, otherwise just an empty grid + jump-by-public-id input)
- `GET /api/v1/matches/:publicId`
- `POST /api/v1/matches/:publicId/{start,point,sideout,undo,confirm-game,confirm-match,timeout,pause,resume,forfeit}`

If `GET /api/v1/courts` does not exist, the implementer should add `useAllCourts` in `features/scoring/hooks.ts` calling whatever paginated court list endpoint exists in the backend (`/api/v1/courts` per backend Phase 2 standalone court routes). Verify by reading `backend/router/router.go` before assuming.

---

## Task 1: CourtGrid Component

**Files:**
- Create: `frontend/src/features/referee/CourtGrid.tsx`

CourtGrid renders a responsive grid of court cards. Each card shows court name, status, live score badge if a match is active, and team names. Tapping the card navigates to the appropriate route depending on `mode` (`'ref' | 'scorekeeper'`).

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/referee/CourtGrid.tsx
import { Link } from '@tanstack/react-router'
import { Radio, Tv } from 'lucide-react'
import { Card } from '../../components/Card'
import { cn } from '../../lib/cn'
import type { CourtSummary } from '../scoring/types'

export interface CourtGridProps {
  courts: CourtSummary[]
  mode: 'ref' | 'scorekeeper'
  emptyMessage?: string
}

export function CourtGrid({ courts, mode, emptyMessage }: CourtGridProps) {
  if (courts.length === 0) {
    return (
      <div className="text-center py-8 text-(--color-text-secondary)">
        {emptyMessage ?? 'No courts available'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {courts.map((court) => (
        <CourtCard key={court.id} court={court} mode={mode} />
      ))}
    </div>
  )
}

function CourtCard({ court, mode }: { court: CourtSummary; mode: 'ref' | 'scorekeeper' }) {
  const live = court.active_match?.status === 'in_progress'
  const target = court.active_match
    ? `/${mode}/matches/${court.active_match.public_id}`
    : `/ref/courts/${court.id}`

  return (
    <Link
      to={target}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) rounded-lg"
    >
      <Card className="h-full p-3 hover:bg-(--color-bg-hover) transition-colors">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-(--color-text-primary) truncate">
            {court.name}
          </h3>
          <div className="flex items-center gap-1">
            {court.is_show_court ? (
              <Tv
                size={14}
                className="text-(--color-text-muted)"
                aria-label="Show court"
              />
            ) : null}
            {live ? <LiveDot /> : null}
          </div>
        </div>

        {court.active_match ? (
          <div className="space-y-1">
            <div className="text-xs text-(--color-text-muted)">In progress</div>
            <div className="text-sm text-(--color-text-primary) truncate">
              {court.active_match.team_1?.name ?? 'Team 1'} vs{' '}
              {court.active_match.team_2?.name ?? 'Team 2'}
            </div>
            <div className="text-base font-bold tabular-nums text-(--color-text-primary)">
              {court.active_match.team_1_score} – {court.active_match.team_2_score}
              <span className="ml-2 text-xs text-(--color-text-muted) font-normal">
                G{court.active_match.current_game}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-(--color-text-muted)">Available</div>
        )}
      </Card>
    </Link>
  )
}

function LiveDot() {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full bg-(--color-success) animate-pulse'
      )}
      aria-label="Live"
    >
      <Radio size={0} className="sr-only" />
    </span>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/referee/CourtGrid.tsx
git commit -m "feat(frontend): add CourtGrid component"
```

---

## Task 2: RefMatchConsole Component

**Files:**
- Create: `frontend/src/features/referee/RefMatchConsole.tsx`

This is the most important component. It loads a match by public_id, shows MatchSetup if status='scheduled', otherwise shows MatchScoreboard. Subscribes to the WebSocket. Wires keyboard shortcuts and feedback.

The `gameOverDetected` and `matchOverDetected` flow is wired here, but the actual `GameOverConfirmModal` component is built in Phase 3E. For 3B we render a placeholder confirm-dialog using the existing `ConfirmDialog` component.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/referee/RefMatchConsole.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { Skeleton } from '../../components/Skeleton'
import { DisconnectBanner } from '../scoring/DisconnectBanner'
import { MatchScoreboard } from '../scoring/MatchScoreboard'
import { MatchSetup } from '../scoring/MatchSetup'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'
import { useKeyboardShortcuts } from '../scoring/useKeyboardShortcuts'
import { useScoringPrefs } from '../scoring/useScoringPrefs'
import { playTick, vibrate } from '../scoring/feedback'
import {
  useCallTimeout,
  useConfirmGameOver,
  useConfirmMatchOver,
  useMatch,
  useScorePoint,
  useSideOut,
  useStartMatch,
  useUndo,
} from '../scoring/hooks'

export interface RefMatchConsoleProps {
  publicId: string
}

export function RefMatchConsole({ publicId }: RefMatchConsoleProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const matchQuery = useMatch(publicId)
  const ws = useMatchWebSocket(publicId)
  const { prefs } = useScoringPrefs()

  const startMatch = useStartMatch()
  const scorePoint = useScorePoint()
  const sideOut = useSideOut()
  const undo = useUndo()
  const callTimeout = useCallTimeout()
  const confirmGameOver = useConfirmGameOver()
  const confirmMatchOver = useConfirmMatchOver()

  const [gameOverPrompt, setGameOverPrompt] = useState(false)
  const [matchOverPrompt, setMatchOverPrompt] = useState(false)

  const match = matchQuery.data
  const disabled = ws.state !== 'open'

  function feedback(variant: 'point' | 'side_out' | 'undo' | 'error' = 'point') {
    if (prefs.haptic) vibrate(50)
    if (prefs.sound) playTick(variant)
  }

  function handleResult(
    res: { game_over_detected?: boolean; match_over_detected?: boolean }
  ) {
    if (res.match_over_detected) setMatchOverPrompt(true)
    else if (res.game_over_detected) setGameOverPrompt(true)
  }

  function handlePoint(team?: 1 | 2) {
    if (!match) return
    scorePoint.mutate(
      { publicId, team },
      {
        onSuccess: (res) => {
          feedback('point')
          handleResult(res)
        },
        onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed to score'),
      }
    )
  }

  function handleSideOut() {
    if (!match) return
    sideOut.mutate(
      { publicId },
      {
        onSuccess: () => feedback('side_out'),
        onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed to side out'),
      }
    )
  }

  function handleUndo() {
    if (!match) return
    undo.mutate(
      { publicId },
      {
        onSuccess: () => feedback('undo'),
        onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed to undo'),
      }
    )
  }

  function handleTimeout(team: 1 | 2) {
    if (!match) return
    callTimeout.mutate(
      { publicId, team },
      {
        onSuccess: () => toast('info', `Timeout for Team ${team}`),
        onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed to call timeout'),
      }
    )
  }

  // Side-out: '1' triggers POINT (no team specified). Rally: '1' = team 1, '2' = team 2.
  useKeyboardShortcuts(
    {
      onPointTeam1: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(1)
        else handlePoint()
      },
      onPointTeam2: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(2)
      },
      onSideOut: () => {
        if (!match) return
        if (match.scoring_type === 'side_out') handleSideOut()
      },
      onUndo: handleUndo,
      onTimeout: () => {
        if (match?.serving_team) handleTimeout(match.serving_team)
      },
      onEscape: () => {
        setGameOverPrompt(false)
        setMatchOverPrompt(false)
      },
    },
    prefs.keyboard && match?.status === 'in_progress' && !disabled
  )

  if (matchQuery.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-32 mb-2" />
        <Skeleton className="h-32 mb-2" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  if (matchQuery.isError || !match) {
    return (
      <div className="p-4 text-(--color-error)">
        Failed to load match.{' '}
        <button
          type="button"
          onClick={() => matchQuery.refetch()}
          className="underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DisconnectBanner state={ws.state} />

      {match.status === 'scheduled' ? (
        <MatchSetup
          match={match}
          pending={startMatch.isPending}
          onBegin={(input) =>
            startMatch.mutate(
              { publicId, ...input },
              {
                onSuccess: () => toast('success', 'Match started'),
                onError: (err) =>
                  toast('error', err instanceof Error ? err.message : 'Failed to start match'),
              }
            )
          }
          onCancel={() => navigate({ to: '/ref' })}
        />
      ) : (
        <div className="p-3 md:p-4 flex-1">
          <MatchScoreboard
            match={match}
            mode="ref"
            disabled={disabled}
            pending={
              scorePoint.isPending ||
              sideOut.isPending ||
              undo.isPending ||
              callTimeout.isPending
            }
            onPoint={handlePoint}
            onSideOut={handleSideOut}
            onUndo={handleUndo}
            onTimeout={handleTimeout}
          />
        </div>
      )}

      <ConfirmDialog
        open={gameOverPrompt}
        onClose={() => setGameOverPrompt(false)}
        title="Game Over?"
        message="The scoring threshold has been reached. Confirm to end this game."
        confirmText="End Game"
        loading={confirmGameOver.isPending}
        onConfirm={() => {
          confirmGameOver.mutate(
            { publicId },
            {
              onSuccess: () => {
                setGameOverPrompt(false)
                toast('success', 'Game ended')
              },
              onError: (err) =>
                toast('error', err instanceof Error ? err.message : 'Failed to end game'),
            }
          )
        }}
      />

      <ConfirmDialog
        open={matchOverPrompt}
        onClose={() => setMatchOverPrompt(false)}
        title="Match Over?"
        message="The match-winning condition has been met. Confirm to end the match."
        confirmText="End Match"
        loading={confirmMatchOver.isPending}
        onConfirm={() => {
          confirmMatchOver.mutate(
            { publicId },
            {
              onSuccess: () => {
                setMatchOverPrompt(false)
                toast('success', 'Match completed')
              },
              onError: (err) =>
                toast('error', err instanceof Error ? err.message : 'Failed to end match'),
            }
          )
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/referee/RefMatchConsole.tsx
git commit -m "feat(frontend): add RefMatchConsole"
```

---

## Task 3: RefCourtView Component

**Files:**
- Create: `frontend/src/features/referee/RefCourtView.tsx`

Lists matches assigned to a court (active + on-deck + queued + recent completed). Tapping any in_progress or scheduled match → ref console.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/referee/RefCourtView.tsx
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Card } from '../../components/Card'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useCourtMatches } from '../scoring/hooks'
import type { Match } from '../scoring/types'

export interface RefCourtViewProps {
  courtId: number
}

export function RefCourtView({ courtId }: RefCourtViewProps) {
  const matches = useCourtMatches(courtId)

  if (matches.isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }
  if (matches.isError) {
    return (
      <div className="p-4 text-(--color-error)">
        Failed to load court matches.
      </div>
    )
  }

  const list = matches.data ?? []
  const grouped = groupByStatus(list)

  return (
    <div className="p-4 space-y-6">
      <Section title="In Progress" matches={grouped.in_progress} mode="ref" />
      <Section title="Scheduled" matches={grouped.scheduled} mode="ref" />
      <Section title="Recently Completed" matches={grouped.completed} mode="ref" />
      {list.length === 0 && (
        <EmptyState
          title="No matches on this court"
          description="When a match is assigned to this court it will appear here."
        />
      )}
    </div>
  )
}

function Section({
  title,
  matches,
  mode,
}: {
  title: string
  matches: Match[]
  mode: 'ref'
}) {
  if (matches.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
        {title}
      </h2>
      <div className="space-y-2">
        {matches.map((m) => (
          <Link
            key={m.public_id}
            to={`/${mode}/matches/${m.public_id}`}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) rounded-lg"
          >
            <Card className="flex items-center justify-between p-3 hover:bg-(--color-bg-hover) transition-colors">
              <div className="min-w-0">
                <div className="text-sm text-(--color-text-primary) truncate">
                  {m.team_1?.name ?? 'Team 1'} vs {m.team_2?.name ?? 'Team 2'}
                </div>
                <div className="text-xs text-(--color-text-muted)">
                  {m.division_name ?? 'Match'}
                  {m.status === 'in_progress'
                    ? ` · ${m.team_1_score}–${m.team_2_score} G${m.current_game}`
                    : ''}
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-(--color-text-muted) shrink-0"
              />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

function groupByStatus(list: Match[]): {
  in_progress: Match[]
  scheduled: Match[]
  completed: Match[]
} {
  const out = { in_progress: [] as Match[], scheduled: [] as Match[], completed: [] as Match[] }
  for (const m of list) {
    if (m.status === 'in_progress') out.in_progress.push(m)
    else if (m.status === 'scheduled') out.scheduled.push(m)
    else if (m.status === 'completed') out.completed.push(m)
  }
  return out
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/referee/RefCourtView.tsx
git commit -m "feat(frontend): add RefCourtView"
```

---

## Task 4: RefHome Component

**Files:**
- Create: `frontend/src/features/referee/RefHome.tsx`

The open-pool court grid. For Phase 3B, fetches all courts via the existing endpoint. If no list endpoint exists yet, the grid shows an empty state and a manual "Jump to match by public ID" input.

- [ ] **Step 1: Inspect backend for a court list endpoint**

```sh
cd /Users/phoenix/code/court-command-v2/new-cc
grep -n "courts" backend/router/router.go
```

Look for routes mounted on `/api/v1/courts`. Backend Phase 2 added a standalone court CRUD route. If `GET /api/v1/courts` returns a paginated list, use that. Otherwise document the gap.

- [ ] **Step 2: Add `useAllCourts` to scoring hooks (if needed)**

If the backend has `GET /api/v1/courts`, add this to `frontend/src/features/scoring/hooks.ts`:

```ts
export function useAllCourts() {
  return useQuery<CourtSummary[]>({
    queryKey: ['courts', 'all'],
    queryFn: () => apiGet<CourtSummary[]>('/api/v1/courts'),
  })
}
```

If it returns paginated data instead, use `apiGetPaginated` and map `.data`.

- [ ] **Step 3: Implement RefHome**

```tsx
// frontend/src/features/referee/RefHome.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Skeleton } from '../../components/Skeleton'
import { useAllCourts } from '../scoring/hooks'
import { CourtGrid } from './CourtGrid'

export function RefHome() {
  const navigate = useNavigate()
  const courts = useAllCourts()
  const [jumpId, setJumpId] = useState('')

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Referee Console
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (jumpId.trim()) {
              navigate({ to: `/ref/matches/${jumpId.trim()}` })
            }
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={jumpId}
            onChange={(e) => setJumpId(e.target.value)}
            placeholder="Match public ID"
            aria-label="Match public ID"
            className="w-48"
          />
          <Button type="submit" variant="secondary" aria-label="Open match">
            <Search size={16} />
          </Button>
        </form>
      </div>

      <p className="text-sm text-(--color-text-secondary) mb-4">
        Tap a court to view its matches. Active matches show a live score.
      </p>

      {courts.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <CourtGrid
          courts={courts.data ?? []}
          mode="ref"
          emptyMessage="No courts available. Use the Match public ID input to open a specific match."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/referee/RefHome.tsx frontend/src/features/scoring/hooks.ts
git commit -m "feat(frontend): add RefHome with court grid + jump-by-id"
```

---

## Task 5: ScorekeeperMatchConsole Component

**Files:**
- Create: `frontend/src/features/scorekeeper/ScorekeeperMatchConsole.tsx`

Stripped-down variant: same MatchScoreboard but fewer prompts. No game-over confirm prompt — the scorekeeper just keeps scoring; the system auto-ends games when the engine reports `game_over_detected`. No manual timeout calling. No undo limit — undo is allowed.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scorekeeper/ScorekeeperMatchConsole.tsx
import { useNavigate } from '@tanstack/react-router'
import { useToast } from '../../components/Toast'
import { Skeleton } from '../../components/Skeleton'
import { DisconnectBanner } from '../scoring/DisconnectBanner'
import { MatchScoreboard } from '../scoring/MatchScoreboard'
import { MatchSetup } from '../scoring/MatchSetup'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'
import { useKeyboardShortcuts } from '../scoring/useKeyboardShortcuts'
import { useScoringPrefs } from '../scoring/useScoringPrefs'
import { playTick, vibrate } from '../scoring/feedback'
import {
  useConfirmGameOver,
  useConfirmMatchOver,
  useMatch,
  useScorePoint,
  useSideOut,
  useStartMatch,
  useUndo,
} from '../scoring/hooks'

export interface ScorekeeperMatchConsoleProps {
  publicId: string
}

export function ScorekeeperMatchConsole({
  publicId,
}: ScorekeeperMatchConsoleProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const matchQuery = useMatch(publicId)
  const ws = useMatchWebSocket(publicId)
  const { prefs } = useScoringPrefs()

  const startMatch = useStartMatch()
  const scorePoint = useScorePoint()
  const sideOut = useSideOut()
  const undo = useUndo()
  const confirmGame = useConfirmGameOver()
  const confirmMatch = useConfirmMatchOver()

  const match = matchQuery.data
  const disabled = ws.state !== 'open'

  function feedback(v: 'point' | 'side_out' | 'undo' = 'point') {
    if (prefs.haptic) vibrate(50)
    if (prefs.sound) playTick(v)
  }

  function autoConfirm(res: { game_over_detected?: boolean; match_over_detected?: boolean }) {
    // Scorekeeper UX: auto-confirm game/match when detected (no prompt)
    if (res.match_over_detected) {
      confirmMatch.mutate({ publicId })
    } else if (res.game_over_detected) {
      confirmGame.mutate({ publicId })
    }
  }

  function handlePoint(team?: 1 | 2) {
    scorePoint.mutate(
      { publicId, team },
      {
        onSuccess: (res) => {
          feedback('point')
          autoConfirm(res)
        },
        onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed'),
      }
    )
  }
  function handleSideOut() {
    sideOut.mutate(
      { publicId },
      { onSuccess: () => feedback('side_out'), onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed') }
    )
  }
  function handleUndo() {
    undo.mutate(
      { publicId },
      { onSuccess: () => feedback('undo'), onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed') }
    )
  }

  useKeyboardShortcuts(
    {
      onPointTeam1: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(1)
        else handlePoint()
      },
      onPointTeam2: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(2)
      },
      onSideOut: () => {
        if (match?.scoring_type === 'side_out') handleSideOut()
      },
      onUndo: handleUndo,
    },
    prefs.keyboard && match?.status === 'in_progress' && !disabled
  )

  if (matchQuery.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (matchQuery.isError || !match) {
    return <div className="p-4 text-(--color-error)">Failed to load match.</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DisconnectBanner state={ws.state} />
      {match.status === 'scheduled' ? (
        <MatchSetup
          match={match}
          pending={startMatch.isPending}
          onBegin={(input) =>
            startMatch.mutate(
              { publicId, ...input },
              {
                onSuccess: () => toast('success', 'Match started'),
                onError: (err) =>
                  toast('error', err instanceof Error ? err.message : 'Failed to start match'),
              }
            )
          }
          onCancel={() => navigate({ to: '/scorekeeper' })}
        />
      ) : (
        <div className="p-3 md:p-4 flex-1">
          <MatchScoreboard
            match={match}
            mode="scorekeeper"
            disabled={disabled}
            pending={scorePoint.isPending || sideOut.isPending || undo.isPending}
            onPoint={handlePoint}
            onSideOut={handleSideOut}
            onUndo={handleUndo}
            onTimeout={() => {
              /* scorekeeper has no timeout button — no-op */
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scorekeeper/ScorekeeperMatchConsole.tsx
git commit -m "feat(frontend): add ScorekeeperMatchConsole"
```

---

## Task 6: ScorekeeperHome Component

**Files:**
- Create: `frontend/src/features/scorekeeper/ScorekeeperHome.tsx`

Same as RefHome but routes to `/scorekeeper/matches/:publicId`.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scorekeeper/ScorekeeperHome.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Skeleton } from '../../components/Skeleton'
import { useAllCourts } from '../scoring/hooks'
import { CourtGrid } from '../referee/CourtGrid'

export function ScorekeeperHome() {
  const navigate = useNavigate()
  const courts = useAllCourts()
  const [jumpId, setJumpId] = useState('')

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Scorekeeper
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (jumpId.trim()) {
              navigate({ to: `/scorekeeper/matches/${jumpId.trim()}` })
            }
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={jumpId}
            onChange={(e) => setJumpId(e.target.value)}
            placeholder="Match public ID"
            aria-label="Match public ID"
            className="w-48"
          />
          <Button type="submit" variant="secondary" aria-label="Open match">
            <Search size={16} />
          </Button>
        </form>
      </div>

      <p className="text-sm text-(--color-text-secondary) mb-4">
        Lightweight scoring for casual matches. Tap a court to begin.
      </p>

      {courts.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <CourtGrid
          courts={courts.data ?? []}
          mode="scorekeeper"
          emptyMessage="No courts available."
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scorekeeper/ScorekeeperHome.tsx
git commit -m "feat(frontend): add ScorekeeperHome"
```

---

## Task 7: Route Files

**Files:**
- Create: `frontend/src/routes/ref/index.tsx`
- Create: `frontend/src/routes/ref/courts.$courtId.tsx`
- Create: `frontend/src/routes/ref/matches.$publicId.tsx`
- Create: `frontend/src/routes/scorekeeper/index.tsx`
- Create: `frontend/src/routes/scorekeeper/matches.$publicId.tsx`

- [ ] **Step 1: Create `ref/index.tsx`**

```tsx
// frontend/src/routes/ref/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RefHome } from '../../features/referee/RefHome'

export const Route = createFileRoute('/ref/')({
  component: RefHome,
})
```

- [ ] **Step 2: Create `ref/courts.$courtId.tsx`**

```tsx
// frontend/src/routes/ref/courts.$courtId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RefCourtView } from '../../features/referee/RefCourtView'

export const Route = createFileRoute('/ref/courts/$courtId')({
  component: function RefCourtPage() {
    const { courtId } = Route.useParams()
    return <RefCourtView courtId={Number(courtId)} />
  },
})
```

- [ ] **Step 3: Create `ref/matches.$publicId.tsx`**

```tsx
// frontend/src/routes/ref/matches.$publicId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RefMatchConsole } from '../../features/referee/RefMatchConsole'

export const Route = createFileRoute('/ref/matches/$publicId')({
  component: function RefMatchPage() {
    const { publicId } = Route.useParams()
    return <RefMatchConsole publicId={publicId} />
  },
})
```

- [ ] **Step 4: Create `scorekeeper/index.tsx`**

```tsx
// frontend/src/routes/scorekeeper/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ScorekeeperHome } from '../../features/scorekeeper/ScorekeeperHome'

export const Route = createFileRoute('/scorekeeper/')({
  component: ScorekeeperHome,
})
```

- [ ] **Step 5: Create `scorekeeper/matches.$publicId.tsx`**

```tsx
// frontend/src/routes/scorekeeper/matches.$publicId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ScorekeeperMatchConsole } from '../../features/scorekeeper/ScorekeeperMatchConsole'

export const Route = createFileRoute('/scorekeeper/matches/$publicId')({
  component: function ScorekeeperMatchPage() {
    const { publicId } = Route.useParams()
    return <ScorekeeperMatchConsole publicId={publicId} />
  },
})
```

- [ ] **Step 6: Regenerate route tree**

```sh
cd frontend
npx @tanstack/router-cli generate
pnpm tsc -b --noEmit
```

Expected: 0 errors. The Vite plugin also auto-regenerates on dev start, but running explicitly avoids surprises.

- [ ] **Step 7: Commit**

```sh
git add frontend/src/routes/ref/ frontend/src/routes/scorekeeper/ frontend/src/routeTree.gen.ts
git commit -m "feat(frontend): add referee + scorekeeper routes"
```

---

## Task 8: Manual Smoke Test + Final Verification

- [ ] **Step 1: Run dev + start backend**

```sh
make dev   # backend on :8080 + db + redis (per existing Makefile)
# in another terminal:
cd frontend && pnpm dev
```

- [ ] **Step 2: Smoke test**

Manually verify (login first):
1. Visit `/ref` — court grid loads (or shows empty state). Jump-by-id works.
2. Click an active match (or jump to one): the ref console loads.
3. If status is `scheduled`, MatchSetup screen renders. Begin Match transitions to scoreboard.
4. Tap POINT — score updates. Haptic + sound fire (if enabled).
5. Tap SIDE OUT (if side-out match) — service transfers.
6. Tap Undo — last action rolls back.
7. Open the same match URL in a second tab — score updates live in both via WebSocket.
8. Kill the network briefly (browser devtools → Offline). DisconnectBanner appears, scoring buttons disabled. Restore — banner shows "Reconnected" then dismisses.
9. Visit `/scorekeeper` — court grid loads. Open a match. Score works without timeout button.
10. Press `1` (rally) or `1` then `S` (side-out) on keyboard — keyboard shortcuts fire.

- [ ] **Step 3: Final verification**

```sh
cd frontend
pnpm tsc -b --noEmit
pnpm build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 4: Push**

```sh
git push origin main:V2
```

---

## Self-Review Checklist

- [ ] All 6 component files + 5 route files exist
- [ ] Route tree regenerated; no orphan routes
- [ ] No `@/` aliases
- [ ] No swallowed errors — every mutation has `onError` posting a toast
- [ ] WS disconnect disables scoring buttons (verified visually)
- [ ] Keyboard shortcuts respect `prefs.keyboard` toggle
- [ ] Build passes

When DONE, report:
- All commit SHAs
- Smoke-test checklist results (any failures)
- Whether `useAllCourts` was added or omitted (and why)
- `pnpm build` final line
