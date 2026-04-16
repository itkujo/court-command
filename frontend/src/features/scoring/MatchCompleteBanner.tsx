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
    <div className="rounded-xl bg-green-600 text-white p-6 flex flex-col items-center gap-3 text-center">
      <Trophy size={40} />
      <div className="text-2xl font-bold">Match Complete</div>
      {winnerName ? (
        <div className="text-lg">{winnerName} wins</div>
      ) : (
        <div className="text-lg">
          Final: {match.team_1_score} – {match.team_2_score}
        </div>
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
