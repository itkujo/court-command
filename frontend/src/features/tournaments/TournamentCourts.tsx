import { Link } from '@tanstack/react-router'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { CourtGrid } from '../referee/CourtGrid'
import { useCourtsForTournament } from '../scoring/hooks'

export interface TournamentCourtsProps {
  tournamentId: number
}

export function TournamentCourts({ tournamentId }: TournamentCourtsProps) {
  const courts = useCourtsForTournament(tournamentId)

  if (courts.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  if (courts.isError) {
    return (
      <div className="text-(--color-error) text-sm">
        Failed to load courts.
      </div>
    )
  }

  const list = courts.data ?? []

  if (list.length === 0) {
    return (
      <EmptyState
        title="No courts assigned"
        description="When matches are assigned to courts they will appear here."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--color-text-secondary)">
          {list.length} court{list.length === 1 ? '' : 's'} · tap a card to open the referee console
        </p>
        <Link
          to="/ref"
          className="text-sm text-(--color-accent) hover:underline"
        >
          Open Ref Home →
        </Link>
      </div>
      <CourtGrid courts={list} mode="ref" />
    </div>
  )
}
