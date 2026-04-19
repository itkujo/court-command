import { ExternalLink, Newspaper } from 'lucide-react'
import { useGhostPosts } from '../hooks/useGhostPosts'
import type { GhostPost } from '../hooks/useGhostPosts'
import { useGhostConfig } from '../hooks/useGhostConfig'

interface NewsWidgetProps {
  title: string
  tag?: string
  limit?: number
  viewAllUrl?: string
  emptyMessage?: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function PostCard({ post, ghostUrl }: { post: GhostPost; ghostUrl: string }) {
  const articleUrl = `${ghostUrl}/${post.slug}`
  const primaryTag = post.tags?.[0]

  return (
    <a
      href={articleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-(--color-bg-hover)"
    >
      {post.feature_image ? (
        <img
          src={post.feature_image}
          alt=""
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-(--color-bg-primary)">
          <Newspaper className="h-5 w-5 text-(--color-text-muted)" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-(--color-text-primary)">
          {post.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-(--color-text-muted)">
          {primaryTag && (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400">
              {primaryTag.name}
            </span>
          )}
          <span>{timeAgo(post.published_at)}</span>
        </div>
      </div>
    </a>
  )
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-(--color-bg-hover)" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-(--color-bg-hover)" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-(--color-bg-hover)" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NewsWidget({
  title,
  tag,
  limit = 3,
  viewAllUrl,
  emptyMessage = 'No news articles yet',
}: NewsWidgetProps) {
  const { ghostUrl } = useGhostConfig()
  const { posts, isLoading, isError, isConfigured } = useGhostPosts({ tag, limit })

  // Don't render anything if Ghost isn't configured
  if (!isConfigured && !isLoading) return null

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-bg-secondary) p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">{title}</h3>
        {viewAllUrl && (
          <a
            href={viewAllUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={limit} />}

      {isError && (
        <p className="py-4 text-center text-sm text-(--color-text-muted)">
          Unable to load news
        </p>
      )}

      {!isLoading && !isError && posts.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Newspaper className="h-6 w-6 text-(--color-text-muted)" />
          <p className="text-sm text-(--color-text-muted)">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && !isError && posts.length > 0 && (
        <div className="space-y-1">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} ghostUrl={ghostUrl} />
          ))}
        </div>
      )}
    </div>
  )
}
