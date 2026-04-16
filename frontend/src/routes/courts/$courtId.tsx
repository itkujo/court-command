import { createFileRoute } from '@tanstack/react-router'
import { CourtDetail } from '../../features/registry/courts/CourtDetail'

export const Route = createFileRoute('/courts/$courtId')({
  component: CourtDetailPage,
})

function CourtDetailPage() {
  const { courtId } = Route.useParams()
  return <CourtDetail courtId={courtId} />
}
