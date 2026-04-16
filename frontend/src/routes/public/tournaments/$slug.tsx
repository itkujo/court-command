import { createFileRoute } from '@tanstack/react-router'
import { PublicTournamentDetail } from '../../../features/public/PublicTournamentDetail'

export const Route = createFileRoute('/public/tournaments/$slug')({
  component: TournamentDetailRoute,
})

function TournamentDetailRoute() {
  const { slug } = Route.useParams()
  return <PublicTournamentDetail slug={slug} />
}
