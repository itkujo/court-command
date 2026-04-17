import { useQuery } from '@tanstack/react-query'
import { apiGet, apiGetPaginated } from '../../lib/api'

// ---- Types ----

interface ManagedVenue {
  id: number
  name: string
  slug: string
  city?: string | null
  state_province?: string | null
  status: string
  logo_url?: string | null
  created_at: string
}

interface ManagedTournament {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  start_date?: string | null
  end_date?: string | null
  logo_url?: string | null
  venue_id?: number | null
  created_at: string
}

interface ManagedLeague {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  logo_url?: string | null
  city?: string | null
  state_province?: string | null
  created_at: string
}

interface ManagedOrg {
  id: number
  name: string
  slug: string
  logo_url?: string | null
  city?: string | null
  state_province?: string | null
  membership_role: string
  created_at: string
}

// ---- Hooks ----

export function useMyVenues() {
  return useQuery<ManagedVenue[]>({
    queryKey: ['my-venues'],
    queryFn: () => apiGet<ManagedVenue[]>('/api/v1/venues/my'),
  })
}

export function useMyTournaments() {
  return useQuery({
    queryKey: ['my-tournaments'],
    queryFn: () => apiGetPaginated<ManagedTournament>('/api/v1/tournaments/my?limit=50&offset=0'),
  })
}

export function useMyLeagues() {
  return useQuery({
    queryKey: ['my-leagues'],
    queryFn: () => apiGetPaginated<ManagedLeague>('/api/v1/leagues/my?limit=50&offset=0'),
  })
}

export function useMyOrgs() {
  return useQuery<ManagedOrg[]>({
    queryKey: ['my-orgs'],
    queryFn: () => apiGet<ManagedOrg[]>('/api/v1/organizations/my'),
  })
}
