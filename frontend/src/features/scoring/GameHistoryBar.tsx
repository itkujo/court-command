// frontend/src/features/scoring/GameHistoryBar.tsx
import { cn } from '../../lib/cn'
import type { CompletedGame } from './types'

export interface GameHistoryBarProps {
  completedGames: CompletedGame[]
  bestOf?: number
  className?: string
}

export function GameHistoryBar({
  completedGames,
  bestOf,
  className,
}: GameHistoryBarProps) {
  if (completedGames.length === 0) {
    return (
      <div
        className={cn(
          'text-xs text-(--color-text-muted) uppercase tracking-wide',
          className,
        )}
      >
        Game 1
      </div>
    )
  }
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {completedGames.map((g) => (
        <span
          key={g.game_num}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-(--color-bg-secondary) text-(--color-text-primary)"
          aria-label={`Game ${g.game_num} final: ${g.team_one_score}-${g.team_two_score}, team ${g.winner} won`}
        >
          <span className="text-(--color-text-muted)">G{g.game_num}</span>
          <span
            className={
              g.winner === 1
                ? 'font-bold text-(--color-accent)'
                : 'text-(--color-text-primary)'
            }
          >
            {g.team_one_score}
          </span>
          <span className="text-(--color-text-muted)">–</span>
          <span
            className={
              g.winner === 2
                ? 'font-bold text-(--color-accent)'
                : 'text-(--color-text-primary)'
            }
          >
            {g.team_two_score}
          </span>
        </span>
      ))}
      {bestOf ? (
        <span className="text-xs text-(--color-text-muted)">
          Best of {bestOf}
        </span>
      ) : null}
    </div>
  )
}
