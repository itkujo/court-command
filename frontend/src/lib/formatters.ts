export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '\u2014'
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '\u2014'
  }
}

export function formatPlayerName(
  firstName: string,
  lastName: string,
  displayName?: string | null,
): string {
  if (displayName) return displayName
  return `${firstName} ${lastName}`
}

export function getInitials(name: string): string {
  if (!name.trim()) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}
