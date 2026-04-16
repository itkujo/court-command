// frontend/src/features/overlay/renderer/elements/scoreboard/transforms.ts
//
// Shared scoreboard transform helpers. Scale, offset, and position clamps
// live here so ClassicScoreboard + BannerScoreboard + ElementsTab knobs all
// agree on the same ranges. Keeping the ranges in one place also means the
// UI sliders and the renderer never drift apart.

import type { ScoreboardPosition } from '../../../types'

/** Scale slider hard clamp. */
export const SCALE_MIN = 0.5
export const SCALE_MAX = 5.0
export const SCALE_DEFAULT = 1.0
export const SCALE_STEP = 0.1

/** Per-logo translate slider hard clamp (pixels). */
export const OFFSET_MIN = -120
export const OFFSET_MAX = 120
export const OFFSET_DEFAULT = 0
export const OFFSET_STEP = 4

/** Clamp a raw scale number into the allowed slider range. */
export function clampScale(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return SCALE_DEFAULT
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, value))
}

/** Clamp a raw px offset into the allowed slider range. */
export function clampOffset(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return OFFSET_DEFAULT
  return Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, value))
}

/**
 * Absolute-position classes for each anchor. The 1920×1080 canvas is
 * relative-positioned, so these render exactly where you'd expect.
 * Bottom-center keeps the historic banner placement.
 */
export function positionClasses(position: ScoreboardPosition): string {
  switch (position) {
    case 'top-left':
      return 'absolute top-8 left-8'
    case 'top-right':
      return 'absolute top-8 right-8'
    case 'bottom-left':
      return 'absolute bottom-8 left-8'
    case 'bottom-right':
      return 'absolute bottom-8 right-8'
    case 'bottom-center':
    default:
      return 'absolute bottom-8 left-1/2 -translate-x-1/2'
  }
}

export const POSITION_OPTIONS: { value: ScoreboardPosition; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
]
