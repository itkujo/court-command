# Frontend Phase 3A — Hooks + Shared Scoring Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational scoring layer: TanStack Query hooks for matches/events/courts/quick matches, the WebSocket subscription hook with smart reconnect, user preference storage, keyboard shortcut hook, and the shared scoring UI components used by ref + scorekeeper + public scoreboard.

**Architecture:** All scoring features sit in `frontend/src/features/scoring/`. Hooks wrap `apiGet/apiPost` and TanStack Query like Phase 1/2. WebSocket hook uses native `WebSocket` API + exponential reconnect, merges `match_update` payloads into the query cache. Shared components are layout-agnostic — they accept handler props and render. Two layouts (portrait, landscape) auto-select via `useIsMobile` + orientation media query.

**Tech Stack:** React 19, TanStack Query 5, TanStack Router (file-based), TypeScript 5, Tailwind v4 with CSS custom properties, lucide-react.

---

## Spec Reference

This plan implements Sections 3.5 (API Layer), 3.6 (WebSocket Hook), 3.7 (Keyboard Shortcuts), 3.8 (Haptic & Sound), 4.1 (`MatchScoreboard`), 4.2 (`MatchSetup`), and parts of 4.3 (`CourtGrid`) and 4.7 (`DisconnectBanner`) of the Phase 3 spec.

The components are built but not yet wired into routes. Phase 3B/C/D/E mount them.

---

## File Structure

```
frontend/src/features/scoring/
├─ types.ts                 # Match, MatchEvent, EventType, etc.
├─ hooks.ts                 # All match + court + match-series query/mutation hooks
├─ useMatchWebSocket.ts     # WS subscription with reconnect
├─ useScoringPrefs.ts       # localStorage-backed preferences
├─ useKeyboardShortcuts.ts  # Generic key binding hook
├─ MatchScoreboard.tsx      # Top-level scoreboard component (portrait/landscape)
├─ ScoringButtons.tsx       # Point + Side Out / Point T1 + Point T2 row
├─ ServeIndicator.tsx       # Server dot + label
├─ GameHistoryBar.tsx       # Per-game completed score chips
├─ ScoreCall.tsx            # "7 · 4 · 1" or "7 · 4" prominent display
├─ TimeoutBadge.tsx         # Timeouts remaining indicator
├─ MatchSetup.tsx           # Pre-match setup screen
├─ DisconnectBanner.tsx     # Sticky banner for WS state
└─ feedback.ts              # Haptic + WebAudio sound helpers

frontend/src/features/quick-match/
└─ hooks.ts                 # Quick match queries + create mutation
```

No routes are added in this sub-phase. No edits to existing files except possibly `frontend/src/lib/api.ts` if a helper is missing (none expected).

---

## Conventions Recap (from prior phases)

- Imports: relative paths (NO `@/` aliases)
- API: `apiGet/apiPost/apiPatch/apiDelete/apiGetPaginated` from `lib/api.ts` with `credentials: 'include'`
- Toast: `const { toast } = useToast(); toast('success'|'error'|'warning'|'info', message)`
- TanStack Query: `useQuery`/`useMutation`/`useQueryClient`, `queryKey` arrays, `enabled` guards
- TS strict — no `any` unless absolutely needed; prefer `unknown` + narrowing
- Each commit: targeted scope, conventional message (`feat(frontend): ...`)

---

## Task 1: Types

