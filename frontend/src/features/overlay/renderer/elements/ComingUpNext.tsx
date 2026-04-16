// frontend/src/features/overlay/renderer/elements/ComingUpNext.tsx
//
// Top-center banner showing the next match on this court.
// Slides down from the top when visible.
// Hidden automatically when data.next_match is null (no queue).

import { useEffect, useState } from 'react'
import type { ComingUpNextConfig, ElementPosition, OverlayData } from '../../types'
import { clampElementScale } from '../elementScale'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'top-center'

export interface ComingUpNextProps {
  data: OverlayData
  config: ComingUpNextConfig
}

export function ComingUpNext({ data, config }: ComingUpNextProps) {
  const [shown, setShown] = useState(false)
  const hasNext = !!data.next_match

  useEffect(() => {
    if (!config.visible || !hasNext) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 16)
    return () => clearTimeout(t)
  }, [config.visible, hasNext])

  if (!config.visible || !data.next_match) return null

  const next = data.next_match
  const subtitle = [next.division_name, next.round_label].filter(Boolean).join(' · ')

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)
  // Slide direction depends on anchor row — top anchors slide from top,
  // bottom anchors slide from bottom, middle fades in place.
  const offscreen = effectivePosition.startsWith('bottom')
    ? 'translateY(110%)'
    : effectivePosition.startsWith('middle')
      ? 'translateY(0)'
      : 'translateY(-110%)'

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
          transform: `${shown ? 'translateY(0)' : offscreen} scale(${clampElementScale(config.element_scale)})`,
          transformOrigin: origin,
          opacity: shown ? 1 : 0,
          transition:
            'transform 450ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease',
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
