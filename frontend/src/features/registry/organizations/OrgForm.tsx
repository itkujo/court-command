import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateOrg, useUpdateOrg, type Organization } from './hooks'
import { useToast } from '../../../components/Toast'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { Textarea } from '../../../components/Textarea'
import { FormField } from '../../../components/FormField'
import { ImageUpload } from '../../../components/ImageUpload'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface OrgFormProps {
  org?: Organization
}

export function OrgForm({ org }: OrgFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createOrg = useCreateOrg()
  const updateOrg = useUpdateOrg(org ? String(org.id) : '')

  const isEditing = !!org

  const [name, setName] = useState(org?.name ?? '')
  const [contactEmail, setContactEmail] = useState(org?.contact_email ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(org?.website_url ?? '')
  const [city, setCity] = useState(org?.city ?? '')
  const [stateProvince, setStateProvince] = useState(org?.state_province ?? '')
  const [country, setCountry] = useState(org?.country ?? '')
  const [foundedYear, setFoundedYear] = useState(
    org?.founded_year ? String(org.founded_year) : '',
  )
  const [bio, setBio] = useState(org?.bio ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(org?.logo_url ?? null)

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (contactEmail && !contactEmail.includes('@')) errs.contact_email = 'Enter a valid email'
    if (foundedYear && (isNaN(Number(foundedYear)) || Number(foundedYear) < 1900))
      errs.founded_year = 'Enter a valid year'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      name: name.trim(),
      contact_email: contactEmail.trim() || null,
      website_url: websiteUrl.trim() || null,
      city: city.trim() || null,
      state_province: stateProvince.trim() || null,
      country: country.trim() || null,
      founded_year: foundedYear ? Number(foundedYear) : null,
      bio: bio.trim() || null,
      logo_url: logoUrl,
    }

    const mutation = isEditing ? updateOrg : createOrg

    mutation.mutate(payload, {
      onSuccess: (data) => {
        toast('success', isEditing ? 'Organization updated' : 'Organization created')
        navigate({ to: '/organizations/$orgId', params: { orgId: String(data.id) } })
      },
      onError: (err) => toast('error', (err as Error).message),
    })
  }

  return (
    <div>
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Organizations
      </Link>

      <h1 className="text-2xl font-bold text-(--color-text-primary) mb-6">
        {isEditing ? 'Edit Organization' : 'Create Organization'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <FormField label="Name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            error={!!errors.name}
          />
        </FormField>

        <FormField label="Contact Email" htmlFor="contact_email" error={errors.contact_email}>
          <Input
            id="contact_email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="contact@example.org"
            error={!!errors.contact_email}
          />
        </FormField>

        <FormField label="Website URL" htmlFor="website_url">
          <Input
            id="website_url"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="City" htmlFor="city">
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </FormField>

          <FormField label="State / Province" htmlFor="state_province">
            <Input
              id="state_province"
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
              placeholder="State"
            />
          </FormField>

          <FormField label="Country" htmlFor="country">
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="US"
            />
          </FormField>
        </div>

        <FormField label="Founded Year" htmlFor="founded_year" error={errors.founded_year}>
          <Input
            id="founded_year"
            type="number"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            placeholder="2024"
            min={1900}
            max={2100}
            error={!!errors.founded_year}
          />
        </FormField>

        <ImageUpload
          value={logoUrl}
          onChange={setLogoUrl}
          label="Organization Logo"
        />

        <FormField label="Bio" htmlFor="bio">
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="About the organization..."
            rows={3}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={createOrg.isPending || updateOrg.isPending}>
            {isEditing ? 'Save Changes' : 'Create Organization'}
          </Button>
          <Link to="/organizations">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
