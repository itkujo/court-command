// frontend/src/features/overlay/renderer/elements/BracketSnapshot.tsx
//
// Center-full bracket view. Renders the division bracket from
// OverlayData.bracket, grouped by round with match cards showing
// team names, scores, and status indicators.

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

  const bracket = data.bracket
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
        className="px-8 py-6 shadow-2xl backdrop-blur-md max-w-5xl w-[min(1100px,95vw)]"
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
        {/* Header */}
        <div
          className="text-xs uppercase tracking-[0.25em] font-bold mb-5 text-center"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Bracket · {bracket?.division_name || data.division_name || data.tournament_name || 'Tournament'}
        </div>

        {/* Bracket content */}
        {!bracket || bracket.rounds.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <div className="text-sm uppercase tracking-widest font-semibold mb-2">
              No bracket data
            </div>
            <div className="text-xs max-w-sm mx-auto">
              Bracket data will appear when matches are created for this division.
            </div>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2" role="list" aria-label="Bracket rounds">
            {bracket.rounds.map((round) => (
              <div
                key={round.round_num}
                className="flex-shrink-0 min-w-[180px]"
                role="listitem"
              >
                {/* Round header */}
                <div
                  className="text-[10px] uppercase tracking-widest font-bold text-center mb-3 pb-1"
                  style={{
                    color: 'var(--overlay-accent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--overlay-text) 15%, transparent)',
                  }}
                >
                  {round.round_name}
                </div>

                {/* Matches in this round */}
                <div className="flex flex-col gap-2 justify-around h-full">
                  {round.matches.map((match) => {
                    const isActive = match.status === 'in_progress'
                    const isComplete = match.status === 'completed'

                    return (
                      <div
                        key={match.match_number}
                        className="rounded overflow-hidden"
                        style={{
                          background: 'color-mix(in srgb, var(--overlay-secondary) 80%, transparent)',
                          border: isActive
                            ? '1px solid var(--overlay-accent)'
                            : '1px solid color-mix(in srgb, var(--overlay-text) 10%, transparent)',
                        }}
                      >
                        {/* Team 1 row */}
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5 text-xs"
                          style={{
                            opacity: isComplete && match.winner === 2 ? 0.5 : 1,
                            fontWeight: isComplete && match.winner === 1 ? 700 : 400,
                          }}
                        >
                          <span className="truncate max-w-[120px]">
                            {match.team_1_name || 'TBD'}
                          </span>
                          <span className="ml-2 tabular-nums font-mono text-[11px]">
                            {match.team_1_score}
                          </span>
                        </div>

                        {/* Divider */}
                        <div
                          style={{
                            height: '1px',
                            background: 'color-mix(in srgb, var(--overlay-text) 10%, transparent)',
                          }}
                        />

                        {/* Team 2 row */}
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5 text-xs"
                          style={{
                            opacity: isComplete && match.winner === 1 ? 0.5 : 1,
                            fontWeight: isComplete && match.winner === 2 ? 700 : 400,
                          }}
                        >
                          <span className="truncate max-w-[120px]">
                            {match.team_2_name || 'TBD'}
                          </span>
                          <span className="ml-2 tabular-nums font-mono text-[11px]">
                            {match.team_2_score}
                          </span>
                        </div>

                        {/* Active match indicator */}
                        {isActive && (
                          <div
                            className="h-0.5"
                            style={{ background: 'var(--overlay-accent)' }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
