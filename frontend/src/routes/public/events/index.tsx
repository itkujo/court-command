import { createFileRoute } from '@tanstack/react-router'
import { EventsPage } from '../../../features/public/EventsPage'

export const Route = createFileRoute('/public/events/')({
  component: EventsPage,
})
