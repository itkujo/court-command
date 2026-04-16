import { useEffect } from 'react'

const BASE_TITLE = 'Court Command'

/**
 * Sets `document.title` for the current page.
 * Pass a page-specific title (e.g. "Tournaments") and it will render as
 * "Tournaments — Court Command". Pass `null` or empty string for the
 * homepage default.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title
      ? `${title} \u2014 ${BASE_TITLE}`
      : `${BASE_TITLE} \u2014 Pickleball Tournament & League Management`
  }, [title])
}
