/**
 * Canonical overlay contract constants.
 *
 * This file mirrors `api/overlay/contract.go` exactly. Every string used in
 * the overlay wire protocol (field names, element keys, match status values,
 * source types, etc.) is declared here as a typed constant. Frontend readers
 * and writers MUST reference these constants — never inline literals.
 *
 * Phase 3 lesson (see docs/superpowers/lessons/2026-04-16-phase-3-review-defects.md):
 * stringly-typed values embedded at call sites drift between BE and FE in
 * casing and spelling. Named constants + a contract test prevent that drift.
 *
 * If a value changes in `api/overlay/contract.go`, it MUST change here in
 * the same commit, and the corresponding backend contract test should fail
 * until both sides are updated.
 */

// ---------------------------------------------------------------------------
// OverlayData field names (top-level)
// Source: api/overlay/contract.go OverlayData JSON tags
// ---------------------------------------------------------------------------

export const OVERLAY_FIELD = {
  MATCH_STATUS: 'match_status',
  TEAM_1: 'team_1',
  TEAM_2: 'team_2',
  SERVING_TEAM: 'serving_team',
  SERVER_NUMBER: 'server_number',
  CURRENT_GAME: 'current_game',
  COMPLETED_GAMES: 'completed_games',
  TIMEOUTS_REMAINING_1: 'timeouts_remaining_1',
  TIMEOUTS_REMAINING_2: 'timeouts_remaining_2',
  DIVISION_NAME: 'division_name',
  TOURNAMENT_NAME: 'tournament_name',
  LEAGUE_NAME: 'league_name',
  ROUND_LABEL: 'round_label',
  MATCH_INFO: 'match_info',
  SPONSOR_LOGOS: 'sponsor_logos',
  TOURNAMENT_LOGO_URL: 'tournament_logo_url',
  LEAGUE_LOGO_URL: 'league_logo_url',
  IS_PAUSED: 'is_paused',
  SERIES_SCORE: 'series_score',
  NEXT_MATCH: 'next_match',
  COURT_NAME: 'court_name',
} as const

// ---------------------------------------------------------------------------
// Overridable data keys (for CourtOverlayConfig.data_overrides JSON)
// Source: api/overlay/contract.go ApplyDataOverrides switch cases
// Writer MUST use these exact keys when building an override patch.
// ---------------------------------------------------------------------------

export const OVERRIDE_KEY = {
  TEAM_1_NAME: 'team_1_name',
  TEAM_1_SHORT_NAME: 'team_1_short_name',
  TEAM_1_SCORE: 'team_1_score',
  TEAM_1_COLOR: 'team_1_color',
  TEAM_1_LOGO_URL: 'team_1_logo_url',
  TEAM_1_GAME_WINS: 'team_1_game_wins',
  TEAM_1_PLAYER_1_NAME: 'team_1_player_1_name',
  TEAM_1_PLAYER_2_NAME: 'team_1_player_2_name',
  TEAM_2_NAME: 'team_2_name',
  TEAM_2_SHORT_NAME: 'team_2_short_name',
  TEAM_2_SCORE: 'team_2_score',
  TEAM_2_COLOR: 'team_2_color',
  TEAM_2_LOGO_URL: 'team_2_logo_url',
  TEAM_2_GAME_WINS: 'team_2_game_wins',
  TEAM_2_PLAYER_1_NAME: 'team_2_player_1_name',
  TEAM_2_PLAYER_2_NAME: 'team_2_player_2_name',
  DIVISION_NAME: 'division_name',
  TOURNAMENT_NAME: 'tournament_name',
  LEAGUE_NAME: 'league_name',
  ROUND_LABEL: 'round_label',
  MATCH_INFO: 'match_info',
  COURT_NAME: 'court_name',
  TOURNAMENT_LOGO_URL: 'tournament_logo_url',
  LEAGUE_LOGO_URL: 'league_logo_url',
  MATCH_STATUS: 'match_status',
  SERVING_TEAM: 'serving_team',
  SERVER_NUMBER: 'server_number',
  CURRENT_GAME: 'current_game',
} as const