**Files:**
- Create: `frontend/src/features/scoring/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// frontend/src/features/scoring/types.ts

export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'bye'
  | 'forfeit'
  | 'cancelled'

export type ScoringType = 'side_out' | 'rally'

export type EventType =
  | 'MATCH_STARTED'
  | 'POINT_SCORED'
  | 'POINT_REMOVED'
  | 'SIDE_OUT'
  | 'GAME_COMPLETE'
  | 'MATCH_COMPLETE'
  | 'TIMEOUT_CALLED'
  | 'TIMEOUT_ENDED'
  | 'END_CHANGE'
  | 'SUBSTITUTION'
  | 'MATCH_RESET'
  | 'MATCH_CONFIGURED'
  | 'SCORE_OVERRIDE'
  | 'FORFEIT_DECLARED'
  | 'MATCH_PAUSED'
  | 'MATCH_RESUMED'

export interface MatchTeam {
  id: number
  name: string
  short_name?: string | null
  primary_color?: string | null
  logo_url?: string | null
  players?: Array<{
    id: number
    public_id: string
    display_name: string
  }>
}

export interface CompletedGame {
  game_number: number
  team_1_score: number
  team_2_score: number
  winner: 1 | 2
}

export interface Match {
  id: number
  public_id: string
  status: MatchStatus
  scoring_type: ScoringType
  points_to_win: number
  win_by: number
  best_of: number
  current_game: number
  team_1: MatchTeam | null
  team_2: MatchTeam | null
  team_1_score: number
  team_2_score: number
  team_1_games_won: number
  team_2_games_won: number
  serving_team: 1 | 2 | null
  server_number: 1 | 2 | null
  serving_player_id?: number | null
  timeouts_per_game: number
  team_1_timeouts_used: number
  team_2_timeouts_used: number
  completed_games: CompletedGame[]
  is_paused: boolean
  is_quick_match: boolean
  match_type?: string
  division_id?: number | null
  division_name?: string | null
  tournament_id?: number | null
  tournament_name?: string | null
  court_id?: number | null
  court_name?: string | null
  match_series_id?: number | null
  scheduled_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  winner_team_id?: number | null
  loser_team_id?: number | null
  scored_by_name?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface MatchEvent {
  id: number
  match_id: number
  sequence_id: number
  event_type: EventType
  timestamp: string
  payload: Record<string, unknown>
  score_snapshot: Record<string, unknown>
  created_by_user_id?: number | null
  scored_by_name?: string | null
}

export interface ScoringActionResult {
  match: Match
  game_over_detected?: boolean
  match_over_detected?: boolean
  end_change_detected?: boolean
  event?: MatchEvent
}

export interface CourtSummary {
  id: number
  name: string
  slug: string
  venue_id?: number | null
  is_show_court?: boolean
  stream_url?: string | null
  active_match?: Match | null
  on_deck_match?: Match | null
}

export interface MatchSeriesSummary {
  id: number
  public_id: string
  team1_id: number
  team2_id: number
  team1: MatchTeam | null
  team2: MatchTeam | null
  team1_wins: number
  team2_wins: number
  games_to_win: number
  status: string
  started_at?: string | null
  completed_at?: string | null
  winner_team_id?: number | null
  matches: Match[]
}
```

- [ ] **Step 2: Commit**

```sh
git add frontend/src/features/scoring/types.ts
git commit -m "feat(frontend): add scoring types"
```

---

## Task 2: Scoring Hooks

**Files:**
- Create: `frontend/src/features/scoring/hooks.ts`

- [ ] **Step 1: Write hooks file**

```ts
// frontend/src/features/scoring/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../lib/api'
import type {
  CourtSummary,
  Match,
  MatchEvent,
  MatchSeriesSummary,
  ScoringActionResult,
} from './types'

// ----- Queries -----

export function useMatch(publicId: string | undefined) {
  return useQuery<Match>({
    queryKey: ['matches', publicId],
    queryFn: () => apiGet<Match>(`/api/v1/matches/${publicId}`),
    enabled: !!publicId,
  })
}

export function useMatchEvents(publicId: string | undefined) {
  return useQuery<MatchEvent[]>({
    queryKey: ['match-events', publicId],
    queryFn: () => apiGet<MatchEvent[]>(`/api/v1/matches/${publicId}/events`),
    enabled: !!publicId,
  })
}

export function useCourtMatches(courtId: number | undefined) {
  return useQuery<Match[]>({
    queryKey: ['courts', courtId, 'matches'],
    queryFn: () => apiGet<Match[]>(`/api/v1/courts/${courtId}/matches`),
    enabled: !!courtId,
  })
}

export function useCourtsForTournament(tournamentId: number | undefined) {
  return useQuery<CourtSummary[]>({
    queryKey: ['tournaments', tournamentId, 'courts'],
    queryFn: () =>
      apiGet<CourtSummary[]>(`/api/v1/tournaments/${tournamentId}/courts`),
    enabled: !!tournamentId,
  })
}

export function useMatchSeries(publicId: string | undefined) {
  return useQuery<MatchSeriesSummary>({
    queryKey: ['match-series', publicId],
    queryFn: () =>
      apiGet<MatchSeriesSummary>(`/api/v1/match-series/${publicId}`),
    enabled: !!publicId,
  })
}

// ----- Helper for invalidating after a scoring action -----

function invalidateMatch(qc: ReturnType<typeof useQueryClient>, publicId: string) {
  qc.invalidateQueries({ queryKey: ['match-events', publicId] })
  // match cache is updated via setQueryData below
}

function applyResult(
  qc: ReturnType<typeof useQueryClient>,
  publicId: string,
  result: ScoringActionResult
) {
  qc.setQueryData(['matches', publicId], result.match)
  invalidateMatch(qc, publicId)
}

// ----- Mutations -----

export function useStartMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      publicId,
      scored_by_name,
      first_serving_team,
      first_serving_player_id,
    }: {
      publicId: string
      scored_by_name?: string
      first_serving_team?: 1 | 2
      first_serving_player_id?: number | null
    }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/start`, {
        scored_by_name,
        first_serving_team,
        first_serving_player_id,
      }),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useScorePoint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId, team }: { publicId: string; team?: 1 | 2 }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/point`, {
        team,
      }),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useSideOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/sideout`, {}),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useUndo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/undo`, {}),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useRemovePoint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(
        `/api/v1/matches/${publicId}/remove-point`,
        {}
      ),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useConfirmGameOver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(
        `/api/v1/matches/${publicId}/confirm-game`,
        {}
      ),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useConfirmMatchOver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(
        `/api/v1/matches/${publicId}/confirm-match`,
        {}
      ),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useCallTimeout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId, team }: { publicId: string; team: 1 | 2 }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/timeout`, {
        team,
      }),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function usePauseMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/pause`, {}),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useResumeMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/resume`, {}),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export function useDeclareForfeit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      publicId,
      forfeiting_team,
      reason,
    }: {
      publicId: string
      forfeiting_team: 1 | 2
      reason: string
    }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/forfeit`, {
        forfeiting_team,
        reason,
      }),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}

export interface OverrideGameInput {
  game_number: number
  team_1_score: number
  team_2_score: number
  winner: 1 | 2 | null
}

export function useOverrideScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      publicId,
      games,
      reason,
    }: {
      publicId: string
      games: OverrideGameInput[]
      reason: string
    }) =>
      apiPost<ScoringActionResult>(`/api/v1/matches/${publicId}/override`, {
        games,
        reason,
      }),
    onSuccess: (data, vars) => applyResult(qc, vars.publicId, data),
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```sh
cd frontend && pnpm tsc -b --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```sh
git add frontend/src/features/scoring/hooks.ts
git commit -m "feat(frontend): add scoring query and mutation hooks"
```

