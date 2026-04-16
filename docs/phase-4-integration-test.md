# Phase 4 — Broadcast Overlay System — Integration Test Script

Manual end-to-end walkthrough for the Phase 4 overlay stack. Run after
Phase 4 merges to validate the full operator path: create court → pair
overlay → score live → trigger graphics → override data → revoke access.

**Prerequisites**

- Backend + frontend running via `make dev`.
- Logged in as a user with role `platform_admin`.
- Two browser windows side by side (control panel + OBS preview).
- OBS Studio or any "browser source" capable renderer (optional —
  the app's own `/overlay/court/$slug` route works as a stand-in).

---

## Step 1 — Create a standalone court via the setup wizard

1. Navigate to `/overlay/setup`.
2. In the **Create court** step: enter a name like `Stream Court 1`,
   leave the other fields at their defaults, submit.
3. Expect: a new court row appears in `/overlay` under "Your courts"
   with a slug matching the name.

**Pass criteria**

- Toast confirms creation.
- Wizard advances to step 2.
- `useAllCourts()` (via the landing page) lists the new court.

## Step 2 — Pick Court Command as the data source

1. On step 2 of the wizard, select `Court Command match` (default).
2. Click **Continue** to advance to the OBS URL step.

**Pass criteria**

- No source profile is created (internal source).
- `config.source_profile_id` for the new court is `null`.

## Step 3 — Copy the OBS URL and load the overlay

1. On step 3, click **Copy URL**. Expect the URL to land on the
   clipboard (look for the 2-second "Copied" badge).
2. Open the URL in a new tab — this plays the role of OBS.
3. Alternatively, click **Open preview** which targets
   `/overlay/court/$slug` in a new tab.

**Pass criteria**

- The overlay page loads with a transparent body.
- An empty / idle overlay renders (no match assigned yet).
- The "Powered By Court Command" watermark appears bottom-right.

## Step 4 — Start a match on the court and see it live

1. Navigate to `/tournaments` (or wherever matches are scheduled)
   and start a match on the new court. If no tournament exists,
   create one with a division + two teams + one bracket match, then
   assign the match to `Stream Court 1`.
2. Return to the overlay tab and the control panel tab.

**Pass criteria**

- Overlay renders the scoreboard with team names + zero scores.
- Control panel preview pane mirrors the overlay.
- The first-run banner (if it was showing) goes away once the
  elements config has at least one visible element.

## Step 5 — Score a point and see the update propagate

1. From the scorekeeper surface (or via the `POST /api/v1/matches/
   {publicID}/actions/score-point` endpoint) record a point for
   team 1.
2. Watch the OBS tab AND the control panel preview.

**Pass criteria**

- Scoreboard on OBS updates within ~250 ms (the WebSocket push).
- No page reload required — transport is `overlay:{courtID}` +
  `match:{publicID}` WS channels.
- Score pulse animation runs on the changed digit.

## Step 6 — Fire triggers from the control panel

1. Navigate to `/overlay/court/$slug/settings` → Triggers tab.
2. Fire each of the four trigger kinds in turn:
   - **Player card** (auto-dismiss 5 s)
   - **Team card** (Team 1 only, auto-dismiss 10 s)
   - **Match result** (manual dismiss)
   - **Custom text** (text `Welcome!`, zone `top`, auto-dismiss 5 s)

**Pass criteria**

- Each trigger appears on OBS for its configured lifetime.
- Auto-dismiss triggers disappear on schedule; manual ones stick
  until the operator clicks dismiss.
- Config toggles in the Elements tab for those same elements are
  NOT mutated — triggers operate through the queue, not config.
- Triggers persist across a tab reload (sessionStorage-backed),
  provided their auto-dismiss has not elapsed.

## Step 7 — Override team 1's name and score

1. Control panel → Overrides tab.
2. Toggle `team_1_name` → set to `Override Alpha`.
3. Toggle `team_1_score` → set to `99`.
4. Save (auto-saved on 400 ms debounce).

**Pass criteria**

- OBS shows `Override Alpha` as team 1's name.
- OBS shows `99` as team 1's score.
- The warning banner at the top of the Overrides tab lists the
  active overrides.
- Clicking **Clear all** removes both overrides and the overlay
  reverts to live data.

## Step 8 — Generate a token, test it, then revoke it

1. Control panel → OBS URL tab.
2. Click **Regenerate** (or **Generate** if no token yet).
3. Copy the URL that now includes `?token=...`.
4. Paste it in a new private-browsing tab — overlay should load.
5. Click **Revoke token** in the control panel and confirm.
6. Reload the private tab.

**Pass criteria**

- Step 4 renders the overlay successfully with the new token.
- Step 6 shows a 401/404 from the API or a blank overlay (the
  renderer stays silent on error by design).
- The OBS URL tab now shows the "No token" state and the token
  section exposes a **Generate** button.

---

## Regressions worth re-running

- **Producer monitor** at `/overlay/monitor`: shows new court,
  heat badges (MP / DEUCE / CLOSE) update as the match progresses.
- **TV/Kiosk** at `/tv/tournaments/$id`: auto-cycles hero →
  divisions → courts every 20 s; `?cycle=30` overrides the cadence.
- **Source profiles** at `/overlay/source-profiles`: create a
  REST profile, hit **Test connection** against
  `https://jsonplaceholder.typicode.com/posts/1`, expect
  `success: true`, discovered JSON paths in the dropdown.
- **OverlayDemo** at `/overlay/demo/modern` (or any theme id):
  renders demo data with watermark always visible, no WS.

## Known-good expected output references

- All 12 element keys: `scoreboard`, `lower_third`, `player_card`,
  `team_card`, `sponsor_bug`, `tournament_bug`, `coming_up_next`,
  `match_result`, `custom_text`, `bracket_snapshot`, `pool_standings`,
  `series_score`.
- 24 override keys across 5 groups (Team 1, Team 2, Match context,
  Branding, Match state). 7 numeric keys (scores, game wins,
  serving_team, server_number, current_game).
- WebSocket channels: `/ws/overlay/{courtID}`, `/ws/court/{courtID}`,
  `/ws/match/{publicID}`. Backoff 1 s → 30 s with close-by-unmount
  guard.
- 6 backend themes: classic, modern, minimal, bold, dark,
  broadcast_pro.

## Logging a failure

If any step fails, capture:
- Which step + sub-step
- Browser console output
- Relevant network requests (Chrome DevTools → Network tab, filter
  by `/api/v1/overlay` or `/ws`)
- WebSocket frames (`WS` tab)
- Current `config` JSON from `useOverlayConfig(courtID).data`

Paste those into a new issue tagged `phase-4-regression`.
