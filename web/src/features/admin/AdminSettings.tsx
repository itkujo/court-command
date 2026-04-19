import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle, Loader2, MapPin } from 'lucide-react'
import { Card } from '../../components/Card'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { apiGet, apiPut } from '../../lib/api'

interface SettingsData {
  settings: Record<string, string>
}

function useAdminSettings() {
  return useQuery<SettingsData>({
    queryKey: ['admin-settings'],
    queryFn: () => apiGet<SettingsData>('/api/v1/admin/settings'),
  })
}

function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiPut<SettingsData>('/api/v1/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['ghost-config'] })
    },
  })
}

export function AdminSettings() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useAdminSettings()
  const mutation = useUpdateSettings()
  const [ghostUrl, setGhostUrl] = useState('')
  const [ghostApiKey, setGhostApiKey] = useState('')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')

  useEffect(() => {
    if (data?.settings) {
      setGhostUrl(data.settings.ghost_url ?? '')
      setGhostApiKey(data.settings.ghost_content_api_key ?? '')
      setGoogleMapsApiKey(data.settings.google_maps_api_key ?? '')
    }
  }, [data])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        ghost_url: ghostUrl.trim(),
        ghost_content_api_key: ghostApiKey.trim(),
        google_maps_api_key: googleMapsApiKey.trim(),
      },
      {
        onSuccess: () => toast('success', 'Settings saved'),
        onError: () => toast('error', 'Failed to save settings'),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-(--color-text-primary)">Settings</h1>
        <Card>
          <div className="flex flex-col items-center gap-3 py-8">
            <AlertCircle className="h-8 w-8 text-(--color-error)" />
            <p className="text-(--color-text-secondary)">Failed to load settings</p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium text-(--color-accent) hover:underline"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-(--color-text-primary)">Settings</h1>

      <Card className="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-(--color-border) pb-3">
            <Settings className="h-5 w-5 text-(--color-text-muted)" />
            <h2 className="text-lg font-semibold text-(--color-text-primary)">
              Ghost CMS
            </h2>
          </div>

          <div>
            <label
              htmlFor="ghost-url"
              className="mb-1 block text-sm font-medium text-(--color-text-secondary)"
            >
              Ghost URL
            </label>
            <input
              id="ghost-url"
              type="url"
              value={ghostUrl}
              onChange={(e) => setGhostUrl(e.target.value)}
              placeholder="https://news.courtcommand.app"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
          </div>

          <div>
            <label
              htmlFor="ghost-api-key"
              className="mb-1 block text-sm font-medium text-(--color-text-secondary)"
            >
              Content API Key
            </label>
            <input
              id="ghost-api-key"
              type="text"
              value={ghostApiKey}
              onChange={(e) => setGhostApiKey(e.target.value)}
              placeholder="Content API key from Ghost Admin"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <p className="mt-1 text-xs text-(--color-text-muted)">
              Found in Ghost Admin under Settings &rarr; Integrations &rarr; Custom
            </p>
          </div>

          <div className="flex items-center gap-2 border-b border-(--color-border) pb-3 pt-4">
            <MapPin className="h-5 w-5 text-(--color-text-muted)" />
            <h2 className="text-lg font-semibold text-(--color-text-primary)">
              Google Maps
            </h2>
          </div>

          <div>
            <label
              htmlFor="google-maps-api-key"
              className="mb-1 block text-sm font-medium text-(--color-text-secondary)"
            >
              API Key
            </label>
            <input
              id="google-maps-api-key"
              type="text"
              value={googleMapsApiKey}
              onChange={(e) => setGoogleMapsApiKey(e.target.value)}
              placeholder="Google Maps API key"
              className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-primary) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <p className="mt-1 text-xs text-(--color-text-muted)">
              From Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </button>
        </form>
      </Card>
    </div>
  )
}
