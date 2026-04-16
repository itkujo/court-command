// frontend/src/features/scoring/ScoreCall.tsx
import type { Match } from './types'

export interface ScoreCallProps {
  match: Match
}

/**
 * Renders the prominent score call:
 * - side_out: "{servingScore} · {receivingScore} · {serverNumber}"
 * - rally:    "{team1Score} · {team2Score}"
 * Returned as a single, screen-reader-friendly element with aria-live.
 */
export function ScoreCall({ match }: ScoreCallProps) {
  let text: string
  let label: string

  if (match.scoring_type === 'side_out' && match.serving_team) {
    const servingScore =
      match.serving_team === 1 ? match.team_1_score : match.team_2_score
    const receivingScore =
      match.serving_team === 1 ? match.team_2_score : match.team_1_score
    const server = match.server_number ?? 1
    text = `${servingScore} · ${receivingScore} · ${server}`
    label = `Score: ${servingScore} ${receivingScore} ${server}`
  } else {
    text = `${match.team_1_score} · ${match.team_2_score}`
    label = `Score: ${match.team_1_score} to ${match.team_2_score}`
  }

  return (
    <div
      className="text-3xl md:text-4xl font-bold tracking-wider text-center text-(--color-text-primary) tabular-nums"
      aria-live="polite"
      aria-label={label}
    >
      {text}
    </div>
  )
}
