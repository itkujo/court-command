// web/src/features/overlay/renderer/elements/TeamCard.tsx
//
// Center-bottom overlay showing both teams side-by-side with all
// players listed. Used for "introducing the teams" moments — before
// the first serve, entering a championship game, etc.
//
// Default dismiss: MANUAL (same contract as PlayerCard).

import type {
  ElementPosition,
  OverlayData,
  OverlayTeamData,
  OverlayTrigger,
  TeamCardConfig,
} from '../../types'
import { clampElementScale } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'bottom-center'

export interface TeamCardProps {
  data: OverlayData
  config: TeamCardConfig
  /** Optional one-shot trigger from the Control Panel Triggers tab. */
  trigger?: OverlayTrigger | null
}

export function TeamCard({ data, config, trigger }: TeamCardProps) {
  const effectiveVisible = trigger != null || config.visible
  const { mounted, opacity } = useFadeMount(Boolean(effectiveVisible))
  if (!mounted) return null

  // Selection priority:
  //   1. Trigger payload.team_id (one-shot, beats config) — '1' | 1 | '2' | 2
  //   2. config.selected_team ('team_1' | 'team_2' | 'both')
  //   3. Default: both teams side-by-side
  const teamIdRaw = trigger?.payload?.team_id
  const triggerOnlyTeam =
    teamIdRaw === '1' || teamIdRaw === 1
      ? data.team_1
      : teamIdRaw === '2' || teamIdRaw === 2
        ? data.team_2
        : null
  const configOnlyTeam =
    config.selected_team === 'team_1'
      ? data.team_1
      : config.selected_team === 'team_2'
        ? data.team_2
        : null
  const onlyTeam = triggerOnlyTeam ?? configOnlyTeam

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
        className="flex items-stretch overflow-hidden shadow-2xl backdrop-blur-md max-w-3xl w-[min(700px,90vw)]"
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
        {onlyTeam ? (
          <TeamColumn team={onlyTeam} side="left" />
        ) : (
          <>
            <TeamColumn team={data.team_1} side="left" />
            <div
              className="w-px"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              aria-hidden="true"
            />
            <TeamColumn team={data.team_2} side="right" />
          </>
        )}
      </div>
    </div>
  )
}

function TeamColumn({
  team,
  side,
}: {
  team: OverlayTeamData
  side: 'left' | 'right'
}) {
  return (
    <div
      className="flex-1 p-6 min-w-0"
      style={{
        borderLeft:
          side === 'left' ? `4px solid ${team.color || 'var(--overlay-accent)'}` : undefined,
        borderRight:
          side === 'right' ? `4px solid ${team.color || 'var(--overlay-accent)'}` : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: team.color || 'var(--overlay-accent)' }}
          aria-hidden="true"
        />
        <div
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: 'var(--overlay-accent)' }}
        >
          {team.short_name || 'Team'}
        </div>
      </div>
      <div className="text-xl font-bold mb-3 truncate">{team.name}</div>
      <ul className="space-y-1.5">
        {team.players.map((p, i) => (
          <li key={`${p.name}-${i}`} className="text-sm opacity-90 truncate">
            {p.name}
          </li>
        ))}
        {team.players.length === 0 && (
          <li className="text-sm opacity-50 italic">No roster</li>
        )}
      </ul>
    </div>
  )
}
