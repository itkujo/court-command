import { useState } from 'react'
import { MapPin, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { usePendingVenues, useUpdateVenueStatus } from './hooks'
import type { VenueApprovalItem } from './types'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Textarea } from '../../components/Textarea'
import { Pagination } from '../../components/Pagination'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { formatDate } from '../../lib/formatters'
import { cn } from '../../lib/cn'

const PAGE_SIZE = 12

export function VenueApproval() {
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE

  const { data, isLoading, error, refetch } = usePendingVenues(PAGE_SIZE, offset)
  const updateStatus = useUpdateVenueStatus()
  const { toast } = useToast()

  const [rejectTarget, setRejectTarget] = useState<VenueApprovalItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<VenueApprovalItem | null>(null)
  const [feedback, setFeedback] = useState('')

  const venues = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  function handleApprove(venue: VenueApprovalItem) {
    updateStatus.mutate(
      { venueId: venue.public_id, status: 'published' },
      {
        onSuccess: () => toast('success', `${venue.name} approved`),
        onError: () => toast('error', `Failed to approve ${venue.name}`),
      },
    )
  }

  function openReject(venue: VenueApprovalItem) {
    setRejectTarget(venue)
    setFeedback('')
  }

  function handleReject() {
    if (!rejectTarget) return
    updateStatus.mutate(
      { venueId: rejectTarget.public_id, status: 'draft', feedback },
      {
        onSuccess: () => {
          toast('success', `${rejectTarget.name} rejected`)
          setRejectTarget(null)
        },
        onError: () => toast('error', `Failed to reject ${rejectTarget.name}`),
      },
    )
  }

  function handleArchive() {
    if (!archiveTarget) return
    updateStatus.mutate(
      { venueId: archiveTarget.public_id, status: 'archived' },
      {
        onSuccess: () => {
          toast('success', `${archiveTarget.name} archived`)
          setArchiveTarget(null)
        },
        onError: () => toast('error', `Failed to archive ${archiveTarget.name}`),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Venue Approval
        </h1>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          Review and approve pending venue submissions.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-(--color-error)/30 bg-(--color-error)/5 p-6 text-center">
          <p className="text-(--color-error)">Failed to load pending venues.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && venues.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title="No pending venues"
          description="All venue submissions have been reviewed."
        />
      )}

      {/* Cards */}
      {!isLoading && !error && venues.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onApprove={() => handleApprove(venue)}
                onReject={() => openReject(venue)}
                onArchive={() => setArchiveTarget(venue)}
                loading={updateStatus.isPending}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget?.name ?? 'Venue'}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-(--color-text-secondary)">
            Provide feedback for the venue owner explaining why this submission
            was rejected.
          </p>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Reason for rejection..."
            rows={4}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={updateStatus.isPending}
              disabled={!feedback.trim()}
            >
              Reject Venue
            </Button>
          </div>
        </div>
      </Modal>

      {/* Archive Confirm */}
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Venue"
        message={`Are you sure you want to archive "${archiveTarget?.name}"? It will be removed from public listings.`}
        confirmText="Archive"
        variant="danger"
        loading={updateStatus.isPending}
      />
    </div>
  )
}

// ── Venue Card ────────────────────────────────────────────────────────

interface VenueCardProps {
  venue: VenueApprovalItem
  onApprove: () => void
  onReject: () => void
  onArchive: () => void
  loading: boolean
}

function VenueCard({ venue, onApprove, onReject, onArchive, loading }: VenueCardProps) {
  return (
    <Card className={cn('flex flex-col justify-between p-5')}>
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-(--color-text-primary)">{venue.name}</h3>
          <button
            onClick={onArchive}
            className="p-1.5 rounded-md text-(--color-text-muted) hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Archive venue"
            aria-label={`Archive ${venue.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-(--color-text-secondary)">
          {venue.city}, {venue.state}
        </p>
        <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
          <span>{venue.court_count} court{venue.court_count !== 1 ? 's' : ''}</span>
          <span>Submitted {formatDate(venue.created_at)}</span>
        </div>
        {venue.owner_email && (
          <p className="text-xs text-(--color-text-muted)">
            By {venue.owner_email}
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          className="flex-1"
          onClick={onApprove}
          loading={loading}
        >
          <CheckCircle className="mr-1.5 h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="flex-1"
          onClick={onReject}
          disabled={loading}
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Reject
        </Button>
      </div>
    </Card>
  )
}
