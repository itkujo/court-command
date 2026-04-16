import { ClipboardList } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDate } from '../../lib/formatters'
import type { ActiveRegistration } from './hooks'

interface Props {
  data: ActiveRegistration[]
}

export function ActiveRegistrations({ data }: Props) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="No active registrations"
        description="Register for a tournament to see your entries here."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--color-border) text-left">
            <th className="pb-2 pr-4 text-xs font-medium text-(--color-text-muted) uppercase tracking-wider">
              Tournament
            </th>
            <th className="pb-2 pr-4 text-xs font-medium text-(--color-text-muted) uppercase tracking-wider">
              Division
            </th>
            <th className="pb-2 pr-4 text-xs font-medium text-(--color-text-muted) uppercase tracking-wider">
              Status
            </th>
            <th className="pb-2 text-xs font-medium text-(--color-text-muted) uppercase tracking-wider">
              Registered
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((reg) => (
            <tr
              key={reg.id}
              className="border-b border-(--color-border) last:border-0"
            >
              <td className="py-3 pr-4 font-medium text-(--color-text-primary)">
                {reg.tournament_name}
              </td>
              <td className="py-3 pr-4 text-(--color-text-muted)">
                {reg.division_name}
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={reg.status} />
              </td>
              <td className="py-3 text-(--color-text-muted)">
                {formatDate(reg.registered_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
