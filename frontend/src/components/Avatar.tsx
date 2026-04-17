import { memo } from 'react'
import { cn } from '../lib/cn'
import { getInitials } from '../lib/formatters'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export const Avatar = memo(function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} loading="lazy" decoding="async" />
    )
  }
  return (
    <div className={cn('rounded-full flex items-center justify-center font-medium bg-cyan-500/20 text-cyan-400', sizes[size], className)} role="img" aria-label={name}>
      {getInitials(name)}
    </div>
  )
})
