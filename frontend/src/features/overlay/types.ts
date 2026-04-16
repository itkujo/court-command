/**
 * Canonical overlay types — mirrors backend/overlay/contract.go + generated
 * DB models (CourtOverlayConfig, SourceProfile) + backend/overlay/themes.go.
 *
 * Wire shapes in this file MUST stay in sync with the backend:
 *   - OverlayData                 ← backend/overlay/contract.go OverlayData
 *   - CourtOverlayConfig          ← backend/db/generated/models.go CourtOverlayConfig
 *   - ElementsConfig              ← default map in backend/service/overlay.go GetOrCreateConfig
 *   - SourceProfile               ← backend/db/generated/models.go SourceProfile
 *   - Theme                       ← backend/overlay/themes.go Theme
 *
 * Stringly-typed values are imported from ./contract so this file contains
 * only shapes + the keyed unions that bind to those constants.
 */

import type {
  AuthType,
  ElementKey,
  IdleDisplay,
  MatchStatus,
  OverrideKey,
  SourceType,
  SponsorTier,
} from './contract'

// ---------------------------------------------------------------------------
// Overlay data (what the renderer consumes)
// ---------------------------------------------------------------------------

export interface PlayerBrief {
  name: string
}

export interface OverlayTeamData {
  name: string
  short_name: string
  score: number
  /** Hex color, e.g. "#3b82f6" */
  color: string
  logo_url: string
  players: PlayerBrief[]
  game_wins: number
}

export interface GameResult {
  game_num: number
  score_team_1: number
  score_team_2: number
  /** 1 or 2 */
  winner: 1 | 2
}

export interface SponsorLogo {
  name: string
  logo_url: string
  link_url: string
  tier: SponsorTier | string
}

export interface SeriesScoreData {
  team_1_wins: number
  team_2_wins: number
  best_of: number
}

export interface NextMatchData {
  team_1_name: string
  team_2_name: string
  division_name: string
  round_label: string
}

export interface OverlayData {
  match_status: MatchStatus | string
  team_1: OverlayTeamData
  team_2: OverlayTeamData
  /** 1 or 2 */
  serving_team: number
  /** 1 or 2 */
  server_number: number
  current_game: number
  completed_games: GameResult[]
  timeouts_remaining_1: number
  timeouts_remaining_2: number
  division_name: string
  tournament_name: string
  league_name: string
  round_label: string
  match_info: string
  sponsor_logos: SponsorLogo[]
  tournament_logo_url: string
  league_logo_url: string
  is_paused: boolean
  /** Only set for series matches (omitempty on the wire). */
  series_score?: SeriesScoreData | null
  /** From court queue; omitempty on the wire. */
  next_match?: NextMatchData | null
  court_name: string
}

// ---------------------------------------------------------------------------
// Per-element configuration (inside CourtOverlayConfig.elements JSON)
// Key set is authoritative: backend/service/overlay.go GetOrCreateConfig default map.
// Each element may have its own bag of knobs; common fields are typed,
// element-specific knobs are optional.
// ---------------------------------------------------------------------------

export interface ElementConfigBase {
  visible: boolean
  auto_animate?: boolean
}

export interface ScoreboardConfig extends ElementConfigBase {}

export interface LowerThirdConfig extends ElementConfigBase {}

export interface PlayerCardConfig extends ElementConfigBase {
  auto_dismiss_seconds?: number
}

export interface TeamCardConfig extends ElementConfigBase {
  auto_dismiss_seconds?: number
}

export interface SponsorBugConfig extends ElementConfigBase {
  rotation_seconds?: number
  logos?: SponsorLogo[]
}

export interface TournamentBugConfig extends ElementConfigBase {}

export interface ComingUpNextConfig extends ElementConfigBase {}

export interface MatchResultConfig extends ElementConfigBase {
  auto_show_delay_seconds?: number
  auto_dismiss_seconds?: number
}

export interface CustomTextConfig extends ElementConfigBase {
  text?: string
  auto_dismiss_seconds?: number
  /** UI-only placement hint; server does not validate. */
  zone?: string
}

export interface BracketSnapshotConfig extends ElementConfigBase {}

export interface PoolStandingsConfig extends ElementConfigBase {}

export interface SeriesScoreConfig extends ElementConfigBase {}

export interface ElementsConfig {
  scoreboard: ScoreboardConfig
  lower_third: LowerThirdConfig
  player_card: PlayerCardConfig
  team_card: TeamCardConfig
  sponsor_bug: SponsorBugConfig
  tournament_bug: TournamentBugConfig
  coming_up_next: ComingUpNextConfig
  match_result: MatchResultConfig
  custom_text: CustomTextConfig
  bracket_snapshot: BracketSnapshotConfig
  pool_standings: PoolStandingsConfig
  series_score: SeriesScoreConfig
}

/** Map element key → config shape. */
export type ElementConfigFor<K extends ElementKey> = ElementsConfig[K]

