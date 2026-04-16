import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'

// --------------------------------------------------------------------------
// Wire types — exact mirrors of backend/db/generated/search.sql.go structs.
// Do NOT add enriched fields; that creates contract drift (Phase 3 lesson).
// --------------------------------------------------------------------------

export interface SearchPlayerResult {
  id: number
  public_id: string
  first_name: string
  last_name: string
  display_name: string | null
  city: string | null
  state_province: string | null
  is_profile_hidden: boolean
}

export interface SearchTeamResult {
  id: number
  name: string
  short_name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  org_id: number | null
}

export interface SearchOrganizationResult {
  id: number
  name: string
  slug: string
  logo_url: string | null
  city: string | null
  state_province: string | null
  country: string | null
}

export interface SearchTournamentResult {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  start_date: string
  end_date: string
  venue_id: number | null
  logo_url: string | null
}

export interface SearchLeagueResult {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  logo_url: string | null
  city: string | null
  state_province: string | null
  country: string | null
}

export interface SearchVenueResult {
  id: number
  name: string
  slug: string
  city: string | null
  state_province: string | null
  country: string | null
  logo_url: string | null
}

export interface SearchResults {
  players: SearchPlayerResult[]
  teams: SearchTeamResult[]
  organizations: SearchOrganizationResult[]
  tournaments: SearchTournamentResult[]
  leagues: SearchLeagueResult[]
  venues: SearchVenueResult[]
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const EMPTY_RESULTS: SearchResults = {
  players: [],
  teams: [],
  organizations: [],
  tournaments: [],
  leagues: [],
  venues: [],
}

/**
 * Global search hook with 300ms debounce. Disabled when query < 2 chars.
 * Calls `GET /api/v1/search?q=<query>` (public, no auth required).
 */
export function useGlobalSearch(query: string) {
  const debouncedQuery = useDebounce(query.trim(), 300)
  const enabled = debouncedQuery.length >= 2

  return useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: () =>
      apiGet<SearchResults>(
        `/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled,
    placeholderData: EMPTY_RESULTS,
    staleTime: 60_000,
  })
}
