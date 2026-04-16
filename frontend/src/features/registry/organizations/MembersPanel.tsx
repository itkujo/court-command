import { useState } from 'react'
import {
  useOrgMembers,
  useAddMember,
  useRemoveMember,
  useUpdateMemberRole,
} from './hooks'
import { usePlayerSearch } from '../players/hooks'
import { useDebounce } from '../../../hooks/useDebounce'
import { Table } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SearchInput } from '../../../components/SearchInput'
import { Select } from '../../../components/Select'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { useToast } from '../../../components/Toast'
import { Plus, Trash2, Users } from 'lucide-react'
import { formatDate } from '../../../lib/formatters'

interface MembersPanelProps {
  orgId: string
}

const ROLE_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  owner: 'success',
  admin: 'info',
  member: 'default',
}

export function MembersPanel({ orgId }: MembersPanelProps) {
  const { data: members, isLoading } = useOrgMembers(orgId)
  const addMember = useAddMember(orgId)
  const removeMember = useRemoveMember(orgId)
  const updateRole = useUpdateMemberRole(orgId)
  const { toast } = useToast()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{
    userId: number
    name: string
  } | null>(null)

  const [playerSearch, setPlayerSearch] = useState('')
  const debouncedPlayerSearch = useDebounce(playerSearch)
  const { data: searchResults } = usePlayerSearch(debouncedPlayerSearch, 10, 0)

  const handleAdd = (userId: number) => {
    addMember.mutate(
      { user_id: userId },
      {
        onSuccess: () => {
          toast('success', 'Member added')
          setIsAddOpen(false)
          setPlayerSearch('')
        },
        onError: (err) => toast('error', (err as Error).message),
      },
    )
  }

  const handleRemove = () => {
    if (!removeTarget) return
    removeMember.mutate(removeTarget.userId, {
      onSuccess: () => {
        toast('success', 'Member removed')
        setRemoveTarget(null)
      },
      onError: (err) => toast('error', (err as Error).message),
    })
  }

  const handleRoleChange = (userId: number, role: string) => {
    updateRole.mutate(
      { userId, role },
      {
        onSuccess: () => toast('success', 'Role updated'),
        onError: (err) => toast('error', (err as Error).message),
      },
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (m: NonNullable<typeof members>[0]) => (
        <span className="font-medium text-(--color-text-primary)">
          {m.first_name} {m.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (m: NonNullable<typeof members>[0]) => (
        <span className="text-(--color-text-secondary) text-sm">{m.email}</span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'role',
      header: 'Role',
      render: (m: NonNullable<typeof members>[0]) => (
        <div className="flex items-center gap-2">
          <Badge variant={ROLE_VARIANTS[m.role] ?? 'default'}>{m.role}</Badge>
          <Select
            value={m.role}
            onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
            className="w-24 text-xs !py-1"
          >
            <option value="owner">owner</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
          </Select>
        </div>
      ),
    },
    {
      key: 'joined_at',
      header: 'Joined',
      render: (m: NonNullable<typeof members>[0]) => (
        <span className="text-(--color-text-secondary)">{formatDate(m.joined_at)}</span>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: '',
      render: (m: NonNullable<typeof members>[0]) => (
        <button
          onClick={() =>
            setRemoveTarget({
              userId: m.user_id,
              name: `${m.first_name} ${m.last_name}`,
            })
          }
          className="text-(--color-text-secondary) hover:text-red-500 transition-colors p-1"
          aria-label={`Remove ${m.first_name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">Members</h2>
        <Button size="sm" variant="secondary" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : !members || members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No members"
          description="Add members to this organization."
        />
      ) : (
        <Table columns={columns} data={members} keyExtractor={(m) => m.user_id} />
      )}

      <Modal open={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Member">
        <SearchInput
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          placeholder="Search users..."
          className="mb-4"
        />
        {searchResults?.items && searchResults.items.length > 0 ? (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {searchResults.items.map((p) => (
              <li key={p.public_id}>
                <button
                  onClick={() => handleAdd(p.id)}
                  disabled={addMember.isPending}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-(--color-bg-hover) transition-colors text-sm text-(--color-text-primary)"
                >
                  {p.first_name} {p.last_name}
                  {p.email && (
                    <span className="text-(--color-text-secondary) ml-2 text-xs">
                      {p.email}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : playerSearch ? (
          <p className="text-sm text-(--color-text-secondary) text-center py-4">
            No users found
          </p>
        ) : (
          <p className="text-sm text-(--color-text-secondary) text-center py-4">
            Search for a user to add
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove Member"
        message={`Remove ${removeTarget?.name ?? 'this member'} from the organization?`}
        confirmText="Remove"
        variant="danger"
        loading={removeMember.isPending}
      />
    </div>
  )
}
