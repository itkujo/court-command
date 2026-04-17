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

export interface Organization {
  id: number
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  website_url: string | null
  contact_email: string | null
  contact_phone: string | null
  city: string | null
  state_province: string | null
  country: string | null
  bio: string | null
  founded_year: number | null
  created_at: string
}

export interface OrgMember {
  user_id: number
  first_name: string
  last_name: string
  email: string
  role: string
  joined_at: string
}

export function useOrgSearch(query: string, limit: number, offset: number) {
  return useQuery<PaginatedData<Organization>>({
    queryKey: ['organizations', 'search', { query, limit, offset }],
    queryFn: () =>
      apiGetPaginated<Organization>(
        `/api/v1/organizations/search${buildQueryString({ q: query, limit, offset })}`,
      ),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrg(id: string) {
  return useQuery<Organization>({
    queryKey: ['organizations', id],
    queryFn: () => apiGet<Organization>(`/api/v1/organizations/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateOrg() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Organization>) =>
      apiPost<Organization>('/api/v1/organizations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useUpdateOrg(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Organization>) =>
      apiPatch<Organization>(`/api/v1/organizations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useDeleteOrg(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useOrgMembers(orgId: string) {
  return useQuery<OrgMember[]>({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => apiGet<OrgMember[]>(`/api/v1/organizations/${orgId}/members`),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAddMember(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { player_id: number; role?: string }) =>
      apiPost<OrgMember>(`/api/v1/organizations/${orgId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] })
    },
  })
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      apiDelete<void>(`/api/v1/organizations/${orgId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] })
    },
  })
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      apiPatch<OrgMember>(`/api/v1/organizations/${orgId}/members/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] })
    },
  })
}

export function useLeaveOrg(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<void>(`/api/v1/organizations/${orgId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useBlockOrg(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<void>(`/api/v1/organizations/${orgId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export function useUnblockOrg(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete<void>(`/api/v1/organizations/${orgId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}
