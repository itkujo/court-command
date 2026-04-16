import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost, apiGetPaginated, type PaginatedData } from '../../../lib/api'
import { buildQueryString } from '../../../lib/formatters'

export interface Player {
  public_id: string
  email: string | null
  first_name: string
  last_name: string
  display_name: string | null
  date_of_birth: string | null
  handedness: string | null
  skill_rating: number | null
  city: string | null
  state_province: string | null
  country: string | null
  bio: string | null
  paddle_brand: string | null
  paddle_model: string | null
  gender: string | null
  is_profile_hidden: boolean
  waiver_accepted_at: string | null
  role: string
  status: string
  created_at: string
}

export function usePlayerSearch(query: string, limit: number, offset: number) {
  return useQuery<PaginatedData<Player>>({
    queryKey: ['players', 'search', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Player>(
        `/api/v1/players/search${buildQueryString({ q: query, limit, offset })}`,
      ),
    enabled: true,
  })
}

export function usePlayer(id: string) {
  return useQuery<Player>({
    queryKey: ['players', id],
    queryFn: () => apiGet<Player>(`/api/v1/players/${id}`),
    enabled: !!id,
  })
}

export function useMyProfile() {
  return useQuery<Player>({
    queryKey: ['players', 'me'],
    queryFn: () => apiGet<Player>('/api/v1/players/me'),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Player>) => apiPatch<Player>('/api/v1/players/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })
}

export function useAcceptWaiver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<Player>('/api/v1/players/me/waiver'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })
}
