import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Shield,
  MapPin,
  ArrowLeft,
  Calendar,
  Trophy,
  ChevronRight,
} from 'lucide-react'
import {
  usePublicLeagueBySlug,
  usePublicLeagueSeasons,
  usePublicLeagueTournaments,
  type PublicSeason,
  type PublicTournament,
} from './hooks'
import { Card } from '../../components/Card'
import { InfoRow } from '../../components/InfoRow'
import { StatusBadge } from '../../components/StatusBadge'
import { RichTextDisplay } from '../../components/RichTextDisplay'
import { AdSlot } from '../../components/AdSlot'
import { SkeletonRow } from '../../components/Skeleton'
import { TabLayout } from '../../components/TabLayout'
import { EmptyState } from '../../components/EmptyState'
import { Pagination } from '../../components/Pagination'
import { usePageTitle } from '../../hooks/usePageTitle'
import { formatDate } from '../../lib/formatters'

interface PublicLeagueDetailProps {
  slug: string
}

export function PublicLeagueDetail({ slug }: PublicLeagueDetailProps) {
  const { data: league, isLoading, isError } = usePublicLeagueBySlug(slug)
  const [activeTab, setActiveTab] = useState('overview')
  const [seasonsPage, setSeasonsPage] = useState(1)
  const [tournamentsPage, setTournamentsPage] = useState(1)
  usePageTitle(league?.name ?? 'League')

  const pageSize = 20
  const {
    data: seasonsData,
    isLoading: seasonsLoading,
  } = usePublicLeagueSeasons(slug, {
    limit: pageSize,
    offset: (seasonsPage - 1) * pageSize,
  })

  const {
    data: tournamentsData,
    isLoading: tournamentsLoading,
  } = usePublicLeagueTournaments(slug, {
    limit: pageSize,
    offset: (tournamentsPage - 1) * pageSize,
  })

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

  const seasons = seasonsData?.items ?? []
  const tournaments = tournamentsData?.items ?? []

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'seasons', label: 'Seasons', count: seasonsData?.total },
    { id: 'tournaments', label: 'Tournaments', count: tournamentsData?.total },
  ]

  return (
    <div className="space-y-6">
      <Link
        to={'/public/leagues' as string}
        className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leagues
      </Link>

      {/* Header */}
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

      {/* Tabs */}
      <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'overview' && <OverviewTab league={league} />}
        {activeTab === 'seasons' && (
          <SeasonsTab
            seasons={seasons}
            isLoading={seasonsLoading}
            page={seasonsPage}
            totalPages={Math.ceil((seasonsData?.total ?? 0) / pageSize)}
            onPageChange={setSeasonsPage}
          />
        )}
        {activeTab === 'tournaments' && (
          <TournamentsTab
            tournaments={tournaments}
            isLoading={tournamentsLoading}
            page={tournamentsPage}
            totalPages={Math.ceil((tournamentsData?.total ?? 0) / pageSize)}
            onPageChange={setTournamentsPage}
          />
        )}
      </TabLayout>

      <AdSlot size="medium-rectangle" slot="league-detail-bottom" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  league,
}: {
  league: {
    status: string
    city?: string
    state_province?: string
    description?: string | null
  }
}) {
  return (
    <div className="space-y-6">
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

      {league.description && (
        <Card>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">
            About
          </h2>
          <RichTextDisplay html={league.description} />
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seasons Tab
// ---------------------------------------------------------------------------

function SeasonsTab({
  seasons,
  isLoading,
  page,
  totalPages,
  onPageChange,
}: {
  seasons: PublicSeason[]
  isLoading: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <SkeletonRow />
          </Card>
        ))}
      </div>
    )
  }

  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<Calendar size={32} />}
        title="No seasons yet"
        description="Seasons will appear here as the league progresses."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {seasons.map((season) => (
          <SeasonCard key={season.id} season={season} />
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}

function SeasonCard({ season }: { season: PublicSeason }) {
  const formatLabel = (s: string) =>
    s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Card className="group hover:border-(--color-accent)/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-(--color-text-primary) truncate">
              {season.name}
            </h3>
            <StatusBadge status={season.status} type="season" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-text-muted)">
            {season.start_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(season.start_date)}
                {season.end_date && ` – ${formatDate(season.end_date)}`}
              </span>
            )}
            {season.standings_method && (
              <span>{formatLabel(season.standings_method)}</span>
            )}
          </div>
          {season.description && (
            <p className="mt-1.5 text-xs text-(--color-text-muted) line-clamp-2">
              {season.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-(--color-text-muted) group-hover:text-(--color-accent) transition-colors flex-shrink-0" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tournaments Tab
// ---------------------------------------------------------------------------

function TournamentsTab({
  tournaments,
  isLoading,
  page,
  totalPages,
  onPageChange,
}: {
  tournaments: PublicTournament[]
  isLoading: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <SkeletonRow />
          </Card>
        ))}
      </div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={32} />}
        title="No tournaments yet"
        description="Tournaments associated with this league will appear here."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}

function TournamentCard({ tournament }: { tournament: PublicTournament }) {
  return (
    <Link
      to="/public/tournaments/$slug"
      params={{ slug: tournament.slug }}
      className="block"
    >
      <Card className="group hover:border-(--color-accent)/30 transition-colors">
        <div className="flex items-center gap-3">
          {tournament.logo_url ? (
            <img
              src={tournament.logo_url}
              alt={`${tournament.name} logo`}
              className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--color-bg-hover) flex-shrink-0">
              <Trophy className="h-5 w-5 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-(--color-text-primary) truncate">
                {tournament.name}
              </h3>
              <StatusBadge status={tournament.status} type="tournament" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-text-muted)">
              {tournament.start_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(tournament.start_date)}
                  {tournament.end_date &&
                    tournament.end_date !== tournament.start_date &&
                    ` – ${formatDate(tournament.end_date)}`}
                </span>
              )}
              {(tournament.venue_name || tournament.city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[tournament.venue_name, tournament.city]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
              {tournament.division_count != null && tournament.division_count > 0 && (
                <span>{tournament.division_count} divisions</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-(--color-text-muted) group-hover:text-(--color-accent) transition-colors flex-shrink-0" />
        </div>
      </Card>
    </Link>
  )
}
