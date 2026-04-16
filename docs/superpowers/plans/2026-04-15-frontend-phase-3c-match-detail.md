# Frontend Phase 3C — Match Detail + Public Scoreboard + Events + MatchSeries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing match detail page (mixed audience), the transparent public scoreboard route (for venue TVs / OBS), the events timeline component (filterable, color-coded), and the read-only match-series detail page.

**Architecture:** All views in `frontend/src/features/matches/` and `frontend/src/features/match-series/`. Re-use Phase 3A hooks (`useMatch`, `useMatchEvents`, `useMatchWebSocket`, `useMatchSeries`) and shared components (`MatchScoreboard`, `ServeIndicator`, `GameHistoryBar`, `ScoreCall`). Match detail is auth-optional. The public scoreboard route hides the app shell.

**Tech Stack:** React 19, TanStack Router, TanStack Query, lucide-react, Tailwind v4. Same conventions.

**Depends on:** Phase 3A (hooks + shared components).

---

## File Structure

```
frontend/src/features/matches/
├─ MatchDetail.tsx
├─ MatchDetailHero.tsx
├─ MatchInfoPanel.tsx
└─ MatchScoreboardPage.tsx

frontend/src/features/scoring/
└─ EventsTimeline.tsx          # Added here because it's a shared component

frontend/src/features/match-series/
└─ MatchSeriesDetail.tsx

frontend/src/routes/
├─ matches/
│  ├─ $publicId.tsx
│  └─ $publicId.scoreboard.tsx   # underscore avoids layout but keeps shell hidden via __root logic
└─ match-series/
   └─ $publicId.tsx
```

---

## Task 1: Update __root.tsx to Hide Shell on Scoreboard Routes

**Files:**
- Modify: `frontend/src/routes/__root.tsx`

The existing root file maintains a `NO_SHELL_ROUTES` array (e.g. for `/login`, `/register`). Add the public scoreboard pattern.

- [ ] **Step 1: Read current __root.tsx**

```sh
cat frontend/src/routes/__root.tsx
```

- [ ] **Step 2: Add scoreboard pattern**

In the `NO_SHELL_ROUTES` array (or whatever the existing constant is named), add a check that matches `/matches/:publicId/scoreboard`. The simplest implementation is a regex on `location.pathname`. Concrete edit:

If the file uses an array of literals + a `startsWith` / `includes` check, change the test to:

```ts
const noShell =
  NO_SHELL_ROUTES.some((p) => pathname.startsWith(p)) ||
  /^\/matches\/[^/]+\/scoreboard$/.test(pathname)
```

The implementer should adapt to the file's existing pattern. If unsure, paste the diff back for review before committing.

