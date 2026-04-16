import { useState } from 'react'
import { Button } from './Button'
import { ImageUpload } from './ImageUpload'
import { Input } from './Input'
import { Select } from './Select'
import { Plus, Trash2 } from 'lucide-react'

export interface SponsorEntry {
  name: string
  logo_url: string
  link_url: string
  tier: string
  is_header_sponsor: boolean
}

interface SponsorEditorProps {
  value: SponsorEntry[]
  onChange: (sponsors: SponsorEntry[]) => void
}

const TIER_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'presenting', label: 'Presenting' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
]

const emptySponsor: SponsorEntry = {
  name: '',
  logo_url: '',
  link_url: '',
  tier: 'gold',
  is_header_sponsor: false,
}

export function SponsorEditor({ value, onChange }: SponsorEditorProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<SponsorEntry>({ ...emptySponsor })

  function addSponsor() {
    if (!draft.name.trim()) return
    onChange([...value, { ...draft }])
    setDraft({ ...emptySponsor })
    setAdding(false)
  }

  function removeSponsor(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateSponsor(index: number, field: keyof SponsorEntry, val: string | boolean) {
    const updated = [...value]
    updated[index] = { ...updated[index], [field]: val }
    onChange(updated)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-(--color-text-secondary) mb-2">
        Sponsors
      </label>
      {value.length > 0 && (
        <div className="space-y-3 mb-3">
          {value.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-3"
            >
              <div className="shrink-0">
                <ImageUpload
                  label=""
                  value={s.logo_url || null}
                  onChange={(url) => updateSponsor(i, 'logo_url', url ?? '')}
                />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => updateSponsor(i, 'name', e.target.value)}
                  placeholder="Sponsor name"
                />
                <Input
                  value={s.link_url}
                  onChange={(e) => updateSponsor(i, 'link_url', e.target.value)}
                  placeholder="Website URL"
                />
                <Select
                  value={s.tier}
                  onChange={(e) => updateSponsor(i, 'tier', e.target.value)}
                >
                  {TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
                  <input
                    type="checkbox"
                    checked={s.is_header_sponsor}
                    onChange={(e) => updateSponsor(i, 'is_header_sponsor', e.target.checked)}
                    className="rounded"
                  />
                  Header sponsor
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeSponsor(i)}
                className="p-1.5 text-(--color-text-secondary) hover:text-red-400"
                aria-label="Remove sponsor"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <ImageUpload
                label="Logo"
                value={draft.logo_url || null}
                onChange={(url) => setDraft({ ...draft, logo_url: url ?? '' })}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Sponsor name"
              />
              <Input
                value={draft.link_url}
                onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                placeholder="Website URL"
              />
              <Select
                value={draft.tier}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
                <input
                  type="checkbox"
                  checked={draft.is_header_sponsor}
                  onChange={(e) => setDraft({ ...draft, is_header_sponsor: e.target.checked })}
                  className="rounded"
                />
                Header sponsor
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={addSponsor}>
              Add
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Sponsor
        </Button>
      )}
    </div>
  )
}
