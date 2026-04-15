import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) { dialog.showModal() } else { dialog.close() }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => { e.preventDefault(); onClose() }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className={cn('rounded-xl border border-(--color-border) bg-(--color-bg-primary) p-0 shadow-xl backdrop:bg-black/50 max-w-lg w-full', className)}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-(--color-text-secondary) hover:bg-(--color-bg-hover) transition-colors" aria-label="Close dialog">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  )
}