- [ ] **Step 3: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/routes/__root.tsx
git commit -m "feat(frontend): hide app shell on /matches/:publicId/scoreboard"
```

---

## Task 2: MatchDetailHero Component

**Files:**
- Create: `frontend/src/features/matches/MatchDetailHero.tsx`

Big top section: team names, current/final score, live badge if in_progress, completed games breakdown.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/matches/MatchDetailHero.tsx
import { Trophy } from 'lucide-react'
import { cn } from '../../lib/cn'
import { GameHistoryBar } from '../scoring/GameHistoryBar'
import type { Match } from '../scoring/types'

export interface MatchDetailHeroProps {
  match: Match
}

export function MatchDetailHero({ match }: MatchDetailHeroProps) {
  const isLive = match.status === 'in_progress'
  const isCompleted = match.status === 'completed'
  const winnerTeamId = match.winner_team_id ?? null

  return (
    <header className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs text-(--color-text-muted) uppercase tracking-wide">
          {match.tournament_name ?? (match.is_quick_match ? 'Quick match' : 'Match')}
          {match.division_name ? ` · ${match.division_name}` : ''}
          {match.court_name ? ` · ${match.court_name}` : ''}
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-(--color-error) text-white text-xs font-bold uppercase">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live
          </span>
        )}
        {isCompleted && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--color-success) text-white text-xs font-medium uppercase">
            Final
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        <TeamBlock match={match} team={1} winner={winnerTeamId === match.team_1?.id} />
        <div className="text-center">
          <div className="text-5xl md:text-7xl font-extrabold tabular-nums text-(--color-text-primary)">
            {match.team_1_score} – {match.team_2_score}
          </div>
          <div className="text-xs text-(--color-text-muted) mt-1">
            Game {match.current_game} of {match.best_of}
          </div>
        </div>
        <TeamBlock match={match} team={2} winner={winnerTeamId === match.team_2?.id} />
      </div>

      <div className="mt-4">
        <GameHistoryBar
          completedGames={match.completed_games}
          bestOf={match.best_of}
          className="justify-center"
        />
      </div>
    </header>
  )
}

function TeamBlock({
  match,
  team,
  winner,
}: {
  match: Match
  team: 1 | 2
  winner: boolean
}) {
  const t = team === 1 ? match.team_1 : match.team_2
  return (
    <div className={cn('flex flex-col items-center text-center', team === 1 ? 'order-first' : 'order-last')}>
      <div className="text-xs text-(--color-text-muted) uppercase">Team {team}</div>
      <div
        className={cn(
          'text-lg md:text-xl font-bold mt-1',
          winner ? 'text-(--color-accent)' : 'text-(--color-text-primary)'
        )}
      >
        {t?.name ?? `Team ${team}`}
      </div>
      {t?.players && t.players.length > 0 && (
        <div className="text-xs text-(--color-text-secondary) mt-1">
          {t.players.map((p) => p.display_name).join(' · ')}
        </div>
      )}
      {winner && (
        <Trophy
          size={14}
          className="text-(--color-accent) mt-1"
          aria-label="Winner"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/matches/MatchDetailHero.tsx
git commit -m "feat(frontend): add MatchDetailHero"
```

---

## Task 3: MatchInfoPanel Component

**Files:**
- Create: `frontend/src/features/matches/MatchInfoPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/matches/MatchInfoPanel.tsx
import { Card } from '../../components/Card'
import { InfoRow } from '../../components/InfoRow'
import type { Match } from '../scoring/types'
import { formatDateTime } from '../../lib/formatters'

export interface MatchInfoPanelProps {
  match: Match
}

export function MatchInfoPanel({ match }: MatchInfoPanelProps) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-3">
        Match Info
      </h2>
      <dl className="space-y-2">
        {match.division_name && (
          <InfoRow label="Division" value={match.division_name} />
        )}
        {match.court_name && (
          <InfoRow label="Court" value={match.court_name} />
        )}
        <InfoRow
          label="Format"
          value={`${match.scoring_type === 'rally' ? 'Rally' : 'Side-out'} · to ${match.points_to_win} win by ${match.win_by} · best of ${match.best_of}`}
        />
        {match.scheduled_at && (
          <InfoRow label="Scheduled" value={formatDateTime(match.scheduled_at)} />
        )}
        {match.started_at && (
          <InfoRow label="Started" value={formatDateTime(match.started_at)} />
        )}
        {match.completed_at && (
          <InfoRow label="Completed" value={formatDateTime(match.completed_at)} />
        )}
        {match.scored_by_name && (
          <InfoRow label="Scored by" value={match.scored_by_name} />
        )}
        <InfoRow label="Status" value={match.status} />
      </dl>
    </Card>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/matches/MatchInfoPanel.tsx
git commit -m "feat(frontend): add MatchInfoPanel"
```

---

## Task 4: EventsTimeline Component

**Files:**
- Create: `frontend/src/features/scoring/EventsTimeline.tsx`

Reverse-chronological list of MatchEvent rows. Each row: icon, label, summary, timestamp, expandable details. Filter by event type. Sort toggle (newest/oldest).

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/EventsTimeline.tsx
import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Trophy,
  Repeat,
  Pause,
  Play,
  RotateCcw,
  Settings,
  AlertOctagon,
  Award,
  Square,
  ArrowDownLeft,
  Edit3,
  PlayCircle,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import type { EventType, MatchEvent } from './types'

export interface EventsTimelineProps {
  events: MatchEvent[]
  initialOrder?: 'newest' | 'oldest'
  initialCompact?: boolean
}

