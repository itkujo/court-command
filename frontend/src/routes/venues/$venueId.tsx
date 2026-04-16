import { createFileRoute } from '@tanstack/react-router'
import { VenueDetail } from '../../features/registry/venues/VenueDetail'

export const Route = createFileRoute('/venues/$venueId')({
  component: VenueDetailPage,
})

function VenueDetailPage() {
  const { venueId } = Route.useParams()
  return <VenueDetail venueId={venueId} />
}
