// frontend/src/routes/overlay/court.$slug.tsx
//
// OBS / browser-source overlay renderer.
// Shell-less (no sidebar, no auth) per __root.tsx NO_SHELL_PATTERNS.
// Transparent body so overlay composites cleanly on any background.

import { createFileRoute } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { OverlayRenderer } from '../../features/overlay/OverlayRenderer'

type OverlaySearch = {
  token?: string
  demo?: boolean
}

export const Route = createFileRoute('/overlay/court/$slug')({
  component: OverlayCourtRoute,
  validateSearch: (search: Record<string, unknown>): OverlaySearch => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    demo: search.demo === true || search.demo === 'true' || search.demo === '1',
  }),
})

function OverlayCourtRoute() {
  const { slug } = Route.useParams()
  const { token, demo } = Route.useSearch()
  // On-air surface: stay silent on error so OBS never shows a panel.
  return (
    <ErrorBoundary fallback={null}>
      <OverlayRenderer slug={slug} token={token ?? null} demo={demo ?? false} />
    </ErrorBoundary>
  )
}
