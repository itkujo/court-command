import { useMemo } from 'react'

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'iframe',
])

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
  'class', 'style', 'colspan', 'rowspan',
])

function sanitizeHtml(html: string): string {
  // Basic tag allowlist — strips disallowed tags, keeps allowed ones
  return html
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
      if (!ALLOWED_TAGS.has(tag.toLowerCase())) return ''
      // Strip disallowed attributes
      return match.replace(/\s([a-zA-Z-]+)="[^"]*"/g, (attrMatch, attr) => {
        if (!ALLOWED_ATTRS.has(attr.toLowerCase())) return ''
        return attrMatch
      })
    })
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
}

interface RichTextDisplayProps {
  html: string | null | undefined
  className?: string
}

export function RichTextDisplay({ html, className }: RichTextDisplayProps) {
  const sanitized = useMemo(() => (html ? sanitizeHtml(html) : ''), [html])
  if (!sanitized) return null
  return (
    <div
      className={className ?? 'prose prose-sm max-w-none text-(--color-text-primary)'}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
