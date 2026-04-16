# Frontend Phase 3E — Quick Match + Score Override + Game-Over Modal + Settings + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap up Phase 3 with the remaining surfaces: quick-match list and creator, score override modal (role-gated), purpose-built game-over confirmation modal (replacing the placeholder ConfirmDialog), match-complete banner, scoring settings page, and ref-console kebab menu wiring (override + settings).

**Architecture:** New components under `features/quick-match/` and `features/scoring/`. Add three new routes (`/quick-match`, `/quick-match/new`, `/settings/scoring`). Replace placeholder ConfirmDialog calls in `RefMatchConsole` with the new dedicated modals.

**Depends on:** Phase 3A (hooks), Phase 3B (RefMatchConsole), Phase 3C (MatchDetail).

---

## Conventions Recap

- Imports relative
- Toast: `const { toast } = useToast(); toast(type, msg)`
- After adding routes: `npx @tanstack/router-cli generate`
- Existing `Modal` API: `{ open, onClose, title, children, className? }`
- Existing `useAuth`: `auth.user` includes `role` field

---

## Task 1: GameOverConfirmModal Component

**Files:**
- Create: `frontend/src/features/scoring/GameOverConfirmModal.tsx`

Replaces the generic ConfirmDialog used in 3B with a richer modal showing per-team scores and the winner.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/GameOverConfirmModal.tsx
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import type { Match } from './types'

export interface GameOverConfirmModalProps {
  open: boolean
  match: Match | undefined
  pending?: boolean
  onConfirm: () => void
  onContinue: () => void
}

