import { useState, useMemo } from 'react'
import {
  useListRegistrations,
  type Registration,
} from './hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { ListOrdered } from 'lucide-react'

interface DivisionSeedsProps {
  divisionId: string
}

interface SeedRow {
  registration: Registration
  seed: number | null
}

export function DivisionSeeds({ divisionId }: DivisionSeedsProps) {
  const { toast } = useToast()
  const [locked, setLocked] = useState(false)

  // Fetch approved + checked_in registrations
  const { data: approved, isLoading: loadingApproved } = useListRegistrations(
    divisionId,
    'approved',
    200,
  )
  const { data: checkedIn, isLoading: loadingChecked } = useListRegistrations(
    divisionId,
    'checked_in',
    200,
  )

  const combinedRegs = useMemo(() => {
    const items = [
      ...(approved?.items ?? []),
      ...(checkedIn?.items ?? []),
    ]
    // De-dupe by id
    const byId = new Map<number, Registration>()
    for (const r of items) byId.set(r.id, r)
    return Array.from(byId.values())
  }, [approved?.items, checkedIn?.items])

  const [localSeeds, setLocalSeeds] = useState<Record<number, number | null>>(
    {},
  )

  // Initialize local seeds from server on load
  const initializedFromServer = useMemo(() => {
    if (combinedRegs.length === 0) return localSeeds
    if (Object.keys(localSeeds).length > 0) return localSeeds
    const seed: Record<number, number | null> = {}
    for (const r of combinedRegs) seed[r.id] = r.seed
    return seed
  }, [combinedRegs, localSeeds])

  // Rows sorted by seed (nulls last)
  const rows: SeedRow[] = useMemo(() => {
    return combinedRegs
      .map((r) => ({ registration: r, seed: initializedFromServer[r.id] ?? null }))
      .sort((a, b) => {
        if (a.seed == null && b.seed == null) return a.registration.id - b.registration.id
        if (a.seed == null) return 1
        if (b.seed == null) return -1
        return a.seed - b.seed
      })
  }, [combinedRegs, initializedFromServer])

  function updateSeed(regId: number, value: string) {
    const num = value ? Number(value) : null
    setLocalSeeds((prev) => ({
      ...prev,
      ...initializedFromServer,
      [regId]: num,
    }))
  }

  function autoSeedByRating() {
    // Placeholder: sort by registration id (stable). Real implementation
    // would pull rating from player.skill_rating and sort descending.
    const next: Record<number, number | null> = {}
    combinedRegs.forEach((r, i) => {
      next[r.id] = i + 1
    })
    setLocalSeeds(next)
    toast('info', 'Auto-seeded (placeholder ordering — real ratings in Phase 3)')
  }

  function randomize() {
    const shuffled = [...combinedRegs].sort(() => Math.random() - 0.5)
    const next: Record<number, number | null> = {}
    shuffled.forEach((r, i) => {
      next[r.id] = i + 1
    })
    setLocalSeeds(next)
  }

  function lockSeeds() {
    setLocked(true)
    toast(
      'success',
      'Seeds locked. (Persisting seeds to server happens per-registration via PATCH .../seed)',
    )
  }

  const isLoading = loadingApproved || loadingChecked

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">
          Seeding
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={autoSeedByRating}
            disabled={locked || rows.length === 0}
          >
            Auto-Seed by Rating
          </Button>
          <Button
            variant="secondary"
            onClick={randomize}
            disabled={locked || rows.length === 0}
          >
            Randomize
          </Button>
          <Button
            onClick={lockSeeds}
            disabled={locked || rows.length === 0}
          >
            {locked ? 'Seeds Locked' : 'Lock Seeds'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="h-12 w-12" />}
          title="No registrations to seed"
          description="Approve registrations before setting seeds."
        />
      ) : (
        <Card>
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.registration.id}
                className="flex items-center gap-3 p-2 rounded border border-(--color-border) bg-(--color-bg-primary)"
              >
                <Input
                  type="number"
                  value={row.seed ?? ''}
                  onChange={(e) => updateSeed(row.registration.id, e.target.value)}
                  placeholder="—"
                  className="w-20"
                  disabled={locked}
                />
                <div className="flex-1">
                  <p className="text-sm text-(--color-text-primary)">
                    {row.registration.team_id
                      ? `Team #${row.registration.team_id}`
                      : row.registration.player_id
                      ? `Player #${row.registration.player_id}`
                      : `Registration #${row.registration.id}`}
                  </p>
                  <p className="text-xs text-(--color-text-secondary)">
                    {row.registration.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-(--color-text-secondary) mt-3">
        {locked
          ? 'Seeds locked — ready for bracket generation.'
          : 'Draft seeds. Lock seeds before generating the bracket.'}
      </p>
    </div>
  )
}
