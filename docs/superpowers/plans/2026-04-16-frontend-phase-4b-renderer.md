# Frontend Phase 4B — OBS Renderer Plan

**Spec:** `docs/superpowers/specs/2026-04-16-frontend-phase-4-design.md` §4 + §5
**Depends on:** Phase 4A complete (canonical types, hooks, ThemeProvider)

## Goal

Production-ready OBS browser source at `/overlay/court/{slug}` rendering all 12 elements, consuming live WS updates, displaying watermark for unlicensed courts, transparent chromeless body.

## Task 1 — Element component scaffolding

Create skeleton for all 12 elements under `frontend/src/features/overlay/renderer/elements/`. Each:
- Reads `OverlayData` + `config.elements[elementKey]` via props
- Returns `null` when `config.visible === false`
- Uses theme CSS custom properties (`--color-bg`, `--color-accent`, etc.)
- Pure presentational, no internal state

Elements: `ScoreboardElement`, `LowerThirdElement`, `PlayerCardElement`, `TeamCardElement`, `SponsorBugElement`, `TournamentBugElement`, `ComingUpNextElement`, `MatchResultElement`, `CustomTextElement`, `BracketSnapshotElement`, `PoolStandingsElement`, `SeriesScoreElement`.

Commit each element as it's built. Group related elements (e.g., Scoreboard + LowerThird together).

## Task 2 — Scoreboard element (highest detail)

Zone: bottom-left fixed position.

Sub-components:
- Team rows (team 1 + team 2): color bar + short name + player initials + score
- Serve indicator (triangle next to serving team)
- Game history dots (per-game scores)
- Timeout indicators
- Match context bar (division + round)

Animations via Motion:
- Score pulse on change (scale 1 → 1.1 → 1 over 300ms)
- Game-over flash (yellow bg flash once)
- Match-over glow (winner team bg glows slowly)

## Task 3 — Lower Third element

Full-width bottom banner. Slides up from below on show, fades out on hide. Shows tournament name + division + round + match info. Background uses theme accent color.

## Task 4 — Player Card + Team Card elements

Center-bottom overlay. Scale-in + fade-in. Shows:
- **Player:** photo + name + rating + team badge + hometown
- **Team:** logo + name + player list + record

Auto-dismiss: controlled by Triggers tab (Phase 4C). Phase 4B just renders when `config.visible=true`.

## Task 5 — Sponsor Bug + Tournament Bug elements

- **Sponsor Bug:** top-right corner. If `config.sponsors` is an array, cross-fade every N seconds (default 8000).
- **Tournament Bug:** top-left corner. Static. Shows league + tournament logo + name.

## Task 6 — Coming Up Next + Match Result elements

- **Coming Up Next:** top-center pill showing next match on court (team 1 vs team 2 + time)
- **Match Result:** center-full overlay after match completes. Shows "WINNER: {team}" with glow + confetti (reusable react-confetti library or CSS-only fallback).

## Task 7 — Custom Text element

Configurable zone (top/center/bottom). Shows arbitrary operator text. Fade in/out.

## Task 8 — Bracket Snapshot + Pool Standings elements

- **Bracket Snapshot:** center-full overlay. Reuses Phase 2 bracket renderer in read-only mode. Fade-in + scroll-reveal per round.
- **Pool Standings:** center-full overlay. Table with stagger animation on rows.

## Task 9 — Series Score element

Top-right below sponsor bug (if present). Shows dot grid for series-of games (e.g., 2-1 in BO5 = 2 filled dots, 1 empty, 2 more slots). Dot pulses on game completion.

## Task 10 — Assemble OverlayRenderer

Replace Phase 4A stub with real implementation:

```tsx
export function OverlayRenderer() {
  const { slug } = Route.useParams()
  const { token } = Route.useSearch()
  const configQuery = useOverlayConfig(slug)
  const dataQuery = useOverlayData(slug, token)
  useOverlayWebSocket(configQuery.data?.court_id, dataQuery.data?.match_public_id)

  // set transparent body
  useEffect(() => {
    document.body.style.background = 'transparent'
    return () => { document.body.style.background = '' }
  }, [])

  if (configQuery.isLoading || dataQuery.isLoading) return null
  if (configQuery.isError || dataQuery.isError) return null

  const data = dataQuery.data
  const config = configQuery.data

  return (
    <ThemeProvider theme={config.theme} palette={config.palette} customColors={config.custom_colors}>
      <div className="w-[1920px] h-[1080px] relative">
        <ScoreboardElement config={config.elements.scoreboard} data={data} />
        <LowerThirdElement config={config.elements.lower_third} data={data} />
        <PlayerCardElement config={config.elements.player_card} data={data} />
        <TeamCardElement config={config.elements.team_card} data={data} />
        <SponsorBugElement config={config.elements.sponsor_bug} data={data} />
        <TournamentBugElement config={config.elements.tournament_bug} data={data} />
        <ComingUpNextElement config={config.elements.coming_up_next} data={data} />
        <MatchResultElement config={config.elements.match_result} data={data} />
        <CustomTextElement config={config.elements.custom_text} data={data} />
        <BracketSnapshotElement config={config.elements.bracket_snapshot} data={data} />
        <PoolStandingsElement config={config.elements.pool_standings} data={data} />
        <SeriesScoreElement config={config.elements.series_score} data={data} />
        {!config.is_licensed && <OverlayWatermark />}
      </div>
    </ThemeProvider>
  )
}
```

## Task 11 — Watermark

`frontend/src/features/overlay/renderer/OverlayWatermark.tsx`:

```tsx
export function OverlayWatermark() {
  return (
    <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 text-white text-xs font-medium tracking-wide rounded-full opacity-70 uppercase z-50">
      Powered By Court Command
    </div>
  )
}
```

## Task 12 — Smoke test

Start dev server. Open `/overlay/court/test-slug` with:
- Valid court + active match → all visible elements render
- Invalid court → graceful fallback
- Unlicensed court → watermark visible
- Licensed court → no watermark

## Task 13 — Documentation

Update CHANGELOG + progress.md.

## Acceptance

- [ ] All 12 elements render without errors
- [ ] WS updates propagate to UI without page reload
- [ ] Watermark appears only when `is_licensed=false`
- [ ] Transparent body; no chrome
- [ ] `pnpm tsc -b --noEmit` clean
- [ ] `pnpm build` clean

**Estimated: 1.5 days**