---

## Task 3: WebSocket Hook

**Files:**
- Create: `frontend/src/features/scoring/useMatchWebSocket.ts`

The hook owns one `WebSocket` per `publicId`, reconnects with exponential backoff (1s, 2s, 4s, 8s, capped at 30s), and merges `match_update` payloads into the TanStack Query cache.

- [ ] **Step 1: Implement the hook**

```ts
// frontend/src/features/scoring/useMatchWebSocket.ts
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { Match } from './types'

export type WebSocketState = 'connecting' | 'open' | 'disconnected'

interface MatchUpdateMessage {
  type: 'match_update'
  data: Match
}

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000]

function buildWsUrl(publicId: string): string {
  if (typeof window === 'undefined') return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // Allow Vite proxy/host override via VITE_WS_URL; otherwise same host as page
  const base = (import.meta.env.VITE_WS_URL as string | undefined) || ''
  if (base) {
    return `${base.replace(/\/$/, '')}/ws/matches/${publicId}`
  }
  return `${proto}//${window.location.host}/ws/matches/${publicId}`
}

export function useMatchWebSocket(publicId: string | undefined): {
  state: WebSocketState
  lastUpdate: Match | undefined
} {
  const qc = useQueryClient()
  const [state, setState] = useState<WebSocketState>('connecting')
  const [lastUpdate, setLastUpdate] = useState<Match | undefined>(undefined)
  const attemptsRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const closedByUnmountRef = useRef(false)

  useEffect(() => {
    if (!publicId) return
    closedByUnmountRef.current = false

    const connect = () => {
      const url = buildWsUrl(publicId)
      if (!url) return
      setState('connecting')
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0
        setState('open')
        // Re-fetch match on reconnect to pick up missed updates
        qc.invalidateQueries({ queryKey: ['matches', publicId] })
        qc.invalidateQueries({ queryKey: ['match-events', publicId] })
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as MatchUpdateMessage
          if (msg.type === 'match_update' && msg.data) {
            qc.setQueryData(['matches', publicId], msg.data)
            qc.invalidateQueries({ queryKey: ['match-events', publicId] })
            setLastUpdate(msg.data)
          }
        } catch {
          // Ignore malformed
        }
      }

      ws.onerror = () => {
        // onclose will follow
      }

      ws.onclose = () => {
        wsRef.current = null
        if (closedByUnmountRef.current) return
        setState('disconnected')
        const idx = Math.min(attemptsRef.current, BACKOFF_STEPS_MS.length - 1)
        const delay = BACKOFF_STEPS_MS[idx]
        attemptsRef.current += 1
        reconnectTimerRef.current = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closedByUnmountRef.current = true
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [publicId, qc])

  return { state, lastUpdate }
}
```

- [ ] **Step 2: Verify TypeScript**

```sh
cd frontend && pnpm tsc -b --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```sh
git add frontend/src/features/scoring/useMatchWebSocket.ts
git commit -m "feat(frontend): add useMatchWebSocket with exponential reconnect"
```

---

## Task 4: Scoring Preferences Hook

**Files:**
- Create: `frontend/src/features/scoring/useScoringPrefs.ts`

- [ ] **Step 1: Implement**

```ts
// frontend/src/features/scoring/useScoringPrefs.ts
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'cc_scoring_prefs'

export interface ScoringPrefs {
  keyboard: boolean
  haptic: boolean
  sound: boolean
}

const DEFAULT_PREFS: ScoringPrefs = {
  keyboard: true,
  haptic: true,
  sound: true,
}

function readPrefs(): ScoringPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ScoringPrefs>
    return {
      keyboard:
        typeof parsed.keyboard === 'boolean'
          ? parsed.keyboard
          : DEFAULT_PREFS.keyboard,
      haptic:
        typeof parsed.haptic === 'boolean'
          ? parsed.haptic
          : DEFAULT_PREFS.haptic,
      sound:
        typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFS.sound,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: ScoringPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage full / disabled — silently ignore
  }
}

export function useScoringPrefs(): {
  prefs: ScoringPrefs
  setKeyboard: (v: boolean) => void
  setHaptic: (v: boolean) => void
  setSound: (v: boolean) => void
  toggleKeyboard: () => void
  toggleHaptic: () => void
  toggleSound: () => void
} {
  const [prefs, setPrefs] = useState<ScoringPrefs>(readPrefs)

  // React to changes from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(readPrefs())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const update = useCallback((partial: Partial<ScoringPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial }
      writePrefs(next)
      return next
    })
  }, [])

  return {
    prefs,
    setKeyboard: (v) => update({ keyboard: v }),
    setHaptic: (v) => update({ haptic: v }),
    setSound: (v) => update({ sound: v }),
    toggleKeyboard: () => update({ keyboard: !prefs.keyboard }),
    toggleHaptic: () => update({ haptic: !prefs.haptic }),
    toggleSound: () => update({ sound: !prefs.sound }),
  }
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/useScoringPrefs.ts
git commit -m "feat(frontend): add useScoringPrefs (localStorage-backed)"
```

---

## Task 5: Feedback Helpers (haptic + sound)

**Files:**
- Create: `frontend/src/features/scoring/feedback.ts`

- [ ] **Step 1: Implement**

```ts
// frontend/src/features/scoring/feedback.ts

/**
 * Trigger short haptic vibration if supported and enabled.
 */
export function vibrate(durationMs = 50): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(durationMs)
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) {
    audioCtx = new Ctor()
  }
  return audioCtx
}

/**
 * Play a short synthesized tick (~80–120ms) at a given frequency.
 * Frequencies tuned: 880 Hz for point, 660 Hz for side-out, 440 Hz for undo.
 */
export function playTick(
  variant: 'point' | 'side_out' | 'undo' | 'error' = 'point'
): void {
  const ctx = getAudioContext()
  if (!ctx) return
  // Resume if browser suspended
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* ignore */
    })
  }

  const freq =
    variant === 'point'
      ? 880
      : variant === 'side_out'
        ? 660
        : variant === 'undo'
          ? 440
          : 220

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = freq
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  // Quick attack + decay envelope to avoid clicks
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

  oscillator.start(now)
  oscillator.stop(now + 0.12)
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/feedback.ts
git commit -m "feat(frontend): add scoring haptic + WebAudio sound helpers"
```

---

## Task 6: Keyboard Shortcuts Hook

**Files:**
- Create: `frontend/src/features/scoring/useKeyboardShortcuts.ts`

- [ ] **Step 1: Implement**

```ts
// frontend/src/features/scoring/useKeyboardShortcuts.ts
import { useEffect } from 'react'

export interface KeyHandlers {
  onPointTeam1?: () => void   // also primary "Point" in side-out mode
  onPointTeam2?: () => void
  onSideOut?: () => void
  onUndo?: () => void
  onTimeout?: () => void
  onEscape?: () => void
}

function isFromInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts(
  handlers: KeyHandlers,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (isFromInput(e.target)) return
      switch (e.key) {
        case '1':
          handlers.onPointTeam1?.()
          break
        case '2':
          handlers.onPointTeam2?.()
          break
        case 's':
        case 'S':
          handlers.onSideOut?.()
          break
        case 'z':
        case 'Z':
          handlers.onUndo?.()
          break
        case 't':
        case 'T':
          handlers.onTimeout?.()
          break
        case 'Escape':
          handlers.onEscape?.()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers, enabled])
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/useKeyboardShortcuts.ts
git commit -m "feat(frontend): add useKeyboardShortcuts"
```

---

## Task 7: Quick Match Hooks

**Files:**
- Create: `frontend/src/features/quick-match/hooks.ts`

- [ ] **Step 1: Implement**

```ts
// frontend/src/features/quick-match/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../lib/api'
import type { Match } from '../scoring/types'

export interface CreateQuickMatchInput {
  team_1_name: string
  team_2_name: string
  scoring_preset_id?: number
  points_to_win?: number
  win_by?: number
  best_of?: number
  scoring_type?: 'side_out' | 'rally'
}

export function useMyQuickMatches() {
  return useQuery<Match[]>({
    queryKey: ['quick-matches'],
    queryFn: () => apiGet<Match[]>('/api/v1/quick-matches'),
  })
}

export function useCreateQuickMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateQuickMatchInput) =>
      apiPost<Match>('/api/v1/quick-matches', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-matches'] })
    },
  })
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/quick-match/hooks.ts
git commit -m "feat(frontend): add quick match hooks"
```

---

## Task 8: ServeIndicator Component

**Files:**
- Create: `frontend/src/features/scoring/ServeIndicator.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/ServeIndicator.tsx
import { Circle } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ServeIndicatorProps {
  active: boolean
  serverNumber?: 1 | 2 | null
  /** Label for screen readers; component renders icon-only */
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ServeIndicator({
  active,
  serverNumber,
  ariaLabel,
  size = 'md',
}: ServeIndicatorProps) {
  const dim = size === 'sm' ? 16 : size === 'lg' ? 28 : 22
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 select-none',
        active
          ? 'text-(--color-accent)'
          : 'text-(--color-text-muted) opacity-50'
      )}
      aria-label={ariaLabel ?? (active ? 'Serving' : 'Not serving')}
    >
      <Circle
        size={dim}
        fill={active ? 'currentColor' : 'transparent'}
        strokeWidth={active ? 0 : 2}
      />
      {active && serverNumber ? (
        <span className="text-sm font-bold">{serverNumber}</span>
      ) : null}
    </span>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/ServeIndicator.tsx
git commit -m "feat(frontend): add ServeIndicator component"
```

---

## Task 9: TimeoutBadge Component

**Files:**
- Create: `frontend/src/features/scoring/TimeoutBadge.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/TimeoutBadge.tsx
import { Pause } from 'lucide-react'

export interface TimeoutBadgeProps {
  used: number
  total: number
  /** Allowed-to-use even though all used? Spec is "advisory" */
  warningWhenZero?: boolean
}

export function TimeoutBadge({
  used,
  total,
  warningWhenZero = true,
}: TimeoutBadgeProps) {
  const remaining = Math.max(0, total - used)
  const isZero = remaining === 0
  return (
    <span
      className={
        isZero && warningWhenZero
          ? 'inline-flex items-center gap-1 text-xs font-medium text-(--color-warning)'
          : 'inline-flex items-center gap-1 text-xs font-medium text-(--color-text-secondary)'
      }
      aria-label={`Timeouts remaining: ${remaining} of ${total}`}
    >
      <Pause size={14} />
      <span>
        {remaining}/{total} TO
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/TimeoutBadge.tsx
git commit -m "feat(frontend): add TimeoutBadge component"
```

---

## Task 10: GameHistoryBar Component

**Files:**
- Create: `frontend/src/features/scoring/GameHistoryBar.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/GameHistoryBar.tsx
import { cn } from '../../lib/cn'
import type { CompletedGame } from './types'

export interface GameHistoryBarProps {
  completedGames: CompletedGame[]
  bestOf?: number
  className?: string
}

export function GameHistoryBar({
  completedGames,
  bestOf,
  className,
}: GameHistoryBarProps) {
  if (completedGames.length === 0) {
    return (
      <div
        className={cn(
          'text-xs text-(--color-text-muted) uppercase tracking-wide',
          className
        )}
      >
        Game 1
      </div>
    )
  }
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {completedGames.map((g) => (
        <span
          key={g.game_number}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-(--color-bg-secondary) text-(--color-text-primary)"
          aria-label={`Game ${g.game_number} final: ${g.team_1_score}-${g.team_2_score}, team ${g.winner} won`}
        >
          <span className="text-(--color-text-muted)">G{g.game_number}</span>
          <span
            className={
              g.winner === 1
                ? 'font-bold text-(--color-accent)'
                : 'text-(--color-text-primary)'
            }
          >
            {g.team_1_score}
          </span>
          <span className="text-(--color-text-muted)">–</span>
          <span
            className={
              g.winner === 2
                ? 'font-bold text-(--color-accent)'
                : 'text-(--color-text-primary)'
            }
          >
            {g.team_2_score}
          </span>
        </span>
      ))}
      {bestOf ? (
        <span className="text-xs text-(--color-text-muted)">
          Best of {bestOf}
        </span>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/GameHistoryBar.tsx
git commit -m "feat(frontend): add GameHistoryBar component"
```

---

## Task 11: ScoreCall Component

**Files:**
- Create: `frontend/src/features/scoring/ScoreCall.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/ScoreCall.tsx
import type { Match } from './types'

export interface ScoreCallProps {
  match: Match
}

/**
 * Renders the prominent score call:
 * - side_out: "{servingScore} · {receivingScore} · {serverNumber}"
 * - rally:    "{team1Score} · {team2Score}"
 * Returned as a single, screen-reader-friendly element with aria-live.
 */
export function ScoreCall({ match }: ScoreCallProps) {
  let text: string
  let label: string

  if (match.scoring_type === 'side_out' && match.serving_team) {
    const servingScore =
      match.serving_team === 1 ? match.team_1_score : match.team_2_score
    const receivingScore =
      match.serving_team === 1 ? match.team_2_score : match.team_1_score
    const server = match.server_number ?? 1
    text = `${servingScore} · ${receivingScore} · ${server}`
    label = `Score: ${servingScore} ${receivingScore} ${server}`
  } else {
    text = `${match.team_1_score} · ${match.team_2_score}`
    label = `Score: ${match.team_1_score} to ${match.team_2_score}`
  }

  return (
    <div
      className="text-3xl md:text-4xl font-bold tracking-wider text-center text-(--color-text-primary) tabular-nums"
      aria-live="polite"
      aria-label={label}
    >
      {text}
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/ScoreCall.tsx
git commit -m "feat(frontend): add ScoreCall component"
```

---

## Task 12: ScoringButtons Component

**Files:**
- Create: `frontend/src/features/scoring/ScoringButtons.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/ScoringButtons.tsx
import { Button } from '../../components/Button'
import type { Match } from './types'

export interface ScoringButtonsProps {
  match: Match
  disabled?: boolean
  pending?: boolean
  onPoint: (team?: 1 | 2) => void
  onSideOut: () => void
}

/**
 * Auto-switches between side-out (POINT + SIDE OUT)
 * and rally (POINT TEAM 1 + POINT TEAM 2) layouts.
 */
export function ScoringButtons({
  match,
  disabled,
  pending,
  onPoint,
  onSideOut,
}: ScoringButtonsProps) {
  const isRally = match.scoring_type === 'rally'

  if (isRally) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          size="lg"
          className="h-20 text-lg font-bold"
          disabled={disabled}
          loading={pending}
          onClick={() => onPoint(1)}
        >
          Point {match.team_1?.short_name ?? 'T1'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="h-20 text-lg font-bold"
          disabled={disabled}
          loading={pending}
          onClick={() => onPoint(2)}
        >
          Point {match.team_2?.short_name ?? 'T2'}
        </Button>
      </div>
    )
  }

  // Side-out: single POINT (to serving team) + SIDE OUT
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="primary"
        size="lg"
        className="h-20 text-lg font-bold"
        disabled={disabled || !match.serving_team}
        loading={pending}
        onClick={() => onPoint()}
      >
        POINT
      </Button>
      <Button
        variant="danger"
        size="lg"
        className="h-20 text-lg font-bold"
        disabled={disabled || !match.serving_team}
        onClick={onSideOut}
      >
        SIDE OUT
      </Button>
    </div>
  )
}
```

NOTE: This component depends on the existing `Button` having `variant: 'primary' | 'danger'` and `size: 'lg'`. If those variants don't exist, the implementer should pick the closest variant available in the project's Button component (check `frontend/src/components/Button.tsx`) and use it consistently. Do NOT silently change types — use the variants the component already supports.

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/ScoringButtons.tsx
git commit -m "feat(frontend): add ScoringButtons component"
```

---

## Task 13: DisconnectBanner Component

**Files:**
- Create: `frontend/src/features/scoring/DisconnectBanner.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/DisconnectBanner.tsx
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import type { WebSocketState } from './useMatchWebSocket'

export interface DisconnectBannerProps {
  state: WebSocketState
}

/**
 * Sticky full-width banner.
 * - state='disconnected': red, "Connection lost — reconnecting…"
 * - state='connecting' (initial only): no banner (avoids flicker)
 * - on transition disconnected → open: green "Reconnected" flash for 2s
 * - state='open' (steady): no banner
 */
export function DisconnectBanner({ state }: DisconnectBannerProps) {
  const [showReconnectedFlash, setShowReconnectedFlash] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    if (state === 'disconnected') {
      setWasDisconnected(true)
    }
    if (state === 'open' && wasDisconnected) {
      setShowReconnectedFlash(true)
      const timer = window.setTimeout(() => {
        setShowReconnectedFlash(false)
        setWasDisconnected(false)
      }, 2000)
      return () => window.clearTimeout(timer)
    }
  }, [state, wasDisconnected])

  if (state === 'disconnected') {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="sticky top-0 z-40 bg-(--color-error) text-white px-4 py-2 flex items-center gap-2 text-sm font-medium"
      >
        <WifiOff size={16} />
        <span>Connection lost — reconnecting…</span>
      </div>
    )
  }

  if (showReconnectedFlash) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-40 bg-(--color-success) text-white px-4 py-2 flex items-center gap-2 text-sm font-medium"
      >
        <Wifi size={16} />
        <span>Reconnected</span>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/DisconnectBanner.tsx
