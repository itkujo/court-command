# Phase Launch Manifest

**Purpose:** One file to launch any remaining phase in a fresh agent session without rediscovery.

Read this first, then the linked spec and plans for the phase being executed.

---

## How to use this file

1. Read this entire file (takes 2 min).
2. Read the spec and all plans for the phase you're running (links below).
3. Read `docs/superpowers/lessons/` for any prevention checklists that match.
4. Read `docs/superpowers/plans/2026-04-14-progress.md` for the latest known state.
5. Execute. Stop and summarize when done or blocked.

---

## Repo state (update when phase completes)

- **Branch:** `main` tracking `origin/V2`
- **Working dir:** `/Users/phoenix/code/court-command-v2/new-cc/`
- **Current HEAD:** see `git log -1` (updated per phase)
- **Backend:** Go, Chi, pgx, sqlc, Goose — `cd backend && go build ./... && go vet ./... && go test ./...`
- **Frontend:** React 19, Vite, TanStack Router, TanStack Query, Tailwind v4 — `cd frontend && pnpm tsc -b --noEmit && pnpm build`
- **Start local:** `make dev` (brings up Postgres + Redis + backend on :8080 + frontend on :5173)

---

## Phase status

| Phase | State | Primary docs |
|---|---|---|
| Backend 1–8 | COMPLETE | `plans/2026-04-14-phase-{1..8}-*.md` |
| Frontend Phase 1 (Foundation) | COMPLETE | `specs/2026-04-15-frontend-phase-1-design.md`, `plans/2026-04-15-frontend-phase-1.md` |
| Frontend Phase 2 (Tournaments) | COMPLETE | `specs/2026-04-15-frontend-phase-2-design.md` |
| Frontend Phase 3 (Scoring) | COMPLETE | `specs/2026-04-15-frontend-phase-3-design.md`, `plans/2026-04-15-frontend-phase-3{a..e}-*.md`, `lessons/2026-04-16-phase-3-review-defects.md` |
| Frontend Phase 4 (Broadcast Overlay) | COMPLETE | `specs/2026-04-16-frontend-phase-4-design.md`, `plans/2026-04-16-frontend-phase-4{a..e}-*.md` |
| Frontend Phase 5 (Public Directory + Player Dashboard) | COMPLETE | `specs/2026-04-16-frontend-phase-5-design.md` |
| Frontend Phase 6 (Admin) | COMPLETE | `specs/2026-04-16-frontend-phase-6-design.md` |
| Frontend Phase 7 (Polish + PWA + a11y) | **COMPLETE — FINAL PHASE** | Accessibility audit+fixes, performance+PWA, D1 bracket/pool data |

---

## Working rules (all phases)

### Execution order
1. Read the spec for the phase.
2. Read the plan files for each sub-phase in order.
3. Execute sub-phases **strictly** in order (4A → 4B → 4C → ...). Do not parallelize.
4. Commit per logical unit within a sub-phase; push to `origin/V2` when the sub-phase is complete.
5. Do **not** self-review. If the phase needs a review, the operator will launch a reviewer in a separate session.

### Phase 3 defect fold-in (Phase 4A only)
If you are running Phase 4A, **Task 1 is blocking** and addresses these defects carried from Phase 3:
- CR-1 Event type casing mismatch across backend writer/reader and frontend.
- CR-2 `MatchEventResponse` shape mismatch (`timestamp`/`score_snapshot`).
- CR-3 Timeout event type typo (backend/service/match.go reader queries `TIMEOUT_CALLED`; writer emits `timeout`).
- CR-4 Double enrichment in `broadcastMatchUpdate` on scoring hot path.
- CR-6 `ListCourts` returns unenriched courts (breaks ref entry flow).
- CR-7 `MatchResponse.ScoredByName` declared but never populated (recommendation: remove field).
- CR-8 Winner/loser tie case silently skips `UpdateMatchResult`.
- New file: `backend/service/match_contract_test.go` with 5–7 invariant assertions.
See `lessons/2026-04-16-phase-3-review-defects.md` for the prevention checklist.

### Commit hygiene
- `git commit -m "type(scope): message"` — conventional commits.
- Push to `origin/V2` after each sub-phase completes (not after every commit).
- Never rebase or force-push shared branches.

### Required verification per sub-phase
- Backend changes: `go build ./... && go vet ./... && go test ./...` all green.
- Frontend changes: `pnpm tsc -b --noEmit && pnpm build` all green.
- Do not mark a sub-phase complete until these pass.

### Stop conditions
- Blocked by missing context → stop, summarize, ask.
- Repeated test failure on the same step → stop, summarize, ask.
- Scope creep (spec says one thing, plan says another) → stop, follow spec, flag in summary.
- Context pressure (emergency warnings) → compress older resolved history, continue.

---

## Codebase patterns (carry across all phases)

