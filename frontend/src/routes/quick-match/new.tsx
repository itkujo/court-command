import { createFileRoute } from '@tanstack/react-router'
import { QuickMatchCreate } from '../../features/quick-match/QuickMatchCreate'

export const Route = createFileRoute('/quick-match/new')({
  component: QuickMatchCreate,
})
