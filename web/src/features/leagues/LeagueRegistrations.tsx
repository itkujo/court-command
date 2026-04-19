import { useState } from 'react'
import {
  useListLeagueRegistrations,
  useUpdateLeagueRegistrationStatus,
} from './hooks'
import { Table } from '../../components/Table'
import { Button } from '../../components/Button'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { useToast } from '../../components/Toast'
import { Building2 } from 'lucide-react'
import { formatDate } from '../../lib/formatters'

interface Props {
  leagueId: number
}

export function LeagueRegistrations({ leagueId }: Props) {
  const { toast } = useToast()
  const { data: regs, isLoading, error } = useListLeagueRegistrations(leagueId)
  const updateStatus = useUpdateLeagueRegistrationStatus(leagueId)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  async function handleStatus(regId: number, status: string) {
    setUpdatingId(regId)
    try {
      await updateStatus.mutateAsync({ registrationId: regId, status })
      toast('success', `Registration ${status}`)
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const columns = [
    {
      key: 'org',
      header: 'Organization',
      render: (r: { org_name?: string; org_id: number }) => (
        <span className="font-medium text-(--color-text-primary)">
          {r.org_name || `Org #${r.org_id}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: { status: string }) => (
        <StatusBadge status={r.status} type="registration" />
      ),
    },
    {
      key: 'registered_at',
      header: 'Registered',
      render: (r: { registered_at: string }) => (
        <span className="text-(--color-text-secondary)">
          {formatDate(r.registered_at)}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: { id: number; status: string }) => (
        <div className="flex gap-2">
          {r.status === 'active' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatus(r.id, 'suspended')}
                disabled={updatingId === r.id}
              >
                Suspend
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatus(r.id, 'withdrawn')}
                disabled={updatingId === r.id}
              >
                Withdraw
              </Button>
            </>
          )}
          {r.status === 'suspended' && (
            <Button
              size="sm"
              onClick={() => handleStatus(r.id, 'active')}
              disabled={updatingId === r.id}
            >
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (error) {
    return (
      <EmptyState
        title="Failed to load registrations"
        description={(error as Error).message}
      />
    )
  }
  if (!regs || regs.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="No organizations registered"
        description="Organizations can register to participate in this league."
      />
    )
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) overflow-hidden">
      <Table columns={columns} data={regs} keyExtractor={(r) => r.id} />
    </div>
  )
}
