import { Link } from '@tanstack/react-router'
import {
  useGenerateBracket,
  useListBracketMatches,
  type Division,
} from './hooks'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Skeleton } from '../../components/Skeleton'
import { Trophy } from 'lucide-react'

interface DivisionBracketProps {
  division: Division
  divisionId: string
}

interface BracketMatch {
  id: number
  public_id?: string
  round: number
  match_number: number
  team1_id: number | null
  team2_id: number | null
  team1_seed?: number | null
  team2_seed?: number | null
  winner_team_id: number | null
  status: string
  score_team1?: number | null
  score_team2?: number | null
}

function formatBracket(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function MatchCard({ match }: { match: BracketMatch }) {
  const winner = match.winner_team_id
  const canScore =
    !!match.public_id &&
    (match.status === 'scheduled' || match.status === 'in_progress')
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-bg-primary) p-2 min-w-[180px]">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-(--color-text-secondary)">
          R{match.round} · M{match.match_number}
        </div>
        {canScore && match.public_id && (
          <Link
            to="/ref/matches/$publicId"
            params={{ publicId: match.public_id }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="primary" size="sm">
              Score
            </Button>
          </Link>
        )}
      </div>
      <div
        className={`flex items-center justify-between text-sm py-1 ${
          winner === match.team1_id
            ? 'font-semibold text-(--color-text-primary)'
            : 'text-(--color-text-secondary)'
        }`}
      >
        <span>
          {match.team1_seed != null && `(${match.team1_seed}) `}
          {match.team1_id ? `Team #${match.team1_id}` : 'TBD'}
        </span>
        {match.score_team1 != null && <span>{match.score_team1}</span>}
      </div>
      <div className="border-t border-(--color-border) my-1" />
      <div
        className={`flex items-center justify-between text-sm py-1 ${
          winner === match.team2_id
            ? 'font-semibold text-(--color-text-primary)'
            : 'text-(--color-text-secondary)'
        }`}
      >
        <span>
          {match.team2_seed != null && `(${match.team2_seed}) `}
          {match.team2_id ? `Team #${match.team2_id}` : 'TBD'}
        </span>
        {match.score_team2 != null && <span>{match.score_team2}</span>}
      </div>
    </div>
  )
}

export function DivisionBracket({
  division,
  divisionId,
}: DivisionBracketProps) {
  const { toast } = useToast()
  const generateMutation = useGenerateBracket(divisionId)
  const { data, isLoading } = useListBracketMatches(divisionId)
  const matches = (data as BracketMatch[] | undefined) ?? []

  async function handleGenerate() {
    try {
      await generateMutation.mutateAsync()
      toast('success', 'Bracket generated')
    } catch (err) {
      toast('error', (err as Error).message)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  // Group matches by round
  const rounds: Record<number, BracketMatch[]> = {}
  for (const m of matches) {
    if (!rounds[m.round]) rounds[m.round] = []
    rounds[m.round].push(m)
  }
  const roundKeys = Object.keys(rounds)
    .map((k) => Number(k))
    .sort((a, b) => a - b)

  const isRoundRobin =
    division.bracket_format === 'round_robin' ||
    division.bracket_format === 'pool_play'

  if (matches.length === 0) {
    return (
      <div>
        <Card>
          <div className="flex flex-col items-center text-center py-8">
            <Trophy className="h-12 w-12 text-(--color-text-secondary) mb-3" />
            <h2 className="text-lg font-semibold text-(--color-text-primary) mb-2">
              No bracket generated yet
            </h2>
            <p className="text-sm text-(--color-text-secondary) mb-4 max-w-md">
              Format: {formatBracket(division.bracket_format)}
              {division.max_teams && ` · Up to ${division.max_teams} teams`}
            </p>
            <Button
              onClick={handleGenerate}
              loading={generateMutation.isPending}
            >
              Generate Bracket
            </Button>
            <p className="text-xs text-(--color-text-secondary) mt-3">
              Lock seeds before generating. Once generated, match structure
              cannot be edited.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (isRoundRobin) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--color-text-primary)">
            {formatBracket(division.bracket_format)} · {matches.length} matches
          </h2>
        </div>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">
          {formatBracket(division.bracket_format)} · {matches.length} matches
        </h2>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          {roundKeys.map((round) => (
            <div key={round} className="flex flex-col gap-4">
              <h3 className="text-sm font-medium text-(--color-text-secondary) uppercase tracking-wider">
                Round {round}
              </h3>
              <div className="flex flex-col gap-3">
                {rounds[round]
                  .sort((a, b) => a.match_number - b.match_number)
                  .map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
