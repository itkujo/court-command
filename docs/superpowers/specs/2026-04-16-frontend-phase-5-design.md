# Frontend Phase 5 — Public Directory + Player Dashboard

## Overview

Phase 5 builds the public-facing and player-facing surfaces of Court Command. Three sub-phases:

- **5A** — Public landing page + directory pages (tournaments, leagues, venues by slug)
- **5B** — Player Dashboard (`/dashboard`) with 6 sections + D2 fix (PlayerBrief.id)
- **5C** — Global search (Cmd+K modal) + integration (sidebar logic, SEO, caching)

## Decisions

| # | Decision |
|---|---|
| Q1 | Public landing = directory-first, minimal hero. Guest-focused. Recruiting pages deferred. |
| Q2 | Dashboard: upcoming matches, active registrations, recent results, stats summary, my teams, announcements |
| Q3 | Global search: Cmd+K / Ctrl+K / `/` modal, 6 categories, top 3 per category |
| Q4 | Auth-aware CTA: logged-in → Register button; logged-out → Sign In → `/login?redirect=...` |

## Routes

| Route | Auth | Component |
|---|---|---|
| `/` | public | PublicLanding (directory + hero) |
| `/public/tournaments` | public | TournamentDirectory |
| `/public/tournaments/:slug` | public | PublicTournamentDetail |
| `/public/leagues` | public | LeagueDirectory |
| `/public/leagues/:slug` | public | PublicLeagueDetail |
| `/public/venues` | public | VenueDirectory |
| `/public/venues/:slug` | public | PublicVenueDetail |
| `/dashboard` | required | PlayerDashboard |

## Backend Endpoints Consumed

- `GET /api/v1/dashboard` — auth'd, returns 6 sections
- `GET /api/v1/search?q=...` — public, grouped results (top 5 per type)
- `GET /api/v1/public/tournaments?limit=N&offset=N&status=S` — public list
- `GET /api/v1/public/leagues?limit=N&offset=N` — public list
- `GET /api/v1/public/venues?limit=N&offset=N` — public list
- `GET /api/v1/public/tournaments/{slug}` — public detail
- `GET /api/v1/public/leagues/{slug}` — public detail
- `GET /api/v1/public/venues/{slug}` — public detail

## Feature Folders

```
frontend/src/features/
  public/           # 5A — landing + directory pages
    hooks.ts
    PublicLanding.tsx
    PublicHero.tsx
    DirectoryFilters.tsx
    TournamentDirectory.tsx
    LeagueDirectory.tsx
    VenueDirectory.tsx
    PublicTournamentDetail.tsx
    PublicLeagueDetail.tsx
    PublicVenueDetail.tsx
  dashboard/        # 5B — player dashboard
    hooks.ts
    PlayerDashboard.tsx
    UpcomingMatches.tsx
    ActiveRegistrations.tsx
    RecentResults.tsx
    StatsSummary.tsx
    MyTeams.tsx
    DashboardAnnouncements.tsx
  search/           # 5C — global search
    hooks.ts
    SearchModal.tsx
    SearchResultGroup.tsx
```

## Deferral Tracking

| # | Item | Owner |
|---|---|---|
| D1 | BracketSnapshot + PoolStandings overlay data | Phase 7 |
| D2 | PlayerBrief.id missing (PlayerCard name-match) | **Phase 5B** |
| D3 | isLicensed=false hardcoded | Phase 6 |
| D4 | ROLE_ALLOWLIST vs users.role CHECK | Phase 6 |

## Acceptance Criteria

- Public landing loads without auth, shows tournament/league/venue cards
- Directory pages paginate and filter
- Public detail pages show entity info (reuse Phase 2 components where possible)
- Dashboard loads 6 sections from single API call
- Global search opens on Cmd+K, searches across 6 types, navigates on selection
- Sidebar shows different nav for logged-in vs logged-out users
- All pages have loading, error, empty states
- `pnpm tsc -b --noEmit` and `pnpm build` both pass clean
