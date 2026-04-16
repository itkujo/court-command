import { createFileRoute } from '@tanstack/react-router'
import { TVKioskCourt } from '../../features/overlay/tv/TVKioskCourt'

export const Route = createFileRoute('/tv/courts/$slug')({
  component: KioskCourtRoute,
})

function KioskCourtRoute() {
  const { slug } = Route.useParams()
  return <TVKioskCourt slug={slug} />
}
