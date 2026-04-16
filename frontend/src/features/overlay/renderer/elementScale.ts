// frontend/src/features/overlay/renderer/elementScale.ts
//
// Universal per-element size knob. Every element's outer wrapper accepts a
// `transform: scale(N)` from this helper. Slot footprint is not reserved —
// oversized elements bleed outside their anchor box the way NCPA-style
// broadcast overlays do. That's intentional.

import type { ElementConfigBase } from '../types'

export const ELEMENT_SCALE_MIN = 0.25
export const ELEMENT_SCALE_MAX = 3.0
export const ELEMENT_SCALE_STEP = 0.1
export const ELEMENT_SCALE_DEFAULT = 1.0

/** CSS transform-origin value — controls which corner stays pinned when
 *  the element grows/shrinks. Pick the one that matches the element's
 *  positioning anchor (e.g. `top-6 right-6` → `top right`). */
export type ScaleOrigin =
  | 'top left'
  | 'top right'
  | 'top center'
  | 'bottom left'
  | 'bottom right'
  | 'bottom center'
  | 'center'

export function clampElementScale(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ELEMENT_SCALE_DEFAULT
  }
  return Math.max(ELEMENT_SCALE_MIN, Math.min(ELEMENT_SCALE_MAX, value))
}

/** Build a style fragment to merge into the outer wrapper's `style={{}}`.
 *  Returns `undefined` when the scale is the identity so we don't stamp
 *  an inert transform on every element. */
export function elementScaleStyle(
  config: ElementConfigBase,
  origin: ScaleOrigin | string = 'center',
): React.CSSProperties | undefined {
  const scale = clampElementScale(config.element_scale)
  if (scale === ELEMENT_SCALE_DEFAULT) return undefined
  return {
    transform: `scale(${scale})`,
    transformOrigin: origin,
  }
}
