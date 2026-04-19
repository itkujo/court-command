import { RefreshCw, X } from 'lucide-react'
import type { ServiceWorkerState } from '../hooks/useServiceWorker'

interface UpdatePromptProps {
  sw: ServiceWorkerState
}

export function UpdatePrompt({ sw }: UpdatePromptProps) {
  if (!sw.needRefresh) return null

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border border-(--color-border) bg-(--color-bg-primary) p-4 shadow-lg sm:left-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-(--color-accent)" />
        <div className="flex-1">
          <p className="text-sm font-medium text-(--color-text-primary)">
            Update available
          </p>
          <p className="mt-1 text-xs text-(--color-text-secondary)">
            A new version of Court Command is ready.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={sw.updateServiceWorker}
              className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Update now
            </button>
            <button
              onClick={sw.dismissUpdate}
              className="rounded-md border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:bg-(--color-bg-secondary)"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={sw.dismissUpdate}
          className="shrink-0 text-(--color-text-secondary) hover:text-(--color-text-primary)"
          aria-label="Dismiss update notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
