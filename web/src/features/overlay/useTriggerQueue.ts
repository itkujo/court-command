// web/src/features/overlay/useTriggerQueue.ts
//
// Client-only trigger queue for one-shot overlay events fired from the
// Control Panel (player cards, team intros, match result banners,
// custom text). Triggers don't live on the backend — they're local to
// the operator's session so network failure doesn't lose state, but
// they do survive reload via sessionStorage.
//
// Each trigger has:
//   - id         — stable UUID-ish for list keys + dismissal
//   - kind       — which element it maps to
//   - startedAt  — epoch ms when fired, used for auto-dismiss timing
//   - dismiss    — Manual (no auto-dismiss) or Auto { durationMs }
//   - payload    — kind-specific fields (player id, team id, custom text, ...)
//
// Auto-dismiss is driven by a single setInterval that runs while at
// least one active Auto trigger exists. This avoids spawning one
// timer per trigger and surviving reload means the timer picks up
// wherever it left off (auto-dismiss is computed from startedAt,
// not timer creation).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OverlayTrigger, TriggerDismissMode, TriggerKind } from './types'

const STORAGE_KEY = 'cc:overlay:trigger-queue'
const TICK_MS = 250

export interface TriggerInput {
  kind: TriggerKind
  dismiss: TriggerDismissMode
  payload?: Record<string, unknown>
}

export interface UseTriggerQueueResult {
  /** All active triggers (not yet dismissed). Most recent first. */
  triggers: OverlayTrigger[]
  /** Fire a new trigger. Returns the created trigger. */
  fire: (input: TriggerInput) => OverlayTrigger
  /** Dismiss a trigger by id. */
  dismiss: (id: string) => void
  /** Dismiss all triggers of a given kind (or all if omitted). */
  dismissAll: (kind?: TriggerKind) => void
}

export function useTriggerQueue(courtID: number | null | undefined): UseTriggerQueueResult {
  const storageKey = courtID != null ? `${STORAGE_KEY}:${courtID}` : STORAGE_KEY
  const [triggers, setTriggers] = useState<OverlayTrigger[]>(() => loadTriggers(storageKey))

  // Persist whenever triggers change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(triggers))
    } catch {
      // Quota exceeded or sessionStorage disabled — ignore silently.
    }
  }, [storageKey, triggers])

  // Auto-dismiss sweeper. One interval while any auto trigger exists.
  const needsSweep = useMemo(
    () => triggers.some((t) => t.dismiss.kind === 'auto'),
    [triggers],
  )
  const sweepRef = useRef<number | null>(null)
  useEffect(() => {
    if (!needsSweep) {
      if (sweepRef.current != null) {
        clearInterval(sweepRef.current)
        sweepRef.current = null
      }
      return
    }
    sweepRef.current = window.setInterval(() => {
      setTriggers((prev) => {
        const now = Date.now()
        const next = prev.filter((t) => {
          if (t.dismiss.kind !== 'auto') return true
          return now - t.startedAt < t.dismiss.durationMs
        })
        // Preserve ref equality when nothing expired (cheap no-op render).
        return next.length === prev.length ? prev : next
      })
    }, TICK_MS)
    return () => {
      if (sweepRef.current != null) {
        clearInterval(sweepRef.current)
        sweepRef.current = null
      }
    }
  }, [needsSweep])

  const fire = useCallback<UseTriggerQueueResult['fire']>((input) => {
    const trigger: OverlayTrigger = {
      id: newId(),
      kind: input.kind,
      startedAt: Date.now(),
      dismiss: input.dismiss,
      payload: input.payload,
    }
    setTriggers((prev) => [trigger, ...prev])
    return trigger
  }, [])

  const dismiss = useCallback<UseTriggerQueueResult['dismiss']>((id) => {
    setTriggers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback<UseTriggerQueueResult['dismissAll']>((kind) => {
    setTriggers((prev) => (kind ? prev.filter((t) => t.kind !== kind) : []))
  }, [])

  return { triggers, fire, dismiss, dismissAll }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadTriggers(key: string): OverlayTrigger[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OverlayTrigger[]
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    // Drop anything whose auto-dismiss already elapsed while the page
    // was closed.
    return parsed.filter((t) => {
      if (!t || typeof t !== 'object') return false
      if (t.dismiss?.kind !== 'auto') return true
      return now - t.startedAt < t.dismiss.durationMs
    })
  } catch {
    return []
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
