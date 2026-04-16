# Frontend Phase 3D — Tournament Integration + Sidebar + Inline Score Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire scoring into the existing tournament hub. Add a "Courts" tab to the tournament detail page (uses `CourtGrid` from Phase 3B). Add "Score" buttons to division match rows that link to the ref console. Add a "Scoring" section to the sidebar with Ref Console + Quick Match links.

**Architecture:** Mostly edits to existing Phase 2 files. One new tab component (`TournamentCourts.tsx`) and small inline buttons.

**Depends on:** Phase 3A (hooks), Phase 3B (CourtGrid + ref routes). Phase 3C is not strictly required.

---

## Conventions Recap

- Imports relative
- Toast: `const { toast } = useToast(); toast(type, msg)`
- After adding routes: `npx @tanstack/router-cli generate`
- Phase 2 tournament feature folder: `frontend/src/features/tournaments/`
- Phase 2 tournament detail: `frontend/src/features/tournaments/TournamentDetail.tsx` (or wherever the hub component lives — verify before editing)

---

## Task 1: Read Existing Tournament Hub Structure

- [ ] **Step 1: Inspect tournament hub files**

```sh
cd /Users/phoenix/code/court-command-v2/new-cc
ls -la frontend/src/features/tournaments/
cat frontend/src/features/tournaments/TournamentDetail.tsx | head -80
```

Expected: tabbed layout with `<TabLayout>` and tabs for Overview / Divisions / Registrations / Announcements / Settings.

The implementer needs to identify:
- The exact tab list constant or array
- How tabs are wired (id-based, label-based, or React children)
- Where the active tab component renders

Document findings before editing.

---

## Task 2: TournamentCourts Component

**Files:**
- Create: `frontend/src/features/tournaments/TournamentCourts.tsx`

A new tab body. Renders the court grid scoped to this tournament.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/tournaments/TournamentCourts.tsx
import { Link } from '@tanstack/react-router'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { CourtGrid } from '../referee/CourtGrid'
import { useCourtsForTournament } from '../scoring/hooks'

export interface TournamentCourtsProps {
  tournamentId: number
}

