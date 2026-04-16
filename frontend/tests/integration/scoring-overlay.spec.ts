/**
 * Integration tests — Scoring + Overlay HTTP contracts.
 *
 * These tests fire real HTTP against a running backend (`make dev`) and
 * assert the shape of MatchResponse, MatchEventResponse, and OverlayData.
 * They exist to close the gap Phase 3 called out (I-7) and that Phase 4
 * surfaced as CR-9: AST-based backend contract tests don't catch
 * serialization defects (e.g. base64-on-byte-columns, field renames,
 * missing nested objects). Real HTTP + JSON parse + shape assertions do.
 *
 * Usage:
 *   1. Start backend:  make dev   (exposes :8080)
 *   2. Run tests:      pnpm test:integration
 *
 * Optional env vars:
 *   TEST_API_URL          (default http://localhost:8080)
 *   TEST_MATCH_PUBLIC_ID  — if set, asserts full MatchResponse + events
 *                           shape against that real match. If absent,
 *                           only the 404 envelope + demo overlay are
 *                           exercised.
 *   TEST_COURT_ID         — overrides the courtID used for overlay demo
 *                           calls (default 1, any int64 works since
 *                           ?demo=true short-circuits DB resolution).
 */
import { describe, it, expect, beforeAll } from 'vitest'

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:8080'
const MATCH_PUBLIC_ID = process.env.TEST_MATCH_PUBLIC_ID ?? ''
const COURT_ID = process.env.TEST_COURT_ID ?? '1'

// Canonical event types mirrored from backend/service/events.go
// (AllEventTypes). These are the exact wire-format strings the UI
// depends on. If a rename ships, this list will go stale and the
// "event_type is canonical" assertion will fail loudly.
//
// Cross-language invariant: this set MUST match AllEventTypes in
// backend/service/events.go and the EventType union in
// frontend/src/features/scoring/types.ts exactly.
const CANONICAL_EVENT_TYPES = new Set<string>([
  // Lifecycle
  'match_started',
  'match_paused',
  'match_resumed',
  'match_complete',
  'match_reset',
  // Scoring
  'point_team1',
  'point_team2',
  'point_removed',
  'side_out',
  'undo',
  'game_complete',
  'confirm_game_over',
  'confirm_match_over',
  // Flow
  'timeout',
  'timeout_ended',
  'end_change',
  'substitution',
  // Admin / configuration
  'match_configured',
  'score_override',
  'forfeit_declared',
])

