// web/src/features/overlay/controls/SourceTab.tsx
//
// Control Panel: Source tab.
//
// Chooses where overlay data comes from:
//   - Internal  → a live Court Command match scheduled on this court.
//                 (No binding required; the resolver picks up the active
//                 match automatically via CourtOverlayConfig.court_id.)
//   - External  → a SourceProfile the operator has configured, which
//                 polls/webhooks into the overlay resolver.
//
// Behind the scenes we only persist one thing: the source_profile_id
// on CourtOverlayConfig. Internal mode sets it to null; External mode
// sets it to the chosen profile. The "active match" dropdown for
// Internal is informational only — the resolver picks the active match
// for a court automatically.
//
// Last-update timestamp polls every 5s so operators can see that data
// is still flowing. We reuse the overlay data query with an explicit
// refetchInterval via useOverlayData.

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, ExternalLink, Loader2, Wifi, WifiOff } from 'lucide-react'
import { FormField } from '../../../components/FormField'
import { Select } from '../../../components/Select'
import { useToast } from '../../../components/Toast'
import { useCourtMatches } from '../../scoring/hooks'
import type { Match, MatchStatus } from '../../scoring/types'
import type { CourtOverlayConfig, SourceProfile } from '../types'
import {
  useOverlayData,
  useSourceProfiles,
  useUpdateSourceProfileBinding,
} from '../hooks'

export interface SourceTabProps {
  courtID: number
  config: CourtOverlayConfig | undefined
  loading: boolean
}

type SourceMode = 'internal' | 'external'

// Match statuses that represent "on this court right now".
const ACTIVE_MATCH_STATUSES: ReadonlySet<MatchStatus> = new Set<MatchStatus>([
  'warmup',
  'in_progress',
  'paused',
])

