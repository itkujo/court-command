import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm transition-colors min-h-[80px] resize-y',
          'bg-(--color-bg-input) text-(--color-text-primary) placeholder:text-(--color-text-secondary)',
          'focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-(--color-border)',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
