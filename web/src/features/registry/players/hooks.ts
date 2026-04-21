import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost, apiGetPaginated, type PaginatedData } from '../../../lib/api'
import { buildQueryString } from '../../../lib/formatters'

// Shape mirrors api/service/player.go PrivatePlayerProfileResponse (which embeds
// PlayerProfileResponse). Fields marked private below are only populated when the
// viewer is the user themselves or a platform admin. For public views, those
// fields will be undefined.
// NOTE: `role` is not part of PlayerProfileResponse — it lives on auth.User. It
// stays here because useMyProfile callers currently merge it in from session data.
// Column types must match api/db/migrations/00001_create_users.sql (+ 00002, 00030,
// 00033, 00035).
export interface Player {
  id: number
  public_id: string
  email: string | null
  first_name: string
  last_name: string
  display_name: string | null
  date_of_birth: string | null
  handedness: string | null
  avatar_url: string | null
  formatted_address: string | null
  city: string | null
  state_province: string | null
  country: string | null
  postal_code: string | null
  address_line_1: string | null
  address_line_2: string | null
  latitude: number | null
  longitude: number | null
  bio: string | null
  paddle_brand: string | null
  paddle_model: string | null
  dupr_id: string | null
  vair_id: string | null
  gender: string | null
  is_profile_hidden: boolean
  // Private fields (self or platform_admin only)
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  medical_notes: string | null
  waiver_accepted_at: string | null
  role: string
  status: string
  created_at: string
  updated_at: string | null
}

export function usePlayerSearch(query: string, limit: number, offset: number) {
  return useQuery<PaginatedData<Player>>({
    queryKey: ['players', 'search', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Player>(
        `/api/v1/players/search${buildQueryString({ q: query, limit, offset })}`,
      ),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePlayer(id: string) {
  return useQuery<Player>({
    queryKey: ['players', id],
    queryFn: () => apiGet<Player>(`/api/v1/players/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useMyProfile() {
  return useQuery<Player>({
    queryKey: ['players', 'me'],
    queryFn: () => apiGet<Player>('/api/v1/players/me'),
    staleTime: 2 * 60 * 1000,
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
