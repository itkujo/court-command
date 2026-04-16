# Frontend Phase 5A — Public Landing + Directory Pages

> **For agentic workers:** Read `docs/superpowers/PHASE_LAUNCH.md` first for codebase patterns and working rules.

**Goal:** Build the public-facing landing page and directory pages for tournaments, leagues, and venues.

**Architecture:** New `features/public/` folder with hooks consuming `/api/v1/public/*` endpoints. Public routes use `PublicLayout` from `__root.tsx` (auth-optional, sidebar shown only if logged in). Reuse Phase 2 components (StatusBadge, InfoRow, Card, Pagination) where possible.

**Tech Stack:** React 19, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, Lucide icons.

---

### Task 1: Public hooks

**Files:**
- Create: `frontend/src/features/public/hooks.ts`

Create TanStack Query hooks for all public endpoints:

```typescript
import { apiGetPaginated, apiGet } from '../../../lib/api'

// Types
export interface PublicTournament {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  start_date: string
  end_date: string
  venue_name?: string
  city?: string
  state_province?: string
  logo_url?: string | null
  description?: string | null
  division_count?: number
  registration_count?: number
}

export interface PublicLeague {
  id: number
  public_id: string
  name: string
  slug: string
  status: string
  logo_url?: string | null
  city?: string
  state_province?: string
  description?: string | null
}

export interface PublicVenue {
  id: number
  name: string
  slug: string
  status: string
  city?: string
  state_province?: string
  country?: string
  logo_url?: string | null
  photo_url?: string | null
  court_count?: number
}

// Hooks
export function usePublicTournaments(params: { limit: number; offset: number; status?: string }) {
  // apiGetPaginated(`/api/v1/public/tournaments?limit=${params.limit}&offset=${params.offset}${params.status ? `&status=${params.status}` : ''}`)
  // queryKey: ['public-tournaments', params]
}

export function usePublicTournamentBySlug(slug: string) {
  // apiGet(`/api/v1/public/tournaments/${slug}`)
  // queryKey: ['public-tournament', slug], enabled: !!slug
}

export function usePublicLeagues(params: { limit: number; offset: number }) {
  // apiGetPaginated(`/api/v1/public/leagues?limit=${params.limit}&offset=${params.offset}`)
  // queryKey: ['public-leagues', params]
}

export function usePublicLeagueBySlug(slug: string) {
  // apiGet(`/api/v1/public/leagues/${slug}`)
  // queryKey: ['public-league', slug], enabled: !!slug
}

export function usePublicVenues(params: { limit: number; offset: number }) {
  // apiGetPaginated(`/api/v1/public/venues?limit=${params.limit}&offset=${params.offset}`)
  // queryKey: ['public-venues', params]
}

export function usePublicVenueBySlug(slug: string) {
  // apiGet(`/api/v1/public/venues/${slug}`)
  // queryKey: ['public-venue', slug], enabled: !!slug
}
```

Pattern: follow existing hooks in `features/registry/*/hooks.ts`. Use `useQuery` with `queryKey` arrays and `enabled` guards. Use `apiGetPaginated` for lists, `apiGet` for details.

- [ ] Step 1: Create `frontend/src/features/public/hooks.ts` with all 6 hooks above (fill in real implementations following existing hook patterns)
- [ ] Step 2: Run `pnpm tsc -b --noEmit` — should be 0 errors
- [ ] Step 3: Commit: `feat(frontend): add public directory hooks`

---

### Task 2: DirectoryFilters + PublicHero components

**Files:**
- Create: `frontend/src/features/public/DirectoryFilters.tsx`
- Create: `frontend/src/features/public/PublicHero.tsx`

**DirectoryFilters:** Horizontal filter bar with search input + status dropdown + pagination controls. Props: `query`, `onQueryChange`, `statusOptions?`, `selectedStatus?`, `onStatusChange?`. Reuse `SearchInput` from `components/SearchInput.tsx` and `Select` from `components/Select.tsx`.

**PublicHero:** Minimal hero for landing page. CC logo (from `/logo-wordmark.svg`), tagline "Pickleball Tournament & League Management", and a CTA button. If logged in (check `useAuth()`): show "Go to Dashboard" linking to `/dashboard`. If logged out: show "Sign In" linking to `/login`.

