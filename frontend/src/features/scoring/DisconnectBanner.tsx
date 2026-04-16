// frontend/src/features/scoring/DisconnectBanner.tsx
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import type { WebSocketState } from './useMatchWebSocket'

export interface DisconnectBannerProps {
  state: WebSocketState
  /** Reconnect attempt counter. Shown after the first retry. */
  attempt?: number
}

/**
 * Sticky full-width banner.
 * - state='disconnected': red, "Connection lost — reconnecting…"
 * - state='connecting' (initial only): no banner (avoids flicker)
 * - on transition disconnected → open: green "Reconnected" flash for 2s
 * - state='open' (steady): no banner
 */
export function DisconnectBanner({ state, attempt = 0 }: DisconnectBannerProps) {
  const [showReconnectedFlash, setShowReconnectedFlash] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    if (state === 'disconnected') {
      setWasDisconnected(true)
    }
    if (state === 'open' && wasDisconnected) {
      setShowReconnectedFlash(true)
      const timer = window.setTimeout(() => {
        setShowReconnectedFlash(false)
        setWasDisconnected(false)
      }, 2000)
      return () => window.clearTimeout(timer)
    }
  }, [state, wasDisconnected])

  if (state === 'disconnected') {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="sticky top-0 z-40 bg-(--color-error) text-white px-4 py-2 flex items-center gap-2 text-sm font-medium"
      >
        <WifiOff size={16} />
        <span>
          Connection lost — reconnecting
          {attempt > 1 ? ` (attempt ${attempt})` : '…'}
        </span>
      </div>
    )
  }

  if (showReconnectedFlash) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-40 bg-(--color-success) text-white px-4 py-2 flex items-center gap-2 text-sm font-medium"
      >
        <Wifi size={16} />
        <span>Reconnected</span>
      </div>
    )
  }

  return null
}
