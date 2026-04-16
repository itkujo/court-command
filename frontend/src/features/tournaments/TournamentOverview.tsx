import { useState } from 'react'
import {
  useUpdateTournamentStatus,
  type Tournament,
  type Division,
} from './hooks'
import { useToast } from '../../components/Toast'
import { InfoRow } from '../../components/InfoRow'
import { RichTextDisplay } from '../../components/RichTextDisplay'
import { StatusBadge } from '../../components/StatusBadge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AdSlot } from '../../components/AdSlot'
import { CloneDialog } from './CloneDialog'
import { formatDate } from '../../lib/formatters'
import {
  Calendar,
  Users,
  Layers,
  Globe,
  Mail,
  Phone,
} from 'lucide-react'

interface TournamentOverviewProps {
  tournament: Tournament
  divisions: Division[]
}

const STATUS_TRANSITIONS: Record<
  string,
  { label: string; next: string; variant?: 'primary' | 'danger' }[]
> = {
  draft: [{ label: 'Publish', next: 'published' }],
  published: [{ label: 'Open Registration', next: 'registration_open' }],
  registration_open: [
    { label: 'Close Registration', next: 'registration_closed' },
  ],
  registration_closed: [{ label: 'Start Tournament', next: 'in_progress' }],
  in_progress: [{ label: 'Complete', next: 'completed' }],
}

export function TournamentOverview({
  tournament,
  divisions,
}: TournamentOverviewProps) {
  const { toast } = useToast()
  const statusMutation = useUpdateTournamentStatus(String(tournament.id))
  const [cancelOpen, setCancelOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)

  const totalRegistrations = 0 // Will be populated when registrations are fetched per-division

  async function handleStatusChange(newStatus: string) {
    try {
      await statusMutation.mutateAsync({ status: newStatus })
      toast('success', `Tournament status updated to ${newStatus.replace(/_/g, ' ')}`)
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  const transitions = STATUS_TRANSITIONS[tournament.status] ?? []

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/10 p-2">
              <Layers className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-(--color-text-secondary)">Divisions</p>
              <p className="text-lg font-semibold text-(--color-text-primary)">
                {divisions.length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Users className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-(--color-text-secondary)">
                Registrations
              </p>
              <p className="text-lg font-semibold text-(--color-text-primary)">
                {totalRegistrations}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Calendar className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-(--color-text-secondary)">
                Start Date
              </p>
              <p className="text-sm font-medium text-(--color-text-primary)">
                {formatDate(tournament.start_date)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Calendar className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-(--color-text-secondary)">End Date</p>
              <p className="text-sm font-medium text-(--color-text-primary)">
                {formatDate(tournament.end_date)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Section */}
      <Card>
        <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
          Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Status" value={<StatusBadge status={tournament.status} type="tournament" />} />
          <InfoRow label="Venue" value={tournament.venue_id ? `Venue #${tournament.venue_id}` : null} />
          <InfoRow label="Start Date" value={formatDate(tournament.start_date)} />
          <InfoRow label="End Date" value={formatDate(tournament.end_date)} />
          <InfoRow label="Max Participants" value={tournament.max_participants ?? null} />
          <InfoRow label="Show Registrations" value={tournament.show_registrations ? 'Yes' : 'No'} />
          {tournament.contact_email && (
            <InfoRow
              label="Contact Email"
              value={
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {tournament.contact_email}
                </span>
              }
            />
          )}
          {tournament.contact_phone && (
            <InfoRow
              label="Contact Phone"
              value={
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {tournament.contact_phone}
                </span>
              }
            />
          )}
          {tournament.website_url && (
            <InfoRow
              label="Website"
              value={
                <a
                  href={tournament.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-cyan-400 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {tournament.website_url}
                </a>
              }
            />
          )}
        </div>
      </Card>

      {/* Description */}
      {tournament.description && (
        <Card>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">
            Description
          </h2>
          <RichTextDisplay html={tournament.description} />
        </Card>
      )}

      {/* Sponsors */}
      {tournament.sponsor_info && tournament.sponsor_info.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">
            Sponsors
          </h2>
          <div className="flex flex-wrap gap-4">
            {tournament.sponsor_info.map((sponsor, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2"
              >
                {sponsor.logo_url && (
                  <img
                    src={sponsor.logo_url}
                    alt={`${sponsor.name} logo`}
                    className="h-8 w-8 rounded object-contain"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">
                    {sponsor.name}
                  </p>
                  <p className="text-xs text-(--color-text-secondary) capitalize">
                    {sponsor.tier}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Status Actions */}
      <Card>
        <h2 className="text-lg font-semibold text-(--color-text-primary) mb-4">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {transitions.map((t) => (
            <Button
              key={t.next}
              variant={t.variant ?? 'primary'}
              onClick={() => handleStatusChange(t.next)}
              loading={statusMutation.isPending}
            >
              {t.label}
            </Button>
          ))}
          {tournament.status !== 'cancelled' && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel Tournament
            </Button>
          )}
          {(tournament.status === 'completed' ||
            tournament.status === 'cancelled') && (
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
          )}
          <Button variant="secondary" onClick={() => setCloneOpen(true)}>
            Clone Tournament
          </Button>
        </div>
      </Card>

      <AdSlot size="medium-rectangle" slot="tournament-detail" className="mt-6" />

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          handleStatusChange('cancelled')
          setCancelOpen(false)
        }}
        title="Cancel Tournament"
        message="Are you sure you want to cancel this tournament? This action cannot be undone. All registrations will be affected."
        confirmText="Cancel Tournament"
        variant="danger"
        loading={statusMutation.isPending}
      />

      {/* Archive Confirm */}
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => {
          handleStatusChange('archived')
          setArchiveOpen(false)
        }}
        title="Archive Tournament"
        message="Archive this tournament? It will be hidden from active lists but data will be preserved."
        confirmText="Archive"
        variant="primary"
        loading={statusMutation.isPending}
      />

      {/* Clone Dialog */}
      <CloneDialog
        tournament={tournament}
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
      />
    </div>
  )
}
