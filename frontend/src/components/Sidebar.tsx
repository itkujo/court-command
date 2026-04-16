import { useState, useEffect } from 'react'
import { Link, useMatchRoute, useLocation } from '@tanstack/react-router'
import { cn } from '../lib/cn'
import { useIsMobile } from '../hooks/useMediaQuery'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'
import {
  LayoutDashboard, Trophy, Medal, MapPin, Users, UsersRound, Building2, Tv, Menu, ChevronLeft, LogOut,
  Gavel, ClipboardList, Zap,
} from 'lucide-react'

interface SidebarProps {
  user: { first_name: string; last_name: string; public_id: string; display_name?: string | null }
  onLogout: () => void
}

const STORAGE_KEY = 'cc_sidebar_expanded'

interface NavItem { label: string; icon: typeof LayoutDashboard; path: string }
interface NavGroup { label?: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  { items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' }] },
  { label: 'Events', items: [
    { label: 'Tournaments', icon: Trophy, path: '/tournaments' },
    { label: 'Leagues', icon: Medal, path: '/leagues' },
  ]},
  { label: 'Manage', items: [
    { label: 'Venues & Courts', icon: MapPin, path: '/venues' },
    { label: 'Players', icon: Users, path: '/players' },
    { label: 'Teams', icon: UsersRound, path: '/teams' },
    { label: 'Organizations', icon: Building2, path: '/organizations' },
  ]},
  { label: 'Scoring', items: [
    { label: 'Ref Console', icon: Gavel, path: '/ref' },
    { label: 'Scorekeeper', icon: ClipboardList, path: '/scorekeeper' },
    { label: 'Quick Match', icon: Zap, path: '/quick-match' },
  ]},
  { label: 'Broadcast', items: [{ label: 'Overlay', icon: Tv, path: '/overlay' }] },
]

export function Sidebar({ user, onLogout }: SidebarProps) {
  const isMobile = useIsMobile()
  const matchRoute = useMatchRoute()
  const location = useLocation()
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isMobile) localStorage.setItem(STORAGE_KEY, String(expanded))
  }, [expanded, isMobile])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Per spec 3.2: while scoring is active on mobile, the sidebar drawer
  // collapses fully so the scoring UI owns the viewport.
  const isScoringActive = /^\/(ref|scorekeeper)\/matches\/[^/]+/.test(
    location.pathname,
  )
  useEffect(() => {
    if (isScoringActive && isMobile) setMobileOpen(false)
  }, [isScoringActive, isMobile])

  const isActive = (path: string) => {
    if (path === '/') return matchRoute({ to: '/', fuzzy: false })
    return matchRoute({ to: path, fuzzy: true })
  }

  const displayName = user.display_name || `${user.first_name} ${user.last_name}`

  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 border-b border-(--color-border) bg-(--color-bg-sidebar)">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-wordmark.svg" alt="Court Command" className="h-6 dark:block hidden" />
          <img src="/logo-wordmark-dark.svg" alt="Court Command" className="h-6 dark:hidden" />
          <Avatar name={displayName} size="sm" />
        </header>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
            <nav className="fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-(--color-bg-sidebar) border-r border-(--color-border) overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <img src="/logo-wordmark.svg" alt="Court Command" className="h-7 dark:block hidden" />
                  <img src="/logo-wordmark-dark.svg" alt="Court Command" className="h-7 dark:hidden" />
                  <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Close navigation">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
                <NavContent expanded={true} isActive={isActive} />
              </div>
              <SidebarFooter expanded={true} displayName={displayName} publicId={user.public_id} onLogout={onLogout} />
            </nav>
          </>
        )}
      </>
    )
  }

  return (
    <nav className={cn('fixed top-0 left-0 bottom-0 z-30 flex flex-col border-r border-(--color-border) bg-(--color-bg-sidebar) transition-[width] duration-200 ease-in-out', expanded ? 'w-[220px]' : 'w-14')}>
      <div className={cn('flex items-center h-14 border-b border-(--color-border)', expanded ? 'px-4 justify-between' : 'justify-center')}>
        {expanded ? (
          <>
            <img src="/logo-wordmark.svg" alt="Court Command" className="h-6 dark:block hidden" />
            <img src="/logo-wordmark-dark.svg" alt="Court Command" className="h-6 dark:hidden" />
            <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Collapse sidebar">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button onClick={() => setExpanded(true)} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Expand sidebar">
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <NavContent expanded={expanded} isActive={isActive} />
      </div>
      <SidebarFooter expanded={expanded} displayName={displayName} publicId={user.public_id} onLogout={onLogout} />
    </nav>
  )
}

function NavContent({ expanded, isActive }: { expanded: boolean; isActive: (path: string) => unknown }) {
  return (
    <div className="space-y-4">
      {navGroups.map((group, gi) => (
        <div key={gi}>
          {group.label && expanded && (
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-secondary)">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.path)
              return (
                <Link key={item.path} to={item.path}
                  className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', expanded ? '' : 'justify-center px-2',
                    active ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-(--color-text-secondary) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary)'
                  )}
                  title={!expanded ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {expanded && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SidebarFooter({ expanded, displayName, publicId, onLogout }: { expanded: boolean; displayName: string; publicId: string; onLogout: () => void }) {
  return (
    <div className={cn('border-t border-(--color-border) p-2 space-y-1')}>
      <ThemeToggle collapsed={!expanded} />
      {expanded ? (
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--color-text-primary) truncate">{displayName}</p>
            <p className="text-xs text-(--color-text-secondary)">{publicId}</p>
          </div>
          <button onClick={onLogout} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button onClick={onLogout} className="flex justify-center w-full p-2 rounded-lg text-(--color-text-secondary) hover:bg-(--color-bg-hover)" aria-label="Log out" title="Log out">
          <LogOut className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
