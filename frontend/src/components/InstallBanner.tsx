import { Download, X } from 'lucide-react'
import type { InstallPromptState } from '../hooks/useInstallPrompt'

interface InstallBannerProps {
  install: InstallPromptState
}

export function InstallBanner({ install }: InstallBannerProps) {
  if (!install.canInstall) return null

  return (
    <div
      role="complementary"
      aria-label="Install application"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border border-(--color-border) bg-(--color-bg-primary) p-4 shadow-lg sm:left-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-(--color-accent)" />
        <div className="flex-1">
          <p className="text-sm font-medium text-(--color-text-primary)">
            Install Court Command
          </p>
          <p className="mt-1 text-xs text-(--color-text-secondary)">
            Add to your home screen for faster access and offline support.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install.promptInstall}
              className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Install
            </button>
            <button
              onClick={install.dismissInstall}
              className="rounded-md border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:bg-(--color-bg-secondary)"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={install.dismissInstall}
          className="shrink-0 text-(--color-text-secondary) hover:text-(--color-text-primary)"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
