// frontend/src/features/overlay/renderer/elements/SponsorBug.tsx
//
// Top-right sponsor rotator. Cross-fades between logos on a configurable
// cadence (default 8000ms). Logo source priority:
//   1. config.logos (operator-curated list for this court)
//   2. data.sponsor_logos (backend-resolved from tournament/league)
//
// Tier badge is shown under the name when present.

import { useEffect, useRef, useState } from 'react'
import type { OverlayData, SponsorBugConfig, SponsorLogo } from '../../types'

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

  if (!config.visible || logos.length === 0) return null

  const active = logos[activeIndex]
  if (!active) return null

  return (
    <div
      className="absolute top-6 right-6 z-20 flex items-center gap-3 px-4 py-2.5 shadow-xl backdrop-blur-md"
      style={{
        background: 'var(--overlay-primary)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: 'var(--overlay-font-family)',
      }}
      aria-label="Sponsor"
    >
      <span
        className="text-[10px] uppercase tracking-widest font-bold opacity-70"
        style={{ color: 'var(--overlay-accent)' }}
      >
        Sponsor
      </span>
      <SponsorLogoSlot logo={active} key={`${active.name}-${activeIndex}`} />
    </div>
  )
}

function SponsorLogoSlot({ logo }: { logo: SponsorLogo }) {
  return (
    <div
      className="flex items-center gap-2 min-w-0"
      style={{
        animation: 'overlay-sponsor-fade 450ms ease-out both',
      }}
    >
      {logo.logo_url ? (
        <img
          src={logo.logo_url}
          alt={logo.name}
          className="h-8 w-auto object-contain shrink-0"
          style={{ maxWidth: 120 }}
          onError={(e) => {
            // Gracefully hide broken images — don't leak alt-text.
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <span className="text-sm font-bold truncate">{logo.name}</span>
      )}
      {logo.tier && (
        <span
          className="text-[9px] uppercase tracking-widest font-bold opacity-60 shrink-0"
          style={{ color: 'var(--overlay-accent)' }}
        >
          {logo.tier}
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