git commit -m "feat(frontend): add DisconnectBanner"
```

---

## Task 14: MatchScoreboard Component (composite)

**Files:**
- Create: `frontend/src/features/scoring/MatchScoreboard.tsx`

This is the composite scoring UI used by ref + scorekeeper. It selects portrait/landscape via `useIsMobile` + orientation media query.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/scoring/MatchScoreboard.tsx
import { useEffect, useState } from 'react'
import { Undo2, MoreVertical, Pause as PauseIcon } from 'lucide-react'
import { Button } from '../../components/Button'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { ScoreCall } from './ScoreCall'
import { ScoringButtons } from './ScoringButtons'
import { ServeIndicator } from './ServeIndicator'
import { GameHistoryBar } from './GameHistoryBar'
import { TimeoutBadge } from './TimeoutBadge'
import type { Match } from './types'

export interface MatchScoreboardProps {
  match: Match
  mode: 'ref' | 'scorekeeper'
  disabled?: boolean
  pending?: boolean
  onPoint: (team?: 1 | 2) => void
  onSideOut: () => void
  onUndo: () => void
  onTimeout: (team: 1 | 2) => void
  onMenu?: () => void
}

function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    () => {
      if (typeof window === 'undefined') return 'portrait'
      return window.matchMedia('(orientation: landscape)').matches
        ? 'landscape'
        : 'portrait'
    }
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'landscape' : 'portrait')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return orientation
}

export function MatchScoreboard(props: MatchScoreboardProps) {
  const isMobile = useIsMobile()
  const orientation = useOrientation()
  // Tablet landscape uses split layout; phone always uses stacked
  const useLandscape = !isMobile && orientation === 'landscape'

  return useLandscape ? (
    <LandscapeLayout {...props} />
  ) : (
    <PortraitLayout {...props} />
  )
}

function MatchHeader({ match, onMenu }: { match: Match; onMenu?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="text-xs text-(--color-text-secondary) leading-tight">
        {match.division_name ? <div>{match.division_name}</div> : null}
        {match.court_name ? (
          <div className="text-(--color-text-muted)">{match.court_name}</div>
        ) : null}
      </div>
      {onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Match menu"
          className="p-2 rounded text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
        >
          <MoreVertical size={20} />
        </button>
      ) : null}
    </div>
  )
}

function TeamRow({
  match,
  team,
  serving,
}: {
  match: Match
  team: 1 | 2
  serving: boolean
}) {
  const t = team === 1 ? match.team_1 : match.team_2
  const score = team === 1 ? match.team_1_score : match.team_2_score
  const used =
    team === 1 ? match.team_1_timeouts_used : match.team_2_timeouts_used
  const total = match.timeouts_per_game

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-4 rounded-lg border-2',
        serving
          ? 'border-(--color-accent) bg-(--color-bg-secondary)'
          : 'border-(--color-border) bg-(--color-bg-secondary)'
      )}
      data-team={team}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ServeIndicator
          active={serving}
          serverNumber={serving ? match.server_number ?? 1 : null}
          ariaLabel={
            serving
              ? `Serving, server ${match.server_number ?? 1}`
              : 'Not serving'
          }
        />
        <div className="min-w-0">
          <div className="text-xs text-(--color-text-muted) uppercase">
            Team {team}
          </div>
          <div className="text-base font-semibold text-(--color-text-primary) truncate">
            {t?.name ?? `Team ${team}`}
          </div>
          <div className="mt-1">
            <TimeoutBadge used={used} total={total} />
          </div>
        </div>
      </div>
      <div
        className="text-5xl md:text-6xl font-extrabold tabular-nums text-(--color-text-primary)"
        aria-label={`Team ${team} score: ${score}`}
      >
        {score}
      </div>
    </div>
  )
}

function PortraitLayout(props: MatchScoreboardProps) {
  const { match, disabled, pending, onPoint, onSideOut, onUndo, onTimeout, onMenu } =
    props
  return (
    <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
      <MatchHeader match={match} onMenu={onMenu} />
      <TeamRow match={match} team={1} serving={match.serving_team === 1} />
      <TeamRow match={match} team={2} serving={match.serving_team === 2} />
      <div className="my-1">
        <ScoreCall match={match} />
      </div>
      <ScoringButtons
        match={match}
        disabled={disabled}
        pending={pending}
        onPoint={onPoint}
        onSideOut={onSideOut}
      />
      <div className="flex items-center justify-between gap-2 mt-1">
        <Button
          variant="secondary"
          onClick={onUndo}
          disabled={disabled}
          aria-label="Undo last action"
          className="flex-1"
        >
          <Undo2 size={16} className="mr-1 inline-block" />
          Undo
        </Button>
        <Button
          variant="secondary"
          onClick={() => onTimeout(match.serving_team ?? 1)}
          disabled={disabled || !match.serving_team}
          aria-label="Call timeout"
          className="flex-1"
        >
          <PauseIcon size={16} className="mr-1 inline-block" />
          Timeout
        </Button>
      </div>
      <GameHistoryBar
        completedGames={match.completed_games}
        bestOf={match.best_of}
        className="mt-2 justify-center"
      />
    </div>
  )
}

function LandscapeLayout(props: MatchScoreboardProps) {
  const { match, disabled, pending, onPoint, onSideOut, onUndo, onTimeout, onMenu } =
    props
  return (
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full">
      <MatchHeader match={match} onMenu={onMenu} />
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <TeamRow match={match} team={1} serving={match.serving_team === 1} />
        <div className="flex flex-col gap-3 min-w-[280px]">
          <ScoreCall match={match} />
          <ScoringButtons
            match={match}
            disabled={disabled}
            pending={pending}
            onPoint={onPoint}
            onSideOut={onSideOut}
          />
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={onUndo}
              disabled={disabled}
              aria-label="Undo last action"
            >
              <Undo2 size={16} className="mr-1 inline-block" />
              Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => onTimeout(match.serving_team ?? 1)}
              disabled={disabled || !match.serving_team}
              aria-label="Call timeout"
            >
              <PauseIcon size={16} className="mr-1 inline-block" />
              Timeout
            </Button>
          </div>
        </div>
        <TeamRow match={match} team={2} serving={match.serving_team === 2} />
      </div>
      <GameHistoryBar
        completedGames={match.completed_games}
        bestOf={match.best_of}
        className="mt-2 justify-center"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript + run dev to spot-check**

```sh
cd frontend && pnpm tsc -b --noEmit
```

Expected: 0 errors. (No need to mount it yet — visual check happens in Phase 3B when wired into ref console.)

- [ ] **Step 3: Commit**

```sh
git add frontend/src/features/scoring/MatchScoreboard.tsx
git commit -m "feat(frontend): add MatchScoreboard component (portrait + landscape)"
```

---

## Task 15: MatchSetup Component

**Files:**
- Create: `frontend/src/features/scoring/MatchSetup.tsx`

- [ ] **Step 1: Implement**

```tsx
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

