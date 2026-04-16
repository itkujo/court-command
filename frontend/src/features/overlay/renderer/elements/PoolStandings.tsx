// frontend/src/features/overlay/renderer/elements/PoolStandings.tsx
//
// Center-full pool standings table. Like BracketSnapshot, this is a
// framed placeholder in Phase 4B — the OverlayData contract does not
// currently stream standings rows. The element is correctly wired
// (visible toggle + theme + row-stagger entry) so the control panel
// and OBS scene graph can treat it as present.

import { useEffect, useState } from 'react'
import type { ElementPosition, OverlayData, PoolStandingsConfig } from '../../types'
import { clampElementScale } from '../elementScale'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'middle-center'

export interface PoolStandingsProps {
  data: OverlayData
  config: PoolStandingsConfig
}

export function PoolStandings({ data, config }: PoolStandingsProps) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!config.visible) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 16)
    return () => clearTimeout(t)
  }, [config.visible])

  if (!config.visible) return null

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)

  return (
    <div
      className={`${posClass} z-30 pointer-events-none`}
      aria-live="polite"
    >
      <div
        className="px-10 py-8 shadow-2xl backdrop-blur-md max-w-2xl w-[min(700px,90vw)]"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          opacity: shown ? 1 : 0,
          transform: `translateY(${shown ? 0 : 10}px) scale(${clampElementScale(config.element_scale)})`,
          transformOrigin: origin,
          transition: 'opacity 400ms ease, transform 400ms ease',
        }}
      >
        <div
          className="text-xs uppercase tracking-[0.25em] font-bold mb-4 text-center"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Pool Standings · {data.division_name || 'Division'}
        </div>
        <div className="text-center py-12 opacity-60">
          <div className="text-sm uppercase tracking-widest font-semibold mb-2">
            Standings snapshot
          </div>
          <div className="text-xs max-w-sm mx-auto">
            Live standings streaming ships with the tournament payload in
            a later release. Use the Control Panel to toggle visibility.
          </div>
        </div>
      </div>
    </div>
  )
}
