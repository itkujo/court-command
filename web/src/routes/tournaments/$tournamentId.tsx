import { createFileRoute } from '@tanstack/react-router'
import { TournamentDetail } from '../../features/tournaments/TournamentDetail'

export const Route = createFileRoute('/tournaments/$tournamentId')({
  component: TournamentDetailPage,
})

function TournamentDetailPage() {
  const { tournamentId } = Route.useParams()
  return <TournamentDetail tournamentId={tournamentId} />
}
