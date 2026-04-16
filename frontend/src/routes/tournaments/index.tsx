import { createFileRoute } from '@tanstack/react-router'
import { TournamentList } from '../../features/tournaments/TournamentList'

export const Route = createFileRoute('/tournaments/')({
  component: TournamentList,
})
