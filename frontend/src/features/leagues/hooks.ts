import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiGetPaginated,
  type PaginatedData,
} from '../../lib/api'
import { buildQueryString } from '../../lib/formatters'
import type { SponsorEntry } from '../tournaments/hooks'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface League {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  city: string | null
  state_province: string | null
  country: string | null
  postal_code: string | null
  address_line_1: string | null
  address_line_2: string | null
  latitude: number | null
  longitude: number | null
  rules_document_url: string | null
  social_links: Record<string, string> | null
  sponsor_info: SponsorEntry[] | null
  notes: string | null
  created_by_user_id: number
  created_at: string
  updated_at: string
}

export interface Season {
  id: number
  league_id: number
  name: string
  slug: string
  status: string
  start_date: string | null
  end_date: string | null
  description: string | null
  standings_method: string
  standings_config: Record<string, unknown> | null
  roster_confirmation_deadline: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DivisionTemplate {
  id: number
  league_id: number
  name: string
  format: string
  gender_restriction: string
  age_restriction: Record<string, number> | null
  skill_min: number | null
  skill_max: number | null
  rating_system: string
  bracket_format: string
  scoring_format: string
  scoring_preset_id: number | null
  max_teams: number | null
  max_roster_size: number | null
  entry_fee_amount: string | null
  entry_fee_currency: string
  seed_method: string
  auto_approve: boolean
  allow_self_check_in: boolean
  grand_finals_reset: boolean
  advancement_count: number
  registration_mode: string
  report_to_dupr: boolean
  report_to_vair: boolean
  allow_ref_player_add: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeagueRegistration {
  id: number
  league_id: number
  org_id: number
  org_name?: string
  status: string
  registered_at: string
  approved_at: string | null
  notes: string | null
}

export interface SeasonConfirmation {
  id: number
  season_id: number
  team_id: number
  team_name?: string
  division_id: number
  division_name?: string
  confirmed: boolean
  confirmed_at: string | null
  deadline: string | null
}

export interface Announcement {
  id: number
  tournament_id: number | null
  league_id: number | null
  division_id: number | null
  title: string
  body: string
  is_pinned: boolean
  created_by_user_id: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

export function useListLeagues(query?: string, limit = 20, offset = 0) {
  return useQuery<PaginatedData<League>>({
    queryKey: ['leagues', 'list', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<League>(
        `/api/v1/leagues${buildQueryString({ query, limit, offset })}`,
      ),
  })
}

export function useGetLeague(id: number | null) {
  return useQuery<League>({
    queryKey: ['leagues', 'detail', id],
    queryFn: () => apiGet<League>(`/api/v1/leagues/${id}`),
    enabled: id != null,
  })
}

export function useCreateLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<League>) => apiPost<League>('/api/v1/leagues', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useUpdateLeague(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<League>) =>
      apiPatch<League>(`/api/v1/leagues/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useDeleteLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/api/v1/leagues/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useUpdateLeagueStatus(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      apiPatch<League>(`/api/v1/leagues/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export function useListSeasons(leagueId: number | null) {
  return useQuery<Season[]>({
    queryKey: ['seasons', 'list', leagueId],
    queryFn: () => apiGet<Season[]>(`/api/v1/leagues/${leagueId}/seasons`),
    enabled: leagueId != null,
  })
}

export function useGetSeason(leagueId: number | null, seasonId: number | null) {
  return useQuery<Season>({
    queryKey: ['seasons', 'detail', leagueId, seasonId],
    queryFn: () =>
      apiGet<Season>(`/api/v1/leagues/${leagueId}/seasons/${seasonId}`),
    enabled: leagueId != null && seasonId != null,
  })
}

export function useCreateSeason(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Season>) =>
      apiPost<Season>(`/api/v1/leagues/${leagueId}/seasons`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

export function useUpdateSeason(leagueId: number, seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Season>) =>
      apiPatch<Season>(
        `/api/v1/leagues/${leagueId}/seasons/${seasonId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

export function useDeleteSeason(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (seasonId: number) =>
      apiDelete<void>(`/api/v1/leagues/${leagueId}/seasons/${seasonId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

export function useUpdateSeasonStatus(leagueId: number, seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      apiPatch<Season>(
        `/api/v1/leagues/${leagueId}/seasons/${seasonId}/status`,
        { status },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Division Templates
// ---------------------------------------------------------------------------

export function useListDivisionTemplates(leagueId: number | null) {
  return useQuery<DivisionTemplate[]>({
    queryKey: ['division-templates', 'list', leagueId],
    queryFn: () =>
      apiGet<DivisionTemplate[]>(
        `/api/v1/leagues/${leagueId}/division-templates`,
      ),
    enabled: leagueId != null,
  })
}

export function useCreateDivisionTemplate(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<DivisionTemplate>) =>
      apiPost<DivisionTemplate>(
        `/api/v1/leagues/${leagueId}/division-templates`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['division-templates'] })
    },
  })
}

export function useUpdateDivisionTemplate(leagueId: number, templateId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<DivisionTemplate>) =>
      apiPatch<DivisionTemplate>(
        `/api/v1/leagues/${leagueId}/division-templates/${templateId}`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['division-templates'] })
    },
  })
}

