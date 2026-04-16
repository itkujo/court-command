# Phase 3 Review Defects — Lessons Learned

**Date:** 2026-04-16
**Scope:** Lessons from the two-round review cycle on Frontend Phase 3 (Scoring & Match Operations).
**Audience:** Future phase planners/implementers. Load this doc at the start of any phase that involves new cross-layer contracts (new DB columns, new API fields, new event types, new WS channels).

---

## What happened

Phase 3 frontend landed with 7 critical contract-level defects between frontend and backend that both passed individual typecheck/build/test cycles but broke the integration:

1. **CR-1** — Event type casing mismatched across three layers. Backend writers emitted lowercase snake (`point_team1`, `side_out`, `timeout`). Override writer emitted SCREAMING_SNAKE (`SCORE_OVERRIDE`). Backend reader in `enrichedMatchResponse` queried `TIMEOUT_CALLED` (never written anywhere). Frontend `EventType` union declared SCREAMING_SNAKE (`POINT_SCORED`, `TIMEOUT_CALLED`, etc.) so `EVENT_META[event.event_type]` looked up nothing.
2. **CR-2** — `MatchEventResponse` wire shape mismatch. Backend emitted `{created_at, flat team_1_score/team_2_score/set_scores/...}`. Frontend read `{timestamp, score_snapshot}`. `formatEventTime(e.timestamp)` always got undefined.
3. **CR-3** — Single-line typo in backend: `EventType: "TIMEOUT_CALLED"` at `service/match.go:313` didn't match the string `"timeout"` actually written by `CallTimeout`. Timeouts counter silently always zero.
4. **CR-4** — `broadcastMatchUpdate` ran enrichment internally, then every scoring action also ran enrichment on its return value. Same match enriched twice per write, ~10 extra DB round-trips per point scored.
5. **CR-6** — Platform-wide `ListCourts` returned flat `CourtResponse` without `active_match`/`on_deck_match` even though the struct exposed those fields. Ref/scorekeeper home grids showed "Available" on every card and navigated to the wrong route.
6. **CR-7** — `MatchResponse.ScoredByName` declared on the response struct, never populated by any service code (no column existed). Every client saw `null`.
7. **CR-8** — `ConfirmMatchOver` winner-inference fell through when games tied and IDs weren't supplied: `UpdateMatchResult` skipped, match row committed as `status='completed'` with `winner_team_id IS NULL`. Bracket advancement would silently break.

Plus two cross-cutting mistakes:
- **I-7** — Zero tests shipped with any of the 9 remediation commits. Three of the 8 critical findings would have been caught by a single happy-path assertion each.
- **I-11** — The `C5` remediation commit claimed to fix winner inference but reintroduced the exact failure mode under a different input shape (tied games).

---

## Root cause analysis

### RC1: No shared contract artifact between frontend and backend

The frontend `Match`, `MatchEvent`, `CourtSummary`, `MatchEventResponse`, and `EventType` types were hand-written in `frontend/src/features/scoring/types.ts`. The backend counterparts were hand-written in `backend/service/match.go` and `backend/service/venue.go`. No generator, no validator, no compile-time link between them.

Every string field name (`team_1_score` vs `team1_score`, `timestamp` vs `created_at`), every enum literal (`POINT_SCORED` vs `point_team1`), and every nested object (`team_1` vs flat `team1_id`) was a free variable both sides could diverge on silently.

Backend changed without frontend noticing. Frontend built, backend built, tests passed. The mismatch only appeared at the boundary — at runtime, in browser devtools, after someone clicked a real button.

### RC2: Integration tests don't exist

There is not a single test in this codebase that fires a real HTTP request, reads the JSON response, and asserts the shape matches what the frontend's TypeScript types declare. All backend tests are unit tests on service/engine packages. All frontend tests are... not written yet. There is nothing that would catch a backend JSON field rename.

### RC3: Reviewers can catch structural drift but miss casing drift

Both the spec-compliance reviewer and the code-quality reviewer correctly verified that "timeouts used" field existed on the response, "event type was serialized," and "winner inference was called." They did NOT notice that the specific STRINGS didn't match. Casing drift is invisible at code-review granularity when the compared sides live in different files in different languages.

Even humans doing detailed code reviews missed these. Structural review is fine. Character-exact review of stringly-typed contracts requires tooling.

### RC4: Event-type strings were not colocated with the type union

`backend/service/match.go` had `CreateMatchEventParams{EventType: "timeout"}` inline in the `CallTimeout` method. Not as a constant. Not next to the reader. Not next to the frontend type. A dev grep-ing for "TIMEOUT_CALLED" in the backend finds zero references to the actual written string.

### RC5: Remediation was treated as "finishing" without a second-round review

The 9 remediation commits on Phase 3 were merged and pushed without a re-review round. The defects were then found by the post-hoc reviews. When review is the enforcement mechanism, every code-change cycle (implementation, remediation, polish) needs a review. Not just the initial build.

---

## Prevention checklist (load this at every phase start)

When a new phase introduces or modifies cross-layer contracts, stop and verify these explicitly before ANY implementation begins. A plan that doesn't commit to this checklist has a 30–50% chance of shipping the same class of defects.

### Contract surface inventory

