import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ProducerMonitor } from '../../features/overlay/monitor/ProducerMonitor'

interface MonitorSearch {
  tournament?: number
}

export const Route = createFileRoute('/overlay/monitor')({
  validateSearch: (search: Record<string, unknown>): MonitorSearch => {
    const raw = search.tournament
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.length > 0
          ? Number(raw)
          : undefined
    return { tournament: Number.isFinite(n) ? (n as number) : undefined }
  },
  component: MonitorRoute,
})

function MonitorRoute() {
  const navigate = useNavigate()
  const { tournament } = Route.useSearch()
  return (
    <ProducerMonitor
      tournamentID={tournament ?? null}
      onTournamentChange={(id) =>
        navigate({
          to: '/overlay/monitor',
          search: id ? { tournament: id } : {},
        })
      }
    />
  )
}
