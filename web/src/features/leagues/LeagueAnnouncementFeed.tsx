import { useState } from 'react'
import type { Announcement } from './hooks'
import {
  useListLeagueAnnouncements,
  useCreateLeagueAnnouncement,
} from './hooks'
import {
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '../tournaments/hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { formatDateTime } from '../../lib/formatters'
import { Megaphone, Pin, Edit2, Trash2, Plus } from 'lucide-react'

interface Props {
  leagueId: number
}

export function LeagueAnnouncementFeed({ leagueId }: Props) {
  const { toast } = useToast()
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    is_pinned: false,
  })

  const { data: announcements, isLoading } = useListLeagueAnnouncements(leagueId)
  const createMutation = useCreateLeagueAnnouncement(leagueId)
  const updateMutation = useUpdateAnnouncement(String(editingId ?? 0))
  const deleteMutation = useDeleteAnnouncement(String(deleteId ?? 0))

  function resetForm() {
    setForm({ title: '', body: '', is_pinned: false })
    setEditingId(null)
    setComposerOpen(false)
  }

  function startEdit(a: Announcement) {
    setForm({
      title: a.title,
      body: a.body,
      is_pinned: a.is_pinned,
    })
    setEditingId(a.id)
    setComposerOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast('error', 'Title is required')
      return
    }
    try {
      const payload = {
        title: form.title,
        body: form.body,
        is_pinned: form.is_pinned,
      }
      if (editingId != null) {
        await updateMutation.mutateAsync(payload)
        toast('success', 'Announcement updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast('success', 'Announcement posted')
      }
      resetForm()
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  async function handleDelete() {
    if (deleteId == null) return
    try {
      await deleteMutation.mutateAsync()
      toast('success', 'Announcement deleted')
      setDeleteId(null)
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  const list = announcements ?? []
  const sorted = [...list].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">
          Announcements
        </h2>
        {!composerOpen && (
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Announcement
          </Button>
        )}
      </div>

      {composerOpen && (
        <Card className="mb-4">
          <div className="p-4 space-y-3">
            <h3 className="font-medium text-(--color-text-primary)">
              {editingId != null ? 'Edit Announcement' : 'New Announcement'}
            </h3>
            <FormField label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title"
              />
            </FormField>
            <FormField label="Body">
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your announcement..."
                rows={4}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-(--color-text-primary)">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_pinned: e.target.checked }))
                }
              />
              Pin to top
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={
                  editingId != null
                    ? updateMutation.isPending
                    : createMutation.isPending
                }
              >
                {editingId != null ? 'Save Changes' : 'Post'}
              </Button>
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-12 w-12" />}
          title="No announcements yet"
          description="Post an announcement to keep league participants informed."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <Card key={a.id}>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.is_pinned && (
                      <Pin className="h-4 w-4 text-amber-400" aria-label="Pinned" />
                    )}
                    <h3 className="font-semibold text-(--color-text-primary)">
                      {a.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(a)}
                      aria-label="Edit announcement"
                      className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-secondary)"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      aria-label="Delete announcement"
                      className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-secondary) hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {a.body && (
                  <p className="text-sm text-(--color-text-secondary) whitespace-pre-wrap mb-2">
                    {a.body}
                  </p>
                )}
                <div className="text-xs text-(--color-text-secondary)">
                  {formatDateTime(a.created_at)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
