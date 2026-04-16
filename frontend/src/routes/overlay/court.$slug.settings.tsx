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

import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ExternalLink, Loader2, Lock } from 'lucide-react'
import { Button } from '../../components/Button'
import { TabLayout } from '../../components/TabLayout'
import { useAuth } from '../../features/auth/hooks'
import { PreviewPane } from '../../features/overlay/PreviewPane'
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
  component: OverlaySettingsPage,
})

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
          {activeTab === 'triggers' && <TriggersTab />}
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
// Stub tab panels — filled in across subsequent Phase 4C commits.
// Each stub renders a clear placeholder so operators aren't confused.
// ---------------------------------------------------------------------------

interface TabStubProps {
  courtID: number
  config: ReturnType<typeof useOverlayConfig>['data']
  loading: boolean
}

function TabStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-(--color-border) p-8 text-center">
      <h2 className="text-lg font-semibold text-(--color-text-primary)">{title}</h2>
      <p className="mt-2 text-sm text-(--color-text-secondary) max-w-prose mx-auto">
        {description}
      </p>
      <p className="mt-4 text-xs uppercase tracking-wider text-(--color-text-muted)">
        Coming next in Phase 4C
      </p>
    </div>
  )
}

function ElementsTab(_: TabStubProps) {
  return (
    <TabStub
      title="Elements"
      description="Toggle individual overlay elements on/off and tweak per-element knobs like sponsor rotation cadence and custom text."
    />
  )
}

function ThemeTab(_: TabStubProps) {
  return (
    <TabStub
      title="Theme"
      description="Pick a base theme, then fine-tune the primary/secondary/accent colors to match your brand."
    />
  )
}

function SourceTab(_: TabStubProps) {
  return (
    <TabStub
      title="Source"
      description="Choose whether overlay data comes from a live Court Command match or an external source profile."
    />
  )
}

function TriggersTab() {
  return (
    <TabStub
      title="Triggers"
      description="Fire one-off overlay events: player cards, team intros, match result banners, custom text."
    />
  )
}

function OverridesTab(_: TabStubProps) {
  return (
    <TabStub
      title="Overrides"
      description="Manually override any OverlayData field — team names, scores, sponsor logos — for demo, media day, or troubleshooting."
    />
  )
}

function ObsUrlTab(_: { slug: string } & TabStubProps) {
  return (
    <TabStub
      title="OBS URL"
      description="Copy the browser-source URL into OBS, manage the access token, and review your overlay licensing status."
    />
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
