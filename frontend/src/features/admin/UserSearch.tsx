import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSearchUsers } from './hooks'
import { ALL_ROLES, ROLE_LABELS, USER_STATUSES } from './types'
import type { AdminUser, UserRole } from './types'
import { Table } from '../../components/Table'
import { Pagination } from '../../components/Pagination'
import { SearchInput } from '../../components/SearchInput'
import { Select } from '../../components/Select'
import { Badge } from '../../components/Badge'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import { Button } from '../../components/Button'
import { Users } from 'lucide-react'
import { formatDate } from '../../lib/formatters'

const PAGE_SIZE = 20

const ROLE_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  platform_admin: 'error',
  organization_admin: 'warning',
  league_admin: 'warning',
  tournament_director: 'info',
  head_referee: 'info',
  referee: 'info',
  scorekeeper: 'default',
  broadcast_operator: 'default',
  team_coach: 'default',
  api_readonly: 'default',
  player: 'success',
}

export function UserSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const offset = (page - 1) * PAGE_SIZE
  const { data, isLoading, error, refetch } = useSearchUsers(
    query || undefined,
    roleFilter || undefined,
    statusFilter || undefined,
    PAGE_SIZE,
    offset,
  )

  const users = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  const columns = [
    {
      key: 'public_id',
      header: 'ID',
      render: (user: AdminUser) => (
        <span className="font-mono text-xs text-(--color-text-secondary)">{user.public_id}</span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'name',
      header: 'Name',
      render: (user: AdminUser) => (
        <span className="font-medium text-(--color-text-primary)">
          {user.first_name} {user.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user: AdminUser) => (
        <span className="text-(--color-text-secondary)">{user.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: AdminUser) => (
        <Badge variant={ROLE_VARIANT[user.role] ?? 'default'}>
          {ROLE_LABELS[user.role as UserRole] ?? user.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: AdminUser) => <StatusBadge status={user.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (user: AdminUser) => (
        <span className="text-sm text-(--color-text-secondary)">{formatDate(user.created_at)}</span>
      ),
    },
  ]

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  function handleRowClick(user: AdminUser) {
    navigate({ to: '/admin/users/$userId', params: { userId: user.public_id } })
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setPage(1)
  }

  function handleRoleChange(value: string) {
    setRoleFilter(value)
    setPage(1)
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value)
    setPage(1)
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">User Management</h1>
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-8 text-center">
          <p className="text-(--color-text-secondary) mb-4">Failed to load users.</p>
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-(--color-text-primary)">User Management</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full sm:w-40"
        >
          <option value="">All Statuses</option>
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
          <SkeletonTable rows={8} />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No users found"
          description={query || roleFilter || statusFilter ? 'Try adjusting your search filters.' : 'No users exist yet.'}
        />
      ) : (
        <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
          <Table
            columns={columns}
            data={users}
            keyExtractor={(user) => user.public_id}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  )
}
