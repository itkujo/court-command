// frontend/src/features/scoring/types.ts

export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'bye'
  | 'forfeit'
  | 'cancelled'

export type ScoringType = 'side_out' | 'rally'

export type EventType =
  | 'MATCH_STARTED'
  | 'POINT_SCORED'
  | 'POINT_REMOVED'
  | 'SIDE_OUT'
  | 'GAME_COMPLETE'
  | 'MATCH_COMPLETE'
  | 'TIMEOUT_CALLED'
  | 'TIMEOUT_ENDED'
  | 'END_CHANGE'
  | 'SUBSTITUTION'
  | 'MATCH_RESET'
  | 'MATCH_CONFIGURED'
  | 'SCORE_OVERRIDE'
  | 'FORFEIT_DECLARED'
  | 'MATCH_PAUSED'
  | 'MATCH_RESUMED'

export interface MatchTeam {
  id: number
  name: string
  short_name?: string | null
  primary_color?: string | null
  logo_url?: string | null
  players?: Array<{
    id: number
    public_id: string
    display_name: string
  }>
}

export interface CompletedGame {
  game_number: number
  team_1_score: number
  team_2_score: number
  winner: 1 | 2
}

export interface Match {
  id: number
  public_id: string
  status: MatchStatus
  scoring_type: ScoringType
  points_to_win: number
  win_by: number
  best_of: number
  current_game: number
  team_1: MatchTeam | null
  team_2: MatchTeam | null
  team_1_score: number
  team_2_score: number
  team_1_games_won: number
  team_2_games_won: number
  serving_team: 1 | 2 | null
  server_number: 1 | 2 | null
  serving_player_id?: number | null
  timeouts_per_game: number
  team_1_timeouts_used: number
  team_2_timeouts_used: number
  completed_games: CompletedGame[]
  is_paused: boolean
  is_quick_match: boolean
  match_type?: string
  division_id?: number | null
  division_name?: string | null
  tournament_id?: number | null
  tournament_name?: string | null
  court_id?: number | null
  court_name?: string | null
  match_series_id?: number | null
  scheduled_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  winner_team_id?: number | null
  loser_team_id?: number | null
  scored_by_name?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface MatchEvent {
  id: number
  match_id: number
  sequence_id: number
  event_type: EventType
  timestamp: string
  payload: Record<string, unknown>
  score_snapshot: Record<string, unknown>
  created_by_user_id?: number | null
  scored_by_name?: string | null
}

export interface ScoringActionResult {
  match: Match
  game_over_detected?: boolean
  match_over_detected?: boolean
  end_change_detected?: boolean
  event?: MatchEvent
}

export interface CourtSummary {
  id: number
  name: string
  slug: string
  venue_id?: number | null
  is_show_court?: boolean
  stream_url?: string | null
  active_match?: Match | null
  on_deck_match?: Match | null
}

export interface MatchSeriesSummary {
  id: number
  public_id: string
  team1_id: number
  team2_id: number
  team1: MatchTeam | null
  team2: MatchTeam | null
  team1_wins: number
  team2_wins: number
  games_to_win: number
  status: string
  started_at?: string | null
  completed_at?: string | null
  winner_team_id?: number | null
  matches: Match[]
}
