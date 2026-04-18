# Court Command v2 - QA Audit Report

**Date:** 2026-04-18
**Environment:** Backend Go on `:8080`, Frontend React/Vite on `:5173`
**Branch:** `main` tracking `origin/V2`
**Test Account:** `daniel.f.velez@gmail.com` / platform_admin
**Audit Type:** Read-only. No code changes made.

---

## Executive Summary

**68 routes tested** across public, authenticated, and admin scopes.

| Result | Count |
|--------|-------|
| PASS | 52 |
| FAIL | 6 |
| WARN | 3 |
| N/A | 2 |
| PASS (partial) | 5 |

**14 bugs found.** 2 critical, 3 high, 5 medium, 4 low.

**Key performance findings:**
- N+1 query pattern fires up to 800 DB queries for 100 matches
- Zero of 85 `useQuery` hooks set `staleTime` (every mount triggers refetch)
- 113 `SELECT *` statements across all sqlc queries
- 38/40 `<img>` tags missing `loading="lazy"`
- 6 missing database indexes

---

## Table of Contents

1. [Bug Summary](#1-bug-summary)
2. [Route-by-Route Results](#2-route-by-route-results)
3. [Response Shape Inconsistencies](#3-response-shape-inconsistencies)
4. [Backend Test Results](#4-backend-test-results)
5. [Frontend Bundle Analysis](#5-frontend-bundle-analysis)
6. [Backend Performance Analysis](#6-backend-performance-analysis)
7. [Image Audit](#7-image-audit)
8. [staleTime Audit](#8-staletime-audit)
9. [Recommendations](#9-recommendations)

---

## 1. Bug Summary

### Critical

| # | Bug | File | Impact |
|---|-----|------|--------|
| BUG-01 | Stale seed data causes phantom 404s: list endpoints return old-seed records (IDs 1-4) that 404 on detail | `service/tournament.go:172-173`, `service/league.go:146-148`, `service/season.go:112+`, `service/match.go:528+` | Users see tournaments/leagues that crash when clicked. Navigation broken across the app. |
| BUG-02 | N+1 enrichment in 7 match list endpoints: 8 sequential sub-queries per match | `service/match.go:562,580,598,622,640,658,1121` | 50 matches = ~400 queries, 100 matches = ~800 queries. Will not scale. |

### High

| # | Bug | File | Impact |
|---|-----|------|--------|
| BUG-03 | Match series public endpoint auth-gated (401 for anonymous users) | `router/router.go:260-263` | Anonymous spectators cannot view match series. Fix: split routes like `/matches` at `router.go:221-231`. |
| BUG-04 | Player list returns 404: no `GET /` handler exists | `handler/player.go:28` | No player list endpoint. Workaround: `GET /players/search?q=&limit=5&offset=0`. |
| BUG-05 | Overlay config returns 500 for old-seed court IDs (1-8) | `service/overlay.go` (`GetOrCreateConfig`) | Stream overlay broken for old-seed courts. |

### Medium

| # | Bug | File | Impact |
|---|-----|------|--------|
| BUG-06 | JSONB fields serialize as base64 strings instead of JSON objects | sqlc-generated structs (`[]byte` type) | `social_links`, `sponsor_info`, `surface_types`, `amenities` return `"e30="` instead of `{}`. Frontend must decode. |
| BUG-07 | Tournament registrations route missing | `router/router.go:173-191` (not defined) | `GET /tournaments/{id}/registrations` returns raw 404. Only available at division level. |
| BUG-08 | Division bracket GET endpoint missing | `handler/bracket.go:12-15` (only POST `/generate`) | `GET /divisions/{id}/bracket` returns raw 404. Frontend must reconstruct from match data. |
| BUG-09 | Venue list `court_count` always 0 | `ListVenues` SQL query | Venue list shows 0 courts; detail correctly shows 4. |
| BUG-10 | `go test ./...` corrupts the dev database | Backend test suite | Running tests deletes seeded admin user and leaves artifacts. Database must be re-seeded after tests. |

### Low

| # | Bug | File | Impact |
|---|-----|------|--------|
| BUG-11 | Court detail missing `venue_name` (present in list) | Court detail query | Detail/edit views need a second API call to resolve venue name. |
| BUG-12 | Source profiles route path mismatch | `router/router.go:327-330` | Endpoint is at `/source-profiles`, not `/overlay/source-profiles`. Frontend may use wrong path. |
| BUG-13 | Service `GetByID` methods mask all DB errors as "not found" | All service files (`tournament.go`, `league.go`, `season.go`, `match.go`, `division.go`) | Real DB errors (scan failures, connection errors) silently reported as 404. Makes debugging extremely difficult. Likely masks root cause of BUG-01. |
| BUG-14 | Tournament matches response uses `Success()` instead of `Paginated()` | `handler/public.go:336` | Returns raw array instead of `{data, pagination}` envelope. |

---

## 2. Route-by-Route Results

### Public/Anonymous Routes (1-14)

| # | Route | Type | Status | HTTP | Notes |
|---|-------|------|--------|------|-------|
| 1 | `/` | FE | PASS | 200 | SPA shell loads correctly |
| 2 | `/login` | FE | PASS | 200 | |
| 3 | `/register` | FE | PASS | 200 | |
| 4 | `/public/tournaments` | API | PASS | 200 | Base64 JSONB fields (BUG-06) |
| 5 | `/public/tournaments/{slug}` | API | PASS | 200 | Base64 JSONB fields |
| 6 | `/public/leagues` | API | PASS | 200 | Base64 JSONB fields |
| 7 | `/public/leagues/{slug}` | API | PASS | 200 | |
| 8 | `/public/venues` | API | PASS | 200 | Base64 JSONB, no `public_id` on venues |
| 9 | `/public/venues/{slug}` | API | PASS | 200 | |
| 10 | `/public/events` | FE | PASS | 200 | |
| 11 | `/public/live` | FE | PASS | 200 | |
| 12 | `/matches/{publicId}` | API+FE | PASS (partial) | 404/200 | No match data in seed to validate 200 |
| 13 | `/matches/{publicId}/scoreboard` | FE | PASS | 200 | |
| 14 | `/match-series/{publicId}` | API+FE | **FAIL** | **401**/200 | BUG-03: Auth-gated |

**Tally:** 11 PASS, 2 PASS (partial), 1 FAIL

### Authenticated Routes (15-60)

| # | Route | Type | Status | HTTP | Notes |
|---|-------|------|--------|------|-------|
| 15 | `/dashboard` | API | PASS | 200 | All empty for admin (expected) |
| 16 | `/manage` | FE | PASS | 200 | |
| 17 | `/players` | API | **FAIL** | **404** | BUG-04: No list handler |
| 18 | `/players/{id}` | API | PASS | 200 | |
| 19 | `/teams` | API | PASS | 200 | 8 teams |
| 20 | `/teams/new` | FE | PASS | 200 | |
| 21 | `/teams/{id}` | API | PASS | 200 | |
| 22 | `/teams/{id}/edit` | FE+API | PASS | 200 | |
| 23 | `/organizations` | API | PASS | 200 | 3 orgs |
| 24 | `/organizations/new` | FE | PASS | 200 | |
| 25 | `/organizations/{id}` | API | PASS | 200 | |
| 26 | `/organizations/{id}/edit` | FE+API | PASS | 200 | |
| 27 | `/venues` | API | PASS* | 200 | BUG-09: `court_count` always 0 |
| 28 | `/venues/new` | FE | PASS | 200 | |
| 29 | `/venues/{id}` | API | PASS | 200 | Managers = bare array |
| 30 | `/venues/{id}/edit` | FE+API | PASS | 200 | |
| 31 | `/courts` | API | PASS | 200 | |
| 32 | `/courts/{id}` | API | PASS* | 200 | BUG-11: Missing `venue_name` |
| 33 | `/tournaments` | API | WARN | 200 | BUG-01: Stale old-seed data |
| 34 | `/tournaments/create` | FE | PASS | 200 | |
| 35a | `/tournaments/{id}` overview | API | PASS (ID 5) | 200 | Old IDs 1-4 all 404 |
| 35b | `/tournaments/{id}/divisions` | API | PASS | 200 | 2 divisions |
| 35c | `/tournaments/{id}/registrations` | API | **FAIL** | **404** | BUG-07: Route not defined |
| 35d | `/tournaments/{id}/courts` | API | PASS | 200 | Raw array (no pagination) |
| 35e | `/tournaments/{id}/announcements` | API | PASS | 200 | |
| 35f | `/tournaments/{id}/staff` | API | PASS | 200 | |
| 36a | Division detail | API | PASS | 200 | |
| 36b | Division registrations | API | PASS | 200 | |
| 36c | Division seeds | N/A | -- | -- | Seed data embedded in registration records |
| 36d | Division bracket | API | **FAIL** | **404** | BUG-08: Only POST /generate exists |
| 37 | `/leagues` | API | WARN | 200 | Stale old-seed data |
| 38 | `/leagues/create` | FE | PASS | 200 | |
| 39a | `/leagues/{id}` | API | PASS | 200 | |
| 39b | `/leagues/{id}/seasons` | API | PASS | 200 | |
| 39c | `/leagues/{id}/division-templates` | API | PASS | 200 | Raw array |
| 39d | `/leagues/{id}/registrations` | API | PASS | 200 | |
| 39e | `/leagues/{id}/announcements` | API | PASS | 200 | |
| 40 | `/leagues/{id}/seasons/{seasonId}` | API | PASS | 200 | |
| 41 | `/ref` (courts) | API | WARN | 200 | Old-seed courts with stale match refs |
| 42 | Court matches | API | PASS | 200 | |
| 43 | Match detail by publicId | API | PASS | 200 | Full enriched response |
| 44-45 | Scorekeeper endpoints | API | PASS | 200 | Same API as ref |
| 46 | `/quick-match` | API | PASS | 200 | Empty array |
| 47 | `/quick-match/new` | FE | PASS | 200 | |
| 48 | `/settings/scoring` | FE+API | PASS | 200 | |
| 49 | `/profile` (auth/me) | API | PASS | 200 | |
| 50 | Overlay themes | API | PASS | 200 | 6 themes |
| 51 | Overlay theme detail | API | PASS | 200 | |
| 52 | Overlay demo data | API | PASS | 200 | |
| 53 | Overlay court config | API | PASS/FAIL | 200/500 | BUG-05: 500 for old-seed courts |
| 54 | Overlay court data | API | PASS | 200 | |
| 55 | Overlay webhook | API | PASS | 400 | Expected: no source profile |
| 56 | Source profiles | API | PASS | 200 | At `/source-profiles` (BUG-12) |
| 57 | Overlay frontend | FE | PASS | 200 | |
| 58 | N/A | -- | -- | -- | |
| 59 | `/tv/tournaments/{id}` | FE | PASS | 200 | |
| 60 | `/tv/courts/{slug}` | FE | PASS | 200 | |

**Tally:** 36 PASS, 3 PASS (partial/with notes), 3 WARN, 3 FAIL, 1 N/A

### Admin Routes (61-68)

| # | Route | Status | Notes |
|---|-------|--------|-------|
| 61 | `/admin` dashboard | PASS | Stats endpoint works |
| 62 | `/admin/users` | PASS | |
| 63 | `/admin/users/{id}` | PASS | |
| 64 | `/admin/venue-approvals` | PASS | |
| 65 | `/admin/activity-logs` | PASS | Correct path (not `/admin/activity`) |
| 66 | `/admin/api-keys` | PASS | |
| 67 | `/admin/uploads` | PASS | Cleanup is `POST /admin/uploads/cleanup` |
| 68 | `/admin/ads` | PASS | |

**Tally:** 8 PASS

---

## 3. Response Shape Inconsistencies

Six list endpoints return raw arrays instead of the standard `{data: [...], pagination: {total, limit, offset}}` envelope:

| Endpoint | Actual Shape |
|----------|-------------|
| `GET /tournaments/{id}/courts` | `[...]` |
| `GET /leagues/{id}/division-templates` | `[...]` |
| `GET /courts/{courtId}/matches` | `[...]` |
| `GET /scoring-presets` | `[...]` |
| `GET /quick-matches` | `[...]` |
| `GET /source-profiles` | `[...]` |

Additionally:
- `GET /venues/{id}/managers` returns a bare array
- `GET /public/tournaments/{slug}/matches` returns raw array (BUG-14)

---

## 4. Backend Test Results

```
Package                     Status           Time
court-command (root)        [no test files]
court-command/bracket       ok               0.243s
court-command/config        [no test files]
court-command/db            [no test files]
court-command/db/generated  [no test files]
court-command/engine        ok               0.423s
court-command/handler       ok               1.461s
court-command/jobs          [no test files]
court-command/middleware    [no test files]
court-command/overlay       [no test files]
court-command/pubsub        [no test files]
court-command/router        [no test files]
court-command/service       ok               0.446s
court-command/session       [no test files]
court-command/testutil      [no test files]
court-command/ws            [no test files]
```

| Metric | Value |
|--------|-------|
| Total wall time | ~2.6 seconds |
| Packages with tests | 4 of 15 |
| Packages without tests | 11 |
| All tests passing | Yes |
| **WARNING** | Running `go test ./...` corrupts the dev database (BUG-10) |

---

## 5. Frontend Bundle Analysis

**Build:** Vite 8.0.8, 2,220 modules, 636ms build time

### Summary

| Metric | Value |
|--------|-------|
| Total JS chunks | 232 |
| Code splitting | Active |
| Main bundle (raw) | 261.87 kB |
| Main bundle (gzip) | **78.99 kB** |
| CSS (raw/gzip) | 65.37 kB / 11.50 kB |
| Combined initial load (gzip) | **90.49 kB** |
| Chunks over 50 kB gzip | **1** (main bundle only) |

### Chunks Over 10 kB Gzip

| Chunk | Raw | Gzip |
|-------|-----|------|
| `index-MOlpQe3V.js` (main) | 261.87 kB | **78.99 kB** |
| `court._slug.settings` | 80.18 kB | 19.66 kB |
| `court._slug` | 49.86 kB | 16.22 kB |
| `cn` (clsx/tailwind-merge) | 34.83 kB | 11.55 kB |
| `index.css` | 65.37 kB | 11.50 kB |
| `link` (TanStack Router) | 26.58 kB | 9.65 kB |
| `elements` (overlay) | 41.43 kB | 9.66 kB |
| `_tournamentId` | 34.78 kB | 8.70 kB |
| `api` | 24.38 kB | 8.04 kB |
| `_tournamentId_.divisions._divisionId` | 24.38 kB | 7.24 kB |

### Verdict

Bundle health is good. Only one chunk exceeds the 50 kB gzip threshold. Code splitting is working well with route-based chunking via TanStack Router.

---

## 6. Backend Performance Analysis

### N+1 Query Pattern (BUG-02)

`enrichedMatchResponse` at `service/match.go:293-410` runs **8 sequential sub-queries** per match:

| # | Query | File:Line |
|---|-------|-----------|
| 1 | `GetTeamByID(team1)` | `match.go:417` |
| 2 | `GetActiveRoster(team1)` | `match.go:428` |
| 3 | `GetTeamByID(team2)` | `match.go:417` |
| 4 | `GetActiveRoster(team2)` | `match.go:428` |
| 5 | `GetDivisionByID` | `match.go:326` |
| 6 | `GetTournamentByID` | `match.go:342` |
| 7 | `GetCourtByID` | `match.go:358` |
| 8 | `ListMatchEventsByType(timeout)` | `match.go:373` |

**7 list endpoints loop this enrichment (N+1):**

| Endpoint | File:Line |
|----------|-----------|
| `ListByDivision` | `match.go:562` |
| `ListByPod` | `match.go:580` |
| `ListByCourt` | `match.go:598` |
| `ListByTeam` | `match.go:622` |
| `ListByTournament` | `match.go:640` |
| `ListQuickMatches` | `match.go:658` |
| `ListLive` | `match.go:1121` |

**Query count estimates:**

| Scenario | Matches | Queries |
|----------|---------|---------|
| Division page, 20 matches | 20 | ~162 |
| Division page, 50 matches | 50 | ~402 |
| Tournament, 100 matches | 100 | ~801 |
| Live page, 30 matches | 30 | ~242 |

**Double-enrichment:** `ConfirmMatchOver` (`match.go:1497-1556`) and `DeclareForfeit` (`match.go:1682`) run enrichment twice (16 queries) on match completion.

### WebSocket Broadcast

`broadcastMatchUpdate` (`match.go:40-52`) does **NOT** run enrichment internally -- accepts pre-enriched `MatchResponse`. CR-4 fix confirmed. However, enrichment IS synchronous and blocking on the scoring hot path in `applyEngineResult` (`match.go:1255-1358`). Every point scored blocks on 8 sequential queries before HTTP response is sent.

### Missing Database Indexes

| Table | Column(s) | Query Pattern |
|-------|-----------|---------------|
| `matches` | `created_by_user_id` | `ListQuickMatches` WHERE filter |
| `matches` | `(created_by_user_id, match_type)` | Compound for quick match list |
| `standings_entries` | `team_id` | Team-specific standings lookups |
| `match_series` | `team1_id` | Series by team |
| `match_series` | `team2_id` | Series by team |
| `registrations` | `registered_by_user_id` | User's own registrations |

### SELECT * Usage

**113 `SELECT *` statements** across 22 query files. Every sqlc query uses `SELECT *`. This over-fetches on every query, including wide tables like `tournaments` (30+ columns) and `matches` (40+ columns).

**Files with most `SELECT *`:**
- `matches.sql`: 19
- `tournaments.sql`: 10
- `users.sql` / `players.sql`: 10
- `venues.sql`: 5
- `courts.sql`: 6
- `match_events.sql`: 5
- `match_series.sql`: 6
- `registrations.sql`: 5
- `leagues.sql`: 6

---

## 7. Image Audit

**40 total `<img>` tags** across the frontend.

| Attribute | Present | Missing |
|-----------|---------|---------|
| `alt` | 40/40 | 0 |
| `width` + `height` | 1/40 | 39 |
| `loading="lazy"` | 2/40 | 38 |
| `decoding="async"` | 10/40 | 30 |

**Has `width`/`height`:** `PublicHero.tsx:11` only.

**Has `loading="lazy"`:** `Avatar.tsx:21`, `AdSlot.tsx:150`.

**Has `decoding="async"`:** Avatar, AdSlot, Sidebar (x6), login.tsx (x2), register.tsx (x2).

**Impact:** Missing dimensions cause CLS (Cumulative Layout Shift). Missing `loading="lazy"` causes unnecessary eager loading of off-screen images.

---

## 8. staleTime Audit

**0 of 85 `useQuery` hooks set `staleTime`.** Every component mount triggers an unconditional refetch.

### Complete List by Feature

| Feature | File | Hooks | Count |
|---------|------|-------|-------|
| Auth | `features/auth/hooks.ts` | `useCurrentUser` | 1 |
| Leagues | `features/leagues/hooks.ts` | `useLeagues`, `useLeague`, `useSeasons`, `useSeasonBySlug`, `useDivisionTemplates`, `useLeagueRegistrations`, `useSeasonConfirmations`, `useAnnouncements`, `useStandings`, `usePaginatedStandings`, `useLeagueSeasons` | 11 |
| Admin | `features/admin/hooks.ts` | `useAdminStats`, `useAdminUsers`, `useAdminUser`, `useVenueApprovals`, `useActivityLog`, `useApiKeys`, `useUploads` | 7 |
| Admin Ads | `features/admin/ad-hooks.ts` | `useAdConfigs`, `useActiveAds` | 2 |
| Search | `features/search/hooks.ts` | `useSearch` | 1 |
| Dashboard | `features/dashboard/hooks.ts` | `useDashboard` | 1 |
| Quick Match | `features/quick-match/hooks.ts` | `useQuickMatches` | 1 |
| Public | `features/public/hooks.ts` | `usePublicTournaments`, `usePublicTournament`, `usePublicLeagues`, `usePublicLeague`, `usePublicVenues`, `usePublicVenue`, `usePublicLiveMatches`, `usePublicDivisions`, `usePublicDivisionMatches`, `usePublicTournamentCourts`, `usePublicSeasons`, `usePublicSeasonTournaments`, `usePublicLeagueCourts` | 13 |
| Scoring | `features/scoring/hooks.ts` | `useMatch`, `useCourtSummaries`, `useMatchEvents`, `useMatchesByDivision`, `useCourtSummariesByDivision`, `useMatchSeries`, `useMyTournamentAssignment` | 7 |
| Organizations | `features/registry/organizations/hooks.ts` | `useOrganizations`, `useOrganization`, `useOrgMembers`, `useOrgBlocked`, `useOrgRole` | 5 |
| Players | `features/registry/players/hooks.ts` | `usePlayers`, `usePlayer`, `usePlayerByPublicID` | 3 |
| Venues | `features/registry/venues/hooks.ts` | `useVenues`, `useVenue`, `useVenueCourts`, `useCanManageVenue`, `useVenueManagers` | 5 |
| Teams | `features/registry/teams/hooks.ts` | `useTeams`, `useTeam`, `useTeamsByPlayer`, `useTeamRoster` | 4 |
| Courts | `features/registry/courts/hooks.ts` | `useCourts`, `useCourt` | 2 |
| Manage | `features/manage/hooks.ts` | `useManagedVenues`, `useManagedLeagues`, `useManagedTournaments`, `useManagedOrgs` | 4 |
| Tournaments | `features/tournaments/hooks.ts` | `useTournaments`, `useTournament`, `useDivisions`, `useDivision`, `useRegistrations`, `usePods`, `useAnnouncements`, `useBracketMatches`, `useScoringPresets`, `useTournamentLeagues`, `useTournamentSeasons`, `useTournamentStaff` | 12 |
| Overlay | `features/overlay/hooks.ts` | `useCourtOverlayConfig`, `useOverlayData`, `useOverlayCourts`, `useThemes`, `useTheme`, `useOverlayDataByCourtId`, `useSourceProfiles`, `useSourceProfile` | 8 |
| Components | `VenuePicker.tsx`, `ScoringPresetPicker.tsx` | inline queries | 3 |

### Recommended `staleTime` Tiers

| Data Type | Suggested `staleTime` | Hooks |
|-----------|----------------------|-------|
| Static reference data | 10-30 minutes | `useThemes`, `useTheme`, `useScoringPresets`, `useSourceProfiles` |
| User profile / auth | 5 minutes | `useCurrentUser` |
| Entity lists (paginated) | 30-60 seconds | `useTeams`, `useVenues`, `usePlayers`, `useTournaments`, `useLeagues`, etc. |
| Entity detail | 30-60 seconds | `useTeam`, `useVenue`, `useTournament`, etc. |
| Live/scoring data | 0 (or use WebSocket) | `useMatch`, `useMatchEvents`, `useCourtSummaries` |
| Dashboard | 30 seconds | `useDashboard` |

---

## 9. Recommendations

### Priority 1 - Fix Now (Pre-launch)

1. **Fix stale seed data phantom 404s (BUG-01).** Either:
   - Clean up old seed data with a migration, or
   - Fix the `GetByID` error masking (BUG-13) so the real scan errors surface, then fix the underlying data issue.

2. **Un-gate match series public endpoint (BUG-03).** Split routes in `router.go:260-263` the same way `/matches` is split at `router.go:221-231`.

3. **Add player list handler (BUG-04).** Register `GET /` on `handler/player.go:28`.

4. **Fix overlay config 500 for old courts (BUG-05).** Handle the case where `GetOrCreateConfig` fails for courts that may have integrity issues.

### Priority 2 - Fix Soon (Performance)

5. **Address N+1 enrichment (BUG-02).** Options:
   - Batch query: single SQL join for team+roster+division+tournament+court
   - Pre-compute an enriched match view
   - Denormalize frequently-needed fields into the matches table

6. **Set `staleTime` on all `useQuery` hooks.** Use the tiered approach above. This will eliminate most unnecessary refetches.

7. **Add missing database indexes.** The 6 missing indexes identified will prevent sequential scans as data grows.

8. **Fix JSONB base64 serialization (BUG-06).** Change sqlc column type from `[]byte` to `json.RawMessage` or add custom JSON marshalers.

### Priority 3 - Fix Later (Quality)

9. **Add missing routes:** Tournament registrations (BUG-07), Division bracket GET (BUG-08).

10. **Fix response shape inconsistencies.** Standardize all list endpoints to use `{data, pagination}` envelope.

11. **Add `loading="lazy"`, `width`/`height`, and `decoding="async"` to `<img>` tags.** Focus on public-facing pages first.

12. **Fix `go test` database corruption (BUG-10).** Tests should use isolated test databases or transactions that roll back.

### Priority 4 - Track (Tech Debt)

13. **Replace `SELECT *` with explicit column lists.** All 113 queries use `SELECT *`, over-fetching on every call.

14. **Increase backend test coverage.** 11/15 packages have no tests.

15. **Fix `GetByID` error masking (BUG-13).** Distinguish `pgx.ErrNoRows` from other errors in all service methods.

---

*Report generated by automated QA audit. All findings are based on curl-based API testing and static code analysis. No code was modified.*
