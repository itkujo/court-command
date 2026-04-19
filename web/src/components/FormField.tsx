import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function FormField({ label, htmlFor, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-(--color-text-primary)">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
    </div>
  )
}
