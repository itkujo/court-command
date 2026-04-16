// frontend/src/features/overlay/renderer/elements/scoreboard/BannerScoreboard.tsx
//
// Banner layout: wide horizontal broadcast-style scoreboard modeled on
// classic college-sports tickers (e.g. NCPA Ticker). The anatomy is:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Court · Tournament · Venue                       (top strip) │
//   ├───────────────────────────────────┬──────────────────────────┤
//   │ ▍ Team 1 name                     │                          │
//   │   Player 1 name                   │        [ Score 1 ]       │
//   ├───────────────────────────────────┤        ( dark inset )    │
//   │ ▍ Team 2 name                     │        [ Score 2 ]       │
//   │   Player 2 name                   │                          │
//   ├───────────────────────────────────┴──────────────────────────┤
//   │ Round · Bracket · Match state              (bottom strip)    │
//   └──────────────────────────────────────────────────────────────┘
//
// Design decisions worth preserving across future iterations:
//   - Body background uses `--overlay-primary` (themeable) — no pure
//     black. Score inset is `rgba(0,0,0,0.6)` on top of that so team
//     color can bleed through if a theme chooses a translucent primary.
//   - Serve indicator is a small filled dot inside the team's row,
//     left-adjacent to the name. More compact than the classic triangle
//     and reads clearly at banner scale.
//   - Typography: Barlow Condensed (display + score) and DM Sans (body)
//     loaded once per mount via a `<link>` injected at document head.
//     Scoped in the sense that the preload cost only happens on the
//     routes that render this layout.
//   - Score numerals use Barlow Condensed 800 + tabular-nums so the
//     column doesn't shift when values change.
//   - Pause / winner / completed states reuse the classic accent
//     vocabulary so theme changes flow through uniformly.

import { useEffect, useRef, useState } from 'react'
import type { OverlayData } from '../../../types'
import { MATCH_STATUS } from '../../../contract'
import type { ScoreboardLayoutProps } from './types'

const FONT_LINK_ID = 'cc-banner-scoreboard-fonts'
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap'

const BANNER_FONT_FAMILY =
  '"Barlow Condensed", "Barlow", "DM Sans", system-ui, sans-serif'
const BODY_FONT_FAMILY =
  '"DM Sans", "Barlow Condensed", system-ui, sans-serif'

