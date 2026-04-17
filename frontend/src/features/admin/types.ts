export interface AdminUser {
  id: number
  public_id: string
  email: string
  first_name: string
  last_name: string
  display_name: string | null
  date_of_birth: string | null
  role: string
  status: string
  created_at: string
  updated_at: string
}

export interface AdminStats {
  total_users: number
  total_matches: number
  total_tournaments: number
  total_leagues: number
  total_venues: number
  total_courts: number
  pending_venues: number
  active_matches: number
}

export interface ActivityLogEntry {
  id: number
  user_id: number | null
  user_email: string | null
  entity_type: string
  entity_id: string
  action: string
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface ApiKey {
  id: number
  name: string
  key_prefix: string
  key?: string
  scopes: string[]
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  is_active: boolean
}

export interface Upload {
  id: number
  filename: string
  content_type: string
  size: number
  url: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export interface VenueApprovalItem {
  id: number
  public_id: string
  name: string
  city: string
  state: string
  status: string
  owner_id: number
  owner_email: string | null
  court_count: number
  created_at: string
  updated_at: string
}

export const ALL_ROLES = [
  'platform_admin',
  'organization_admin',
  'league_admin',
  'tournament_director',
  'head_referee',
  'referee',
  'scorekeeper',
  'broadcast_operator',
  'team_coach',
  'api_readonly',
  'player',
] as const

export type UserRole = (typeof ALL_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform Admin',
  organization_admin: 'Organization Admin',
  league_admin: 'League Admin',
  tournament_director: 'Tournament Director',
  head_referee: 'Head Referee',
  referee: 'Referee',
  scorekeeper: 'Scorekeeper',
  broadcast_operator: 'Broadcast Operator',
  team_coach: 'Team Coach',
  api_readonly: 'API Read-Only',
  player: 'Player',
}

export const USER_STATUSES = ['active', 'suspended', 'banned'] as const
export type UserStatus = (typeof USER_STATUSES)[number]
