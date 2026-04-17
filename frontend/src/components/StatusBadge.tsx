import { memo } from 'react'
import { Badge } from './Badge'

type EntityType = 'tournament' | 'division' | 'league' | 'season' | 'registration' | 'venue'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  // Tournament / Division / League / Season
  draft: 'default',
  published: 'info',
  registration_open: 'success',
  registration_closed: 'warning',
  in_progress: 'success',
  completed: 'default',
  archived: 'default',
  cancelled: 'error',
  active: 'success',
  seeding: 'info',
  // Registration
  pending: 'warning',
  approved: 'success',
  waitlisted: 'info',
  rejected: 'error',
  withdrawn: 'default',
  checked_in: 'success',
  no_show: 'error',
  withdrawn_mid_tournament: 'warning',
  // Venue
  pending_review: 'warning',
  // Generic
  suspended: 'error',
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface StatusBadgeProps {
  status: string
  type?: EntityType
  className?: string
}

export const StatusBadge = memo(function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] || 'default'
  return (
    <Badge variant={variant} className={className}>
      {formatStatus(status)}
    </Badge>
  )
})
