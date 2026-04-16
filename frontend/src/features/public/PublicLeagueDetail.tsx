import { Link } from '@tanstack/react-router'
import { Shield, MapPin, ArrowLeft } from 'lucide-react'
import { usePublicLeagueBySlug } from './hooks'
import { Card } from '../../components/Card'
import { InfoRow } from '../../components/InfoRow'
import { StatusBadge } from '../../components/StatusBadge'
import { RichTextDisplay } from '../../components/RichTextDisplay'
import { AdSlot } from '../../components/AdSlot'
import { SkeletonRow } from '../../components/Skeleton'

interface PublicLeagueDetailProps {
  slug: string
}

export function PublicLeagueDetail({ slug }: PublicLeagueDetailProps) {
  const { data: league, isLoading, isError } = usePublicLeagueBySlug(slug)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      </div>
    )
  }

  if (isError || !league) {
    return (
      <div className="space-y-4">
        <Link
          to={'/public/leagues' as string}
          className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leagues
        </Link>
        <Card>
          <p className="text-sm text-(--color-status-error)">
            {isError
              ? 'Failed to load league details. Please try again later.'
              : 'League not found.'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to={'/public/leagues' as string}
        className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leagues
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          {league.logo_url ? (
            <img
              src={league.logo_url}
              alt={`${league.name} logo`}
              className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-(--color-bg-hover) flex-shrink-0">
              <Shield className="h-8 w-8 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-(--color-text-primary)">
                {league.name}
              </h1>
              <StatusBadge status={league.status} type="league" />
            </div>
            {(league.city || league.state_province) && (
              <div className="mt-2 flex items-center gap-1 text-sm text-(--color-text-muted)">
                <MapPin className="h-4 w-4" />
                <span>
                  {[league.city, league.state_province]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
          Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Status" value={league.status.replace(/_/g, ' ')} />
          <InfoRow
            label="Location"
            value={
              [league.city, league.state_province]
                .filter(Boolean)
                .join(', ') || null
            }
          />
        </dl>
      </Card>

      {/* Description */}
      {league.description && (
        <Card>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">
            About
          </h2>
          <RichTextDisplay html={league.description} />
        </Card>
      )}

      <AdSlot size="medium-rectangle" slot="league-detail-bottom" />
    </div>
  )
}