export function useDeleteDivisionTemplate(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: number) =>
      apiDelete<void>(
        `/api/v1/leagues/${leagueId}/division-templates/${templateId}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['division-templates'] })
    },
  })
}

// ---------------------------------------------------------------------------
// League Registrations (org-level)
// ---------------------------------------------------------------------------

export function useListLeagueRegistrations(leagueId: number | null) {
  return useQuery<LeagueRegistration[]>({
    queryKey: ['league-registrations', 'list', leagueId],
    queryFn: () =>
      apiGet<LeagueRegistration[]>(
        `/api/v1/leagues/${leagueId}/registrations`,
      ),
    enabled: leagueId != null,
  })
}

export function useCreateLeagueRegistration(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { org_id: number; notes?: string }) =>
      apiPost<LeagueRegistration>(
        `/api/v1/leagues/${leagueId}/registrations`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['league-registrations'] })
    },
  })
}

export function useUpdateLeagueRegistrationStatus(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      registrationId,
      status,
    }: {
      registrationId: number
      status: string
    }) =>
      apiPatch<LeagueRegistration>(
        `/api/v1/leagues/${leagueId}/registrations/${registrationId}/status`,
        { status },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['league-registrations'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Season Confirmations
// ---------------------------------------------------------------------------

export function useListSeasonConfirmations(
  leagueId: number | null,
  seasonId: number | null,
) {
  return useQuery<SeasonConfirmation[]>({
    queryKey: ['season-confirmations', 'list', leagueId, seasonId],
    queryFn: () =>
      apiGet<SeasonConfirmation[]>(
        `/api/v1/leagues/${leagueId}/seasons/${seasonId}/confirmations`,
      ),
    enabled: leagueId != null && seasonId != null,
  })
}

export function useConfirmSeason(leagueId: number, seasonId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { team_id: number; division_id: number }) =>
      apiPost<SeasonConfirmation>(
        `/api/v1/leagues/${leagueId}/seasons/${seasonId}/confirmations`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['season-confirmations'] })
    },
  })
}

// ---------------------------------------------------------------------------
// League Announcements
// ---------------------------------------------------------------------------

export function useListLeagueAnnouncements(leagueId: number | null) {
  return useQuery<Announcement[]>({
    queryKey: ['announcements', 'league', leagueId],
    queryFn: () =>
      apiGet<Announcement[]>(`/api/v1/leagues/${leagueId}/announcements`),
    enabled: leagueId != null,
  })
}

export function useCreateLeagueAnnouncement(leagueId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      body: string
      is_pinned?: boolean
    }) =>
      apiPost<Announcement>(
        `/api/v1/leagues/${leagueId}/announcements`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Tournament list (filtered by season) for SeasonDetail
// ---------------------------------------------------------------------------

export function useListTournamentsBySeason(seasonId: number | null) {
  return useQuery<PaginatedData<{ id: number; name: string; slug: string; status: string; start_date: string; end_date: string }>>({
    queryKey: ['tournaments', 'by-season', seasonId],
    queryFn: () =>
      apiGetPaginated(
        `/api/v1/tournaments${buildQueryString({
          season_id: seasonId,
          limit: 100,
          offset: 0,
        })}`,
      ),
    enabled: seasonId != null,
  })
}
