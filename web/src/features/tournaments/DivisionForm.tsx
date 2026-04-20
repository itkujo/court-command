import { useState } from 'react'
import {
  useCreateDivision,
  useUpdateDivision,
  type Division,
} from './hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { ScoringPresetPicker } from '../../components/ScoringPresetPicker'

interface DivisionFormProps {
  division?: Division
  tournamentId: string
  onSuccess: () => void
  onCancel: () => void
}

// Values MUST match CHECK constraints in api/db/migrations/00011_create_divisions.sql
const FORMAT_OPTIONS = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed Doubles' },
  { value: 'team_match', label: 'Team Match' },
]

const GENDER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'mens', label: "Men's" },
  { value: 'womens', label: "Women's" },
  { value: 'mixed', label: 'Mixed' },
]

const BRACKET_OPTIONS = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'pool_play', label: 'Pool Play' },
  { value: 'pool_to_bracket', label: 'Pool to Bracket' },
]

const REGISTRATION_MODE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'invite_only', label: 'Invite Only' },
]

export function DivisionForm({
  division,
  tournamentId,
  onSuccess,
  onCancel,
}: DivisionFormProps) {
  const { toast } = useToast()
  const createMutation = useCreateDivision(tournamentId)
  const updateMutation = useUpdateDivision(
    tournamentId,
    division ? String(division.id) : '',
  )

  const [form, setForm] = useState({
    name: division?.name ?? '',
    format: division?.format ?? 'doubles',
    gender_restriction: division?.gender_restriction ?? 'open',
    bracket_format: division?.bracket_format ?? 'double_elimination',
    scoring_format: division?.scoring_format ?? '',
    max_teams: division?.max_teams ?? null as number | null,
    max_roster_size: division?.max_roster_size ?? null as number | null,
    entry_fee_amount: division?.entry_fee_amount ?? null as number | null,
    entry_fee_currency: division?.entry_fee_currency ?? 'USD',
    auto_approve: division?.auto_approve ?? false,
    registration_mode: division?.registration_mode ?? 'open',
    seed_method: division?.seed_method ?? 'manual',
  })

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('error', 'Division name is required')
      return
    }

    const payload: Partial<Division> = {
      name: form.name,
      format: form.format,
      gender_restriction: form.gender_restriction,
      bracket_format: form.bracket_format,
      scoring_format: form.scoring_format || null,
      max_teams: form.max_teams,
      max_roster_size: form.max_roster_size,
      entry_fee_amount: form.entry_fee_amount,
      entry_fee_currency: form.entry_fee_currency,
      auto_approve: form.auto_approve,
      registration_mode: form.registration_mode,
      seed_method: form.seed_method,
    }

    try {
      if (division) {
        await updateMutation.mutateAsync(payload)
        toast('success', 'Division updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast('success', 'Division created')
      }
      onSuccess()
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name" required>
        <Input
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Division name"
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Format">
          <Select
            value={form.format}
            onChange={(e) => updateField('format', e.target.value)}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Gender Restriction">
          <Select
            value={form.gender_restriction}
            onChange={(e) => updateField('gender_restriction', e.target.value)}
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Bracket Format">
          <Select
            value={form.bracket_format}
            onChange={(e) => updateField('bracket_format', e.target.value)}
          >
            {BRACKET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Registration Mode">
          <Select
            value={form.registration_mode}
            onChange={(e) => updateField('registration_mode', e.target.value)}
          >
            {REGISTRATION_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Scoring Preset">
        <ScoringPresetPicker
          value={form.scoring_format ? Number(form.scoring_format) : null}
          onChange={(id) =>
            updateField('scoring_format', id ? String(id) : '')
          }
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Max Teams">
          <Input
            type="number"
            value={form.max_teams ?? ''}
            onChange={(e) =>
              updateField(
                'max_teams',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            placeholder="No limit"
          />
        </FormField>

        <FormField label="Max Roster Size">
          <Input
            type="number"
            value={form.max_roster_size ?? ''}
            onChange={(e) =>
              updateField(
                'max_roster_size',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            placeholder="No limit"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Entry Fee">
          <Input
            type="number"
            step="0.01"
            value={form.entry_fee_amount ?? ''}
            onChange={(e) =>
              updateField(
                'entry_fee_amount',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            placeholder="0.00"
          />
        </FormField>

        <FormField label="Currency">
          <Select
            value={form.entry_fee_currency}
            onChange={(e) => updateField('entry_fee_currency', e.target.value)}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </Select>
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-(--color-text-primary)">
        <input
          type="checkbox"
          checked={form.auto_approve}
          onChange={(e) => updateField('auto_approve', e.target.checked)}
          className="rounded"
        />
        Auto-approve registrations
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {division ? 'Save Changes' : 'Create Division'}
        </Button>
      </div>
    </form>
  )
}
