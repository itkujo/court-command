import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateLeague } from './hooks'
import type { SponsorEntry } from '../tournaments/hooks'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { FormField } from '../../components/FormField'
import { Card } from '../../components/Card'
import { ImageUpload } from '../../components/ImageUpload'
import { SponsorEditor } from '../../components/SponsorEditor'
import { useToast } from '../../components/Toast'

export function LeagueCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createLeague = useCreateLeague()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [country, setCountry] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [sponsors, setSponsors] = useState<SponsorEntry[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (contactEmail && !contactEmail.includes('@')) {
      e.contactEmail = 'Invalid email'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(status: 'draft' | 'published') {
    if (!validate()) return

    try {
      const league = await createLeague.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        website_url: websiteUrl.trim() || null,
        city: city.trim() || null,
        state_province: stateProvince.trim() || null,
        country: country.trim() || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        sponsor_info: sponsors.length > 0 ? sponsors : null,
        status,
      })
      toast(
        'success',
        status === 'draft' ? 'League saved as draft' : 'League published',
      )
      navigate({ to: '/leagues/$leagueId', params: { leagueId: String(league.id) } })
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to create league')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-(--color-text-primary) mb-6">
        Create League
      </h1>

      <Card>
        <div className="p-6 space-y-5">
          <FormField label="League Name" required error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., North Texas Spring League"
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the league..."
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Contact Email" error={errors.contactEmail}>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@example.com"
              />
            </FormField>
            <FormField label="Contact Phone">
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="555-555-5555"
              />
            </FormField>
          </div>

          <FormField label="Website">
            <Input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="City">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </FormField>
            <FormField label="State/Province">
              <Input
                value={stateProvince}
                onChange={(e) => setStateProvince(e.target.value)}
              />
            </FormField>
            <FormField label="Country">
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              label="League Logo"
            />
            <ImageUpload
              value={bannerUrl}
              onChange={setBannerUrl}
              label="Banner Image"
            />
          </div>

          <FormField label="Sponsors">
            <SponsorEditor value={sponsors} onChange={setSponsors} />
          </FormField>
        </div>

        <div className="px-6 py-4 bg-(--color-bg-primary) border-t border-(--color-border) flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate({ to: '/leagues' })}
            disabled={createLeague.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit('draft')}
            disabled={createLeague.isPending}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit('published')}
            disabled={createLeague.isPending}
          >
            {createLeague.isPending ? 'Creating...' : 'Create & Publish'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
