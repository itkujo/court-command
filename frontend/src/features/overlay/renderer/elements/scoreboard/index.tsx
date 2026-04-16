// frontend/src/features/overlay/renderer/elements/scoreboard/index.tsx
//
// Scoreboard dispatcher: picks a concrete layout based on
// `config.layout` and delegates to it. Falls back to `classic` when
// the field is missing or unknown so existing configs keep working.
//
// To add a new layout:
//   1. Create a new `<LayoutName>Scoreboard.tsx` file in this dir.
//   2. Implement `ScoreboardLayoutProps` from ./types.
//   3. Add the identifier to `ScoreboardLayout` union in
//      features/overlay/types.ts.
//   4. Add a case in the switch below.
//   5. Add a human-readable label in SCOREBOARD_LAYOUT_OPTIONS.
//
// The barrel export (renderer/elements/index.ts) imports `Scoreboard`
// from this file, so call sites in OverlayRenderer / OverlayDemo do
// not change when layouts are added.

import type { ScoreboardLayout } from '../../../types'
import { ClassicScoreboard } from './ClassicScoreboard'
import { BannerScoreboard } from './BannerScoreboard'
import type { ScoreboardLayoutProps } from './types'

/** Options for the Elements-tab layout dropdown. Order = UI order. */
export const SCOREBOARD_LAYOUT_OPTIONS: ReadonlyArray<{
  value: ScoreboardLayout
  label: string
  description: string
}> = [
  {
    value: 'classic',
    label: 'Classic',
    description:
      'Bottom-left stacked card with team rows, game history, and timeouts.',
  },
  {
    value: 'banner',
    label: 'Banner',
    description:
      'Wide bottom-center broadcast banner with top + bottom context strips and a dark score inset.',
  },
] as const

export function Scoreboard({ data, config }: ScoreboardLayoutProps) {
  const layout: ScoreboardLayout = config.layout ?? 'classic'

  switch (layout) {
    case 'banner':
      return <BannerScoreboard data={data} config={config} />
    case 'classic':
    default:
      return <ClassicScoreboard data={data} config={config} />
  }
}
