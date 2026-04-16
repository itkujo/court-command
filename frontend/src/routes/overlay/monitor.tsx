import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
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
  // Dashboard surface: default panel fallback is fine — operators see
  // the reset/reload affordance and recover in-tab.
  return (
    <ErrorBoundary>
      <ProducerMonitor
        tournamentID={tournament ?? null}
        onTournamentChange={(id) =>
          navigate({
            to: '/overlay/monitor',
            search: id ? { tournament: id } : {},
          })
        }
      />
    </ErrorBoundary>
  )
}
