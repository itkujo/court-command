// frontend/src/features/overlay/renderer/elements/scoreboard/BannerScoreboard.tsx
//
// Banner layout — modeled on brandon-relentnet/ncpa-ticker Scoreboard.jsx.
// Anatomy (3-column grid inside a horizontal banner):
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │ Court · Tournament · Venue                           (top strip)   │
//   ├────────┬──────────────────────────────────────────┬────────────────┤
//   │        │ [logo|▍] Team 1 name                     │                │
//   │ TOURN  │           Player 1                       │    Score 1     │
//   │ LOGO   ├──────────────────────────────────────────┤   (dark inset) │
//   │ BADGE  │ [logo|▍] Team 2 name                     │                │
//   │        │           Player 2                       │    Score 2     │
//   ├────────┴──────────────────────────────────────────┴────────────────┤
//   │ Round · Bracket · Match state                      (bottom strip)  │
//   └────────────────────────────────────────────────────────────────────┘
//
// Design decisions preserved across iterations:
//   - The left column is the TOURNAMENT/LEAGUE logo badge. It's baked into
//     the panel (not floating outside) and uses `--overlay-primary` so it
//     matches the header/footer strips visually. Falls back to wordmark
//     text when neither tournament nor league logo is available.
//   - Team logo sits inside each team row, left of the name. When the logo
//     is missing we fall back to the short_name abbreviation in a bordered
//     chip so the column stays balanced.
//   - Score column is a narrow dark inset spanning both rows. Barlow
//     Condensed 800 + tabular-nums locks the column width against digit
//     changes. Pulse on change via 300ms bounce.
//   - Top + bottom context strips use `rgba(0,0,0,0.35)` overlays and the
//     DM Sans body font for a softer contrast against display type.
//   - Fonts injected once per document via a `<link>` in the head. Never
//     cleaned up on unmount (browser caches + next court may need them).

import { useEffect, useRef, useState } from 'react'
import type { OverlayData, ScoreboardPosition } from '../../../types'
import { MATCH_STATUS } from '../../../contract'
import type { ScoreboardLayoutProps } from './types'
import {
  clampOffset,
  clampScale,
  positionClasses,
} from './transforms'

const FONT_LINK_ID = 'cc-banner-scoreboard-fonts'
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap'

const BANNER_FONT_FAMILY =
  '"Barlow Condensed", "Barlow", "DM Sans", system-ui, sans-serif'
const BODY_FONT_FAMILY =
  '"DM Sans", "Barlow Condensed", system-ui, sans-serif'

const BANNER_DEFAULT_POSITION: ScoreboardPosition = 'bottom-center'

interface LogoTransform {
  scale: number
  offsetX: number
  offsetY: number
}

function toLogoTransform(
  scale: number | undefined,
  offsetX: number | undefined,
  offsetY: number | undefined,
): LogoTransform {
  return {
    scale: clampScale(scale),
    offsetX: clampOffset(offsetX),
    offsetY: clampOffset(offsetY),
  }
}

