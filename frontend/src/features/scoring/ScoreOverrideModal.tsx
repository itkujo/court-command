// frontend/src/features/scoring/ScoreOverrideModal.tsx
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { useToast } from '../../components/Toast'
import { useOverrideScore } from './hooks'
import type { Match } from './types'

export interface ScoreOverrideModalProps {
  open: boolean
  onClose: () => void
  match: Match
}

interface GameRow {
  game_number: number
  team_1_score: number
  team_2_score: number
  winner: '1' | '2' | ''
}

function buildInitialRows(match: Match): GameRow[] {
  const completed = match.set_scores ?? []
  const rows: GameRow[] = completed.map((g) => ({
    game_number: g.game_num,
    team_1_score: g.team_one_score,
    team_2_score: g.team_two_score,
    winner: String(g.winner) as '1' | '2',
  }))
  // Add the current (uncommitted) game if match is in progress
  if (
    match.status === 'in_progress' &&
    rows.every((r) => r.game_number !== match.current_game)
  ) {
    rows.push({
      game_number: match.current_game,
      team_1_score: match.team_1_score,
      team_2_score: match.team_2_score,
      winner: '',
    })
  }
  return rows
}

export function ScoreOverrideModal({ open, onClose, match }: ScoreOverrideModalProps) {
  const { toast } = useToast()
  const override = useOverrideScore()
  const [rows, setRows] = useState<GameRow[]>(() => buildInitialRows(match))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ reason?: string }>({})

  useEffect(() => {
    if (open) {
      setRows(buildInitialRows(match))
      setReason('')
      setErrors({})
    }
  }, [open, match])

  function updateRow(idx: number, partial: Partial<GameRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...partial } : r)))
  }

  function submit() {
    if (reason.trim().length < 10) {
      setErrors({ reason: 'Reason must be at least 10 characters' })
      return
    }
    override.mutate(
      {
        publicId: match.public_id,
        reason: reason.trim(),
        games: rows.map((r) => ({
          game_number: r.game_number,
          team_1_score: r.team_1_score,
          team_2_score: r.team_2_score,
          winner: r.winner === '' ? null : (Number(r.winner) as 1 | 2),
        })),
      },
      {
        onSuccess: () => {
          toast('success', 'Score override applied')
          onClose()
        },
        onError: (err) =>
          toast('error', err instanceof Error ? err.message : 'Override failed'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Override Score" className="max-w-2xl">
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        {match.status === 'completed' && (
          <div className="rounded bg-amber-500/10 border border-amber-500/30 text-(--color-text-primary) p-3 text-sm">
            This match is already final. Overriding will modify the recorded result.
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-(--color-text-muted) text-xs uppercase">
              <th className="text-left py-1">Game</th>
              <th className="text-left py-1">{match.team_1?.short_name ?? 'T1'}</th>
              <th className="text-left py-1">{match.team_2?.short_name ?? 'T2'}</th>
              <th className="text-left py-1">Winner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.game_number} className="border-t border-(--color-border)">
                <td className="py-2 text-(--color-text-primary)">G{r.game_number}</td>
                <td className="py-1.5 pr-2">
                  <Input
                    type="number"
                    min={0}
                    value={r.team_1_score}
                    onChange={(e) =>
                      updateRow(idx, { team_1_score: Number(e.target.value) || 0 })
                    }
                    className="w-20"
                    aria-label={`Game ${r.game_number} team 1 score`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <Input
                    type="number"
                    min={0}
                    value={r.team_2_score}
                    onChange={(e) =>
                      updateRow(idx, { team_2_score: Number(e.target.value) || 0 })
                    }
                    className="w-20"
                    aria-label={`Game ${r.game_number} team 2 score`}
                  />
                </td>
                <td className="py-1.5">
                  <Select
                    value={r.winner}
                    onChange={(e) =>
                      updateRow(idx, { winner: e.target.value as '1' | '2' | '' })
                    }
                    aria-label={`Game ${r.game_number} winner`}
                  >
                    <option value="">— TBD —</option>
                    <option value="1">{match.team_1?.short_name ?? 'T1'}</option>
                    <option value="2">{match.team_2?.short_name ?? 'T2'}</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <FormField label="Reason" htmlFor="override-reason" error={errors.reason} required>
          <Textarea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required. Why is this override being applied?"
            rows={3}
          />
        </FormField>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={override.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={override.isPending}>
            Apply Override
          </Button>
        </div>
      </div>
    </Modal>
  )
}
