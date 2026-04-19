// web/src/routes/overlay/demo.$themeId.tsx
//
// Public theme-preview route. No auth, no court, no WS — driven by
// GET /api/v1/overlay/demo-data. Route pattern
// /^\/overlay\/demo\/[^/]+$/ is already in __root.tsx NO_SHELL_PATTERNS
// so the sidebar and auth chrome are suppressed.
import { createFileRoute } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { OverlayDemo } from '../../features/overlay/OverlayDemo'

export const Route = createFileRoute('/overlay/demo/$themeId')({
  component: OverlayDemoRoute,
})

function OverlayDemoRoute() {
  const { themeId } = Route.useParams()
  // On-air preview: stay silent on error — preview pages live inside
  // control panels, tablets, and signage; a raw error panel would leak
  // into broadcast.
  return (
    <ErrorBoundary fallback={null}>
      <OverlayDemo themeId={themeId} />
    </ErrorBoundary>
  )
}
