// frontend/src/routes/overlay/court.$slug.tsx
//
// OBS / browser-source overlay renderer.
// Shell-less (no sidebar, no auth) per __root.tsx NO_SHELL_PATTERNS.
// Transparent body so overlay composites cleanly on any background.
//
// This is also the PARENT of nested routes (e.g. /settings). When a
// child route is active we must render <Outlet /> instead of the
// fullscreen renderer — otherwise the child page is suppressed and
// the fullscreen overlay leaks into the app shell.

import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { OverlayRenderer } from '../../features/overlay/OverlayRenderer'

type OverlaySearch = {
  token?: string
  demo?: boolean
}

export const Route = createFileRoute('/overlay/court/$slug')({
  component: OverlayCourtRoute,
  validateSearch: (search: Record<string, unknown>): OverlaySearch => {
    const out: OverlaySearch = {}
    if (typeof search.token === 'string' && search.token.length > 0) {
      out.token = search.token
    }
    // Only propagate demo when explicitly truthy — otherwise we'd echo
    // `?demo=false` back into every child URL (including /settings).
    if (
      search.demo === true ||
      search.demo === 'true' ||
      search.demo === '1'
    ) {
      out.demo = true
    }
    return out
  },
})

function OverlayCourtRoute() {
  const { slug } = Route.useParams()
  const { token, demo } = Route.useSearch()
  const { pathname } = useLocation()

  // When a nested child route is active (e.g. /overlay/court/$slug/settings)
  // defer to the child by rendering <Outlet />. Only render the fullscreen
  // OBS renderer at the exact parent path.
  const isExactParent =
    pathname === `/overlay/court/${slug}` ||
    pathname === `/overlay/court/${slug}/`

  if (!isExactParent) {
    return <Outlet />
  }

  // On-air surface: stay silent on error so OBS never shows a panel.
  return (
    <ErrorBoundary fallback={null}>
      <OverlayRenderer slug={slug} token={token ?? null} demo={demo ?? false} />
    </ErrorBoundary>
  )
}
