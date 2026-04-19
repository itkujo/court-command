import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../lib/cn'

interface CardProps { children: ReactNode; className?: string; onClick?: () => void }

export function Card({ children, className, onClick }: CardProps) {
  const handleKeyDown = onClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }
    : undefined

  return (
    <div
      className={cn('rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4', onClick && 'cursor-pointer hover:border-(--color-text-accent) transition-colors', className)}
      onClick={onClick}
      {...(onClick && { role: 'button', tabIndex: 0, onKeyDown: handleKeyDown })}
    >
      {children}
    </div>
  )
}
