// frontend/src/features/overlay/renderer/elements/BracketSnapshot.tsx
//
// Center-full bracket view. For Phase 4B we render a framing-only
// shell — the backend does not currently expose a bracket-payload
// stream as part of OverlayData, so we keep the element visible but
// with a "no bracket data" fallback when none is available.
//
// Phase 4E may wire an optional `bracket` payload into OverlayData (or
// a side channel); at that point this file will render the rounds grid.
// For now the component is functionally wired (visible toggle, theme,
// fade-in) so the Control Panel can enable/disable it without error.

import type { BracketSnapshotConfig, ElementPosition, OverlayData } from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'middle-center'

export interface BracketSnapshotProps {
  data: OverlayData
  config: BracketSnapshotConfig
}

export function BracketSnapshot({ data, config }: BracketSnapshotProps) {
  const { mounted, opacity } = useFadeMount(Boolean(config.visible))
  if (!mounted) return null

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)
  const scale = clampElementScale(config.element_scale)

  return (
    <div
      className={`${posClass} z-30 pointer-events-none`}
      aria-live="polite"
    >
      <div
        className="px-10 py-8 shadow-2xl backdrop-blur-md max-w-4xl w-[min(900px,90vw)]"
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
          className="text-xs uppercase tracking-[0.25em] font-bold mb-4 text-center"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Bracket · {data.division_name || data.tournament_name || 'Tournament'}
        </div>
        <div className="text-center py-12 opacity-60">
          <div className="text-sm uppercase tracking-widest font-semibold mb-2">
            Bracket snapshot
          </div>
          <div className="text-xs max-w-sm mx-auto">
            Full bracket rendering ships with the tournament payload in a
            later release. Use the Control Panel to toggle visibility.
          </div>
        </div>
      </div>
    </div>
  )
}
