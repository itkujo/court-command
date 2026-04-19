/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiGet } from './api'

declare global {
  interface Window {
    google?: any
  }
}

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script'

let loadPromise: Promise<void> | null = null

/**
 * Fetch the Google Maps API key from the backend settings.
 * Falls back to the build-time env var if the API call fails.
 */
async function getApiKey(): Promise<string> {
  try {
    const config = await apiGet<Record<string, string>>('/api/v1/settings/google-maps')
    if (config.google_maps_api_key) {
      return config.google_maps_api_key
    }
  } catch {
    // Fall back to build-time env var
  }

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (envKey) return envKey

  throw new Error('Google Maps API key not configured')
}

/**
 * Load the Google Maps JavaScript SDK (shared across components).
 * Returns immediately if already loaded. Deduplicates concurrent calls.
 */
export function loadGoogleMaps(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve()
      return
    }

    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      const check = setInterval(() => {
        if (window.google?.maps) {
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

    getApiKey()
      .then((apiKey) => {
        const script = document.createElement('script')
        script.id = GOOGLE_MAPS_SCRIPT_ID
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = () => setTimeout(() => resolve(), 100)
        script.onerror = () => reject(new Error('Failed to load Google Maps'))
        document.head.appendChild(script)
      })
      .catch(reject)
  })

  return loadPromise
}
