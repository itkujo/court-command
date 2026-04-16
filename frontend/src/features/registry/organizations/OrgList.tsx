import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useOrgSearch } from './hooks'
import { useDebounce } from '../../../hooks/useDebounce'
import { usePagination } from '../../../hooks/usePagination'
import { SearchInput } from '../../../components/SearchInput'
import { Table } from '../../../components/Table'
import { Pagination } from '../../../components/Pagination'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { Button } from '../../../components/Button'
import { Building2, Plus } from 'lucide-react'
import { AdSlot } from '../../../components/AdSlot'

export function OrgList() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const pagination = usePagination(20)

  const { data, isLoading, error } = useOrgSearch(
    debouncedSearch,
    pagination.limit,
    pagination.offset,
  )

  const orgs = data?.items ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (o: (typeof orgs)[0]) => (
        <Link
          to="/organizations/$orgId"
          params={{ orgId: String(o.id) }}
          className="font-medium text-(--color-text-primary) hover:text-cyan-400"
        >
          {o.name}
        </Link>
      ),
    },
    {
      key: 'location',
      header: 'City / State',
      render: (o: (typeof orgs)[0]) => (
        <span className="text-(--color-text-secondary)">
          {[o.city, o.state_province].filter(Boolean).join(', ') || '\u2014'}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'contact_email',
      header: 'Contact Email',
      render: (o: (typeof orgs)[0]) => (
        <span className="text-(--color-text-secondary)">{o.contact_email || '\u2014'}</span>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'founded_year',
      header: 'Founded',
      render: (o: (typeof orgs)[0]) => (
        <span className="text-(--color-text-secondary)">
          {o.founded_year ? String(o.founded_year) : '\u2014'}
        </span>
      ),
      className: 'hidden lg:table-cell',
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Organizations</h1>
        <Link to="/organizations/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Create Organization
          </Button>
        </Link>
      </div>

      <AdSlot size="responsive-banner" slot="orgs-list-top" className="mb-4" />

      <SearchInput
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          pagination.setPage(1)
        }}
        placeholder="Search organizations..."
        className="mb-4 max-w-md"
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState
          title="Failed to load organizations"
          description={(error as Error).message}
          action={<Button onClick={() => window.location.reload()}>Retry</Button>}
        />
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No organizations found"
          description={
            search ? `No results for "${search}"` : 'No organizations created yet.'
          }
          action={
            !search ? (
              <Link to="/organizations/new">
                <Button>Create Organization</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
            <Table columns={columns} data={orgs} keyExtractor={(o) => o.id} />
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