export function TournamentCourts({ tournamentId }: TournamentCourtsProps) {
  const courts = useCourtsForTournament(tournamentId)

  if (courts.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  if (courts.isError) {
    return (
      <div className="text-(--color-error) text-sm">
        Failed to load courts.
      </div>
    )
  }

  const list = courts.data ?? []

  if (list.length === 0) {
    return (
      <EmptyState
        title="No courts assigned"
        description="When matches are assigned to courts they will appear here."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--color-text-secondary)">
          {list.length} court{list.length === 1 ? '' : 's'} · tap a card to open the referee console
        </p>
        <Link
          to="/ref"
          className="text-sm text-(--color-accent) hover:underline"
        >
          Open Ref Home →
        </Link>
      </div>
      <CourtGrid courts={list} mode="ref" />
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/tournaments/TournamentCourts.tsx
git commit -m "feat(frontend): add TournamentCourts tab body"
```

---

## Task 3: Add Courts Tab to TournamentDetail

**Files:**
- Modify: `frontend/src/features/tournaments/TournamentDetail.tsx`

- [ ] **Step 1: Add the tab**

Open `TournamentDetail.tsx`. Locate the tab definitions (typically an array passed to `TabLayout`). Add a new tab AFTER the existing tabs and BEFORE Settings (so order is: Overview, Divisions, Courts, Registrations, Announcements, Settings).

Concrete edit pattern (adapt to actual file structure):

```tsx
// Imports
import { TournamentCourts } from './TournamentCourts'

// Tab definitions
const tabs = [
  { id: 'overview', label: 'Overview', content: <TournamentOverview ... /> },
  { id: 'divisions', label: 'Divisions', content: <DivisionList ... /> },
  { id: 'courts', label: 'Courts', content: <TournamentCourts tournamentId={tournament.id} /> },
  { id: 'registrations', label: 'Registrations', content: <RegistrationTable ... /> },
  { id: 'announcements', label: 'Announcements', content: <AnnouncementFeed ... /> },
  { id: 'settings', label: 'Settings', content: <TournamentSettings ... /> },
]
```

If the existing implementation uses different shape (e.g. id without explicit `content`, or uses `<Tab>` / `<TabPanel>` children), adapt accordingly.

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/tournaments/TournamentDetail.tsx
git commit -m "feat(frontend): add Courts tab to tournament hub"
```

---

## Task 4: Inline Score Buttons on Division Match Rows

**Files:**
- Modify: `frontend/src/features/tournaments/DivisionBracket.tsx` (or wherever division matches are listed in Phase 2C)

- [ ] **Step 1: Inspect existing division match rendering**

```sh
grep -rln "team_1_score\|team1_score" frontend/src/features/tournaments/
```

Find the file that renders match cards. Likely `DivisionBracket.tsx` and possibly within `DivisionDetail.tsx`.

- [ ] **Step 2: Add Score button to match card**

For each match row that's status `scheduled` or `in_progress`, add a small "Score" button at the right that links to `/ref/matches/:publicId`. Use `Link` from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
import { Button } from '../../components/Button'

// Inside the match card render:
{(m.status === 'scheduled' || m.status === 'in_progress') && (
  <Link
    to={`/ref/matches/${m.public_id}`}
    onClick={(e) => e.stopPropagation()}  // if the card itself is clickable
  >
    <Button variant="primary" size="sm">
      Score
    </Button>
  </Link>
)}
```

If the match status enum uses different strings, check `frontend/src/features/scoring/types.ts` and adjust.

- [ ] **Step 3: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/features/tournaments/
git commit -m "feat(frontend): add inline Score buttons to division match rows"
```

---

## Task 5: Sidebar — Add Scoring Section

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Inspect sidebar**

```sh
cat frontend/src/components/Sidebar.tsx | head -80
```

Identify the existing nav structure (likely an array of `{ label, icon, to }` items grouped or flat).

- [ ] **Step 2: Add Scoring section**

Add two new entries (or a section header + entries, depending on the existing pattern):

```tsx
// In the appropriate place
{
  group: 'Scoring',
  items: [
    { label: 'Ref Console', icon: Whistle /* or any lucide icon */, to: '/ref' },
    { label: 'Scorekeeper', icon: ClipboardList, to: '/scorekeeper' },
    { label: 'Quick Match', icon: Zap, to: '/quick-match' },
  ],
},
```

Use lucide icons that exist (verify imports). If sidebar is a flat list, just append:

```tsx
{ label: 'Ref Console', icon: 'Whistle', to: '/ref' },
{ label: 'Scorekeeper', icon: 'ClipboardList', to: '/scorekeeper' },
{ label: 'Quick Match', icon: 'Zap', to: '/quick-match' },
```

`/quick-match` will 404 until Phase 3E creates that route. That's acceptable — link target exists, page lands later. To avoid 404s in this phase, you can omit Quick Match from the sidebar here and add it in Phase 3E.

**Recommended:** Add Ref Console and Scorekeeper now; add Quick Match in Phase 3E to keep this commit clean.

- [ ] **Step 3: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): add Ref Console + Scorekeeper to sidebar"
```

---

## Task 6: Update Mobile Sidebar Behavior on Scoring Routes

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx` or `frontend/src/routes/__root.tsx`

Per spec section 3.2: "ref/scorekeeper routes keep the shell for navigation, but on mobile the sidebar collapses fully when scoring is active."

The simplest implementation: in `Sidebar.tsx`, detect if `location.pathname` matches `/ref/matches/:publicId` or `/scorekeeper/matches/:publicId` and force collapsed state on mobile.

- [ ] **Step 1: Implement**

Add inside Sidebar component (adapt to existing state names):

```tsx
import { useLocation } from '@tanstack/react-router'

const location = useLocation()
const isScoringActive = /^\/(ref|scorekeeper)\/matches\/[^/]+/.test(
  location.pathname
)

// On mobile, when scoring is active, ensure mobile drawer is closed
useEffect(() => {
  if (isScoringActive && isMobile) {
    setMobileOpen(false)
  }
}, [isScoringActive, isMobile])
```

- [ ] **Step 2: Verify + commit**

```sh
cd frontend && pnpm tsc -b --noEmit
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): collapse sidebar on mobile while scoring is active"
```

---

## Task 7: Final Verification + Smoke Test

- [ ] **Step 1: Start dev**

```sh
make dev
cd frontend && pnpm dev
```

- [ ] **Step 2: Smoke test**

1. Navigate to a tournament hub. Click the new "Courts" tab — court grid loads scoped to the tournament.
2. Click a court card with an active match — lands in the ref console.
3. From a division view, find a scheduled match — click "Score" button — lands in ref console with MatchSetup.
4. Sidebar shows "Ref Console" and "Scorekeeper" entries.
5. On mobile (or narrow viewport), open ref console and start scoring — sidebar drawer auto-collapses.

- [ ] **Step 3: Verify build**

```sh
cd frontend
pnpm tsc -b --noEmit
pnpm build
git push origin main:V2
```

---

## Self-Review Checklist

- [ ] `TournamentCourts` renders within the new Courts tab
- [ ] Tab order: Overview, Divisions, **Courts**, Registrations, Announcements, Settings
- [ ] Score buttons appear ONLY on scheduled/in_progress matches (not completed)
- [ ] Sidebar entries link to existing `/ref` and `/scorekeeper` routes
- [ ] No `@/` aliases
- [ ] Build passes

When DONE, report:
- Commits
- Smoke test results
- Any spots where the existing Phase 2 file structure differed from assumptions (with the diff applied)
