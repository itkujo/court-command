import { useCallback, useState } from 'react'

export interface PaginationState {
  page: number
  limit: number
  offset: number
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  totalPages: (total: number) => number
}

export function usePagination(initialLimit: number = 20): PaginationState {
  const [page, setPage] = useState(1)
  const limit = initialLimit
  const offset = (page - 1) * limit

  const nextPage = useCallback(() => setPage((p) => p + 1), [])
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), [])
  const totalPages = useCallback(
    (total: number) => Math.ceil(total / limit),
    [limit],
  )

  return { page, limit, offset, setPage, nextPage, prevPage, totalPages }
}
