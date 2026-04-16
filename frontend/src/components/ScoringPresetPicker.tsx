import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { Select } from './Select'

interface ScoringPreset {
  id: number
  name: string
  description: string | null
  scoring_config: {
    scoring_type?: string
    points_to?: number
    win_by?: number
    best_of?: number
  }
  is_system: boolean
}

interface ScoringPresetPickerProps {
  value: number | null
  onChange: (presetId: number | null) => void
  className?: string
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
          {p.name}
        </option>
      ))}
    </Select>
  )
}
