import { createFileRoute } from '@tanstack/react-router'
import { ScoringSettings } from '../../features/scoring/ScoringSettings'

export const Route = createFileRoute('/settings/scoring')({
  component: ScoringSettings,
})