function logoTransformStyle({ scale, offsetX, offsetY }: LogoTransform) {
  const identity = scale === 1 && offsetX === 0 && offsetY === 0
  if (identity) return undefined
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
    transformOrigin: 'center',
  } as const
}

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

  const badgeLogo = data.tournament_logo_url || data.league_logo_url || ''
  const badgeLabel = data.tournament_name || data.league_name || 'Live'

  const tournamentTransform = toLogoTransform(
    config.tournament_logo_scale,
    config.tournament_logo_offset_x,
    config.tournament_logo_offset_y,
  )
  const team1Transform = toLogoTransform(
    config.team_1_logo_scale,
    config.team_1_logo_offset_x,
    config.team_1_logo_offset_y,
  )
  const team2Transform = toLogoTransform(
    config.team_2_logo_scale,
    config.team_2_logo_offset_x,
    config.team_2_logo_offset_y,
  )

  const positionClassName = positionClasses(
    config.position ?? BANNER_DEFAULT_POSITION,
  )

  return (
    <div
      className={`${positionClassName} z-20 shadow-2xl`}
      style={{
        background: 'var(--overlay-primary)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: BANNER_FONT_FAMILY,
        width: 'min(860px, 92vw)',
        boxShadow: isCompleted
          ? '0 0 50px var(--overlay-accent), 0 12px 40px rgba(0,0,0,0.55)'
          : '0 12px 40px rgba(0,0,0,0.55)',
        transition: 'box-shadow 600ms ease',
        // NOTE: intentionally no overflow clip — oversized logos should be
        // allowed to bleed outside the banner rectangle (matches NCPA).
      }}
      data-match-status={data.match_status}
      data-scoreboard-layout="banner"
    >
      {topStripParts.length > 0 && (
        <ContextStrip parts={topStripParts} position="top" />
      )}

      {/* Body: 3-column grid.
          col 1 = tournament badge, col 2 = team rows, col 3 = score inset. */}
      <div className="grid grid-cols-[auto_1fr_auto]">
        {/* Column 1 — tournament/league badge (spans both rows). */}
        <TournamentBadge
          logoUrl={badgeLogo}
          label={badgeLabel}
          transform={tournamentTransform}
        />

        {/* Column 2 — two team rows stacked with a hairline between. */}
        <div className="min-w-0">
          <TeamRow
            name={data.team_1.name}
            shortName={data.team_1.short_name}
            color={data.team_1.color}
            logoUrl={data.team_1.logo_url}
            players={data.team_1.players}
            serving={servingTeam === 1}
            winner={team1Winner}
            logoTransform={team1Transform}
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
            logoUrl={data.team_2.logo_url}
            players={data.team_2.players}
            serving={servingTeam === 2}
            winner={team2Winner}
            logoTransform={team2Transform}
          />
        </div>

        {/* Column 3 — dark score inset spanning both rows. */}
        <div
          className="flex flex-col justify-stretch"
          style={{
            background: 'rgba(0,0,0,0.6)',
            minWidth: '112px',
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
// TournamentBadge — left column. Shows tournament/league logo if available,
// otherwise falls back to a stacked wordmark.
// ---------------------------------------------------------------------------

function TournamentBadge({
  logoUrl,
  label,
  transform,
}: {
  logoUrl: string
  label: string
  transform: LogoTransform
}) {
  const [imgBroken, setImgBroken] = useState(false)
  const showImg = logoUrl && !imgBroken

  // Scale + offset are applied as a CSS transform so the slot footprint is
  // unchanged (banner width + badge column stay stable as the logo grows,
  // shrinks, or drifts outside the rectangle).
  const transformStyle = logoTransformStyle(transform)

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{
        width: '140px',
        minHeight: '112px',
        padding: '12px 16px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
      aria-label={label ? `${label} logo` : undefined}
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt={label || 'Tournament logo'}
          draggable={false}
          onError={() => setImgBroken(true)}
          className="pointer-events-none select-none max-h-20 max-w-full object-contain transition-transform duration-200"
          style={transformStyle}
        />
      ) : (
        <div
          className="transition-transform duration-200"
          style={transformStyle}
        >
          <WordmarkFallback label={label} />
        </div>
      )}
    </div>
  )
}

function WordmarkFallback({ label }: { label: string }) {
  if (!label) {
    return null
  }
  // Pick the first two significant words for a compact wordmark, otherwise
  // just uppercase the full label. This reads cleanly whether the string is
  // "Spring Open 2026" or just "Live".
  const words = label.split(/\s+/).filter(Boolean)
  const top = words.length > 1 ? words.slice(0, -1).join(' ') : words[0] ?? ''
  const bottom = words.length > 1 ? words[words.length - 1] : ''

  return (
    <div
      className="flex flex-col items-center gap-0.5 text-center"
      style={{
        fontFamily: BANNER_FONT_FAMILY,
        fontWeight: 800,
        letterSpacing: '0.06em',
      }}
    >
      <span
        className="uppercase text-sm leading-tight truncate max-w-full"
        style={{ opacity: 0.7 }}
      >
        {top}
      </span>
      {bottom && (
        <span
          className="uppercase text-xl leading-none truncate max-w-full"
          style={{ color: 'var(--overlay-accent)' }}
        >
          {bottom}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TeamRow — team logo (or short-name chip) + name stack + serve dot
// ---------------------------------------------------------------------------

interface TeamRowProps {
  name: string
  shortName: string
  color: string
  logoUrl: string
  players: { name: string }[]
  serving: boolean
  winner: boolean
  logoTransform: LogoTransform
}

function TeamRow({
  name,
  shortName,
  color,
  logoUrl,
  players,
  serving,
  winner,
  logoTransform,
}: TeamRowProps) {
  // Join all roster names with " & " (doubles-friendly). NCPA reference uses
  // the same convention. Filter empties so a missing entry doesn't leave a
  // dangling " & " at either end.
  const rosterLine = players
    .map((p) => p?.name?.trim())
    .filter((n): n is string => Boolean(n))
    .join(' & ')
  const displayName = name || shortName || 'Team'

  return (
    <div className="flex items-stretch">
      {/* Team color accent bar — identical to NCPA reference visual hierarchy */}
      <div
        className="w-1.5 shrink-0"
        style={{ background: color || 'var(--overlay-accent)' }}
        aria-hidden="true"
      />
      {/* Logo slot (or abbreviation chip fallback). Fixed width keeps column
          alignment identical whether the image loads, breaks, or is absent.
          overflow is intentionally *not* hidden — operators can scale the
          logo past the slot and have it bleed visibly. */}
      <div className="relative shrink-0 flex items-center justify-center px-3 py-3">
        <TeamLogoOrChip
          logoUrl={logoUrl}
          shortName={shortName}
          name={name}
          transform={logoTransform}
        />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-3 py-3 pr-4">
        <ServeDot visible={serving} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xl font-bold uppercase leading-none truncate"
              style={{ letterSpacing: '0.02em' }}
            >
              {displayName}
            </span>
            {winner && (
              <span
                className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded shrink-0"
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
          {rosterLine && (
            <div
              className="text-sm opacity-80 truncate mt-0.5"
              style={{ fontFamily: BODY_FONT_FAMILY, fontWeight: 400 }}
            >
              {rosterLine}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Render the team logo if available, else an abbreviation chip built from
 * short_name / first-letter fallback. The outer size is fixed so the layout
 * is identical in all three states (image / chip / broken-image chip).
 */
function TeamLogoOrChip({
  logoUrl,
  shortName,
  name,
  transform,
}: {
  logoUrl: string
  shortName: string
  name: string
  transform: LogoTransform
}) {
  const [imgBroken, setImgBroken] = useState(false)
  const showImg = logoUrl && !imgBroken
  const transformStyle = logoTransformStyle(transform)

  if (showImg) {
    return (
      <img
        src={logoUrl}
        alt={`${name || shortName || 'Team'} logo`}
        draggable={false}
        onError={() => setImgBroken(true)}
        className="pointer-events-none select-none transition-transform duration-200"
        style={{
          width: '48px',
          height: '48px',
          objectFit: 'contain',
          ...transformStyle,
        }}
      />
    )
  }

  return (
    <AbbreviationChip shortName={shortName} name={name} transform={transform} />
  )
}

/** Fixed-size chip showing the short_name or computed initials. */
function AbbreviationChip({
  shortName,
  name,
  transform,
}: {
  shortName: string
  name: string
  transform: LogoTransform
}) {
  const label = shortName?.trim() || initialsFromName(name)
  const transformStyle = logoTransformStyle(transform)
  return (
    <span
      className="flex items-center justify-center text-xs font-bold tracking-wider uppercase transition-transform duration-200"
      style={{
        width: '48px',
        height: '48px',
        border: '2px solid rgba(255,255,255,0.25)',
        borderRadius: 'var(--overlay-radius)',
        background: 'rgba(0,0,0,0.35)',
        color: 'var(--overlay-text)',
        fontFamily: BANNER_FONT_FAMILY,
        ...transformStyle,
      }}
      aria-hidden="true"
    >
      {label || '—'}
    </span>
  )
}

/** Best-effort initials from a full team name. Matches ClassicScoreboard. */
function initialsFromName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 3).toUpperCase()
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
      style={{ minHeight: '58px' }}
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
    paused || games.length > 0 || t1Remaining < 2 || t2Remaining < 2

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
