import { Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../hooks/useTheme'
import { getPresetGroups } from '../lib/themes'
import { cn } from '../lib/cn'

interface ThemeToggleProps { collapsed?: boolean }

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { mode, setMode, presetId, setPreset } = useTheme()
  const [showPresets, setShowPresets] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor
  const label = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'

  useEffect(() => {
    if (!showPresets) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPresets(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPresets])

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setMode(next)}
        className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary)', collapsed && 'justify-center px-2')}
        aria-label={`Theme: ${label}. Click for ${next}`}
        title={`Theme: ${label}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary) w-full', collapsed && 'justify-center px-2')}
          aria-label="Color preset"
          title="Color preset"
        >
          <Palette className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="truncate">{presetId === 'default' ? 'Colors' : getPresetGroups().flatMap(g => g.presets).find(p => p.id === presetId)?.name ?? 'Colors'}</span>}
        </button>

        {showPresets && (
          <div className="absolute bottom-full left-0 mb-1 w-56 max-h-80 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-bg-primary) shadow-lg z-50">
            {getPresetGroups().map(({ group, presets }) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide">
                  {group}
                </div>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => { setPreset(preset.id); setShowPresets(false) }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-(--color-bg-hover)',
                      preset.id === presetId && 'bg-(--color-bg-hover) text-(--color-text-accent) font-medium'
                    )}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0 border border-(--color-border)"
                      style={{ backgroundColor: preset.dark['--color-text-accent'] }}
                    />
                    {preset.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
