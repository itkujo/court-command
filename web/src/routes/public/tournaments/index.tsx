import { createFileRoute } from '@tanstack/react-router'
import { TournamentDirectory } from '../../../features/public/TournamentDirectory'

export const Route = createFileRoute('/public/tournaments/')({
  component: TournamentDirectory,
})
