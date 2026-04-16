// frontend/src/features/overlay/controls/TriggersTab.tsx
//
// Control Panel: Triggers tab.
//
// Four one-shot trigger buttons (Player Card, Team Card, Match Result,
// Custom Text). Each opens a drawer modal with kind-specific fields
// plus an auto-dismiss dropdown. Active triggers render in a list
// below with live remaining-time readouts and per-item dismiss buttons.
//
// Triggers are client-only (useTriggerQueue); they don't persist to
// the backend. Phase 4E wires them into OverlayRenderer so that the
// corresponding element components receive the payload.

import { useEffect, useState } from 'react'
import { X, User, Users, Trophy, Type } from 'lucide-react'
import { Button } from '../../../components/Button'
import { FormField } from '../../../components/FormField'
import { Input } from '../../../components/Input'
import { Modal } from '../../../components/Modal'
import { Select } from '../../../components/Select'
import { Textarea } from '../../../components/Textarea'
import { useToast } from '../../../components/Toast'
import type { OverlayTrigger, TriggerDismissMode, TriggerKind } from '../types'
import { useTriggerQueue } from '../useTriggerQueue'

const DISMISS_OPTIONS: Array<{
  label: string
  value: TriggerDismissMode
}> = [
  { label: 'Manual dismiss', value: { kind: 'manual' } },
  { label: 'Auto · 5 seconds', value: { kind: 'auto', durationMs: 5_000 } },
  { label: 'Auto · 10 seconds', value: { kind: 'auto', durationMs: 10_000 } },
  { label: 'Auto · 30 seconds', value: { kind: 'auto', durationMs: 30_000 } },
]

const KIND_META: Record<TriggerKind, {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}> = {
  player_card: {
    label: 'Player Card',
    description: 'Highlight a single player with stats + photo.',
    icon: User,
  },
  team_card: {
    label: 'Team Card',
    description: 'Full-roster introduction card for a team.',
    icon: Users,
  },
  match_result: {
    label: 'Match Result',
    description: 'Post-match winner banner with score line.',
    icon: Trophy,
  },
  custom_text: {
    label: 'Custom Text',
    description: 'Free-form text banner in any zone.',
    icon: Type,
  },
}

export interface TriggersTabProps {
  courtID: number
}

