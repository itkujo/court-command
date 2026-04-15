import { Button } from './Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'

interface PaginationProps { page: number; totalPages: number; onPageChange: (page: number) => void; className?: string }

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <p className="text-sm text-(--color-text-secondary)">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
