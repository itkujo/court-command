import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  )
}
