import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Building2, MapPin } from 'lucide-react'
import { usePublicVenues, type PublicVenue } from './hooks'
import { DirectoryFilters } from './DirectoryFilters'
import { Card } from '../../components/Card'
import { Pagination } from '../../components/Pagination'
import { SkeletonRow } from '../../components/Skeleton'
import { AdSlot } from '../../components/AdSlot'
import { EmptyState } from '../../components/EmptyState'
import { usePagination } from '../../hooks/usePagination'
import { usePageTitle } from '../../hooks/usePageTitle'

export function VenueDirectory() {
  usePageTitle('Venues')
  const [query, setQuery] = useState('')
  const pagination = usePagination(12)

  const { data, isLoading, isError } = usePublicVenues({
    limit: pagination.limit,
    offset: pagination.offset,
  })

  const venues = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = pagination.totalPages(total)

  const filtered = query
    ? venues.filter((v) =>
        v.name.toLowerCase().includes(query.toLowerCase()),
      )
    : venues

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Venues
        </h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Discover pickleball courts and venues near you
        </p>
      </div>

      <AdSlot size="responsive-banner" slot="venue-dir-top" />

      <DirectoryFilters query={query} onQueryChange={setQuery} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <SkeletonRow />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-(--color-status-error)">
          Failed to load venues. Please try again later.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="No venues found"
          description={
            query
              ? 'Try adjusting your search'
              : 'Check back soon for available venues'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>
          <Pagination
            page={pagination.page}
            totalPages={totalPages}
            onPageChange={pagination.setPage}
          />
        </>
      )}
    </div>
  )
}

function VenueCard({ venue }: { venue: PublicVenue }) {
  return (
    <Link
      to={'/public/venues/$slug' as string}
      params={{ slug: venue.slug } as Record<string, string>}
      className="block"
    >
      <Card className="h-full hover:border-(--color-accent) transition-colors">
        <div className="flex items-start gap-3">
          {venue.photo_url ? (
            <img
              src={venue.photo_url}
              alt={`${venue.name} photo`}
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-(--color-bg-hover) flex-shrink-0">
              <Building2 className="h-6 w-6 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-(--color-text-primary) truncate">
              {venue.name}
            </h3>
            {(venue.city || venue.state_province) && (
              <div className="mt-1 flex items-center gap-1 text-xs text-(--color-text-muted)">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {[venue.city, venue.state_province]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {venue.court_count != null && venue.court_count > 0 && (
              <p className="mt-0.5 text-xs text-(--color-text-muted)">
                {venue.court_count} court{venue.court_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
