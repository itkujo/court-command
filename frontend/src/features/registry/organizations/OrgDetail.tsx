import { useOrg } from './hooks'
import { MembersPanel } from './MembersPanel'
import { Skeleton } from '../../../components/Skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Button } from '../../../components/Button'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { formatDate } from '../../../lib/formatters'

interface OrgDetailProps {
  orgId: string
}

export function OrgDetail({ orgId }: OrgDetailProps) {
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
        action={
          <Link to="/organizations">
            <Button variant="secondary">Back to Organizations</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Organizations
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text-primary)">{org.name}</h1>
          <p className="text-sm text-(--color-text-secondary)">{org.slug}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Name" value={org.name} />
            <InfoRow label="Slug" value={org.slug} />
            <InfoRow label="Contact Email" value={org.contact_email} />
            <InfoRow label="Contact Phone" value={org.contact_phone} />
            <InfoRow
              label="Website"
              value={
                org.website_url ? (
                  <a
                    href={org.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    {org.website_url}
                  </a>
                ) : null
              }
            />
            <InfoRow
              label="Location"
              value={[org.city, org.state_province, org.country].filter(Boolean).join(', ')}
            />
            <InfoRow
              label="Founded"
              value={org.founded_year ? String(org.founded_year) : null}
            />
            <InfoRow label="Bio" value={org.bio} />
            <InfoRow label="Created" value={formatDate(org.created_at)} />
          </dl>
        </div>

        <MembersPanel orgId={orgId} />
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | string | null | undefined
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-(--color-text-primary)">{value || '\u2014'}</dd>
    </div>
  )
}
