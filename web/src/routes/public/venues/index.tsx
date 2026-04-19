import { createFileRoute } from '@tanstack/react-router'
import { VenueDirectory } from '../../../features/public/VenueDirectory'

export const Route = createFileRoute('/public/venues/')({
  component: VenueDirectory,
})
