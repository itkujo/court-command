import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../lib/api'

// ---------------------------------------------------------------------------
// Wire types — mirror backend generated structs exactly
// ---------------------------------------------------------------------------

/**
 * generated.Match — raw DB row from matches table.
 * Used for upcoming_matches and recent_results.
 * Does NOT include enriched names (tournament_name, team names, etc.) —
 * those live in the related tables and are not joined by the dashboard query.
 */
export interface DashboardMatch {
  id: number
  public_id: string
  tournament_id: number | null
  division_id: number | null
  pod_id: number | null
  court_id: number | null
  created_by_user_id: number
  match_type: string
  round: number | null
  round_name: string | null
  match_number: number | null
  team1_id: number | null
  team2_id: number | null
  team1_seed: number | null
  team2_seed: number | null
  scoring_preset_id: number | null
  games_per_set: number
  sets_to_win: number
  points_to_win: number
  win_by: number
  max_points: number | null
  rally_scoring: boolean
  timeouts_per_game: number
  timeout_duration_sec: number
  freeze_at: number | null
  team1_score: number
  team2_score: number
  current_set: number
  current_game: number
  serving_team: number | null
  server_number: number | null
  set_scores: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  winner_team_id: number | null
  loser_team_id: number | null
  win_reason: string | null
  next_match_id: number | null
  next_match_slot: number | null
  loser_next_match_id: number | null
  loser_next_match_slot: number | null
  referee_user_id: number | null
  notes: string | null
  expires_at: string | null
  scheduled_at: string | null
  created_at: string
  updated_at: string
  match_series_id: number | null
  court_queue_position: number | null
}

/**
 * generated.GetActiveRegistrationsForPlayerRow
 */
export interface ActiveRegistration {
  id: number
  division_id: number
  team_id: number | null
  player_id: number | null
  registered_by_user_id: number
  status: string
  seed: number | null
  final_placement: number | null
  registration_notes: string | null
  admin_notes: string | null
  seeking_partner: boolean | null
  registered_at: string
  approved_at: string | null
  withdrawn_at: string | null
  checked_in_at: string | null
  division_name: string
  tournament_id: number
  tournament_name: string
  tournament_status: string
}

/**
 * generated.GetPlayerStatsAggregateRow
 */
export interface PlayerStats {
  matches_played: number
  matches_won: number
  matches_lost: number
}

/**
 * generated.GetDashboardPlayerTeamsRow
 */
export interface DashboardTeam {
  id: number
  name: string
  short_name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  org_id: number | null
  city: string | null
  founded_year: number | null
  bio: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  roster_role: string
  jersey_number: number | null
}

/**
 * generated.Announcement — no enriched names, only IDs.
 */
export interface DashboardAnnouncement {
  id: number
  tournament_id: number | null
  league_id: number | null
  division_id: number | null
  title: string
  body: string
  is_pinned: boolean | null
  created_by_user_id: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * DashboardData — mirrors backend service.DashboardData.
 * All fields use the raw generated types (no enrichment).
 */
export interface DashboardData {
  upcoming_matches: DashboardMatch[]
  active_registrations: ActiveRegistration[]
  recent_results: DashboardMatch[]
  stats: PlayerStats
  announcements: DashboardAnnouncement[]
  teams: DashboardTeam[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardData>('/api/v1/dashboard'),
  })
}
