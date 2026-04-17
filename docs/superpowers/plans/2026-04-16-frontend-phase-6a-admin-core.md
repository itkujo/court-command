# Frontend Phase 6A — Admin Core

> **For agentic workers:** Read the Phase 6 spec at `docs/superpowers/specs/2026-04-16-frontend-phase-6-design.md` first. Execute tasks in order. Commit per task.

**Goal:** Admin hooks, types, guard, dashboard, route wiring, sidebar section.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Tailwind CSS v4

---

### Task 1: Types + Hooks

**Files:**
- Create: `frontend/src/features/admin/types.ts`
- Create: `frontend/src/features/admin/hooks.ts`

Create admin TypeScript interfaces and TanStack Query hooks.

**types.ts** — interfaces for: `AdminUser` (id, public_id, email, first_name, last_name, role, status, created_at, updated_at), `AdminStats` (total_users, total_matches, total_tournaments, total_leagues, total_venues, total_courts, pending_venues, active_matches), `ActivityLogEntry` (id, user_id, entity_type, entity_id, action, metadata, ip_address, created_at), `ApiKey` (id, name, key_prefix, scopes, expires_at, last_used_at, created_at, is_active), `Upload` (id, filename, content_type, size, entity_type, entity_id, created_at), `VenueApprovalItem` (full venue object with status='pending_review').

**hooks.ts** — hooks consuming backend admin endpoints:
- `useAdminStats()` — GET /api/v1/admin/stats
- `useSearchUsers(query, role, status, limit, offset)` — GET /api/v1/admin/users
- `useAdminUser(userId)` — GET /api/v1/admin/users/:id
- `useUpdateUserRole()` — PATCH /api/v1/admin/users/:id/role
- `useUpdateUserStatus()` — PATCH /api/v1/admin/users/:id/status
- `usePendingVenues(limit, offset)` — GET /api/v1/admin/venues/pending
- `useUpdateVenueStatus()` — PATCH /api/v1/admin/venues/:id/status
- `useActivityLogs(filters)` — GET /api/v1/admin/activity
- `useApiKeys()` — GET /api/v1/admin/api-keys
- `useCreateApiKey()` — POST /api/v1/admin/api-keys
- `useRevokeApiKey()` — DELETE /api/v1/admin/api-keys/:id
- `useMyUploads()` — GET /api/v1/uploads
- `useDeleteUpload()` — DELETE /api/v1/uploads/:id

Follow existing hook patterns: `apiGet`/`apiPost`/`apiPatch`/`apiDelete`/`apiGetPaginated` from `../../lib/api`. Relative imports only. `credentials: 'include'` is already in the api wrapper.

Commit: `feat(admin): add admin types and hooks`

---

### Task 2: AdminGuard + AdminDashboard

**Files:**
- Create: `frontend/src/features/admin/AdminGuard.tsx`
- Create: `frontend/src/features/admin/AdminDashboard.tsx`

**AdminGuard.tsx** — checks `useAuth().user?.role === 'platform_admin'`. If not admin, redirect to `/dashboard`. If loading, show Skeleton. Wraps children.

**AdminDashboard.tsx** — calls `useAdminStats()`. Renders grid of stat cards (each with label + number + icon). Cards: Total Users, Total Matches, Active Tournaments, Total Leagues, Total Venues, Pending Venues (highlighted if > 0), Total Courts, Active Matches. Loading state with SkeletonRow. Error state with retry.

Commit: `feat(admin): add AdminGuard and AdminDashboard`

---

### Task 3: Route files + Sidebar

**Files:**
- Create: `frontend/src/routes/admin/index.tsx` — renders AdminGuard > AdminDashboard
- Create: `frontend/src/routes/admin/users.tsx` — placeholder for Task 4
- Create: `frontend/src/routes/admin/users.$userId.tsx` — placeholder for Task 5
- Create: `frontend/src/routes/admin/venues.tsx` — placeholder
- Create: `frontend/src/routes/admin/activity.tsx` — placeholder
- Create: `frontend/src/routes/admin/api-keys.tsx` — placeholder
- Create: `frontend/src/routes/admin/uploads.tsx` — placeholder
- Modify: `frontend/src/components/Sidebar.tsx` — add Admin section

Route files use `createFileRoute('/admin/...')({ component })` pattern. Each imports AdminGuard and wraps content.

**Sidebar.tsx** — add new "Admin" group at the bottom of the nav, visible only when `auth.user?.role === 'platform_admin'`. Items: Dashboard (LayoutDashboard icon), Users (Users icon), Venues (MapPin icon), Activity (ScrollText icon), API Keys (Key icon), Uploads (Upload icon). Use lucide-react icons.

After creating routes: run `pnpm dev` briefly (6s) to regenerate routeTree, OR `pnpm build`.

Commit: `feat(admin): add admin routes and sidebar section`

---

### Task 4: Verification

- `pnpm tsc -b --noEmit` — 0 errors
- `pnpm build` — clean
- Commit if any fixes needed

Push all 6A commits to origin/V2.
