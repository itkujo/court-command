# Frontend Phase 1: Core Shell + Auth + Registry — Design Spec

## Overview

Frontend Phase 1 establishes the React application foundation: project scaffolding, app shell with navigation, authentication flow, theme system, shared component library, and CRUD pages for the five registry entities (players, teams, organizations, venues, courts). This phase produces a fully functional management interface that authenticates users and lets them manage the core data entities.

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 19 | Locked in backend spec |
| Build | Vite | Locked in backend spec |
| Routing | TanStack Router (file-based) | Type-safe, auto code-split |
| Data fetching | TanStack Query v5 | Cache, refetch, mutations |
| Styling | Tailwind CSS v4 | Utility-first, dark mode support |
| Icons | Lucide React | Consistent icon set, tree-shakeable |
| Forms | Controlled inputs with custom validation | No form library — keep dependencies minimal |
| API layer | Custom fetch wrapper + domain-specific TanStack Query hooks | Hand-written, no codegen (v1 generated OpenAPI client was never used) |

### Browser Compatibility

- All modern browsers (Chrome, Firefox, Edge, Safari)
- **Safari/WebKit is a hard requirement** — overlay system must work in iOS Safari for streaming apps like Larix that use WebKit browser sources
- No Chrome-only CSS or APIs
- Test: transparent backgrounds, CSS animations, flexbox/grid in WebKit

### Responsive Design

- **Mobile-first** — every page works on phone screens
- Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- Tables convert to card lists below `md`
- Sidebar behavior changes below `md` (overlay mode)

## Project Structure

```
frontend/
  public/
    logo-icon.svg              # CC icon mark (collapsed sidebar, favicon)
    logo-wordmark.svg          # CC wordmark (expanded sidebar, dark bg)
    logo-wordmark-dark.svg     # CC wordmark (light bg variant)
  src/
    main.tsx                   # App entry point
    App.tsx                    # Root component (QueryClient, Router)
    styles.css                 # Tailwind directives + CSS custom properties
    config.ts                  # API base URL, env vars

    routes/                    # TanStack Router file-based routes
      __root.tsx               # Root layout (sidebar shell or no-shell)
      index.tsx                # Dashboard (redirect to /registry for Phase 1)
      login.tsx                # Login page (no shell)
      register.tsx             # Register page (no shell)
      players/
        index.tsx              # Player list
        $playerId.tsx          # Player detail/edit
      teams/
        index.tsx              # Team list
        $teamId.tsx            # Team detail/edit (includes roster)
        new.tsx                # Create team
      organizations/
        index.tsx              # Org list
        $orgId.tsx             # Org detail/edit (includes members)
        new.tsx                # Create org
      venues/
        index.tsx              # Venue list
        $venueId.tsx           # Venue detail/edit (includes courts)
        new.tsx                # Create venue
      courts/
        index.tsx              # Floating courts list
        $courtId.tsx           # Court detail/edit

    features/
      auth/
        hooks.ts               # useAuth, useLogin, useRegister, useLogout
        AuthGuard.tsx           # Route protection component
      registry/
        players/
          hooks.ts             # usePlayer, usePlayerSearch, useUpdateProfile
          PlayerList.tsx        # Player list view component
          PlayerDetail.tsx      # Player detail/edit component
          PlayerForm.tsx        # Profile edit form
        teams/
          hooks.ts             # useTeam, useTeamSearch, useCreateTeam, useRoster
          TeamList.tsx
          TeamDetail.tsx
          TeamForm.tsx
          RosterPanel.tsx      # Add/remove roster members
        organizations/
          hooks.ts             # useOrg, useOrgSearch, useCreateOrg, useMembers
          OrgList.tsx
          OrgDetail.tsx
          OrgForm.tsx
          MembersPanel.tsx
        venues/
          hooks.ts             # useVenue, useVenueSearch, useCreateVenue
          VenueList.tsx
          VenueDetail.tsx
          VenueForm.tsx
          CourtList.tsx        # Courts within a venue
        courts/
          hooks.ts             # useCourt, useCreateCourt
          FloatingCourtList.tsx
          CourtDetail.tsx
          CourtForm.tsx

    components/                # Shared UI components
      Button.tsx
      Input.tsx
      Select.tsx
      DateInput.tsx
      Textarea.tsx
      Modal.tsx
      Table.tsx
      Card.tsx
      Toast.tsx
      Sidebar.tsx
      SearchInput.tsx
      Badge.tsx
      Avatar.tsx
      Skeleton.tsx
      EmptyState.tsx
      ErrorBoundary.tsx
      ConfirmDialog.tsx
      ThemeToggle.tsx
      Pagination.tsx
      FormField.tsx            # Label + input + error message wrapper

    hooks/
      useAuth.ts               # Re-export from features/auth (convenience)
      useTheme.ts              # Dark/light/system theme management
      useDebounce.ts           # Debounce hook for search
      useMediaQuery.ts         # Responsive breakpoint detection
      usePagination.ts         # Pagination state management

    lib/
      api.ts                   # Fetch wrapper: base URL, cookie credentials, error parsing
      config.ts                # Runtime config (API URL from env)
      cn.ts                    # Tailwind class merge utility (clsx + tailwind-merge)
      formatters.ts            # Date, currency, name formatting utilities

  index.html                   # Vite HTML entry
  vite.config.ts
  tsconfig.json
  tailwind.config.ts           # Tailwind v4 config (if needed beyond CSS)
  eslint.config.js
  .env.example                 # VITE_API_URL=http://localhost:8080
```

