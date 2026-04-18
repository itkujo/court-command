/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script'

let loadPromise: Promise<void> | null = null

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
    script.onload = () => setTimeout(() => resolve(), 100)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}
