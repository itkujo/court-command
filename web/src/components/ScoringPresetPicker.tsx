import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { Select } from './Select'

// Shape mirrors api/service/scoring_preset.go ScoringPresetResponse.
// Backend emits a FLAT object, not a nested scoring_config. The old
// ScoringPresetPicker TS type declared a nested scoring_config that never
// existed on the wire \u2014 rendering code that touched it got undefined back
// every time. See audit finding Agent 5 #1.
interface ScoringPreset {
  id: number
  name: string
  description: string | null
  sport: string
  is_system: boolean
  is_active: boolean
  games_per_set: number
  sets_to_win: number
  points_to_win: number
  win_by: number
  max_points: number | null
  rally_scoring: boolean
  timeouts_per_game: number
  timeout_duration_sec: number
  freeze_at: number | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface ScoringPresetPickerProps {
  value: number | null
  onChange: (presetId: number | null) => void
  className?: string
}

function summarize(p: ScoringPreset): string {
  const format = p.sets_to_win > 1 ? `Best of ${2 * p.sets_to_win - 1}` : `1 game`
  const rally = p.rally_scoring ? 'rally' : 'sideout'
  return `${p.points_to_win} win-by-${p.win_by}, ${format}, ${rally}`
}

export function ScoringPresetPicker({ value, onChange, className }: ScoringPresetPickerProps) {
  const { data: presets } = useQuery<ScoringPreset[]>({
    queryKey: ['scoring-presets'],
    queryFn: () => apiGet<ScoringPreset[]>('/api/v1/scoring-presets'),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Select
      value={value ? String(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={className}
    >
      <option value="">Select scoring preset...</option>
      {(presets || []).map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.name} &mdash; {summarize(p)}
        </option>
      ))}
    </Select>
  )
}
