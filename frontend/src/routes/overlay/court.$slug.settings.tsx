// frontend/src/routes/overlay/court.$slug.settings.tsx
//
// Overlay Control Panel — broadcast operator surface for tuning the
// per-court overlay at /overlay/court/$slug/settings.
//
// Layout:
//   ┌─────────────────────────────────────────────┐
//   │                PreviewPane (50vh)           │
//   │  (scaled live OverlayRenderer, checkered)   │
//   ├─────────────────────────────────────────────┤
//   │  TabLayout:                                  │
//   │   Elements | Theme | Source | Triggers |    │
//   │   Overrides | OBS URL                        │
//   └─────────────────────────────────────────────┘
//
// Auth gate: only operator-class roles get in. Backend currently only
// accepts 'player' and 'platform_admin' via CHECK constraint (migration
// 00030 expanded the schema but the constraint is sticky), so in
// practice this page is reachable by platform_admin + any elevated
// role once the constraint is relaxed.

import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ExternalLink, Loader2, Lock, Sparkles, X } from 'lucide-react'
import { Button } from '../../components/Button'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { TabLayout } from '../../components/TabLayout'
import { useAuth } from '../../features/auth/hooks'
import { ElementsTab } from '../../features/overlay/controls/ElementsTab'
import { ObsUrlTab } from '../../features/overlay/controls/ObsUrlTab'
import { OverridesTab } from '../../features/overlay/controls/OverridesTab'
import { SourceTab } from '../../features/overlay/controls/SourceTab'
import { ThemeTab } from '../../features/overlay/controls/ThemeTab'
import { TriggersTab } from '../../features/overlay/controls/TriggersTab'
import { PreviewPane } from '../../features/overlay/PreviewPane'
import type { CourtOverlayConfig } from '../../features/overlay/types'
import {
  useOverlayConfig,
  useOverlayDataBySlug,
} from '../../features/overlay/hooks'

// Operator-class roles allowed to configure overlays. Kept at module
// scope so it isn't rebuilt on every render. Mirror any backend change
// here — this is a UI gate, not an authorization boundary.
const ROLE_ALLOWLIST: ReadonlySet<string> = new Set([
  'broadcast_operator',
  'tournament_director',
  'head_referee',
  'platform_admin',
])

type TabId =
  | 'elements'
  | 'theme'
  | 'source'
  | 'triggers'
  | 'overrides'
  | 'obs_url'

export const Route = createFileRoute('/overlay/court/$slug/settings')({
  component: OverlaySettingsRoute,
})

function OverlaySettingsRoute() {
  return (
    <ErrorBoundary>
      <OverlaySettingsPage />
    </ErrorBoundary>
  )
}

function OverlaySettingsPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('elements')

  // Resolve slug → courtID so downstream mutation hooks can target the
  // right court. We intentionally render the preview pane regardless of
  // whether the config query has resolved; the renderer itself is
  // silent-by-default during loading states.
  const { courtID, courtsQuery } = useOverlayDataBySlug(slug, {})
  const configQuery = useOverlayConfig(courtID)

  const tabs = useMemo(
    () => [
      { id: 'elements', label: 'Elements' },
      { id: 'theme', label: 'Theme' },
      { id: 'source', label: 'Source' },
      { id: 'triggers', label: 'Triggers' },
      { id: 'overrides', label: 'Overrides' },
      { id: 'obs_url', label: 'OBS URL' },
    ],
    [],
  )

  // Auth gate — render a localized access denied card rather than
  // redirecting, so operators see why they can't get in.
  if (authLoading) {
    return <FullPageSpinner label="Checking access…" />
  }
  if (!isAuthenticated || !user) {
    // Not logged in — send to login and bounce back.
    navigate({
      to: '/login',
      search: { redirect: `/overlay/court/${slug}/settings` },
    })
    return null
  }
  if (!ROLE_ALLOWLIST.has(user.role)) {
    return <AccessDeniedCard role={user.role} slug={slug} />
  }

  // Court resolution — if the slug doesn't match any known court,
  // show a specific "not found" state so the operator can fix the URL
  // rather than staring at a blank preview.
  if (courtsQuery.isLoading) {
    return <FullPageSpinner label="Loading court…" />
  }
  if (courtsQuery.isError) {
    return (
      <ErrorCard
        title="Could not load courts"
        message="We couldn't fetch the court list. Check your connection and try again."
      />
    )
  }
  if (courtID === null) {
    return (
      <ErrorCard
        title="Court not found"
        message={`No court matches the slug “${slug}”. Check the URL or create this court from the Venues page.`}
      />
    )
  }

  const config = configQuery.data

  return (
    <div className="space-y-6">
      <Header slug={slug} courtID={courtID} />

      <FirstRunBanner courtID={courtID} config={config} />

      {/* Preview pane — ~50vh height, falls back to min when viewport short */}
      <section aria-label="Live overlay preview">
        <div style={{ height: 'min(50vh, 560px)', minHeight: 280 }}>
          <PreviewPane slug={slug} className="h-full" />
        </div>
      </section>

      {/* Tab controls */}
      <section aria-label="Overlay configuration">
        <TabLayout
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        >
          {activeTab === 'elements' && (
            <ElementsTab courtID={courtID} config={config} loading={configQuery.isLoading} />
          )}
          {activeTab === 'theme' && (
            <ThemeTab courtID={courtID} config={config} loading={configQuery.isLoading} />
          )}
          {activeTab === 'source' && (
            <SourceTab courtID={courtID} config={config} loading={configQuery.isLoading} />
          )}
          {activeTab === 'triggers' && <TriggersTab courtID={courtID} />}
          {activeTab === 'overrides' && (
            <OverridesTab courtID={courtID} config={config} loading={configQuery.isLoading} />
          )}
          {activeTab === 'obs_url' && (
            <ObsUrlTab slug={slug} courtID={courtID} config={config} loading={configQuery.isLoading} />
          )}
        </TabLayout>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header (with "Open OBS View" action)
// ---------------------------------------------------------------------------

function Header({ slug, courtID }: { slug: string; courtID: number }) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs uppercase tracking-wider text-(--color-text-muted) mb-1">
          Broadcast Overlay · Court #{courtID}
        </div>
        <h1 className="text-2xl font-semibold text-(--color-text-primary)">
          {slug}
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Configure the per-court OBS overlay. Changes apply live to any
          connected browser source.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/overlay/court/$slug"
          params={{ slug }}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-text-secondary) hover:text-(--color-text-primary)"
        >
          Open OBS view <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// First-run banner
