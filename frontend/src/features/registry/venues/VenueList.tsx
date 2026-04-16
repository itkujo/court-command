import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useVenueSearch } from './hooks'
import { useDebounce } from '../../../hooks/useDebounce'
import { usePagination } from '../../../hooks/usePagination'
import { SearchInput } from '../../../components/SearchInput'
import { Table } from '../../../components/Table'
import { Pagination } from '../../../components/Pagination'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { MapPin, Plus } from 'lucide-react'
import { AdSlot } from '../../../components/AdSlot'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning'> = {
  draft: 'default',
  pending_review: 'warning',
  published: 'success',
  archived: 'default',
}

export function VenueList() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const pagination = usePagination(20)

  const { data, isLoading, error } = useVenueSearch(
    debouncedSearch,
    pagination.limit,
    pagination.offset,
  )

  const venues = data?.items ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (v: (typeof venues)[0]) => (
        <Link
          to="/venues/$venueId"
          params={{ venueId: String(v.id) }}
          className="font-medium text-(--color-text-primary) hover:text-cyan-400"
        >
          {v.name}
        </Link>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (v: (typeof venues)[0]) => (
        <span className="text-(--color-text-secondary)">{v.city || '\u2014'}</span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v: (typeof venues)[0]) => (
        <Badge variant={STATUS_VARIANT[v.status] ?? 'default'}>
          {v.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'court_count',
      header: 'Courts',
      render: (v: (typeof venues)[0]) => (
        <span className="text-(--color-text-secondary)">{v.court_count}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Venues</h1>
        <Link to="/venues/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Create Venue
          </Button>
        </Link>
      </div>

      <AdSlot size="responsive-banner" slot="venues-list-top" className="mb-4" />

      <SearchInput
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          pagination.setPage(1)
        }}
        placeholder="Search venues..."
        className="mb-4 max-w-md"
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState
          title="Failed to load venues"
          description={(error as Error).message}
          action={<Button onClick={() => window.location.reload()}>Retry</Button>}
        />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="No venues found"
          description={search ? `No results for "${search}"` : 'No venues created yet.'}
          action={
            !search ? (
              <Link to="/venues/new">
                <Button>Create Venue</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
            <Table columns={columns} data={venues} keyExtractor={(v) => v.id} />
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
