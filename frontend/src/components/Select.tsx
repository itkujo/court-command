import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm transition-colors appearance-none',
          'bg-(--color-bg-input) text-(--color-text-primary)',
          'focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-(--color-border)',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
