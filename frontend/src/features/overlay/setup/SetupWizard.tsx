// frontend/src/features/overlay/setup/SetupWizard.tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Globe,
  Settings,
  Sparkles,
  Tv,
} from 'lucide-react'

import { Button } from '../../../components/Button'
import { FormField } from '../../../components/FormField'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Textarea } from '../../../components/Textarea'
import { useToast } from '../../../components/Toast'
import { useCreateFloatingCourt } from '../../registry/courts/hooks'
import type { Court } from '../../registry/courts/hooks'
import {
  useCreateSourceProfile,
  useUpdateSourceProfileBinding,
} from '../hooks'
import { AUTH_TYPE, SOURCE_TYPE } from '../contract'
import type { AuthType, SourceType } from '../contract'

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type StepKey = 'court' | 'source' | 'obs'

interface WizardState {
  court: Court | null
  source: 'court_command' | 'external'
}

interface StepMeta {
  key: StepKey
  label: string
  description: string
}

const STEPS: StepMeta[] = [
  { key: 'court', label: 'Create court', description: 'Name the court players compete on' },
  { key: 'source', label: 'Pick data source', description: 'Where will scores come from?' },
  { key: 'obs', label: 'Copy OBS URL', description: 'Add the browser source to OBS' },
]

// --------------------------------------------------------------------------
// Root wizard
// --------------------------------------------------------------------------

