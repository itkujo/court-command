import { cn } from '../lib/cn'
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabLayoutProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
}

export function TabLayout({ tabs, activeTab, onTabChange, children }: TabLayoutProps) {
  return (
    <div>
      <div className="border-b border-(--color-border) mb-6" role="tablist">
        <div className="flex gap-0 overflow-x-auto -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary) hover:border-(--color-border)',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs',
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-(--color-bg-hover) text-(--color-text-secondary)',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  )
}
