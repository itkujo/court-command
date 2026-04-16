// frontend/src/features/scoring/MatchSetup.tsx
import { useState } from 'react'
import { Button } from '../../components/Button'
import { FormField } from '../../components/FormField'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import type { Match } from './types'

export interface MatchSetupProps {
  match: Match
  pending?: boolean
  onBegin: (input: {
    scored_by_name?: string
    first_serving_team: 1 | 2
    first_serving_player_id?: number | null
  }) => void
  onCancel?: () => void
}

export function MatchSetup({
  match,
  pending,
  onBegin,
  onCancel,
}: MatchSetupProps) {
  const [firstServingTeam, setFirstServingTeam] = useState<1 | 2>(1)
  const [scoredByName, setScoredByName] = useState('')
  const [firstServingPlayerId, setFirstServingPlayerId] = useState<string>('')

  const team1Players = match.team_1?.players ?? []
  const team2Players = match.team_2?.players ?? []
  const eligiblePlayers =
    firstServingTeam === 1 ? team1Players : team2Players

  // Reset player when team changes
  function changeTeam(team: 1 | 2) {
    setFirstServingTeam(team)
    setFirstServingPlayerId('')
  }

  return (
    <div className="max-w-md mx-auto w-full flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Match Setup
        </h1>
        {match.division_name ? (
          <p className="text-sm text-(--color-text-secondary)">
            {match.division_name}
            {match.court_name ? ` · ${match.court_name}` : ''}
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded border border-(--color-border) bg-(--color-bg-secondary)">
          <div className="text-xs uppercase text-(--color-text-muted)">
            Team 1
          </div>
          <div className="font-semibold text-(--color-text-primary)">
            {match.team_1?.name ?? 'Team 1'}
          </div>
          {team1Players.length > 0 && (
            <ul className="mt-1 text-xs text-(--color-text-secondary)">
              {team1Players.map((p) => (
                <li key={p.id}>{p.display_name}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-3 rounded border border-(--color-border) bg-(--color-bg-secondary)">
          <div className="text-xs uppercase text-(--color-text-muted)">
            Team 2
          </div>
          <div className="font-semibold text-(--color-text-primary)">
            {match.team_2?.name ?? 'Team 2'}
          </div>
          {team2Players.length > 0 && (
            <ul className="mt-1 text-xs text-(--color-text-secondary)">
              {team2Players.map((p) => (
                <li key={p.id}>{p.display_name}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="text-xs text-(--color-text-secondary) p-3 rounded border border-(--color-border) bg-(--color-bg-secondary)">
        <div>
          Scoring: <strong>{match.scoring_type}</strong>, to{' '}
          <strong>{match.points_to_win}</strong> win by{' '}
          <strong>{match.win_by}</strong>, best of{' '}
          <strong>{match.best_of}</strong>
        </div>
      </section>

      <FormField label="First Serving Team" htmlFor="first-serving-team">
        <Select
          id="first-serving-team"
          value={String(firstServingTeam)}
          onChange={(e) => changeTeam(e.target.value === '2' ? 2 : 1)}
        >
          <option value="1">{match.team_1?.name ?? 'Team 1'}</option>
          <option value="2">{match.team_2?.name ?? 'Team 2'}</option>
        </Select>
      </FormField>

      {eligiblePlayers.length > 0 && (
        <FormField
          label="First Serving Player (optional)"
          htmlFor="first-serving-player"
        >
          <Select
            id="first-serving-player"
            value={firstServingPlayerId}
            onChange={(e) => setFirstServingPlayerId(e.target.value)}
          >
            <option value="">— No specific player —</option>
            {eligiblePlayers.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.display_name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Scored By (optional)" htmlFor="scored-by-name">
        <Input
          id="scored-by-name"
          value={scoredByName}
          onChange={(e) => setScoredByName(e.target.value)}
          placeholder="Your name"
        />
        <p className="mt-1 text-xs text-(--color-text-secondary)">
          Used for audit log when using a shared referee account
        </p>
      </FormField>

      <div className="flex gap-2 mt-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        ) : null}
        <Button
          variant="primary"
          onClick={() =>
            onBegin({
              scored_by_name: scoredByName.trim() || undefined,
              first_serving_team: firstServingTeam,
              first_serving_player_id: firstServingPlayerId
                ? Number(firstServingPlayerId)
                : null,
            })
          }
          loading={pending}
          className="flex-1 h-12 text-base font-semibold"
        >
          Begin Match
        </Button>
      </div>
    </div>
  )
}
