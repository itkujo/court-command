// web/src/features/scoring/useScoringPrefs.ts
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'cc_scoring_prefs'

export interface ScoringPrefs {
  keyboard: boolean
  haptic: boolean
  sound: boolean
}

const DEFAULT_PREFS: ScoringPrefs = {
  keyboard: true,
  haptic: true,
  sound: true,
}

function readPrefs(): ScoringPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ScoringPrefs>
    return {
      keyboard:
        typeof parsed.keyboard === 'boolean'
          ? parsed.keyboard
          : DEFAULT_PREFS.keyboard,
      haptic:
        typeof parsed.haptic === 'boolean'
          ? parsed.haptic
          : DEFAULT_PREFS.haptic,
      sound:
        typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFS.sound,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: ScoringPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage full / disabled — silently ignore
  }
}

export function useScoringPrefs(): {
  prefs: ScoringPrefs
  setKeyboard: (v: boolean) => void
  setHaptic: (v: boolean) => void
  setSound: (v: boolean) => void
  toggleKeyboard: () => void
  toggleHaptic: () => void
  toggleSound: () => void
} {
  const [prefs, setPrefs] = useState<ScoringPrefs>(readPrefs)

  // React to changes from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(readPrefs())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const update = useCallback((partial: Partial<ScoringPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial }
      writePrefs(next)
      return next
    })
  }, [])

  return {
    prefs,
    setKeyboard: (v) => update({ keyboard: v }),
    setHaptic: (v) => update({ haptic: v }),
    setSound: (v) => update({ sound: v }),
    toggleKeyboard: () => update({ keyboard: !prefs.keyboard }),
    toggleHaptic: () => update({ haptic: !prefs.haptic }),
    toggleSound: () => update({ sound: !prefs.sound }),
  }
}