export function TriggersTab({ courtID }: TriggersTabProps) {
  const queue = useTriggerQueue(courtID)
  const [openKind, setOpenKind] = useState<TriggerKind | null>(null)

  return (
    <div className="space-y-6">
      {/* Trigger buttons */}
      <section>
        <div>
          <h3 className="text-sm font-semibold text-(--color-text-primary)">
            Fire a trigger
          </h3>
          <p className="text-xs text-(--color-text-muted) mt-1">
            Triggers are client-side only. They persist across reload in
            this browser session but don&apos;t reach other operators.
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(Object.keys(KIND_META) as TriggerKind[]).map((kind) => {
            const meta = KIND_META[kind]
            const Icon = meta.icon
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setOpenKind(kind)}
                className="flex items-start gap-3 rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-3 text-left hover:border-(--color-accent) transition-colors"
              >
                <div className="shrink-0 h-9 w-9 rounded-md bg-(--color-bg-hover) flex items-center justify-center text-(--color-accent)">
                  <Icon className="h-4 w-4" aria-hidden={true} />
                </div>
                <div>
                  <div className="text-sm font-medium text-(--color-text-primary)">
                    {meta.label}
                  </div>
                  <p className="text-xs text-(--color-text-muted) mt-0.5">
                    {meta.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Active triggers */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">
            Active triggers ({queue.triggers.length})
          </h3>
          {queue.triggers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queue.dismissAll()}
            >
              Dismiss all
            </Button>
          )}
        </div>

        {queue.triggers.length === 0 ? (
          <p className="mt-2 text-sm text-(--color-text-muted)">
            No active triggers. Fire one above to queue an overlay event.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {queue.triggers.map((t) => (
              <ActiveTriggerRow key={t.id} trigger={t} onDismiss={() => queue.dismiss(t.id)} />
            ))}
          </ul>
        )}
      </section>

      {/* Drawer modal for configuring a new trigger */}
      {openKind && (
        <TriggerDrawer
          kind={openKind}
          onClose={() => setOpenKind(null)}
          onFire={(input) => {
            queue.fire(input)
            setOpenKind(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active trigger row
// ---------------------------------------------------------------------------

function ActiveTriggerRow({
  trigger,
  onDismiss,
}: {
  trigger: OverlayTrigger
  onDismiss: () => void
}) {
  const { toast } = useToast()
  const meta = KIND_META[trigger.kind]
  const Icon = meta.icon
  const remaining = useRemainingMs(trigger)
  const summary = summarizeTrigger(trigger)

  return (
    <li className="flex items-center gap-3 rounded-md border border-(--color-border) bg-(--color-bg-secondary) px-3 py-2">
      <div className="shrink-0 h-7 w-7 rounded-md bg-(--color-bg-hover) flex items-center justify-center text-(--color-accent)">
        <Icon className="h-3.5 w-3.5" aria-hidden={true} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-(--color-text-primary) truncate">
          {meta.label}
        </div>
        {summary && (
          <div className="text-xs text-(--color-text-muted) truncate">{summary}</div>
        )}
      </div>
      <div className="shrink-0 text-xs text-(--color-text-secondary) whitespace-nowrap">
        {trigger.dismiss.kind === 'auto' ? (
          remaining != null ? (
            <span>
              {Math.ceil(remaining / 1000)}s left
            </span>
          ) : (
            <span className="text-(--color-text-muted)">expiring…</span>
          )
        ) : (
          <span className="text-(--color-text-muted)">Manual</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          onDismiss()
          toast('info', `Dismissed ${meta.label}`)
        }}
        className="shrink-0 p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-secondary) hover:text-(--color-text-primary)"
        aria-label={`Dismiss ${meta.label}`}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Drawer modal (per-kind form)
// ---------------------------------------------------------------------------

function TriggerDrawer({
  kind,
  onClose,
  onFire,
}: {
  kind: TriggerKind
  onClose: () => void
  onFire: (input: { kind: TriggerKind; dismiss: TriggerDismissMode; payload?: Record<string, unknown> }) => void
}) {
  const meta = KIND_META[kind]
  const [dismissIdx, setDismissIdx] = useState(0)
  const [text, setText] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [zone, setZone] = useState<'bottom' | 'center' | 'top'>('center')

  const dismiss = DISMISS_OPTIONS[dismissIdx].value

  const handleFire = () => {
    let payload: Record<string, unknown> | undefined
    switch (kind) {
      case 'custom_text':
        payload = { text: text.trim(), zone }
        break
      case 'player_card':
        payload = playerId.trim() ? { player_id: playerId.trim() } : undefined
        break
      case 'team_card':
        payload = teamId.trim() ? { team_id: teamId.trim() } : undefined
        break
      case 'match_result':
        payload = undefined
        break
    }
    onFire({ kind, dismiss, payload })
  }

  const canFire = kind !== 'custom_text' || text.trim().length > 0

  return (
    <Modal open onClose={onClose} title={`Fire ${meta.label}`}>
      <div className="space-y-4">
        <p className="text-sm text-(--color-text-secondary)">{meta.description}</p>

        {kind === 'custom_text' && (
          <>
            <FormField label="Text" htmlFor="trigger-text" required>
              <Textarea
                id="trigger-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Halftime · Back in 10"
                rows={3}
              />
            </FormField>
            <FormField label="Zone" htmlFor="trigger-zone">
              <Select
                id="trigger-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value as typeof zone)}
              >
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </Select>
            </FormField>
          </>
        )}

        {kind === 'player_card' && (
          <FormField
            label="Player ID (optional)"
            htmlFor="trigger-player-id"
          >
            <Input
              id="trigger-player-id"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="Leave blank to auto-pick server"
            />
            <p className="text-xs text-(--color-text-muted) mt-1">
              If blank, the overlay will default to the current server.
            </p>
          </FormField>
        )}

        {kind === 'team_card' && (
          <FormField
            label="Team ID (optional)"
            htmlFor="trigger-team-id"
          >
            <Input
              id="trigger-team-id"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Leave blank for both teams"
            />
          </FormField>
        )}

        <FormField label="Dismiss behavior" htmlFor="trigger-dismiss">
          <Select
            id="trigger-dismiss"
            value={String(dismissIdx)}
            onChange={(e) => setDismissIdx(Number(e.target.value))}
          >
            {DISMISS_OPTIONS.map((opt, idx) => (
              <option key={opt.label} value={idx}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleFire} disabled={!canFire}>
            Fire trigger
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeTrigger(trigger: OverlayTrigger): string | null {
  const p = trigger.payload
  if (!p) return null
  switch (trigger.kind) {
    case 'custom_text':
      return typeof p.text === 'string' ? `“${p.text}”` : null
    case 'player_card':
      return typeof p.player_id === 'string' ? `Player #${p.player_id}` : null
    case 'team_card':
      return typeof p.team_id === 'string' ? `Team #${p.team_id}` : null
    default:
      return null
  }
}

function useRemainingMs(trigger: OverlayTrigger): number | null {
  // Re-render twice per second so the countdown stays current.
  useTicker(trigger.dismiss.kind === 'auto' ? 500 : null)
  if (trigger.dismiss.kind !== 'auto') return null
  const elapsed = Date.now() - trigger.startedAt
  return Math.max(0, trigger.dismiss.durationMs - elapsed)
}

function useTicker(intervalMs: number | null) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (intervalMs == null) return
    const t = setInterval(() => setN((x) => x + 1), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
}
