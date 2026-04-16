import { createFileRoute } from '@tanstack/react-router'
import { VenueForm } from '../../features/registry/venues/VenueForm'
import { useVenue } from '../../features/registry/venues/hooks'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'

export const Route = createFileRoute('/venues/$venueId_/edit')({
  component: VenueEditPage,
})

function VenueEditPage() {
  const { venueId } = Route.useParams()
  const { data: venue, isLoading, error } = useVenue(venueId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !venue) {
    return (
      <EmptyState
        title="Venue not found"
        description="This venue may have been removed or you don't have access."
      />
    )
  }

  return <VenueForm venue={venue} />
}
