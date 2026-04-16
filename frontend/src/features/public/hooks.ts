import { useQuery } from '@tanstack/react-query'
import { apiGet, apiGetPaginated, type PaginatedData } from '../../lib/api'
import { buildQueryString } from '../../lib/formatters'

// ---------------------------------------------------------------------------
// Types — mirrors backend generated structs from /api/v1/public/*
// ---------------------------------------------------------------------------

export interface PublicTournament {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  start_date: string
  end_date: string
  venue_name?: string
  city?: string
  state_province?: string
  logo_url?: string | null
  description?: string | null
  division_count?: number
  registration_count?: number
}

export interface PublicLeague {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  logo_url?: string | null
  city?: string
  state_province?: string
  description?: string | null
}

export interface PublicVenue {
  id: number
  name: string
  slug: string
  status: string
  city?: string
  state_province?: string
  country?: string
  logo_url?: string | null
  photo_url?: string | null
  court_count?: number
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePublicTournaments(params: {
  limit: number
  offset: number
  status?: string
}) {
  return useQuery<PaginatedData<PublicTournament>>({
    queryKey: ['public-tournaments', params],
    queryFn: () =>
      apiGetPaginated<PublicTournament>(
        `/api/v1/public/tournaments${buildQueryString({
          limit: params.limit,
          offset: params.offset,
          status: params.status,
        })}`,
      ),
  })
}

export function usePublicTournamentBySlug(slug: string) {
  return useQuery<PublicTournament>({
    queryKey: ['public-tournament', slug],
    queryFn: () => apiGet<PublicTournament>(`/api/v1/public/tournaments/${slug}`),
    enabled: !!slug,
  })
}

export function usePublicLeagues(params: { limit: number; offset: number }) {
  return useQuery<PaginatedData<PublicLeague>>({
    queryKey: ['public-leagues', params],
    queryFn: () =>
      apiGetPaginated<PublicLeague>(
        `/api/v1/public/leagues${buildQueryString({
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
  })
}

export function usePublicLeagueBySlug(slug: string) {
  return useQuery<PublicLeague>({
    queryKey: ['public-league', slug],
    queryFn: () => apiGet<PublicLeague>(`/api/v1/public/leagues/${slug}`),
    enabled: !!slug,
  })
}

export function usePublicVenues(params: { limit: number; offset: number }) {
  return useQuery<PaginatedData<PublicVenue>>({
    queryKey: ['public-venues', params],
    queryFn: () =>
      apiGetPaginated<PublicVenue>(
        `/api/v1/public/venues${buildQueryString({
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
  })
}

export function usePublicVenueBySlug(slug: string) {
  return useQuery<PublicVenue>({
    queryKey: ['public-venue', slug],
    queryFn: () => apiGet<PublicVenue>(`/api/v1/public/venues/${slug}`),
    enabled: !!slug,
  })
}