async function fetchJSON(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, init)
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch (err) {
    throw new Error(
      `Non-JSON response from ${path} (status ${res.status}): ${text.slice(0, 200)}`,
    )
  }
  return { status: res.status, body }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('Backend HTTP contract (integration)', () => {
  beforeAll(async () => {
    // Fail fast with a useful message if the backend isn't running.
    try {
      await fetch(`${API_URL}/api/v1/public/tournaments`, {
        signal: AbortSignal.timeout(3000),
      })
    } catch (err) {
      throw new Error(
        `Backend not reachable at ${API_URL}. Start it with \`make dev\` ` +
          `before running pnpm test:integration. (${(err as Error).message})`,
      )
    }
  })

  describe('GET /api/v1/matches/public/{publicID} — error envelope', () => {
    it('returns a 404 with the canonical error envelope for a missing match', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000'
      const { status, body } = await fetchJSON(
        `/api/v1/matches/public/${fakeUUID}`,
      )

      expect(status).toBe(404)
      expect(isObject(body)).toBe(true)

      const envelope = body as Record<string, unknown>
      expect(isObject(envelope.error)).toBe(true)

      const err = envelope.error as Record<string, unknown>
      expect(typeof err.code).toBe('string')
      expect(typeof err.message).toBe('string')
      expect((err.code as string).length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/v1/overlay/court/{courtID}/data?demo=true — DemoData shape', () => {
    // ?demo=true short-circuits DB resolution and returns a seeded payload,
    // so this runs without any DB state. It's the strongest anti-CR-9 guard
    // in this file: every field the overlay renderer consumes is populated.
    it('returns a valid OverlayData payload with all documented fields', async () => {
      const { status, body } = await fetchJSON(
        `/api/v1/overlay/court/${COURT_ID}/data?demo=true`,
      )

      expect(status).toBe(200)
      expect(isObject(body)).toBe(true)
      const data = body as Record<string, unknown>

      // Top-level primitives
      expect(typeof data.match_status).toBe('string')
      expect(typeof data.serving_team).toBe('number')
      expect(typeof data.server_number).toBe('number')
      expect(typeof data.current_game).toBe('number')
      expect(typeof data.timeouts_remaining_1).toBe('number')
      expect(typeof data.timeouts_remaining_2).toBe('number')
      expect(typeof data.division_name).toBe('string')
      expect(typeof data.tournament_name).toBe('string')
      expect(typeof data.league_name).toBe('string')
      expect(typeof data.round_label).toBe('string')
      expect(typeof data.match_info).toBe('string')
      expect(typeof data.tournament_logo_url).toBe('string')
      expect(typeof data.league_logo_url).toBe('string')
      expect(typeof data.is_paused).toBe('boolean')
      expect(typeof data.court_name).toBe('string')

      // Teams — both MUST be populated objects (not null / omitempty).
      for (const teamKey of ['team_1', 'team_2'] as const) {
        expect(isObject(data[teamKey])).toBe(true)
        const team = data[teamKey] as Record<string, unknown>
        expect(typeof team.name).toBe('string')
        expect(typeof team.short_name).toBe('string')
        expect(typeof team.score).toBe('number')
        expect(typeof team.color).toBe('string')
        expect(typeof team.logo_url).toBe('string')
        expect(typeof team.game_wins).toBe('number')
        expect(Array.isArray(team.players)).toBe(true)
        for (const p of team.players as unknown[]) {
          expect(isObject(p)).toBe(true)
          expect(typeof (p as Record<string, unknown>).name).toBe('string')
        }
      }

      // Collections
      expect(Array.isArray(data.completed_games)).toBe(true)
      for (const g of data.completed_games as unknown[]) {
        expect(isObject(g)).toBe(true)
        const game = g as Record<string, unknown>
        expect(typeof game.game_num).toBe('number')
        expect(typeof game.score_team_1).toBe('number')
        expect(typeof game.score_team_2).toBe('number')
        expect(typeof game.winner).toBe('number')
      }

      expect(Array.isArray(data.sponsor_logos)).toBe(true)
      for (const s of data.sponsor_logos as unknown[]) {
        expect(isObject(s)).toBe(true)
        const sponsor = s as Record<string, unknown>
        expect(typeof sponsor.name).toBe('string')
        expect(typeof sponsor.logo_url).toBe('string')
        expect(typeof sponsor.link_url).toBe('string')
        expect(typeof sponsor.tier).toBe('string')
      }

      // Optional objects: present => shape must be right. Absent is fine.
      if (data.series_score !== undefined && data.series_score !== null) {
        expect(isObject(data.series_score)).toBe(true)
        const series = data.series_score as Record<string, unknown>
        expect(typeof series.team_1_wins).toBe('number')
        expect(typeof series.team_2_wins).toBe('number')
        expect(typeof series.best_of).toBe('number')
      }
      if (data.next_match !== undefined && data.next_match !== null) {
        expect(isObject(data.next_match)).toBe(true)
        const next = data.next_match as Record<string, unknown>
        expect(typeof next.team_1_name).toBe('string')
        expect(typeof next.team_2_name).toBe('string')
        expect(typeof next.division_name).toBe('string')
        expect(typeof next.round_label).toBe('string')
      }
    })
  })

  // Real-match assertions — only run when an operator seeds a match and
  // exports its public_id via TEST_MATCH_PUBLIC_ID. Without that, skip:
  // we can't fabricate a match without writing seed fixtures that would
  // rot independently of the product.
  const describeMatch = MATCH_PUBLIC_ID ? describe : describe.skip

  describeMatch('GET /api/v1/matches/public/{publicID} — MatchResponse shape', () => {
    it('returns a complete enriched MatchResponse', async () => {
      const { status, body } = await fetchJSON(
        `/api/v1/matches/public/${MATCH_PUBLIC_ID}`,
      )

      expect(status).toBe(200)
      expect(isObject(body)).toBe(true)
      const m = body as Record<string, unknown>

      // Identity
      expect(typeof m.public_id).toBe('string')
      expect(m.public_id).toBe(MATCH_PUBLIC_ID)

      // Nested team summaries — both must be objects with the full shape.
      for (const teamKey of ['team_1', 'team_2'] as const) {
        expect(isObject(m[teamKey])).toBe(true)
        const team = m[teamKey] as Record<string, unknown>
        expect(typeof team.name).toBe('string')
        expect(typeof team.short_name).toBe('string')
        expect(typeof team.primary_color).toBe('string')
        expect(Array.isArray(team.players)).toBe(true)
      }

      // Games + timeouts — numbers, never null.
      expect(typeof m.team_1_games_won).toBe('number')
      expect(typeof m.team_2_games_won).toBe('number')
      expect(typeof m.team_1_timeouts_used).toBe('number')
      expect(typeof m.team_2_timeouts_used).toBe('number')

      // Enrichment fields — string | null (omitempty in JSON, so they
      // can be absent; when present, must be strings).
      for (const key of ['division_name', 'tournament_name', 'court_name']) {
        if (m[key] !== undefined && m[key] !== null) {
          expect(typeof m[key]).toBe('string')
        }
      }

      // Booleans — never omitempty.
      expect(typeof m.is_paused).toBe('boolean')
      expect(typeof m.is_quick_match).toBe('boolean')
    })
  })

  describeMatch('GET /api/v1/matches/public/{publicID}/events — event shape', () => {
    it('returns events with canonical event_type + nested score_snapshot + timestamp', async () => {
      const { status, body } = await fetchJSON(
        `/api/v1/matches/public/${MATCH_PUBLIC_ID}/events`,
      )

      expect(status).toBe(200)
      expect(Array.isArray(body)).toBe(true)
      const events = body as unknown[]

      // Zero-event matches are legal (match just created, no events yet).
      // Skip per-event assertions in that case — the shape contract only
      // applies when events exist.
      if (events.length === 0) {
        return
      }

      for (const e of events) {
        expect(isObject(e)).toBe(true)
        const ev = e as Record<string, unknown>

        // Canonical fields (no created_at alias leaking as primary).
        expect(typeof ev.id).toBe('number')
        expect(typeof ev.match_id).toBe('number')
        expect(typeof ev.sequence_id).toBe('number')
        expect(typeof ev.timestamp).toBe('string')
        expect((ev.timestamp as string).length).toBeGreaterThan(0)

        // event_type must be one of the canonical constants. This is the
        // single most important assertion in this file — if the backend
        // renames or adds an event type without updating the frontend,
        // this test fails loudly.
        expect(typeof ev.event_type).toBe('string')
        expect(
          CANONICAL_EVENT_TYPES.has(ev.event_type as string),
          `event_type "${ev.event_type}" is not in CANONICAL_EVENT_TYPES — ` +
            `backend added a new event type without updating the frontend contract.`,
        ).toBe(true)

        // score_snapshot is an embedded object with numeric scores.
        expect(isObject(ev.score_snapshot)).toBe(true)
        const snap = ev.score_snapshot as Record<string, unknown>
        expect(typeof snap.team_1_score).toBe('number')
        expect(typeof snap.team_2_score).toBe('number')
        expect(typeof snap.current_set).toBe('number')
        expect(typeof snap.current_game).toBe('number')
        expect(typeof snap.serving_team).toBe('number')
        expect(typeof snap.server_number).toBe('number')
        expect(Array.isArray(snap.set_scores)).toBe(true)
      }
    })
  })
})
