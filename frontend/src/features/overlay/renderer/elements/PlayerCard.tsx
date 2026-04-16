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

import type { ElementPosition, OverlayData, OverlayTrigger, PlayerCardConfig } from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'bottom-center'

export interface PlayerCardProps {
  data: OverlayData
  config: PlayerCardConfig
  /** Optional one-shot trigger from the Control Panel Triggers tab. */
  trigger?: OverlayTrigger | null
}

export function PlayerCard({ data, config, trigger }: PlayerCardProps) {
  const effectiveVisible = trigger != null || config.visible
  const { mounted, opacity } = useFadeMount(Boolean(effectiveVisible))
  if (!mounted) return null

  // Selection priority (first non-null wins):
  //   1. Trigger payload.player_id (one-shot, beats config)
  //   2. config.selected_player slot (Elements tab dropdown)
  //   3. Serving team's current server (original default)
  const playerId =
    typeof trigger?.payload?.player_id === 'string' ? trigger.payload.player_id : null
  const { player, team } = resolvePlayer(data, playerId, config.selected_player ?? null)
  if (!player) return null

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
        className="flex items-center gap-5 px-8 py-5 shadow-2xl backdrop-blur-md max-w-lg"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: origin,
          ...fadeStyle(opacity),
          borderLeft: `4px solid ${team.color || 'var(--overlay-accent)'}`,
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0"
          style={{
            background: team.color || 'var(--overlay-accent)',
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
            {team.name}
          </div>
          <div className="text-xl font-bold truncate">{player.name}</div>
        </div>
      </div>
    </div>
  )
}

function resolvePlayer(
  data: OverlayData,
  playerId: string | null,
  slot: import('../../types').PlayerCardSlot | null,
): { player: OverlayData['team_1']['players'][number] | null; team: OverlayData['team_1'] } {
  if (playerId) {
    // Name-based lookup as a best-effort fallback; players currently
    // carry only { name } — future phases may surface an ID.
    const t1Match = data.team_1.players.find(
      (p) => p.name === playerId || p.name.toLowerCase().includes(playerId.toLowerCase()),
    )
    if (t1Match) return { player: t1Match, team: data.team_1 }
    const t2Match = data.team_2.players.find(
      (p) => p.name === playerId || p.name.toLowerCase().includes(playerId.toLowerCase()),
    )
    if (t2Match) return { player: t2Match, team: data.team_2 }
  }
  if (slot) {
    const team = slot.startsWith('team_1') ? data.team_1 : data.team_2
    const idx = slot.endsWith('player_2') ? 1 : 0
    const p = team.players[idx]
    if (p) return { player: p, team }
    // Slot selected but roster too short — fall through to server default.
  }
  const servingTeam = data.serving_team === 2 ? data.team_2 : data.team_1
  const serverIdx = Math.max(0, (data.server_number ?? 1) - 1)
  const player = servingTeam.players[serverIdx] ?? servingTeam.players[0] ?? null
  return { player, team: servingTeam }
}

function initialsOf(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
