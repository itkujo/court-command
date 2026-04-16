// frontend/src/features/overlay/profiles/SourceProfileEditor.tsx
//
// Editor for source profiles (create + edit). Covers basics, connection,
// auth, polling, and field mapping with a Test Connection button that
// populates the FieldMapper dropdowns from discovered JSON paths.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { FormField } from '../../../components/FormField'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Skeleton } from '../../../components/Skeleton'
import { useToast } from '../../../components/Toast'
import {
  useCreateSourceProfile,
  useSourceProfile,
  useTestSourceProfileConnection,
  useUpdateSourceProfile,
} from '../hooks'
import type { AuthType, SourceType } from '../contract'
import type {
  SourceProfile,
  SourceProfileInput,
  SourceProfileTestResult,
} from '../types'
import { normalizePollInterval } from '../types'

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string; desc: string }[] = [
  {
    value: 'rest_api',
    label: 'REST API',
    desc: 'Poll a JSON endpoint on an interval (external scorekeeper, custom backend).',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    desc: 'Accept pushes from an external system at our webhook URL.',
  },
  {
    value: 'court_command',
    label: 'Court Command Match',
    desc: 'Use a live CC match as the data source (fallback).',
  },
]

const AUTH_TYPE_OPTIONS: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'basic', label: 'Basic Auth' },
]

/** Canonical fields surfaced in the FieldMapper. Mirrors a subset of
 * OVERLAY_FIELD that users commonly need to source from external data. */
const MAPPABLE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'team_1_name', label: 'Team 1 name', hint: 'e.g. home.name' },
  { key: 'team_1_score', label: 'Team 1 score', hint: 'e.g. home.score' },
  { key: 'team_1_color', label: 'Team 1 color', hint: 'hex' },
  { key: 'team_1_logo_url', label: 'Team 1 logo', hint: 'image URL' },
  { key: 'team_2_name', label: 'Team 2 name', hint: 'e.g. away.name' },
  { key: 'team_2_score', label: 'Team 2 score', hint: 'e.g. away.score' },
  { key: 'team_2_color', label: 'Team 2 color', hint: 'hex' },
  { key: 'team_2_logo_url', label: 'Team 2 logo', hint: 'image URL' },
  { key: 'current_game', label: 'Current game', hint: 'number' },
  { key: 'serving_team', label: 'Serving team', hint: '1 or 2' },
  { key: 'match_status', label: 'Match status', hint: 'scheduled / in_progress / …' },
  { key: 'division_name', label: 'Division', hint: 'string' },
  { key: 'tournament_name', label: 'Tournament', hint: 'string' },
  { key: 'round_label', label: 'Round label', hint: 'string' },
  { key: 'court_name', label: 'Court name', hint: 'string' },
]

interface Props {
  mode: 'create' | 'edit'
  profileID?: number
}

export function SourceProfileEditor({ mode, profileID }: Props) {
  const isEdit = mode === 'edit'
  const profileQuery = useSourceProfile(
    isEdit && profileID ? profileID : 0,
  )

  if (isEdit && profileQuery.isLoading) {
    return <EditorSkeleton />
  }
  if (isEdit && profileQuery.error) {
    return (
      <div className="p-6 border border-(--color-error)/30 bg-(--color-error)/10 rounded-lg text-(--color-error)">
        Failed to load profile: {(profileQuery.error as Error).message}
      </div>
    )
  }

  return (
    <EditorForm
      mode={mode}
      profileID={profileID}
      initial={isEdit ? profileQuery.data : undefined}
    />
  )
}

interface FormProps {
  mode: 'create' | 'edit'
  profileID?: number
  initial?: SourceProfile
}

