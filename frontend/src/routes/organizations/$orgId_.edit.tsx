import { createFileRoute } from '@tanstack/react-router'
import { OrgForm } from '../../features/registry/organizations/OrgForm'
import { useOrg } from '../../features/registry/organizations/hooks'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'

export const Route = createFileRoute('/organizations/$orgId_/edit')({
  component: OrgEditPage,
})

function OrgEditPage() {
  const { orgId } = Route.useParams()
  const { data: org, isLoading, error } = useOrg(orgId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <EmptyState
        title="Organization not found"
        description="This organization may have been removed or you don't have access."
      />
    )
  }

  return <OrgForm org={org} />
}
