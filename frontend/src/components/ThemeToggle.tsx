import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { cn } from '../lib/cn'

interface ThemeToggleProps { collapsed?: boolean }

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { mode, setMode } = useTheme()
  const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor
  const label = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'

  return (
    <button
      onClick={() => setMode(next)}
      className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary)', collapsed && 'justify-center px-2')}
      aria-label={`Theme: ${label}. Click for ${next}`}
      title={`Theme: ${label}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
