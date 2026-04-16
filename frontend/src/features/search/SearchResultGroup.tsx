import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export interface SearchResultItem {
  id: number
  label: string
  subtitle?: string
  link: string
}

interface SearchResultGroupProps {
  title: string
  icon: ReactNode
  items: SearchResultItem[]
  onNavigate: () => void
}

export function SearchResultGroup({ title, icon, items, onNavigate }: SearchResultGroupProps) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-(--color-text-secondary)">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)">
          {title}
        </h3>
      </div>
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item.id}`}>
            <Link
              to={item.link as string}
              onClick={onNavigate}
              className="flex flex-col px-3 py-2 rounded-lg hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-(--color-text-primary)">
                {item.label}
              </span>
              {item.subtitle && (
                <span className="text-xs text-(--color-text-secondary)">
                  {item.subtitle}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
