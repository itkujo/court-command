import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { usePlayerSearch } from './hooks'
import { useDebounce } from '../../../hooks/useDebounce'
import { usePagination } from '../../../hooks/usePagination'
import { SearchInput } from '../../../components/SearchInput'
import { Table } from '../../../components/Table'
import { Pagination } from '../../../components/Pagination'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { Button } from '../../../components/Button'
import { Users } from 'lucide-react'
import { formatPlayerName } from '../../../lib/formatters'

export function PlayerList() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const pagination = usePagination(20)

  const { data, isLoading, error } = usePlayerSearch(
    debouncedSearch,
    pagination.limit,
    pagination.offset,
  )

  const players = data?.items ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (p: (typeof players)[0]) => (
        <Link
          to="/players/$playerId"
          params={{ playerId: String(p.public_id) }}
          className="font-medium text-(--color-text-primary) hover:text-cyan-400"
        >
          {formatPlayerName(p.first_name, p.last_name, p.display_name)}
        </Link>
      ),
    },
    {
      key: 'public_id',
      header: 'ID',
      render: (p: (typeof players)[0]) => (
        <span className="text-(--color-text-secondary) font-mono text-xs">{p.public_id}</span>
      ),
    },
    {
      key: 'handedness',
      header: 'Hand',
      render: (p: (typeof players)[0]) => (
        <span className="text-(--color-text-secondary) capitalize">{p.handedness || '\u2014'}</span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'location',
      header: 'Location',
      render: (p: (typeof players)[0]) => (
        <span className="text-(--color-text-secondary)">
          {[p.city, p.state_province].filter(Boolean).join(', ') || '\u2014'}
        </span>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (p: (typeof players)[0]) => (
        <span className="text-(--color-text-secondary)">
          {p.skill_rating != null ? p.skill_rating.toFixed(2) : '\u2014'}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Players</h1>
      </div>

      <SearchInput
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          pagination.setPage(1)
        }}
        placeholder="Search players by name..."
        className="mb-4 max-w-md"
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState
          title="Failed to load players"
          description={(error as Error).message}
          action={<Button onClick={() => window.location.reload()}>Retry</Button>}
        />
      ) : players.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No players found"
          description={search ? `No results for "${search}"` : 'No players registered yet.'}
        />
      ) : (
        <>
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
            <Table
              columns={columns}
              data={players}
              keyExtractor={(p) => p.public_id}
            />
          </div>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages(total)}
            onPageChange={pagination.setPage}
            className="mt-4"
          />
        </>
      )}
    </div>
  )
}
