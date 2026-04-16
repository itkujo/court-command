// frontend/src/features/overlay/OverlayDemo.tsx
//
// Public demo renderer. No auth, no court, no WebSocket — just a
// seeded OverlayData payload (from GET /api/v1/overlay/demo-data)
// composed against a caller-selected theme. Used for:
//   - Landing-page previews
//   - Theme shopping without needing a live court
//   - Sales demos / marketing screenshots
//
// Watermark is ALWAYS visible on the demo surface — this is the
// "free tier" preview and should never look like a licensed overlay.
//
// Route lives at /overlay/demo/$themeId and is in NO_SHELL_PATTERNS.
import { useEffect } from 'react'
import { OverlayThemeProvider } from './ThemeProvider'
import { OverlayWatermark } from './OverlayWatermark'
import { useDemoData } from './hooks'
import type { ElementsConfig } from './types'
import {
  BracketSnapshot,
  ComingUpNext,
  CustomText,
  LowerThird,
  MatchResult,
  PlayerCard,
  PoolStandings,
  Scoreboard,
  SeriesScore,
  SponsorBug,
  TeamCard,
  TournamentBug,
} from './renderer/elements'

export interface OverlayDemoProps {
  /** Theme id to preview. Unknown ids fall back to 'classic' in the provider. */
  themeId: string
  /** Render inside a constrained preview pane instead of fullscreen. */
  fullscreen?: boolean
}

/**
 * Element config for the demo: scoreboard + sponsor + tournament bug +
 * series score + coming-up-next are the always-on "broadcast furniture".
 * Cards and full-screen narrative elements stay hidden — those belong
 * to the operator's trigger queue, which the demo surface doesn't have.
 */
const DEMO_ELEMENTS: ElementsConfig = {
  scoreboard: { visible: true, auto_animate: true },
  lower_third: { visible: false },
  player_card: { visible: false },
  team_card: { visible: false },
  sponsor_bug: { visible: true, rotation_seconds: 8 },
  tournament_bug: { visible: true },
  coming_up_next: { visible: true },
  match_result: { visible: false },
  custom_text: { visible: false },
  bracket_snapshot: { visible: false },
  pool_standings: { visible: false },
  series_score: { visible: true },
}

export function OverlayDemo({ themeId, fullscreen = true }: OverlayDemoProps) {
  const query = useDemoData()

  // Transparent body so the demo composes against whatever background
  // the host page is using (marketing hero, dark shell, etc.).
  useEffect(() => {
    if (!fullscreen) return
    const prevBodyBg = document.body.style.background
    const prevHtmlBg = document.documentElement.style.background
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return () => {
      document.body.style.background = prevBodyBg
      document.documentElement.style.background = prevHtmlBg
    }
  }, [fullscreen])

  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return null
  }
  const data = query.data

  return (
    <OverlayThemeProvider themeId={themeId} overrides={null} fullscreen={fullscreen}>
      {/* Fixed positioning elements (corners + banners) */}
      <Scoreboard data={data} config={DEMO_ELEMENTS.scoreboard} />
      <LowerThird data={data} config={DEMO_ELEMENTS.lower_third} />
      <SponsorBug data={data} config={DEMO_ELEMENTS.sponsor_bug} />
      <TournamentBug data={data} config={DEMO_ELEMENTS.tournament_bug} />
      <ComingUpNext data={data} config={DEMO_ELEMENTS.coming_up_next} />
      <SeriesScore data={data} config={DEMO_ELEMENTS.series_score} />

      {/* Card family — hidden in demo (no trigger queue) */}
      <PlayerCard data={data} config={DEMO_ELEMENTS.player_card} trigger={null} />
      <TeamCard data={data} config={DEMO_ELEMENTS.team_card} trigger={null} />

      {/* Full-center narrative elements — hidden in demo */}
      <BracketSnapshot data={data} config={DEMO_ELEMENTS.bracket_snapshot} />
      <PoolStandings data={data} config={DEMO_ELEMENTS.pool_standings} />
      <MatchResult data={data} config={DEMO_ELEMENTS.match_result} trigger={null} />
      <CustomText config={DEMO_ELEMENTS.custom_text} trigger={null} />

      {/* Watermark is ALWAYS visible on the demo — this is the free-tier preview. */}
      <OverlayWatermark />
    </OverlayThemeProvider>
  )
}
