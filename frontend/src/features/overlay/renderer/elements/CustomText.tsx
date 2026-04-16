// frontend/src/features/overlay/renderer/elements/CustomText.tsx
//
// Free-form operator-driven banner. Positioned via the universal
// 9-anchor position knob. Falls back to the legacy `zone` field if
// present so stored configs don't jump anchor on upgrade.
//
// Styling knobs:
//   - font_family: web-safe font stack (CustomTextFont)
//   - font_color: CSS color for text
//   - background_color: CSS color for chip surface
//   - transparent_background: when true, drop chip + padding
//
// Trigger payload (from Triggers tab) still takes precedence over
// config for one-shot pushes.

import { useEffect, useState } from 'react'
import type { CustomTextConfig, ElementPosition, OverlayTrigger } from '../../types'
import { clampElementScale } from '../elementScale'
import { originForPosition, positionClasses } from './scoreboard/transforms'

export interface CustomTextProps {
  config: CustomTextConfig
  /** Optional one-shot trigger from the Control Panel Triggers tab. */
  trigger?: OverlayTrigger | null
}

const DEFAULT_POSITION: ElementPosition = 'middle-center'

export function CustomText({ config, trigger }: CustomTextProps) {
  const [shown, setShown] = useState(false)

  // Trigger payload takes precedence over config when present.
  const payloadText = typeof trigger?.payload?.text === 'string' ? trigger.payload.text : null
  const payloadPosition =
    typeof trigger?.payload?.position === 'string'
      ? (trigger.payload.position as string)
      : null
  const payloadZone =
    typeof trigger?.payload?.zone === 'string' ? (trigger.payload.zone as string) : null
  const rawText = payloadText ?? config.text ?? ''
  const text = rawText.trim()
  const effectiveVisible = trigger != null || config.visible

  useEffect(() => {
    if (!effectiveVisible || !text) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 16)
    return () => clearTimeout(t)
  }, [effectiveVisible, text])

  if (!effectiveVisible || !text) return null

  // Position resolution priority: trigger payload → config.position → legacy zone → default.
  const effectivePosition = resolvePosition(
    payloadPosition ?? config.position ?? null,
    payloadZone ?? config.zone ?? null,
  )
  const origin = originForPosition(effectivePosition)
  const posClass = positionClasses(effectivePosition)

  const transparent = config.transparent_background ?? false
  const fontFamily = resolveFontFamily(config.font_family)
  const fontColor = config.font_color || 'var(--overlay-text)'
  const backgroundColor = config.background_color || 'var(--overlay-primary)'

  const chipClasses = transparent
    ? 'text-center max-w-[min(640px,80vw)]'
    : 'px-6 py-3 shadow-2xl backdrop-blur-md text-center max-w-[min(640px,80vw)]'

  const chipStyle: React.CSSProperties = {
    color: fontColor,
    fontFamily,
    opacity: shown ? 1 : 0,
    transform: `translateY(${shown ? 0 : 8}px) scale(${clampElementScale(config.element_scale)})`,
    transformOrigin: origin,
    transition: 'opacity 300ms ease, transform 300ms ease',
    ...(transparent
      ? {}
      : {
          background: backgroundColor,
          borderRadius: 'var(--overlay-radius)',
        }),
  }

  return (
    <div
      className={`${posClass} z-30 pointer-events-none`}
      aria-live="polite"
    >
      <div
        className={chipClasses}
        style={chipStyle}
        data-customtext-transparent={transparent ? 'true' : undefined}
      >
        <div className="text-base font-semibold leading-snug">{text}</div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ALLOWED_POSITIONS: ElementPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

/** Legacy zone → position migration. Keeps stored configs visually stable. */
function zoneToPosition(zone: string | null): ElementPosition | null {
  if (!zone) return null
  switch (zone) {
    case 'top':
      return 'top-center'
    case 'bottom':
      return 'bottom-center'
    case 'center':
      return 'middle-center'
    case 'top-left':
      return 'top-left'
    case 'top-right':
      return 'top-right'
    case 'bottom-left':
      return 'bottom-left'
    case 'bottom-right':
      return 'bottom-right'
    default:
      return null
  }
}

function resolvePosition(
  position: string | null,
  legacyZone: string | null,
): ElementPosition {
  if (position && ALLOWED_POSITIONS.includes(position as ElementPosition)) {
    return position as ElementPosition
  }
  const migrated = zoneToPosition(legacyZone)
  if (migrated) return migrated
  return DEFAULT_POSITION
}

/** Normalizes the font_family knob into a live CSS font-family string. */
function resolveFontFamily(value: string | undefined): string {
  if (!value || value === 'system') return 'var(--overlay-font-family)'
  return value
}
