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
          winner ? 'text-(--color-accent)' : 'text-(--color-text-primary)',
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