//
// Nudges operators who land on a fresh court toward the setup wizard so
// they don't stare at a dead preview pane wondering what to do next.
// The "fresh" detection is intentionally conservative: no theme_id, or
// zero visible element toggles. Dismissal persists per-court in
// sessionStorage so the banner does not nag during the same session.
// ---------------------------------------------------------------------------

function FirstRunBanner({
  courtID,
  config,
}: {
  courtID: number
  config: CourtOverlayConfig | undefined
}) {
  const storageKey = `cc:overlay:first-run-dismissed:${courtID}`
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey)
      if (stored === '1') setDismissed(true)
    } catch {
      // sessionStorage unavailable (private mode) — banner stays visible.
    }
  }, [storageKey])

  if (dismissed) return null
  if (!config) return null

  const hasTheme = typeof config.theme_id === 'string' && config.theme_id.length > 0
  const visibleCount = Object.values(config.elements ?? {}).filter(
    (el) => el && typeof el === 'object' && (el as { visible?: boolean }).visible === true,
  ).length
  const needsSetup = !hasTheme || visibleCount === 0
  if (!needsSetup) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // ignore storage failures — state dismissal still holds for this render
    }
  }

  return (
    <section
      role="region"
      aria-label="Overlay setup suggestion"
      className="flex items-start justify-between gap-4 rounded-lg border border-(--color-accent) bg-(--color-accent)/10 p-4"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-(--color-accent) mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            Overlay not configured yet
          </h2>
          <p className="mt-0.5 text-sm text-(--color-text-secondary)">
            This court has no theme or visible elements selected. Run the
            setup wizard to get on-air in three steps.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/overlay/setup">
          <Button size="sm">Open setup wizard</Button>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss setup suggestion"
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex items-center gap-3 text-(--color-text-secondary)">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}

function AccessDeniedCard({ role, slug }: { role: string; slug: string }) {
  return (
    <div className="mx-auto max-w-lg mt-12 rounded-lg border border-(--color-border) p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--color-bg-hover)">
        <Lock className="h-6 w-6 text-(--color-text-secondary)" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-(--color-text-primary)">
        Operator access required
      </h1>
      <p className="mt-2 text-sm text-(--color-text-secondary)">
        Configuring the broadcast overlay requires an operator-class role
        (Tournament Director, Head Referee, Broadcast Operator, or Platform
        Admin). Your current role is{' '}
        <span className="font-mono text-(--color-text-primary)">{role}</span>.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to="/overlay/court/$slug"
          params={{ slug }}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="secondary">View overlay (read-only)</Button>
        </Link>
      </div>
    </div>
  )
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-lg mt-12 rounded-lg border border-(--color-border) p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-(--color-text-primary)">{title}</h1>
      <p className="mt-2 text-sm text-(--color-text-secondary)">{message}</p>
    </div>
  )
}
