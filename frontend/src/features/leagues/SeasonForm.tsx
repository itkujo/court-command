import { useState } from 'react'
import type { Season } from './hooks'
import { useCreateSeason, useUpdateSeason } from './hooks'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { DateInput } from '../../components/DateInput'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { FormField } from '../../components/FormField'
import { useToast } from '../../components/Toast'

interface Props {
  leagueId: number
  season?: Season
  onClose: () => void
}

const STANDINGS_METHODS = [
  { value: 'placement_points', label: 'Placement Points' },
  { value: 'win_loss', label: 'Win/Loss Record' },
  { value: 'match_points', label: 'Match Points' },
  { value: 'custom', label: 'Custom' },
]

export function SeasonForm({ leagueId, season, onClose }: Props) {
  const { toast } = useToast()
  const createSeason = useCreateSeason(leagueId)
  const updateSeason = useUpdateSeason(leagueId, season?.id ?? 0)
  const isEditing = !!season

  const [name, setName] = useState(season?.name ?? '')
  const [startDate, setStartDate] = useState(season?.start_date?.slice(0, 10) ?? '')
  const [endDate, setEndDate] = useState(season?.end_date?.slice(0, 10) ?? '')
  const [description, setDescription] = useState(season?.description ?? '')
  const [standingsMethod, setStandingsMethod] = useState(
    season?.standings_method ?? 'placement_points',
  )
  const [deadline, setDeadline] = useState(
    season?.roster_confirmation_deadline?.slice(0, 10) ?? '',
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = isEditing ? updateSeason : createSeason

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (startDate && endDate && startDate > endDate) {
      e.endDate = 'End date must be after start date'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return

    try {
      await mutation.mutateAsync({
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
        standings_method: standingsMethod,
        roster_confirmation_deadline: deadline || null,
      })
      toast('success', isEditing ? 'Season updated' : 'Season created')
      onClose()
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to save season')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Season Name" required error={errors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Spring 2026"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Start Date">
          <DateInput
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </FormField>
        <FormField label="End Date" error={errors.endDate}>
          <DateInput
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Standings Method">
        <Select
          value={standingsMethod}
          onChange={(e) => setStandingsMethod(e.target.value)}
        >
          {STANDINGS_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Roster Confirmation Deadline">
        <DateInput
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Saving...'
            : isEditing
              ? 'Save Changes'
              : 'Create Season'}
        </Button>
      </div>
    </form>
  )
}
