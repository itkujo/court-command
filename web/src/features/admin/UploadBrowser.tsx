import { useState } from 'react'
import { Upload as UploadIcon, Trash2, FileText, Image, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMyUploads, useDeleteUpload } from './hooks'
import type { Upload } from './types'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { formatDate } from '../../lib/formatters'
import { apiPost } from '../../lib/api'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/')
}

export function UploadBrowser() {
  const { data: uploads, isLoading, error, refetch } = useMyUploads()
  const deleteUpload = useDeleteUpload()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [deleteTarget, setDeleteTarget] = useState<Upload | null>(null)

  const cleanOrphans = useMutation({
    mutationFn: () => apiPost<{ deleted: number }>('/api/v1/admin/uploads/cleanup'),
    onSuccess: (data) => {
      toast('success', `Cleaned up ${data.deleted} orphaned file${data.deleted === 1 ? '' : 's'}`)
      qc.invalidateQueries({ queryKey: ['uploads'] })
    },
    onError: () => toast('error', 'Failed to clean orphaned uploads'),
  })

  function handleDelete() {
    if (!deleteTarget) return
    deleteUpload.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast('success', `${deleteTarget.original_name} deleted`)
        setDeleteTarget(null)
      },
      onError: () =>
        toast('error', `Failed to delete ${deleteTarget.original_name}`),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text-primary)">Uploads</h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Browse and manage uploaded files.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => cleanOrphans.mutate()}
          disabled={cleanOrphans.isPending}
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          {cleanOrphans.isPending ? 'Cleaning...' : 'Clean Orphans'}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-(--color-error)/30 bg-(--color-error)/5 p-6 text-center">
          <p className="text-(--color-error)">Failed to load uploads.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && uploads && uploads.length === 0 && (
        <EmptyState
          icon={<UploadIcon className="h-10 w-10" />}
          title="No uploads"
          description="No files have been uploaded yet."
        />
      )}

      {/* Grid */}
      {!isLoading && !error && uploads && uploads.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {uploads.map((upload) => (
            <UploadCard
              key={upload.id}
              upload={upload}
              onDelete={() => setDeleteTarget(upload)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Upload"
        message={`Are you sure you want to delete "${deleteTarget?.original_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteUpload.isPending}
      />
    </div>
  )
}

// ── Upload Card ───────────────────────────────────────────────────────

function UploadCard({
  upload,
  onDelete,
}: {
  upload: Upload
  onDelete: () => void
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Thumbnail / Icon */}
      <div className="flex h-32 items-center justify-center bg-(--color-bg-secondary)">
        {isImageType(upload.content_type) ? (
          <img
            src={upload.url}
            alt={upload.original_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileText className="h-10 w-10 text-(--color-text-muted)" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <p
            className="truncate text-sm font-medium text-(--color-text-primary)"
            title={upload.original_name}
          >
            {upload.original_name}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-(--color-text-muted)">
            {isImageType(upload.content_type) ? (
              <Image className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            <span>{upload.content_type}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-(--color-text-muted)">
            <span>{formatFileSize(upload.size_bytes)}</span>
            <span>{formatDate(upload.created_at)}</span>
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          className="mt-3 w-full"
          onClick={onDelete}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </Card>
  )
}
