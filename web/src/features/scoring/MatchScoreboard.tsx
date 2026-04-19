// web/src/features/scoring/MatchScoreboard.tsx
import { useEffect, useState } from 'react'
import { Undo2, MoreVertical, Pause as PauseIcon } from 'lucide-react'
import { Button } from '../../components/Button'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { ScoreCall } from './ScoreCall'
import { ScoringButtons } from './ScoringButtons'
import { ServeIndicator } from './ServeIndicator'
import { GameHistoryBar } from './GameHistoryBar'
import { TimeoutBadge } from './TimeoutBadge'
import type { Match } from './types'

export interface MatchScoreboardProps {
  match: Match
  mode: 'ref' | 'scorekeeper'
  disabled?: boolean
  pending?: boolean
  onPoint: (team?: 1 | 2) => void
  onSideOut: () => void
  onUndo: () => void
  onTimeout: (team: 1 | 2) => void
  onMenu?: () => void
}

function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    () => {
      if (typeof window === 'undefined') return 'portrait'
      return window.matchMedia('(orientation: landscape)').matches
        ? 'landscape'
        : 'portrait'
    },
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'landscape' : 'portrait')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return orientation
}

export function MatchScoreboard(props: MatchScoreboardProps) {
  const isMobile = useIsMobile()
  const orientation = useOrientation()
  // Tablet landscape uses split layout; phone always uses stacked
  const useLandscape = !isMobile && orientation === 'landscape'

  return useLandscape ? (
    <LandscapeLayout {...props} />
  ) : (
    <PortraitLayout {...props} />
  )
}

function MatchHeader({ match, onMenu }: { match: Match; onMenu?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="text-xs text-(--color-text-secondary) leading-tight">
        {match.division_name ? <div>{match.division_name}</div> : null}
        {match.court_name ? (
          <div className="text-(--color-text-muted)">{match.court_name}</div>
        ) : null}
      </div>
      {onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Match menu"
          className="p-2 rounded text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
        >
          <MoreVertical size={20} />
        </button>
      ) : null}
    </div>
  )
}

function TeamRow({
  match,
  team,
  serving,
}: {
  match: Match
  team: 1 | 2
  serving: boolean
}) {
  const t = team === 1 ? match.team_1 : match.team_2
  const score = team === 1 ? match.team_1_score : match.team_2_score
  const used =
    team === 1 ? match.team_1_timeouts_used : match.team_2_timeouts_used
  const total = match.timeouts_per_game

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-4 rounded-lg border-2',
        serving
          ? 'border-(--color-accent) bg-(--color-bg-secondary)'
          : 'border-(--color-border) bg-(--color-bg-secondary)',
      )}
      data-team={team}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ServeIndicator
          active={serving}
          serverNumber={serving ? (match.server_number ?? 1) : null}
          ariaLabel={
            serving
              ? `Serving, server ${match.server_number ?? 1}`
              : 'Not serving'
          }
        />
        <div className="min-w-0">
          <div className="text-xs text-(--color-text-muted) uppercase">
            Team {team}
          </div>
          <div className="text-base font-semibold text-(--color-text-primary) truncate">
            {t?.name ?? `Team ${team}`}
          </div>
          <div className="mt-1">
            <TimeoutBadge used={used} total={total} />
          </div>
        </div>
      </div>
      <div
        className="text-5xl md:text-6xl font-extrabold tabular-nums text-(--color-text-primary)"
        aria-label={`Team ${team} score: ${score}`}
      >
        {score}
      </div>
    </div>
  )
}

function PortraitLayout(props: MatchScoreboardProps) {
  const {
    match,
    disabled,
    pending,
    onPoint,
    onSideOut,
    onUndo,
    onTimeout,
    onMenu,
  } = props
  return (
    <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
      <MatchHeader match={match} onMenu={onMenu} />
      <TeamRow match={match} team={1} serving={match.serving_team === 1} />
      <TeamRow match={match} team={2} serving={match.serving_team === 2} />
      <div className="my-1">
        <ScoreCall match={match} />
      </div>
      <ScoringButtons
        match={match}
        disabled={disabled}
        pending={pending}
        onPoint={onPoint}
        onSideOut={onSideOut}
      />
      <div className="flex items-center justify-between gap-2 mt-1">
        <Button
          variant="secondary"
          onClick={onUndo}
          disabled={disabled}
          aria-label="Undo last action"
          className="flex-1"
        >
          <Undo2 size={16} className="mr-1 inline-block" />
          Undo
        </Button>
        <Button
          variant="secondary"
          onClick={() => onTimeout(match.serving_team ?? 1)}
          disabled={disabled || !match.serving_team}
          aria-label="Call timeout"
          className="flex-1"
        >
          <PauseIcon size={16} className="mr-1 inline-block" />
          Timeout
        </Button>
      </div>
      <GameHistoryBar
        completedGames={match.set_scores ?? []}
        bestOf={match.best_of}
        className="mt-2 justify-center"
      />
    </div>
  )
}

function LandscapeLayout(props: MatchScoreboardProps) {
  const {
    match,
    disabled,
    pending,
    onPoint,
    onSideOut,
    onUndo,
    onTimeout,
    onMenu,
  } = props
  return (
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full">
      <MatchHeader match={match} onMenu={onMenu} />
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <TeamRow match={match} team={1} serving={match.serving_team === 1} />
        <div className="flex flex-col gap-3 min-w-[280px]">
          <ScoreCall match={match} />
          <ScoringButtons
            match={match}
            disabled={disabled}
            pending={pending}
            onPoint={onPoint}
            onSideOut={onSideOut}
          />
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={onUndo}
              disabled={disabled}
              aria-label="Undo last action"
            >
              <Undo2 size={16} className="mr-1 inline-block" />
              Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => onTimeout(match.serving_team ?? 1)}
              disabled={disabled || !match.serving_team}
              aria-label="Call timeout"
            >
              <PauseIcon size={16} className="mr-1 inline-block" />
              Timeout
            </Button>
          </div>
        </div>
        <TeamRow match={match} team={2} serving={match.serving_team === 2} />
      </div>
      <GameHistoryBar
        completedGames={match.set_scores ?? []}
        bestOf={match.best_of}
        className="mt-2 justify-center"
      />
    </div>
  )
}