export function BannerScoreboard({ data, config }: ScoreboardLayoutProps) {
  // Load Google Fonts once per document.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(FONT_LINK_ID)) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
    // Do NOT remove on unmount — other scoreboards on the same page /
    // next court may need the same font, and the browser caches the
    // sheet anyway.
  }, [])

  if (!config.visible) return null

  const servingTeam =
    data.serving_team === 1 || data.serving_team === 2 ? data.serving_team : 0
  const isCompleted = data.match_status === MATCH_STATUS.COMPLETED
  const isPaused = data.is_paused

  const topStripParts = [
    data.court_name,
    data.tournament_name,
    data.league_name,
  ].filter(Boolean)
  const bottomStripParts = [
    data.division_name,
    data.round_label,
    data.match_info,
  ].filter(Boolean)

  const team1Winner =
    isCompleted && data.team_1.game_wins > data.team_2.game_wins
  const team2Winner =
    isCompleted && data.team_2.game_wins > data.team_1.game_wins

  return (
    <div
      className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 overflow-hidden shadow-2xl"
      style={{
        background: 'var(--overlay-primary)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: BANNER_FONT_FAMILY,
        width: 'min(880px, 92vw)',
        boxShadow: isCompleted
          ? '0 0 50px var(--overlay-accent), 0 12px 40px rgba(0,0,0,0.55)'
          : '0 12px 40px rgba(0,0,0,0.55)',
        transition: 'box-shadow 600ms ease',
      }}
      data-match-status={data.match_status}
      data-scoreboard-layout="banner"
    >
      {topStripParts.length > 0 && (
        <ContextStrip parts={topStripParts} position="top" />
      )}

      {/* Body: two team rows + score inset column on the right. */}
      <div className="grid grid-cols-[1fr_auto]">
        {/* Teams column — stacked rows with a hairline between. */}
        <div>
          <TeamRow
            name={data.team_1.name}
            shortName={data.team_1.short_name}
            color={data.team_1.color}
            players={data.team_1.players}
            serving={servingTeam === 1}
            winner={team1Winner}
          />
          <div
            className="h-px mx-4"
            style={{ background: 'rgba(255,255,255,0.14)' }}
            aria-hidden="true"
          />
          <TeamRow
            name={data.team_2.name}
            shortName={data.team_2.short_name}
            color={data.team_2.color}
            players={data.team_2.players}
            serving={servingTeam === 2}
            winner={team2Winner}
          />
        </div>

        {/* Score inset — single dark column spanning both rows. */}
        <div
          className="flex flex-col justify-stretch"
          style={{
            background: 'rgba(0,0,0,0.6)',
            minWidth: '108px',
          }}
        >
          <ScoreCell value={data.team_1.score} highlight={team1Winner} />
          <div
            className="h-px mx-3"
            style={{ background: 'rgba(255,255,255,0.14)' }}
            aria-hidden="true"
          />
          <ScoreCell value={data.team_2.score} highlight={team2Winner} />
        </div>
      </div>

      {(bottomStripParts.length > 0 ||
        isPaused ||
        data.completed_games.length > 0 ||
        data.timeouts_remaining_1 < 2 ||
        data.timeouts_remaining_2 < 2) && (
        <BottomStrip
          parts={bottomStripParts}
          paused={isPaused}
          games={data.completed_games}
          t1Remaining={data.timeouts_remaining_1}
          t2Remaining={data.timeouts_remaining_2}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TeamRow — color bar + name stack + serve dot
// ---------------------------------------------------------------------------

interface TeamRowProps {
  name: string
  shortName: string
  color: string
  players: { name: string }[]
  serving: boolean
  winner: boolean
}

function TeamRow({
  name,
  shortName,
  color,
  players,
  serving,
  winner,
}: TeamRowProps) {
  const player = players[0]?.name
  const displayName = name || shortName || 'Team'

  return (
    <div className="flex items-stretch">
      <div
        className="w-1.5 shrink-0"
        style={{ background: color || 'var(--overlay-accent)' }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3">
        <ServeDot visible={serving} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xl font-bold uppercase leading-none truncate"
              style={{
                letterSpacing: '0.02em',
              }}
            >
              {displayName}
            </span>
            {shortName && shortName !== displayName && (
              <span
                className="text-xs font-semibold uppercase tracking-widest opacity-70"
                style={{ fontFamily: BODY_FONT_FAMILY }}
              >
                {shortName}
              </span>
            )}
            {winner && (
              <span
                className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--overlay-accent)',
                  color: 'var(--overlay-primary)',
                  fontFamily: BODY_FONT_FAMILY,
                }}
              >
                Winner
              </span>
            )}
          </div>
          {player && (
            <div
              className="text-sm opacity-80 truncate mt-0.5"
              style={{ fontFamily: BODY_FONT_FAMILY, fontWeight: 400 }}
            >
              {player}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ServeDot({ visible }: { visible: boolean }) {
  return (
    <span
      aria-label={visible ? 'Serving' : undefined}
      className="inline-block shrink-0 transition-all duration-200"
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: visible ? 'var(--overlay-accent)' : 'transparent',
        boxShadow: visible ? '0 0 8px var(--overlay-accent)' : 'none',
        opacity: visible ? 1 : 0,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// ScoreCell — dark inset column, pulse on change
// ---------------------------------------------------------------------------

function ScoreCell({ value, highlight }: { value: number; highlight: boolean }) {
  const [pulse, setPulse] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 300)
      prevRef.current = value
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <div
      className="flex-1 flex items-center justify-center px-5"
      style={{
        minHeight: '58px',
      }}
    >
      <span
        className="tabular-nums leading-none"
        style={{
          fontFamily: BANNER_FONT_FAMILY,
          fontWeight: 800,
          fontSize: '3rem',
          color: highlight
            ? 'var(--overlay-accent)'
            : pulse
            ? 'var(--overlay-accent)'
            : '#ffffff',
          transform: pulse ? 'scale(1.1)' : 'scale(1)',
          transition:
            'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), color 300ms ease',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContextStrip — top metadata strip (court / tournament / venue)
// ---------------------------------------------------------------------------

function ContextStrip({
  parts,
  position,
}: {
  parts: string[]
  position: 'top' | 'bottom'
}) {
  return (
    <div
      className="px-4 py-1.5 text-[11px] uppercase font-semibold truncate"
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: 'var(--overlay-text)',
        opacity: 0.85,
        letterSpacing: '0.12em',
        fontFamily: BODY_FONT_FAMILY,
        borderBottom:
          position === 'top' ? '1px solid rgba(255,255,255,0.08)' : 'none',
        borderTop:
          position === 'bottom' ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      {parts.join(' · ')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BottomStrip — context text + live match-state indicators on the right
// ---------------------------------------------------------------------------

interface BottomStripProps {
  parts: string[]
  paused: boolean
  games: OverlayData['completed_games']
  t1Remaining: number
  t2Remaining: number
}

function BottomStrip({
  parts,
  paused,
  games,
  t1Remaining,
  t2Remaining,
}: BottomStripProps) {
  const showExtras =
    paused ||
    games.length > 0 ||
    t1Remaining < 2 ||
    t2Remaining < 2

  return (
    <div
      className="flex items-center gap-3 px-4 py-1.5 text-[11px] uppercase font-semibold"
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: 'var(--overlay-text)',
        opacity: 0.9,
        letterSpacing: '0.12em',
        fontFamily: BODY_FONT_FAMILY,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="flex-1 min-w-0 truncate">{parts.join(' · ')}</span>
      {showExtras && (
        <span className="flex items-center gap-3 shrink-0">
          {games.length > 0 && <GameHistoryDots games={games} />}
          {(t1Remaining < 2 || t2Remaining < 2) && (
            <>
              <TimeoutPips remaining={t1Remaining} label="T1" />
              <TimeoutPips remaining={t2Remaining} label="T2" />
            </>
          )}
          {paused && (
            <span
              className="uppercase tracking-widest px-2 py-0.5 rounded font-bold"
              style={{
                background: 'var(--overlay-accent)',
                color: 'var(--overlay-primary)',
                fontSize: '10px',
              }}
            >
              Paused
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function GameHistoryDots({ games }: { games: OverlayData['completed_games'] }) {
  return (
    <span className="flex items-center gap-1.5">
      {games.map((g) => (
        <span
          key={g.game_num}
          title={`Game ${g.game_num}: ${g.score_team_1}-${g.score_team_2}`}
          className="block w-2 h-2 rounded-full"
          style={{
            background:
              g.winner === 1
                ? 'var(--overlay-accent)'
                : 'rgba(255,255,255,0.35)',
          }}
        />
      ))}
    </span>
  )
}

function TimeoutPips({
  remaining,
  label,
}: {
  remaining: number
  label: string
}) {
  const shown = Math.max(0, Math.min(2, remaining))
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${label} timeouts: ${remaining}`}
    >
      <span className="text-[9px] uppercase tracking-wider opacity-60 font-semibold">
        {label}
      </span>
      <span className="inline-flex gap-0.5">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="inline-block w-1 h-2.5 rounded-sm"
            style={{
              background:
                i < shown
                  ? 'var(--overlay-accent)'
                  : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </span>
    </span>
  )
}
