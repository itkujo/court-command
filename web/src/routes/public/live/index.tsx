import { createFileRoute } from '@tanstack/react-router'
import { LivePage } from '../../../features/public/LivePage'

export const Route = createFileRoute('/public/live/')({
  component: LivePage,
})