function EditorForm({ mode, profileID, initial }: FormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const create = useCreateSourceProfile()
  const update = useUpdateSourceProfile()
  const test = useTestSourceProfileConnection()

  const isEdit = mode === 'edit'
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceType, setSourceType] = useState<SourceType>(
    (initial?.source_type as SourceType) ?? 'rest_api',
  )
  const [apiUrl, setApiUrl] = useState(initial?.api_url ?? '')
  const [webhookSecret, setWebhookSecret] = useState(
    initial?.webhook_secret ?? '',
  )
  const [authType, setAuthType] = useState<AuthType>(
    (initial?.auth_type as AuthType) ?? 'none',
  )
  const [authConfig, setAuthConfig] = useState<Record<string, string>>(() => {
    const raw = (initial?.auth_config ?? {}) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, String(v ?? '')]),
    )
  })
  const [pollInterval, setPollInterval] = useState<number>(
    normalizePollInterval(initial?.poll_interval_seconds ?? null) ?? 5,
  )
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(
    initial?.field_mapping ?? {},
  )
  const [testResult, setTestResult] =
    useState<SourceProfileTestResult | null>(null)
  const [showSample, setShowSample] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})

  const isWebhook = sourceType === 'webhook'
  const isRest = sourceType === 'rest_api'
  const isCC = sourceType === 'court_command'

  const payload = useMemo<SourceProfileInput>(() => ({
    name: name.trim(),
    source_type: sourceType,
    api_url: isRest ? apiUrl.trim() || null : null,
    webhook_secret: isWebhook ? webhookSecret.trim() || null : null,
    auth_type: isRest ? authType : 'none',
    auth_config: isRest && authType !== 'none' ? authConfig : {},
    poll_interval_seconds: isRest ? pollInterval : null,
    field_mapping: isRest || isWebhook ? fieldMapping : {},
  }), [
    name,
    sourceType,
    apiUrl,
    webhookSecret,
    authType,
    authConfig,
    pollInterval,
    fieldMapping,
    isRest,
    isWebhook,
  ])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (isRest && !apiUrl.trim()) e.api_url = 'URL is required for REST API'
    if (isRest && pollInterval < 1)
      e.poll_interval = 'Poll interval must be at least 1 second'
    if (isRest && authType === 'bearer' && !authConfig.token?.trim())
      e.auth_token = 'Bearer token is required'
    if (isRest && authType === 'api_key' && !authConfig.key?.trim())
      e.auth_key = 'API key is required'
    if (isRest && authType === 'basic') {
      if (!authConfig.username?.trim()) e.auth_username = 'Username is required'
      if (!authConfig.password?.trim()) e.auth_password = 'Password is required'
    }
    return e
  }

  async function onSave() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    try {
      if (isEdit && profileID) {
        await update.mutateAsync({ id: profileID, input: payload })
        toast('success', 'Profile saved')
      } else {
        await create.mutateAsync(payload)
        toast('success', 'Profile created')
      }
      navigate({ to: '/overlay/source-profiles' })
    } catch (err) {
      toast('error', (err as Error).message || 'Save failed')
    }
  }

  async function onTest() {
    setTestResult(null)
    try {
      const result = await test.mutateAsync(payload)
      setTestResult(result)
      if (result.success) {
        toast('success', 'Connection succeeded')
      } else {
        toast('warning', result.error || 'Connection test returned no data')
      }
    } catch (err) {
      setTestResult({ success: false, error: (err as Error).message })
      toast('error', (err as Error).message || 'Test failed')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          {isEdit ? 'Edit Source Profile' : 'New Source Profile'}
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          {isEdit
            ? 'Update connection and field mapping for this data source.'
            : 'Connect an external scoreboard or API to drive overlays.'}
        </p>
      </div>

      {/* Basics */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-secondary)">
          Basics
        </h2>
        <FormField label="Profile name" htmlFor="sp-name" required error={errors.name}>
          <Input
            id="sp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Scoreboard REST"
            error={Boolean(errors.name)}
          />
        </FormField>

        <FormField label="Source type" required>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={sourceType === opt.value}
                onClick={() => setSourceType(opt.value)}
                className={
                  'p-3 rounded-lg border text-left transition ' +
                  (sourceType === opt.value
                    ? 'border-(--color-accent) bg-(--color-bg-hover)'
                    : 'border-(--color-border) hover:bg-(--color-bg-hover)')
                }
              >
                <div className="font-medium text-sm text-(--color-text-primary)">
                  {opt.label}
                </div>
                <div className="text-xs text-(--color-text-secondary) mt-1">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </FormField>
      </section>

      {/* Connection */}
      {isRest && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-secondary)">
            Connection
          </h2>
          <FormField label="API URL" htmlFor="sp-url" required error={errors.api_url}>
            <Input
              id="sp-url"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.example.com/matches/123"
              error={Boolean(errors.api_url)}
            />
          </FormField>
          <FormField label="Authentication" htmlFor="sp-auth">
            <Select
              id="sp-auth"
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
            >
              {AUTH_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>

          {authType === 'bearer' && (
            <FormField label="Bearer token" htmlFor="auth-token" required error={errors.auth_token}>
              <Input
                id="auth-token"
                type="password"
                value={authConfig.token ?? ''}
                onChange={(e) =>
                  setAuthConfig({ ...authConfig, token: e.target.value })
                }
                placeholder="sk_live_…"
                error={Boolean(errors.auth_token)}
              />
            </FormField>
          )}
          {authType === 'api_key' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Header name" htmlFor="auth-header">
                <Input
                  id="auth-header"
                  value={authConfig.header ?? 'X-API-Key'}
                  onChange={(e) =>
                    setAuthConfig({ ...authConfig, header: e.target.value })
                  }
                />
              </FormField>
              <FormField label="API key" htmlFor="auth-key" required error={errors.auth_key}>
                <Input
                  id="auth-key"
                  type="password"
                  value={authConfig.key ?? ''}
                  onChange={(e) =>
                    setAuthConfig({ ...authConfig, key: e.target.value })
                  }
                  error={Boolean(errors.auth_key)}
                />
              </FormField>
            </div>
          )}
          {authType === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Username" htmlFor="auth-user" required error={errors.auth_username}>
                <Input
                  id="auth-user"
                  value={authConfig.username ?? ''}
                  onChange={(e) =>
                    setAuthConfig({ ...authConfig, username: e.target.value })
                  }
                  error={Boolean(errors.auth_username)}
                />
              </FormField>
              <FormField label="Password" htmlFor="auth-pass" required error={errors.auth_password}>
                <Input
                  id="auth-pass"
                  type="password"
                  value={authConfig.password ?? ''}
                  onChange={(e) =>
                    setAuthConfig({ ...authConfig, password: e.target.value })
                  }
                  error={Boolean(errors.auth_password)}
                />
              </FormField>
            </div>
          )}

          <FormField
            label="Poll interval (seconds)"
            htmlFor="sp-poll"
            error={errors.poll_interval}
          >
            <Input
              id="sp-poll"
              type="number"
              min={1}
              max={600}
              value={pollInterval}
              onChange={(e) =>
                setPollInterval(parseInt(e.target.value, 10) || 5)
              }
              error={Boolean(errors.poll_interval)}
            />
            <p className="text-xs text-(--color-text-muted) mt-1">
              How often to refresh from the source. Default 5s.
            </p>
          </FormField>
        </section>
      )}

      {isWebhook && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-secondary)">
            Webhook
          </h2>
          <FormField label="Shared secret (optional)" htmlFor="sp-secret">
            <Input
              id="sp-secret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Used to verify incoming payloads"
            />
          </FormField>
          <div className="text-xs text-(--color-text-secondary) p-3 rounded border border-(--color-border) bg-(--color-bg-secondary)">
            Once saved, send POST requests to{' '}
            <code className="font-mono">
              /api/v1/overlay/webhook/{'{courtID}'}
            </code>{' '}
            with the shared secret in the <code>X-Webhook-Secret</code> header.
          </div>
        </section>
      )}

      {isCC && (
        <section>
          <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-bg-secondary) text-sm text-(--color-text-secondary)">
            This profile routes overlay data from a live CC match bound to the
            court. No connection settings required.
          </div>
        </section>
      )}

      {/* Field Mapping */}
      {(isRest || isWebhook) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                Field mapping
              </h2>
              <p className="text-xs text-(--color-text-secondary) mt-1">
                Map source fields to canonical overlay fields. Run Test
                Connection to populate dropdowns from discovered paths.
              </p>
            </div>
            {isRest && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onTest}
                loading={test.isPending}
                disabled={!apiUrl.trim()}
              >
                Test Connection
              </Button>
            )}
          </div>

          {testResult && (
            <TestResultPanel
              result={testResult}
              showSample={showSample}
              onToggleSample={() => setShowSample((s) => !s)}
            />
          )}

          <FieldMapper
            mapping={fieldMapping}
            onChange={setFieldMapping}
            discoveredPaths={testResult?.discovered_paths ?? []}
          />
        </section>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-(--color-border)">
        <Button
          variant="secondary"
          onClick={() => navigate({ to: '/overlay/source-profiles' })}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving}>
          {isEdit ? 'Save changes' : 'Create profile'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field Mapper
// ---------------------------------------------------------------------------

interface FieldMapperProps {
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  discoveredPaths: string[]
}

function FieldMapper({ mapping, onChange, discoveredPaths }: FieldMapperProps) {
  return (
    <div className="border border-(--color-border) rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_1.3fr] items-center gap-4 px-4 py-2 bg-(--color-bg-secondary) border-b border-(--color-border) text-xs font-medium text-(--color-text-secondary) uppercase tracking-wide">
        <div>Canonical field</div>
        <div>Source path</div>
      </div>
      <div className="divide-y divide-(--color-border)">
        {MAPPABLE_FIELDS.map((f) => {
          const value = mapping[f.key] ?? ''
          const hasDiscovered = discoveredPaths.length > 0
          const isCustom = value !== '' && !discoveredPaths.includes(value)
          return (
            <div
              key={f.key}
              className="grid grid-cols-[1fr_1.3fr] items-start gap-4 px-4 py-3"
            >
              <div>
                <div className="text-sm text-(--color-text-primary)">
                  {f.label}
                </div>
                <div className="text-xs text-(--color-text-muted) font-mono">
                  {f.key}
                </div>
              </div>
              <div className="space-y-1.5">
                {hasDiscovered && !isCustom ? (
                  <Select
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '__custom__') {
                        onChange({ ...mapping, [f.key]: value || ' ' })
                      } else {
                        const next = { ...mapping }
                        if (v) next[f.key] = v
                        else delete next[f.key]
                        onChange(next)
                      }
                    }}
                  >
                    <option value="">— Not mapped —</option>
                    {discoveredPaths.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </Select>
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      const next = { ...mapping }
                      if (v) next[f.key] = v
                      else delete next[f.key]
                      onChange(next)
                    }}
                    placeholder={f.hint}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Test Result Panel
// ---------------------------------------------------------------------------

interface TestResultPanelProps {
  result: SourceProfileTestResult
  showSample: boolean
  onToggleSample: () => void
}

function TestResultPanel({
  result,
  showSample,
  onToggleSample,
}: TestResultPanelProps) {
  const hasSample = result.sample_payload !== undefined
  return (
    <div
      className={
        'p-3 rounded-lg border ' +
        (result.success
          ? 'border-(--color-success)/30 bg-(--color-success)/10'
          : 'border-(--color-error)/30 bg-(--color-error)/10')
      }
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-(--color-success)" />
          ) : (
            <AlertCircle className="h-5 w-5 text-(--color-error)" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-(--color-text-primary)">
              {result.success ? 'Connection succeeded' : 'Connection failed'}
            </span>
            {typeof result.status_code === 'number' && (
              <Badge variant={result.success ? 'success' : 'error'}>
                HTTP {result.status_code}
              </Badge>
            )}
            {result.discovered_paths && (
              <Badge variant="info">
                {result.discovered_paths.length} paths discovered
              </Badge>
            )}
          </div>
          {result.error && (
            <div className="text-sm text-(--color-error) mt-1">
              {result.error}
            </div>
          )}
          {hasSample && (
            <button
              type="button"
              onClick={onToggleSample}
              className="mt-2 inline-flex items-center gap-1 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
              aria-expanded={showSample}
            >
              <ChevronDown
                className={
                  'h-3 w-3 transition-transform ' +
                  (showSample ? 'rotate-180' : '')
                }
              />
              {showSample ? 'Hide sample payload' : 'Show sample payload'}
            </button>
          )}
          {hasSample && showSample && (
            <pre className="mt-2 p-2 rounded bg-(--color-bg-primary) border border-(--color-border) text-xs font-mono overflow-auto max-h-64 text-(--color-text-secondary)">
              {JSON.stringify(result.sample_payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

// Silence unused import warnings for Loader2 in future iterations.
void Loader2
void useEffect
