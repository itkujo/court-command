import { createFileRoute } from '@tanstack/react-router'
import { PublicLanding } from '../features/public/PublicLanding'

export const Route = createFileRoute('/')({
  component: PublicLanding,
})
