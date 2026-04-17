import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { apiGet, apiPost, type ApiRequestError } from '../../lib/api'

export interface User {
  public_id: string
  email: string
  first_name: string
  last_name: string
  display_name: string | null
  date_of_birth: string
  role: string
  status: string
  created_at: string
  impersonation?: {
    active: boolean
    impersonator_id: string
  } | null
}

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await apiGet<User>('/api/v1/auth/me')
      } catch (err) {
        if ((err as ApiRequestError).status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    isImpersonating: !!query.data?.impersonation?.active,
    error: query.error,
  }
}

interface LoginInput {
  email: string
  password: string
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => apiPost<User>('/api/v1/auth/login', input),
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
    },
  })
}

interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
  date_of_birth: string
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => apiPost<User>('/api/v1/auth/register', input),
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => apiPost<void>('/api/v1/auth/logout'),
    onSuccess: () => {
      queryClient.clear()
      router.navigate({ to: '/' })
    },
  })
}
