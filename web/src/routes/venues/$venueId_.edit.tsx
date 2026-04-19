import { createFileRoute, Link } from '@tanstack/react-router'
import { VenueForm } from '../../features/registry/venues/VenueForm'
import { useVenue, useCanManageVenue } from '../../features/registry/venues/hooks'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/Button'

export const Route = createFileRoute('/venues/$venueId_/edit')({
  component: VenueEditPage,
})

function VenueEditPage() {
  const { venueId } = Route.useParams()
  const { data: venue, isLoading, error } = useVenue(venueId)
  const canManageQuery = useCanManageVenue(venueId)

  if (isLoading || canManageQuery.isLoading) {
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

  if (!canManageQuery.data?.can_manage) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permission to edit this venue."
        action={
          <Link to="/venues/$venueId" params={{ venueId }}>
            <Button variant="secondary">Back to Venue</Button>
          </Link>
        }
      />
    )
  }

  return <VenueForm venue={venue} />
}
