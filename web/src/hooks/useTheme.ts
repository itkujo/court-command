import { useCallback, useEffect, useState } from 'react'
import { applyPresetColors, clearPresetColors, getPresetById } from '../lib/themes'

type ThemeMode = 'system' | 'light' | 'dark'

const MODE_KEY = 'cc_theme'
const PRESET_KEY = 'cc_theme_preset'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolveMode(mode) === 'dark')
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(MODE_KEY) as ThemeMode) || 'system'
  })

  const [presetId, setPresetIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default'
    return localStorage.getItem(PRESET_KEY) || 'default'
  })

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(MODE_KEY, newMode)
    applyMode(newMode)
    // Re-apply preset colors for the new resolved mode
    const preset = getPresetById(presetId)
    if (preset && preset.id !== 'default') {
      applyPresetColors(preset, resolveMode(newMode))
    }
  }, [presetId])

  const setPreset = useCallback((id: string) => {
    setPresetIdState(id)
    localStorage.setItem(PRESET_KEY, id)
    const preset = getPresetById(id)
    if (preset && preset.id !== 'default') {
      applyPresetColors(preset, resolveMode(mode))
    } else {
      clearPresetColors()
    }
  }, [mode])

  useEffect(() => {
    applyMode(mode)

    // Apply preset colors on mount
    const preset = getPresetById(presetId)
    if (preset && preset.id !== 'default') {
      applyPresetColors(preset, resolveMode(mode))
    }

    if (mode === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        applyMode('system')
        const p = getPresetById(presetId)
        if (p && p.id !== 'default') {
          applyPresetColors(p, getSystemTheme())
        }
      }
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
  }, [mode, presetId])

  const resolvedTheme = resolveMode(mode)

  return { mode, setMode, resolvedTheme, presetId, setPreset }
}
