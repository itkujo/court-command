// frontend/src/features/overlay/controls/ElementsTab.tsx
//
// Control Panel: Elements tab.
//
// Per-element controls for the 12 canonical overlay elements. Each
// element has a visibility toggle (the primary on/off) and optionally
// a small set of per-element knobs (rotation cadence, auto-dismiss
// timers, text content, zone placement). Updates flow through the
// single PUT /config/elements endpoint — we merge locally, debounce,
// then send the whole ElementsConfig object server-side in one call.
//
// Grouping: elements are organized by visual zone so the operator can
// scan the UI and understand where each element lives on-screen.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Eye, Loader2 } from 'lucide-react'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { FormField } from '../../../components/FormField'
import { useToast } from '../../../components/Toast'
import { cn } from '../../../lib/cn'
import type {
  CourtOverlayConfig,
  CustomTextConfig,
  ElementsConfig,
  MatchResultConfig,
  PlayerCardConfig,
  ScoreboardConfig,
  ScoreboardLayout,
  SponsorBugConfig,
  TeamCardConfig,
} from '../types'
import { ELEMENT_KEY, type ElementKey } from '../contract'
import { useUpdateElements } from '../hooks'
import { SCOREBOARD_LAYOUT_OPTIONS } from '../renderer/elements/scoreboard'
import {
  OFFSET_MAX,
  OFFSET_MIN,
  OFFSET_STEP,
  POSITION_OPTIONS,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
} from '../renderer/elements/scoreboard/transforms'
import type { ScoreboardPosition } from '../types'

// Debounce interval for text / number inputs before firing the PUT.
const COMMIT_DEBOUNCE_MS = 400

// Visual grouping for the UI (does not affect the wire shape).
interface ElementGroup {
  label: string
  description: string
  keys: ElementKey[]
}

const ELEMENT_GROUPS: ElementGroup[] = [
  {
    label: 'Core',
    description: 'Always-on elements that carry live scoreboard data.',
    keys: [ELEMENT_KEY.SCOREBOARD, ELEMENT_KEY.SERIES_SCORE],
  },
  {
    label: 'Branding',
    description: 'Sponsor rotator, tournament logo, and match banners.',
    keys: [
      ELEMENT_KEY.SPONSOR_BUG,
      ELEMENT_KEY.TOURNAMENT_BUG,
      ELEMENT_KEY.LOWER_THIRD,
    ],
  },
  {
    label: 'Cards & callouts',
    description:
      'Trigger-fired overlays for player intros, team rosters, and operator text.',
    keys: [
      ELEMENT_KEY.PLAYER_CARD,
      ELEMENT_KEY.TEAM_CARD,
      ELEMENT_KEY.MATCH_RESULT,
      ELEMENT_KEY.CUSTOM_TEXT,
    ],
  },
  {
    label: 'Tournament context',
    description: 'Narrative elements shown between matches.',
    keys: [
      ELEMENT_KEY.COMING_UP_NEXT,
      ELEMENT_KEY.BRACKET_SNAPSHOT,
      ELEMENT_KEY.POOL_STANDINGS,
    ],
  },
]

const ELEMENT_LABELS: Record<ElementKey, string> = {
  scoreboard: 'Scoreboard',
  lower_third: 'Lower third',
  player_card: 'Player card',
  team_card: 'Team card',
  sponsor_bug: 'Sponsor bug',
  tournament_bug: 'Tournament bug',
  coming_up_next: 'Coming up next',
  match_result: 'Match result',
  custom_text: 'Custom text',
  bracket_snapshot: 'Bracket snapshot',
  pool_standings: 'Pool standings',
  series_score: 'Series score',
}

