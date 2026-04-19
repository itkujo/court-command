// web/src/features/overlay/controls/ObsUrlTab.tsx
//
// Control Panel: OBS URL tab.
//
// Hands the operator the browser-source URL they paste into OBS, plus
// token management and a licensing readout. The URL is intentionally
// computed client-side (window.location.origin) so it matches the
// browser the operator is using — no hard-coded hosts.
//
// Token lifecycle:
//   - Freshly generated tokens appear as full string in config.overlay_token
//   - Operators copy the URL (optionally with ?token=...) into OBS
//   - Revoking rotates the underlying secret so old URLs stop working
//
// Licensing: derived via getIsLicensed() (Phase 6 D3 resolution).
// Currently returns false (free tier). When billing ships, update
// licensing.ts to check subscription status.

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldOff,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useToast } from '../../../components/Toast'
import type { CourtOverlayConfig } from '../types'
import { getIsLicensed } from '../licensing'
import {
  useGenerateOverlayToken,
  useRevokeOverlayToken,
} from '../hooks'

export interface ObsUrlTabProps {
  slug: string
  courtID: number
  config: CourtOverlayConfig | undefined
  loading: boolean
}

export function ObsUrlTab({ slug, courtID, config, loading }: ObsUrlTabProps) {
  const { toast } = useToast()
  const [showToken, setShowToken] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = useGenerateOverlayToken(courtID)
  const revoke = useRevokeOverlayToken(courtID)

  const token = config?.overlay_token ?? null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const baseUrl = `${origin}/overlay/court/${slug}`
  const fullUrl = useMemo(
    () => (token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl),
    [baseUrl, token],
  )

  const isLicensed = getIsLicensed(config)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast('success', 'URL copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('error', 'Could not copy to clipboard')
    }
  }

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync()
      toast('success', 'New overlay token generated')
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to generate token')
    }
  }

  const handleRevoke = async () => {
    try {
      await revoke.mutateAsync()
      toast('success', 'Overlay token revoked')
      setConfirmRevoke(false)
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to revoke token')
    }
  }

  if (loading || !config) {
    return (
      <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading overlay settings…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* URL block */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-(--color-text-primary)">
              Browser source URL
            </h3>
            <p className="text-xs text-(--color-text-muted) mt-1">
              Paste this into OBS as a Browser Source (1920×1080, transparent
              background).
            </p>
          </div>
          <Link
            to="/overlay/court/$slug"
            params={{ slug }}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
          >
            Preview <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={fullUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border border-(--color-border) bg-(--color-bg-input) px-3 py-2 text-sm font-mono text-(--color-text-primary) select-all"
            aria-label="Overlay browser source URL"
          />
          <Button
            variant="primary"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-(--color-text-muted)">
          In OBS: Sources → + → Browser → paste URL → Width 1920 × Height 1080 →
          check <span className="font-mono">Shutdown when not visible</span> if
          you want to save CPU.
        </p>
      </section>

      <hr className="border-(--color-border)" />

      {/* Token section */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-(--color-text-primary)">
            Access token
          </h3>
          <p className="text-xs text-(--color-text-muted) mt-1">
            Tokens restrict who can load the OBS URL. Without a token, anyone
            with the court slug can display the overlay. Revoking rotates the
            secret — old URLs stop working immediately.
          </p>
        </div>

        {token ? (
          <div className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-3 space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-(--color-text-primary) truncate">
                {showToken ? token : maskToken(token)}
              </code>
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Show
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                loading={generate.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Rotate
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmRevoke(true)}
                disabled={revoke.isPending}
              >
                <ShieldOff className="h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-(--color-border) p-4 text-center">
            <p className="text-sm text-(--color-text-secondary)">
              No token set. The URL works without one, but anyone with the court
              slug can use it.
            </p>
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerate}
                loading={generate.isPending}
              >
                Generate token
              </Button>
            </div>
          </div>
        )}
      </section>

      <hr className="border-(--color-border)" />

      {/* Licensing */}
      <section>
        {!isLicensed && (
          <div className="flex items-start gap-3 rounded-lg border border-(--color-warning)/40 bg-(--color-warning)/10 p-3">
            <AlertTriangle
              className="h-5 w-5 text-(--color-warning) shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <div className="text-sm font-semibold text-(--color-text-primary)">
                Free tier — watermark enabled
              </div>
              <p className="text-xs text-(--color-text-secondary) mt-1">
                The overlay displays a <em>Powered By Court Command</em> pill in
                the bottom-right corner. Upgrade your plan to remove the
                watermark.
              </p>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={handleRevoke}
        title="Revoke overlay token?"
        message="Any OBS browser sources using the current URL will stop working until you generate a new token and paste in the new URL. This cannot be undone."
        confirmText="Revoke"
        loading={revoke.isPending}
      />
    </div>
  )
}

function maskToken(token: string): string {
  if (token.length <= 8) return '•'.repeat(token.length)
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`
}
