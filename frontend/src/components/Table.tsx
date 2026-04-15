import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  keyExtractor: (row: T) => string | number
  className?: string
}

export function Table<T>({ columns, data, onRowClick, keyExtractor, className }: TableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--color-border)">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-3 text-left font-medium text-(--color-text-secondary)', col.className)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)} className={cn('border-b border-(--color-border) last:border-0', onRowClick && 'cursor-pointer hover:bg-(--color-bg-hover) transition-colors')} onClick={() => onRowClick?.(row)}>
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3', col.className)}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
