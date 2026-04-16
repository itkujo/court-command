// frontend/src/features/overlay/monitor/CourtMonitorCard.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ExternalLink,
  Flame,
  Radio,
  Scale,
  Settings,
  Tv,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Badge } from '../../../components/Badge'
import type { CourtSummary, Match } from '../../scoring/types'
import { useOverlayWebSocket } from '../useOverlayWebSocket'

interface Props {
  court: CourtSummary
}

/**
 * Card-sized view of a single court for the Producer Monitor grid.
 *
 * Subscribes to the overlay + court WebSocket channels so the score
 * and heat badges stay fresh without polling.
 */
export function CourtMonitorCard({ court }: Props) {
  const active = court.active_match ?? null
  const onDeck = court.on_deck_match ?? null

  const { state, lastMessageAt } = useOverlayWebSocket(court.id, {
    enabled: true,
    matchPublicID: active?.public_id ?? null,
  })

  const heat = classifyHeat(active)

  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-4 flex flex-col gap-3 min-h-[220px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-(--color-text-primary) font-semibold truncate">
            <Tv className="h-4 w-4 shrink-0 text-(--color-accent)" aria-hidden="true" />
            <span className="truncate">{court.name}</span>
            {court.is_show_court && (
              <Badge variant="info" className="shrink-0">
                Show
              </Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-(--color-text-muted) font-mono truncate">
            {court.slug}
          </div>
        </div>

        <LiveIndicator state={state} lastMessageAt={lastMessageAt} />
      </div>

      {active ? (
        <ActiveMatchBlock match={active} heat={heat} />
      ) : (
        <IdleBlock onDeck={onDeck} />
      )}

      <div className="mt-auto flex items-center gap-2 pt-2 border-t border-(--color-border)">
        <Link
          to="/overlay/court/$slug/settings"
          params={{ slug: court.slug }}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-(--color-bg-secondary) text-(--color-text-primary) border border-(--color-border) hover:bg-(--color-bg-hover) transition-colors"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          Control panel
        </Link>
        <Link
          to="/overlay/court/$slug"
          params={{ slug: court.slug }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open OBS view"
          title="Open OBS view"
          className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary) transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

// --- Heat classification (MP / DEUCE / CLOSE) ---

type Heat = 'match_point' | 'deuce' | 'close' | 'none'

function classifyHeat(m: Match | null): Heat {
  if (!m) return 'none'
  if (m.status !== 'in_progress' && m.status !== 'paused') return 'none'
  const a = m.team_1_score
  const b = m.team_2_score
  const max = Math.max(a, b)
  const diff = Math.abs(a - b)
  const pointsToWin = m.points_to_win ?? 11
  const winBy = m.win_by ?? 2

  if (max >= pointsToWin - 1 && diff >= winBy) return 'match_point'
  if (a === b && a >= pointsToWin - 1) return 'deuce'
  if (diff <= 2 && max >= Math.max(1, pointsToWin - 5)) return 'close'
  return 'none'
}

function HeatBadge({ heat }: { heat: Heat }) {
  if (heat === 'none') return null
  const meta = {
    match_point: {
      label: 'MATCH POINT',
      variant: 'error' as const,
      icon: <Flame className="h-3 w-3" aria-hidden="true" />,
    },
    deuce: {
      label: 'DEUCE',
      variant: 'warning' as const,
      icon: <Scale className="h-3 w-3" aria-hidden="true" />,
    },
    close: {
      label: 'CLOSE',
      variant: 'info' as const,
      icon: <Radio className="h-3 w-3" aria-hidden="true" />,
    },
  }[heat]
  return (
    <Badge variant={meta.variant}>
      <span className="inline-flex items-center gap-1">
        {meta.icon}
        {meta.label}
      </span>
    </Badge>
  )
}

// --- Match content blocks ---

function ActiveMatchBlock({ match, heat }: { match: Match; heat: Heat }) {
  const t1 = match.team_1?.name ?? match.team_1?.short_name ?? 'Team 1'
  const t2 = match.team_2?.name ?? match.team_2?.short_name ?? 'Team 2'
  const serving = match.serving_team

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-muted)">
        <span className="truncate">
          {match.tournament_name || match.division_name || 'Standalone match'}
        </span>
        <span className="font-mono shrink-0">
          G{match.current_game}
          {match.best_of > 1 ? ` / ${match.best_of}` : ''}
        </span>
      </div>

      <TeamRow
        name={t1}
        score={match.team_1_score}
        games={match.team_1_games_won}
        serving={serving === 1}
      />
      <TeamRow
        name={t2}
        score={match.team_2_score}
        games={match.team_2_games_won}
        serving={serving === 2}
      />

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          <Badge
            variant={match.status === 'paused' ? 'warning' : 'success'}
          >
            {match.status === 'paused' ? 'Paused' : 'Live'}
          </Badge>
          <HeatBadge heat={heat} />
        </div>
        <span className="text-[10px] uppercase tracking-wide text-(--color-text-muted)">
          {match.scoring_type === 'rally' ? 'Rally' : 'Side-out'}
        </span>
      </div>
    </div>
  )
}

function TeamRow({
  name,
  score,
  games,
  serving,
}: {
  name: string
  score: number
  games: number
  serving: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`h-2 w-2 rounded-full ${serving ? 'bg-(--color-accent)' : 'bg-transparent'}`}
          aria-hidden="true"
        />
        <span className="truncate text-(--color-text-primary)">{name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {games > 0 && (
          <span className="text-xs font-mono text-(--color-text-muted)">
            {games} pts
          </span>
        )}
        <span className="text-xl font-semibold font-mono text-(--color-text-primary) tabular-nums min-w-[2ch] text-right">
          {score}
        </span>
      </div>
    </div>
  )
}

function IdleBlock({ onDeck }: { onDeck: Match | null }) {
  if (!onDeck) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-4 text-sm text-(--color-text-muted)">
        No active match
      </div>
    )
  }
  const t1 = onDeck.team_1?.name ?? 'Team 1'
  const t2 = onDeck.team_2?.name ?? 'Team 2'
  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="text-xs uppercase tracking-wide text-(--color-text-muted)">
        On deck
      </div>
      <div className="text-sm text-(--color-text-primary)">
        {t1} <span className="text-(--color-text-muted)">vs</span> {t2}
      </div>
      <div className="text-xs text-(--color-text-muted)">
        {onDeck.tournament_name ||
          onDeck.division_name ||
          'Standalone match'}
      </div>
    </div>
  )
}

// --- Live indicator (WS ping) ---

function LiveIndicator({
  state,
  lastMessageAt,
}: {
  state: 'connecting' | 'open' | 'disconnected'
  lastMessageAt: number | null
}) {
  const [now, setNow] = useState(() => Date.now())

  // Re-render every 2s only so the relative age stays readable.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 2000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (state === 'disconnected') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-(--color-error)"
        title="WebSocket disconnected"
      >
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
        Offline
      </span>
    )
  }

  if (state === 'connecting') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-(--color-text-muted)"
        title="WebSocket connecting"
      >
        <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
        Connecting
      </span>
    )
  }

  const ageMs = lastMessageAt ? now - lastMessageAt : null
  const label = ageMs == null ? 'Live' : formatAge(ageMs)

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-(--color-success)"
      title={
        lastMessageAt
          ? `Last message ${new Date(lastMessageAt).toLocaleTimeString()}`
          : 'Connected (no messages yet)'
      }
    >
      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function formatAge(ms: number): string {
  if (ms < 2000) return 'Live'
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  return `${Math.floor(ms / 3_600_000)}h`
}