const ELEMENT_DESCRIPTIONS: Record<ElementKey, string> = {
  scoreboard:
    'Bottom-left persistent scoreboard with team rows, serve indicator, game history, and timeouts.',
  lower_third: 'Full-width announcement banner. Slides up from the bottom.',
  player_card: 'Center-bottom card introducing a selected player.',
  team_card: 'Center-bottom card showing both rosters side-by-side.',
  sponsor_bug: 'Top-right rotating sponsor logos.',
  tournament_bug: 'Top-left static tournament or league mark.',
  coming_up_next:
    'Top-center banner teasing the next match in the court queue.',
  match_result:
    'Full-center winner reveal with confetti. Shown at match completion.',
  custom_text: 'Operator-controlled free-form text banner.',
  bracket_snapshot: 'Full-center bracket snapshot (between-match narrative).',
  pool_standings:
    'Full-center pool standings table (between-match narrative).',
  series_score: 'Top-right dot grid showing BO3/BO5/BO7 series progress.',
}

const CUSTOM_TEXT_ZONES = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
]

const DISMISS_OPTIONS = [
  { value: '0', label: 'Manual (stay until dismissed)' },
  { value: '5', label: 'Auto dismiss after 5s' },
  { value: '10', label: 'Auto dismiss after 10s' },
  { value: '30', label: 'Auto dismiss after 30s' },
  { value: '60', label: 'Auto dismiss after 60s' },
]

interface ElementsTabProps {
  courtID: number
  config: CourtOverlayConfig | undefined
  loading: boolean
}