interface IconSpec {
  Icon: typeof Trophy
  color: string  // a CSS class controlling text color
}

const EVENT_META: Record<EventType, { label: string; icon: IconSpec }> = {
  MATCH_STARTED: { label: 'Match started', icon: { Icon: PlayCircle, color: 'text-(--color-accent)' } },
  POINT_SCORED: { label: 'Point scored', icon: { Icon: Trophy, color: 'text-(--color-success)' } },
  POINT_REMOVED: { label: 'Point removed', icon: { Icon: ArrowDownLeft, color: 'text-(--color-warning)' } },
  SIDE_OUT: { label: 'Side out', icon: { Icon: Repeat, color: 'text-(--color-text-secondary)' } },
  GAME_COMPLETE: { label: 'Game complete', icon: { Icon: Award, color: 'text-(--color-accent)' } },
  MATCH_COMPLETE: { label: 'Match complete', icon: { Icon: Award, color: 'text-(--color-accent)' } },
  TIMEOUT_CALLED: { label: 'Timeout called', icon: { Icon: Pause, color: 'text-(--color-warning)' } },
  TIMEOUT_ENDED: { label: 'Timeout ended', icon: { Icon: Play, color: 'text-(--color-text-secondary)' } },
  END_CHANGE: { label: 'End change', icon: { Icon: Repeat, color: 'text-(--color-text-secondary)' } },
  SUBSTITUTION: { label: 'Substitution', icon: { Icon: Repeat, color: 'text-(--color-text-secondary)' } },
  MATCH_RESET: { label: 'Match reset', icon: { Icon: RotateCcw, color: 'text-(--color-warning)' } },
  MATCH_CONFIGURED: { label: 'Match configured', icon: { Icon: Settings, color: 'text-(--color-text-secondary)' } },
  SCORE_OVERRIDE: { label: 'Score override', icon: { Icon: Edit3, color: 'text-(--color-warning)' } },
  FORFEIT_DECLARED: { label: 'Forfeit declared', icon: { Icon: AlertOctagon, color: 'text-(--color-error)' } },
  MATCH_PAUSED: { label: 'Match paused', icon: { Icon: Pause, color: 'text-(--color-warning)' } },
  MATCH_RESUMED: { label: 'Match resumed', icon: { Icon: Play, color: 'text-(--color-text-secondary)' } },
}

function formatEventTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

function summarizeEvent(e: MatchEvent): string {
  const p = e.payload
  switch (e.event_type) {
    case 'POINT_SCORED': {
      const team = (p as { team?: number }).team
      return team ? `Point to team ${team}` : 'Point scored'
    }
    case 'TIMEOUT_CALLED': {
      const team = (p as { team?: number }).team
      return team ? `Team ${team} timeout` : 'Timeout'
    }
    case 'SCORE_OVERRIDE': {
      const reason = (p as { reason?: string }).reason
      return reason ? `Override: ${reason}` : 'Score override'
    }
    case 'FORFEIT_DECLARED': {
      const team = (p as { forfeiting_team?: number }).forfeiting_team
      return team ? `Team ${team} forfeit` : 'Forfeit'
    }
    default:
      return ''
  }
}

