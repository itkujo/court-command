# Frontend Phase 5C — Global Search + Integration

> **For agentic workers:** Read `docs/superpowers/PHASE_LAUNCH.md` first for codebase patterns and working rules.

**Goal:** Add global search modal (Cmd+K) and integrate all Phase 5 surfaces with the app shell.

**Architecture:** New `features/search/` folder. Search modal triggered by keyboard shortcut. Sidebar adapts for logged-in vs logged-out. Public routes get basic SEO (title tags).

**Tech Stack:** React 19, TanStack Router, TanStack Query, Tailwind CSS v4, Lucide icons.

---

### Task 1: Search hooks

**Files:**
- Create: `frontend/src/features/search/hooks.ts`

Single hook: `useGlobalSearch(query: string)` calling `GET /api/v1/search?q=${query}`. Debounced (300ms). Disabled when query < 2 chars.

Response shape (from backend):
```typescript
interface SearchResults {
  players: SearchResult[]
  teams: SearchResult[]
  organizations: SearchResult[]
  tournaments: SearchResult[]
  leagues: SearchResult[]
  venues: SearchResult[]
}

interface SearchResult {
  id: number
  name: string
  slug?: string
  public_id?: string
  // other fields vary by type
}
```

- [ ] Step 1: Create `features/search/hooks.ts` with `useGlobalSearch` hook
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add global search hook`

---

### Task 2: SearchModal + SearchResultGroup

**Files:**
- Create: `frontend/src/features/search/SearchModal.tsx`
- Create: `frontend/src/features/search/SearchResultGroup.tsx`

**SearchModal:** Full-screen overlay (Modal or custom). Opens on Cmd+K / Ctrl+K / `/` (when not in an input). Input at top, results below. Close on Escape or click-outside. Keyboard navigation (up/down arrows, Enter to select).

Layout:
1. Search input with magnifying glass icon
2. Results grouped by category (SearchResultGroup per type)
3. Each group shows category header + top 3 items
4. Each item: name, optional subtitle (city, slug), click navigates to entity

**SearchResultGroup:** Props: `title: string`, `results: SearchResult[]`, `getLink: (r) => { to, params }`. Renders category header + list of clickable items. If empty, hide the group.

Navigation targets:
- Players → `/players/{id}`
- Teams → `/teams/{id}`
- Organizations → `/organizations/{id}`
- Tournaments → `/tournaments/{id}` (internal, auth'd)
- Leagues → `/leagues/{id}` (internal, auth'd)
- Venues → `/venues/{id}` (internal, auth'd)

- [ ] Step 1: Create both components
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add global search modal with grouped results`

---

### Task 3: Wire search into app shell

**Files:**
- Modify: `frontend/src/routes/__root.tsx` or `frontend/src/App.tsx` — mount SearchModal globally
- Modify: `frontend/src/components/Sidebar.tsx` — add search trigger button (Search icon)

The search modal should be mounted once at the app root level (inside QueryClientProvider). Keyboard listener lives inside SearchModal itself using `useKeyboardShortcuts` or a custom effect.

Sidebar gets a "Search" button at the top that opens the modal. The Cmd+K shortcut works from anywhere.

- [ ] Step 1: Mount SearchModal in App.tsx (inside providers, outside router)
- [ ] Step 2: Add Search button to Sidebar
- [ ] Step 3: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 4: Commit: `feat(frontend): wire global search into app shell`

---

### Task 4: Sidebar logged-in vs logged-out

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

Currently sidebar shows full nav for all users. Update:
- **Logged-in:** Full nav as-is + Dashboard entry at top
- **Logged-out:** Show only: Search, Tournaments (public), Leagues (public), Venues (public), Sign In button at bottom
- Use `useAuth()` to check login state. If `auth.isLoading`, show skeleton nav. If `auth.user`, show full nav. If no user, show public nav.

Public nav items link to `/public/tournaments`, `/public/leagues`, `/public/venues`.
Sign In button links to `/login`.

- [ ] Step 1: Update Sidebar with conditional nav rendering
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): adaptive sidebar for logged-in vs logged-out users`

---

### Task 5: SEO basics + route titles

**Files:**
- Modify: Various route files to add `<title>` via TanStack Router's `meta` or `useEffect` with `document.title`

Set `document.title` on key pages:
- `/` → "Court Command — Pickleball Tournament & League Management"
- `/public/tournaments` → "Tournaments — Court Command"
- `/public/leagues` → "Leagues — Court Command"
- `/public/venues` → "Venues — Court Command"
- `/dashboard` → "My Dashboard — Court Command"
- Detail pages → "{Entity Name} — Court Command"

Simple `useEffect(() => { document.title = '...' }, [])` pattern. No SSR needed.

- [ ] Step 1: Add document.title to key public + dashboard routes
- [ ] Step 2: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 3: Commit: `feat(frontend): add page titles for SEO`

---

### Task 6: Final verification + push

- [ ] Step 1: `pnpm tsc -b --noEmit` — 0 errors
- [ ] Step 2: `pnpm build` — succeeds
- [ ] Step 3: Push all Phase 5 commits to origin/V2
- [ ] Step 4: Append Phase 5 completion section to `docs/superpowers/plans/2026-04-14-progress.md`
- [ ] Step 5: Push progress update
- [ ] Step 6: Report final SHA + any issues
