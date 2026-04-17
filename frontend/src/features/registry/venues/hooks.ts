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

export interface Venue {
  id: number
  name: string
  slug: string
  status: string
  address_line_1: string | null
  city: string | null
  state_province: string | null
  country: string | null
  postal_code: string | null
  timezone: string | null
  website_url: string | null
  contact_email: string | null
  logo_url: string | null
  photo_url: string | null
  venue_map_url: string | null
  bio: string | null
  court_count: number
  created_at: string
}

export interface Court {
  id: number
  name: string
  slug: string
  venue_id: number | null
  surface_type: string | null
  is_show_court: boolean
  is_active: boolean
  is_temporary: boolean
  sort_order: number
  stream_url: string | null
  stream_type: string | null
  stream_title: string | null
  notes: string | null
  created_at: string
}

export function useVenueSearch(query: string, limit: number, offset: number) {
  return useQuery<PaginatedData<Venue>>({
    queryKey: ['venues', 'search', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Venue>(
        `/api/v1/venues/search${buildQueryString({ q: query, limit, offset })}`,
      ),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
}

export function useVenue(id: string) {
  return useQuery<Venue>({
    queryKey: ['venues', id],
    queryFn: () => apiGet<Venue>(`/api/v1/venues/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Venue>) => apiPost<Venue>('/api/v1/venues', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useUpdateVenue(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Venue>) => apiPatch<Venue>(`/api/v1/venues/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useDeleteVenue(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/venues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useSubmitForReview(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<Venue>(`/api/v1/venues/${id}/submit-for-review`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useVenueCourts(venueId: string) {
  return useQuery<Court[]>({
    queryKey: ['venues', venueId, 'courts'],
    queryFn: () => apiGet<Court[]>(`/api/v1/venues/${venueId}/courts`),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateVenueCourt(venueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Court>) =>
      apiPost<Court>(`/api/v1/venues/${venueId}/courts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', venueId, 'courts'] })
      queryClient.invalidateQueries({ queryKey: ['venues', venueId] })
    },
  })
}

export function useUpdateVenueCourt(venueId: string, courtId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Court>) =>
      apiPatch<Court>(`/api/v1/venues/${venueId}/courts/${courtId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', venueId, 'courts'] })
    },
  })
}

export function useDeleteVenueCourt(venueId: string, courtId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/venues/${venueId}/courts/${courtId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', venueId, 'courts'] })
      queryClient.invalidateQueries({ queryKey: ['venues', venueId] })
    },
  })
}
