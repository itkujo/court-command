import { useState } from 'react'
import {
  useListRegistrations,
  useBulkNoShow,
  type Registration,
} from './hooks'
import { useToast } from '../../components/Toast'
import { useDebounce } from '../../hooks/useDebounce'
import { usePagination } from '../../hooks/usePagination'
import { SearchInput } from '../../components/SearchInput'
import { Table } from '../../components/Table'
import { Pagination } from '../../components/Pagination'
import { Select } from '../../components/Select'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatDate } from '../../lib/formatters'
import { Users } from 'lucide-react'

interface DivisionRegistrationsProps {
  tournamentId: string
  divisionId: string
}

export function DivisionRegistrations({
  tournamentId: _tournamentId,
  divisionId,
}: DivisionRegistrationsProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(search)
  const pagination = usePagination(20)
  const [bulkNoShowOpen, setBulkNoShowOpen] = useState(false)

  const { data, isLoading } = useListRegistrations(
    divisionId,
    statusFilter || undefined,
    pagination.limit,
    pagination.offset,
  )
  const bulkNoShowMutation = useBulkNoShow(divisionId)

  const registrations = data?.items ?? []
  const total = data?.total ?? 0

  // Client-side search filter over the page
  const filtered = debouncedSearch
    ? registrations.filter((r) =>
        [r.registration_notes, String(r.id)]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(debouncedSearch.toLowerCase())),
      )
    : registrations

  async function handleBulkNoShow() {
    try {
      const ids = registrations
        .filter((r) => r.status !== 'checked_in' && r.checked_in_at == null)
        .map((r) => r.id)
      await bulkNoShowMutation.mutateAsync({ registration_ids: ids })
      toast('success', 'Marked unchecked registrations as no-show')
      setBulkNoShowOpen(false)
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  // Per-row action handlers (approve/reject/check-in/withdraw) require one
  // mutation per row for correct React hook usage. These are wired up in a
  // follow-up refactor — Phase 3 introduces an action-row component with its
  // own mutation hooks scoped to each registration. For now we expose bulk
  // actions + status filtering at the table level.

  const columns = [
    {
      key: 'id',
      header: 'Reg #',
      render: (r: Registration) => (
        <span className="font-mono text-(--color-text-secondary)">#{r.id}</span>
      ),
    },
    {
      key: 'entity',
      header: 'Team / Player',
      render: (r: Registration) => (
        <span className="text-(--color-text-primary)">
          {r.team_id ? `Team #${r.team_id}` : r.player_id ? `Player #${r.player_id}` : '—'}
          {r.seeking_partner && (
            <Badge variant="warning" className="ml-2">
              Seeking Partner
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: Registration) => (
        <StatusBadge status={r.status} type="registration" />
      ),
    },
    {
      key: 'seed',
      header: 'Seed',
      render: (r: Registration) => (
        <span className="text-(--color-text-secondary)">{r.seed ?? '—'}</span>
      ),
    },
    {
      key: 'checkin',
      header: 'Checked In',
      render: (r: Registration) => (
        <span className="text-(--color-text-secondary)">
          {r.checked_in_at ? formatDate(r.checked_in_at) : '—'}
        </span>
      ),
    },
    {
      key: 'registered',
      header: 'Registered',
      render: (r: Registration) => (
        <span className="text-(--color-text-secondary)">
          {formatDate(r.registered_at)}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registrations..."
          className="max-w-md flex-1"
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            pagination.setPage(1)
          }}
          className="w-48"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="checked_in">Checked In</option>
          <option value="no_show">No Show</option>
        </Select>
        <Button variant="secondary" onClick={() => setBulkNoShowOpen(true)}>
          Bulk No-Show
        </Button>
      </div>

      <p className="text-sm text-(--color-text-secondary) mb-3">
        {total} registration{total !== 1 ? 's' : ''}
      </p>

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No registrations found"
          description={
            search || statusFilter
              ? 'No registrations match your filters.'
              : 'No registrations have been submitted yet.'
          }
        />
      ) : (
        <>
          <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
            <Table
              columns={columns}
              data={filtered}
              keyExtractor={(r) => String(r.id)}
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

      <ConfirmDialog
        open={bulkNoShowOpen}
        onClose={() => setBulkNoShowOpen(false)}
        onConfirm={handleBulkNoShow}
        title="Bulk Mark No-Show"
        message="Mark all registrations that haven't checked in as no-show? This can be reversed per registration afterwards."
        confirmText="Mark No-Show"
        variant="danger"
        loading={bulkNoShowMutation.isPending}
      />
    </div>
  )
}
