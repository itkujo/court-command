import { useState } from 'react'
import type { DivisionTemplate } from './hooks'
import {
  useCreateDivisionTemplate,
  useUpdateDivisionTemplate,
} from './hooks'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { FormField } from '../../components/FormField'
import { useToast } from '../../components/Toast'

interface Props {
  leagueId: number
  template?: DivisionTemplate
  onClose: () => void
}

const FORMATS = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed Doubles' },
  { value: 'team_match', label: 'Team Match (MLP)' },
]

const GENDER_RESTRICTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'mens', label: "Men's" },
  { value: 'womens', label: "Women's" },
  { value: 'mixed', label: 'Mixed' },
]

const BRACKET_FORMATS = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'pool_play', label: 'Pool Play' },
  { value: 'pool_to_bracket', label: 'Pool to Bracket' },
]

const SEED_METHODS = [
  { value: 'manual', label: 'Manual' },
  { value: 'rating', label: 'By Rating' },
  { value: 'random', label: 'Random' },
]

const REGISTRATION_MODES = [
  { value: 'open', label: 'Open' },
  { value: 'invite_only', label: 'Invite Only' },
]

export function DivisionTemplateForm({ leagueId, template, onClose }: Props) {
  const { toast } = useToast()
  const createTemplate = useCreateDivisionTemplate(leagueId)
  const updateTemplate = useUpdateDivisionTemplate(leagueId, template?.id ?? 0)
  const isEditing = !!template
  const mutation = isEditing ? updateTemplate : createTemplate

  const [name, setName] = useState(template?.name ?? '')
  const [format, setFormat] = useState(template?.format ?? 'doubles')
  const [genderRestriction, setGenderRestriction] = useState(
    template?.gender_restriction ?? 'open',
  )
  const [bracketFormat, setBracketFormat] = useState(
    template?.bracket_format ?? 'single_elimination',
  )
  const [seedMethod, setSeedMethod] = useState(template?.seed_method ?? 'rating')
  const [registrationMode, setRegistrationMode] = useState(
    template?.registration_mode ?? 'open',
  )
  const [maxTeams, setMaxTeams] = useState(template?.max_teams?.toString() ?? '')
  const [autoApprove, setAutoApprove] = useState(template?.auto_approve ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (maxTeams && Number.isNaN(Number(maxTeams))) {
      e.maxTeams = 'Must be a number'
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
        format,
        gender_restriction: genderRestriction,
        bracket_format: bracketFormat,
        seed_method: seedMethod,
        registration_mode: registrationMode,
        max_teams: maxTeams ? Number(maxTeams) : null,
        auto_approve: autoApprove,
      })
      toast('success', isEditing ? 'Template updated' : 'Template created')
      onClose()
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to save template')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Template Name" required error={errors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Men's Doubles 4.0"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Format">
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Gender Restriction">
          <Select
            value={genderRestriction}
            onChange={(e) => setGenderRestriction(e.target.value)}
          >
            {GENDER_RESTRICTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Bracket Format">
          <Select
            value={bracketFormat}
            onChange={(e) => setBracketFormat(e.target.value)}
          >
            {BRACKET_FORMATS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Seed Method">
          <Select
            value={seedMethod}
            onChange={(e) => setSeedMethod(e.target.value)}
          >
            {SEED_METHODS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Registration Mode">
          <Select
            value={registrationMode}
            onChange={(e) => setRegistrationMode(e.target.value)}
          >
            {REGISTRATION_MODES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Max Teams" error={errors.maxTeams}>
          <Input
            type="number"
            value={maxTeams}
            onChange={(e) => setMaxTeams(e.target.value)}
            placeholder="No limit"
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoApprove}
          onChange={(e) => setAutoApprove(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-(--color-text-primary)">
          Auto-approve registrations
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Saving...'
            : isEditing
              ? 'Save Changes'
              : 'Create Template'}
        </Button>
      </div>
    </form>
  )
}
