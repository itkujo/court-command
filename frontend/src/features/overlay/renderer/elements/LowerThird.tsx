// frontend/src/features/overlay/renderer/elements/LowerThird.tsx
//
// Bottom full-width banner. Used to display match context (division,
// round, teams) with a broadcast-style slide-up entry.
//
// Unlike the scoreboard (which is compact bottom-left), the lower third
// is a wide horizontal band spanning most of the viewport width. It's
// meant to be shown briefly before a point or between games, not left up
// for an entire match.

import type { LowerThirdConfig, OverlayData } from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'

export interface LowerThirdProps {
  data: OverlayData
  config: LowerThirdConfig
}

export function LowerThird({ data, config }: LowerThirdProps) {
  const { mounted, opacity } = useFadeMount(Boolean(config.visible))
  if (!mounted) return null

  const title = data.division_name || data.tournament_name || data.court_name
  const subtitle = [data.round_label, data.match_info].filter(Boolean).join(' · ')
  const matchup = `${data.team_1.name} vs ${data.team_2.name}`
  const scale = clampElementScale(config.element_scale)

  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-10 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="mx-6 mb-6 px-8 py-5 shadow-2xl backdrop-blur-md"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'bottom center',
          ...fadeStyle(opacity),
        }}
      >
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div
              className="text-xs uppercase tracking-[0.2em] font-bold mb-1 truncate"
              style={{ color: 'var(--overlay-accent)' }}
            >
              {title}
            </div>
            <div className="text-2xl font-bold leading-tight truncate">
              {matchup}
            </div>
          </div>
          {subtitle && (
            <div
              className="text-xs uppercase tracking-widest font-semibold opacity-80 shrink-0"
              style={{ color: 'var(--overlay-text)' }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
