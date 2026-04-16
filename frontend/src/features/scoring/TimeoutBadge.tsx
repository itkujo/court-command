// frontend/src/features/scoring/TimeoutBadge.tsx
import { Pause } from 'lucide-react'

export interface TimeoutBadgeProps {
  used: number
  total: number
  /** Allowed-to-use even though all used? Spec is "advisory" */
  warningWhenZero?: boolean
}

export function TimeoutBadge({
  used,
  total,
  warningWhenZero = true,
}: TimeoutBadgeProps) {
  const remaining = Math.max(0, total - used)
  const isZero = remaining === 0
  return (
    <span
      className={
        isZero && warningWhenZero
          ? 'inline-flex items-center gap-1 text-xs font-medium text-(--color-warning)'
          : 'inline-flex items-center gap-1 text-xs font-medium text-(--color-text-secondary)'
      }
      aria-label={`Timeouts remaining: ${remaining} of ${total}`}
    >
      <Pause size={14} />
      <span>
        {remaining}/{total} TO
      </span>
    </span>
  )
}
