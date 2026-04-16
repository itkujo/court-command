import { createFileRoute } from '@tanstack/react-router'
import { PublicLeagueDetail } from '../../../features/public/PublicLeagueDetail'

export const Route = createFileRoute('/public/leagues/$slug')({
  component: LeagueDetailRoute,
})

function LeagueDetailRoute() {
  const { slug } = Route.useParams()
  return <PublicLeagueDetail slug={slug} />
}