// ---------------------------------------------------------------------------
// CourtOverlayConfig (DB row — what GET /api/v1/overlay/court/{id}/config returns)
// Source: backend/db/generated/models.go CourtOverlayConfig (raw sqlc struct).
// The backend serializes Elements / ColorOverrides / DataOverrides as []byte
// (raw JSON); we type them here as structured objects for frontend convenience.
// ---------------------------------------------------------------------------

export interface ColorOverrides {
  /** Matches the CSS custom properties emitted by ThemeProvider. */
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  text?: string
  font_family?: string
  border_radius?: string
  animation_style?: string
}

export type DataOverrides = Partial<Record<OverrideKey, string | number>>

export interface CourtOverlayConfig {
  id: number
  court_id: number
  theme_id: string
  color_overrides: ColorOverrides
  elements: ElementsConfig
  /** pgtype.Int8 serializes to `{Int64, Valid}`; sqlc-style, but the service
   *  layer maps it to *int64 at the HTTP boundary only on write. For reads the
   *  raw pgtype wrapper ships over the wire. We normalize both shapes here. */
  source_profile_id: PgtypeInt8 | number | null
  overlay_token: string | null
  show_branding: boolean
  match_result_delay_seconds: number
  idle_display: IdleDisplay | string
  data_overrides: DataOverrides
  created_at: string
  updated_at: string
}

/** pgtype.Int8 wire shape when a Go handler returns a raw sqlc row. */
export interface PgtypeInt8 {
  Int64: number
  Valid: boolean
}

/** Helper: normalize source_profile_id to plain number|null. */
export function normalizeSourceProfileID(
  v: CourtOverlayConfig['source_profile_id'],
): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  return v.Valid ? v.Int64 : null
}

// ---------------------------------------------------------------------------
// Source Profiles (backend/db/generated/models.go SourceProfile)
// ---------------------------------------------------------------------------

export interface SourceProfile {
  id: number
  name: string
  created_by_user_id: number
  source_type: SourceType | string
  api_url: string | null
  webhook_secret: string | null
  auth_type: AuthType | string
  /** Shape depends on auth_type; tolerant Record for forward-compat. */
  auth_config: Record<string, unknown>
  /** pgtype.Int4 wire shape. */
  poll_interval_seconds: PgtypeInt4 | number | null
  /** Keys: canonical OverlayData / OverrideKey field names.
   *  Values: JSON path string into external payload (e.g. "data.score.home"). */
  field_mapping: Record<string, string>
  is_active: boolean
  /** pgtype.Timestamptz — RFC3339 or {Time, Valid}. */
  last_poll_at: PgtypeTimestamptz | string | null
  last_poll_status: string | null
  created_at: string
  updated_at: string
}

/** pgtype.Int4 wire shape. */
export interface PgtypeInt4 {
  Int32: number
  Valid: boolean
}

/** pgtype.Timestamptz wire shape. */
export interface PgtypeTimestamptz {
  Time: string
  Valid: boolean
}

export function normalizePollInterval(
  v: SourceProfile['poll_interval_seconds'],
): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  return v.Valid ? v.Int32 : null
}

export function normalizeTimestamptz(
  v: PgtypeTimestamptz | string | null | undefined,
): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  return v.Valid ? v.Time : null
}

// Create/Update payloads for POST /api/v1/source-profiles + PUT /{id}
export interface SourceProfileInput {
  name: string
  source_type: SourceType
  api_url?: string | null
  webhook_secret?: string | null
  auth_type: AuthType
  auth_config?: Record<string, unknown>
  poll_interval_seconds?: number | null
  field_mapping?: Record<string, string>
}

/** Response body for POST /api/v1/source-profiles/test. */
export interface SourceProfileTestResult {
  success: boolean
  status_code?: number
  /** Discovered JSON leaf paths (dot-separated) for FieldMapper dropdown. */
  discovered_paths?: string[]
  /** Raw sample payload echoed back for inspection. */
  sample_payload?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Themes (backend/overlay/themes.go)
// ---------------------------------------------------------------------------

export interface ThemeDefaults {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  font_family: string
  border_radius: string
  /** "slide" | "fade" | "scale" | "none" — kept loose for forward-compat. */
  animation_style: string
}

export interface Theme {
  id: string
  name: string
  description: string
  defaults: ThemeDefaults
}

// ---------------------------------------------------------------------------
// Overlay triggers (ephemeral, UI-only; Phase 4C / 4E)
// These are queued client-side and not persisted to the backend.
// ---------------------------------------------------------------------------

export type TriggerKind = 'player_card' | 'team_card' | 'match_result' | 'custom_text'

export type TriggerDismissMode =
  | { kind: 'manual' }
  | { kind: 'auto'; durationMs: number }

export interface OverlayTrigger {
  id: string
  kind: TriggerKind
  /** Monotonic timestamp (Date.now) when the trigger began. */
  startedAt: number
  dismiss: TriggerDismissMode
  /** Arbitrary per-trigger payload (e.g. selected player, custom text). */
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// WebSocket message envelope
// Source: backend/pubsub/pubsub.go Message — {type, channel, data}.
// ---------------------------------------------------------------------------

export interface OverlayWSMessage<T = unknown> {
  type: string
  channel: string
  data: T
}
