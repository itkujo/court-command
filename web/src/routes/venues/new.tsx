import { createFileRoute } from '@tanstack/react-router'
import { VenueForm } from '../../features/registry/venues/VenueForm'

export const Route = createFileRoute('/venues/new')({
  component: VenueForm,
})
