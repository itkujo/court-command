const API_BASE = import.meta.env.VITE_API_URL || ''

export interface ApiError {
  code: string
  message: string
}

export class ApiRequestError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await throwApiError(response)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  const body = await response.json()
  return body.data !== undefined ? body.data : body
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
  })
  return handleResponse<T>(response)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(response)
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(response)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return handleResponse<T>(response)
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export async function apiGetPaginated<T>(path: string): Promise<PaginatedData<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    await throwApiError(response)
  }

  const body = await response.json()
  return {
    items: body.data || [],
    total: body.pagination?.total || 0,
    limit: body.pagination?.limit || 20,
    offset: body.pagination?.offset || 0,
  }
}

async function throwApiError(response: Response): Promise<never> {
  let code = 'unknown_error'
  let message = `Request failed with status ${response.status}`
  try {
    const body = await response.json()
    if (body.error) {
      code = body.error.code || code
      message = body.error.message || message
    }
  } catch {
    // not JSON
  }
  throw new ApiRequestError(response.status, code, message)
}
