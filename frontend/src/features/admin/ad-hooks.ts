import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'

export interface AdConfig {
  id: number
  slot_name: string
  ad_type: 'image' | 'embed'
  image_url?: string
  link_url?: string
  alt_text?: string
  embed_code?: string
  is_active: boolean
  sort_order: number
  sizes: string[]
  name: string
  display_duration_sec: number
  created_at: string
  updated_at: string
}

export function useActiveAds() {
  return useQuery<AdConfig[]>({
    queryKey: ['ads', 'active'],
    queryFn: () => apiGet<AdConfig[]>('/api/v1/ads'),
    staleTime: 60_000,
  })
}

export function useAllAds() {
  return useQuery<AdConfig[]>({
    queryKey: ['ads', 'all'],
    queryFn: () => apiGet<AdConfig[]>('/api/v1/admin/ads'),
  })
}

export function useCreateAd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      slot_name: string
      ad_type: 'image' | 'embed'
      image_url?: string
      link_url?: string
      alt_text?: string
      embed_code?: string
      is_active: boolean
      sort_order: number
      sizes: string[]
    }) => apiPost<AdConfig>('/api/v1/admin/ads', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
    },
  })
}

export function useUpdateAd(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<{
      name: string
      slot_name: string
      ad_type: 'image' | 'embed'
      image_url: string
      link_url: string
      alt_text: string
      embed_code: string
      is_active: boolean
      sort_order: number
      sizes: string[]
    }>) => apiPut<AdConfig>(`/api/v1/admin/ads/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
    },
  })
}

export function useDeleteAd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/v1/admin/ads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
    },
  })
}

export function useToggleAd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiPut<AdConfig>(`/api/v1/admin/ads/${id}/toggle`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] })
    },
  })
}
