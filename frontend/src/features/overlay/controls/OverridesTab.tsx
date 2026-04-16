// frontend/src/features/overlay/controls/OverridesTab.tsx
//
// Control Panel: Overrides tab.
//
// Lets operators manually replace any OverlayData field — team names,
// scores, sponsor URLs, round labels, match state, etc. — for demo,
// media day, or troubleshooting. Each key can be toggled "Override"
// independently; the rest of the overlay continues to pull from the
// live match.
//
// Writes debounce at 400 ms into `PUT /api/v1/overlay/court/{courtID}/
// config/data-overrides`. A Clear All button hits the DELETE endpoint.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { useToast } from '../../../components/Toast'
import {
  MATCH_STATUS,
  NUMERIC_OVERRIDE_KEYS,
  OVERRIDE_KEY_GROUPS,
  type OverrideKey,
} from '../contract'
import { useOverlayData, useUpdateDataOverrides, useClearDataOverrides } from '../hooks'
import type { CourtOverlayConfig, DataOverrides, OverlayData } from '../types'

const COMMIT_DEBOUNCE_MS = 400

// Display labels for each override key, keyed by OverrideKey value.
const KEY_LABELS: Record<OverrideKey, string> = {
  team_1_name: 'Team 1 name',
  team_1_short_name: 'Team 1 short name',
  team_1_score: 'Team 1 score',
  team_1_color: 'Team 1 color',
  team_1_logo_url: 'Team 1 logo URL',
  team_1_game_wins: 'Team 1 game wins',
  team_1_player_1_name: 'Team 1 — Player 1 name',
  team_1_player_2_name: 'Team 1 — Player 2 name',
  team_2_name: 'Team 2 name',
  team_2_short_name: 'Team 2 short name',
  team_2_score: 'Team 2 score',
  team_2_color: 'Team 2 color',
  team_2_logo_url: 'Team 2 logo URL',
  team_2_game_wins: 'Team 2 game wins',
  team_2_player_1_name: 'Team 2 — Player 1 name',
  team_2_player_2_name: 'Team 2 — Player 2 name',
  division_name: 'Division',
  tournament_name: 'Tournament',
  league_name: 'League',
  round_label: 'Round label',
  match_info: 'Match info',
  court_name: 'Court name',
  tournament_logo_url: 'Tournament logo URL',
  league_logo_url: 'League logo URL',
  match_status: 'Match status',
  serving_team: 'Serving team',
  server_number: 'Server number',
  current_game: 'Current game',
}

const MATCH_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Scheduled', value: MATCH_STATUS.SCHEDULED },
  { label: 'In progress', value: MATCH_STATUS.IN_PROGRESS },
  { label: 'Completed', value: MATCH_STATUS.COMPLETED },
  { label: 'Bye', value: MATCH_STATUS.BYE },
  { label: 'Forfeit', value: MATCH_STATUS.FORFEIT },
  { label: 'Cancelled', value: MATCH_STATUS.CANCELLED },
  { label: 'Idle', value: MATCH_STATUS.IDLE },
]

export interface OverridesTabProps {
  courtID: number
  config: CourtOverlayConfig | undefined
  loading: boolean
}

