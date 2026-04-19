import { createFileRoute } from '@tanstack/react-router'
import { OrgDetail } from '../../features/registry/organizations/OrgDetail'

export const Route = createFileRoute('/organizations/$orgId')({
  component: OrgDetailPage,
})

function OrgDetailPage() {
  const { orgId } = Route.useParams()
  return <OrgDetail orgId={orgId} />
}
