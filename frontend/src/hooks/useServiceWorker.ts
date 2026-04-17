import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export interface ServiceWorkerState {
  needRefresh: boolean
  updateServiceWorker: () => void
  dismissUpdate: () => void
}

export function useServiceWorker(): ServiceWorkerState {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        // Check for updates every 60 minutes
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false)
  }, [setNeedRefresh])

  return {
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
    dismissUpdate,
  }
}