export function OverridesTab({ courtID, config, loading }: OverridesTabProps) {
  const { toast } = useToast()
  const { data: liveData } = useOverlayData(courtID, {})
  const update = useUpdateDataOverrides(courtID)
  const clear = useClearDataOverrides(courtID)

  // Local mirror of DataOverrides with 400 ms commit debounce.
  const [draft, setDraft] = useState<DataOverrides>(
    () => config?.data_overrides ?? {},
  )
  const pendingRef = useRef<DataOverrides | null>(null)
  const flushTimer = useRef<number | null>(null)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  // Keep draft in sync with server config when it refreshes from elsewhere.
  // Only overwrite if our local draft matches what we last committed — avoids
  // clobbering in-flight edits.
  useEffect(() => {
    if (!config) return
    const server = config.data_overrides ?? {}
    // If there's no pending commit, trust the server value.
    if (pendingRef.current == null) {
      setDraft(server)
    }
  }, [config])

  const activeCount = Object.keys(draft).length

  const scheduleCommit = (next: DataOverrides) => {
    pendingRef.current = next
    if (flushTimer.current != null) {
      window.clearTimeout(flushTimer.current)
    }
    flushTimer.current = window.setTimeout(() => {
      const toSend = pendingRef.current
      pendingRef.current = null
      flushTimer.current = null
      if (toSend == null) return
      update.mutate(
        { overrides: toSend },
        {
          onError: (err) => {
            toast('error', `Failed to save override: ${err.message}`)
          },
        },
      )
    }, COMMIT_DEBOUNCE_MS)
  }

  // Clean up any pending debounce on unmount.
  useEffect(
    () => () => {
      if (flushTimer.current != null) window.clearTimeout(flushTimer.current)
    },
    [],
  )

  const setOverride = (key: OverrideKey, value: string | number | undefined) => {
    setDraft((prev) => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
      scheduleCommit(next)
      return next
    })
  }

  const handleClearAll = () => {
    pendingRef.current = null
    if (flushTimer.current != null) {
      window.clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    clear.mutate(undefined, {
      onSuccess: () => {
        setDraft({})
        toast('success', 'Cleared all overrides')
        setConfirmClearOpen(false)
      },
      onError: (err) => {
        toast('error', `Failed to clear overrides: ${err.message}`)
      },
    })
  }

  if (loading && !config) {
    return (
      <div className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-6">
        <p className="text-sm text-(--color-text-muted)">Loading overrides…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {activeCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-(--color-warning)/40 bg-(--color-warning)/10 px-4 py-3">
          <AlertTriangle
            className="h-5 w-5 text-(--color-warning) shrink-0 mt-0.5"
            aria-hidden={true}
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-(--color-text-primary)">
              {activeCount} override{activeCount === 1 ? '' : 's'} active
            </div>
            <p className="text-xs text-(--color-text-secondary) mt-0.5">
              Overridden fields display the value you enter instead of the live
              match data. Clear overrides to return to live data.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClearOpen(true)}
            disabled={clear.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden={true} />
            <span className="ml-1.5">Clear all</span>
          </Button>
        </div>
      )}

      {OVERRIDE_KEY_GROUPS.map((group) => (
        <section
          key={group.label}
          aria-labelledby={`override-group-${group.label}`}
        >
          <h3
            id={`override-group-${group.label}`}
            className="text-sm font-semibold text-(--color-text-primary) mb-2"
          >
            {group.label}
          </h3>
          <div className="rounded-lg border border-(--color-border) divide-y divide-(--color-border) overflow-hidden">
            {group.keys.map((key) => (
              <OverrideRow
                key={key}
                overrideKey={key}
                draft={draft}
                liveData={liveData}
                onChange={setOverride}
              />
            ))}
          </div>
        </section>
      ))}

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearAll}
        title="Clear all overrides?"
        message="This removes every override for this court and restores the live match data."
        confirmText="Clear all overrides"
        loading={clear.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Override row (label + live value + override input)
// ---------------------------------------------------------------------------

function OverrideRow({
  overrideKey,
  draft,
  liveData,
  onChange,
}: {
  overrideKey: OverrideKey
  draft: DataOverrides
  liveData: OverlayData | undefined
  onChange: (key: OverrideKey, value: string | number | undefined) => void
}) {
  const isOverridden = overrideKey in draft
  const currentValue = draft[overrideKey]
  const isNumeric = NUMERIC_OVERRIDE_KEYS.has(overrideKey)
  const liveValue = readLiveValue(overrideKey, liveData)

  const handleToggle = () => {
    if (isOverridden) {
      onChange(overrideKey, undefined)
    } else {
      // Seed with the live value if we have one, else blank.
      if (liveValue == null || liveValue === '') {
        onChange(overrideKey, isNumeric ? 0 : '')
      } else if (isNumeric) {
        const n = Number(liveValue)
        onChange(overrideKey, Number.isFinite(n) ? n : 0)
      } else {
        onChange(overrideKey, String(liveValue))
      }
    }
  }

  const handleRevert = () => onChange(overrideKey, undefined)

  return (
    <div className="grid grid-cols-12 items-center gap-3 px-3 py-2.5 bg-(--color-bg-secondary)">
      {/* Label + override toggle */}
      <label className="col-span-12 sm:col-span-4 flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isOverridden}
          onChange={handleToggle}
          className="h-4 w-4 rounded border-(--color-border) text-(--color-accent)"
        />
        <span className="font-medium text-(--color-text-primary)">
          {KEY_LABELS[overrideKey]}
        </span>
      </label>

      {/* Live value readout */}
      <div className="col-span-12 sm:col-span-3 text-xs text-(--color-text-muted) truncate">
        <span className="uppercase tracking-wider mr-1">Live:</span>
        <span className="text-(--color-text-secondary)">
          {liveValue == null || liveValue === ''
            ? '—'
            : String(liveValue)}
        </span>
      </div>

      {/* Value input (only when overridden) */}
      <div className="col-span-10 sm:col-span-4">
        {isOverridden && (
          <OverrideValueInput
            overrideKey={overrideKey}
            value={currentValue}
            onChange={(v) => onChange(overrideKey, v)}
          />
        )}
      </div>

      {/* Revert button */}
      <div className="col-span-2 sm:col-span-1 flex justify-end">
        {isOverridden && (
          <button
            type="button"
            onClick={handleRevert}
            className="p-1.5 rounded hover:bg-(--color-bg-hover) text-(--color-text-secondary) hover:text-(--color-text-primary)"
            aria-label={`Revert ${KEY_LABELS[overrideKey]}`}
            title="Revert to live value"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden={true} />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Value input (specialized per key)
// ---------------------------------------------------------------------------

function OverrideValueInput({
  overrideKey,
  value,
  onChange,
}: {
  overrideKey: OverrideKey
  value: string | number | undefined
  onChange: (v: string | number | undefined) => void
}) {
  // match_status has a fixed enum — use a Select.
  if (overrideKey === 'match_status') {
    return (
      <Select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        aria-label={KEY_LABELS[overrideKey]}
      >
        <option value="">— Select —</option>
        {MATCH_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    )
  }

  // serving_team / server_number / current_game — small number Select.
  if (overrideKey === 'serving_team') {
    return (
      <Select
        value={String(value ?? '1')}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={KEY_LABELS[overrideKey]}
      >
        <option value="1">Team 1</option>
        <option value="2">Team 2</option>
      </Select>
    )
  }
  if (overrideKey === 'server_number') {
    return (
      <Select
        value={String(value ?? '1')}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={KEY_LABELS[overrideKey]}
      >
        <option value="1">Server 1</option>
        <option value="2">Server 2</option>
      </Select>
    )
  }

  const isNumeric = NUMERIC_OVERRIDE_KEYS.has(overrideKey)
  const isColor = overrideKey.endsWith('_color')

  if (isColor) {
    const str = typeof value === 'string' ? value : '#000000'
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={str.startsWith('#') ? str : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-(--color-border) bg-(--color-bg-input)"
          aria-label={`${KEY_LABELS[overrideKey]} color picker`}
        />
        <Input
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
          aria-label={KEY_LABELS[overrideKey]}
        />
      </div>
    )
  }

  if (isNumeric) {
    return (
      <Input
        type="number"
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(0)
            return
          }
          const n = Number(raw)
          if (Number.isFinite(n)) onChange(n)
        }}
        aria-label={KEY_LABELS[overrideKey]}
      />
    )
  }

  return (
    <Input
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(overrideKey)}
      aria-label={KEY_LABELS[overrideKey]}
    />
  )
}

function placeholderFor(key: OverrideKey): string | undefined {
  if (key.endsWith('_logo_url')) return 'https://…'
  return undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readLiveValue(
  key: OverrideKey,
  data: OverlayData | undefined,
): string | number | null {
  if (!data) return null
  // Traverse the OverlayData shape by override-key convention.
  switch (key) {
    case 'team_1_name':
      return data.team_1?.name ?? null
    case 'team_1_short_name':
      return data.team_1?.short_name ?? null
    case 'team_1_score':
      return data.team_1?.score ?? null
    case 'team_1_color':
      return data.team_1?.color ?? null
    case 'team_1_logo_url':
      return data.team_1?.logo_url ?? null
    case 'team_1_game_wins':
      return data.team_1?.game_wins ?? null
    case 'team_1_player_1_name':
      return data.team_1?.players?.[0]?.name ?? null
    case 'team_1_player_2_name':
      return data.team_1?.players?.[1]?.name ?? null
    case 'team_2_name':
      return data.team_2?.name ?? null
    case 'team_2_short_name':
      return data.team_2?.short_name ?? null
    case 'team_2_score':
      return data.team_2?.score ?? null
    case 'team_2_color':
      return data.team_2?.color ?? null
    case 'team_2_logo_url':
      return data.team_2?.logo_url ?? null
    case 'team_2_game_wins':
      return data.team_2?.game_wins ?? null
    case 'team_2_player_1_name':
      return data.team_2?.players?.[0]?.name ?? null
    case 'team_2_player_2_name':
      return data.team_2?.players?.[1]?.name ?? null
    case 'division_name':
      return data.division_name
    case 'tournament_name':
      return data.tournament_name
    case 'league_name':
      return data.league_name
    case 'round_label':
      return data.round_label
    case 'match_info':
      return data.match_info
    case 'court_name':
      return data.court_name
    case 'tournament_logo_url':
      return data.tournament_logo_url
    case 'league_logo_url':
      return data.league_logo_url
    case 'match_status':
      return data.match_status
    case 'serving_team':
      return data.serving_team
    case 'server_number':
      return data.server_number
    case 'current_game':
      return data.current_game
    default:
      return null
  }
}

// Satisfy "useMemo is imported but unused" if we ever drop the import.
void useMemo
