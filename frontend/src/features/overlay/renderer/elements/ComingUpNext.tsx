// frontend/src/features/overlay/renderer/elements/ComingUpNext.tsx
//
// Top-center banner showing the next match on this court.
// Slides down from the top when visible.
// Hidden automatically when data.next_match is null (no queue).

import type { ComingUpNextConfig, ElementPosition, OverlayData } from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'top-center'

export interface ComingUpNextProps {
  data: OverlayData
  config: ComingUpNextConfig
}

export function ComingUpNext({ data, config }: ComingUpNextProps) {
  const hasNext = !!data.next_match
  const { mounted, opacity } = useFadeMount(Boolean(config.visible) && hasNext)
  if (!mounted || !data.next_match) return null

  const next = data.next_match
  const subtitle = [next.division_name, next.round_label].filter(Boolean).join(' · ')

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)
  const scale = clampElementScale(config.element_scale)

  return (
    <div
      className={`${posClass} z-20 pointer-events-none`}
      aria-live="polite"
    >
      <div
        className="px-6 py-3 shadow-2xl backdrop-blur-md text-center min-w-[360px]"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: origin,
          ...fadeStyle(opacity),
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.25em] font-bold mb-1"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Coming Up Next
        </div>
        <div className="text-lg font-bold tracking-tight leading-tight">
          {next.team_1_name} <span className="opacity-50">vs</span>{' '}
          {next.team_2_name}
        </div>
        {subtitle && (
          <div className="text-xs opacity-70 mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  )
}
