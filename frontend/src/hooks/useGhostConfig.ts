import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'

interface GhostConfig {
  ghost_url: string
  ghost_content_api_key: string
}

export function useGhostConfig() {
  const query = useQuery<GhostConfig>({
    queryKey: ['ghost-config'],
    queryFn: () => apiGet<GhostConfig>('/api/v1/settings/ghost'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const ghostUrl = query.data?.ghost_url ?? ''
  const apiKey = query.data?.ghost_content_api_key ?? ''
  const isConfigured = ghostUrl !== '' && apiKey !== ''

  return {
    ghostUrl,
    apiKey,
    isConfigured,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
