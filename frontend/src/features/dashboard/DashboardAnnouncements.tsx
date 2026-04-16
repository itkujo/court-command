import { Megaphone, Pin } from 'lucide-react'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RichTextDisplay } from '../../components/RichTextDisplay'
import { formatDate } from '../../lib/formatters'
import type { DashboardAnnouncement } from './hooks'

interface Props {
  data: DashboardAnnouncement[]
}

function sortAnnouncements(items: DashboardAnnouncement[]): DashboardAnnouncement[] {
  return [...items].sort((a, b) => {
    // Pinned first
    const pinA = a.is_pinned ? 1 : 0
    const pinB = b.is_pinned ? 1 : 0
    if (pinB !== pinA) return pinB - pinA
    // Then newest first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function DashboardAnnouncements({ data }: Props) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="h-8 w-8" />}
        title="No announcements"
        description="Announcements from your tournaments and leagues will appear here."
      />
    )
  }

  const sorted = sortAnnouncements(data)

  return (
    <div className="space-y-3">
      {sorted.map((ann) => (
        <Card key={ann.id}>
          <div className="flex items-start gap-2">
            {ann.is_pinned && (
              <Pin className="h-4 w-4 text-(--color-accent) shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-(--color-text-primary)">
                {ann.title}
              </p>
              <RichTextDisplay
                html={ann.body}
                className="mt-1 text-xs text-(--color-text-muted) line-clamp-3"
              />
              <p className="text-xs text-(--color-text-muted) mt-2">
                {formatDate(ann.created_at)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
