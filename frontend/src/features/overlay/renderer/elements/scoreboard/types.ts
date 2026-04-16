// frontend/src/features/overlay/renderer/elements/scoreboard/types.ts
//
// Shared layout contract. Every scoreboard layout implements this
// interface so the dispatcher (./index.tsx) can swap layouts at runtime
// without any call-site churn in OverlayRenderer.
//
// Layouts are pure presentational — they receive OverlayData +
// ScoreboardConfig, read theme tokens via CSS custom properties, and
// render nothing when config.visible === false. Any animation or
// state (score pulse, font link injection) is the layout's own
// concern.

import type { OverlayData, ScoreboardConfig } from '../../../types'

export interface ScoreboardLayoutProps {
  data: OverlayData
  config: ScoreboardConfig
}