export type OverrideKey = (typeof OVERRIDE_KEY)[keyof typeof OVERRIDE_KEY]

/** Ordered list of override keys suitable for UI rendering (grouped). */
export const OVERRIDE_KEY_GROUPS: Array<{
  label: string
  keys: readonly OverrideKey[]
}> = [
  {
    label: 'Team 1',
    keys: [
      OVERRIDE_KEY.TEAM_1_NAME,
      OVERRIDE_KEY.TEAM_1_SHORT_NAME,
      OVERRIDE_KEY.TEAM_1_SCORE,
      OVERRIDE_KEY.TEAM_1_COLOR,
      OVERRIDE_KEY.TEAM_1_LOGO_URL,
      OVERRIDE_KEY.TEAM_1_GAME_WINS,
    ],
  },
  {
    label: 'Team 1 roster',
    keys: [OVERRIDE_KEY.TEAM_1_PLAYER_1_NAME, OVERRIDE_KEY.TEAM_1_PLAYER_2_NAME],
  },
  {
    label: 'Team 2',
    keys: [
      OVERRIDE_KEY.TEAM_2_NAME,
      OVERRIDE_KEY.TEAM_2_SHORT_NAME,
      OVERRIDE_KEY.TEAM_2_SCORE,
      OVERRIDE_KEY.TEAM_2_COLOR,
      OVERRIDE_KEY.TEAM_2_LOGO_URL,
      OVERRIDE_KEY.TEAM_2_GAME_WINS,
    ],
  },
  {
    label: 'Team 2 roster',
    keys: [OVERRIDE_KEY.TEAM_2_PLAYER_1_NAME, OVERRIDE_KEY.TEAM_2_PLAYER_2_NAME],
  },
  {
    label: 'Match context',
    keys: [
      OVERRIDE_KEY.DIVISION_NAME,
      OVERRIDE_KEY.TOURNAMENT_NAME,
      OVERRIDE_KEY.LEAGUE_NAME,
      OVERRIDE_KEY.ROUND_LABEL,
      OVERRIDE_KEY.MATCH_INFO,
      OVERRIDE_KEY.COURT_NAME,
    ],
  },
  {
    label: 'Branding',
    keys: [OVERRIDE_KEY.TOURNAMENT_LOGO_URL, OVERRIDE_KEY.LEAGUE_LOGO_URL],
  },
  {
    label: 'Match state',
    keys: [
      OVERRIDE_KEY.MATCH_STATUS,
      OVERRIDE_KEY.SERVING_TEAM,
      OVERRIDE_KEY.SERVER_NUMBER,
      OVERRIDE_KEY.CURRENT_GAME,
    ],
  },
]

/** Numeric override keys (value must be number, not string). */
export const NUMERIC_OVERRIDE_KEYS = new Set<OverrideKey>([
  OVERRIDE_KEY.TEAM_1_SCORE,
  OVERRIDE_KEY.TEAM_1_GAME_WINS,
  OVERRIDE_KEY.TEAM_2_SCORE,
  OVERRIDE_KEY.TEAM_2_GAME_WINS,
  OVERRIDE_KEY.SERVING_TEAM,
  OVERRIDE_KEY.SERVER_NUMBER,
  OVERRIDE_KEY.CURRENT_GAME,
])

// ---------------------------------------------------------------------------
// Overlay element keys (CourtOverlayConfig.elements JSON key set)
// Source: api/service/overlay.go GetOrCreateConfig default map
// ---------------------------------------------------------------------------

