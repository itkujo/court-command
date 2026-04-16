// frontend/src/features/overlay/renderer/elements/TournamentBug.tsx
//
// Top-left static badge: tournament or league branding.
// Prefers tournament_logo_url; falls back to league_logo_url.
// If neither logo is available but names are, shows text-only badge.

import type { OverlayData, TournamentBugConfig } from '../../types'

export interface TournamentBugProps {
  data: OverlayData
  config: TournamentBugConfig
}

export function TournamentBug({ data, config }: TournamentBugProps) {
  if (!config.visible) return null

  const logo = data.tournament_logo_url || data.league_logo_url
  const name = data.tournament_name || data.league_name

  if (!logo && !name) return null

  return (
    <div
      className="absolute top-6 left-6 z-20 flex items-center gap-3 px-4 py-2.5 shadow-xl backdrop-blur-md"
      style={{
        background: 'var(--overlay-primary)',
        color: 'var(--overlay-text)',
        borderRadius: 'var(--overlay-radius)',
        fontFamily: 'var(--overlay-font-family)',
      }}
      aria-label={name || 'Tournament'}
    >
      {logo && (
        <img
          src={logo}
          alt={name}
          className="h-8 w-auto object-contain shrink-0"
          style={{ maxWidth: 120 }}
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      {name && (
        <span className="text-sm font-bold tracking-tight truncate max-w-[220px]">
          {name}
        </span>
      )}
    </div>
  )
}