export function GameOverConfirmModal({
  open,
  match,
  pending,
  onConfirm,
  onContinue,
}: GameOverConfirmModalProps) {
  if (!match) {
    return (
      <Modal open={open} onClose={onContinue} title="Game Over?">
        <div className="p-4">No match data.</div>
      </Modal>
    )
  }

  const t1 = match.team_1_score
  const t2 = match.team_2_score
  const winner = t1 > t2 ? 1 : 2
  const winnerName =
    (winner === 1 ? match.team_1?.name : match.team_2?.name) ?? `Team ${winner}`

  return (
    <Modal open={open} onClose={onContinue} title="Game Over?">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm text-(--color-text-secondary)">
          Game {match.current_game} threshold reached.
        </p>
        <div className="text-center bg-(--color-bg-secondary) rounded-lg p-4">
          <div className="text-4xl font-extrabold tabular-nums text-(--color-text-primary)">
            {t1} – {t2}
          </div>
          <div className="text-sm text-(--color-accent) font-semibold mt-2">
            {winnerName} wins
          </div>
        </div>
        <p className="text-xs text-(--color-text-muted)">
          Confirm to end the game and start the next, or continue scoring (e.g. for a deuce).
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onContinue} disabled={pending}>
            Continue Scoring
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={pending}>
            End Game
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/GameOverConfirmModal.tsx
git commit -m "feat(frontend): add GameOverConfirmModal"
```

---

## Task 2: MatchCompleteBanner Component

**Files:**
- Create: `frontend/src/features/scoring/MatchCompleteBanner.tsx`

Shown after match is confirmed complete (status='completed').

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/MatchCompleteBanner.tsx
import { Trophy } from 'lucide-react'
import { Button } from '../../components/Button'
import type { Match } from './types'

export interface MatchCompleteBannerProps {
  match: Match
  onBackToCourts?: () => void
}

export function MatchCompleteBanner({ match, onBackToCourts }: MatchCompleteBannerProps) {
  const winnerId = match.winner_team_id
  const winnerName =
    winnerId === match.team_1?.id
      ? match.team_1?.name
      : winnerId === match.team_2?.id
        ? match.team_2?.name
        : null

  return (
    <div className="rounded-xl bg-(--color-success) text-white p-6 flex flex-col items-center gap-3 text-center">
      <Trophy size={40} />
      <div className="text-2xl font-bold">Match Complete</div>
      {winnerName ? (
        <div className="text-lg">{winnerName} wins</div>
      ) : (
        <div className="text-lg">Final: {match.team_1_score} – {match.team_2_score}</div>
      )}
      <div className="text-sm opacity-90">
        Games: {match.team_1_games_won} – {match.team_2_games_won}
      </div>
      {onBackToCourts && (
        <Button variant="secondary" className="mt-2" onClick={onBackToCourts}>
          Back to Courts
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/MatchCompleteBanner.tsx
git commit -m "feat(frontend): add MatchCompleteBanner"
```

---

## Task 3: ScoreOverrideModal Component

**Files:**
- Create: `frontend/src/features/scoring/ScoreOverrideModal.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/ScoreOverrideModal.tsx
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { useToast } from '../../components/Toast'
import { useOverrideScore } from './hooks'
import type { Match } from './types'

export interface ScoreOverrideModalProps {
  open: boolean
  onClose: () => void
  match: Match
}

interface GameRow {
  game_number: number
  team_1_score: number
  team_2_score: number
  winner: '1' | '2' | ''
}

function buildInitialRows(match: Match): GameRow[] {
  const rows: GameRow[] = match.completed_games.map((g) => ({
    game_number: g.game_number,
    team_1_score: g.team_1_score,
    team_2_score: g.team_2_score,
    winner: String(g.winner) as '1' | '2',
  }))
  // Add the current (uncommitted) game if match is in progress
  if (match.status === 'in_progress' && rows.every((r) => r.game_number !== match.current_game)) {
    rows.push({
      game_number: match.current_game,
      team_1_score: match.team_1_score,
      team_2_score: match.team_2_score,
      winner: '',
    })
  }
  return rows
}

export function ScoreOverrideModal({ open, onClose, match }: ScoreOverrideModalProps) {
  const { toast } = useToast()
  const override = useOverrideScore()
  const [rows, setRows] = useState<GameRow[]>(() => buildInitialRows(match))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ reason?: string }>({})

  useEffect(() => {
    if (open) {
      setRows(buildInitialRows(match))
      setReason('')
      setErrors({})
    }
  }, [open, match])

  function updateRow(idx: number, partial: Partial<GameRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...partial } : r)))
  }

  function submit() {
    if (reason.trim().length < 10) {
      setErrors({ reason: 'Reason must be at least 10 characters' })
      return
    }
    override.mutate(
      {
        publicId: match.public_id,
        reason: reason.trim(),
        games: rows.map((r) => ({
          game_number: r.game_number,
          team_1_score: r.team_1_score,
          team_2_score: r.team_2_score,
          winner: r.winner === '' ? null : (Number(r.winner) as 1 | 2),
        })),
      },
      {
        onSuccess: () => {
          toast('success', 'Score override applied')
          onClose()
        },
        onError: (err) =>
          toast('error', err instanceof Error ? err.message : 'Override failed'),
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Override Score">
      <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
        {match.status === 'completed' && (
          <div className="rounded bg-(--color-warning) text-white p-3 text-sm">
            This match is already final. Overriding will modify the recorded result.
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-(--color-text-muted) text-xs uppercase">
              <th className="text-left py-1">Game</th>
              <th className="text-left py-1">{match.team_1?.short_name ?? 'T1'}</th>
              <th className="text-left py-1">{match.team_2?.short_name ?? 'T2'}</th>
              <th className="text-left py-1">Winner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.game_number} className="border-t border-(--color-border)">
                <td className="py-2 text-(--color-text-primary)">G{r.game_number}</td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={r.team_1_score}
                    onChange={(e) =>
                      updateRow(idx, { team_1_score: Number(e.target.value) || 0 })
                    }
                    className="w-20"
                    aria-label={`Game ${r.game_number} team 1 score`}
                  />
                </td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={r.team_2_score}
                    onChange={(e) =>
                      updateRow(idx, { team_2_score: Number(e.target.value) || 0 })
                    }
                    className="w-20"
                    aria-label={`Game ${r.game_number} team 2 score`}
                  />
                </td>
                <td className="py-1.5">
                  <Select
                    value={r.winner}
                    onChange={(e) =>
                      updateRow(idx, { winner: e.target.value as '1' | '2' | '' })
                    }
                    aria-label={`Game ${r.game_number} winner`}
                  >
                    <option value="">— TBD —</option>
                    <option value="1">{match.team_1?.short_name ?? 'T1'}</option>
                    <option value="2">{match.team_2?.short_name ?? 'T2'}</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <FormField
          label="Reason"
          htmlFor="override-reason"
          error={errors.reason}
        >
          <Textarea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required. Why is this override being applied?"
            rows={3}
          />
        </FormField>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={override.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={override.isPending}>
            Apply Override
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

NOTES:
- Adapt `FormField` props if `error` / `htmlFor` are named differently in the actual component.
- If the backend rejects empty `winner` strings, set winner explicitly based on scores when omitted.

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/ScoreOverrideModal.tsx
git commit -m "feat(frontend): add ScoreOverrideModal"
```

---

## Task 4: Wire Modals + Kebab Menu Into RefMatchConsole

**Files:**
- Modify: `frontend/src/features/referee/RefMatchConsole.tsx`

Replace the placeholder `ConfirmDialog` calls with the new dedicated modals. Add a kebab menu (the `onMenu` prop on MatchScoreboard) that opens a dropdown with: Override Score (role-gated), Pause/Resume, Forfeit, Settings.

- [ ] **Step 1: Read existing file**

```sh
cat frontend/src/features/referee/RefMatchConsole.tsx
```

- [ ] **Step 2: Edit**

Replace the two `ConfirmDialog` instances with:

```tsx
import { GameOverConfirmModal } from '../scoring/GameOverConfirmModal'
import { MatchCompleteBanner } from '../scoring/MatchCompleteBanner'
import { ScoreOverrideModal } from '../scoring/ScoreOverrideModal'
import { useAuth } from '../auth/hooks'
import { useNavigate } from '@tanstack/react-router'

// inside component:
const auth = useAuth()
const canOverride =
  auth.user?.role === 'platform_admin' ||
  auth.user?.role === 'td' ||
  auth.user?.role === 'head_referee'
const [overrideOpen, setOverrideOpen] = useState(false)
const [menuOpen, setMenuOpen] = useState(false)

// Replace placeholder ConfirmDialog with:
<GameOverConfirmModal
  open={gameOverPrompt}
  match={match}
  pending={confirmGameOver.isPending}
  onConfirm={() => confirmGameOver.mutate({ publicId }, {
    onSuccess: () => {
      setGameOverPrompt(false)
      toast('success', 'Game ended')
    },
    onError: (err) => toast('error', err instanceof Error ? err.message : 'Failed to end game'),
  })}
  onContinue={() => setGameOverPrompt(false)}
/>

// And similarly for the match-over prompt.

// Render banner if match completed (instead of scoreboard)
{match.status === 'completed' ? (
  <MatchCompleteBanner
    match={match}
    onBackToCourts={() => navigate({ to: '/ref' })}
  />
) : (
  // existing setup / scoreboard branch
)}

// Score override modal
{canOverride && (
  <ScoreOverrideModal
    open={overrideOpen}
    onClose={() => setOverrideOpen(false)}
    match={match}
  />
)}
```

For the kebab menu, the simplest approach: use a basic menu component if one exists, otherwise an inline `<div>` dropdown gated by `menuOpen`. Wire `onMenu={() => setMenuOpen(!menuOpen)}` on MatchScoreboard.

```tsx
// Below or beside the scoreboard, render the menu:
{menuOpen && (
  <div
    role="menu"
    className="fixed top-16 right-4 z-30 w-56 rounded-md border border-(--color-border) bg-(--color-bg-secondary) shadow-lg p-1"
  >
    {canOverride && (
      <button
        type="button"
        role="menuitem"
        className="block w-full text-left px-3 py-2 hover:bg-(--color-bg-hover) rounded text-sm"
        onClick={() => {
          setMenuOpen(false)
          setOverrideOpen(true)
        }}
      >
        Override Score
      </button>
    )}
    <button
      type="button"
      role="menuitem"
      className="block w-full text-left px-3 py-2 hover:bg-(--color-bg-hover) rounded text-sm"
      onClick={() => {
        setMenuOpen(false)
        if (match.is_paused) resumeMatch.mutate({ publicId })
        else pauseMatch.mutate({ publicId })
      }}
    >
      {match.is_paused ? 'Resume Match' : 'Pause Match'}
    </button>
    <Link
      role="menuitem"
      to="/settings/scoring"
      className="block px-3 py-2 hover:bg-(--color-bg-hover) rounded text-sm"
      onClick={() => setMenuOpen(false)}
    >
      Scoring Settings
    </Link>
  </div>
)}
```

Add the missing imports (`usePauseMatch`, `useResumeMatch` from scoring/hooks, plus `Link` from `@tanstack/react-router`).

- [ ] **Step 3: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/referee/RefMatchConsole.tsx
git commit -m "feat(frontend): wire override modal, complete banner, kebab menu in ref console"
```

---

## Task 5: Quick Match — Card Component

**Files:**
- Create: `frontend/src/features/quick-match/QuickMatchCard.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/quick-match/QuickMatchCard.tsx
import { Link } from '@tanstack/react-router'
import { Card } from '../../components/Card'
import type { Match } from '../scoring/types'

export interface QuickMatchCardProps {
  match: Match
}

function formatExpiresAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const expires = new Date(iso).getTime()
  const now = Date.now()
  const remainingMs = expires - now
  if (remainingMs <= 0) return 'expired'
  const hrs = Math.floor(remainingMs / 3_600_000)
  const mins = Math.floor((remainingMs % 3_600_000) / 60_000)
  if (hrs > 0) return `expires in ${hrs}h ${mins}m`
  return `expires in ${mins}m`
}

