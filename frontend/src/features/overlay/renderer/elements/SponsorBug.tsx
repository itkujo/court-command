// frontend/src/features/overlay/renderer/elements/SponsorBug.tsx
//
// Top-right sponsor rotator. Cross-fades between logos on a configurable
// cadence (default 8000ms). Logo source priority:
//   1. config.logos (operator-curated list for this court)
//   2. data.sponsor_logos (backend-resolved from tournament/league)
//
// Broadcast convention: logo only, no "Sponsor" label, no tier badge.
// Each rotation fills the chip so the logo reads at distance.

import { useEffect, useRef, useState } from 'react'
import type { ElementPosition, OverlayData, SponsorBugConfig, SponsorLogo } from '../../types'
import { elementScaleStyle } from '../elementScale'
import { fadeStyle, useFadeMount } from '../FadeMount'
import {
  originForPosition,
  positionClasses,
} from './scoreboard/transforms'

const DEFAULT_POSITION: ElementPosition = 'top-right'

export interface SponsorBugProps {
  data: OverlayData
  config: SponsorBugConfig
}

export function SponsorBug({ data, config }: SponsorBugProps) {
  const logos: SponsorLogo[] =
    config.logos && config.logos.length > 0
      ? config.logos
      : data.sponsor_logos ?? []

  const [activeIndex, setActiveIndex] = useState(0)
  const timerRef = useRef<number | null>(null)

  const rotationSeconds = config.rotation_seconds ?? 8
  const rotationMs = Math.max(1000, rotationSeconds * 1000)
  const { mounted, opacity } = useFadeMount(Boolean(config.visible))

  useEffect(() => {
    if (!config.visible || logos.length < 2) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % logos.length)
    }, rotationMs)
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [config.visible, logos.length, rotationMs])

  // Clamp active index if list shrinks while visible.
  useEffect(() => {
    if (activeIndex >= logos.length && logos.length > 0) {
      setActiveIndex(0)
    }
  }, [activeIndex, logos.length])

  if (!mounted) return null

  // No logos to rotate. On-air we stay silent (never show an empty
  // sponsor chip on broadcast). In the control-panel preview we
  // surface a dashed placeholder so operators can see the element is
  // enabled and know where to drop a logo.
  if (logos.length === 0) return <SponsorBugPlaceholder config={config} opacity={opacity} />

  const active = logos[activeIndex]
  if (!active) return null

  const transparent = config.transparent_background ?? false
  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)
  // When transparent: drop the chip surface entirely so transparent PNG
  // source art composites directly onto the broadcast background. Padding
  // and shadow come off so the logo reads exactly as authored.
  const chipClasses = transparent
    ? `${posClass} z-20 flex items-center justify-center`
    : `${posClass} z-20 flex items-center justify-center px-3 py-2 shadow-xl backdrop-blur-md`
  const chipStyle: React.CSSProperties = transparent
    ? { ...fadeStyle(opacity), ...elementScaleStyle(config, origin) }
    : {
        background: 'var(--overlay-primary)',
        borderRadius: 'var(--overlay-radius)',
        ...fadeStyle(opacity),
        ...elementScaleStyle(config, origin),
      }

  return (
    <div
      className={chipClasses}
      style={chipStyle}
      aria-label={active.name || 'Sponsor'}
      data-sponsor-transparent={transparent ? 'true' : undefined}
    >
      <SponsorLogoSlot logo={active} key={`${active.name}-${activeIndex}`} />
    </div>
  )
}

function SponsorLogoSlot({ logo }: { logo: SponsorLogo }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        animation: 'overlay-sponsor-fade 450ms ease-out both',
      }}
    >
      {logo.logo_url ? (
        <img
          src={logo.logo_url}
          alt={logo.name || ''}
          className="h-14 w-auto object-contain"
          style={{ maxWidth: 220 }}
          onError={(e) => {
            // Gracefully hide broken images — don't leak alt-text.
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <span
          className="text-base font-bold tracking-wide"
          style={{
            color: 'var(--overlay-text)',
            fontFamily: 'var(--overlay-font-family)',
          }}
        >
          {logo.name}
        </span>
      )}
      <style>{`
        @keyframes overlay-sponsor-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Preview-only placeholder. Renders a dashed "Add sponsor logos" chip in the
// top-right so operators can see the sponsor bug is enabled while sponsor
// data is still empty. Invisible on real OBS output.
// -----------------------------------------------------------------------------

function SponsorBugPlaceholder({
  config,
  opacity,
}: {
  config: SponsorBugConfig
  opacity: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Walk up to find a PreviewPane container. Only render inside it.
    setVisible(!!el.closest('[data-overlay-preview="true"]'))
  }, [])

  const effectivePosition = config.position ?? DEFAULT_POSITION
  const origin = originForPosition(effectivePosition)

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`${positionClasses(effectivePosition)} z-20 flex items-center gap-3 px-4 py-2.5 border-2 border-dashed text-xs uppercase tracking-widest font-bold`}
      style={{
        borderColor: 'var(--overlay-accent)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: 'var(--overlay-font-family)',
        // Placeholder is capped at 0.6 (translucent) AND gated by preview-only
        // visibility AND respects the fade opacity. Multiply them together.
        opacity: (visible ? 0.6 : 0) * opacity,
        transition: `opacity 300ms ease-in-out`,
        pointerEvents: 'none',
        ...elementScaleStyle(config, origin),
      }}
    >
      <span style={{ color: 'var(--overlay-accent)' }}>Sponsor</span>
      <span className="opacity-70">— add logos</span>
    </div>
  )
}
