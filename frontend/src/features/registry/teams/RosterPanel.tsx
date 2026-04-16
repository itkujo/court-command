import { useState } from 'react'
import { useTeamRoster, useAddPlayerToRoster, useRemovePlayerFromRoster } from './hooks'
import { usePlayerSearch } from '../players/hooks'
import { useDebounce } from '../../../hooks/useDebounce'
import { Table } from '../../../components/Table'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SearchInput } from '../../../components/SearchInput'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { useToast } from '../../../components/Toast'
import { Plus, Trash2, Users } from 'lucide-react'
import { formatDate, formatPlayerName } from '../../../lib/formatters'

interface RosterPanelProps {
  teamId: string
}

export function RosterPanel({ teamId }: RosterPanelProps) {
  const { data: roster, isLoading } = useTeamRoster(teamId)
  const addPlayer = useAddPlayerToRoster(teamId)
  const removePlayer = useRemovePlayerFromRoster(teamId)
  const { toast } = useToast()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{
    playerId: number
    name: string
  } | null>(null)

  const [playerSearch, setPlayerSearch] = useState('')
  const debouncedPlayerSearch = useDebounce(playerSearch)
  const { data: searchResults } = usePlayerSearch(debouncedPlayerSearch, 10, 0)

  const handleAdd = (playerId: number) => {
    addPlayer.mutate(
      { player_id: playerId },
      {
        onSuccess: () => {
          toast('success', 'Player added to roster')
          setIsAddOpen(false)
          setPlayerSearch('')
        },
        onError: (err) => toast('error', (err as Error).message),
      },
    )
  }

  const handleRemove = () => {
    if (!removeTarget) return
    removePlayer.mutate(removeTarget.playerId, {
      onSuccess: () => {
        toast('success', 'Player removed from roster')
        setRemoveTarget(null)
      },
      onError: (err) => toast('error', (err as Error).message),
    })
  }

  const columns = [
    {
      key: 'name',
      header: 'Player',
      render: (r: NonNullable<typeof roster>[0]) => (
        <span className="font-medium text-(--color-text-primary)">
          {formatPlayerName(r.first_name, r.last_name, r.display_name)}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (r: NonNullable<typeof roster>[0]) => (
        <Badge variant="info">{r.role}</Badge>
      ),
    },
    {
      key: 'jersey_number',
      header: 'Jersey #',
      render: (r: NonNullable<typeof roster>[0]) => (
        <span className="text-(--color-text-secondary)">
          {r.jersey_number != null ? `#${r.jersey_number}` : '\u2014'}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'joined_at',
      header: 'Joined',
      render: (r: NonNullable<typeof roster>[0]) => (
        <span className="text-(--color-text-secondary)">{formatDate(r.joined_at)}</span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      render: (r: NonNullable<typeof roster>[0]) => (
        <button
          onClick={() =>
            setRemoveTarget({
              playerId: r.player_id,
              name: formatPlayerName(r.first_name, r.last_name, r.display_name),
            })
          }
          className="text-(--color-text-secondary) hover:text-red-500 transition-colors p-1"
          aria-label={`Remove ${r.first_name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">Roster</h2>
        <Button size="sm" variant="secondary" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Player
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : !roster || roster.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No players on roster"
          description="Add players to this team's roster."
        />
      ) : (
        <Table columns={columns} data={roster} keyExtractor={(r) => r.player_id} />
      )}

      <Modal open={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Player to Roster">
        <SearchInput
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          placeholder="Search players..."
          className="mb-4"
        />
        {searchResults?.items && searchResults.items.length > 0 ? (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {searchResults.items.map((p) => (
              <li key={p.public_id}>
                <button
                  onClick={() => handleAdd(Number(p.public_id))}
                  disabled={addPlayer.isPending}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-(--color-bg-hover) transition-colors text-sm text-(--color-text-primary)"
                >
                  {formatPlayerName(p.first_name, p.last_name, p.display_name)}
                  <span className="text-(--color-text-secondary) ml-2 text-xs">
                    {p.public_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : playerSearch ? (
          <p className="text-sm text-(--color-text-secondary) text-center py-4">
            No players found
          </p>
        ) : (
          <p className="text-sm text-(--color-text-secondary) text-center py-4">
            Search for a player to add
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove Player"
        message={`Remove ${removeTarget?.name ?? 'this player'} from the roster?`}
        confirmText="Remove"
        variant="danger"
        loading={removePlayer.isPending}
      />
    </div>
  )
}
