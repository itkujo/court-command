import { memo } from 'react'
import { cn } from '../lib/cn'

interface SkeletonProps { className?: string }

export const Skeleton = memo(function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-lg bg-(--color-bg-hover)', className)} aria-hidden="true" />
})

export const SkeletonRow = memo(function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4" role="status" aria-busy="true">
      <span className="sr-only">Loading...</span>
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
})

export const SkeletonTable = memo(function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1" role="status" aria-busy="true">
      <span className="sr-only">Loading...</span>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
})