export const ELEMENT_KEY = {
  SCOREBOARD: 'scoreboard',
  LOWER_THIRD: 'lower_third',
  PLAYER_CARD: 'player_card',
  TEAM_CARD: 'team_card',
  SPONSOR_BUG: 'sponsor_bug',
  TOURNAMENT_BUG: 'tournament_bug',
  COMING_UP_NEXT: 'coming_up_next',
  MATCH_RESULT: 'match_result',
  CUSTOM_TEXT: 'custom_text',
  BRACKET_SNAPSHOT: 'bracket_snapshot',
  POOL_STANDINGS: 'pool_standings',
  SERIES_SCORE: 'series_score',
} as const

export type ElementKey = (typeof ELEMENT_KEY)[keyof typeof ELEMENT_KEY]

/** Ordered list used by the Control Panel Elements tab. */
export const ALL_ELEMENT_KEYS: ElementKey[] = [
  ELEMENT_KEY.SCOREBOARD,
  ELEMENT_KEY.LOWER_THIRD,
  ELEMENT_KEY.PLAYER_CARD,
  ELEMENT_KEY.TEAM_CARD,
  ELEMENT_KEY.SPONSOR_BUG,
  ELEMENT_KEY.TOURNAMENT_BUG,
  ELEMENT_KEY.COMING_UP_NEXT,
  ELEMENT_KEY.MATCH_RESULT,
  ELEMENT_KEY.CUSTOM_TEXT,
  ELEMENT_KEY.BRACKET_SNAPSHOT,
  ELEMENT_KEY.POOL_STANDINGS,
  ELEMENT_KEY.SERIES_SCORE,
]

// ---------------------------------------------------------------------------
// Match status enum (OverlayData.match_status values)
// Source: api/overlay/contract.go line 130 comment
// ---------------------------------------------------------------------------

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BYE: 'bye',
  FORFEIT: 'forfeit',
  CANCELLED: 'cancelled',
  IDLE: 'idle',
} as const

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS]

// ---------------------------------------------------------------------------
// Source Profile enums (api/handler/source_profile.go validation)
// ---------------------------------------------------------------------------

export const SOURCE_TYPE = {
  COURT_COMMAND: 'court_command',
  REST_API: 'rest_api',
  WEBHOOK: 'webhook',
} as const

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE]

export const AUTH_TYPE = {
  NONE: 'none',
  API_KEY: 'api_key',
  BEARER: 'bearer',
  BASIC: 'basic',
} as const

export type AuthType = (typeof AUTH_TYPE)[keyof typeof AUTH_TYPE]

// ---------------------------------------------------------------------------
// Idle display values (CourtOverlayConfig.idle_display)
// Values MUST match CHECK constraint in
// api/db/migrations/00023_create_court_overlay_configs.sql on idle_display.
// ---------------------------------------------------------------------------

export const IDLE_DISPLAY = {
  COURT_NAME: 'court_name',
  BRANDING: 'branding',
  NONE: 'none',
} as const

export type IdleDisplay = (typeof IDLE_DISPLAY)[keyof typeof IDLE_DISPLAY]

// ---------------------------------------------------------------------------
// Sponsor tiers (OverlayTeamData.SponsorLogo.tier)
// ---------------------------------------------------------------------------

export const SPONSOR_TIER = {
  TITLE: 'title',
  PRESENTING: 'presenting',
  GOLD: 'gold',
  SILVER: 'silver',
  BRONZE: 'bronze',
  STANDARD: 'standard',
} as const

export type SponsorTier = (typeof SPONSOR_TIER)[keyof typeof SPONSOR_TIER]

// ---------------------------------------------------------------------------
// Pubsub event names (match what backend publishes)
// Source: api/service/overlay.go BroadcastOverlayData + broadcastConfigChange
// ---------------------------------------------------------------------------

export const OVERLAY_WS_EVENT = {
  OVERLAY_DATA: 'overlay_data',
  CONFIG_UPDATE: 'config_update',
} as const

export type OverlayWSEvent = (typeof OVERLAY_WS_EVENT)[keyof typeof OVERLAY_WS_EVENT]
