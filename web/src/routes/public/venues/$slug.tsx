import { createFileRoute } from '@tanstack/react-router'
import { PublicVenueDetail } from '../../../features/public/PublicVenueDetail'

export const Route = createFileRoute('/public/venues/$slug')({
  component: VenueDetailRoute,
})

function VenueDetailRoute() {
  const { slug } = Route.useParams()
  return <PublicVenueDetail slug={slug} />
}
