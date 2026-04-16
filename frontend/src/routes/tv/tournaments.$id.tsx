import { createFileRoute } from '@tanstack/react-router'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { TVKioskBracket } from '../../features/overlay/tv/TVKioskBracket'

interface KioskSearch {
  cycle?: number
}

export const Route = createFileRoute('/tv/tournaments/$id')({
  validateSearch: (search: Record<string, unknown>): KioskSearch => {
    const raw = search.cycle
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0)
      return { cycle: Math.floor(raw) }
    if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10)
      if (Number.isFinite(parsed) && parsed > 0) return { cycle: parsed }
    }
    return {}
  },
  component: KioskTournamentRoute,
})

function KioskTournamentRoute() {
  const { id } = Route.useParams()
  const { cycle } = Route.useSearch()
  // Venue signage must stay silent on error — a crash panel on a 65"
  // TV is worse than a blank screen.
  return (
    <ErrorBoundary fallback={null}>
      <TVKioskBracket tournamentID={id} cycleSeconds={cycle ?? 20} />
    </ErrorBoundary>
  )
}
