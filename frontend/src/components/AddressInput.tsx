import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from './Input'
import { Select } from './Select'
import { FormField } from './FormField'
import { US_STATES } from '../lib/constants'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
    initGoogleMaps?: () => void
  }
}

export interface AddressData {
  address_line_1: string
  address_line_2: string
  city: string
  state_province: string
  country: string
  postal_code: string
  latitude: number | null
  longitude: number | null
}

const EMPTY_ADDRESS: AddressData = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state_province: '',
  country: '',
  postal_code: '',
  latitude: null,
  longitude: null,
}

interface AddressInputProps {
  value: Partial<AddressData>
  onChange: (address: AddressData) => void
  label?: string
  required?: boolean
  /** Hide street address fields (for entities that only need city/state/country) */
  compact?: boolean
}

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script'

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve()
      return
    }

    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      // Script is loading — wait for it
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(check)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(check)
        reject(new Error('Google Maps script load timeout'))
      }, 10000)
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY not set'))
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      // Small delay for Places library initialization
      setTimeout(() => resolve(), 100)
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

function parsePlace(place: any): Partial<AddressData> {
  const result: Partial<AddressData> = {}
  const components = place.address_components || []

  for (const comp of components) {
    const types = comp.types
    if (types.includes('street_number')) {
      result.address_line_1 = comp.long_name + (result.address_line_1 ? ' ' + result.address_line_1 : '')
    } else if (types.includes('route')) {
      result.address_line_1 = (result.address_line_1 || '') + (result.address_line_1 ? ' ' : '') + comp.long_name
    } else if (types.includes('locality') || types.includes('sublocality_level_1')) {
      result.city = comp.long_name
    } else if (types.includes('administrative_area_level_1')) {
      result.state_province = comp.short_name
    } else if (types.includes('country')) {
      result.country = comp.short_name
    } else if (types.includes('postal_code')) {
      result.postal_code = comp.long_name
    }
  }

  if (place.geometry?.location) {
    result.latitude = place.geometry.location.lat()
    result.longitude = place.geometry.location.lng()
  }

  // For business/establishment results, if no street address was parsed
  // but a business name exists, use the formatted address from Google
  if (!result.address_line_1 && place.name) {
    result.address_line_1 = place.name
  }

  return result
}

export function AddressInput({
  value,
  onChange,
  label = 'Address',
  required = false,
  compact = false,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState(false)

  const current: AddressData = { ...EMPTY_ADDRESS, ...value }

  const handleChange = useCallback(
    (field: keyof AddressData, val: string) => {
      onChange({ ...current, [field]: val || '' })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, JSON.stringify(current)]
  )

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapsLoaded(true))
      .catch(() => setMapsError(true))
  }, [])

  // Initialize autocomplete
  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['address_components', 'geometry', 'name'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return

      const parsed = parsePlace(place)
      onChange({
        ...current,
        address_line_1: parsed.address_line_1 || current.address_line_1,
        city: parsed.city || current.city,
        state_province: parsed.state_province || current.state_province,
        country: parsed.country || current.country,
        postal_code: parsed.postal_code || current.postal_code,
        latitude: parsed.latitude ?? current.latitude,
        longitude: parsed.longitude ?? current.longitude,
        address_line_2: current.address_line_2,
      })
    })

    autocompleteRef.current = autocomplete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded])

  return (
    <fieldset className="space-y-3">
      {label && (
        <legend className="text-sm font-medium text-(--color-text-primary) mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </legend>
      )}

      {!compact && (
        <>
          <FormField label="Street Address">
            <Input
              ref={inputRef}
              value={current.address_line_1}
              onChange={(e) => handleChange('address_line_1', e.target.value)}
              placeholder={
                mapsLoaded
                  ? 'Start typing to search...'
                  : mapsError
                    ? 'Enter street address'
                    : 'Loading address search...'
              }
            />
            {mapsLoaded && (
              <p className="mt-1 text-xs text-(--color-text-muted)">
                Powered by Google — select a suggestion to auto-fill all fields
              </p>
            )}
          </FormField>

          <FormField label="Address Line 2">
            <Input
              value={current.address_line_2}
              onChange={(e) => handleChange('address_line_2', e.target.value)}
              placeholder="Apt, Suite, Unit, etc."
            />
          </FormField>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="City">
          <Input
            value={current.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="City"
          />
        </FormField>

        <FormField label="State / Province">
          {current.country === 'US' || !current.country ? (
            <Select
              value={current.state_province}
              onChange={(e) => handleChange('state_province', e.target.value)}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={current.state_province}
              onChange={(e) => handleChange('state_province', e.target.value)}
              placeholder="State / Province"
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Country">
          <Input
            value={current.country}
            onChange={(e) => handleChange('country', e.target.value)}
            placeholder="US"
          />
        </FormField>

        {!compact && (
          <FormField label="Postal Code">
            <Input
              value={current.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder="Postal code"
            />
          </FormField>
        )}
      </div>
    </fieldset>
  )
}
