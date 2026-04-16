// frontend/src/features/overlay/renderer/elements/PlayerCard.tsx
//
// Center-bottom overlay card showing a single player profile.
// Driven by config.visible (for "always on" profile displays) OR by
// the trigger queue (Phase 4E) for one-shot pushes.
//
// Default dismiss mode: MANUAL. Operators click "Dismiss" in the
// control panel. Optional auto-dismiss via config.auto_dismiss_seconds
// for unattended venues.
//
// For Phase 4B we render using team_1 captain (first player) as the
// default player when config.visible is true. Phase 4E will switch to
// trigger-driven payload selection.

import { useEffect, useState } from 'react'
import type { OverlayData, PlayerCardConfig } from '../../types'

export interface PlayerCardProps {
  data: OverlayData
  config: PlayerCardConfig
}

export function PlayerCard({ data, config }: PlayerCardProps) {
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

  // Default: first player of team_1 (Phase 4B stand-in). Phase 4E will
  // receive the selected player via trigger payload.
  const player = data.team_1.players[0]
  if (!player) return null

  return (
    <div
      className="absolute inset-0 flex items-end justify-center pb-32 z-30 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-5 px-8 py-5 shadow-2xl backdrop-blur-md max-w-lg"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          transform: shown ? 'scale(1)' : 'scale(0.9)',
          opacity: shown ? 1 : 0,
          transition:
            'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease',
          borderLeft: `4px solid ${data.team_1.color || 'var(--overlay-accent)'}`,
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0"
          style={{
            background: data.team_1.color || 'var(--overlay-accent)',
            color: 'var(--overlay-primary)',
          }}
        >
          {initialsOf(player.name)}
        </div>
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-widest font-bold opacity-70"
            style={{ color: 'var(--overlay-accent)' }}
          >
            {data.team_1.name}
          </div>
          <div className="text-xl font-bold truncate">{player.name}</div>
        </div>
      </div>
    </div>
  )
}

function initialsOf(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
