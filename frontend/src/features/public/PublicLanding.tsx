import { Link } from '@tanstack/react-router'
import {
  Trophy,
  Users,
  MapPin,
  ArrowRight,
  Calendar,
  Hash,
} from 'lucide-react'
import { Card } from '../../components/Card'
import { StatusBadge } from '../../components/StatusBadge'
import { SkeletonRow } from '../../components/Skeleton'
import { AdSlot } from '../../components/AdSlot'
import { PublicHero } from './PublicHero'
import {
  usePublicTournaments,
  usePublicLeagues,
  usePublicVenues,
  type PublicTournament,
  type PublicLeague,
  type PublicVenue,
} from './hooks'
import { formatDate } from '../../lib/formatters'

export function PublicLanding() {
  return (
    <div className="space-y-10">
      <PublicHero />

      <AdSlot size="responsive-banner" className="my-6" />

      <DirectorySection
        title="Tournaments"
        icon={<Trophy className="h-5 w-5" />}
        viewAllHref="/public/tournaments"
      >
        <TournamentCards />
      </DirectorySection>

      <DirectorySection
        title="Leagues"
        icon={<Users className="h-5 w-5" />}
        viewAllHref="/public/leagues"
      >
        <LeagueCards />
      </DirectorySection>

      <DirectorySection
        title="Venues"
        icon={<MapPin className="h-5 w-5" />}
        viewAllHref="/public/venues"
      >
        <VenueCards />
      </DirectorySection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function DirectorySection({
  title,
  icon,
  viewAllHref,
  children,
}: {
  title: string
  icon: React.ReactNode
  viewAllHref: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-(--color-text-primary)">
          {icon}
          {title}
        </h2>
        <Link
          to={viewAllHref as string}
          className="flex items-center gap-1 text-sm font-medium text-(--color-accent) hover:underline"
        >
          View All <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Loading / Error / Empty helpers
// ---------------------------------------------------------------------------

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <SkeletonRow />
        </Card>
      ))}
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-500 py-4">{message}</p>
  )
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-(--color-text-muted) py-4">{message}</p>
  )
}

// ---------------------------------------------------------------------------
// Tournament cards
// ---------------------------------------------------------------------------

function TournamentCards() {
  const { data, isLoading, error } = usePublicTournaments({
    limit: 6,
    offset: 0,
  })

  if (isLoading) return <LoadingGrid />
  if (error) return <ErrorMessage message="Failed to load tournaments." />
  if (!data || data.items.length === 0) return <EmptyMessage message="No tournaments yet." />

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.items.map((t: PublicTournament) => (
        <Link key={t.id} to={`/public/tournaments/${t.slug}` as string}>
          <Card className="h-full hover:border-(--color-accent) transition-colors">
            <div className="flex items-start gap-3">
              {t.logo_url ? (
                <img
                  src={t.logo_url}
                  alt={`${t.name} logo`}
                  className="h-10 w-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-(--color-bg-hover) flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-(--color-text-muted)" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-(--color-text-primary) truncate">
                  {t.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-(--color-text-muted)">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(t.start_date)}</span>
                </div>
                {(t.city || t.venue_name) && (
                  <p className="text-xs text-(--color-text-muted) mt-0.5 truncate">
                    {[t.venue_name, t.city].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge status={t.status} type="tournament" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// League cards
// ---------------------------------------------------------------------------

function LeagueCards() {
  const { data, isLoading, error } = usePublicLeagues({
    limit: 6,
    offset: 0,
  })

  if (isLoading) return <LoadingGrid />
  if (error) return <ErrorMessage message="Failed to load leagues." />
  if (!data || data.items.length === 0) return <EmptyMessage message="No leagues yet." />

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.items.map((l: PublicLeague) => (
        <Link key={l.id} to={`/public/leagues/${l.slug}` as string}>
          <Card className="h-full hover:border-(--color-accent) transition-colors">
            <div className="flex items-start gap-3">
              {l.logo_url ? (
                <img
                  src={l.logo_url}
                  alt={`${l.name} logo`}
                  className="h-10 w-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-(--color-bg-hover) flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-(--color-text-muted)" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-(--color-text-primary) truncate">
                  {l.name}
                </h3>
                {l.city && (
                  <p className="text-xs text-(--color-text-muted) mt-1 truncate">
                    {[l.city, l.state_province].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge status={l.status} type="league" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Venue cards
// ---------------------------------------------------------------------------

function VenueCards() {
  const { data, isLoading, error } = usePublicVenues({
    limit: 6,
    offset: 0,
  })

  if (isLoading) return <LoadingGrid />
  if (error) return <ErrorMessage message="Failed to load venues." />
  if (!data || data.items.length === 0) return <EmptyMessage message="No venues yet." />

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.items.map((v: PublicVenue) => (
        <Link key={v.id} to={`/public/venues/${v.slug}` as string}>
          <Card className="h-full hover:border-(--color-accent) transition-colors">
            <div className="flex items-start gap-3">
              {v.photo_url ? (
                <img
                  src={v.photo_url}
                  alt={`${v.name} photo`}
                  className="h-10 w-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-(--color-bg-hover) flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-(--color-text-muted)" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-(--color-text-primary) truncate">
                  {v.name}
                </h3>
                {v.city && (
                  <p className="text-xs text-(--color-text-muted) mt-1 truncate">
                    {[v.city, v.state_province].filter(Boolean).join(', ')}
                  </p>
                )}
                {v.court_count != null && v.court_count > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-(--color-text-muted)">
                    <Hash className="h-3 w-3" />
                    <span>
                      {v.court_count} court{v.court_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
