import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export interface InstallPromptState {
  canInstall: boolean
  isInstalled: boolean
  promptInstall: () => void
  dismissInstall: () => void
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('cc_install_dismissed') === 'true'
  })
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setIsInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const promptInstall = useCallback(() => {
    if (!deferredPrompt) return
    deferredPrompt.prompt().then((result) => {
      if (result.outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    })
  }, [deferredPrompt])

  const dismissInstall = useCallback(() => {
    setDismissed(true)
    sessionStorage.setItem('cc_install_dismissed', 'true')
  }, [])

  return {
    canInstall: !!deferredPrompt && !dismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismissInstall,
  }
}
