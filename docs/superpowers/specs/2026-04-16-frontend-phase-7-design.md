# Frontend Phase 7 — Polish, PWA, Accessibility

## Overview

Final frontend phase. Four areas: accessibility audit + fixes, performance optimization, PWA setup, and D1 (BracketSnapshot + PoolStandings overlay data pipeline). After this phase the product enters bug testing.

## 1. Accessibility (WCAG 2.2 AA)

### Audit scope
Every page surface built in Phases 1-6: auth pages, registry (players/teams/orgs/venues/courts), tournament + league management, scoring consoles (ref + scorekeeper), match detail, overlay control panel, admin panel, public landing, dashboard, search modal.

### Required fixes (common patterns from prior phases)
- All clickable `<div>` and `<tr>` elements need `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
- Focus management: modals must trap focus and return it on close (verify `Modal.tsx` uses `<dialog>` correctly)
- Color contrast: verify all CSS custom property combinations meet 4.5:1 ratio (text) and 3:1 (large text/UI)
- Skip-to-content link already exists in `__root.tsx` — verify it targets `#main-content`
- Form labels: every input must have an associated `<label>` or `aria-label`
- Error announcements: form validation errors should use `aria-live="polite"` or `role="alert"`
- Images: all `<img>` tags need meaningful `alt` text or `alt=""` for decorative
- Keyboard navigation: tab order must be logical on every page; scoring console shortcuts (1/2/S/Z/T) already implemented

### Tooling
Run `axe-core` via browser devtools on each major page type. Document findings. Fix all Critical + Serious. Note Minor as tech debt.

## 2. Performance

### Bundle analysis
- Run `pnpm build --report` or `npx vite-bundle-visualizer` to identify large chunks
- TanStack Router already code-splits per route (`autoCodeSplitting: true` in vite.config.ts)
- Target: main bundle < 250 kB gzipped

### Optimization targets
- **Lazy imports**: heavy components (overlay renderer, bracket viewer, admin panel) should be lazy-loaded if not already
- **Image optimization**: verify `ImageUpload` component uses reasonable dimensions; add `loading="lazy"` to non-critical images
- **Search debounce**: already 300ms in `useDebounce` — verify all search inputs use it
- **Query caching**: verify `staleTime` is set appropriately (5min for lists, 30s for live scoring)
- **React.memo**: wrap pure display components that re-render on parent state changes (e.g., `InfoRow`, `Badge`, scoreboard elements)

### Lighthouse targets
- Performance: > 80
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 80

## 3. PWA

### Manifest
Create `frontend/public/manifest.json`:
- `name`: "Court Command"
- `short_name`: "CC"
- `start_url`: "/"
- `display`: "standalone"
- `theme_color`: dark theme primary
- `background_color`: dark theme bg
- `icons`: use existing logo SVGs, generate PNG variants at 192x192 and 512x512

### Service Worker
Use `vite-plugin-pwa` for zero-config service worker:
- Cache strategy: network-first for API calls, cache-first for static assets
- Offline shell: show "You're offline" banner when network unavailable (not full offline mode — scoring requires network per spec Cat 8)
- Update prompt: show "New version available — Refresh" toast when SW detects update

### Install prompt
Add install banner for mobile users (A2HS). Show once, dismiss persisted in localStorage.

## 4. D1: BracketSnapshot + PoolStandings Overlay Data

### Current state
- Overlay renderer has `BracketSnapshot` and `PoolStandings` element components (Phase 4)
- Backend `OverlayData` contract in `backend/overlay/contract.go` does NOT include bracket/pool fields
- Backend `overlay/resolver.go` does NOT populate bracket or pool data

### Required changes

**Backend:**
- Add `BracketData` and `PoolData` fields to `OverlayData` struct in `backend/overlay/contract.go`
- `BracketData`: `{ division_name, bracket_format, matches: [{round, match_number, team_1_name, team_1_seed, team_2_name, team_2_seed, team_1_score, team_2_score, status, winner}] }`
- `PoolData`: `{ division_name, pods: [{pod_name, standings: [{team_name, wins, losses, point_diff, rank}]}] }`
- In `overlay/resolver.go`: when active match has a `division_id`, fetch bracket matches OR pool standings for that division and populate
- Add to `DemoData()` for preview

**Frontend:**
- Update `features/overlay/types.ts` to include bracket/pool types
- Wire `BracketSnapshot` and `PoolStandings` renderer components to read from `overlayData.bracket_data` / `overlayData.pool_data`

## 5. Final Documentation

- Update `CHANGELOG.md` with Phase 7 entries
- Update `docs/superpowers/plans/2026-04-14-progress.md` with Phase 7 completion
- Update `README.md` if any new setup steps (PWA, etc.)
- Update `docs/superpowers/PHASE_LAUNCH.md` to mark Phase 7 DONE

## Sub-phase Structure

- **7A**: Accessibility audit + fixes (~15 files touched)
- **7B**: Performance optimization + PWA setup (~8 files)
- **7C**: D1 bracket/pool overlay data + final docs (~10 files backend + frontend)

## Acceptance Criteria

- `pnpm tsc -b --noEmit` — 0 errors
- `pnpm build` — 0 errors, bundle < 250 kB gzip
- `go build ./... && go vet ./... && go test ./...` — all pass
- All modals trap focus
- All clickable non-button elements have keyboard handlers
- PWA manifest loads, SW registers, offline banner shows
- BracketSnapshot + PoolStandings render with demo data in overlay preview
- Progress doc updated, CHANGELOG updated
