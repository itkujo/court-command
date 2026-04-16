// frontend/src/features/scoring/ServeIndicator.tsx
import { Circle } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ServeIndicatorProps {
  active: boolean
  serverNumber?: 1 | 2 | null
  /** Label for screen readers; component renders icon-only */
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ServeIndicator({
  active,
  serverNumber,
  ariaLabel,
  size = 'md',
}: ServeIndicatorProps) {
  const dim = size === 'sm' ? 16 : size === 'lg' ? 28 : 22
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 select-none',
        active
          ? 'text-(--color-accent)'
          : 'text-(--color-text-muted) opacity-50',
      )}
      aria-label={ariaLabel ?? (active ? 'Serving' : 'Not serving')}
    >
      <Circle
        size={dim}
        fill={active ? 'currentColor' : 'transparent'}
        strokeWidth={active ? 0 : 2}
      />
      {active && serverNumber ? (
        <span className="text-sm font-bold">{serverNumber}</span>
      ) : null}
    </span>
  )
}
