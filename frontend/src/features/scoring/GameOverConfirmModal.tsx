// frontend/src/features/scoring/GameOverConfirmModal.tsx
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import type { Match } from './types'

export interface GameOverConfirmModalProps {
  open: boolean
  match: Match | undefined
  pending?: boolean
  onConfirm: () => void
  onContinue: () => void
}

export function GameOverConfirmModal({
  open,
  match,
  pending,
  onConfirm,
  onContinue,
}: GameOverConfirmModalProps) {
  if (!match) {
    return (
      <Modal open={open} onClose={onContinue} title="Game Over?">
        <div className="p-4">No match data.</div>
      </Modal>
    )
  }

  const t1 = match.team_1_score
  const t2 = match.team_2_score
  const winner = t1 > t2 ? 1 : 2
  const winnerName =
    (winner === 1 ? match.team_1?.name : match.team_2?.name) ?? `Team ${winner}`

  return (
    <Modal open={open} onClose={onContinue} title="Game Over?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--color-text-secondary)">
          Game {match.current_game} threshold reached.
        </p>
        <div className="text-center bg-(--color-bg-hover) rounded-lg p-4">
          <div className="text-4xl font-extrabold tabular-nums text-(--color-text-primary)">
            {t1} – {t2}
          </div>
          <div className="text-sm text-cyan-500 font-semibold mt-2">
            {winnerName} wins
          </div>
        </div>
        <p className="text-xs text-(--color-text-muted)">
          Confirm to end the game and start the next, or continue scoring (e.g. for a deuce).
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onContinue} disabled={pending}>
            Continue Scoring
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={pending}>
            End Game
          </Button>
        </div>
      </div>
    </Modal>
  )
}
