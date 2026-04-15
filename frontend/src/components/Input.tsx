import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
          'bg-(--color-bg-input) text-(--color-text-primary) placeholder:text-(--color-text-secondary)',
          'focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500 focus:ring-red-400' : 'border-(--color-border)',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
