import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Shield, MapPin } from 'lucide-react'
import { usePublicLeagues, type PublicLeague } from './hooks'
import { DirectoryFilters } from './DirectoryFilters'
import { Card } from '../../components/Card'
import { StatusBadge } from '../../components/StatusBadge'
import { Pagination } from '../../components/Pagination'
import { SkeletonRow } from '../../components/Skeleton'
import { AdSlot } from '../../components/AdSlot'
import { EmptyState } from '../../components/EmptyState'
import { usePagination } from '../../hooks/usePagination'

export function LeagueDirectory() {
  const [query, setQuery] = useState('')
  const pagination = usePagination(12)

  const { data, isLoading, isError } = usePublicLeagues({
    limit: pagination.limit,
    offset: pagination.offset,
  })

  const leagues = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = pagination.totalPages(total)

  const filtered = query
    ? leagues.filter((l) =>
        l.name.toLowerCase().includes(query.toLowerCase()),
      )
    : leagues

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Leagues
        </h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Find local pickleball leagues to join
        </p>
      </div>

      <AdSlot size="responsive-banner" slot="league-dir-top" />

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
          Failed to load leagues. Please try again later.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-10 w-10" />}
          title="No leagues found"
          description={
            query
              ? 'Try adjusting your search'
              : 'Check back soon for available leagues'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((league) => (
              <LeagueCard key={league.id} league={league} />
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

function LeagueCard({ league }: { league: PublicLeague }) {
  return (
    <Link
      to={'/public/leagues/$slug' as string}
      params={{ slug: league.slug } as Record<string, string>}
      className="block"
    >
      <Card className="h-full hover:border-(--color-accent) transition-colors">
        <div className="flex items-start gap-3">
          {league.logo_url ? (
            <img
              src={league.logo_url}
              alt={`${league.name} logo`}
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-(--color-bg-hover) flex-shrink-0">
              <Shield className="h-6 w-6 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-(--color-text-primary) truncate">
              {league.name}
            </h3>
            {(league.city || league.state_province) && (
              <div className="mt-1 flex items-center gap-1 text-xs text-(--color-text-muted)">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {[league.city, league.state_province]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            <div className="mt-2">
              <StatusBadge status={league.status} type="league" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
