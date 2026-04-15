import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const styles = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-cyan-500/30 bg-cyan-500/10',
}
const iconColors = { success: 'text-green-500', error: 'text-red-500', warning: 'text-amber-500', info: 'text-cyan-500' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)) }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} role="alert" className={cn('flex items-start gap-3 rounded-lg border p-4 shadow-lg bg-(--color-bg-primary)', styles[t.type])}>
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColors[t.type])} />
              <p className="text-sm text-(--color-text-primary) flex-1">{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="text-(--color-text-secondary) hover:text-(--color-text-primary) shrink-0" aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
