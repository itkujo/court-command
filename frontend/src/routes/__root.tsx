import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Sidebar } from '../components/Sidebar'
import { AuthGuard } from '../features/auth/AuthGuard'
import { useAuth, useLogout } from '../features/auth/hooks'
import { cn } from '../lib/cn'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useState, useEffect } from 'react'

const NO_SHELL_ROUTES = ['/login', '/register']

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-(--color-text-primary) mb-2">404</h1>
        <p className="text-(--color-text-secondary)">Page not found</p>
      </div>
    </div>
  ),
})

function RootLayout() {
  const location = useLocation()
  const isNoShell = NO_SHELL_ROUTES.includes(location.pathname)

  if (isNoShell) {
    return <ErrorBoundary><Outlet /></ErrorBoundary>
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
