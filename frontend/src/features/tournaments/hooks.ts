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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SponsorEntry {
  name: string
  logo_url: string
  link_url: string
  tier: string
  is_header_sponsor: boolean
}

export interface Tournament {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  start_date: string
  end_date: string
  venue_id: number | null
  league_id: number | null
  season_id: number | null
  description: string | null
  logo_url: string | null
  banner_url: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  rules_document_url: string | null
  max_participants: number | null
  show_registrations: boolean
  cancellation_reason: string | null
  social_links: Record<string, string> | null
  sponsor_info: SponsorEntry[] | null
  notes: string | null
  td_user_id: number | null
  created_by_user_id: number
  created_at: string
  updated_at: string
}

export interface Division {
  id: number
  name: string
  slug: string
  tournament_id: number
  format: string
  gender_restriction: string
  bracket_format: string
  scoring_format: string | null
  status: string
  max_teams: number | null
  max_roster_size: number | null
  entry_fee_amount: number | null
  entry_fee_currency: string
  auto_approve: boolean
  registration_mode: string
  seed_method: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Registration {
  id: number
  division_id: number
  team_id: number | null
  player_id: number | null
  registered_by_user_id: number
  status: string
  seed: number | null
  final_placement: number | null
  seeking_partner: boolean
  registration_notes: string | null
  admin_notes: string | null
  registered_at: string
  approved_at: string | null
  withdrawn_at: string | null
  checked_in_at: string | null
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

export interface Pod {
  id: number
  division_id: number
  name: string
  sort_order: number
}

export interface ScoringPreset {
  id: number
  name: string
  description: string | null
  scoring_config: Record<string, unknown>
  is_system: boolean
  is_active: boolean
  created_at: string
}

export interface BracketMatch {
  id: number
  division_id: number
  round: number
  position: number
  team_a_id: number | null
  team_b_id: number | null
  winner_id: number | null
  status: string
  scheduled_at: string | null
  court_id: number | null
  scores: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface League {
  id: number
  name: string
  slug: string
  status: string
}

export interface Season {
  id: number
  league_id: number
  name: string
  status: string
}

// ---------------------------------------------------------------------------
// Tournament CRUD
// ---------------------------------------------------------------------------

export function useListTournaments(
  query?: string,
  status?: string,
  limit?: number,
  offset?: number,
) {
  return useQuery<PaginatedData<Tournament>>({
    queryKey: ['tournaments', 'list', { query, status, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Tournament>(
        `/api/v1/tournaments${buildQueryString({ query, status, limit, offset })}`,
      ),
  })
}

export function useGetTournament(id: string) {
  return useQuery<Tournament>({
    queryKey: ['tournaments', id],
    queryFn: () => apiGet<Tournament>(`/api/v1/tournaments/${id}`),
    enabled: !!id,
  })
}

export function useCreateTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Tournament>) =>
      apiPost<Tournament>('/api/v1/tournaments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

export function useUpdateTournament(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Tournament>) =>
      apiPatch<Tournament>(`/api/v1/tournaments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

export function useDeleteTournament(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/tournaments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

export function useUpdateTournamentStatus(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: string }) =>
      apiPatch<Tournament>(`/api/v1/tournaments/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

export function useCloneTournament(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<Tournament>(`/api/v1/tournaments/${id}/clone`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Division CRUD
// ---------------------------------------------------------------------------

export function useListDivisions(tournamentId: string) {
  return useQuery<Division[]>({
    queryKey: ['tournaments', tournamentId, 'divisions'],
    queryFn: () =>
      apiGet<Division[]>(`/api/v1/tournaments/${tournamentId}/divisions`),
    enabled: !!tournamentId,
  })
}

export function useGetDivision(tournamentId: string, divisionId: string) {
  return useQuery<Division>({
    queryKey: ['tournaments', tournamentId, 'divisions', divisionId],
    queryFn: () =>
      apiGet<Division>(
        `/api/v1/tournaments/${tournamentId}/divisions/${divisionId}`,
      ),
    enabled: !!tournamentId && !!divisionId,
  })
}

export function useCreateDivision(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Division>) =>
      apiPost<Division>(
        `/api/v1/tournaments/${tournamentId}/divisions`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournaments', tournamentId, 'divisions'],
      })
    },
  })
}

export function useUpdateDivision(tournamentId: string, divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Division>) =>
      apiPatch<Division>(
        `/api/v1/tournaments/${tournamentId}/divisions/${divisionId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournaments', tournamentId, 'divisions'],
      })
    },
  })
}

export function useDeleteDivision(tournamentId: string, divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiDelete<void>(
        `/api/v1/tournaments/${tournamentId}/divisions/${divisionId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournaments', tournamentId, 'divisions'],
      })
    },
  })
}

