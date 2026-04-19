import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from './Input'
import { FormField } from './FormField'
import { loadGoogleMaps } from '../lib/google-maps'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

export interface AddressData {
  formatted_address: string
  city: string
  state_province: string
  country: string
  postal_code: string
  address_line_1: string
  address_line_2: string
  latitude: number | null
  longitude: number | null
}

export const EMPTY_ADDRESS: AddressData = {
  formatted_address: '',
  city: '',
  state_province: '',
  country: '',
  postal_code: '',
  address_line_1: '',
  address_line_2: '',
  latitude: null,
  longitude: null,
}

interface AddressInputProps {
  value: Partial<AddressData>
  onChange: (address: AddressData) => void
  label?: string
  required?: boolean
}

function parsePlace(place: any): AddressData {
  const result: AddressData = { ...EMPTY_ADDRESS }
  const components = place.address_components || []

  for (const comp of components) {
    const types: string[] = comp.types
    if (types.includes('street_number')) {
      result.address_line_1 =
        comp.long_name + (result.address_line_1 ? ' ' + result.address_line_1 : '')
    } else if (types.includes('route')) {
      result.address_line_1 =
        (result.address_line_1 || '') + (result.address_line_1 ? ' ' : '') + comp.long_name
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

  // Use Google's formatted_address as the display string
  result.formatted_address = place.formatted_address || ''

  // For business/establishment results, prepend the business name
  if (place.name && result.formatted_address && !result.formatted_address.startsWith(place.name)) {
    result.formatted_address = `${place.name}, ${result.formatted_address}`
  }

  // Fallback: if no street address was parsed but a business name exists
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
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState(false)

  const current: AddressData = { ...EMPTY_ADDRESS, ...value }

  // Track the search input text separately from the committed formatted_address
  const [searchText, setSearchText] = useState(current.formatted_address || '')

  // Sync searchText when the external value changes (e.g. editing an existing entity)
  const lastFormattedRef = useRef(current.formatted_address)
  useEffect(() => {
    if (current.formatted_address !== lastFormattedRef.current) {
      setSearchText(current.formatted_address || '')
      lastFormattedRef.current = current.formatted_address
    }
  }, [current.formatted_address])

  const handleClear = useCallback(() => {
    setSearchText('')
    onChange({ ...EMPTY_ADDRESS })
    // Re-focus the input so user can type a new address
    inputRef.current?.focus()
  }, [onChange])

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsLoaded(true))
      .catch(() => setMapsError(true))
  }, [])

  // Initialize autocomplete
  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return

      const parsed = parsePlace(place)
      setSearchText(parsed.formatted_address)
      lastFormattedRef.current = parsed.formatted_address
      onChange(parsed)
    })

    autocompleteRef.current = autocomplete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded])

  const hasAddress = !!current.formatted_address

  return (
    <fieldset className="space-y-3">
      {label && (
        <legend className="text-sm font-medium text-(--color-text-primary) mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </legend>
      )}

      <FormField label="Search Address">
        <div className="relative">
          <Input
            ref={inputRef}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={
              mapsLoaded
                ? 'Start typing an address or venue name...'
                : mapsError
                  ? 'Enter address manually'
                  : 'Loading address search...'
            }
          />
          {hasAddress && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text-primary) text-sm px-1"
              aria-label="Clear address"
            >
              &times;
            </button>
          )}
        </div>
        {mapsLoaded && !hasAddress && (
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Powered by Google — select a suggestion to set the address
          </p>
        )}
      </FormField>

      {hasAddress && (
        <div className="rounded-md border border-(--color-border) bg-(--color-bg-secondary) px-3 py-2 text-sm text-(--color-text-secondary)">
          {current.formatted_address}
          {(current.latitude != null && current.longitude != null) && (
            <span className="ml-2 text-xs text-(--color-text-muted)">
              ({current.latitude.toFixed(4)}, {current.longitude.toFixed(4)})
            </span>
          )}
        </div>
      )}
    </fieldset>
  )
}