## App Shell

### Sidebar

The persistent navigation sidebar wraps all authenticated pages. No shell on: auth pages, overlay renderer (future), referee console (future), scorekeeper (future), TV/kiosk (future).

**Collapsed state (default):**
- Width: 56px
- Icon-only navigation items
- Tooltips on hover showing labels
- CC icon mark (`logo-icon.svg`) at top
- Hamburger icon button to expand
- User avatar (initials) at bottom

**Expanded state (toggled):**
- Width: 220px
- Icons + text labels
- Grouped sections with uppercase labels:
  - (ungrouped) Dashboard
  - **Events:** Tournaments, Leagues
  - **Manage:** Courts & Venues, Players, Teams, Organizations
  - **Broadcast:** Overlay
- Full wordmark (`logo-wordmark.svg`) at top
- Chevron-left button to collapse
- User avatar + name + public ID at bottom

**Behavior:**
- Toggle via button click
- Preference persisted in `localStorage` key `cc_sidebar_expanded`
- CSS transition: 200ms ease on width
- Content area adjusts with `margin-left` transition
- Active route highlighted with background color + cyan icon

**Mobile (<768px):**
- Sidebar hidden by default
- Hamburger button in a slim top bar
- Opens as overlay (absolute positioned) with semi-transparent backdrop
- Tap backdrop or nav item to close
- Always shows expanded state when open (no collapsed mode on mobile)

### Theme System

- CSS custom properties define all colors
- Two themes: `light` and `dark`
- Default: follows `prefers-color-scheme` media query
- User override: stored in `localStorage` key `cc_theme` (values: `system`, `light`, `dark`)
- `ThemeToggle` component in sidebar footer area
- Applied via `class="dark"` on `<html>` element (Tailwind dark mode strategy)

**Color tokens (CSS custom properties):**
- `--color-bg-primary` — main background
- `--color-bg-secondary` — card/panel background
- `--color-bg-sidebar` — sidebar background
- `--color-text-primary` — main text
- `--color-text-secondary` — muted text
- `--color-text-accent` — cyan accent (`#22d3ee`)
- `--color-border` — borders
- `--color-success`, `--color-warning`, `--color-error` — semantic colors

## Authentication

### Login Page (`/login`)

- No shell (full-screen centered card)
- CC wordmark logo at top of card
- Fields: email (type=email), password (type=password)
- "Log in" primary button
- "Don't have an account? Register" link below
- Error: inline below form ("Invalid email or password")
- On success: redirect to `?redirect` param or `/` (dashboard)
- Loading state: button disabled with spinner

### Register Page (`/register`)

- No shell (full-screen centered card)
- CC wordmark logo at top of card
- Fields: first name, last name, email, password, date of birth (date input)
- "Create account" primary button
- "Already have an account? Log in" link below
- Validation: client-side (required fields, email format, password min 8 / max 72 chars, DOB valid date)
- Server errors: inline below form
- On success: auto-login (backend returns session cookie), redirect to `/`

### Auth State Management

- `useAuth()` hook wraps `GET /api/v1/auth/me` via TanStack Query
- Query key: `['auth', 'me']`
- `staleTime: 5 * 60 * 1000` (5 minutes)
- Returns: `{ user, isLoading, isAuthenticated, error }`
- On 401 response: query returns `null` user, `isAuthenticated = false`
- `useLogin()` mutation: `POST /api/v1/auth/login`, on success invalidates `['auth', 'me']`
- `useRegister()` mutation: `POST /api/v1/auth/register`, on success invalidates `['auth', 'me']`
- `useLogout()` mutation: `POST /api/v1/auth/logout`, on success clears query cache

### Route Protection

