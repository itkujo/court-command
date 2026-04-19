// web/src/features/overlay/profiles/SourceProfileList.tsx
//
// List view for Source Profiles at /overlay/source-profiles.
// Shows name, type, status, last poll, and provides create/edit/delete
// actions. Status is derived from is_active + last_poll_status.

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Database, Globe, Link2, Plus, Trash2, Webhook } from 'lucide-react'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonTable } from '../../../components/Skeleton'
import { Table } from '../../../components/Table'
import { useToast } from '../../../components/Toast'
import {
  useDeleteSourceProfile,
  useSourceProfiles,
} from '../hooks'
import type { SourceProfile } from '../types'
import { normalizeTimestamptz } from '../types'

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Database; variant: 'default' | 'info' }
> = {
  court_command: { label: 'CC Match', icon: Database, variant: 'info' },
  rest_api: { label: 'REST API', icon: Globe, variant: 'default' },
  webhook: { label: 'Webhook', icon: Webhook, variant: 'default' },
}

export function SourceProfileList() {
  const { data, isLoading, error } = useSourceProfiles()
  const remove = useDeleteSourceProfile()
  const { toast } = useToast()
  const [confirm, setConfirm] = useState<SourceProfile | null>(null)

  const profiles = data ?? []

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (p: SourceProfile) => (
        <Link
          to="/overlay/source-profiles/$profileID"
          params={{ profileID: String(p.id) }}
          className="font-medium text-(--color-text-primary) hover:text-cyan-400"
        >
          {p.name}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (p: SourceProfile) => {
        const meta = TYPE_META[p.source_type] ?? TYPE_META.rest_api
        const Icon = meta.icon
        return (
          <span className="inline-flex items-center gap-2 text-(--color-text-secondary)">
            <Icon className="h-4 w-4" />
            {meta.label}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: SourceProfile) => {
        if (!p.is_active)
          return <Badge variant="default">Inactive</Badge>
        if (p.last_poll_status === 'failed')
          return <Badge variant="error">Error</Badge>
        if (p.last_poll_status === 'ok' || p.last_poll_status === 'success')
          return <Badge variant="success">Healthy</Badge>
        return <Badge variant="warning">Pending</Badge>
      },
    },
    {
      key: 'url',
      header: 'URL',
      render: (p: SourceProfile) => {
        if (p.source_type === 'court_command')
          return <span className="text-(--color-text-muted)">—</span>
        const url = p.api_url ?? ''
        if (!url) return <span className="text-(--color-text-muted)">—</span>
        return (
          <span className="inline-flex items-center gap-1.5 text-(--color-text-secondary) font-mono text-xs">
            <Link2 className="h-3.5 w-3.5" />
            <span className="truncate max-w-[240px]">{url}</span>
          </span>
        )
      },
      className: 'hidden md:table-cell',
    },
    {
      key: 'last_poll',
      header: 'Last poll',
      render: (p: SourceProfile) => {
        const iso = normalizeTimestamptz(p.last_poll_at ?? null)
        if (!iso) return <span className="text-(--color-text-muted)">Never</span>
        return (
          <span className="text-(--color-text-secondary) text-xs">
            {formatRelative(new Date(iso))}
          </span>
        )
      },
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: '',
      render: (p: SourceProfile) => (
        <button
          type="button"
          onClick={() => setConfirm(p)}
          className="p-2 rounded-md text-(--color-text-muted) hover:text-(--color-error) hover:bg-(--color-bg-hover)"
          aria-label={`Delete ${p.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      className: 'w-12 text-right',
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text-primary)">
            Source Profiles
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Connect external data sources to drive overlays on bare courts.
          </p>
        </div>
        <Link to="/overlay/source-profiles/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> New Profile
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <EmptyState
          title="Failed to load profiles"
          description={(error as Error).message}
          action={
            <Button onClick={() => window.location.reload()}>Retry</Button>
          }
        />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<Database className="h-12 w-12" />}
          title="No source profiles yet"
          description="Source profiles let you point overlays at REST APIs, webhooks, or other CC data sources."
          action={
            <Link to="/overlay/source-profiles/new">
              <Button>
                <Plus className="h-4 w-4" /> Create your first profile
              </Button>
            </Link>
          }
        />
      ) : (
        <Table
          columns={columns}
          data={profiles}
          keyExtractor={(p) => p.id}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Delete source profile?"
        message={
          confirm
            ? `This will permanently remove "${confirm.name}". Any courts bound to this profile will fall back to CC match data.`
            : ''
        }
        confirmText="Delete profile"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!confirm) return
          try {
            await remove.mutateAsync(confirm.id)
            toast('success', `Deleted ${confirm.name}`)
            setConfirm(null)
          } catch (err) {
            toast('error', (err as Error).message || 'Delete failed')
          }
        }}
      />
    </div>
  )
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