export function SourceTab({ courtID, config, loading }: SourceTabProps) {
  const { toast } = useToast()
  const updateBinding = useUpdateSourceProfileBinding(courtID)

  const profilesQuery = useSourceProfiles()
  const matchesQuery = useCourtMatches(courtID)

  // Poll the overlay data every 5s so we can show "last updated".
  const dataQuery = useOverlayData(courtID, {})

  const boundProfileID = normalizeProfileID(config?.source_profile_id)
  const mode: SourceMode = boundProfileID == null ? 'internal' : 'external'

  // Filter to matches that are currently scheduled / live on this court.
  const matchOptions = useMemo<Match[]>(() => {
    const all = matchesQuery.data ?? []
    return all
      .filter((m) => ACTIVE_MATCH_STATUSES.has(m.status) || m.status === 'scheduled')
      .slice(0, 20)
  }, [matchesQuery.data])

  const activeMatch = useMemo<Match | undefined>(
    () =>
      matchOptions.find((m) => ACTIVE_MATCH_STATUSES.has(m.status)) ??
      matchOptions[0],
    [matchOptions],
  )

  const activeProfile = useMemo<SourceProfile | undefined>(() => {
    if (boundProfileID == null) return undefined
    return profilesQuery.data?.find((p) => p.id === boundProfileID)
  }, [profilesQuery.data, boundProfileID])

  const handleModeChange = async (next: SourceMode) => {
    if (next === mode) return
    if (next === 'internal') {
      // Clear the binding.
      try {
        await updateBinding.mutateAsync({ source_profile_id: null })
        toast('success', 'Switched to Court Command match data')
      } catch (err) {
        toast('error', (err as Error).message || 'Failed to clear source profile')
      }
      return
    }
    // External: need at least one active profile to bind to.
    const firstActive = profilesQuery.data?.find((p) => p.is_active)
    if (!firstActive) {
      toast(
        'warning',
        'No active source profiles. Create one under Source Profiles first.',
      )
      return
    }
    try {
      await updateBinding.mutateAsync({ source_profile_id: firstActive.id })
      toast('success', `Bound to source profile “${firstActive.name}”`)
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to bind source profile')
    }
  }

  const handleProfileChange = async (nextID: number | null) => {
    try {
      await updateBinding.mutateAsync({ source_profile_id: nextID })
      toast('success', nextID ? 'Source profile updated' : 'Source profile cleared')
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to update source profile')
    }
  }

  if (loading || !config) {
    return (
      <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading source settings…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mode picker */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-(--color-text-primary)">
          Data source
        </legend>
        <p className="text-xs text-(--color-text-muted)">
          Internal pulls live data from a Court Command match scheduled on
          this court. External polls or receives webhooks from an API you
          configure under Source Profiles.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <ModeOption
            id="source-mode-internal"
            label="Internal — Court Command match"
            description="Use the live match currently assigned to this court."
            checked={mode === 'internal'}
            onChange={() => handleModeChange('internal')}
            disabled={updateBinding.isPending}
          />
          <ModeOption
            id="source-mode-external"
            label="External — Source Profile"
            description="Pull from an HTTP API or webhook you own."
            checked={mode === 'external'}
            onChange={() => handleModeChange('external')}
            disabled={updateBinding.isPending}
          />
        </div>
      </fieldset>

      {/* Internal mode — active match readout */}
      {mode === 'internal' && (
        <section className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-4 space-y-3">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">
            Active match
          </h3>
          {matchesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading matches…
            </div>
          ) : matchOptions.length === 0 ? (
            <p className="text-sm text-(--color-text-muted)">
              No matches are scheduled on this court. The overlay will show
              the configured idle display until a match is assigned.
            </p>
          ) : (
            <>
              <ActiveMatchSummary match={activeMatch} />
              {matchOptions.length > 1 && (
                <details className="mt-3">
                  <summary className="text-xs text-(--color-text-secondary) cursor-pointer">
                    Other matches on this court ({matchOptions.length - 1})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {matchOptions
                      .filter((m) => m.id !== activeMatch?.id)
                      .map((m) => (
                        <li
                          key={m.id}
                          className="text-xs text-(--color-text-muted) flex items-center gap-2"
                        >
                          <span className="font-mono">{m.public_id}</span>
                          <span>·</span>
                          <span>{m.status}</span>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {/* External mode — profile picker */}
      {mode === 'external' && (
        <section className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-(--color-text-primary)">
                Source profile
              </h3>
              <p className="text-xs text-(--color-text-muted)">
                Pick which profile feeds this court.
              </p>
            </div>
            <Link
              to="/overlay/source-profiles"
              className="inline-flex items-center gap-1 text-xs text-(--color-accent) hover:underline"
            >
              Manage profiles <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {profilesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading profiles…
            </div>
          ) : (profilesQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-(--color-text-muted)">
              You haven&apos;t created any source profiles yet.{' '}
              <Link
                to="/overlay/source-profiles"
                className="text-(--color-accent) hover:underline"
              >
                Create one →
              </Link>
            </p>
          ) : (
            <FormField label="Profile" htmlFor="source-profile-select">
              <Select
                id="source-profile-select"
                value={boundProfileID != null ? String(boundProfileID) : ''}
                onChange={(e) => {
                  const val = e.target.value
                  handleProfileChange(val ? Number(val) : null)
                }}
                disabled={updateBinding.isPending}
              >
                {profilesQuery.data!.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {activeProfile && (
            <ProfileDetails profile={activeProfile} />
          )}
        </section>
      )}

      {/* Live data status — polls every 5s */}
      <LiveDataStatus
        loading={dataQuery.isLoading}
        error={dataQuery.isError}
        updatedAt={dataQuery.dataUpdatedAt}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModeOption({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={[
        'cursor-pointer rounded-lg border p-3 transition-colors',
        checked
          ? 'border-(--color-accent) bg-(--color-accent)/5'
          : 'border-(--color-border) hover:border-(--color-text-muted)',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="radio"
          name="source-mode"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="mt-1"
        />
        <div>
          <div className="text-sm font-medium text-(--color-text-primary)">
            {label}
          </div>
          <p className="text-xs text-(--color-text-muted) mt-1">{description}</p>
        </div>
      </div>
    </label>
  )
}

function ActiveMatchSummary({ match }: { match: Match | undefined }) {
  if (!match) {
    return (
      <p className="text-sm text-(--color-text-muted)">
        No match currently tied to this court.
      </p>
    )
  }
  const team1 = match.team_1?.name ?? 'Team 1'
  const team2 = match.team_2?.name ?? 'Team 2'
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-(--color-text-primary)">
          {team1} vs {team2}
        </div>
        <div className="text-xs text-(--color-text-muted) mt-0.5">
          <span className="font-mono">{match.public_id}</span>
          <span className="mx-1.5">·</span>
          Status: {match.status}
          <span className="mx-1.5">·</span>
          Game {match.current_game}
        </div>
      </div>
      <div className="text-xs text-(--color-text-secondary) font-mono whitespace-nowrap">
        {match.team_1_score} – {match.team_2_score}
      </div>
    </div>
  )
}

function ProfileDetails({ profile }: { profile: SourceProfile }) {
  const pollSeconds = normalizePollInterval(profile.poll_interval_seconds)
  const lastPollAt = normalizeTimestamp(profile.last_poll_at)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt className="text-(--color-text-muted)">Type</dt>
      <dd className="text-(--color-text-secondary) font-mono">{profile.source_type}</dd>

      {profile.api_url && (
        <>
          <dt className="text-(--color-text-muted)">URL</dt>
          <dd className="text-(--color-text-secondary) font-mono truncate">
            {profile.api_url}
          </dd>
        </>
      )}

      {pollSeconds != null && (
        <>
          <dt className="text-(--color-text-muted)">Poll cadence</dt>
          <dd className="text-(--color-text-secondary)">Every {pollSeconds}s</dd>
        </>
      )}

      <dt className="text-(--color-text-muted)">Last poll</dt>
      <dd className="text-(--color-text-secondary)">
        {lastPollAt ? formatRelativeTime(lastPollAt) : 'Never'}
        {profile.last_poll_status && (
          <span className="ml-2 text-(--color-text-muted)">
            ({profile.last_poll_status})
          </span>
        )}
      </dd>
    </dl>
  )
}

function LiveDataStatus({
  loading,
  error,
  updatedAt,
}: {
  loading: boolean
  error: boolean
  updatedAt: number
}) {
  const [now, setNow] = useLiveTimestamp(1000)
  void setNow

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading live data…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-(--color-error)">
        <WifiOff className="h-3.5 w-3.5" />
        Could not fetch live overlay data.
      </div>
    )
  }
  if (!updatedAt) {
    return null
  }
  const ago = Math.max(0, Math.floor((now - updatedAt) / 1000))
  const fresh = ago < 10
  return (
    <div className="flex items-center gap-2 text-xs">
      {fresh ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-(--color-success)" />
      ) : (
        <Wifi className="h-3.5 w-3.5 text-(--color-text-muted)" />
      )}
      <span className={fresh ? 'text-(--color-success)' : 'text-(--color-text-muted)'}>
        Last update {ago}s ago
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeProfileID(
  raw: CourtOverlayConfig['source_profile_id'] | undefined,
): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && 'Int64' in raw) {
    return raw.Valid ? Number(raw.Int64) : null
  }
  return null
}

function normalizePollInterval(
  raw: SourceProfile['poll_interval_seconds'],
): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && 'Int32' in raw) {
    return raw.Valid ? raw.Int32 : null
  }
  return null
}

function normalizeTimestamp(raw: SourceProfile['last_poll_at']): Date | null {
  if (raw == null) return null
  if (typeof raw === 'string') return new Date(raw)
  if (typeof raw === 'object' && 'Time' in raw) {
    return raw.Valid ? new Date(raw.Time) : null
  }
  return null
}

function formatRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return d.toLocaleString()
}

// Minimal live timestamp for re-rendering the "N seconds ago" readout.
function useLiveTimestamp(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return [now, setNow] as const
}