### Frontend
- Imports: **relative paths** (`../../../lib/api`). Do not use `@/` aliases.
- Toast: `const { toast } = useToast(); toast('success'|'error'|'warning'|'info', message)`
- Modal: `<Modal open onClose title>{children}</Modal>` — body already has `px-6 py-4` padding, do not wrap children with additional padding.
- ConfirmDialog: `{ open, onClose, onConfirm, title, message, confirmText?, variant?, loading? }` — **default variant is `'danger'`**. Use `variant="primary"` for non-destructive confirmations.
- Button variants: `primary | secondary | danger`.
- Badge variants: `success | warning | error | info | neutral` (not `danger`).
- TanStack Router Link: typed `to` + `params` (never template strings). After new route files, run `pnpm build` (or `pnpm dev` briefly) to regenerate `routeTree.gen.ts`. That file is **gitignored** — do not commit it.
- FormField has no `hint` prop — render hints as sibling `<p>`.
- CSS tokens: use `text-(--color-text-primary)` / `bg-(--color-bg-secondary)` / `border-(--color-border)` style via Tailwind v4 arbitrary values. Tokens defined in `frontend/src/styles.css`.
- API wrapper: `apiGet/apiPost/apiPatch/apiDelete/apiGetPaginated` from `lib/api.ts` with `credentials: 'include'`.
- TanStack Query: stable `queryKey` arrays, `enabled` guards, mutations invalidate or `setQueryData` consistently.
- WebSocket: use hook `useMatchWebSocket(publicId)` — path is `/ws/match/{publicID}` (singular on backend).

### Backend
- Service errors: `&ValidationError{}`, `&NotFoundError{}`, `&ConflictError{}`, `&ForbiddenError{}` — map via `HandleServiceError(w, err)` in handlers.
- Role gating: backend `users.role` CHECK allows the 11 roles in migration `00030_expand_user_roles.sql`.
- Router pattern: public reads outside `RequireAuth`, writes inside. See `backend/router/router.go` for the single-Mount-per-path chi rule.
- sqlc: queries in `backend/db/queries/*.sql`, generated into `backend/db/generated/`. Run `sqlc generate` after SQL changes.
- Migrations: Goose in `backend/db/migrations/`. Append-only, forward-only in practice.

---

## Speedup package (applied from Phase 4 onward)

Saves ~11–17 hrs over the remaining four phases. Confirmed with operator. Apply unless a sub-phase explicitly says otherwise.

1. **Single review after 4A only** (not per sub-phase). 4A is the foundation — review once, then 4B/C/D/E ride on it.
2. **One plan per sub-phase** (not one plan per surface).
3. **Reuse Phase 1–3 components** whenever possible (e.g. Phase 2 bracket, Phase 3 `MatchScoreboardPage`).
4. **Known-deviations doc at sub-phase start** — if you discover a backend/frontend contract mismatch, log it in the sub-phase commit message and the progress doc rather than halting for a review round.
5. **Skip review on tiny cleanup batches** (<100 LOC, no public API changes).
6. **Batch sub-phases in one subagent** when running via subagent delegation.

**Do not** skip any of these without operator sign-off:
- Phase 3 defect fold-in at 4A Task 1.
- Full typecheck + build before marking a sub-phase complete.
- Commit + push per sub-phase.

---

## Context management (for the agent executing a phase)

The executing agent will hit context pressure. Plan for it:
1. **Read once, reason from memory.** Read each plan file once at sub-phase start. Don't re-read mid-task.
2. **Compress aggressively.** When you see an emergency warning, compress older resolved message ranges immediately — don't wait for mid-task.
3. **Disk is cheap.** Write interim notes, deviations, and TODOs to the progress doc or a scratch file under `docs/superpowers/plans/_scratch-<phase>-<date>.md`. Commit if useful; delete if not.
4. **One sub-phase = one session's worth of context.** If you run dry mid-sub-phase, stop and summarize for operator to launch a continuation session.
5. **Do not re-explore.** Everything you need is in the spec, plans, lessons, and this file. Trust them.

---

## New-phase bootstrapping (Phases 5–7)

When starting Phase 5, 6, or 7, the operator will:
1. Brainstorm in a fresh session (operator-guided).
2. Write the spec to `docs/superpowers/specs/YYYY-MM-DD-frontend-phase-N-design.md`.
3. Write sub-phase plans to `docs/superpowers/plans/YYYY-MM-DD-frontend-phase-N{a..e}-*.md`.
4. Update this file's **Phase status** table.
5. Launch execution in a fresh session using a handoff prompt that references this file and the new spec/plans.

Template for the handoff prompt:

```
You are executing Frontend Phase {N} of the Court Command v2 rebuild.

Read FIRST, in order:
1. /Users/phoenix/code/court-command-v2/new-cc/docs/superpowers/PHASE_LAUNCH.md
2. /Users/phoenix/code/court-command-v2/new-cc/docs/superpowers/specs/YYYY-MM-DD-frontend-phase-N-design.md
3. All plan files matching docs/superpowers/plans/YYYY-MM-DD-frontend-phase-N*.md
4. docs/superpowers/lessons/ — any relevant prevention checklists
5. docs/superpowers/plans/2026-04-14-progress.md — latest state

Then:
- Execute sub-phases in strict order.
- Commit per logical unit. Push to origin/V2 per sub-phase.
- Verify (typecheck + build + tests) before marking a sub-phase complete.
- Stop and summarize when done or blocked.

Working dir: /Users/phoenix/code/court-command-v2/new-cc/
Branch: main tracking origin/V2.
```

---

## Operator notes

- The `docs/superpowers/` tree is the source of truth. Any decision not in there can be questioned.
- The **progress doc** (`plans/2026-04-14-progress.md`) is appended each phase, not rewritten. Treat it as a changelog for decisions.
- The **lessons folder** is for prevention checklists carried forward. Add a new file after any phase that escaped defects in review.
- When in doubt, spec > plan > commit message > this file > chat history.
