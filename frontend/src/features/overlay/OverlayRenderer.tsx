// frontend/src/features/overlay/OverlayRenderer.tsx
//
// Root renderer for the broadcast overlay. Composes the 12 canonical
// element components inside an OverlayThemeProvider. Each element is
// independently toggled via CourtOverlayConfig.elements[key].visible.
//
// Rendering contract:
//   1. Route reachable at /overlay/court/$slug
//   2. OverlayThemeProvider applies --overlay-* CSS custom properties
//   3. useOverlayDataBySlug resolves slug -> courtID -> OverlayData
//   4. useOverlayWebSocket multiplexes overlay + court + match channels
//   5. <body> is transparent so OBS / TV backgrounds render below us
//   6. All element components return null when config.visible===false
//      so on-air state is silent-by-default.

import { useEffect, useMemo } from 'react'
import { OverlayThemeProvider } from './ThemeProvider'
import { OverlayWatermark } from './OverlayWatermark'
import { getIsLicensed } from './licensing'
import { useOverlayConfig, useOverlayDataBySlug } from './hooks'
import { useOverlayWebSocket } from './useOverlayWebSocket'
import { useTriggerQueue } from './useTriggerQueue'
import type { OverlayTrigger, TriggerKind } from './types'
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

export interface OverlayRendererProps {
  /** Court slug from the URL (e.g. "center-court") */
  slug: string
  /** Optional overlay access token for public/token-gated mode */
  token?: string | null
  /** Force demo data (bypasses live match data path) */
  demo?: boolean
  /** Render inside a constrained preview pane instead of fullscreen */
  fullscreen?: boolean
}

export function OverlayRenderer({
  slug,
  token = null,
  demo = false,
  fullscreen = true,
}: OverlayRendererProps) {
  // Body transparency: OBS and TV backgrounds render behind us.
  // Only applied when fullscreen; preview-pane embeds should NOT
  // mutate global body styles.
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

  const { courtID, courtsQuery, overlayQuery } = useOverlayDataBySlug(slug, {
    token,
    demo,
  })
  const configQuery = useOverlayConfig(courtID)

  // Subscribe to overlay + court WS channels for live updates.
  // Match-specific subscription is opportunistic: some future phases
  // may wire match.public_id out of OverlayData, but for the stub we
  // only need config + data channels.
  useOverlayWebSocket(courtID, {
    enabled: courtID !== null,
  })

  // Early return states — we deliberately render NOTHING on errors so
  // OBS scenes don't flash error UI to viewers. A minimal "resolving"
  // state is acceptable because operators expect brief startup delay.
  if (courtsQuery.isLoading) {
    return null
  }
  if (courtsQuery.isError || courtID === null) {
    // Court not found or list query failed. Silent on-air.
    return null
  }
  if (overlayQuery.isLoading || configQuery.isLoading) {
    return null
  }
  if (overlayQuery.isError || !overlayQuery.data) {
    return null
  }

  const config = configQuery.data
  if (!config) return null
  const data = overlayQuery.data
  const elements = config.elements
  const isLicensed = getIsLicensed(config)

  return (
    <OverlayThemeProvider
      themeId={config.theme_id ?? null}
      overrides={config.color_overrides ?? null}
      fullscreen={fullscreen}
    >
      <RenderedOverlay
        courtID={courtID}
        data={data}
        elements={elements}
      />
      {!isLicensed && <OverlayWatermark />}
    </OverlayThemeProvider>
  )
}

/**
 * Inner body, split out so we can run useTriggerQueue only once the
 * courtID is resolved. Kept in the same file because it shares the
 * same rendering contract and saves a round-trip through an extra
 * module boundary.
 */
function RenderedOverlay({
  courtID,
  data,
  elements,
}: {
  courtID: number
  data: NonNullable<ReturnType<typeof useOverlayDataBySlug>['overlayQuery']['data']>
  elements: NonNullable<ReturnType<typeof useOverlayConfig>['data']>['elements']
}) {
  const queue = useTriggerQueue(courtID)

  // Pick the newest trigger of each kind (triggers arrive head-first).
  const triggerByKind = useMemo(() => {
    const pick = (kind: TriggerKind): OverlayTrigger | null =>
      queue.triggers.find((t) => t.kind === kind) ?? null
    return {
      player_card: pick('player_card'),
      team_card: pick('team_card'),
      match_result: pick('match_result'),
      custom_text: pick('custom_text'),
    }
  }, [queue.triggers])

  return (
    <>
      {/* Fixed positioning elements (corners + banners) */}
      <Scoreboard data={data} config={elements.scoreboard} />
      <LowerThird data={data} config={elements.lower_third} />
      <SponsorBug data={data} config={elements.sponsor_bug} />
      <TournamentBug data={data} config={elements.tournament_bug} />
      <ComingUpNext data={data} config={elements.coming_up_next} />
      <SeriesScore data={data} config={elements.series_score} />

      {/* Card-family (center-bottom overlays) — trigger-driven */}
      <PlayerCard
        data={data}
        config={elements.player_card}
        trigger={triggerByKind.player_card}
      />
      <TeamCard
        data={data}
        config={elements.team_card}
        trigger={triggerByKind.team_card}
      />

      {/* Full-center narrative elements */}
      <BracketSnapshot data={data} config={elements.bracket_snapshot} />
      <PoolStandings data={data} config={elements.pool_standings} />
      <MatchResult
        data={data}
        config={elements.match_result}
        trigger={triggerByKind.match_result}
      />

      {/* Operator free-form — trigger-driven */}
      <CustomText config={elements.custom_text} trigger={triggerByKind.custom_text} />
    </>
  )
}
