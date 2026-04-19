// web/src/features/overlay/monitor/ProducerMonitor.tsx
import { useMemo, useState } from 'react'
import { Activity, Tv } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'
import { Select } from '../../../components/Select'
import { Skeleton } from '../../../components/Skeleton'
import { SearchInput } from '../../../components/SearchInput'
import { useAllCourts, useCourtsForTournament } from '../../scoring/hooks'
import { useListTournaments } from '../../tournaments/hooks'
import type { CourtSummary } from '../../scoring/types'
import { CourtMonitorCard } from './CourtMonitorCard'

interface Props {
  tournamentID: number | null
  onTournamentChange: (id: number | null) => void
}

type ActivityFilter = 'all' | 'live' | 'idle'

/**
 * Producer Monitor — grid of all courts with live score snapshots.
 *
 * Sits at /overlay/monitor with optional ?tournament={id} filter.
 * Operator uses it to triage broadcast-worthy matches across many courts.
 */
export function ProducerMonitor({ tournamentID, onTournamentChange }: Props) {
  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState<ActivityFilter>('all')

  const allCourtsQuery = useAllCourts()
  const tournamentCourtsQuery = useCourtsForTournament(
    tournamentID ?? undefined,
  )
  const tournamentsQuery = useListTournaments(undefined, undefined, 100, 0)

  const sourceQuery = tournamentID ? tournamentCourtsQuery : allCourtsQuery
  const courts = sourceQuery.data ?? []

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return courts.filter((c) => {
      if (needle) {
        const hay = `${c.name} ${c.slug}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (activity === 'live' && !isLive(c)) return false
      if (activity === 'idle' && isLive(c)) return false
      return true
    })
  }, [courts, search, activity])

  const liveCount = courts.filter(isLive).length

  return (
    <div className="p-6 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-(--color-accent)" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">
            Producer Monitor
          </h1>
        </div>
        <p className="text-sm text-(--color-text-secondary) max-w-2xl">
          Live scoreboard across every court you operate. Spot match-point
          moments, deuces, and close scores. Click a card to open its control
          panel in a new tab.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="monitor-tournament"
            className="text-xs uppercase tracking-wide text-(--color-text-muted)"
          >
            Tournament
          </label>
          <Select
            id="monitor-tournament"
            value={tournamentID ? String(tournamentID) : ''}
            onChange={(e) =>
              onTournamentChange(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All courts</option>
            {tournamentsQuery.data?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="monitor-activity"
            className="text-xs uppercase tracking-wide text-(--color-text-muted)"
          >
            Activity
          </label>
          <Select
            id="monitor-activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityFilter)}
          >
            <option value="all">All courts</option>
            <option value="live">Live only</option>
            <option value="idle">Idle only</option>
          </Select>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1">
          <label
            htmlFor="monitor-search"
            className="text-xs uppercase tracking-wide text-(--color-text-muted)"
          >
            Search
          </label>
          <SearchInput
            id="monitor-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by court name or slug"
          />
        </div>
      </section>

      <div className="flex items-center gap-4 text-sm text-(--color-text-secondary)">
        <span>
          <strong className="text-(--color-text-primary)">{courts.length}</strong>{' '}
          courts
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <strong className="text-(--color-success)">{liveCount}</strong> live
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <strong className="text-(--color-text-primary)">
            {filtered.length}
          </strong>{' '}
          shown
        </span>
      </div>

      {sourceQuery.isLoading && <MonitorGridSkeleton />}

      {sourceQuery.isError && (
        <EmptyState
          icon={<Tv className="h-10 w-10" />}
          title="Unable to load courts"
          description={
            sourceQuery.error instanceof Error
              ? sourceQuery.error.message
              : 'Check your connection and retry.'
          }
        />
      )}

      {!sourceQuery.isLoading &&
        !sourceQuery.isError &&
        filtered.length === 0 && (
          <EmptyState
            icon={<Tv className="h-10 w-10" />}
            title="No courts match these filters"
            description={
              courts.length === 0
                ? 'Create a court from the tournament settings or the setup wizard to see it here.'
                : 'Clear the search or switch the activity filter to see more courts.'
            }
          />
        )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((court) => (
            <CourtMonitorCard key={court.id} court={court} />
          ))}
        </div>
      )}
    </div>
  )
}

function isLive(c: CourtSummary): boolean {
  const m = c.active_match
  if (!m) return false
  return m.status === 'in_progress' || m.status === 'paused'
}

function MonitorGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-4 flex flex-col gap-3 min-h-[220px]"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-col gap-2 mt-auto">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
