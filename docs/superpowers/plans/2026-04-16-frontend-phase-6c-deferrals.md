# Frontend Phase 6C — Deferrals + Polish

> **For agentic workers:** Depends on Phase 6A + 6B. Read spec at `docs/superpowers/specs/2026-04-16-frontend-phase-6-design.md`.

**Goal:** Resolve D3 (licensing toggle), D4 (role dropdown — already done in 6B Task 2), progress docs, final verification.

---

### Task 1: D3 — Licensing Toggle

**Files:**
- Modify: `frontend/src/features/overlay/control/ControlPanel.tsx` (or wherever `isLicensed = false` is hardcoded)

Find the hardcoded `isLicensed = false` in the overlay control panel or renderer. Replace with a real check:

Option A (preferred): Read `isLicensed` from the overlay config API response (`GET /overlay/court/{courtID}/config`). The backend `CourtOverlayConfig` may already have a field, or the frontend can derive it from account status.

Option B (simpler): Add an `isLicensed` field to the overlay config hooks response. For now, default to `false` (free tier). The control panel should show a "Free Tier" badge when `isLicensed === false` and explain that the watermark is visible.

The actual billing/payment system is out of scope. This task just wires the flag so the watermark conditional works correctly.

Search the codebase for `isLicensed` to find all references:
```bash
grep -rn "isLicensed" frontend/src/
```

Commit: `fix(overlay): wire isLicensed from config instead of hardcoded false (D3)`

---

### Task 2: D4 Verification

D4 (role assignment UI with all 11 roles) was implemented in 6B Task 2 (UserDetail role dropdown). Verify it works:
- The Select dropdown in UserDetail.tsx contains all 11 role options
- The `useUpdateUserRole` hook calls `PATCH /admin/users/:id/role` with the selected role
- Backend migration 00030 allows all 11 values

No code change expected. Just verify and note in commit message.

---

### Task 3: Progress Doc + CHANGELOG

**Files:**
- Modify: `docs/superpowers/plans/2026-04-14-progress.md` — append Phase 6 completion section
- Modify: `CHANGELOG.md` — add Phase 6 entry

Progress section should include: sub-phase status (6A/6B/6C all DONE), commit SHAs, D3 + D4 resolution status, deferred items (D1 to Phase 7), verification output.

Commit: `docs(phase6): completion summary`

---

### Task 4: Final Verification

- `pnpm tsc -b --noEmit` — 0 errors
- `pnpm build` — clean
- `go build ./...` — clean (backend untouched but verify)
- `go test ./...` — all pass

Push all Phase 6 commits to origin/V2.

Report back with:
1. Final SHA on origin/V2
2. Verification output tails
3. Any outstanding issues
4. "Phase 6 complete. Stopping here."
