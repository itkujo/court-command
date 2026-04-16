// frontend/src/features/matches/MatchScoreboardPage.tsx
import { useEffect } from 'react'
import { ScoreCall } from '../scoring/ScoreCall'
import { GameHistoryBar } from '../scoring/GameHistoryBar'
import { ServeIndicator } from '../scoring/ServeIndicator'
import { useMatch } from '../scoring/hooks'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'
import type { Match } from '../scoring/types'

export interface MatchScoreboardPageProps {
  publicId: string
}

export function MatchScoreboardPage({ publicId }: MatchScoreboardPageProps) {
  useMatchWebSocket(publicId)
  const matchQuery = useMatch(publicId)

  // Make body transparent so OBS / TV embeds can chroma-free overlay
  // the scoreboard card on top of any background.
  useEffect(() => {
    const prevBody = document.body.style.background
    const prevHtml = document.documentElement.style.background
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return () => {
      document.body.style.background = prevBody
      document.documentElement.style.background = prevHtml
    }
  }, [])

  if (matchQuery.isLoading) {
    return null // Render nothing while loading on a TV display
  }
  if (matchQuery.isError || !matchQuery.data) {
    return null
  }

  const match = matchQuery.data

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="bg-black/80 text-white rounded-2xl p-6 md:p-10 backdrop-blur shadow-2xl max-w-3xl w-full">
        <div className="text-center text-xs uppercase tracking-widest text-white/60 mb-2">
          {match.tournament_name ?? 'Match'}
          {match.division_name ? ` · ${match.division_name}` : ''}
          {match.court_name ? ` · ${match.court_name}` : ''}
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <TeamSide team={1} match={match} />
          <div className="text-center">
            <div className="text-7xl md:text-8xl font-extrabold tabular-nums">
              {match.team_1_score} – {match.team_2_score}
            </div>
            <div className="text-sm text-white/70 mt-1">
              Game {match.current_game} of {match.best_of}
            </div>
          </div>
          <TeamSide team={2} match={match} />
        </div>

        <div className="mt-4 flex justify-center">
          <GameHistoryBar
            completedGames={match.completed_games}
            bestOf={match.best_of}
          />
        </div>

        <div className="mt-3 flex justify-center">
          <ScoreCall match={match} />
        </div>
      </div>
    </div>
  )
}

function TeamSide({ team, match }: { team: 1 | 2; match: Match }) {
  const t = team === 1 ? match.team_1 : match.team_2
  const serving = match.serving_team === team
  return (
    <div className={team === 1 ? 'text-right' : 'text-left'}>
      <div className="text-xs uppercase text-white/60">Team {team}</div>
      <div
        className={
          team === 1
            ? 'text-2xl md:text-3xl font-bold flex items-center gap-2 justify-end'
            : 'text-2xl md:text-3xl font-bold flex items-center gap-2 justify-start'
        }
      >
        {team === 2 && (
          <ServeIndicator
            active={serving}
            serverNumber={serving ? (match.server_number ?? 1) : null}
            size="lg"
          />
        )}
        <span>{t?.name ?? `Team ${team}`}</span>
        {team === 1 && (
          <ServeIndicator
            active={serving}
            serverNumber={serving ? (match.server_number ?? 1) : null}
            size="lg"
          />
        )}
      </div>
    </div>
  )
}