- `AuthGuard` component wraps authenticated routes in `__root.tsx`
- If `isLoading`: show full-page skeleton
- If `!isAuthenticated`: redirect to `/login?redirect={currentPath}`
- If authenticated: render children

## API Layer

### Fetch Wrapper (`lib/api.ts`)

```typescript
interface ApiResponse<T> {
  data: T
}

interface ApiError {
  error: {
    code: string
    message: string
  }
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}
```

- Base URL from `VITE_API_URL` env var (default: `http://localhost:8080`)
- All requests include `credentials: 'include'` (send session cookie)
- Content-Type: `application/json` for POST/PUT/PATCH
- Error handling: parse `ApiError` from response body, throw typed error
- 401 responses: invalidate auth query cache (triggers redirect to login)

### Domain Hooks Pattern

Each feature domain exposes hooks following this pattern:

```typescript
// List with search + pagination
function usePlayerSearch(query: string, page: number): {
  data: Player[] | undefined
  total: number
  isLoading: boolean
  error: Error | null
}

// Single entity by ID
function usePlayer(id: number): {
  data: Player | undefined
  isLoading: boolean
  error: Error | null
}

// Mutations
function useCreateTeam(): UseMutationResult<Team, Error, CreateTeamInput>
function useUpdateTeam(id: number): UseMutationResult<Team, Error, UpdateTeamInput>
function useDeleteTeam(): UseMutationResult<void, Error, number>
```

Query keys follow the pattern: `['entity', 'list', { query, page }]` for lists, `['entity', id]` for single entities. Mutations invalidate relevant query keys on success.

## Registry Pages

### Common Patterns

Every registry entity follows the same UI pattern:

**List Page:**
1. Page header: title + "Create New" button (top right)
2. Search bar (debounced, 300ms)
3. Results table (desktop) or card list (mobile)
4. Pagination controls at bottom
5. Empty state when no results ("No players found. Create your first player.")
6. Loading: skeleton rows/cards
7. Error: error message with "Retry" button

**Detail Page:**
1. Back link/breadcrumb to list
2. Entity header: name/title + status badge + edit/delete buttons
3. Info sections with key-value pairs
4. Related entities panel (roster for teams, members for orgs, courts for venues)
5. Edit mode: inline form or slide-out panel

**Create/Edit Form:**
- Dedicated page or modal (whichever fits the entity complexity)
- Field validation on blur + on submit
- "Save" primary button + "Cancel" secondary
- Loading state on submit
- Toast notification on success/error

### Players

**List columns:** Display Name, Public ID (CC-XXXXX), Handedness, City/State, Skill Rating
**Detail sections:** Profile info, contact (own profile only), medical notes (admin only), match stats (placeholder for Phase 2+)
**Actions:** Edit own profile, accept waiver

**Privacy:** Hidden profiles show "(Profile Hidden)" in search results with no link. Own profile always fully visible regardless of privacy setting.

### Teams

**List columns:** Name, Short Name, Organization, Player Count, City
**Detail sections:** Team info (name, short name, colors, bio), Roster panel (player list with roles + jersey numbers)
**Actions:** Create team, edit team, add player to roster, remove player, update roster role/jersey
**Logo:** Team.logo_url fallback chain: team logo → org logo → generated default (initials + primary_color as background)

### Organizations

**List columns:** Name, City, Team Count, Member Count
**Detail sections:** Org info, Members list (with roles), Teams list (linked)
**Actions:** Create org, edit org, add member, remove member, update member role, leave org, block org (from player side)

### Venues

**List columns:** Name, City, Status badge (draft/pending/published), Court Count
**Detail sections:** Venue info (address, contact, surface types, amenities), Venue map (if `venue_map_url` set — simple image display), Courts list
**Actions:** Create venue, edit venue, submit for review (draft → pending_review), add court
**Approval badges:** Draft (gray), Pending Review (yellow), Published (green), Archived (gray strikethrough)

### Courts

**Within Venue:** Listed as a sub-section of venue detail. Create/edit/delete court.
**Floating Courts:** Separate `/courts` page listing courts with `venue_id = null`. For overlay-only use cases.
**Fields:** Name, surface type (dropdown enum), show court flag, active flag, temporary flag, stream URL (with auto-detected type badge), sort order
**Stream badge:** youtube (red), twitch (purple), vimeo (blue), hls (green), other (gray) — auto-detected from URL pattern

## Error Handling

- **Network errors:** Toast notification "Connection lost. Retrying..." with automatic retry (TanStack Query default)
- **Validation errors (400):** Inline field errors + form-level message
- **Conflict errors (409):** Toast notification with specific message ("Email already registered")
- **Not found (404):** Redirect to list page with toast "Item not found"
- **Forbidden (403):** Toast "You don't have permission to do that"
- **Server errors (500):** Toast "Something went wrong. Please try again."
- **Auth errors (401):** Redirect to login (automatic via auth state management)
- **React Error Boundary:** Catches render errors, shows "Something went wrong" with "Reload" button

