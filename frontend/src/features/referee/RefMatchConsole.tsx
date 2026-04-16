// frontend/src/features/referee/RefMatchConsole.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { DisconnectBanner } from '../scoring/DisconnectBanner'
import { MatchScoreboard } from '../scoring/MatchScoreboard'
import { MatchSetup } from '../scoring/MatchSetup'
import { playTick, vibrate } from '../scoring/feedback'
import {
  useCallTimeout,
  useConfirmGameOver,
  useConfirmMatchOver,
  useMatch,
  useScorePoint,
  useSideOut,
  useStartMatch,
  useUndo,
} from '../scoring/hooks'
import { useKeyboardShortcuts } from '../scoring/useKeyboardShortcuts'
import { useMatchWebSocket } from '../scoring/useMatchWebSocket'
import { useScoringPrefs } from '../scoring/useScoringPrefs'
import type { ScoringActionResult } from '../scoring/types'

export interface RefMatchConsoleProps {
  publicId: string
}

export function RefMatchConsole({ publicId }: RefMatchConsoleProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const matchQuery = useMatch(publicId)
  const ws = useMatchWebSocket(publicId)
  const { prefs } = useScoringPrefs()

  const startMatch = useStartMatch()
  const scorePoint = useScorePoint()
  const sideOut = useSideOut()
  const undo = useUndo()
  const callTimeout = useCallTimeout()
  const confirmGameOver = useConfirmGameOver()
  const confirmMatchOver = useConfirmMatchOver()

  const [gameOverPrompt, setGameOverPrompt] = useState(false)
  const [matchOverPrompt, setMatchOverPrompt] = useState(false)

  const match = matchQuery.data
  const disabled = ws.state !== 'open'

  function feedback(variant: 'point' | 'side_out' | 'undo' | 'error' = 'point') {
    if (prefs.haptic) vibrate(50)
    if (prefs.sound) playTick(variant)
  }

  function handleResult(res: ScoringActionResult) {
    if (res.match_over_detected) setMatchOverPrompt(true)
    else if (res.game_over_detected) setGameOverPrompt(true)
  }

  function handlePoint(team?: 1 | 2) {
    if (!match) return
    scorePoint.mutate(
      { publicId, team },
      {
        onSuccess: (res) => {
          feedback('point')
          handleResult(res)
        },
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : 'Failed to score point',
          ),
      },
    )
  }

  function handleSideOut() {
    if (!match) return
    sideOut.mutate(
      { publicId },
      {
        onSuccess: (res) => {
          feedback('side_out')
          handleResult(res)
        },
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : 'Failed to side out',
          ),
      },
    )
  }

  function handleUndo() {
    if (!match) return
    undo.mutate(
      { publicId },
      {
        onSuccess: () => feedback('undo'),
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : 'Failed to undo',
          ),
      },
    )
  }

  function handleTimeout(team: 1 | 2) {
    if (!match) return
    callTimeout.mutate(
      { publicId, team },
      {
        onSuccess: () => toast('info', `Timeout for Team ${team}`),
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : 'Failed to call timeout',
          ),
      },
    )
  }

  // Side-out: '1' triggers POINT (no team specified). Rally: '1' = team 1, '2' = team 2.
  useKeyboardShortcuts(
    {
      onPointTeam1: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(1)
        else handlePoint()
      },
      onPointTeam2: () => {
        if (!match) return
        if (match.scoring_type === 'rally') handlePoint(2)
      },
      onSideOut: () => {
        if (!match) return
        if (match.scoring_type === 'side_out') handleSideOut()
      },
      onUndo: handleUndo,
      onTimeout: () => {
        if (match?.serving_team) handleTimeout(match.serving_team)
      },
      onEscape: () => {
        setGameOverPrompt(false)
        setMatchOverPrompt(false)
      },
    },
    prefs.keyboard && match?.status === 'in_progress' && !disabled,
  )

  if (matchQuery.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-32 mb-2" />
        <Skeleton className="h-32 mb-2" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  if (matchQuery.isError || !match) {
    return (
      <div className="p-4 text-(--color-error)">
        Failed to load match.{' '}
        <button
          type="button"
          onClick={() => matchQuery.refetch()}
          className="underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DisconnectBanner state={ws.state} />

      {match.status === 'scheduled' ? (
        <MatchSetup
          match={match}
          pending={startMatch.isPending}
          onBegin={(input) =>
            startMatch.mutate(
              { publicId, ...input },
              {
                onSuccess: () => toast('success', 'Match started'),
                onError: (err) =>
                  toast(
                    'error',
                    err instanceof Error
                      ? err.message
                      : 'Failed to start match',
                  ),
              },
            )
          }
          onCancel={() => navigate({ to: '/ref' })}
        />
      ) : (
        <div className="p-3 md:p-4 flex-1">
          <MatchScoreboard
            match={match}
            mode="ref"
            disabled={disabled}
            pending={
              scorePoint.isPending ||
              sideOut.isPending ||
              undo.isPending ||
              callTimeout.isPending
            }
            onPoint={handlePoint}
            onSideOut={handleSideOut}
            onUndo={handleUndo}
            onTimeout={handleTimeout}
          />
        </div>
      )}

      <ConfirmDialog
        open={gameOverPrompt}
        onClose={() => setGameOverPrompt(false)}
        title="Game Over?"
        message="The scoring threshold has been reached. Confirm to end this game."
        confirmText="End Game"
        variant="primary"
        loading={confirmGameOver.isPending}
        onConfirm={() => {
          confirmGameOver.mutate(
            { publicId },
            {
              onSuccess: () => {
                setGameOverPrompt(false)
                toast('success', 'Game ended')
              },
              onError: (err) =>
                toast(
                  'error',
                  err instanceof Error ? err.message : 'Failed to end game',
                ),
            },
          )
        }}
      />

      <ConfirmDialog
        open={matchOverPrompt}
        onClose={() => setMatchOverPrompt(false)}
        title="Match Over?"
        message="The match-winning condition has been met. Confirm to end the match."
        confirmText="End Match"
        variant="primary"
        loading={confirmMatchOver.isPending}
        onConfirm={() => {
          confirmMatchOver.mutate(
            { publicId },
            {
              onSuccess: () => {
                setMatchOverPrompt(false)
                toast('success', 'Match completed')
              },
              onError: (err) =>
                toast(
                  'error',
                  err instanceof Error ? err.message : 'Failed to end match',
                ),
            },
          )
        }}
      />
    </div>
  )
}