export function useUpdateDivisionStatus(
  tournamentId: string,
  divisionId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: string }) =>
      apiPatch<Division>(
        `/api/v1/tournaments/${tournamentId}/divisions/${divisionId}/status`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournaments', tournamentId, 'divisions'],
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

export function useListRegistrations(
  divisionId: string,
  status?: string,
  limit?: number,
  offset?: number,
) {
  return useQuery<PaginatedData<Registration>>({
    queryKey: ['divisions', divisionId, 'registrations', { status, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Registration>(
        `/api/v1/divisions/${divisionId}/registrations${buildQueryString({ status, limit, offset })}`,
      ),
    enabled: !!divisionId,
  })
}

export function useCreateRegistration(divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Registration>) =>
      apiPost<Registration>(
        `/api/v1/divisions/${divisionId}/registrations`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useUpdateRegistrationStatus(
  divisionId: string,
  registrationId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: string }) =>
      apiPatch<Registration>(
        `/api/v1/divisions/${divisionId}/registrations/${registrationId}/status`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useUpdateRegistrationSeed(
  divisionId: string,
  registrationId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { seed: number | null }) =>
      apiPatch<Registration>(
        `/api/v1/divisions/${divisionId}/registrations/${registrationId}/seed`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useCheckInRegistration(
  divisionId: string,
  registrationId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<Registration>(
        `/api/v1/divisions/${divisionId}/registrations/${registrationId}/check-in`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useBulkNoShow(divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { registration_ids: number[] }) =>
      apiPost<void>(
        `/api/v1/divisions/${divisionId}/registrations/bulk-no-show`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useWithdrawMidTournament(
  divisionId: string,
  registrationId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<Registration>(
        `/api/v1/divisions/${divisionId}/registrations/${registrationId}/withdraw`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

export function useUpdateAdminNotes(
  divisionId: string,
  registrationId: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { admin_notes: string }) =>
      apiPatch<Registration>(
        `/api/v1/divisions/${divisionId}/registrations/${registrationId}/admin-notes`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'registrations'],
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Pods
// ---------------------------------------------------------------------------

export function useListPods(divisionId: string) {
  return useQuery<Pod[]>({
    queryKey: ['divisions', divisionId, 'pods'],
    queryFn: () => apiGet<Pod[]>(`/api/v1/divisions/${divisionId}/pods`),
    enabled: !!divisionId,
  })
}

export function useCreatePod(divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Pod>) =>
      apiPost<Pod>(`/api/v1/divisions/${divisionId}/pods`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'pods'],
      })
    },
  })
}

export function useUpdatePod(divisionId: string, podId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Pod>) =>
      apiPatch<Pod>(`/api/v1/divisions/${divisionId}/pods/${podId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'pods'],
      })
    },
  })
}

export function useDeletePod(divisionId: string, podId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiDelete<void>(`/api/v1/divisions/${divisionId}/pods/${podId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'pods'],
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Announcements (tournament-scoped)
// ---------------------------------------------------------------------------

export function useListTournamentAnnouncements(
  tournamentId: string,
  divisionId?: string,
) {
  return useQuery<Announcement[]>({
    queryKey: ['tournaments', tournamentId, 'announcements', { divisionId }],
    queryFn: () =>
      apiGet<Announcement[]>(
        `/api/v1/tournaments/${tournamentId}/announcements${buildQueryString({ division_id: divisionId })}`,
      ),
    enabled: !!tournamentId,
  })
}

export function useCreateTournamentAnnouncement(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Announcement>) =>
      apiPost<Announcement>(
        `/api/v1/tournaments/${tournamentId}/announcements`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tournaments', tournamentId, 'announcements'],
      })
    },
  })
}

export function useUpdateAnnouncement(announcementId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Announcement>) =>
      apiPatch<Announcement>(`/api/v1/announcements/${announcementId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

export function useDeleteAnnouncement(announcementId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiDelete<void>(`/api/v1/announcements/${announcementId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Brackets
// ---------------------------------------------------------------------------

export function useGenerateBracket(divisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<void>(`/api/v1/divisions/${divisionId}/bracket/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['divisions', divisionId, 'matches'],
      })
    },
  })
}

export function useListBracketMatches(divisionId: string) {
  return useQuery<BracketMatch[]>({
    queryKey: ['divisions', divisionId, 'matches'],
    queryFn: () =>
      apiGet<BracketMatch[]>(`/api/v1/divisions/${divisionId}/matches`),
    enabled: !!divisionId,
  })
}

// ---------------------------------------------------------------------------
// Scoring Presets
// ---------------------------------------------------------------------------

export function useListScoringPresets() {
  return useQuery<ScoringPreset[]>({
    queryKey: ['scoring-presets'],
    queryFn: () => apiGet<ScoringPreset[]>('/api/v1/scoring-presets'),
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Leagues & Seasons (for tournament creation)
// ---------------------------------------------------------------------------

export function useSearchLeagues(query: string) {
  return useQuery<PaginatedData<League>>({
    queryKey: ['leagues', 'search', query],
    queryFn: () =>
      apiGetPaginated<League>(
        `/api/v1/leagues${buildQueryString({ query, limit: 20, offset: 0 })}`,
      ),
    enabled: query.length > 0,
  })
}

export function useLeagueSeasons(leagueId: number | null) {
  return useQuery<Season[]>({
    queryKey: ['leagues', leagueId, 'seasons'],
    queryFn: () =>
      apiGet<Season[]>(`/api/v1/leagues/${leagueId}/seasons`),
    enabled: !!leagueId,
  })
}
