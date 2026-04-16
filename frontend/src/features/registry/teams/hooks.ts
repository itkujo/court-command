import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiGetPaginated,
  type PaginatedData,
} from '../../../lib/api'
import { buildQueryString } from '../../../lib/formatters'

export interface Team {
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
}

export interface TeamRosterEntry {
  player_id: number
  first_name: string
  last_name: string
  display_name: string | null
  role: string
  jersey_number: number | null
  joined_at: string
}

export function useTeamSearch(query: string, limit: number, offset: number) {
  return useQuery<PaginatedData<Team>>({
    queryKey: ['teams', 'search', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Team>(
        `/api/v1/teams/search${buildQueryString({ q: query, limit, offset })}`,
      ),
    enabled: true,
  })
}

export function useTeam(id: string) {
  return useQuery<Team>({
    queryKey: ['teams', id],
    queryFn: () => apiGet<Team>(`/api/v1/teams/${id}`),
    enabled: !!id,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Team>) => apiPost<Team>('/api/v1/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useUpdateTeam(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Team>) => apiPatch<Team>(`/api/v1/teams/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useDeleteTeam(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useTeamRoster(teamId: string) {
  return useQuery<TeamRosterEntry[]>({
    queryKey: ['teams', teamId, 'roster'],
    queryFn: () => apiGet<TeamRosterEntry[]>(`/api/v1/teams/${teamId}/roster`),
    enabled: !!teamId,
  })
}

export function useAddPlayerToRoster(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { player_id: number; role?: string; jersey_number?: number }) =>
      apiPost<TeamRosterEntry>(`/api/v1/teams/${teamId}/roster`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'roster'] })
    },
  })
}

export function useRemovePlayerFromRoster(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playerId: number) =>
      apiDelete<void>(`/api/v1/teams/${teamId}/roster/${playerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'roster'] })
    },
  })
}
