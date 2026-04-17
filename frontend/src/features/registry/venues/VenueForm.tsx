import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateVenue, useUpdateVenue, type Venue } from './hooks'
import { useToast } from '../../../components/Toast'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { US_STATES, US_TIMEZONES } from '../../../lib/constants'
import { Textarea } from '../../../components/Textarea'
import { FormField } from '../../../components/FormField'
import { ImageUpload } from '../../../components/ImageUpload'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface VenueFormProps {
  venue?: Venue
}

export function VenueForm({ venue }: VenueFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createVenue = useCreateVenue()
  const updateVenue = useUpdateVenue(venue ? String(venue.id) : '')

  const isEditing = !!venue

  const [name, setName] = useState(venue?.name ?? '')
  const [addressLine1, setAddressLine1] = useState(venue?.address_line_1 ?? '')
  const [city, setCity] = useState(venue?.city ?? '')
  const [stateProvince, setStateProvince] = useState(venue?.state_province ?? '')
  const [country, setCountry] = useState(venue?.country ?? '')
  const [postalCode, setPostalCode] = useState(venue?.postal_code ?? '')
  const [timezone, setTimezone] = useState(venue?.timezone ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(venue?.website_url ?? '')
  const [contactEmail, setContactEmail] = useState(venue?.contact_email ?? '')
  const [bio, setBio] = useState(venue?.bio ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(venue?.logo_url ?? null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(venue?.photo_url ?? null)
  const [mapUrl, setMapUrl] = useState<string | null>(venue?.venue_map_url ?? null)

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (contactEmail && !contactEmail.includes('@')) errs.contact_email = 'Enter a valid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      name: name.trim(),
      address_line_1: addressLine1.trim() || null,
      city: city.trim() || null,
      state_province: stateProvince.trim() || null,
      country: country.trim() || null,
      postal_code: postalCode.trim() || null,
      timezone: timezone.trim() || null,
      website_url: websiteUrl.trim() || null,
      contact_email: contactEmail.trim() || null,
      bio: bio.trim() || null,
      logo_url: logoUrl,
      photo_url: photoUrl,
      venue_map_url: mapUrl,
    }

    const mutation = isEditing ? updateVenue : createVenue

    mutation.mutate(payload, {
      onSuccess: (data) => {
        toast('success', isEditing ? 'Venue updated' : 'Venue created')
        navigate({ to: '/venues/$venueId', params: { venueId: String(data.id) } })
      },
      onError: (err) => toast('error', (err as Error).message),
    })
  }

  return (
    <div>
      <Link
        to="/venues"
        className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Venues
      </Link>

      <h1 className="text-2xl font-bold text-(--color-text-primary) mb-6">
        {isEditing ? 'Edit Venue' : 'Create Venue'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <FormField label="Name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Venue name"
            error={!!errors.name}
          />
        </FormField>

        <FormField label="Address" htmlFor="address_line_1">
          <Input
            id="address_line_1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="123 Main St"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" htmlFor="city">
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </FormField>

          <FormField label="State / Province" htmlFor="state_province">
            <Select
              id="state_province"
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
            >
              <option value="">Select state...</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Country" htmlFor="country">
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="US"
            />
          </FormField>

          <FormField label="Postal Code" htmlFor="postal_code">
            <Input
              id="postal_code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="12345"
            />
          </FormField>
        </div>

        <FormField label="Timezone" htmlFor="timezone">
          <Select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Select timezone...</option>
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </Select>
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

        <FormField label="Contact Email" htmlFor="contact_email" error={errors.contact_email}>
          <Input
            id="contact_email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="info@venue.com"
            error={!!errors.contact_email}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ImageUpload
            value={logoUrl}
            onChange={setLogoUrl}
            label="Venue Logo"
          />
          <ImageUpload
            value={photoUrl}
            onChange={setPhotoUrl}
            label="Venue Photo"
          />
          <ImageUpload
            value={mapUrl}
            onChange={setMapUrl}
            label="Venue Map"
          />
        </div>

        <FormField label="Bio" htmlFor="bio">
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="About the venue..."
            rows={3}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={createVenue.isPending || updateVenue.isPending}>
            {isEditing ? 'Save Changes' : 'Create Venue'}
          </Button>
          <Link to="/venues">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