- [ ] Step 1: Create both components
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add DirectoryFilters and PublicHero components`

---

### Task 3: PublicLanding page

**Files:**
- Create: `frontend/src/features/public/PublicLanding.tsx`

Landing page layout:
1. `<PublicHero />` at top
2. Three directory sections below (Tournaments, Leagues, Venues) — each shows top 6 cards with "View All →" link
3. Each section uses the public hooks with `limit: 6, offset: 0`
4. Tournament cards show: name, dates, venue city, status badge, logo thumbnail
5. League cards show: name, city, status badge, logo thumbnail
6. Venue cards show: name, city/state, court count, photo thumbnail
7. Use `Card` component for each item. Use `StatusBadge` with appropriate type.
8. Loading: `SkeletonRow` x 6 per section. Error: inline error message. Empty: "No tournaments yet" etc.
9. `AdSlot` with `responsive-banner` size between hero and directory sections

- [ ] Step 1: Create `PublicLanding.tsx`
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add public landing page`

---

### Task 4: Directory pages (Tournaments, Leagues, Venues)

**Files:**
- Create: `frontend/src/features/public/TournamentDirectory.tsx`
- Create: `frontend/src/features/public/LeagueDirectory.tsx`
- Create: `frontend/src/features/public/VenueDirectory.tsx`

Each directory page:
1. Title + `DirectoryFilters` at top
2. Paginated card grid (reuse `usePagination` hook)
3. `Pagination` component at bottom
4. Loading/error/empty states
5. Cards link to `/public/{type}/{slug}` detail pages
6. `AdSlot` with `responsive-banner` size below title

Tournament directory: add status filter (published, registration_open, registration_closed, in_progress, completed).
League/Venue directories: no status filter needed for v1.

- [ ] Step 1: Create all 3 directory pages
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add tournament, league, venue directory pages`

---

### Task 5: Public detail pages

**Files:**
- Create: `frontend/src/features/public/PublicTournamentDetail.tsx`
- Create: `frontend/src/features/public/PublicLeagueDetail.tsx`
- Create: `frontend/src/features/public/PublicVenueDetail.tsx`

Each detail page fetches by slug and displays entity info. Reuse `InfoRow` for field display. Include `AdSlot` with `medium-rectangle` at bottom.

**PublicTournamentDetail:** Name, dates, venue, description (via `RichTextDisplay`), divisions list, sponsors, status badge, registration CTA (if logged in + registration_open → link to internal tournament page; if logged out → Sign In).

**PublicLeagueDetail:** Name, description, seasons list, sponsors, status badge.

**PublicVenueDetail:** Name, address, photo, court count, surface types, amenities.

- [ ] Step 1: Create all 3 detail pages
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add public detail pages (tournament, league, venue)`

---

### Task 6: Route files + __root.tsx update

**Files:**
- Create: `frontend/src/routes/index.tsx` (replace existing redirect with PublicLanding)
- Create: `frontend/src/routes/public/tournaments/index.tsx`
- Create: `frontend/src/routes/public/tournaments/$slug.tsx`
- Create: `frontend/src/routes/public/leagues/index.tsx`
- Create: `frontend/src/routes/public/leagues/$slug.tsx`
- Create: `frontend/src/routes/public/venues/index.tsx`
- Create: `frontend/src/routes/public/venues/$slug.tsx`
- Modify: `frontend/src/routes/__root.tsx` — add `/public/*` to PUBLIC_ROUTE_PATTERNS

All `/public/*` routes use `PublicLayout` (auth-optional). The landing page `/` also uses PublicLayout.

**Important:** After creating route files, run `pnpm build` (or briefly `pnpm dev`) to regenerate `routeTree.gen.ts`. Do NOT commit `routeTree.gen.ts` — it's gitignored.

- [ ] Step 1: Update `routes/index.tsx` to render `PublicLanding` instead of redirect
- [ ] Step 2: Create all 6 public route files
- [ ] Step 3: Update `__root.tsx` PUBLIC_ROUTE_PATTERNS to include `/public`
- [ ] Step 4: Run `pnpm build` to regenerate route tree
- [ ] Step 5: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 6: Commit: `feat(frontend): add public directory routes + update landing page`

---

### Task 7: Verification + push

- [ ] Step 1: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 2: `pnpm build` — succeeds
- [ ] Step 3: Push to origin/V2
- [ ] Step 4: Report final SHA
