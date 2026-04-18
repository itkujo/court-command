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

interface TeamSummary {
  id: number
  name: string
  short_name?: string
  primary_color?: string | null
  logo_url?: string | null
}

interface BracketMatch {
  id: number
  public_id?: string
  round?: number | null
  round_name?: string | null
  match_number?: number | null
  team_1_id?: number | null
  team_2_id?: number | null
  team_1?: TeamSummary | null
  team_2?: TeamSummary | null
  team_1_seed?: number | null
  team_2_seed?: number | null
  winner_team_id?: number | null
  team_1_score?: number | null
  team_2_score?: number | null
  status: string
  next_match_id?: number | null
  next_match_slot?: number | null
}

function formatBracket(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Map total round count + current round index to a readable label. */
function getRoundLabel(
  round: number,
  totalRounds: number,
  roundName?: string | null,
): string {
  if (roundName) return roundName

  const remaining = totalRounds - round
  if (remaining === 0) return 'Finals'
  if (remaining === 1) return 'Semifinals'
  if (remaining === 2) return 'Quarterfinals'
  return `Round ${round}`
}

function teamDisplayName(
  team: TeamSummary | null | undefined,
  teamId: number | null | undefined,
  seed: number | null | undefined,
): string {
  const seedStr = seed != null ? `(${seed}) ` : ''
  if (team?.short_name) return `${seedStr}${team.short_name}`
  if (team?.name) return `${seedStr}${team.name}`
  if (teamId) return `${seedStr}Team #${teamId}`
  return 'TBD'
}

function MatchCard({
  match,
  isLastRound,
}: {
  match: BracketMatch
  isLastRound: boolean
}) {
  const winner = match.winner_team_id
  const isComplete = match.status === 'completed'
  const canScore =
    !!match.public_id &&
    (match.status === 'scheduled' || match.status === 'in_progress')

  const team1Won = isComplete && winner === match.team_1_id
  const team2Won = isComplete && winner === match.team_2_id

  return (
    <div className="bracket-match relative rounded-lg border border-(--color-border) bg-(--color-bg-primary) min-w-[200px] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-(--color-border) bg-(--color-bg-secondary) rounded-t-lg">
        <span className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-wider">
          {match.match_number != null ? `M${match.match_number}` : ''}
        </span>
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
        {isComplete && isLastRound && (
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
        )}
      </div>

      {/* Team 1 */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
          team1Won
            ? 'bg-(--color-accent)/8 font-semibold text-(--color-text-primary)'
            : team2Won
              ? 'text-(--color-text-muted)'
              : 'text-(--color-text-secondary)'
        }`}
      >
        <span className="truncate max-w-[140px]">
          {teamDisplayName(match.team_1, match.team_1_id, match.team_1_seed)}
        </span>
        <span className="ml-2 tabular-nums font-medium">
          {match.team_1_score != null ? match.team_1_score : ''}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-(--color-border)" />

      {/* Team 2 */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-sm rounded-b-lg transition-colors ${
          team2Won
            ? 'bg-(--color-accent)/8 font-semibold text-(--color-text-primary)'
            : team1Won
              ? 'text-(--color-text-muted)'
              : 'text-(--color-text-secondary)'
        }`}
      >
        <span className="truncate max-w-[140px]">
          {teamDisplayName(match.team_2, match.team_2_id, match.team_2_seed)}
        </span>
        <span className="ml-2 tabular-nums font-medium">
          {match.team_2_score != null ? match.team_2_score : ''}
        </span>
      </div>
    </div>
  )
}

/**
 * SVG connector lines between adjacent bracket rounds.
 * Draws horizontal + vertical lines from each pair of source matches
 * converging into a single destination match.
 */
function BracketConnectors({
  sourceCount,
  matchHeight,
  gap,
}: {
  sourceCount: number
  matchHeight: number
  gap: number
}) {
  const pairCount = Math.ceil(sourceCount / 2)
  const step = matchHeight + gap
  const svgWidth = 32
  const connectors: React.ReactNode[] = []

  for (let i = 0; i < pairCount; i++) {
    const topIdx = i * 2
    const botIdx = i * 2 + 1
    if (botIdx >= sourceCount) break

    const topY = topIdx * step + matchHeight / 2
    const botY = botIdx * step + matchHeight / 2
    const midY = (topY + botY) / 2

    connectors.push(
      <g key={i}>
        {/* horizontal from top match */}
        <line
          x1={0}
          y1={topY}
          x2={svgWidth / 2}
          y2={topY}
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
        {/* horizontal from bottom match */}
        <line
          x1={0}
          y1={botY}
          x2={svgWidth / 2}
          y2={botY}
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
        {/* vertical connecting the two */}
        <line
          x1={svgWidth / 2}
          y1={topY}
          x2={svgWidth / 2}
          y2={botY}
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
        {/* horizontal out to next round */}
        <line
          x1={svgWidth / 2}
          y1={midY}
          x2={svgWidth}
          y2={midY}
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
      </g>,
    )
  }

  const totalHeight = sourceCount * step - gap
  return (
    <svg
      width={svgWidth}
      height={totalHeight}
      className="flex-shrink-0 self-start"
      style={{ marginTop: 0 }}
    >
      {connectors}
    </svg>
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
    const r = m.round ?? 1
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(m)
  }
  const roundKeys = Object.keys(rounds)
    .map((k) => Number(k))
    .sort((a, b) => a - b)

  const totalRounds = roundKeys.length

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
              <MatchCard key={m.id} match={m} isLastRound={false} />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // Elimination bracket layout
  const MATCH_HEIGHT = 76 // px per match card (approx)
  const MATCH_GAP = 12 // gap between match cards in a column

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-(--color-text-primary)">
          {formatBracket(division.bracket_format)} · {matches.length} matches
        </h2>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start min-w-max">
          {roundKeys.map((round, roundIdx) => {
            const roundMatches = rounds[round].sort(
              (a, b) => (a.match_number ?? 0) - (b.match_number ?? 0),
            )
            const isLast = roundIdx === roundKeys.length - 1
            const showConnectors = !isLast && roundMatches.length > 1

            return (
              <div key={round} className="flex items-start">
                {/* Round column */}
                <div className="flex flex-col">
                  <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3 px-1">
                    {getRoundLabel(round, totalRounds, rounds[round][0]?.round_name)}
                  </h3>
                  <div
                    className="flex flex-col justify-around"
                    style={{
                      gap: `${MATCH_GAP}px`,
                      // Each subsequent round needs more vertical spacing
                      // to center-align with the parent round's pairs
                      minHeight:
                        roundIdx === 0
                          ? undefined
                          : `${rounds[roundKeys[0]].length * (MATCH_HEIGHT + MATCH_GAP) - MATCH_GAP}px`,
                    }}
                  >
                    {roundMatches.map((m) => (
                      <MatchCard key={m.id} match={m} isLastRound={isLast} />
                    ))}
                  </div>
                </div>

                {/* Connector lines */}
                {showConnectors && (
                  <div
                    className="flex items-start"
                    style={{
                      paddingTop: '28px', // offset for round label height
                    }}
                  >
                    <BracketConnectors
                      sourceCount={roundMatches.length}
                      matchHeight={MATCH_HEIGHT}
                      gap={MATCH_GAP}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
