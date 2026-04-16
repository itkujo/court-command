// frontend/src/features/quick-match/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../lib/api'
import type { Match } from '../scoring/types'

export interface CreateQuickMatchInput {
  team_1_name: string
  team_2_name: string
  scoring_preset_id?: number
  points_to_win?: number
  win_by?: number
  best_of?: number
  scoring_type?: 'side_out' | 'rally'
}

export function useMyQuickMatches() {
  return useQuery<Match[]>({
    queryKey: ['quick-matches'],
    queryFn: () => apiGet<Match[]>('/api/v1/quick-matches'),
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
