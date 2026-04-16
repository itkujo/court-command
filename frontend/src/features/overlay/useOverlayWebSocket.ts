// frontend/src/features/overlay/useOverlayWebSocket.ts
//
// Live overlay subscription. Multiplexes up to three WebSocket
// channels (overlay, court, optional match) into a single React hook
// and merges incoming events into the TanStack Query cache so any
// renderer using `useOverlayData` / `useOverlayConfig` picks up
// updates automatically.
//
// Channels served by backend/ws/handler.go:
//   /ws/overlay/{courtID}  — config_update, overlay_data
//   /ws/court/{courtID}    — court state + match_update on that court
//   /ws/match/{publicID}   — per-match scoring events (optional)
//
// Wire envelope matches backend/pubsub/pubsub.go Message:
//   { type: string, channel: string, data: unknown }
//
// Reconnect strategy mirrors Phase 3's useMatchWebSocket: exponential
// backoff 1s → 30s, cleared on successful open, suppressed on unmount.
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { Match } from '../scoring/types'
import type { CourtOverlayConfig, OverlayData } from './types'

export type OverlayWSState = 'connecting' | 'open' | 'disconnected'

interface OverlayWSMessage {
  type: string
  channel?: string
  data: unknown
}

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000]

function wsBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base = (import.meta.env.VITE_WS_URL as string | undefined) || ''
  if (base) return base.replace(/\/$/, '')
  return `${proto}//${window.location.host}`
}

interface OverlaySocketSpec {
  /** Short label for diagnostics, e.g. "overlay", "court", "match". */
  label: string
  url: string
}

interface UseOverlayWebSocketOptions {
  /** Disable all sockets (useful for preview panes). */
  enabled?: boolean
  /** Optional match public ID to subscribe to per-match scoring events. */
  matchPublicID?: string | null
  /** Called for every parsed message; passive — cache merging happens first. */
  onMessage?: (msg: OverlayWSMessage) => void
}

export interface UseOverlayWebSocketResult {
  /** Aggregate state: 'open' if all channels open, else worst state. */
  state: OverlayWSState
  /** Reconnect attempts since the last aggregate open. */
  attempt: number
  /** Wall-clock ms of the last message received on any channel. */
  lastMessageAt: number | null
}

/**
 * Subscribes to overlay + court (+ optional match) channels and merges
 * incoming events into the query cache so `useOverlayData` and
 * `useOverlayConfig` transparently reflect live state.
 */
