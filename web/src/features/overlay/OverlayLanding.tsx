// web/src/features/overlay/OverlayLanding.tsx
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  Database,
  ExternalLink,
  Plus,
  Radio,
  Settings,
  Sparkles,
  Tv,
} from 'lucide-react'

import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { useAllCourts } from '../scoring/hooks'
import type { CourtSummary } from '../scoring/types'

// --------------------------------------------------------------------------

export function OverlayLanding() {
  const coursesQuery = useAllCourts()
  const courts = coursesQuery.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <Header />
      <QuickLinks />
      <YourCourts
        courts={courts}
        loading={coursesQuery.isLoading}
        error={coursesQuery.isError ? (coursesQuery.error as Error)?.message : null}
      />
    </div>
  )
}

// --------------------------------------------------------------------------

function Header() {
  return (
    <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
        >
          <Radio className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">Broadcast overlays</h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Configure OBS overlays, source profiles, TV/kiosk displays, and producer tools.
          </p>
        </div>
      </div>
      <Link to="/overlay/setup">
        <Button>
          <Sparkles className="mr-2 size-4" />
          New overlay
        </Button>
      </Link>
    </header>
  )
}

// --------------------------------------------------------------------------

const QUICK_LINKS = [
  {
    to: '/overlay/setup' as const,
    title: 'Setup wizard',
    description: 'Spin up a new court + overlay in under a minute.',
    icon: Sparkles,
  },
  {
    to: '/overlay/monitor' as const,
    title: 'Producer monitor',
    description: 'See every court live with heat badges + last ping.',
    icon: Activity,
  },
  {
    to: '/overlay/source-profiles' as const,
    title: 'Source profiles',
    description: 'External REST / webhook feeds and field mappings.',
    icon: Database,
  },
] as const

function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading" className="space-y-3">
      <h2
        id="quick-links-heading"
        className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)"
      >
        Quick links
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4 transition-colors hover:bg-(--color-hover)"
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor:
                    'color-mix(in oklab, var(--color-accent) 15%, transparent)',
                  color: 'var(--color-accent)',
                }}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-(--color-text-primary)">{link.title}</p>
                <p className="mt-1 text-sm text-(--color-text-secondary)">
                  {link.description}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// --------------------------------------------------------------------------

function YourCourts({
  courts,
  loading,
  error,
}: {
  courts: CourtSummary[]
  loading: boolean
  error: string | null
}) {
  return (
    <section aria-labelledby="your-courts-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="your-courts-heading"
          className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)"
        >
          Your courts
        </h2>
        {!loading && !error && courts.length > 0 && (
          <span className="text-xs text-(--color-text-muted)">
            {courts.length} total
          </span>
        )}
      </div>

      {loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <EmptyState
          icon={<Tv className="size-8" />}
          title="Couldn't load courts"
          description={error}
        />
      )}

      {!loading && !error && courts.length === 0 && (
        <EmptyState
          icon={<Tv className="size-8" />}
          title="No courts yet"
          description="Run the setup wizard to create your first court and overlay."
          action={
            <Link to="/overlay/setup">
              <Button>
                <Plus className="mr-2 size-4" />
                Create your first court
              </Button>
            </Link>
          }
        />
      )}

      {!loading && !error && courts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <CourtTile key={court.id} court={court} />
          ))}
        </div>
      )}
    </section>
  )
}

function CourtTile({ court }: { court: CourtSummary }) {
  const hasActive = !!court.active_match
  const statusLabel = hasActive
    ? court.active_match?.status === 'paused'
      ? 'Paused'
      : 'Live'
    : 'Idle'
  const statusColor = hasActive
    ? court.active_match?.status === 'paused'
      ? 'var(--color-warning)'
      : 'var(--color-success)'
    : 'var(--color-text-muted)'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-(--color-text-primary)">{court.name}</p>
          <p className="truncate text-xs text-(--color-text-muted)">{court.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: statusColor }}
            aria-hidden="true"
          />
          <span
            className="text-xs font-medium"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {hasActive && (
        <p className="truncate text-xs text-(--color-text-secondary)">
          {court.active_match?.team_1?.name ?? 'TBD'} vs{' '}
          {court.active_match?.team_2?.name ?? 'TBD'}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Link
          to="/overlay/court/$slug/settings"
          params={{ slug: court.slug }}
          className="flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-1.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:bg-(--color-hover)"
        >
          <Settings className="size-3.5" />
          Control panel
        </Link>
        <Link
          to="/overlay/court/$slug"
          params={{ slug: court.slug }}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-1.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:bg-(--color-hover)"
        >
          <ExternalLink className="size-3.5" />
          Overlay
        </Link>
      </div>
    </div>
  )
}
