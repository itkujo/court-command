// frontend/src/features/overlay/OverlayRenderer.tsx
//
// Root renderer for the broadcast overlay. In Phase 4A this is a visual
// stub that proves:
//   1. Route is reachable at /overlay/court/$slug
//   2. OverlayThemeProvider resolves and applies CSS custom properties
//   3. useOverlayDataBySlug resolves slug -> courtID -> OverlayData
//   4. useOverlayWebSocket connects to overlay + court channels
//   5. <body> is transparent so OBS can chroma-key / stack layers
//
// Phase 4B replaces the stub body with the 12 element components.

import { useEffect } from 'react'
import { OverlayThemeProvider } from './ThemeProvider'
import { OverlayWatermark } from './OverlayWatermark'
import { useOverlayConfig, useOverlayDataBySlug } from './hooks'
import { useOverlayWebSocket } from './useOverlayWebSocket'

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

  const config = configQuery.data ?? null
  const data = overlayQuery.data
  const isLicensed = false // TODO Phase 6 — wire from config/tenant

  return (
    <OverlayThemeProvider
      themeId={config?.theme_id ?? null}
      overrides={config?.color_overrides ?? null}
      fullscreen={fullscreen}
    >
      <StubOverlayBody slug={slug} matchStatus={data.match_status} />
      {!isLicensed && <OverlayWatermark />}
    </OverlayThemeProvider>
  )
}

/**
 * Phase 4A visual stub. Confirms theme application end-to-end and
 * gives operators a "connected" signal while 4B builds out real
 * elements. Replaced entirely in 4B.
 */
function StubOverlayBody({
  slug,
  matchStatus,
}: {
  slug: string
  matchStatus: string
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div
        className="rounded-2xl px-8 py-6 max-w-md text-center shadow-2xl backdrop-blur"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
        }}
      >
        <div
          className="text-xs uppercase tracking-widest opacity-70 mb-1"
          style={{ color: 'var(--overlay-accent)' }}
        >
          Overlay Renderer · Phase 4A Stub
        </div>
        <div className="text-2xl font-bold tabular-nums">{slug}</div>
        <div className="mt-2 text-sm opacity-80">status: {matchStatus}</div>
      </div>
    </div>
  )
}
