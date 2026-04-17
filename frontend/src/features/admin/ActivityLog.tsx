import { useState, type KeyboardEvent } from 'react'
import { Activity, ChevronDown, ChevronRight } from 'lucide-react'
import { useActivityLogs } from './hooks'
import type { ActivityLogEntry } from './types'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { Input } from '../../components/Input'
import { Pagination } from '../../components/Pagination'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import { Badge } from '../../components/Badge'
import { formatDateTime } from '../../lib/formatters'
import { cn } from '../../lib/cn'

const PAGE_SIZE = 25

const ENTITY_TYPES = [
  'user',
  'tournament',
  'league',
  'season',
  'division',
  'venue',
  'match',
  'team',
  'registration',
  'api_key',
] as const

export function ActivityLog() {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE

  const { data, isLoading, error, refetch } = useActivityLogs({
    entity_type: entityType || undefined,
    action: action || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  const entries = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  function handleFilterChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Activity Log
        </h1>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          Platform-wide activity and audit trail.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-(--color-text-secondary)">
            Entity Type
          </label>
          <Select
            value={entityType}
            onChange={(e) => handleFilterChange(setEntityType)(e.target.value)}
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-56">
          <label className="mb-1 block text-xs font-medium text-(--color-text-secondary)">
            Action
          </label>
          <Input
            value={action}
            onChange={(e) => handleFilterChange(setAction)(e.target.value)}
            placeholder="Filter by action..."
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && <SkeletonTable rows={8} />}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-(--color-error)/30 bg-(--color-error)/5 p-6 text-center">
          <p className="text-(--color-error)">Failed to load activity log.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && entries.length === 0 && (
        <EmptyState
          icon={<Activity className="h-10 w-10" />}
          title="No activity found"
          description="No log entries match the current filters."
        />
      )}

      {/* Table */}
      {!isLoading && !error && entries.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-(--color-border)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-bg-secondary)">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                    Timestamp
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                    User
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                    Action
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                    Entity Type
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                    Entity ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}

// ── Expandable Row ────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0

  return (
    <>
      <tr
        className={cn(
          'border-b border-(--color-border) transition-colors',
          hasMetadata && 'cursor-pointer hover:bg-(--color-bg-hover)',
        )}
        onClick={() => hasMetadata && setExpanded(!expanded)}
        {...(hasMetadata && {
          role: 'button',
          tabIndex: 0,
          onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded(!expanded)
            }
          },
        })}
      >
        <td className="px-3 py-2 text-(--color-text-muted)">
          {hasMetadata &&
            (expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-(--color-text-primary)">
          {formatDateTime(entry.created_at)}
        </td>
        <td className="px-3 py-2 text-(--color-text-primary)">
          {entry.user_email ?? (
            <span className="italic text-(--color-text-muted)">System</span>
          )}
        </td>
        <td className="px-3 py-2">
          <Badge variant="info">{entry.action}</Badge>
        </td>
        <td className="px-3 py-2 text-(--color-text-secondary)">
          {entry.entity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-(--color-text-muted)">
          {entry.entity_id}
        </td>
      </tr>
      {expanded && hasMetadata && (
        <tr className="border-b border-(--color-border)">
          <td colSpan={6} className="bg-(--color-bg-secondary) px-6 py-3">
            <pre className="max-h-60 overflow-auto rounded-lg bg-(--color-bg-primary) p-3 text-xs text-(--color-text-secondary)">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}