export function SetupWizard() {
  const [stepIndex, setStepIndex] = useState(0)
  const [state, setState] = useState<WizardState>({ court: null, source: 'court_command' })

  const currentStep = STEPS[stepIndex]

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <WizardHeader currentStep={currentStep} />
      <StepNav steps={STEPS} currentIndex={stepIndex} />

      {currentStep.key === 'court' && (
        <CourtStep
          initial={state.court}
          onCourtCreated={(court) => {
            setState((s) => ({ ...s, court }))
            goNext()
          }}
        />
      )}

      {currentStep.key === 'source' && state.court && (
        <SourceStep
          court={state.court}
          onBack={goBack}
          onContinue={(source) => {
            setState((s) => ({ ...s, source }))
            goNext()
          }}
        />
      )}

      {currentStep.key === 'obs' && state.court && (
        <ObsStep court={state.court} onBack={goBack} />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Header
// --------------------------------------------------------------------------

function WizardHeader({ currentStep }: { currentStep: StepMeta }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
        >
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">
            Overlay setup
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            {currentStep.description}
          </p>
        </div>
      </div>
      <Link
        to="/overlay"
        className="text-sm text-(--color-text-muted) transition-colors hover:text-(--color-text-primary)"
      >
        Skip wizard
      </Link>
    </header>
  )
}

// --------------------------------------------------------------------------
// Step nav
// --------------------------------------------------------------------------

function StepNav({ steps, currentIndex }: { steps: StepMeta[]; currentIndex: number }) {
  return (
    <ol className="grid grid-cols-3 gap-3">
      {steps.map((step, i) => {
        const state: 'done' | 'current' | 'upcoming' =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'

        return (
          <li
            key={step.key}
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{
              borderColor:
                state === 'current'
                  ? 'var(--color-accent)'
                  : 'var(--color-border)',
              backgroundColor:
                state === 'current'
                  ? 'color-mix(in oklab, var(--color-accent) 8%, transparent)'
                  : 'var(--color-bg-secondary)',
            }}
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor:
                  state === 'done'
                    ? 'var(--color-success)'
                    : state === 'current'
                      ? 'var(--color-accent)'
                      : 'var(--color-bg-tertiary)',
                color:
                  state === 'upcoming'
                    ? 'var(--color-text-muted)'
                    : 'white',
              }}
            >
              {state === 'done' ? <Check className="size-4" /> : i + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-(--color-text-primary)">
                {step.label}
              </p>
              <p className="truncate text-xs text-(--color-text-muted)">
                {step.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// --------------------------------------------------------------------------
// Step 1: court
// --------------------------------------------------------------------------

function CourtStep({
  initial,
  onCourtCreated,
}: {
  initial: Court | null
  onCourtCreated: (court: Court) => void
}) {
  const { toast } = useToast()
  const createCourt = useCreateFloatingCourt()

  const [name, setName] = useState(initial?.name ?? '')
  const [isShowCourt, setIsShowCourt] = useState(initial?.is_show_court ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !createCourt.isPending

  const submit = async () => {
    if (!canSubmit) return
    setError(null)
    try {
      const court = await createCourt.mutateAsync({
        name: name.trim(),
        is_show_court: isShowCourt,
        is_active: true,
        is_temporary: false,
        notes: notes.trim() || null,
      })
      toast('success', `Court "${court.name}" created`)
      onCourtCreated(court)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create court'
      setError(msg)
      toast('error', msg)
    }
  }

  return (
    <WizardCard>
      <CardHeader
        icon={<Tv className="size-5" />}
        title="Create a court"
        description="A court is the scoring surface your overlay follows. Name it whatever players see on signage — Court 1, Center, Stadium, etc."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Court name" required htmlFor="wizard-court-name">
          <Input
            id="wizard-court-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Court 1"
            autoFocus
          />
        </FormField>

        <FormField label="Court type" htmlFor="wizard-court-show">
          <Select
            id="wizard-court-show"
            value={isShowCourt ? 'show' : 'standard'}
            onChange={(e) => setIsShowCourt(e.target.value === 'show')}
          >
            <option value="show">Show court — broadcast grade</option>
            <option value="standard">Standard court</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="wizard-court-notes">
        <Textarea
          id="wizard-court-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional — internal reminders, sponsor prep, stream deck cue"
          rows={3}
        />
      </FormField>

      {error && (
        <div
          className="rounded-lg border border-(--color-error) px-3 py-2 text-sm"
          style={{
            color: 'var(--color-error)',
            backgroundColor: 'color-mix(in oklab, var(--color-error) 10%, transparent)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={submit} loading={createCourt.isPending} disabled={!canSubmit}>
          Create court
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </WizardCard>
  )
}

// --------------------------------------------------------------------------
// Step 2: source
// --------------------------------------------------------------------------

function SourceStep({
  court,
  onBack,
  onContinue,
}: {
  court: Court
  onBack: () => void
  onContinue: (source: 'court_command' | 'external') => void
}) {
  const { toast } = useToast()
  const createProfile = useCreateSourceProfile()
  const bindProfile = useUpdateSourceProfileBinding(court.id)

  const [source, setSource] = useState<'court_command' | 'external'>('court_command')

  // External mini-editor state
  const [name, setName] = useState(`${court.name} feed`)
  const [sourceType, setSourceType] = useState<SourceType>(SOURCE_TYPE.REST_API)
  const [apiUrl, setApiUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [authType, setAuthType] = useState<AuthType>(AUTH_TYPE.NONE)
  const [authToken, setAuthToken] = useState('')
  const [pollInterval, setPollInterval] = useState(5)
  const [error, setError] = useState<string | null>(null)

  const canContinue = useMemo(() => {
    if (source === 'court_command') return true
    if (!name.trim()) return false
    if (sourceType === SOURCE_TYPE.REST_API && !apiUrl.trim()) return false
    if (sourceType === SOURCE_TYPE.WEBHOOK && !webhookSecret.trim()) return false
    return true
  }, [source, name, sourceType, apiUrl, webhookSecret])

  const submit = async () => {
    if (!canContinue) return
    setError(null)

    if (source === 'court_command') {
      onContinue('court_command')
      return
    }

    const authConfig: Record<string, unknown> = {}
    if (sourceType === SOURCE_TYPE.REST_API && authType === AUTH_TYPE.BEARER) {
      if (!authToken.trim()) {
        setError('Bearer token is required')
        return
      }
      authConfig.token = authToken.trim()
    }

    try {
      const profile = await createProfile.mutateAsync({
        name: name.trim(),
        source_type: sourceType,
        api_url: sourceType === SOURCE_TYPE.REST_API ? apiUrl.trim() : undefined,
        webhook_secret:
          sourceType === SOURCE_TYPE.WEBHOOK ? webhookSecret.trim() : undefined,
        auth_type: sourceType === SOURCE_TYPE.REST_API ? authType : AUTH_TYPE.NONE,
        auth_config: authConfig,
        poll_interval_seconds: sourceType === SOURCE_TYPE.REST_API ? pollInterval : undefined,
        field_mapping: {},
      })
      await bindProfile.mutateAsync({ source_profile_id: profile.id })
      toast('success', `Connected "${profile.name}" to ${court.name}`)
      onContinue('external')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save source profile'
      setError(msg)
      toast('error', msg)
    }
  }

  return (
    <WizardCard>
      <CardHeader
        icon={<Database className="size-5" />}
        title="Where do scores come from?"
        description="Court Command matches feed automatically when you run matches on this court. External APIs can push or be polled."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <SourceOption
          title="Court Command match"
          description="The overlay follows whatever match is live on this court. No setup."
          icon={<Tv className="size-5" />}
          selected={source === 'court_command'}
          onSelect={() => setSource('court_command')}
        />
        <SourceOption
          title="External API / webhook"
          description="Pull or accept scores from your existing scoring system."
          icon={<Globe className="size-5" />}
          selected={source === 'external'}
          onSelect={() => setSource('external')}
        />
      </div>

      {source === 'external' && (
        <div className="space-y-4 rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Profile name" required htmlFor="wizard-source-name">
              <Input
                id="wizard-source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${court.name} feed`}
              />
            </FormField>
            <FormField label="Source type" htmlFor="wizard-source-type">
              <Select
                id="wizard-source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
              >
                <option value={SOURCE_TYPE.REST_API}>REST API (polled)</option>
                <option value={SOURCE_TYPE.WEBHOOK}>Webhook (pushed)</option>
              </Select>
            </FormField>
          </div>

          {sourceType === SOURCE_TYPE.REST_API && (
            <>
              <FormField label="API URL" required htmlFor="wizard-source-url">
                <Input
                  id="wizard-source-url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://scoring.example.com/court/1/state"
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Authentication" htmlFor="wizard-source-auth">
                  <Select
                    id="wizard-source-auth"
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as AuthType)}
                  >
                    <option value={AUTH_TYPE.NONE}>None</option>
                    <option value={AUTH_TYPE.BEARER}>Bearer token</option>
                  </Select>
                </FormField>
                <FormField label="Poll every (seconds)" htmlFor="wizard-source-poll">
                  <Input
                    id="wizard-source-poll"
                    type="number"
                    min={1}
                    max={60}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Math.max(1, Number(e.target.value) || 5))}
                  />
                </FormField>
              </div>
              {authType === AUTH_TYPE.BEARER && (
                <FormField label="Bearer token" required htmlFor="wizard-source-token">
                  <Input
                    id="wizard-source-token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="eyJhbGciOi…"
                  />
                </FormField>
              )}
            </>
          )}

          {sourceType === SOURCE_TYPE.WEBHOOK && (
            <FormField label="Shared secret" required htmlFor="wizard-source-secret">
              <Input
                id="wizard-source-secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Used to verify incoming webhooks"
              />
              <p className="mt-1 text-xs text-(--color-text-muted)">
                Your system POSTs to{' '}
                <code className="rounded bg-(--color-bg-tertiary) px-1 py-0.5 font-mono text-[11px]">
                  /api/v1/overlay/webhook/{court.id}
                </code>{' '}
                with header{' '}
                <code className="rounded bg-(--color-bg-tertiary) px-1 py-0.5 font-mono text-[11px]">
                  X-Webhook-Secret
                </code>
                .
              </p>
            </FormField>
          )}

          <p className="text-xs text-(--color-text-muted)">
            You can wire detailed field mappings later on the Source profiles page.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-(--color-error) px-3 py-2 text-sm"
          style={{
            color: 'var(--color-error)',
            backgroundColor: 'color-mix(in oklab, var(--color-error) 10%, transparent)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          onClick={submit}
          loading={createProfile.isPending || bindProfile.isPending}
          disabled={!canContinue}
        >
          Continue
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </WizardCard>
  )
}

function SourceOption({
  title,
  description,
  icon,
  selected,
  onSelect,
}: {
  title: string
  description: string
  icon: React.ReactNode
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
        backgroundColor: selected
          ? 'color-mix(in oklab, var(--color-accent) 8%, transparent)'
          : 'var(--color-bg-secondary)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: selected ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
            color: selected ? 'white' : 'var(--color-text-primary)',
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-(--color-text-primary)">
            {title}
            {selected && <CheckCircle2 className="size-4 text-(--color-accent)" />}
          </p>
          <p className="mt-1 text-sm text-(--color-text-secondary)">{description}</p>
        </div>
      </div>
    </button>
  )
}

// --------------------------------------------------------------------------
// Step 3: OBS URL
// --------------------------------------------------------------------------

function ObsStep({ court, onBack }: { court: Court; onBack: () => void }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/overlay/court/${court.slug}`
  }, [court.slug])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast('success', 'Overlay URL copied')
    } catch {
      toast('error', 'Clipboard blocked — copy manually')
    }
  }

  return (
    <WizardCard>
      <CardHeader
        icon={<ExternalLink className="size-5" />}
        title="Add as a browser source in OBS"
        description="1920×1080, 30 fps. Transparent background is enabled automatically."
      />

      <div className="space-y-3">
        <label className="text-xs font-medium text-(--color-text-muted) uppercase tracking-wide">
          Overlay URL
        </label>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-(--color-border) bg-(--color-bg-tertiary) px-3 py-2 font-mono text-sm text-(--color-text-primary)">
            {url}
          </code>
          <Button variant="secondary" onClick={copy}>
            {copied ? (
              <>
                <Check className="mr-2 size-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 size-4" />
                Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-(--color-text-muted)">
          Tip: In OBS, set <strong>Width</strong> to 1920, <strong>Height</strong> to 1080,
          and check <strong>Shutdown source when not visible</strong>.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          to="/overlay/court/$slug"
          params={{ slug: court.slug }}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4 transition-colors hover:bg-(--color-hover)"
        >
          <div>
            <p className="font-medium text-(--color-text-primary)">Preview the overlay</p>
            <p className="mt-1 text-xs text-(--color-text-muted)">
              Open the live view in a new tab
            </p>
          </div>
          <ExternalLink className="size-5 text-(--color-text-muted)" />
        </Link>

        <Link
          to="/overlay/court/$slug/settings"
          params={{ slug: court.slug }}
          className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4 transition-colors hover:bg-(--color-hover)"
        >
          <div>
            <p className="font-medium text-(--color-text-primary)">Open the control panel</p>
            <p className="mt-1 text-xs text-(--color-text-muted)">
              Tweak layout, theme and triggers
            </p>
          </div>
          <Settings className="size-5 text-(--color-text-muted)" />
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          onClick={() =>
            navigate({ to: '/overlay/court/$slug/settings', params: { slug: court.slug } })
          }
        >
          Finish & open control panel
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </WizardCard>
  )
}

// --------------------------------------------------------------------------
// Shared card
// --------------------------------------------------------------------------

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-(--color-border) bg-(--color-bg-primary) p-6">
      {children}
    </section>
  )
}

function CardHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--color-accent) 15%, transparent)',
          color: 'var(--color-accent)',
        }}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-(--color-text-primary)">{title}</h2>
        <p className="mt-1 text-sm text-(--color-text-secondary)">{description}</p>
      </div>
    </div>
  )
}
