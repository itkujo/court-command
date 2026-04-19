import { useState } from 'react'
import { useTournamentStaff, useRegenerateStaffPassword, type TournamentStaffMember } from './hooks'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'

interface TournamentStaffProps {
  tournamentId: number
}

function StaffCard({
  member,
  onRegenerate,
  isRegenerating,
}: {
  member: TournamentStaffMember
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast } = useToast()

  const roleLabel = member.role === 'referee' ? 'Referee' : 'Scorekeeper'
  const badgeVariant = member.role === 'referee' ? 'info' as const : 'success' as const

  function handleCopy() {
    const text = `Email: ${member.email}\nPassword: ${member.raw_password}`
    navigator.clipboard.writeText(text).then(() => {
      toast('success', 'Credentials copied to clipboard')
    }).catch(() => {
      toast('error', 'Failed to copy credentials')
    })
  }

  function handleConfirmRegenerate() {
    setConfirmOpen(false)
    onRegenerate()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {roleLabel}
        </h3>
        <Badge variant={badgeVariant}>{roleLabel}</Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Email
          </label>
          <p className="font-mono text-sm text-gray-900 dark:text-white">
            {member.email}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Password
          </label>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-gray-900 dark:text-white">
              {showPassword ? member.raw_password : '••••••••••••••••'}
            </p>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          Copy Credentials
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          loading={isRegenerating}
        >
          Regenerate Password
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Regenerate Password"
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          This will generate a new password for the {roleLabel.toLowerCase()} account.
          The old password will stop working immediately. Are you sure?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmRegenerate}>
            Regenerate
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export function TournamentStaff({ tournamentId }: TournamentStaffProps) {
  const { data: staff, isLoading, error } = useTournamentStaff(tournamentId)
  const regenerate = useRegenerateStaffPassword(tournamentId)
  const { toast } = useToast()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        Failed to load staff accounts. Please try again.
      </div>
    )
  }

  if (!staff || staff.length === 0) {
    return (
      <EmptyState
        title="No Staff Accounts"
        description="Staff accounts were not created for this tournament."
      />
    )
  }

  function handleRegenerate(role: string) {
    regenerate.mutate(role, {
      onSuccess: () => {
        toast('success', 'Password regenerated successfully')
      },
      onError: () => {
        toast('error', 'Failed to regenerate password')
      },
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Staff Accounts
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          These accounts are auto-created for tournament staff. Share the
          credentials with your referee and scorekeeper.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {staff.map((member) => (
          <StaffCard
            key={member.id}
            member={member}
            onRegenerate={() => handleRegenerate(member.role)}
            isRegenerating={regenerate.isPending && regenerate.variables === member.role}
          />
        ))}
      </div>
    </div>
  )
}
