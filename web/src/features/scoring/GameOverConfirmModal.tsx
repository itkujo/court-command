// web/src/features/scoring/GameOverConfirmModal.tsx
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import type { Match } from './types'

export interface GameOverConfirmModalProps {
  open: boolean
  match: Match | undefined
  pending?: boolean
  /**
   * Whether this prompt is confirming the end of a single game within a
   * best-of series ('game', the default) or the end of the entire match
   * ('match'). Copy and button labels change accordingly.
   */
  kind?: 'game' | 'match'
  onConfirm: () => void
  onContinue: () => void
}

export function GameOverConfirmModal({
  open,
  match,
  pending,
  kind = 'game',
  onConfirm,
  onContinue,
}: GameOverConfirmModalProps) {
  const title = kind === 'match' ? 'Match Over?' : 'Game Over?'
  const confirmLabel = kind === 'match' ? 'End Match' : 'End Game'
  const continueLabel =
    kind === 'match' ? 'Keep Scoring' : 'Continue Scoring'

  if (!match) {
    return (
      <Modal open={open} onClose={onContinue} title={title}>
        <div className="p-4">No match data.</div>
      </Modal>
    )
  }

  const t1 = match.team_1_score
  const t2 = match.team_2_score
  const winner = t1 > t2 ? 1 : 2
  const winnerName =
    (winner === 1 ? match.team_1?.name : match.team_2?.name) ?? `Team ${winner}`

  const threshold =
    kind === 'match'
      ? `Best-of-${match.best_of} decided after game ${match.current_game}.`
      : `Game ${match.current_game} threshold reached.`
  const helper =
    kind === 'match'
      ? 'Confirm to finalize the result, or keep scoring if the call was premature.'
      : 'Confirm to end the game and start the next, or continue scoring (e.g. for a deuce).'

  return (
    <Modal open={open} onClose={onContinue} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--color-text-secondary)">{threshold}</p>
        <div className="text-center bg-(--color-bg-hover) rounded-lg p-4">
          <div className="text-4xl font-extrabold tabular-nums text-(--color-text-primary)">
            {t1} – {t2}
          </div>
          <div className="text-sm text-cyan-500 font-semibold mt-2">
            {winnerName} wins
          </div>
        </div>
        <p className="text-xs text-(--color-text-muted)">{helper}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onContinue} disabled={pending}>
            {continueLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
