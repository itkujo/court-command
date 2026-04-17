import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Sidebar } from '../components/Sidebar'
import { AuthGuard } from '../features/auth/AuthGuard'
import { useAuth, useLogout } from '../features/auth/hooks'
import { cn } from '../lib/cn'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useState, useEffect } from 'react'

const NO_SHELL_ROUTES = ['/login', '/register']

// Public routes: do not require auth. If a user is logged in, they get the
// shell; otherwise the page renders without sidebar/header chrome.
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/public(\/|$)/,
  /^\/matches\/[^/]+$/,
  /^\/match-series\/[^/]+$/,
]

// Routes that always render with no shell at all (no sidebar, no auth).
// Used for embed/OBS targets and pre-auth pages.
const NO_SHELL_PATTERNS: RegExp[] = [
  /^\/matches\/[^/]+\/scoreboard$/,
  // Phase 4 broadcast overlay — renders inside OBS browser source
  /^\/overlay\/court\/[^/]+$/,
  /^\/overlay\/demo\/[^/]+$/,
  // Phase 4 TV/Kiosk — fullscreen venue displays
  /^\/tv\/tournaments\/[^/]+$/,
  /^\/tv\/courts\/[^/]+$/,
]

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-(--color-text-primary) mb-2">404</h1>
        <p className="text-(--color-text-secondary)">Page not found</p>
      </div>
    </main>
  ),
})

function RootLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const isNoShell =
    NO_SHELL_ROUTES.includes(pathname) ||
    NO_SHELL_PATTERNS.some((p) => p.test(pathname))
  const isPublic = PUBLIC_ROUTE_PATTERNS.some((p) => p.test(pathname))

  if (isNoShell) {
    return <ErrorBoundary><Outlet /></ErrorBoundary>
  }

  if (isPublic) {
    return <ErrorBoundary><PublicLayout /></ErrorBoundary>
  }

  return <ErrorBoundary><AuthGuard><AuthenticatedLayout /></AuthGuard></ErrorBoundary>
}

function AuthenticatedLayout() {
  const { user } = useAuth()
  const logout = useLogout()
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('cc_sidebar_expanded') === 'true'
  })

  useEffect(() => {
    const handler = () => setExpanded(localStorage.getItem('cc_sidebar_expanded') === 'true')
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!user) return null

  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <Sidebar user={user} onLogout={() => logout.mutate()} />
      <main id="main-content" className={cn('min-h-screen transition-[margin] duration-200 ease-in-out', isMobile ? 'pt-14' : expanded ? 'ml-[220px]' : 'ml-14')}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </>
  )
}

/**
 * Layout for routes that work for both anonymous and authenticated users.
 * Shows the sidebar when logged in; otherwise renders the page full-width
 * with no chrome. The page itself is responsible for showing its own
 * navigation/back affordances when running anonymously.
 */
function PublicLayout() {
  const { user, isLoading } = useAuth()
  const logout = useLogout()
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('cc_sidebar_expanded') === 'true'
  })

  useEffect(() => {
    const handler = () => setExpanded(localStorage.getItem('cc_sidebar_expanded') === 'true')
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Avoid layout flash while auth probe is in flight.
  if (isLoading) {
    return (
      <main className="min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    )
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <Sidebar user={user ?? undefined} onLogout={user ? () => logout.mutate() : undefined} />
      <main id="main-content" className={cn('min-h-screen transition-[margin] duration-200 ease-in-out', isMobile ? 'pt-14' : expanded ? 'ml-[220px]' : 'ml-14')}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </>
  )
}
