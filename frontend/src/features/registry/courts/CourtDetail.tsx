import { useCourt } from './hooks'
import { Badge } from '../../../components/Badge'
import { InfoRow } from '../../../components/InfoRow'
import { Skeleton } from '../../../components/Skeleton'
import { EmptyState } from '../../../components/EmptyState'
import { Button } from '../../../components/Button'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { formatDate } from '../../../lib/formatters'
import { AdSlot } from '../../../components/AdSlot'

interface CourtDetailProps {
  courtId: string
}

const STREAM_VARIANTS: Record<string, 'error' | 'info' | 'success' | 'default'> = {
  youtube: 'error',
  twitch: 'info',
  vimeo: 'info',
  hls: 'success',
}

export function CourtDetail({ courtId }: CourtDetailProps) {
  const { data: court, isLoading, error } = useCourt(courtId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !court) {
    return (
      <EmptyState
        title="Court not found"
        description="This court may have been removed or you don't have access."
        action={
          <Link to="/courts">
            <Button variant="secondary">Back to Courts</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <Link
        to="/courts"
        className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Floating Courts
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text-primary)">{court.name}</h1>
          <p className="text-sm text-(--color-text-secondary)">{court.slug}</p>
        </div>
        <div className="flex gap-2">
          {court.is_active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="default">Inactive</Badge>
          )}
          {court.is_show_court && <Badge variant="info">Show Court</Badge>}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
            Court Details
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Name" value={court.name} />
            <InfoRow label="Slug" value={court.slug} />
            <InfoRow
              label="Surface Type"
              value={court.surface_type?.replace(/_/g, ' ')}
            />
            <InfoRow label="Show Court" value={court.is_show_court ? 'Yes' : 'No'} />
            <InfoRow label="Active" value={court.is_active ? 'Yes' : 'No'} />
            <InfoRow label="Temporary" value={court.is_temporary ? 'Yes' : 'No'} />
            <InfoRow label="Sort Order" value={String(court.sort_order)} />
            <InfoRow label="Notes" value={court.notes} />
            <InfoRow label="Created" value={formatDate(court.created_at)} />
          </dl>
        </div>

        {(court.stream_url || court.stream_type) && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
            <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
              Stream Info
            </h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="Stream Type"
                value={
                  court.stream_type ? (
                    <Badge variant={STREAM_VARIANTS[court.stream_type] ?? 'default'}>
                      {court.stream_type}
                    </Badge>
                  ) : null
                }
              />
              <InfoRow label="Stream Title" value={court.stream_title} />
              <InfoRow
                label="Stream URL"
                value={
                  court.stream_url ? (
                    <a
                      href={court.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline break-all"
                    >
                      {court.stream_url}
                    </a>
                  ) : null
                }
              />
            </dl>
          </div>
        )}
      </div>

      <AdSlot size="medium-rectangle" slot="court-detail-bottom" className="mt-6" />
    </div>
  )
}