export function useOverlayWebSocket(
  courtID: number | null | undefined,
  opts: UseOverlayWebSocketOptions = {},
): UseOverlayWebSocketResult {
  const qc = useQueryClient()
  const { enabled = true, matchPublicID = null, onMessage } = opts

  const [state, setState] = useState<OverlayWSState>('connecting')
  const [attempt, setAttempt] = useState(0)
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null)

  const stateRef = useRef<Record<string, OverlayWSState>>({})
  const socketsRef = useRef<Record<string, WebSocket>>({})
  const attemptsRef = useRef<Record<string, number>>({})
  const timersRef = useRef<Record<string, number>>({})
  const closedByUnmountRef = useRef(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!enabled || courtID == null || courtID <= 0) {
      setState('disconnected')
      return
    }
    closedByUnmountRef.current = false

    const specs: OverlaySocketSpec[] = [
      { label: 'overlay', url: `${wsBaseUrl()}/ws/overlay/${courtID}` },
      { label: 'court', url: `${wsBaseUrl()}/ws/court/${courtID}` },
    ]
    if (matchPublicID) {
      specs.push({
        label: 'match',
        url: `${wsBaseUrl()}/ws/match/${matchPublicID}`,
      })
    }

    const computeAggregate = () => {
      const labels = specs.map((s) => s.label)
      const states = labels.map((l) => stateRef.current[l] ?? 'connecting')
      let next: OverlayWSState = 'open'
      if (states.some((s) => s === 'disconnected')) next = 'disconnected'
      else if (states.some((s) => s === 'connecting')) next = 'connecting'
      setState(next)
      const maxAttempts = Math.max(
        ...labels.map((l) => attemptsRef.current[l] ?? 0),
        0,
      )
      setAttempt(maxAttempts)
    }

    const connect = (spec: OverlaySocketSpec) => {
      stateRef.current[spec.label] = 'connecting'
      computeAggregate()

      const ws = new WebSocket(spec.url)
      socketsRef.current[spec.label] = ws

      ws.onopen = () => {
        attemptsRef.current[spec.label] = 0
        stateRef.current[spec.label] = 'open'
        computeAggregate()
        // Re-fetch on reconnect so the consumer catches missed events.
        if (spec.label === 'overlay') {
          qc.invalidateQueries({ queryKey: ['overlay', 'config', courtID] })
          qc.invalidateQueries({ queryKey: ['overlay', 'data', courtID] })
        }
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as OverlayWSMessage
          applyMessage(qc, courtID, msg)
          setLastMessageAt(Date.now())
          onMessageRef.current?.(msg)
        } catch {
          // Ignore malformed
        }
      }

      ws.onerror = () => {
        // onclose will follow
      }

      ws.onclose = () => {
        delete socketsRef.current[spec.label]
        if (closedByUnmountRef.current) return
        stateRef.current[spec.label] = 'disconnected'
        computeAggregate()
        const current = attemptsRef.current[spec.label] ?? 0
        const idx = Math.min(current, BACKOFF_STEPS_MS.length - 1)
        const delay = BACKOFF_STEPS_MS[idx]
        attemptsRef.current[spec.label] = current + 1
        timersRef.current[spec.label] = window.setTimeout(
          () => connect(spec),
          delay,
        )
      }
    }

    specs.forEach(connect)

    return () => {
      closedByUnmountRef.current = true
      Object.values(timersRef.current).forEach((t) => window.clearTimeout(t))
      timersRef.current = {}
      Object.values(socketsRef.current).forEach((ws) => ws.close())
      socketsRef.current = {}
    }
  }, [courtID, enabled, matchPublicID, qc])

  return { state, attempt, lastMessageAt }
}

/**
 * Routes a parsed message to the right cache entry based on type.
 * Unknown message types are ignored; this keeps the hook forward-
 * compatible with new event types the backend may add later.
 */
function applyMessage(
  qc: QueryClient,
  courtID: number,
  msg: OverlayWSMessage,
): void {
  switch (msg.type) {
    case 'overlay_data': {
      qc.setQueryData<OverlayData>(
        ['overlay', 'data', courtID, null, false],
        msg.data as OverlayData,
      )
      // Also mirror into any token-scoped caches.
      qc.invalidateQueries({ queryKey: ['overlay', 'data', courtID] })
      break
    }
    case 'config_update': {
      qc.setQueryData<CourtOverlayConfig>(
        ['overlay', 'config', courtID],
        msg.data as CourtOverlayConfig,
      )
      // The config change may alter source profile → refetch live data.
      qc.invalidateQueries({ queryKey: ['overlay', 'data', courtID] })
      break
    }
    case 'match_update': {
      const match = msg.data as Match
      if (match?.public_id) {
        qc.setQueryData(['matches', match.public_id], match)
        qc.invalidateQueries({
          queryKey: ['match-events', match.public_id],
        })
      }
      // An active-match score change also invalidates the overlay
      // data query: the backend recomputes OverlayData from the match
      // and republishes on the overlay channel, but we preemptively
      // refresh in case the channel drops a message.
      qc.invalidateQueries({ queryKey: ['overlay', 'data', courtID] })
      break
    }
    default:
      // match_complete, match_started, etc. — no targeted merge.
      // The overlay channel will also republish overlay_data.
      break
  }
}
