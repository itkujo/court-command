// frontend/src/features/scoring/ScoringButtons.tsx
import { Button } from '../../components/Button'
import type { Match } from './types'

export interface ScoringButtonsProps {
  match: Match
  disabled?: boolean
  pending?: boolean
  onPoint: (team?: 1 | 2) => void
  onSideOut: () => void
}

/**
 * Auto-switches between side-out (POINT + SIDE OUT)
 * and rally (POINT TEAM 1 + POINT TEAM 2) layouts.
 */
export function ScoringButtons({
  match,
  disabled,
  pending,
  onPoint,
  onSideOut,
}: ScoringButtonsProps) {
  const isRally = match.scoring_type === 'rally'

  if (isRally) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          size="lg"
          className="h-20 text-lg font-bold"
          disabled={disabled}
          loading={pending}
          onClick={() => onPoint(1)}
        >
          Point {match.team_1?.short_name ?? 'T1'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="h-20 text-lg font-bold"
          disabled={disabled}
          loading={pending}
          onClick={() => onPoint(2)}
        >
          Point {match.team_2?.short_name ?? 'T2'}
        </Button>
      </div>
    )
  }

  // Side-out: single POINT (to serving team) + SIDE OUT
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="primary"
        size="lg"
        className="h-20 text-lg font-bold"
        disabled={disabled || !match.serving_team}
        loading={pending}
        onClick={() => onPoint(match.serving_team as 1 | 2)}
      >
        POINT
      </Button>
      <Button
        variant="danger"
        size="lg"
        className="h-20 text-lg font-bold"
        disabled={disabled || !match.serving_team}
        onClick={onSideOut}
      >
        SIDE OUT
      </Button>
    </div>
  )
}
