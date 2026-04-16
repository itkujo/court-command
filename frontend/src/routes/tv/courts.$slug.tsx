import { createFileRoute } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { TVKioskCourt } from '../../features/overlay/tv/TVKioskCourt'

export const Route = createFileRoute('/tv/courts/$slug')({
  component: KioskCourtRoute,
})

function KioskCourtRoute() {
  const { slug } = Route.useParams()
  return (
    <ErrorBoundary fallback={null}>
      <TVKioskCourt slug={slug} />
    </ErrorBoundary>
  )
}
