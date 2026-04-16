// frontend/src/features/overlay/renderer/elements/ComingUpNext.tsx
//
// Top-center banner showing the next match on this court.
// Slides down from the top when visible.
// Hidden automatically when data.next_match is null (no queue).

import { useEffect, useState } from 'react'
import type { ComingUpNextConfig, OverlayData } from '../../types'
import { clampElementScale } from '../elementScale'

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

  return (
    <div
      className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="mt-6 px-6 py-3 shadow-2xl backdrop-blur-md text-center min-w-[360px]"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          // Chain entry-slide with user scale knob. translateY first so
          // scale doesn't amplify the off-screen offset.
          transform: `${shown ? 'translateY(0)' : 'translateY(-110%)'} scale(${clampElementScale(config.element_scale)})`,
          transformOrigin: 'top center',
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
