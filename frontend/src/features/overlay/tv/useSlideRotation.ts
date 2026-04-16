// frontend/src/features/overlay/tv/useSlideRotation.ts
//
// Rotates through a list of slides on an interval. Returns the index of the
// currently-active slide plus helpers to pause/advance manually.
//
// Rules:
// - If slides.length is 0 or 1, the rotation does nothing.
// - If paused, no auto advance.
// - Calling next()/prev()/goTo() resets the interval timer so the user gets a
//   full dwell on the slide they jumped to.

import { useEffect, useMemo, useRef, useState } from 'react'

export interface UseSlideRotationOptions {
  /** Total number of slides (length of the list you're cycling). */
  count: number
  /** Dwell time in milliseconds per slide. Default 20_000 (20s). */
  intervalMs?: number
  /** Pause auto-rotation (user still can call next()/prev()). */
  paused?: boolean
  /** Optional start index (default 0). */
  startIndex?: number
}

export interface SlideRotation {
  index: number
  count: number
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  /** Resets the internal timer without changing the index. */
  reset: () => void
}

export function useSlideRotation({
  count,
  intervalMs = 20_000,
  paused = false,
  startIndex = 0,
}: UseSlideRotationOptions): SlideRotation {
  const safeCount = Math.max(0, Math.floor(count))
  const safeInterval = Math.max(1_000, intervalMs)
  const [index, setIndex] = useState(() => clampIndex(startIndex, safeCount))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the index valid as count changes.
  useEffect(() => {
    if (safeCount === 0) {
      setIndex(0)
      return
    }
    setIndex((prev) => {
      if (prev >= safeCount) return 0
      if (prev < 0) return 0
      return prev
    })
  }, [safeCount])

  function clearTimer() {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function scheduleNext() {
    clearTimer()
    if (paused || safeCount <= 1) return
    timerRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % safeCount)
    }, safeInterval)
  }

  // Re-arm timer whenever index, count, interval, or pause state changes.
  useEffect(() => {
    scheduleNext()
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, safeCount, safeInterval, paused])

  const api = useMemo<SlideRotation>(() => {
    return {
      index,
      count: safeCount,
      next: () =>
        setIndex((prev) => (safeCount === 0 ? 0 : (prev + 1) % safeCount)),
      prev: () =>
        setIndex((prev) =>
          safeCount === 0 ? 0 : (prev - 1 + safeCount) % safeCount,
        ),
      goTo: (i) => setIndex(clampIndex(i, safeCount)),
      reset: scheduleNext,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, safeCount])

  return api
}

function clampIndex(value: number, count: number): number {
  if (count === 0) return 0
  if (!Number.isFinite(value)) return 0
  const int = Math.floor(value)
  if (int < 0) return 0
  if (int >= count) return count - 1
  return int
}
