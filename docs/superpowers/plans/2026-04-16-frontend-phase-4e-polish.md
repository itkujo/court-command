# Frontend Phase 4E — Polish

**Spec:** `docs/superpowers/specs/2026-04-16-frontend-phase-4-design.md` §10–§14
**Depends on:** Phase 4D complete

## Goal

Final polish, a11y audit, integration smoke tests, and documentation updates to close Phase 4.

## Task 1 — Trigger auto-dismiss timers

Finalize `useTriggerQueue` in `frontend/src/features/overlay/control/triggers/useTriggerQueue.ts`:
- On fire: store trigger with `startedAt` + `autoDismissMs | null`
- If `autoDismissMs !== null`: `setTimeout` to call `useUpdateElements` with visibility false after interval
- On manual dismiss: clear timeout + immediate update
- Countdown display in active-triggers list updates every second via `setInterval`

Defaults per Q13: **MANUAL** by default. Dropdown offers Manual, 5s, 10s, 30s.

## Task 2 — OverlayDemo page

`frontend/src/features/overlay/demo/OverlayDemo.tsx`
Route: `/overlay/demo/$themeId` → `frontend/src/routes/overlay/demo.$themeId.tsx`

Public, no auth. Renders `OverlayRenderer` with:
- Explicit theme from URL param
- `useOverlayData` replaced with demo data (hits `GET /api/v1/overlay/demo-data`)
- No WS subscription
- Watermark always visible ("demo" tier)

Used for marketing / theme selection preview on `/overlay` landing page.

## Task 3 — a11y audit (control panel)

**Scope:** WCAG 2.2 AA on control panel. Renderer + TV/Kiosk are broadcast output (WCAG-exempt).

Checks:
- Keyboard navigation: tab through all 6 tabs + elements within each tab
- Focus rings visible on all interactive elements (uses Phase 1 `--color-accent`)
- Aria-live region in TriggersTab active-triggers list
- Aria-labels on icon-only buttons (dismiss, regenerate, etc.)
- Color contrast: run through WebAIM contrast checker for light + dark themes
- Screen reader announcements for mutation success/failure (use `useToast` which already has aria-live)

## Task 4 — Error boundary

Wrap `OverlayRenderer`, `ControlPanel`, `ProducerMonitor`, `TVKioskBracket` in `ErrorBoundary` from Phase 1.

For renderer + TV/Kiosk: on error, render `null` (not an error screen — nothing goes to OBS). Log via console.error.

## Task 5 — First-run wizard detection

In `ControlPanel`: if `config.theme_id === null || config.elements === {}`, show a dismissible banner: "First time setting up this overlay? Try the setup wizard" → links to `/overlay/setup`.

## Task 6 — Sidebar overlay landing improvements

`frontend/src/routes/overlay/index.tsx`:
- Welcome message
- Quick links: Setup Wizard, Source Profiles, Monitor
- "Your courts" section: list courts user has access to, with per-court card showing last-active match + "Open Control Panel" button
- If user has no courts: big CTA "Create your first court" → wizard

## Task 7 — Licensing UI hooks

Currently `config.is_licensed` is read-only in frontend. For Phase 6 (admin), prep hooks:
- `useToggleLicense(courtId)` mutation stub hitting (to-be-built) `PATCH /api/v1/admin/courts/:id/license`
- Flag as "Phase 6 dependency" in code comment

Don't build the admin UI; Phase 4E is just client-side ready-state.

## Task 8 — End-to-end integration test

Manual script documented in a new file `docs/phase-4-integration-test.md`:

1. Create a new user, log in
2. Run setup wizard → create court "test-stream" with external API source
3. Verify overlay URL works in OBS (or simulate with browser)
4. Open control panel, change theme, verify preview updates
5. Trigger a Player Card; verify preview shows it; dismiss manually
6. Set a data override on team_1_name; verify override appears in preview
7. Copy OBS URL; paste in second tab; verify same content
8. Delete the court; verify overlay URL 404s gracefully

## Task 9 — CHANGELOG + progress.md + README

- `CHANGELOG.md`: add Phase 4 section listing all 8 surfaces shipped + Phase 3 remediation
- `docs/superpowers/plans/2026-04-14-progress.md`: append "Phase 4 Complete" section
- `README.md`: add "Overlays" section with setup URL + link to spec + quickstart

## Task 10 — Final smoke test + sign-off

- `pnpm tsc -b --noEmit` clean
- `pnpm build` clean
- `go build ./...` + `go vet ./...` + `go test ./...` clean (all contract tests from 4A green)
- Manually verify every acceptance criterion from spec §14

## Acceptance

- [ ] All trigger timers working (manual + 5s/10s/30s)
- [ ] OverlayDemo public route renders
- [ ] Control panel passes WCAG 2.2 AA keyboard nav + screen reader
- [ ] Error boundaries in place
- [ ] First-run banner shows on empty config
- [ ] Overlay landing page helpful for new users
- [ ] License toggle hook stubbed for Phase 6
- [ ] Integration test doc written + passed
- [ ] CHANGELOG + progress.md + README updated
- [ ] All builds + tests green

**Estimated: 1 day**

---

## Phase 4 Overall Sign-Off

When 4A + 4B + 4C + 4D + 4E are all complete:

1. Squash or reword commits if any are inaccurate
2. Tag branch `phase-4-complete` on V2
3. Push to origin/V2
4. Report to user: Phase 4 shipped, Phase 5 next (Public Directory + Player Dashboard)