1. **List every new/changed type that crosses the boundary** (HTTP response, WS payload, event record, URL param, query string).
2. **For each, identify the authoritative source:** is it generated from the DB schema? Hand-written Go? Hand-written TypeScript? If both sides are hand-written without a generator, that's the risk signal.
3. **For each field with a stringly-typed value** (enum literal, event type, status discriminator, role name, channel name, WS message type), extract that string to a shared **named constant** on the writing side. Same side names the reader.

### Stringly-typed contract enforcement

4. **Never embed an event-type literal inline in a `CreateXxxParams{...}` call.** Use `const EventType_PointScored = "point_scored"` (or whatever the canonical casing is) and reference it from writer AND reader. If the writer ever gets a different string from the reader, it's a compile-time problem, not a runtime surprise.
5. **Document the canonical casing convention once, at the top of the affected package.** "All event types are lowercase snake_case." "All WS channel types are uppercase SCREAMING_SNAKE." "All status discriminators are lowercase snake_case." Don't mix.
6. **Never have a reader query a string that doesn't exist as a constant somewhere else in the same language.** If `EventType: "TIMEOUT_CALLED"` appears in one place, the string `"TIMEOUT_CALLED"` must appear somewhere as a writer, or the code is dead.

### Response shape enforcement

7. **When adding a struct field to an API response, verify it is populated by the same commit that declares it.** If `MatchResponse.ScoredByName` is added to the struct, the same diff must include the code that writes to it. If it requires a schema change, do the schema change. If it can't be populated right now, don't add the field.
8. **When the frontend reads a field, verify the wire emission side.** A frontend referencing `event.timestamp` should grep the backend for the string `"timestamp"` in a JSON tag position. If zero matches, stop — the field isn't real.

### Enrichment and hot-path performance

9. **Never call enrichment inside a broadcast helper that is also called inside a mutation.** The mutation will return the enriched payload anyway. Enrich once, broadcast the enriched value, return the enriched value. `broadcastMatchUpdate(enriched)` instead of `broadcastMatchUpdate(raw) { enriched := enrich(raw); publish(enriched) }`.
10. **Count DB sub-queries per hot-path mutation.** If any hot path (scoring a point, joining a session, tick of a live feed) exceeds 3 DB round-trips, flag it. Batch or use a JOIN query instead.

### Data integrity fall-through

11. **For every "if X and Y: do the thing" inference guard, ask: what happens if X or Y is false?** If the answer is "we silently skip the side effect," that's a data-integrity bug waiting. Either raise a validation error, or pick an explicit default.
12. **For every schema transition (migration), consider the Down path.** Users promoted to new roles under Up must be demoted or flagged before the Down CHECK constraint reasserts. Otherwise the migration is one-way in practice.

### Test coverage

13. **Every remediation commit that changes a stringly-typed contract MUST include a test that would fail if the string drifted again.**
   - Backend test that asserts the exact JSON tag of the response.
   - Backend test that asserts the exact event-type string written by a mutation.
   - Frontend test that asserts the exact event-type literal union members.
   - Integration test that fires the real HTTP endpoint and reads the response.

14. **Review is not optional after remediation.** Any commit batch that claims to fix review findings must itself be reviewed before it is considered done. Otherwise the second-order defects (I-11 — winner inference "fix" reintroduced the same bug) escape.

---

## What to do in Phase 4+ brainstorm/plan docs

When writing a new phase plan:

1. **First Task in every plan** must be: "Verify that all field names, event-type strings, and enum literals needed by this phase match between frontend and backend." This is a grep-and-check task, not a write task.
2. **Every new event type, channel, role, or status** introduced by the phase must be defined once (as a Go const) and once (as a TypeScript literal union member). Put the const pair in the plan as an explicit artifact.
3. **Every new API field** added by the phase must be accompanied by a statement of which side is authoritative (DB column → Go struct → JSON tag → TS type) and a check that the chain is unbroken.
4. **Every hot-path mutation** that will broadcast via WS must explicitly state: how many DB round-trips per call. If >3, the plan must document the batching strategy.
5. **Every inference guard** (winner from scores, status from events, etc.) must explicitly document: what is the fallback when the inference can't be made. No silent no-ops.

---

## The 7 Phase 3 defects — preventable-by-checklist audit

| Defect | Preventable by checklist item |
|--------|-------------------------------|
| CR-1 event casing | #4 (no inline event-type literals), #5 (casing convention document), #6 (no orphan reader strings) |
| CR-2 event shape | #7 (populate when declaring), #8 (grep both sides) |
| CR-3 timeout typo | #4, #6 |
| CR-4 double enrichment | #9, #10 |
| CR-6 ListCourts unenriched | #7 |
| CR-7 ScoredByName phantom field | #7 |
| CR-8 winner tie fallthrough | #11 |

All 7 defects are individually cheap to prevent. Collectively they cost ~8 hours of review + remediation work. The checklist is an investment of ~15 minutes per phase-plan-drafting session.

---

## References

- `docs/superpowers/plans/2026-04-14-progress.md` — Phase 3 final review cycle section
- `CHANGELOG.md` — Phase 3 "Known deferred defects" note (CR-4/CR-5/I-7)
- Git commits `d0b665b..beb282a` — the remediation batch that triggered these findings
