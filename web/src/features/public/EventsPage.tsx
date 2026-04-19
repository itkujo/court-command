import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Calendar, Trophy, MapPin, ChevronRight } from 'lucide-react'
import { Card } from '../../components/Card'
import { AdSlot } from '../../components/AdSlot'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { TabLayout } from '../../components/TabLayout'
import { SearchInput } from '../../components/SearchInput'
import { Pagination } from '../../components/Pagination'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  usePublicTournaments,
  usePublicLeagues,
  type PublicTournament,
  type PublicLeague,
} from './hooks'

const PAGE_SIZE = 12

// ---------------------------------------------------------------------------
// Tournament Card
// ---------------------------------------------------------------------------

function TournamentCard({ tournament }: { tournament: PublicTournament }) {
  const location = [tournament.city, tournament.state_province]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      to="/public/tournaments/$slug"
      params={{ slug: tournament.slug }}
      className="block"
    >
      <Card className="group hover:border-(--color-accent) transition-colors h-full">
        <div className="flex gap-3">
          {/* Logo */}
          {tournament.logo_url ? (
            <img
              src={tournament.logo_url}
              alt=""
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-(--color-bg-hover) flex-shrink-0">
              <Trophy className="h-5 w-5 text-(--color-text-secondary)" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Name + status */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-accent) transition-colors">
                {tournament.name}
              </h3>
              <StatusBadge status={tournament.status} type="tournament" />
            </div>

            {/* Dates */}
            {tournament.start_date && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-(--color-text-secondary)">
                <Calendar className="h-3 w-3" />
                {formatDateRange(tournament.start_date, tournament.end_date)}
              </p>
            )}

            {/* Location */}
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-(--color-text-secondary)">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-2 flex items-center gap-3 text-xs text-(--color-text-secondary)">
              {tournament.division_count != null && tournament.division_count > 0 && (
                <span>{tournament.division_count} division{tournament.division_count !== 1 ? 's' : ''}</span>
              )}
              {tournament.registration_count != null && tournament.registration_count > 0 && (
                <span>{tournament.registration_count} registered</span>
              )}
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-(--color-text-secondary) opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </div>
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// League Card
// ---------------------------------------------------------------------------

function LeagueCard({ league }: { league: PublicLeague }) {
  const location = [league.city, league.state_province]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      to="/public/leagues/$slug"
      params={{ slug: league.slug }}
      className="block"
    >
      <Card className="group hover:border-(--color-accent) transition-colors h-full">
        <div className="flex gap-3">
          {/* Logo */}
          {league.logo_url ? (
            <img
              src={league.logo_url}
              alt=""
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-(--color-bg-hover) flex-shrink-0">
              <Trophy className="h-5 w-5 text-(--color-text-secondary)" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-(--color-text-primary) truncate group-hover:text-(--color-accent) transition-colors">
                {league.name}
              </h3>
              <StatusBadge status={league.status} type="league" />
            </div>

            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-(--color-text-secondary)">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}

            {league.description && (
              <p className="mt-1 text-xs text-(--color-text-secondary) line-clamp-2">
                {league.description}
              </p>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-(--color-text-secondary) opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </div>
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function EventsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4"
        >
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDateRange(start: string, end?: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const startDate = new Date(start)
  if (!end) return fmt.format(startDate)
  const endDate = new Date(end)
  // Same day
  if (startDate.toDateString() === endDate.toDateString()) {
    return fmt.format(startDate)
  }
  // Same month
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(startDate)}–${endDate.getDate()}, ${endDate.getFullYear()}`
  }
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`
}

// ---------------------------------------------------------------------------
// EventsPage
// ---------------------------------------------------------------------------

export function EventsPage() {
  usePageTitle('Events')
  const [activeTab, setActiveTab] = useState('tournaments')
  const [tournamentPage, setTournamentPage] = useState(0)
  const [leaguePage, setLeaguePage] = useState(0)
  const [search, setSearch] = useState('')

  const tournaments = usePublicTournaments({
    limit: PAGE_SIZE,
    offset: tournamentPage * PAGE_SIZE,
  })

  const leagues = usePublicLeagues({
    limit: PAGE_SIZE,
    offset: leaguePage * PAGE_SIZE,
  })

  const tabs = [
    {
      id: 'tournaments',
      label: 'Tournaments',
      count: tournaments.data?.total,
    },
    {
      id: 'leagues',
      label: 'Leagues',
      count: leagues.data?.total,
    },
  ]

  // Filter by search (client-side for now)
  const filteredTournaments = (tournaments.data?.items ?? []).filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.venue_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.city?.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredLeagues = (leagues.data?.items ?? []).filter(
    (l) =>
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.city?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-(--color-text-primary)">Events</h1>
        <p className="text-sm text-(--color-text-secondary)">
          Browse tournaments and leagues
        </p>
      </div>

      <AdSlot size="responsive-banner" className="mb-6" />

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
        />
      </div>

      {/* Tabs */}
      <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'tournaments' && (
          <>
            {tournaments.isLoading ? (
              <EventsSkeleton />
            ) : tournaments.isError ? (
              <EmptyState
                icon={<Trophy className="h-10 w-10" />}
                title="Unable to load tournaments"
                description="Please try again later."
              />
            ) : filteredTournaments.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-10 w-10" />}
                title={search ? 'No matching tournaments' : 'No tournaments yet'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Tournaments will appear here once published.'
                }
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredTournaments.map((t: PublicTournament) => (
                    <TournamentCard key={t.id} tournament={t} />
                  ))}
                </div>
                {(tournaments.data?.total ?? 0) > PAGE_SIZE && (
                  <div className="mt-6">
                    <Pagination
                      page={tournamentPage + 1}
                      totalPages={Math.ceil(
                        (tournaments.data?.total ?? 0) / PAGE_SIZE,
                      )}
                      onPageChange={(p) => setTournamentPage(p - 1)}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'leagues' && (
          <>
            {leagues.isLoading ? (
              <EventsSkeleton />
            ) : leagues.isError ? (
              <EmptyState
                icon={<Trophy className="h-10 w-10" />}
                title="Unable to load leagues"
                description="Please try again later."
              />
            ) : filteredLeagues.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-10 w-10" />}
                title={search ? 'No matching leagues' : 'No leagues yet'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Leagues will appear here once created.'
                }
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredLeagues.map((l: PublicLeague) => (
                    <LeagueCard key={l.id} league={l} />
                  ))}
                </div>
                {(leagues.data?.total ?? 0) > PAGE_SIZE && (
                  <div className="mt-6">
                    <Pagination
                      page={leaguePage + 1}
                      totalPages={Math.ceil(
                        (leagues.data?.total ?? 0) / PAGE_SIZE,
                      )}
                      onPageChange={(p) => setLeaguePage(p - 1)}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </TabLayout>

      <AdSlot size="medium-rectangle" className="mt-8" />
    </div>
  )
}
