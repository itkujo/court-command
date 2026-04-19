// web/src/features/matches/MatchInfoPanel.tsx
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
        <InfoRow label="Status" value={match.status} />
      </dl>
    </Card>
  )
}
