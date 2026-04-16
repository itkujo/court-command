import { Link } from '@tanstack/react-router'
import {
  Trophy,
  Calendar,
  MapPin,
  ArrowLeft,
  Users,
  LogIn,
} from 'lucide-react'
import { usePublicTournamentBySlug } from './hooks'
import { Card } from '../../components/Card'
import { InfoRow } from '../../components/InfoRow'
import { StatusBadge } from '../../components/StatusBadge'
import { RichTextDisplay } from '../../components/RichTextDisplay'
import { AdSlot } from '../../components/AdSlot'
import { SkeletonRow } from '../../components/Skeleton'
import { Button } from '../../components/Button'
import { useAuth } from '../auth/hooks'
import { formatDate } from '../../lib/formatters'

interface PublicTournamentDetailProps {
  slug: string
}

export function PublicTournamentDetail({ slug }: PublicTournamentDetailProps) {
  const { data: tournament, isLoading, isError } = usePublicTournamentBySlug(slug)
  const { isAuthenticated } = useAuth()

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

  if (isError || !tournament) {
    return (
      <div className="space-y-4">
        <Link
          to={'/public/tournaments' as string}
          className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournaments
        </Link>
        <Card>
          <p className="text-sm text-(--color-status-error)">
            {isError
              ? 'Failed to load tournament details. Please try again later.'
              : 'Tournament not found.'}
          </p>
        </Card>
      </div>
    )
  }

  const isRegistrationOpen = tournament.status === 'registration_open'

  return (
    <div className="space-y-6">
      <Link
        to={'/public/tournaments' as string}
        className="inline-flex items-center gap-1 text-sm text-(--color-accent) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tournaments
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          {tournament.logo_url ? (
            <img
              src={tournament.logo_url}
              alt={`${tournament.name} logo`}
              className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-(--color-bg-hover) flex-shrink-0">
              <Trophy className="h-8 w-8 text-(--color-text-muted)" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-(--color-text-primary)">
                {tournament.name}
              </h1>
              <StatusBadge status={tournament.status} type="tournament" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--color-text-muted)">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(tournament.start_date)}
                {tournament.end_date &&
                  tournament.end_date !== tournament.start_date &&
                  ` – ${formatDate(tournament.end_date)}`}
              </span>
              {(tournament.venue_name || tournament.city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {[tournament.venue_name, tournament.city]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Registration CTA */}
      {isRegistrationOpen && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-(--color-accent)" />
              <p className="text-sm font-medium text-(--color-text-primary)">
                Registration is open for this tournament
              </p>
            </div>
            {isAuthenticated ? (
              <Link
                to={'/tournaments/$id' as string}
                params={
                  { id: String(tournament.id) } as Record<string, string>
                }
              >
                <Button variant="primary" size="sm">
                  Register Now
                </Button>
              </Link>
            ) : (
              <Link
                to="/login"
                search={{ redirect: `/public/tournaments/${tournament.slug}` }}
              >
                <Button variant="primary" size="sm">
                  <LogIn className="h-4 w-4 mr-1" />
                  Sign In to Register
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Details */}
      <Card>
        <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
          Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Start Date" value={formatDate(tournament.start_date)} />
          <InfoRow
            label="End Date"
            value={
              tournament.end_date ? formatDate(tournament.end_date) : null
            }
          />
          <InfoRow label="Venue" value={tournament.venue_name} />
          <InfoRow
            label="Location"
            value={
              [tournament.city, tournament.state_province]
                .filter(Boolean)
                .join(', ') || null
            }
          />
          {tournament.division_count != null && (
            <InfoRow
              label="Divisions"
              value={String(tournament.division_count)}
            />
          )}
          {tournament.registration_count != null && (
            <InfoRow
              label="Registrations"
              value={String(tournament.registration_count)}
            />
          )}
        </dl>
      </Card>

      {/* Description */}
      {tournament.description && (
        <Card>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">
            About
          </h2>
          <RichTextDisplay html={tournament.description} />
        </Card>
      )}

      <AdSlot size="medium-rectangle" slot="tournament-detail-bottom" />
    </div>
  )
}
