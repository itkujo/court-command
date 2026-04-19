// web/src/features/overlay/renderer/FadeMount.tsx
//
// Shared mount/unmount fade helper for every overlay element.
//
// Overlay elements opt into the fade by:
//   1. Calling `useFadeMount(config.visible)` to get { mounted, opacity }.
//   2. Returning `null` when `!mounted`.
//   3. Spreading `...fadeStyle(opacity)` onto their outermost positioned
//      wrapper's inline style so the opacity animates through the CSS
//      transition.
//
// Why a hook + style helper instead of a wrapper component: every
// element already owns its own position/transform wrapper and we don't
// want a second DOM layer sandwiched between the element and the
// positioning classes. Keeping it as a hook lets each element pass its
// own `style={{ ... }}` through without an extra containing block.
//
// Duration is hardcoded at 300ms per user request m1093 (broadcast
// standard). Not configurable per-element.

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

export const FADE_DURATION_MS = 300

export interface FadeMountResult {
  /** True while the element should render its DOM tree. */
  mounted: boolean
  /** 0 during mount-in / fade-out, 1 when fully visible. */
  opacity: number
}

/**
 * Mount/unmount coordinator for fade-in/out on `visible` toggle.
 *
 * - When visible flips true, mounts immediately with opacity 0, then
 *   pumps opacity to 1 on the next animation frame so the CSS
 *   transition has a starting keyframe.
 * - When visible flips false, drops opacity to 0 and holds the mount
 *   for FADE_DURATION_MS before unmounting.
 * - Cancels pending work on rapid toggling so the operator can flip
 *   visibility quickly without flicker.
 */
export function useFadeMount(visible: boolean): FadeMountResult {
  const [mounted, setMounted] = useState(visible)
  const [opacity, setOpacity] = useState(visible ? 1 : 0)
  const hideTimerRef = useRef<number | null>(null)
  const showRafARef = useRef<number | null>(null)
  const showRafBRef = useRef<number | null>(null)

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (showRafARef.current) {
      window.cancelAnimationFrame(showRafARef.current)
      showRafARef.current = null
    }
    if (showRafBRef.current) {
      window.cancelAnimationFrame(showRafBRef.current)
      showRafBRef.current = null
    }

    if (visible) {
      setMounted(true)
      setOpacity(0)
      // Double-RAF so the browser commits the opacity:0 style before we
      // target opacity:1. Single RAF sometimes coalesces on iOS.
      showRafARef.current = window.requestAnimationFrame(() => {
        showRafBRef.current = window.requestAnimationFrame(() => {
          setOpacity(1)
          showRafARef.current = null
          showRafBRef.current = null
        })
      })
      return
    }

    setOpacity(0)
    hideTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      hideTimerRef.current = null
    }, FADE_DURATION_MS)
  }, [visible])

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      if (showRafARef.current)
        window.cancelAnimationFrame(showRafARef.current)
      if (showRafBRef.current)
        window.cancelAnimationFrame(showRafBRef.current)
    },
    [],
  )

  return { mounted, opacity }
}

/**
 * Inline style fragment for the outermost positioned wrapper of an
 * overlay element. Applies opacity + CSS transition. Spread before any
 * element-specific style properties so the caller can still override
 * the transition with a more specific value (e.g. to chain a transform
 * transition alongside opacity).
 */
export function fadeStyle(opacity: number): CSSProperties {
  return {
    opacity,
    transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
  }
}
