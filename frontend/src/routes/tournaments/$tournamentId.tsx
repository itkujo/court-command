import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tournaments/$tournamentId')({
  component: TournamentDetailPage,
})

function TournamentDetailPage() {
  const { tournamentId } = Route.useParams()
  return (
    <div>
      <h1 className="text-2xl font-bold text-(--color-text-primary)">
        Tournament #{tournamentId}
      </h1>
      <p className="text-sm text-(--color-text-secondary) mt-2">
        Tournament detail page coming soon.
      </p>
    </div>
  )
}
