import type { ReactNode } from 'react'

interface InfoRowProps {
  label: string
  value: ReactNode | string | null | undefined
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <dt className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-(--color-text-primary)">{value || '\u2014'}</dd>
    </div>
  )
}
