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
import type { OverlayData, SponsorBugConfig, SponsorLogo } from '../../types'
import { elementScaleStyle } from '../elementScale'

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

  if (!config.visible) return null

  // No logos to rotate. On-air we stay silent (never show an empty
  // sponsor chip on broadcast). In the control-panel preview we
  // surface a dashed placeholder so operators can see the element is
  // enabled and know where to drop a logo.
  if (logos.length === 0) return <SponsorBugPlaceholder config={config} />

  const active = logos[activeIndex]
  if (!active) return null

  return (
    <div
      className="absolute top-6 right-6 z-20 flex items-center justify-center px-3 py-2 shadow-xl backdrop-blur-md"
      style={{
        background: 'var(--overlay-primary)',
        borderRadius: 'var(--overlay-radius)',
        ...elementScaleStyle(config, 'top right'),
      }}
      aria-label={active.name || 'Sponsor'}
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

function SponsorBugPlaceholder({ config }: { config: SponsorBugConfig }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Walk up to find a PreviewPane container. Only render inside it.
    setVisible(!!el.closest('[data-overlay-preview="true"]'))
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute top-6 right-6 z-20 flex items-center gap-3 px-4 py-2.5 border-2 border-dashed text-xs uppercase tracking-widest font-bold"
      style={{
        borderColor: 'var(--overlay-accent)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: 'var(--overlay-font-family)',
        opacity: visible ? 0.6 : 0,
        pointerEvents: 'none',
        ...elementScaleStyle(config, 'top right'),
      }}
    >
      <span style={{ color: 'var(--overlay-accent)' }}>Sponsor</span>
      <span className="opacity-70">— add logos</span>
    </div>
  )
}
