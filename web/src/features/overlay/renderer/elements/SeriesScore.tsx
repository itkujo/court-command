// web/src/features/overlay/renderer/elements/SeriesScore.tsx
//
// Compact dot-grid indicator showing the best-of series score when
// data.series_score is populated. Positioned top-right below the
// sponsor bug so both can coexist.
//
// Dot colors: won dots use team color, unplayed dots use muted backdrop.
// Pulse animation fires briefly whenever a team's win count ticks up.

import { useEffect, useRef, useState } from 'react'
import type { ElementPosition, OverlayData, SeriesScoreConfig } from '../../types'
import { elementScaleStyle } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import {
  originForPosition,
  positionClasses,
} from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'top-right'

export interface SeriesScoreProps {
  data: OverlayData
  config: SeriesScoreConfig
}

export function SeriesScore({ data, config }: SeriesScoreProps) {
  const series = data.series_score

  // Pulse state per team on win-count change.
  const [pulseTeam, setPulseTeam] = useState<1 | 2 | null>(null)
  const prevRef = useRef<{ t1: number; t2: number } | null>(null)

  useEffect(() => {
    if (!series) {
      prevRef.current = null
      return
    }
    const cur = { t1: series.team_1_wins, t2: series.team_2_wins }
    const prev = prevRef.current
    if (prev) {
      if (cur.t1 > prev.t1) {
        setPulseTeam(1)
        const t = setTimeout(() => setPulseTeam(null), 600)
        prevRef.current = cur
        return () => clearTimeout(t)
      }
      if (cur.t2 > prev.t2) {
        setPulseTeam(2)
        const t = setTimeout(() => setPulseTeam(null), 600)
        prevRef.current = cur
        return () => clearTimeout(t)
      }
    }
    prevRef.current = cur
  }, [series])

  const { mounted, opacity } = useFadeMount(Boolean(config.visible) && !!series)
  if (!mounted || !series) return null

  const needed = Math.ceil(series.best_of / 2)
  const rowCells = Math.max(needed, 1)

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)

  return (
    <div
      className={`${positionClasses(effectivePosition)} z-20 px-4 py-2.5 shadow-xl backdrop-blur-md`}
      style={{
        background: 'var(--overlay-primary)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: 'var(--overlay-font-family)',
        ...fadeStyle(opacity),
        ...elementScaleStyle(config, origin),
      }}
      aria-label={`Series score ${series.team_1_wins} to ${series.team_2_wins}, best of ${series.best_of}`}
    >
      <div
        className="text-[10px] uppercase tracking-widest font-bold mb-1.5"
        style={{ color: 'var(--overlay-accent)' }}
      >
        Best of {series.best_of}
      </div>
      <div className="flex flex-col gap-1.5">
        <DotRow
          label={data.team_1.short_name || 'T1'}
          color={data.team_1.color}
          wins={series.team_1_wins}
          total={rowCells}
          pulse={pulseTeam === 1}
        />
        <DotRow
          label={data.team_2.short_name || 'T2'}
          color={data.team_2.color}
          wins={series.team_2_wins}
          total={rowCells}
          pulse={pulseTeam === 2}
        />
      </div>
    </div>
  )
}

interface DotRowProps {
  label: string
  color: string
  wins: number
  total: number
  pulse: boolean
}

function DotRow({ label, color, wins, total, pulse }: DotRowProps) {
  const dots = Array.from({ length: total }, (_, i) => i < wins)
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] uppercase tracking-wider font-bold opacity-70 w-8"
        style={{ color: 'var(--overlay-text)' }}
      >
        {label}
      </span>
      <div className="flex gap-1">
        {dots.map((won, i) => (
          <span
            key={i}
            className="block w-2.5 h-2.5 rounded-full transition-transform"
            style={{
              background: won ? color || 'var(--overlay-accent)' : 'rgba(255,255,255,0.15)',
              transform: pulse && won && i === wins - 1 ? 'scale(1.4)' : 'scale(1)',
              transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
