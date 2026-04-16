import { Link } from '@tanstack/react-router'
import { Building2, MapPin, ArrowLeft } from 'lucide-react'
import { usePublicVenueBySlug } from './hooks'
import { Card } from '../../components/Card'
import { InfoRow } from '../../components/InfoRow'
import { AdSlot } from '../../components/AdSlot'
import { SkeletonRow } from '../../components/Skeleton'
import { usePageTitle } from '../../hooks/usePageTitle'

interface PublicVenueDetailProps {
  slug: string
}

export function PublicVenueDetail({ slug }: PublicVenueDetailProps) {
  const { data: venue, isLoading, isError } = usePublicVenueBySlug(slug)
  usePageTitle(venue?.name ?? 'Venue')

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

  if (isError || !venue) {
    return (
      <div className="space-y-4">
        <Link
          to={'/public/venues' as string}
          className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Venues
        </Link>
        <Card>
          <p className="text-sm text-(--color-status-error)">
            {isError
              ? 'Failed to load venue details. Please try again later.'
              : 'Venue not found.'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to={'/public/venues' as string}
        className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Venues
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          {venue.photo_url ? (
            <img
              src={venue.photo_url}
              alt={`${venue.name} photo`}
              className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-(--color-bg-hover) flex-shrink-0">
              <Building2 className="h-10 w-10 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-(--color-text-primary)">
              {venue.name}
            </h1>
            {(venue.city || venue.state_province) && (
              <div className="mt-2 flex items-center gap-1 text-sm text-(--color-text-muted)">
                <MapPin className="h-4 w-4" />
                <span>
                  {[venue.city, venue.state_province, venue.country]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Venue photo banner */}
      {venue.photo_url && (
        <div className="overflow-hidden rounded-xl border border-(--color-border)">
          <img
            src={venue.photo_url}
            alt={`${venue.name}`}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Details */}
      <Card>
        <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
          Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow
            label="Location"
            value={
              [venue.city, venue.state_province, venue.country]
                .filter(Boolean)
                .join(', ') || null
            }
          />
          <InfoRow
            label="Courts"
            value={
              venue.court_count != null
                ? `${venue.court_count} court${venue.court_count !== 1 ? 's' : ''}`
                : null
            }
          />
        </dl>
      </Card>

      <AdSlot size="medium-rectangle" slot="venue-detail-bottom" />
    </div>
  )
}
