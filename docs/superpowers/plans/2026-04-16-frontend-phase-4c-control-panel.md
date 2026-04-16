# Frontend Phase 4C — Control Panel Plan

**Spec:** `docs/superpowers/specs/2026-04-16-frontend-phase-4-design.md` §5
**Depends on:** Phase 4B renderer complete

## Goal

Broadcast-operator UI at `/overlay/court/{slug}/settings` with split-screen preview (top) and 6 tabs of controls (bottom). All mutations push config to backend; WS makes renderer + preview update live.

## Task 1 — ControlPanel route + layout

`frontend/src/routes/overlay/court.$slug.settings.tsx`

```tsx
export const Route = createFileRoute('/overlay/court/$slug/settings')({
  component: ControlPanel,
})
```

Layout: flex-col h-screen. Top half (50vh): `PreviewPane`. Bottom half: TabLayout with 6 tabs.

Auth gate: `useAuth()` → must be broadcast-operator / tournament-director / head-referee / platform-admin. Use `ROLE_ALLOWLIST` set pattern from Phase 3 `RefMatchConsole`.

## Task 2 — PreviewPane with CSS-scaled OverlayRenderer

`frontend/src/features/overlay/control/PreviewPane.tsx`

Re-renders the same `OverlayRenderer` inside a scaled container:

```tsx
<div className="w-full h-full flex items-center justify-center bg-checkered">
  <div
    style={{
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: 1920,
      height: 1080,
      pointerEvents: 'none',
    }}
  >
    <OverlayRenderer />
  </div>
</div>
```

Compute `scale` via ResizeObserver on parent. Default: fit to width.

Checkered pattern bg shows transparency (classic DCC approach).

## Task 3 — Tab scaffolding

`frontend/src/features/overlay/control/ControlPanel.tsx`

Uses Phase 2 `TabLayout`. Six tabs:

```tsx
<TabLayout
  tabs={[
    { id: 'elements', label: 'Elements', component: <ElementsTab /> },
    { id: 'theme', label: 'Theme', component: <ThemeTab /> },
    { id: 'source', label: 'Source', component: <SourceTab /> },
    { id: 'triggers', label: 'Triggers', component: <TriggersTab /> },
    { id: 'overrides', label: 'Overrides', component: <OverridesTab /> },
    { id: 'obs', label: 'OBS URL', component: <ObsUrlTab /> },
  ]}
/>
```

## Task 4 — ElementsTab

- Group elements by zone: Top-left, Top-right, Top-center, Center, Bottom-left, Bottom (full-width), Overlays
- Each element: toggle (visible/hidden) + expand arrow for per-element settings
- Per-element settings examples:
  - **Scoreboard:** checkboxes for `serve_indicator_visible`, `game_history_visible`, `timeouts_visible`
  - **Sponsor Bug:** rotation speed slider (3s–30s)
  - **Custom Text:** text input + zone picker
- Uses `useUpdateElements()` mutation; optimistic update for instant preview

## Task 5 — ThemeTab

Three sections:
1. **Theme gallery:** grid of theme cards (from `useThemes()`). Click to select. Active theme highlighted.
2. **Color palette:** 11 community presets as swatches (Phase 1 `frontend/src/lib/themes.ts`). Click to apply.
3. **Custom colors:** 3 `<input type="color">` inputs: primary, secondary, accent. Debounce updates by 300ms.

All three push to `useUpdateTheme()` mutation.

## Task 6 — SourceTab

Radio group:
- **Court Command Match** (default)
- **External API**

If Court Command: dropdown of active matches scheduled to this court. If External API: dropdown of Source Profiles + "+ New Profile" button (routes to `/overlay/source-profiles/new`).

Shows:
- Current data source summary
- Last received data timestamp (polled every 5s)
- "Test Source" button (hits data endpoint once)

Uses `useUpdateSourceProfile()` mutation.

## Task 7 — TriggersTab

4 big buttons in a grid:
1. Show Player Card
2. Show Team Card
3. Show Match Result
4. Show Custom Text

Each opens a drawer (using Phase 1 `Modal`) with:
- Element-specific fields (e.g., player picker for Player Card)
- Auto-dismiss dropdown: **Manual (default)**, 5s, 10s, 30s
- Fire button

Active triggers list at the bottom:
- Each active trigger shows: name + started-at + dismiss button
- Manual triggers stay until dismissed
- Auto-dismiss triggers show countdown

`useTriggerQueue` hook manages active triggers. Sends PUT to `/config/elements` with visibility true; optional client-side `setTimeout` for auto-dismiss, calling PUT with visibility false.

## Task 8 — OverridesTab

Warning banner at top if any override active:

```tsx
{hasOverrides && (
  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
    ⚠ Data overrides are active. Real match data is being suppressed.
  </div>
)}
```

Grouped override list:
- **Teams:** team_1_name, team_1_score, team_1_color, team_2_name, team_2_score, team_2_color
- **Match context:** league_name, tournament_name, division_name, round_label, match_info
- **Match state:** serving_team, server_number, current_game
- **Optional:** sponsor list, logos

Each row:
- Label + current real value
- Checkbox: "Override"
- Override value input (enabled when checkbox checked)

"Clear All Overrides" button uses `useClearDataOverrides()` mutation.
Individual Revert buttons remove single override.

Uses `useUpdateDataOverrides()` for saves. Debounce inputs by 400ms.

## Task 9 — ObsUrlTab

Shows:
- Full OBS URL: `${window.location.origin}/overlay/court/${slug}${token ? `?token=${token}` : ''}`
- Copy-to-clipboard button
- Token section:
  - If token exists: "Active token: xxx... (Regenerate / Revoke buttons)"
  - If no token: "Generate Token" button
- Free-tier warning banner when `!config.is_licensed`:
  ```
  ⚠ This court will display the POWERED BY watermark.
  Upgrade to remove.
  ```

Uses `useGenerateToken()` + `useRevokeToken()` mutations.

## Task 10 — Smoke test

- Navigate to `/overlay/court/test-slug/settings`
- Verify preview scales correctly on different viewport widths
- Toggle an element → preview updates without page reload
- Change theme → preview re-skins
- Fire a trigger → preview shows the triggered element
- Set a data override → override value appears in preview
- Copy OBS URL → verify clipboard

## Task 11 — Documentation

Update CHANGELOG + progress.md.

## Acceptance

- [ ] Control panel renders at `/overlay/court/{slug}/settings`
- [ ] Preview pane scales correctly, pointer-events disabled
- [ ] All 6 tabs functional end-to-end
- [ ] Config changes propagate to renderer within 1s via WS
- [ ] Role gating works (non-operator users see 403)
- [ ] `pnpm tsc -b --noEmit` clean
- [ ] `pnpm build` clean

**Estimated: 1.5 days**
