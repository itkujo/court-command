import { createFileRoute } from '@tanstack/react-router'
import { VenueList } from '../../features/registry/venues/VenueList'

export const Route = createFileRoute('/venues/')({
  component: VenueList,
})
