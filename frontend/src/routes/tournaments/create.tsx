import { createFileRoute } from '@tanstack/react-router'
import { TournamentCreate } from '../../features/tournaments/TournamentCreate'

export const Route = createFileRoute('/tournaments/create')({
  component: TournamentCreate,
})
