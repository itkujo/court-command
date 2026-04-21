import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiGetPaginated,
  type PaginatedData,
} from '../../lib/api'
import { buildQueryString } from '../../lib/formatters'
import type {
  AdminStats,
  AdminUser,
  ActivityLogEntry,
  ApiKey,
  Upload,
  VenueApprovalItem,
} from './types'

// ── Stats ──────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiGet<AdminStats>('/api/v1/admin/stats'),
  })
}

// ── Users ──────────────────────────────────────────────────────────────

export function useSearchUsers(
  query?: string,
  role?: string,
  status?: string,
  limit?: number,
  offset?: number,
) {
  return useQuery<PaginatedData<AdminUser>>({
    queryKey: ['admin', 'users', { query, role, status, limit, offset }],
    queryFn: () =>
      apiGetPaginated<AdminUser>(
        `/api/v1/admin/users${buildQueryString({ query, role, status, limit, offset })}`,
      ),
  })
}

export function useAdminUser(userId: string) {
  return useQuery<AdminUser>({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiGet<AdminUser>(`/api/v1/admin/users/${userId}`),
    enabled: !!userId,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiPatch<void>(`/api/v1/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      status,
      reason,
    }: {
      userId: string
      status: string
      reason: string
    }) => apiPatch<void>(`/api/v1/admin/users/${userId}/status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

// ── Venues ─────────────────────────────────────────────────────────────

export function usePendingVenues(limit?: number, offset?: number) {
  return useQuery<PaginatedData<VenueApprovalItem>>({
    queryKey: ['admin', 'venues', 'pending', { limit, offset }],
    queryFn: () =>
      apiGetPaginated<VenueApprovalItem>(
        `/api/v1/admin/venues/pending${buildQueryString({ limit, offset })}`,
      ),
  })
}

export function useUpdateVenueStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      venueId,
      status,
      feedback,
    }: {
      venueId: string
      status: string
      feedback?: string
    }) => apiPatch<void>(`/api/v1/admin/venues/${venueId}/status`, { status, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'venues'] })
    },
  })
}

// ── Activity Log ───────────────────────────────────────────────────────

export function useActivityLogs(filters: {
  user_id?: string
  entity_type?: string
  action?: string
  limit?: number
  offset?: number
}) {
  return useQuery<PaginatedData<ActivityLogEntry>>({
    queryKey: ['admin', 'activity', filters],
    queryFn: () =>
      apiGetPaginated<ActivityLogEntry>(
        `/api/v1/admin/activity-logs${buildQueryString(filters)}`,
      ),
  })
}

// ── API Keys ───────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ['admin', 'api-keys'],
    queryFn: () => apiGet<ApiKey[]>('/api/v1/admin/api-keys'),
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; scopes: string[]; expires_at?: string }) =>
      apiPost<ApiKey>('/api/v1/admin/api-keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] })
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (keyId: number) =>
      apiDelete<void>(`/api/v1/admin/api-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] })
    },
  })
}

// ── Uploads ────────────────────────────────────────────────────────────

export function useMyUploads() {
  return useQuery<Upload[]>({
    queryKey: ['admin', 'uploads'],
    queryFn: () => apiGet<Upload[]>('/api/v1/uploads'),
  })
}

export function useDeleteUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (uploadId: number) =>
      apiDelete<void>(`/api/v1/uploads/${uploadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'uploads'] })
    },
  })
}

// ── Impersonation ──────────────────────────────────────────────────────

export function useStartImpersonation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      apiPost<{ impersonating: { user_id: number; public_id: string; name: string; role: string } }>(
        `/api/v1/admin/impersonate/${userId}`,
      ),
    onSuccess: () => {
      // Refetch /auth/me to get the impersonated user's data
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useStopImpersonation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<{ restored: boolean }>('/api/v1/admin/stop-impersonation'),
    onSuccess: () => {
      // Refetch /auth/me to get the admin's own data back
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
