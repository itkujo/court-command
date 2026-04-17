// frontend/src/features/quick-match/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../lib/api'
import type { Match } from '../scoring/types'

export interface CreateQuickMatchInput {
  games_per_set: number
  sets_to_win: number
  points_to_win: number
  win_by: number
  rally_scoring: boolean
  timeouts_per_game?: number
  timeout_duration_sec?: number
}

export function useMyQuickMatches() {
  return useQuery<Match[]>({
    queryKey: ['quick-matches'],
    queryFn: () => apiGet<Match[]>('/api/v1/quick-matches'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateQuickMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateQuickMatchInput) =>
      apiPost<Match>('/api/v1/quick-matches', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-matches'] })
    },
  })
}
