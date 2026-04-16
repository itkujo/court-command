import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete, apiGetPaginated, type PaginatedData } from '../../../lib/api'
import { buildQueryString } from '../../../lib/formatters'
import type { Court } from '../venues/hooks'

export type { Court } from '../venues/hooks'

export function useFloatingCourts(limit: number, offset: number) {
  return useQuery<PaginatedData<Court>>({
    queryKey: ['courts', 'floating', { limit, offset }],
    queryFn: () =>
      apiGetPaginated<Court>(`/api/v1/courts${buildQueryString({ limit, offset })}`),
    enabled: true,
  })
}

export function useCourt(id: string) {
  return useQuery<Court>({
    queryKey: ['courts', id],
    queryFn: () => apiGet<Court>(`/api/v1/courts/${id}`),
    enabled: !!id,
  })
}

export function useCreateFloatingCourt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Court>) => apiPost<Court>('/api/v1/courts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] })
    },
  })
}

export function useUpdateCourt(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Court>) => apiPatch<Court>(`/api/v1/courts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] })
    },
  })
}

export function useDeleteCourt(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/courts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts'] })
    },
  })
}
