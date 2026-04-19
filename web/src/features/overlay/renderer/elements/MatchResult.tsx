// web/src/features/overlay/renderer/elements/MatchResult.tsx
//
// Center-full "match over" celebration card. Shown when the match
// status flips to completed.
//
// auto_show_delay_seconds: delay before appearing (gives broadcasters
//   time to hold on the final point). Defaults to 0.
// auto_dismiss_seconds: how long before it fades out. Defaults to 30
//   (matches backend default match_result_delay_seconds).
//
// Winner determined by team.game_wins comparison. Ties fall through
// silently (shouldn't happen with CR-8 tie-guard in place, but we
// defense-in-depth).

import { useEffect, useState } from 'react'
import type { ElementPosition, MatchResultConfig, OverlayData, OverlayTrigger } from '../../types'
import { MATCH_STATUS } from '../../contract'
import { clampElementScale } from '../elementScale'
import { FADE_DURATION_MS, fadeStyle } from '../FadeMount'
import { originForPosition, positionClasses } from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'middle-center'

export interface MatchResultProps {
  data: OverlayData
  config: MatchResultConfig
  /** Optional one-shot trigger from the Control Panel Triggers tab. */
  trigger?: OverlayTrigger | null
}

type Phase = 'idle' | 'entering' | 'shown' | 'leaving'

export function MatchResult({ data, config, trigger }: MatchResultProps) {
  const [phase, setPhase] = useState<Phase>('idle')

  const isComplete = data.match_status === MATCH_STATUS.COMPLETED
  // A trigger force-fires the banner regardless of match status so
  // operators can preview / replay the result screen on demand.
  const isActive = trigger != null || (config.visible && isComplete)

  const showDelayMs = Math.max(0, (config.auto_show_delay_seconds ?? 0) * 1000)
  const dismissMs =
    config.auto_dismiss_seconds === undefined
      ? 30_000
      : Math.max(0, config.auto_dismiss_seconds * 1000)

  useEffect(() => {
    if (!isActive) {
      setPhase('idle')
      return
    }
    let raf: number | null = null
    let enterTimer: number | null = null
    let dismissTimer: number | null = null
    let leaveTimer: number | null = null

    enterTimer = window.setTimeout(() => {
      setPhase('entering')
      raf = window.requestAnimationFrame(() => setPhase('shown'))
    }, showDelayMs)

    if (dismissMs > 0) {
      dismissTimer = window.setTimeout(() => {
        setPhase('leaving')
        leaveTimer = window.setTimeout(() => setPhase('idle'), FADE_DURATION_MS)
      }, showDelayMs + dismissMs)
    }

    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
      if (enterTimer !== null) window.clearTimeout(enterTimer)
      if (dismissTimer !== null) window.clearTimeout(dismissTimer)
      if (leaveTimer !== null) window.clearTimeout(leaveTimer)
    }
  }, [isActive, showDelayMs, dismissMs])

  if (phase === 'idle') return null

  const team1Wins = data.team_1.game_wins
  const team2Wins = data.team_2.game_wins
  const winner =
    team1Wins > team2Wins ? data.team_1 : team2Wins > team1Wins ? data.team_2 : null

  if (!winner) return null

  const visible = phase === 'shown'
  const opacity = visible ? 1 : 0
  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)
  const scale = clampElementScale(config.element_scale)

  return (
    <>
      {/* Full-viewport backdrop glow + confetti: always center, not affected by position */}
      <div
        className="absolute inset-0 z-40 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${winner.color || 'var(--overlay-accent)'}22 0%, transparent 60%)`,
            ...fadeStyle(opacity),
          }}
        />
        {visible && <ConfettiField color={winner.color || 'var(--overlay-accent)'} />}
      </div>

      {/* Winner card — positioned via config */}
      <div
        className={`${posClass} z-40 pointer-events-none`}
        aria-live="polite"
      >
      <div
        className="relative px-12 py-10 shadow-2xl backdrop-blur-md text-center max-w-xl"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          borderTop: `6px solid ${winner.color || 'var(--overlay-accent)'}`,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: origin,
          ...fadeStyle(opacity),
          boxShadow: `0 0 80px ${winner.color || 'var(--overlay-accent)'}66, 0 20px 50px rgba(0,0,0,0.5)`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.3em] font-bold mb-3"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Match Complete
        </div>
        <div className="text-4xl font-black leading-tight mb-2 tracking-tight">
          {winner.name}
        </div>
        <div className="text-lg opacity-80 mb-5">
          defeats {winner === data.team_1 ? data.team_2.name : data.team_1.name}
        </div>
        <div className="text-5xl font-black tabular-nums">
          {team1Wins}{' '}
          <span className="opacity-40 text-3xl align-middle">—</span>{' '}
          {team2Wins}
        </div>
      </div>
      </div>
    </>
  )
}

function ConfettiField({ color }: { color: string }) {
  // 24 deterministic dots for a festive but non-distracting celebration.
  const dots = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {dots.map((i) => {
        const left = ((i * 37) % 100)
        const delay = (i % 6) * 0.15
        const duration = 2 + ((i % 5) * 0.3)
        return (
          <span
            key={i}
            className="absolute block w-2 h-3 rounded-sm"
            style={{
              top: '-10px',
              left: `${left}%`,
              background: i % 3 === 0 ? color : 'var(--overlay-accent)',
              opacity: 0.8,
              animation: `overlay-confetti-fall ${duration}s linear ${delay}s infinite`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes overlay-confetti-fall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
