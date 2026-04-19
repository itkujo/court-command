import { useQuery } from '@tanstack/react-query'
import { useGhostConfig } from './useGhostConfig'

interface GhostTag {
  id: string
  name: string
  slug: string
}

export interface GhostPost {
  id: string
  title: string
  slug: string
  excerpt: string
  feature_image: string | null
  published_at: string
  tags: GhostTag[]
}

interface GhostPostsResponse {
  posts: GhostPost[]
}

interface UseGhostPostsOptions {
  tag?: string
  limit?: number
  enabled?: boolean
}

export function useGhostPosts({ tag, limit = 3, enabled = true }: UseGhostPostsOptions = {}) {
  const { ghostUrl, apiKey, isConfigured } = useGhostConfig()

  const query = useQuery<GhostPost[]>({
    queryKey: ['ghost-posts', ghostUrl, tag, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        key: apiKey,
        limit: String(limit),
        include: 'tags',
        fields: 'id,title,slug,excerpt,feature_image,published_at',
      })
      if (tag) {
        params.set('filter', `tag:${tag}`)
      }

      const res = await fetch(`${ghostUrl}/ghost/api/content/posts/?${params}`)
      if (!res.ok) {
        throw new Error(`Ghost API error: ${res.status}`)
      }
      const data: GhostPostsResponse = await res.json()
      return data.posts ?? []
    },
    enabled: enabled && isConfigured,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return {
    posts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    isConfigured,
  }
}
