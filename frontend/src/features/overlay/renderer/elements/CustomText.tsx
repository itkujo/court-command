// frontend/src/features/overlay/renderer/elements/CustomText.tsx
//
// Free-form operator-driven banner. Position controlled by config.zone.
// Supported zones:
//   'top', 'bottom', 'center', 'top-left', 'top-right',
//   'bottom-left', 'bottom-right'
// Default: 'bottom'.

import { useEffect, useState } from 'react'
import type { CustomTextConfig } from '../../types'

export interface CustomTextProps {
  config: CustomTextConfig
}

type Zone =
  | 'top'
  | 'bottom'
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export function CustomText({ config }: CustomTextProps) {
  const [shown, setShown] = useState(false)
  const text = config.text?.trim() ?? ''

  useEffect(() => {
    if (!config.visible || !text) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 16)
    return () => clearTimeout(t)
  }, [config.visible, text])

  if (!config.visible || !text) return null

  const zone = normalizeZone(config.zone)

  return (
    <div
      className={`absolute z-30 pointer-events-none ${zoneClasses(zone)}`}
      aria-live="polite"
    >
      <div
        className="px-6 py-3 shadow-2xl backdrop-blur-md text-center max-w-[min(640px,80vw)]"
        style={{
          background: 'var(--overlay-primary)',
          color: 'var(--overlay-text)',
          borderRadius: 'var(--overlay-radius)',
          fontFamily: 'var(--overlay-font-family)',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease, transform 300ms ease',
        }}
      >
        <div className="text-base font-semibold leading-snug">{text}</div>
      </div>
    </div>
  )
}

function normalizeZone(zone: string | undefined): Zone {
  const allowed: Zone[] = [
    'top',
    'bottom',
    'center',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]
  return (allowed.includes((zone ?? '') as Zone) ? zone : 'bottom') as Zone
}

function zoneClasses(zone: Zone): string {
  switch (zone) {
    case 'top':
      return 'top-6 left-1/2 -translate-x-1/2'
    case 'bottom':
      return 'bottom-6 left-1/2 -translate-x-1/2'
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
    case 'top-left':
      return 'top-6 left-6'
    case 'top-right':
      return 'top-6 right-6'
    case 'bottom-left':
      return 'bottom-6 left-6'
    case 'bottom-right':
      return 'bottom-6 right-6'
  }
}