export function QuickMatchCard({ match }: QuickMatchCardProps) {
  return (
    <Link
      to={`/ref/matches/${match.public_id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) rounded-lg"
    >
      <Card className="p-3 hover:bg-(--color-bg-hover) transition-colors">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm text-(--color-text-primary) truncate">
              {match.team_1?.name ?? 'Team 1'} vs {match.team_2?.name ?? 'Team 2'}
            </div>
            <div className="text-xs text-(--color-text-muted)">
              {match.scoring_type === 'rally' ? 'Rally' : 'Side-out'} · to {match.points_to_win} · best of {match.best_of}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums text-(--color-text-primary)">
              {match.team_1_score} – {match.team_2_score}
            </div>
            <div className="text-xs text-(--color-warning)">
              {formatExpiresAt(match.expires_at)}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/quick-match/QuickMatchCard.tsx
git commit -m "feat(frontend): add QuickMatchCard"
```

---

## Task 6: QuickMatchList Component

**Files:**
- Create: `frontend/src/features/quick-match/QuickMatchList.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/quick-match/QuickMatchList.tsx
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { useMyQuickMatches } from './hooks'
import { QuickMatchCard } from './QuickMatchCard'

export function QuickMatchList() {
  const { data, isLoading, isError } = useMyQuickMatches()

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Quick Matches</h1>
        <Link to="/quick-match/new">
          <Button variant="primary">
            <Plus size={16} className="mr-1 inline-block" />
            New Quick Match
          </Button>
        </Link>
      </div>

      <p className="text-xs text-(--color-text-muted)">
        Quick matches expire automatically 24 hours after creation.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : isError ? (
        <div className="text-(--color-error)">Failed to load quick matches.</div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No active quick matches"
          description="Start a casual match in seconds — no tournament needed."
        />
      ) : (
        <div className="space-y-2">
          {data.map((m) => (
            <QuickMatchCard key={m.public_id} match={m} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/quick-match/QuickMatchList.tsx
git commit -m "feat(frontend): add QuickMatchList"
```

---

## Task 7: QuickMatchCreate Component

**Files:**
- Create: `frontend/src/features/quick-match/QuickMatchCreate.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/quick-match/QuickMatchCreate.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { useToast } from '../../components/Toast'
import { useCreateQuickMatch } from './hooks'

export function QuickMatchCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateQuickMatch()

  const [team1, setTeam1] = useState('')
  const [team2, setTeam2] = useState('')
  const [scoringType, setScoringType] = useState<'side_out' | 'rally'>('side_out')
  const [pointsTo, setPointsTo] = useState('11')
  const [winBy, setWinBy] = useState('2')
  const [bestOf, setBestOf] = useState('1')
  const [errors, setErrors] = useState<{ team1?: string; team2?: string }>({})

  function submit() {
    const next: typeof errors = {}
    if (!team1.trim()) next.team1 = 'Required'
    if (!team2.trim()) next.team2 = 'Required'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    setErrors({})
    create.mutate(
      {
        team_1_name: team1.trim(),
        team_2_name: team2.trim(),
        scoring_type: scoringType,
        points_to_win: Number(pointsTo) || 11,
        win_by: Number(winBy) || 2,
        best_of: Number(bestOf) || 1,
      },
      {
        onSuccess: (m) => {
          toast('success', 'Quick match created')
          navigate({ to: `/ref/matches/${m.public_id}` })
        },
        onError: (err) =>
          toast('error', err instanceof Error ? err.message : 'Failed to create quick match'),
      }
    )
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-(--color-text-primary) mb-1">New Quick Match</h1>
      <p className="text-sm text-(--color-text-secondary) mb-4">
        Casual scoring — no tournament required. Auto-deletes after 24 hours.
      </p>

      <Card className="p-4 flex flex-col gap-3">
        <FormField label="Team 1 Name" htmlFor="qm-team-1" error={errors.team1}>
          <Input
            id="qm-team-1"
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            placeholder="e.g. Smith / Lee"
          />
        </FormField>
        <FormField label="Team 2 Name" htmlFor="qm-team-2" error={errors.team2}>
          <Input
            id="qm-team-2"
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            placeholder="e.g. Garcia / Patel"
          />
        </FormField>

        <FormField label="Scoring" htmlFor="qm-scoring">
          <Select
            id="qm-scoring"
            value={scoringType}
            onChange={(e) => setScoringType(e.target.value as 'side_out' | 'rally')}
          >
            <option value="side_out">Side-out</option>
            <option value="rally">Rally</option>
          </Select>
        </FormField>

        <div className="grid grid-cols-3 gap-2">
          <FormField label="Points to" htmlFor="qm-points">
            <Input
              id="qm-points"
              type="number"
              min={1}
              value={pointsTo}
              onChange={(e) => setPointsTo(e.target.value)}
            />
          </FormField>
          <FormField label="Win by" htmlFor="qm-winby">
            <Input
              id="qm-winby"
              type="number"
              min={1}
              value={winBy}
              onChange={(e) => setWinBy(e.target.value)}
            />
          </FormField>
          <FormField label="Best of" htmlFor="qm-bestof">
            <Input
              id="qm-bestof"
              type="number"
              min={1}
              value={bestOf}
              onChange={(e) => setBestOf(e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="secondary" onClick={() => navigate({ to: '/quick-match' })}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={create.isPending}>
            Create
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/quick-match/QuickMatchCreate.tsx
git commit -m "feat(frontend): add QuickMatchCreate"
```

---

## Task 8: Scoring Settings Page

**Files:**
- Create: `frontend/src/features/scoring/ScoringSettings.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/ScoringSettings.tsx
import { Card } from '../../components/Card'
import { useScoringPrefs } from './useScoringPrefs'

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-(--color-text-primary)">
          {label}
        </span>
        <span className="block text-xs text-(--color-text-secondary) mt-0.5">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-(--color-accent)"
      />
    </label>
  )
}

export function ScoringSettings() {
  const { prefs, setKeyboard, setHaptic, setSound } = useScoringPrefs()

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Scoring Settings
        </h1>
        <p className="text-sm text-(--color-text-secondary)">
          Adjust how the referee and scorekeeper consoles behave on this device.
        </p>
      </header>

      <Card className="px-4 divide-y divide-(--color-border)">
        <ToggleRow
          label="Keyboard shortcuts"
          description="1 / 2 to score, S for side-out, Z to undo, T for timeout. Disabled while typing in input fields."
          checked={prefs.keyboard}
          onChange={setKeyboard}
        />
        <ToggleRow
          label="Haptic feedback"
          description="Short vibration on point, side-out, and undo (mobile only)."
          checked={prefs.haptic}
          onChange={setHaptic}
        />
        <ToggleRow
          label="Sound feedback"
          description="Brief tick sound on each scoring action."
          checked={prefs.sound}
          onChange={setSound}
        />
      </Card>

      <p className="text-xs text-(--color-text-muted)">
        Preferences are stored in this browser only. Sign-in does not sync them.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/ScoringSettings.tsx
git commit -m "feat(frontend): add ScoringSettings page"
```

---

## Task 9: Route Files

**Files:**
- Create: `frontend/src/routes/quick-match/index.tsx`
- Create: `frontend/src/routes/quick-match/new.tsx`
- Create: `frontend/src/routes/settings/scoring.tsx`

- [ ] **Step 1: Create `quick-match/index.tsx`**

```tsx
// frontend/src/routes/quick-match/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { QuickMatchList } from '../../features/quick-match/QuickMatchList'

export const Route = createFileRoute('/quick-match/')({
  component: QuickMatchList,
})
```

- [ ] **Step 2: Create `quick-match/new.tsx`**

```tsx
// frontend/src/routes/quick-match/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import { QuickMatchCreate } from '../../features/quick-match/QuickMatchCreate'

export const Route = createFileRoute('/quick-match/new')({
  component: QuickMatchCreate,
})
```

- [ ] **Step 3: Create `settings/scoring.tsx`**

```tsx
// frontend/src/routes/settings/scoring.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ScoringSettings } from '../../features/scoring/ScoringSettings'

export const Route = createFileRoute('/settings/scoring')({
  component: ScoringSettings,
})
```

- [ ] **Step 4: Regenerate route tree + verify**

```sh
cd frontend
npx @tanstack/router-cli generate
pnpm tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```sh
git add frontend/src/routes/quick-match/ frontend/src/routes/settings/ frontend/src/routeTree.gen.ts
git commit -m "feat(frontend): add quick-match and scoring settings routes"
```

---

## Task 10: Add Quick Match to Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the entry**

Following the same pattern used by Phase 3D for Ref Console / Scorekeeper, add:

```tsx
{ label: 'Quick Match', icon: 'Zap', to: '/quick-match' }
```

(Adapt to actual sidebar structure.)

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): add Quick Match link to sidebar"
```

---

## Task 11: Match Detail — Add Score Override Button (Role-Gated)

**Files:**
- Modify: `frontend/src/features/matches/MatchDetail.tsx`

Add an "Admin Actions" panel at the bottom of MatchDetail showing the Override Score button when the user has the right role.

- [ ] **Step 1: Edit**

```tsx
import { useAuth } from '../auth/hooks'
import { Button } from '../../components/Button'
import { ScoreOverrideModal } from '../scoring/ScoreOverrideModal'

// inside component (after eventsQuery hook):
const auth = useAuth()
const canOverride =
  auth.user?.role === 'platform_admin' ||
  auth.user?.role === 'td' ||
  auth.user?.role === 'head_referee'
const [overrideOpen, setOverrideOpen] = useState(false)

// before the events <details>:
{canOverride && (
  <div className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-4 flex items-center justify-between">
    <div>
      <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide">
        Admin actions
      </h2>
      <p className="text-xs text-(--color-text-muted) mt-1">
        Adjust the recorded score with an audit-logged override.
      </p>
    </div>
    <Button variant="secondary" onClick={() => setOverrideOpen(true)}>
      Override Score
    </Button>
  </div>
)}

{canOverride && (
  <ScoreOverrideModal
    open={overrideOpen}
    onClose={() => setOverrideOpen(false)}
    match={match}
  />
)}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/matches/MatchDetail.tsx
git commit -m "feat(frontend): role-gated Override Score on match detail"
```

---

## Task 12: Final Verification + Smoke Test

- [ ] **Step 1: Start dev**

```sh
make dev
cd frontend && pnpm dev
```

- [ ] **Step 2: Smoke test**

1. Sidebar: click Quick Match → quick match list. New Quick Match → form. Submit with two team names → lands in ref console with MatchSetup → Begin → score normally.
2. Score until threshold reached: GameOverConfirmModal shows with correct winner. End Game advances. End Match shows similar modal.
3. After match completes: MatchCompleteBanner replaces scoreboard.
4. As a TD/admin user, open match detail. Click Override Score. Edit a game's score, write a 10+ char reason, submit. Match updates.
5. Visit /settings/scoring. Toggle keyboard, haptic, sound. Refresh — settings persist.

- [ ] **Step 3: Final verify**

```sh
cd frontend
pnpm tsc -b --noEmit
pnpm build
git push origin main:V2
```

---

## Self-Review Checklist

- [ ] All 8 new components + 3 routes created
- [ ] Sidebar gained Quick Match entry
- [ ] RefMatchConsole no longer uses placeholder ConfirmDialog for game/match-over
- [ ] MatchCompleteBanner shown after match completes
- [ ] Override modal validates ≥10-char reason
- [ ] Settings page persists to localStorage
- [ ] Build passes

When DONE, report:
- Commits
- Smoke test results
- `pnpm build` final line
- Whether match.expires_at field exists on the backend Match payload (if not, QuickMatchCard's expiry text will be empty — note in report)