export function MatchSetup({ match, pending, onBegin, onCancel }: MatchSetupProps) {
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
          onChange={(e) =>
            changeTeam(e.target.value === '2' ? 2 : 1)
          }
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

      <FormField
        label="Scored By (optional)"
        htmlFor="scored-by-name"
        hint="Used for audit log when using a shared referee account"
      >
        <Input
          id="scored-by-name"
          value={scoredByName}
          onChange={(e) => setScoredByName(e.target.value)}
          placeholder="Your name"
        />
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
```

NOTES:
- This component uses existing `FormField`, `Input`, `Select`, `Button` from `frontend/src/components/`. If `FormField` requires different prop names (e.g., `error` instead of `hint`), adjust to match the actual component contract.
- `Select` is the project's existing `<select>`-based component using `<option>` children (not an `options` prop).

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/scoring/MatchSetup.tsx
git commit -m "feat(frontend): add MatchSetup pre-match screen"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run TypeScript check, lint, and build**

```sh
cd frontend
pnpm tsc -b --noEmit
pnpm lint || true   # if lint script exists; non-blocking
pnpm build
```

Expected:
- 0 TypeScript errors
- Production build succeeds

- [ ] **Step 2: Confirm commit log**

```sh
git log --oneline -16
```

Expected: 16 commits since `91aba07` corresponding to Tasks 1–15 plus this verification (no commit needed for verification itself).

- [ ] **Step 3: Push to remote**

```sh
git push origin main:V2
```

---

## Self-Review Checklist (the implementer should validate before reporting DONE)

- [ ] All 15 files exist at the specified paths
- [ ] No file contains `TODO`, `TBD`, `placeholder`, or untyped `any` parameters
- [ ] No `@/` aliases — only relative imports
- [ ] Every hook returns the documented types from `types.ts`
- [ ] WS hook properly cleans up on unmount (no leaked listeners or timers)
- [ ] `useScoringPrefs` survives a tab refresh (manual: open devtools → Application → Local Storage)
- [ ] `MatchScoreboard` renders without crashing for both `scoring_type: 'side_out'` and `'rally'`
- [ ] Build passes with 0 errors

When DONE, report:
- All commit SHAs
- Output of `pnpm tsc -b --noEmit` (must be empty)
- Output of `pnpm build` final line (e.g. `built in XXXms`)
- Any deviations from the plan (e.g. Button variants substituted) with rationale
