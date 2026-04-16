// frontend/src/features/overlay/ThemeProvider.tsx
//
// Applies an overlay theme's CSS custom properties to a scoped
// wrapper so overlay elements can read them without leaking into
// the surrounding app shell (critical for the Phase 4C control-
// panel preview pane, which renders the overlay inside the
// authenticated app chrome).
//
// CSS custom properties written (mirrors backend/overlay/themes.go
// ThemeDefaults JSON fields):
//   --overlay-primary
//   --overlay-secondary
//   --overlay-accent
//   --overlay-bg
//   --overlay-text
//   --overlay-font-family
//   --overlay-radius
//   --overlay-animation-style   (informational; consumed via hook)
//
// Consumers may override any of the first 8 by passing a
// ColorOverrides object; unset keys fall back to the theme default.
// The OBS chroma-key workflow relies on setting --overlay-bg to
// `transparent` (the "minimal" theme does this by default).
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTheme } from './hooks'
import type { ColorOverrides, Theme } from './types'

export interface ResolvedOverlayTheme extends Theme {
  /** Effective values after merging Theme.defaults + ColorOverrides. */
  resolved: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    font_family: string
    border_radius: string
    animation_style: string
  }
}

const OverlayThemeContext = createContext<ResolvedOverlayTheme | null>(null)

/**
 * Falls back to a baked-in classic palette so the overlay never
 * renders unstyled while the theme query is in flight.
 */
const FALLBACK_THEME: Theme = {
  id: 'classic',
  name: 'Classic',
  description: 'Traditional broadcast look with clean lines and solid backgrounds',
  defaults: {
    primary: '#1e3a5f',
    secondary: '#ffffff',
    accent: '#e63946',
    background: '#0a0a0a',
    text: '#ffffff',
    font_family: "'Inter', sans-serif",
    border_radius: '4px',
    animation_style: 'slide',
  },
}

interface OverlayThemeProviderProps {
  /** Theme ID from CourtOverlayConfig.theme_id. Null → fallback. */
  themeId: string | null | undefined
  /** Per-court palette overrides from CourtOverlayConfig.color_overrides. */
  overrides?: ColorOverrides | null
  /**
   * Render the wrapper with `position: fixed; inset: 0`. Default true —
   * suitable for the OBS full-viewport renderer. Set to false when
   * embedding inside the control-panel preview pane, which positions
   * the wrapper itself.
   */
  fullscreen?: boolean
  /** Additional wrapper className. */
  className?: string
  children: ReactNode
}

/**
 * Provides overlay CSS custom properties to its subtree.
 *
 * Placed as high as possible in the overlay route tree so every
 * element component (scoreboard, lower-third, bug, etc.) can read
 * the tokens via `var(--overlay-primary)` etc.
 */
export function OverlayThemeProvider({
  themeId,
  overrides,
  fullscreen = true,
  className,
  children,
}: OverlayThemeProviderProps) {
  const themeQuery = useTheme(themeId || 'classic')
  const theme = themeQuery.data ?? FALLBACK_THEME

  const resolved = useMemo<ResolvedOverlayTheme>(() => {
    const d = theme.defaults
    return {
      ...theme,
      resolved: {
        primary: overrides?.primary ?? d.primary,
        secondary: overrides?.secondary ?? d.secondary,
        accent: overrides?.accent ?? d.accent,
        background: overrides?.background ?? d.background,
        text: overrides?.text ?? d.text,
        font_family: overrides?.font_family ?? d.font_family,
        border_radius: overrides?.border_radius ?? d.border_radius,
        animation_style: overrides?.animation_style ?? d.animation_style,
      },
    }
  }, [theme, overrides])

  const style: CSSProperties = useMemo(() => {
    const r = resolved.resolved
    return {
      // Token scope — consumed by element components.
      ['--overlay-primary' as string]: r.primary,
      ['--overlay-secondary' as string]: r.secondary,
      ['--overlay-accent' as string]: r.accent,
      ['--overlay-bg' as string]: r.background,
      ['--overlay-text' as string]: r.text,
      ['--overlay-font-family' as string]: r.font_family,
      ['--overlay-radius' as string]: r.border_radius,
      ['--overlay-animation-style' as string]: r.animation_style,
      // Apply font + text on the wrapper itself so bare text inherits it.
      fontFamily: r.font_family,
      color: r.text,
      // Overlays MUST always composite over transparent for OBS chroma
      // keying. The theme's `background` value is still exposed as
      // `var(--overlay-bg)` so individual elements (card surfaces,
      // bugs) can opt into painting a colored backdrop where it makes
      // design sense, but the wrapper never paints one itself.
      backgroundColor: 'transparent',
      // When fullscreen, fill the OBS Browser Source viewport.
      ...(fullscreen
        ? {
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
          }
        : { position: 'relative', width: '100%', height: '100%' }),
    }
  }, [resolved, fullscreen])

  return (
    <OverlayThemeContext.Provider value={resolved}>
      <div
        className={className}
        style={style}
        data-overlay-theme={resolved.id}
        data-overlay-animation={resolved.resolved.animation_style}
      >
        {children}
      </div>
    </OverlayThemeContext.Provider>
  )
}

/**
 * Access the resolved theme from inside an OverlayThemeProvider.
 * Throws if used outside one — caught at dev time, not production.
 */
export function useOverlayTheme(): ResolvedOverlayTheme {
  const ctx = useContext(OverlayThemeContext)
  if (!ctx) {
    throw new Error(
      'useOverlayTheme must be used within an <OverlayThemeProvider>',
    )
  }
  return ctx
}

/**
 * Hook variant that returns null when outside a provider, for
 * components that render both inside and outside the overlay (e.g.
 * shared element components reused on TV/Kiosk displays).
 */
export function useOverlayThemeOptional(): ResolvedOverlayTheme | null {
  return useContext(OverlayThemeContext)
}
