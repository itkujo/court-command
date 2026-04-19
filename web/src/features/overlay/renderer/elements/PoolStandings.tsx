// web/src/features/overlay/renderer/elements/PoolStandings.tsx
//
// Center-full pool standings table. Renders OverlayData.pool with a
// ranked table showing team names, W-L records, and point differentials.

import type { ElementPosition, OverlayData, PoolStandingsConfig } from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'middle-center'

export interface PoolStandingsProps {
  data: OverlayData
  config: PoolStandingsConfig
}

export function PoolStandings({ data, config }: PoolStandingsProps) {
  const { mounted, opacity } = useFadeMount(Boolean(config.visible))
  if (!mounted) return null

  const pool = data.pool
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
        className="px-8 py-6 shadow-2xl backdrop-blur-md max-w-2xl w-[min(700px,90vw)]"
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
          {pool?.pool_name || 'Pool'} Standings · {pool?.division_name || data.division_name || 'Division'}
        </div>

        {/* Standings content */}
        {!pool || pool.standings.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <div className="text-sm uppercase tracking-widest font-semibold mb-2">
              No standings data
            </div>
            <div className="text-xs max-w-sm mx-auto">
              Pool standings will appear when matches have been played.
            </div>
          </div>
        ) : (
          <table className="w-full text-xs" role="table" aria-label="Pool standings">
            <thead>
              <tr
                className="uppercase tracking-widest text-[10px]"
                style={{
                  color: 'var(--overlay-accent)',
                  borderBottom: '1px solid color-mix(in srgb, var(--overlay-text) 15%, transparent)',
                }}
              >
                <th className="text-left py-2 px-2 font-bold w-8">#</th>
                <th className="text-left py-2 px-2 font-bold">Team</th>
                <th className="text-center py-2 px-2 font-bold w-10">W</th>
                <th className="text-center py-2 px-2 font-bold w-10">L</th>
                <th className="text-right py-2 px-2 font-bold w-14">+/-</th>
              </tr>
            </thead>
            <tbody>
              {pool.standings.map((entry, idx) => {
                const isFirst = entry.rank === 1
                return (
                  <tr
                    key={entry.rank}
                    style={{
                      borderBottom:
                        idx < pool.standings.length - 1
                          ? '1px solid color-mix(in srgb, var(--overlay-text) 8%, transparent)'
                          : undefined,
                      fontWeight: isFirst ? 700 : 400,
                    }}
                  >
                    <td className="py-2 px-2 tabular-nums">{entry.rank}</td>
                    <td className="py-2 px-2 truncate max-w-[200px]">{entry.team_name}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{entry.wins}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{entry.losses}</td>
                    <td
                      className="py-2 px-2 text-right tabular-nums font-mono"
                      style={{
                        color:
                          entry.point_differential > 0
                            ? 'var(--overlay-accent)'
                            : entry.point_differential < 0
                              ? 'color-mix(in srgb, var(--overlay-text) 50%, transparent)'
                              : undefined,
                      }}
                    >
                      {entry.point_differential > 0 ? '+' : ''}
                      {entry.point_differential}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