export function ElementsTab({ courtID, config, loading }: ElementsTabProps) {
  const { toast } = useToast()
  const updateElements = useUpdateElements(courtID)

  // Local draft that reflects the server config but can be edited
  // freely. The debounce timer flushes to the server.
  const [draft, setDraft] = useState<ElementsConfig | null>(null)
  const flushTimer = useRef<number | null>(null)
  const pendingRef = useRef<ElementsConfig | null>(null)

  useEffect(() => {
    if (config?.elements) {
      setDraft(config.elements)
    }
  }, [config?.elements])

  // Clean up timer on unmount.
  useEffect(() => () => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current)
  }, [])

  function commit(next: ElementsConfig) {
    pendingRef.current = next
    if (flushTimer.current) window.clearTimeout(flushTimer.current)
    flushTimer.current = window.setTimeout(() => {
      const pending = pendingRef.current
      if (!pending) return
      updateElements.mutate(
        { elements: pending },
        {
          onError: (err) => {
            toast('error', err.message || 'Could not save element settings')
          },
        },
      )
    }, COMMIT_DEBOUNCE_MS)
  }

  function patch<K extends ElementKey>(
    key: K,
    patchValue: Partial<ElementsConfig[K]>,
  ) {
    if (!draft) return
    const next: ElementsConfig = {
      ...draft,
      [key]: { ...draft[key], ...patchValue },
    }
    setDraft(next)
    commit(next)
  }

  if (loading || !draft) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-(--color-text-secondary)">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading elements…</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SaveIndicator pending={updateElements.isPending} />

      {/* Top: scannable toggle grid grouped by zone, collapsible so
          operators can keep the preview visible while working the
          Settings section below. */}
      <VisibilitySection courtID={courtID} draft={draft} patch={patch} />

      {/* Bottom: collapsibles for elements that have knobs. */}
      <section aria-label="Element settings">
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-(--color-text-primary) uppercase tracking-wider">
            Settings
          </h2>
          <p className="text-xs text-(--color-text-secondary) mt-0.5">
            Expand an element below to adjust its knobs (rotation speed,
            auto-dismiss timers, default text).
          </p>
        </header>
        <div className="space-y-2">
          {ALL_KEYS_FLAT.filter(elementHasKnobs).map((key) => (
            <SettingsRow
              key={key}
              elementKey={key}
              config={draft[key]}
              onPatch={(p) => patch(key, p)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

// Flat iteration order mirroring ELEMENT_GROUPS so settings appear in
// the same visual order as the toggle grid above.
const ALL_KEYS_FLAT: ElementKey[] = ELEMENT_GROUPS.flatMap((g) => g.keys)

// ---------------------------------------------------------------------------
// VisibilitySection — collapsible wrapper around the toggle grid.
// Persists its open/closed state in sessionStorage keyed by courtID so
// the operator's preference sticks when flipping between tabs.
// ---------------------------------------------------------------------------

interface VisibilitySectionProps {
  courtID: number
  draft: ElementsConfig
  patch: <K extends ElementKey>(
    key: K,
    patchValue: Partial<ElementsConfig[K]>,
  ) => void
}

function VisibilitySection({ courtID, draft, patch }: VisibilitySectionProps) {
  const storageKey = `cc:overlay:elements-visibility-collapsed:${courtID}`
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(storageKey, collapsed ? '1' : '0')
    } catch {
      // sessionStorage can throw in private mode — ignore
    }
  }, [collapsed, storageKey])

  const regionId = `elements-visibility-${courtID}`

  return (
    <section aria-label="Element visibility">
      <header
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border border-(--color-border) bg-(--color-bg-secondary) px-4 py-3',
          collapsed ? 'rounded-lg' : 'rounded-b-none border-b-0',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Eye className="h-4 w-4 text-(--color-text-secondary) shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-(--color-text-primary) uppercase tracking-wider">
              Visibility
            </h2>
            <p className="text-xs text-(--color-text-secondary) truncate">
              Toggle elements on or off. Collapse to give the preview more
              room while editing settings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={regionId}
          className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) rounded px-2 py-1"
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide
            </>
          )}
        </button>
      </header>

      {!collapsed && (
        <div
          id={regionId}
          className="space-y-5 rounded-b-lg border border-t-0 border-(--color-border) bg-(--color-bg-secondary) px-4 pt-4 pb-5"
        >
          {ELEMENT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">
                  {group.label}
                </h3>
                <p className="text-xs text-(--color-text-muted) truncate">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.keys.map((key) => (
                  <ToggleCell
                    key={key}
                    elementKey={key}
                    visible={draft[key].visible}
                    hasKnobs={elementHasKnobs(key)}
                    onToggle={(visible) =>
                      patch(key, { visible } as Partial<
                        ElementsConfig[typeof key]
                      >)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// ToggleCell — compact visibility toggle used in the grid
// ---------------------------------------------------------------------------

interface ToggleCellProps {
  elementKey: ElementKey
  visible: boolean
  hasKnobs: boolean
  onToggle: (visible: boolean) => void
}

function ToggleCell({
  elementKey,
  visible,
  hasKnobs,
  onToggle,
}: ToggleCellProps) {
  const rowId = `toggle-${elementKey}`
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        visible
          ? 'border-cyan-500/40 bg-(--color-bg-secondary)'
          : 'border-(--color-border) bg-(--color-bg-primary)',
      )}
    >
      <div className="flex-1 min-w-0">
        <label
          htmlFor={rowId}
          className="flex items-center gap-1.5 text-sm font-medium text-(--color-text-primary) cursor-pointer"
        >
          <span className="truncate">{ELEMENT_LABELS[elementKey]}</span>
          {hasKnobs && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400/70 flex-shrink-0"
              aria-label="Has additional settings"
              title="Has additional settings"
            />
          )}
        </label>
        <p className="text-xs text-(--color-text-muted) mt-0.5 truncate">
          {ELEMENT_DESCRIPTIONS[elementKey]}
        </p>
      </div>
      <Toggle
        id={rowId}
        checked={visible}
        onChange={onToggle}
        label={`Toggle ${ELEMENT_LABELS[elementKey]}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsRow — collapsible per-element knobs (visibility lives in grid above)
// ---------------------------------------------------------------------------

interface SettingsRowProps<K extends ElementKey> {
  elementKey: K
  config: ElementsConfig[K]
  onPatch: (patch: Partial<ElementsConfig[K]>) => void
}

function SettingsRow<K extends ElementKey>({
  elementKey,
  config,
  onPatch,
}: SettingsRowProps<K>) {
  const [expanded, setExpanded] = useState(false)
  const rowId = `settings-${elementKey}`

  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-bg-primary)">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`${rowId}-panel`}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-(--color-bg-hover) rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
      >
        <div className="flex h-6 w-6 items-center justify-center text-(--color-text-secondary) flex-shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-(--color-text-primary)">
            {ELEMENT_LABELS[elementKey]}
          </div>
          <p className="text-xs text-(--color-text-secondary) mt-0.5 truncate">
            {settingsHint(elementKey)}
          </p>
        </div>
      </button>

      {expanded && (
        <div
          id={`${rowId}-panel`}
          className="border-t border-(--color-border) p-4"
        >
          <ElementKnobs
            elementKey={elementKey}
            config={config}
            onPatch={onPatch}
          />
        </div>
      )}
    </div>
  )
}

// Short descriptor shown on the collapsed settings row summarizing
// what the operator can tune.
function settingsHint(key: ElementKey): string {
  switch (key) {
    case ELEMENT_KEY.SCOREBOARD:
      return 'Layout (Classic / Banner)'
    case ELEMENT_KEY.SPONSOR_BUG:
      return 'Rotation cadence · auto-animate'
    case ELEMENT_KEY.PLAYER_CARD:
      return 'Default auto-dismiss timer'
    case ELEMENT_KEY.TEAM_CARD:
      return 'Default auto-dismiss timer'
    case ELEMENT_KEY.MATCH_RESULT:
      return 'Show delay · dismiss timer'
    case ELEMENT_KEY.CUSTOM_TEXT:
      return 'Default text · placement zone · auto-dismiss'
    default:
      return 'No additional settings'
  }
}

// ---------------------------------------------------------------------------
// Knob renderers per element kind
// ---------------------------------------------------------------------------

function elementHasKnobs(key: ElementKey): boolean {
  return (
    key === ELEMENT_KEY.SCOREBOARD ||
    key === ELEMENT_KEY.SPONSOR_BUG ||
    key === ELEMENT_KEY.PLAYER_CARD ||
    key === ELEMENT_KEY.TEAM_CARD ||
    key === ELEMENT_KEY.MATCH_RESULT ||
    key === ELEMENT_KEY.CUSTOM_TEXT
  )
}

interface KnobsProps<K extends ElementKey> {
  elementKey: K
  config: ElementsConfig[K]
  onPatch: (patch: Partial<ElementsConfig[K]>) => void
}

function ElementKnobs<K extends ElementKey>({ elementKey, config, onPatch }: KnobsProps<K>) {
  switch (elementKey) {
    case ELEMENT_KEY.SCOREBOARD:
      return (
        <ScoreboardKnobs
          config={config as ScoreboardConfig}
          onPatch={onPatch as (p: Partial<ScoreboardConfig>) => void}
        />
      )
    case ELEMENT_KEY.SPONSOR_BUG:
      return (
        <SponsorBugKnobs
          config={config as SponsorBugConfig}
          onPatch={onPatch as (p: Partial<SponsorBugConfig>) => void}
        />
      )
    case ELEMENT_KEY.PLAYER_CARD:
      return (
        <CardDismissKnobs
          label="Player card"
          config={config as PlayerCardConfig}
          onPatch={onPatch as (p: Partial<PlayerCardConfig>) => void}
        />
      )
    case ELEMENT_KEY.TEAM_CARD:
      return (
        <CardDismissKnobs
          label="Team card"
          config={config as TeamCardConfig}
          onPatch={onPatch as (p: Partial<TeamCardConfig>) => void}
        />
      )
    case ELEMENT_KEY.MATCH_RESULT:
      return (
        <MatchResultKnobs
          config={config as MatchResultConfig}
          onPatch={onPatch as (p: Partial<MatchResultConfig>) => void}
        />
      )
    case ELEMENT_KEY.CUSTOM_TEXT:
      return (
        <CustomTextKnobs
          config={config as CustomTextConfig}
          onPatch={onPatch as (p: Partial<CustomTextConfig>) => void}
        />
      )
    default:
      return null
  }
}

function ScoreboardKnobs({
  config,
  onPatch,
}: {
  config: ScoreboardConfig
  onPatch: (p: Partial<ScoreboardConfig>) => void
}) {
  const current: ScoreboardLayout = config.layout ?? 'classic'
  const activeOption =
    SCOREBOARD_LAYOUT_OPTIONS.find((o) => o.value === current) ??
    SCOREBOARD_LAYOUT_OPTIONS[0]
  const defaultPosition: ScoreboardPosition =
    current === 'banner' ? 'bottom-center' : 'bottom-left'
  const currentPosition: ScoreboardPosition = config.position ?? defaultPosition

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Layout" htmlFor="scoreboard-layout">
          <Select
            id="scoreboard-layout"
            value={current}
            onChange={(e) =>
              onPatch({ layout: e.target.value as ScoreboardLayout })
            }
          >
            {SCOREBOARD_LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-(--color-text-secondary) mt-1">
            {activeOption.description}
          </p>
        </FormField>
        <FormField label="Position" htmlFor="scoreboard-position">
          <Select
            id="scoreboard-position"
            value={currentPosition}
            onChange={(e) =>
              onPatch({ position: e.target.value as ScoreboardPosition })
            }
          >
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-(--color-text-secondary) mt-1">
            Anchor on the 1920×1080 canvas. Classic defaults to bottom-left,
            Banner defaults to bottom-center.
          </p>
        </FormField>
      </div>

      {/* Per-logo controls. Banner layout renders tournament + team logos;
          Classic renders none, so these knobs are effectively no-ops there.
          Each group has size + X + Y for fine-tuning awkward source logos. */}
      <LogoKnobGroup
        idPrefix="scoreboard-tournament-logo"
        label="Tournament logo"
        scale={config.tournament_logo_scale}
        offsetX={config.tournament_logo_offset_x}
        offsetY={config.tournament_logo_offset_y}
        onChange={(patch) => onPatch(patch)}
        scaleKey="tournament_logo_scale"
        offsetXKey="tournament_logo_offset_x"
        offsetYKey="tournament_logo_offset_y"
      />
      <LogoKnobGroup
        idPrefix="scoreboard-team-1-logo"
        label="Team 1 logo"
        scale={config.team_1_logo_scale}
        offsetX={config.team_1_logo_offset_x}
        offsetY={config.team_1_logo_offset_y}
        onChange={(patch) => onPatch(patch)}
        scaleKey="team_1_logo_scale"
        offsetXKey="team_1_logo_offset_x"
        offsetYKey="team_1_logo_offset_y"
      />
      <LogoKnobGroup
        idPrefix="scoreboard-team-2-logo"
        label="Team 2 logo"
        scale={config.team_2_logo_scale}
        offsetX={config.team_2_logo_offset_x}
        offsetY={config.team_2_logo_offset_y}
        onChange={(patch) => onPatch(patch)}
        scaleKey="team_2_logo_scale"
        offsetXKey="team_2_logo_offset_x"
        offsetYKey="team_2_logo_offset_y"
      />
      <p className="text-xs text-(--color-text-secondary)">
        Scale ranges {Math.round(SCALE_MIN * 100)}% – {Math.round(SCALE_MAX * 100)}%.
        Offset range ±{OFFSET_MAX}px. Logos are allowed to bleed outside their
        slot so awkward source art can still look clean.
      </p>
    </div>
  )
}

type LogoScaleField =
  | 'tournament_logo_scale'
  | 'team_1_logo_scale'
  | 'team_2_logo_scale'
type LogoOffsetField =
  | 'tournament_logo_offset_x'
  | 'tournament_logo_offset_y'
  | 'team_1_logo_offset_x'
  | 'team_1_logo_offset_y'
  | 'team_2_logo_offset_x'
  | 'team_2_logo_offset_y'

function LogoKnobGroup({
  idPrefix,
  label,
  scale,
  offsetX,
  offsetY,
  onChange,
  scaleKey,
  offsetXKey,
  offsetYKey,
}: {
  idPrefix: string
  label: string
  scale: number | undefined
  offsetX: number | undefined
  offsetY: number | undefined
  onChange: (patch: Partial<ScoreboardConfig>) => void
  scaleKey: LogoScaleField
  offsetXKey: LogoOffsetField
  offsetYKey: LogoOffsetField
}) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-bg-secondary) p-3 space-y-3">
      <div className="text-xs uppercase tracking-widest font-semibold text-(--color-text-secondary)">
        {label}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LogoScaleSlider
          id={`${idPrefix}-scale`}
          label="Size"
          value={scale ?? 1}
          onChange={(v) =>
            onChange({ [scaleKey]: v } as Partial<ScoreboardConfig>)
          }
        />
        <LogoOffsetSlider
          id={`${idPrefix}-offset-x`}
          label="Offset X"
          value={offsetX ?? 0}
          onChange={(v) =>
            onChange({ [offsetXKey]: v } as Partial<ScoreboardConfig>)
          }
        />
        <LogoOffsetSlider
          id={`${idPrefix}-offset-y`}
          label="Offset Y"
          value={offsetY ?? 0}
          onChange={(v) =>
            onChange({ [offsetYKey]: v } as Partial<ScoreboardConfig>)
          }
        />
      </div>
    </div>
  )
}

/**
 * Range slider for the logo scale value, stepped in SCALE_STEP increments.
 * Clamps + rounds incoming values so the UI and wire contract stay coherent
 * even if a stale override drifts outside the range.
 */
function LogoScaleSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const clamped = Math.max(
    SCALE_MIN,
    Math.min(SCALE_MAX, Number.isFinite(value) ? value : 1),
  )
  const pct = Math.round(clamped * 100)
  const minPct = Math.round(SCALE_MIN * 100)
  const maxPct = Math.round(SCALE_MAX * 100)
  const stepPct = Math.round(SCALE_STEP * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-(--color-text-primary)"
        >
          {label}
        </label>
        <span className="text-xs tabular-nums text-(--color-text-secondary)">
          {pct}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={minPct}
        max={maxPct}
        step={stepPct}
        value={pct}
        onChange={(e) => {
          const next = Number(e.target.value) / 100
          if (Number.isFinite(next)) onChange(next)
        }}
        className="w-full accent-(--color-accent)"
        aria-label={`${label} scale`}
      />
    </div>
  )
}

/**
 * Range slider for a logo translate offset in CSS pixels.
 * Clamps incoming values to [OFFSET_MIN, OFFSET_MAX].
 */
function LogoOffsetSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const clamped = Math.max(
    OFFSET_MIN,
    Math.min(OFFSET_MAX, Number.isFinite(value) ? value : 0),
  )
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-(--color-text-primary)"
        >
          {label}
        </label>
        <span className="text-xs tabular-nums text-(--color-text-secondary)">
          {clamped > 0 ? `+${clamped}` : clamped}px
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={OFFSET_MIN}
        max={OFFSET_MAX}
        step={OFFSET_STEP}
        value={clamped}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="w-full accent-(--color-accent)"
        aria-label={`${label} offset`}
      />
    </div>
  )
}

function SponsorBugKnobs({
  config,
  onPatch,
}: {
  config: SponsorBugConfig
  onPatch: (p: Partial<SponsorBugConfig>) => void
}) {
  // Use a local input value so the text cursor doesn't jump while
  // the user is typing. We forward the parsed number on change.
  const rotation = config.rotation_seconds ?? 8
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Rotation cadence (seconds)" htmlFor="sponsor-rotation">
        <Input
          id="sponsor-rotation"
          type="number"
          min={2}
          max={120}
          step={1}
          value={rotation}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!Number.isFinite(v) || v <= 0) return
            onPatch({ rotation_seconds: v })
          }}
        />
        <p className="text-xs text-(--color-text-secondary) mt-1">
          How often logos cross-fade. Defaults to 8s if unset.
        </p>
      </FormField>
      <FormField label="Auto-animate" htmlFor="sponsor-animate">
        <Toggle
          id="sponsor-animate"
          checked={config.auto_animate ?? true}
          onChange={(checked) => onPatch({ auto_animate: checked })}
          label="Auto-animate sponsor rotation"
        />
      </FormField>
    </div>
  )
}

function CardDismissKnobs({
  label,
  config,
  onPatch,
}: {
  label: string
  config: PlayerCardConfig | TeamCardConfig
  onPatch: (p: Partial<PlayerCardConfig | TeamCardConfig>) => void
}) {
  const seconds = config.auto_dismiss_seconds ?? 0
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Default dismiss" htmlFor={`${label}-dismiss`}>
        <Select
          id={`${label}-dismiss`}
          value={String(seconds)}
          onChange={(e) =>
            onPatch({ auto_dismiss_seconds: parseInt(e.target.value, 10) || 0 })
          }
        >
          {DISMISS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-(--color-text-secondary) mt-1">
          When a trigger fires this card, this is the default timer.
          Operators can still override per-trigger.
        </p>
      </FormField>
    </div>
  )
}

function MatchResultKnobs({
  config,
  onPatch,
}: {
  config: MatchResultConfig
  onPatch: (p: Partial<MatchResultConfig>) => void
}) {
  const show = config.auto_show_delay_seconds ?? 0
  const dismiss = config.auto_dismiss_seconds ?? 30
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Show delay (seconds)" htmlFor="mr-delay">
        <Input
          id="mr-delay"
          type="number"
          min={0}
          max={60}
          step={1}
          value={show}
          onChange={(e) =>
            onPatch({
              auto_show_delay_seconds: Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
        />
        <p className="text-xs text-(--color-text-secondary) mt-1">
          How long after match completion to reveal the winner banner.
        </p>
      </FormField>
      <FormField label="Dismiss after (seconds)" htmlFor="mr-dismiss">
        <Input
          id="mr-dismiss"
          type="number"
          min={5}
          max={120}
          step={1}
          value={dismiss}
          onChange={(e) =>
            onPatch({
              auto_dismiss_seconds: Math.max(1, parseInt(e.target.value, 10) || 30),
            })
          }
        />
      </FormField>
    </div>
  )
}

function CustomTextKnobs({
  config,
  onPatch,
}: {
  config: CustomTextConfig
  onPatch: (p: Partial<CustomTextConfig>) => void
}) {
  const [local, setLocal] = useState(config.text ?? '')
  // Keep local in sync when upstream changes (e.g. WS pushes a new
  // value). Guard so our own typing doesn't fight the debounce.
  useEffect(() => {
    if (config.text !== local && document.activeElement?.id !== 'ct-text') {
      setLocal(config.text ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.text])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Text" htmlFor="ct-text" className="md:col-span-2">
        <Input
          id="ct-text"
          placeholder="e.g. Championship Final — Court A"
          value={local}
          onChange={(e) => {
            setLocal(e.target.value)
            onPatch({ text: e.target.value })
          }}
        />
      </FormField>
      <FormField label="Placement zone" htmlFor="ct-zone">
        <Select
          id="ct-zone"
          value={config.zone ?? 'bottom'}
          onChange={(e) => onPatch({ zone: e.target.value })}
        >
          {CUSTOM_TEXT_ZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Auto-dismiss" htmlFor="ct-dismiss">
        <Select
          id="ct-dismiss"
          value={String(config.auto_dismiss_seconds ?? 0)}
          onChange={(e) =>
            onPatch({ auto_dismiss_seconds: parseInt(e.target.value, 10) || 0 })
          }
        >
          {DISMISS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2',
        checked ? 'bg-cyan-500' : 'bg-(--color-bg-hover)',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function SaveIndicator({ pending }: { pending: boolean }) {
  if (!pending) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md bg-(--color-bg-secondary) px-3 py-1.5 text-xs text-(--color-text-secondary)"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Saving…
    </div>
  )
}