export function EventsTimeline({
  events,
  initialOrder = 'newest',
  initialCompact = false,
}: EventsTimelineProps) {
  const [order, setOrder] = useState<'newest' | 'oldest'>(initialOrder)
  const [compact, setCompact] = useState(initialCompact)
  const [filter, setFilter] = useState<Set<EventType>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    const sorted = [...events].sort((a, b) =>
      order === 'newest' ? b.sequence_id - a.sequence_id : a.sequence_id - b.sequence_id
    )
    if (filter.size === 0) return sorted
    return sorted.filter((e) => filter.has(e.event_type))
  }, [events, order, filter])

  const allTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.event_type))),
    [events]
  )

  function toggleType(t: EventType) {
    setFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary)">
      <header className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-(--color-border)">
        <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide">
          Events
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
            className="px-2 py-1 rounded border border-(--color-border) text-(--color-text-primary) hover:bg-(--color-bg-hover)"
          >
            {order === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
          <button
            type="button"
            onClick={() => setCompact(!compact)}
            className="px-2 py-1 rounded border border-(--color-border) text-(--color-text-primary) hover:bg-(--color-bg-hover)"
          >
            {compact ? 'Detailed' : 'Compact'}
          </button>
        </div>
      </header>

      {allTypes.length > 1 && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-(--color-border)">
          {allTypes.map((t) => {
            const meta = EVENT_META[t]
            const active = filter.has(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  active
                    ? 'bg-(--color-accent) text-white'
                    : 'bg-(--color-bg-hover) text-(--color-text-secondary)'
                )}
                aria-pressed={active}
              >
                {meta?.label ?? t}
              </button>
            )
          })}
          {filter.size > 0 && (
            <button
              type="button"
              onClick={() => setFilter(new Set())}
              className="px-2 py-0.5 rounded-full text-xs underline text-(--color-text-secondary)"
            >
              clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-4 text-center text-(--color-text-secondary)">
          No events to display.
        </div>
      ) : (
        <ul className="divide-y divide-(--color-border)">
          {filtered.map((e) => {
            const meta = EVENT_META[e.event_type]
            const isOpen = expanded.has(e.id)
            const Icon = meta?.icon.Icon ?? Square
            const summary = summarizeEvent(e)
            return (
              <li key={e.id} className="p-3">
                <button
                  type="button"
                  onClick={() => !compact && toggleExpanded(e.id)}
                  className="w-full flex items-start gap-3 text-left"
                  aria-expanded={isOpen}
                  aria-disabled={compact}
                >
                  <span className={cn('shrink-0 mt-0.5', meta?.icon.color ?? 'text-(--color-text-secondary)')}>
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-(--color-text-primary)">
                        {meta?.label ?? e.event_type}
                      </span>
                      <span className="text-xs text-(--color-text-muted) tabular-nums">
                        {formatEventTime(e.timestamp)}
                      </span>
                    </span>
                    {summary && (
                      <span className="block text-xs text-(--color-text-secondary) mt-0.5">
                        {summary}
                      </span>
                    )}
                  </span>
                  {!compact && (
                    <span className="shrink-0 text-(--color-text-muted) mt-1">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  )}
                </button>
                {!compact && isOpen && (
                  <div className="mt-2 ml-7 text-xs">
                    <details>
                      <summary className="cursor-pointer text-(--color-text-secondary)">
                        Payload
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-(--color-bg-primary) overflow-auto text-(--color-text-primary)">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                    {e.score_snapshot && Object.keys(e.score_snapshot).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-(--color-text-secondary)">
                          Score snapshot
                        </summary>
                        <pre className="mt-1 p-2 rounded bg-(--color-bg-primary) overflow-auto text-(--color-text-primary)">
                          {JSON.stringify(e.score_snapshot, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/EventsTimeline.tsx
git commit -m "feat(frontend): add EventsTimeline (filterable, expandable)"
```

---

## Task 5: MatchDetail Component

**Files:**
- Create: `frontend/src/features/matches/MatchDetail.tsx`

Public match detail page. Subscribes to WebSocket. Shows hero, info panel, both team rosters, events timeline (collapsible). Score override button (role-gated) is added in Phase 3E — for 3C just leave a placeholder if the user is admin.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/matches/MatchDetail.tsx
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Skeleton } from '../../components/Skeleton'
import { AdSlot } from '../../components/AdSlot'
import { useMatch, useMatchEvents } from '../scoring/hooks'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'
import { EventsTimeline } from '../scoring/EventsTimeline'
import { MatchDetailHero } from './MatchDetailHero'
import { MatchInfoPanel } from './MatchInfoPanel'

export interface MatchDetailProps {
  publicId: string
}

export function MatchDetail({ publicId }: MatchDetailProps) {
  // Public route — auth optional. WS still works without auth (server allows anonymous read).
  useMatchWebSocket(publicId)
  const matchQuery = useMatch(publicId)
  const eventsQuery = useMatchEvents(publicId)
  const [showEvents, setShowEvents] = useState(false)

  if (matchQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="h-40" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="max-w-5xl mx-auto p-4 text-(--color-error)">
        Match not found.
      </div>
    )
  }

  const match = matchQuery.data

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <MatchDetailHero match={match} />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-3">
              Rosters
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <RosterColumn label={match.team_1?.name ?? 'Team 1'} players={match.team_1?.players ?? []} />
              <RosterColumn label={match.team_2?.name ?? 'Team 2'} players={match.team_2?.players ?? []} />
            </div>
          </Card>

          {match.completed_games.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-3">
                Games
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-(--color-text-muted) text-xs uppercase">
                    <th className="text-left py-1">Game</th>
                    <th className="text-right py-1">{match.team_1?.short_name ?? 'T1'}</th>
                    <th className="text-right py-1">{match.team_2?.short_name ?? 'T2'}</th>
                    <th className="text-right py-1">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {match.completed_games.map((g) => (
                    <tr key={g.game_number} className="border-t border-(--color-border)">
                      <td className="py-1.5 text-(--color-text-primary)">
                        Game {g.game_number}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-(--color-text-primary)">
                        {g.team_1_score}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-(--color-text-primary)">
                        {g.team_2_score}
                      </td>
                      <td className="py-1.5 text-right text-(--color-accent)">
                        T{g.winner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <MatchInfoPanel match={match} />
        </div>
      </div>

      <AdSlot size="medium-rectangle" />

      <details
        open={showEvents}
        onToggle={(e) => setShowEvents((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary)"
      >
        <summary className="cursor-pointer p-3 text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide">
          Event log {eventsQuery.data ? `(${eventsQuery.data.length})` : ''}
        </summary>
        {eventsQuery.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-4 mb-2" />
            <Skeleton className="h-4 mb-2" />
            <Skeleton className="h-4" />
          </div>
        ) : eventsQuery.isError ? (
          <div className="p-4 text-(--color-error)">Failed to load events.</div>
        ) : (
          <EventsTimeline events={eventsQuery.data ?? []} />
        )}
      </details>
    </div>
  )
}

function RosterColumn({ label, players }: { label: string; players: { id: number; display_name: string }[] }) {
  return (
    <div>
      <div className="text-xs text-(--color-text-muted) uppercase mb-1">{label}</div>
      {players.length === 0 ? (
        <div className="text-xs text-(--color-text-muted)">—</div>
      ) : (
        <ul className="text-sm text-(--color-text-primary) space-y-0.5">
          {players.map((p) => (
            <li key={p.id}>{p.display_name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/matches/MatchDetail.tsx
git commit -m "feat(frontend): add MatchDetail page"
```

---

## Task 6: MatchScoreboardPage Component (transparent)

**Files:**
- Create: `frontend/src/features/matches/MatchScoreboardPage.tsx`

Transparent body for OBS / TVs. No header, no nav, no chrome. Just the score.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/matches/MatchScoreboardPage.tsx
import { useEffect } from 'react'
import { ScoreCall } from '../scoring/ScoreCall'
import { GameHistoryBar } from '../scoring/GameHistoryBar'
import { ServeIndicator } from '../scoring/ServeIndicator'
import { useMatch } from '../scoring/hooks'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'

export interface MatchScoreboardPageProps {
  publicId: string
}

export function MatchScoreboardPage({ publicId }: MatchScoreboardPageProps) {
  useMatchWebSocket(publicId)
  const matchQuery = useMatch(publicId)

  // Make body transparent for OBS chroma-free overlay
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return () => {
      document.body.style.background = prev
    }
  }, [])

  if (matchQuery.isLoading) {
    return null  // Render nothing while loading on a TV display
  }
  if (matchQuery.isError || !matchQuery.data) {
    return null
  }

  const match = matchQuery.data

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="bg-black/80 text-white rounded-2xl p-6 md:p-10 backdrop-blur shadow-2xl max-w-3xl w-full">
        <div className="text-center text-xs uppercase tracking-widest text-white/60 mb-2">
          {match.tournament_name ?? 'Match'}
          {match.division_name ? ` · ${match.division_name}` : ''}
          {match.court_name ? ` · ${match.court_name}` : ''}
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <TeamSide team={1} match={match} />
          <div className="text-center">
            <div className="text-7xl md:text-8xl font-extrabold tabular-nums">
              {match.team_1_score} – {match.team_2_score}
            </div>
            <div className="text-sm text-white/70 mt-1">
              Game {match.current_game} of {match.best_of}
            </div>
          </div>
          <TeamSide team={2} match={match} />
        </div>

        <div className="mt-4 flex justify-center">
          <GameHistoryBar
            completedGames={match.completed_games}
            bestOf={match.best_of}
          />
        </div>

        <div className="mt-3 flex justify-center">
          <ScoreCall match={match} />
        </div>
      </div>
    </div>
  )
}

function TeamSide({ team, match }: { team: 1 | 2; match: ReturnType<typeof useMatch>['data'] & object }) {
  const t = team === 1 ? match.team_1 : match.team_2
  const serving = match.serving_team === team
  return (
    <div className={team === 1 ? 'text-right' : 'text-left'}>
      <div className="text-xs uppercase text-white/60">Team {team}</div>
      <div className="text-2xl md:text-3xl font-bold flex items-center gap-2 justify-end">
        {team === 2 && (
          <ServeIndicator active={serving} serverNumber={serving ? match.server_number ?? 1 : null} size="lg" />
        )}
        <span>{t?.name ?? `Team ${team}`}</span>
        {team === 1 && (
          <ServeIndicator active={serving} serverNumber={serving ? match.server_number ?? 1 : null} size="lg" />
        )}
      </div>
    </div>
  )
}
```

NOTE: The `TeamSide` prop type uses `ReturnType<typeof useMatch>['data'] & object` to extract the Match type without re-importing. If TypeScript complains, change to `match: import('../scoring/types').Match`.

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/matches/MatchScoreboardPage.tsx
git commit -m "feat(frontend): add MatchScoreboardPage (transparent, OBS-friendly)"
```

---

## Task 7: MatchSeriesDetail Component

**Files:**
- Create: `frontend/src/features/match-series/MatchSeriesDetail.tsx`

Read-only. Header showing series score, list of constituent matches with Score links to ref console for in_progress / scheduled, plain link for completed.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/match-series/MatchSeriesDetail.tsx
import { Link } from '@tanstack/react-router'
import { Skeleton } from '../../components/Skeleton'
import { Card } from '../../components/Card'
import { useMatchSeries } from '../scoring/hooks'

export interface MatchSeriesDetailProps {
  publicId: string
}

export function MatchSeriesDetail({ publicId }: MatchSeriesDetailProps) {
  const seriesQuery = useMatchSeries(publicId)

  if (seriesQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-16 mb-2" />
        <Skeleton className="h-16 mb-2" />
        <Skeleton className="h-16" />
      </div>
    )
  }
  if (seriesQuery.isError || !seriesQuery.data) {
    return <div className="max-w-3xl mx-auto p-4 text-(--color-error)">Series not found.</div>
  }

  const s = seriesQuery.data

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Card className="p-6">
        <div className="text-xs uppercase text-(--color-text-muted) mb-2">Match series</div>
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-(--color-text-muted)">Team 1</div>
            <div className="text-lg font-bold text-(--color-text-primary)">
              {s.team1?.name ?? 'Team 1'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-5xl font-extrabold tabular-nums text-(--color-text-primary)">
              {s.team1_wins} – {s.team2_wins}
            </div>
            <div className="text-xs text-(--color-text-muted) mt-1">
              First to {s.games_to_win} · {s.status}
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-(--color-text-muted)">Team 2</div>
            <div className="text-lg font-bold text-(--color-text-primary)">
              {s.team2?.name ?? 'Team 2'}
            </div>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
          Matches in this series
        </h2>
        {s.matches.length === 0 ? (
          <div className="text-(--color-text-secondary) text-sm">
            No matches yet.
          </div>
        ) : (
          <div className="space-y-2">
            {s.matches.map((m) => (
              <Link
                key={m.public_id}
                to={`/matches/${m.public_id}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) rounded"
              >
                <Card className="flex items-center justify-between p-3 hover:bg-(--color-bg-hover) transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm text-(--color-text-primary) truncate">
                      {m.team_1?.name ?? 'Team 1'} vs {m.team_2?.name ?? 'Team 2'}
                    </div>
                    <div className="text-xs text-(--color-text-muted)">
                      {m.status === 'in_progress'
                        ? `${m.team_1_score}–${m.team_2_score} · G${m.current_game}`
                        : m.status === 'completed'
                          ? `Final ${m.team_1_score}–${m.team_2_score}`
                          : m.status}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/match-series/MatchSeriesDetail.tsx
git commit -m "feat(frontend): add MatchSeriesDetail (read-only)"
```

---

## Task 8: Route Files

**Files:**
- Create: `frontend/src/routes/matches/$publicId.tsx`
- Create: `frontend/src/routes/matches/$publicId.scoreboard.tsx`
- Create: `frontend/src/routes/match-series/$publicId.tsx`

- [ ] **Step 1: Create `matches/$publicId.tsx`**

```tsx
// frontend/src/routes/matches/$publicId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { MatchDetail } from '../../features/matches/MatchDetail'

export const Route = createFileRoute('/matches/$publicId')({
  component: function MatchDetailPage() {
    const { publicId } = Route.useParams()
    return <MatchDetail publicId={publicId} />
  },
})
```

- [ ] **Step 2: Create `matches/$publicId.scoreboard.tsx`**

```tsx
// frontend/src/routes/matches/$publicId.scoreboard.tsx
import { createFileRoute } from '@tanstack/react-router'
import { MatchScoreboardPage } from '../../features/matches/MatchScoreboardPage'

export const Route = createFileRoute('/matches/$publicId/scoreboard')({
  component: function ScoreboardRoute() {
    const { publicId } = Route.useParams()
    return <MatchScoreboardPage publicId={publicId} />
  },
})
```

- [ ] **Step 3: Create `match-series/$publicId.tsx`**

```tsx
// frontend/src/routes/match-series/$publicId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { MatchSeriesDetail } from '../../features/match-series/MatchSeriesDetail'

export const Route = createFileRoute('/match-series/$publicId')({
  component: function MatchSeriesRoute() {
    const { publicId } = Route.useParams()
    return <MatchSeriesDetail publicId={publicId} />
  },
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
git add frontend/src/routes/matches/ frontend/src/routes/match-series/ frontend/src/routeTree.gen.ts
git commit -m "feat(frontend): add match detail, scoreboard, and series routes"
```

---

## Task 9: Manual Smoke Test + Final Verification

- [ ] **Step 1: Start backend + frontend**

```sh
make dev
cd frontend && pnpm dev
```

- [ ] **Step 2: Smoke test**

1. Find an in_progress match's public_id (e.g., from a tournament hub or via DB).
2. Visit `/matches/<publicId>` (logged out works too) — hero, info, rosters, events all render.
3. Open the same match in the ref console in another tab. Score a point. The match detail page updates live.
4. Visit `/matches/<publicId>/scoreboard` — page is transparent, only the scoreboard card visible. No app shell.
5. If you have a match-series, visit `/match-series/<publicId>` — series + match list renders. Click a match → match detail.
6. Click "Event log" details — events expand. Filter by type — list narrows. Toggle Compact — payload sections hide.

- [ ] **Step 3: Final verification**

```sh
cd frontend
pnpm tsc -b --noEmit
pnpm build
git push origin main:V2
```

---

## Self-Review Checklist

- [ ] All 5 component files + 3 route files created
- [ ] `__root.tsx` no-shell logic includes the scoreboard pattern
- [ ] Body background restoration on scoreboard unmount (no leaked transparency on other pages)
- [ ] No `@/` aliases
- [ ] No swallowed errors
- [ ] TanStack Router types satisfied (no `as any`)
- [ ] Build passes

When DONE, report:
- Commit SHAs
- Smoke test results
- `pnpm build` output line
- Any deviations
