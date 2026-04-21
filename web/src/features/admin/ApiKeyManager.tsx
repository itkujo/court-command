import { useState } from 'react'
import { Key, Plus, Copy, Check, Trash2 } from 'lucide-react'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from './hooks'
import type { ApiKey } from './types'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { DateInput } from '../../components/DateInput'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { formatDate, formatDateTime } from '../../lib/formatters'

const AVAILABLE_SCOPES = ['read'] as const

export function ApiKeyManager() {
  const { data: keys, isLoading, error, refetch } = useApiKeys()
  const createKey = useCreateApiKey()
  const revokeKey = useRevokeApiKey()
  const { toast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read'])
  const [expiresAt, setExpiresAt] = useState('')

  function resetForm() {
    setName('')
    setScopes(['read'])
    setExpiresAt('')
    setCreatedKey(null)
  }

  function openCreate() {
    resetForm()
    setShowCreate(true)
  }

  function handleCreate() {
    createKey.mutate(
      {
        name,
        scopes,
        expires_at: expiresAt || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.raw_key) {
            setCreatedKey(data.raw_key)
          } else {
            toast('success', 'API key created')
            setShowCreate(false)
          }
        },
        onError: () => toast('error', 'Failed to create API key'),
      },
    )
  }

  function handleRevoke() {
    if (!revokeTarget) return
    revokeKey.mutate(revokeTarget.id, {
      onSuccess: () => {
        toast('success', `Key "${revokeTarget.name}" revoked`)
        setRevokeTarget(null)
      },
      onError: () => toast('error', 'Failed to revoke API key'),
    })
  }

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text-primary)">API Keys</h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Manage API keys for programmatic access.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* Loading */}
      {isLoading && <SkeletonTable rows={4} />}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-(--color-error)/30 bg-(--color-error)/5 p-6 text-center">
          <p className="text-(--color-error)">Failed to load API keys.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && keys && keys.length === 0 && (
        <EmptyState
          icon={<Key className="h-10 w-10" />}
          title="No API keys"
          description="Create an API key to enable programmatic access."
        />
      )}

      {/* Table */}
      {!isLoading && !error && keys && keys.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-(--color-border)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-bg-secondary)">
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Key Prefix
                </th>
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Scopes
                </th>
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Created
                </th>
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Last Used
                </th>
                <th className="px-3 py-2 text-left font-medium text-(--color-text-secondary)">
                  Status
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-(--color-border)">
                  <td className="px-3 py-2 font-medium text-(--color-text-primary)">
                    {key.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-(--color-text-muted)">
                    {key.key_prefix}...
                  </td>
                  <td className="px-3 py-2">
                    {key.scopes.map((s) => (
                      <Badge key={s} variant="default" className="mr-1">
                        {s}
                      </Badge>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-(--color-text-secondary)">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-(--color-text-secondary)">
                    {key.last_used_at ? formatDateTime(key.last_used_at) : (
                      <span className="text-(--color-text-muted)">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={key.is_active ? 'success' : 'error'}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {key.is_active ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRevokeTarget(key)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <button
                        onClick={() => setRevokeTarget(key)}
                        className="p-1.5 rounded-md text-(--color-text-muted) hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove key"
                        aria-label={`Remove ${key.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={createdKey ? 'API Key Created' : 'Create API Key'}
      >
        {createdKey ? (
          <CreatedKeyDisplay
            rawKey={createdKey}
            onClose={() => {
              setShowCreate(false)
              resetForm()
            }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="api-key-name" className="mb-1 block text-sm font-medium text-(--color-text-primary)">
                Name
              </label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Key"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-(--color-text-primary)">
                Scopes
              </label>
              <div className="flex flex-wrap gap-3">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded"
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-(--color-text-primary)">
                Expires (optional)
              </label>
              <DateInput
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                loading={createKey.isPending}
                disabled={!name.trim() || scopes.length === 0}
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title={revokeTarget?.is_active ? 'Revoke API Key' : 'Remove API Key'}
        message={
          revokeTarget?.is_active
            ? `Are you sure you want to revoke "${revokeTarget?.name}"? This action cannot be undone.`
            : `Remove "${revokeTarget?.name}" from the list? This key is already revoked.`
        }
        confirmText={revokeTarget?.is_active ? 'Revoke' : 'Remove'}
        variant="danger"
        loading={revokeKey.isPending}
      />
    </div>
  )
}

// ── Created Key Display ───────────────────────────────────────────────

function CreatedKeyDisplay({
  rawKey,
  onClose,
}: {
  rawKey: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-(--color-warning)/30 bg-(--color-warning)/5 p-4">
        <p className="mb-2 text-sm font-medium text-(--color-warning)">
          This key will not be shown again. Copy it now.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-(--color-bg-primary) px-3 py-2 font-mono text-xs text-(--color-text-primary) select-all break-all">
            {rawKey}
          </code>
          <Button variant="secondary" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <Check className="h-4 w-4 text-(--color-success)" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