## Accessibility

- WCAG 2.2 AA compliance
- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<button>`, `<a>`, `<table>`
- Keyboard navigation: all interactive elements focusable, tab order logical
- Focus trap in modals/dialogs
- `aria-label` on icon-only buttons
- Skip-to-content link
- Color contrast: 4.5:1 minimum for text, 3:1 for large text
- Screen reader announcements for toast notifications (`role="alert"`)
- Reduced motion: respect `prefers-reduced-motion` for transitions

## Performance

- Code splitting via TanStack Router (each route lazy-loaded)
- Prefetch on hover for navigation links
- Debounced search (300ms)
- TanStack Query caching with `staleTime: 30_000` default
- Skeleton loading states (no layout shift)
- Images: lazy loading with `loading="lazy"`

## What Phase 1 Does NOT Include

- Tournament management (Phase 2)
- Referee/scorekeeper consoles (Phase 3)
- Overlay renderer and broadcast controls (Phase 4)
- Public discovery pages (Phase 5)
- League/season/standings management (Phase 6)
- Platform admin panel (Phase 7)
- WebSocket real-time updates (Phase 3+)
- Player stats and match history (Phase 2+)
- File upload UI (Phase 2 — backend endpoint exists)

## Backend API Endpoints Used

### Auth
- `POST /api/v1/auth/register` — create account
- `POST /api/v1/auth/login` — login
- `POST /api/v1/auth/logout` — logout
- `GET /api/v1/auth/me` — current user

### Players
- `GET /api/v1/players/search?q=&limit=&offset=` — search
- `GET /api/v1/players/:id` — get by ID
- `GET /api/v1/players/public-id/:publicId` — get by public ID
- `GET /api/v1/players/me` — own profile
- `PATCH /api/v1/players/me` — update own profile
- `POST /api/v1/players/me/waiver` — accept waiver

### Teams
- `GET /api/v1/teams?limit=&offset=` — list
- `GET /api/v1/teams/search?q=&limit=&offset=` — search
- `GET /api/v1/teams/:id` — get by ID
- `POST /api/v1/teams` — create
- `PATCH /api/v1/teams/:id` — update
- `DELETE /api/v1/teams/:id` — soft delete
- `GET /api/v1/teams/:id/roster` — get roster
- `POST /api/v1/teams/:id/roster` — add player
- `DELETE /api/v1/teams/:id/roster/:playerId` — remove player
- `PATCH /api/v1/teams/:id/roster/:playerId` — update role/jersey

### Organizations
- `GET /api/v1/organizations?limit=&offset=` — list
- `GET /api/v1/organizations/search?q=&limit=&offset=` — search
- `GET /api/v1/organizations/:id` — get by ID
- `POST /api/v1/organizations` — create
- `PATCH /api/v1/organizations/:id` — update
- `DELETE /api/v1/organizations/:id` — soft delete
- `GET /api/v1/organizations/:id/members` — list members
- `POST /api/v1/organizations/:id/members` — add member
- `DELETE /api/v1/organizations/:id/members/:playerId` — remove member
- `PATCH /api/v1/organizations/:id/members/:playerId/role` — update role
- `POST /api/v1/organizations/:id/leave` — leave org
- `POST /api/v1/organizations/:id/block` — block org
- `DELETE /api/v1/organizations/:id/block` — unblock org

### Venues
- `GET /api/v1/venues?limit=&offset=&status=` — list
- `GET /api/v1/venues/search?q=&limit=&offset=` — search
- `GET /api/v1/venues/:id` — get by ID
- `POST /api/v1/venues` — create
- `PATCH /api/v1/venues/:id` — update
- `DELETE /api/v1/venues/:id` — soft delete
- `POST /api/v1/venues/:id/submit-review` — submit for review
- `GET /api/v1/venues/:id/courts` — list courts
- `POST /api/v1/venues/:id/courts` — create court
- `PATCH /api/v1/venues/:id/courts/:courtId` — update court
- `DELETE /api/v1/venues/:id/courts/:courtId` — delete court

### Courts (floating)
- `GET /api/v1/courts?limit=&offset=` — list floating courts
- `POST /api/v1/courts` — create floating court
- `GET /api/v1/courts/:id` — get by ID
- `PATCH /api/v1/courts/:id` — update
- `DELETE /api/v1/courts/:id` — delete

### Health
- `GET /api/v1/health` — health check
