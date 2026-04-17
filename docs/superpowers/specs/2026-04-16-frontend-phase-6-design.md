# Frontend Phase 6 — Admin & Platform Management

## Overview

Build the Platform Admin panel and management tools that consume existing backend endpoints (Phase 8). This phase also resolves two outstanding deferrals: D3 (isLicensed wiring) and D4 (role assignment UI with all 11 roles from migration 00030).

## Scope

### Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/admin` | platform_admin | Admin dashboard with system stats |
| `/admin/users` | platform_admin | User search, view, role assignment, suspend/ban |
| `/admin/users/:userId` | platform_admin | User detail with role/status controls |
| `/admin/venues` | platform_admin | Venue approval queue (pending list) |
| `/admin/activity` | platform_admin | Activity log viewer (filterable, paginated) |
| `/admin/api-keys` | platform_admin | API key management (create, list, revoke) |
| `/admin/uploads` | platform_admin | Upload browser (list, delete) |

### Backend Endpoints Consumed

Already shipped in Backend Phase 8:

**Admin panel** (`/api/v1/admin/...` — RequireAuth + RequirePlatformAdmin):
- `GET /admin/users?query=&role=&status=&limit=&offset=` — search users
- `GET /admin/users/:id` — get user detail
- `PATCH /admin/users/:id/role` — update role (body: `{role}`)
- `PATCH /admin/users/:id/status` — update status (body: `{status, reason}`)
- `GET /admin/venues/pending?limit=&offset=` — list pending venues
- `PATCH /admin/venues/:id/status` — approve/reject (body: `{status, feedback}`)
- `GET /admin/activity?user_id=&entity_type=&action=&limit=&offset=` — activity logs
- `GET /admin/api-keys` — list my API keys
- `POST /admin/api-keys` — create API key (body: `{name, scopes, expires_at}`)
- `DELETE /admin/api-keys/:id` — revoke API key
- `GET /admin/stats` — system stats (user count, match count, tournament count, etc.)

**Uploads** (`/api/v1/uploads/...` — RequireAuth):
- `GET /uploads` — list my uploads
- `DELETE /uploads/:id` — delete upload

### Feature Folder Structure

```
frontend/src/features/admin/
  hooks.ts          — TanStack Query hooks for all admin endpoints
  types.ts          — Admin-specific TypeScript interfaces
  AdminDashboard.tsx — Stats overview (cards + charts placeholder)
  UserSearch.tsx     — User search with filters
  UserDetail.tsx     — User detail with role/status controls
  VenueApproval.tsx  — Pending venue queue
  ActivityLog.tsx    — Filterable activity log
  ApiKeyManager.tsx  — API key CRUD
  UploadBrowser.tsx  — Upload list + delete
  AdminGuard.tsx     — Role gate (redirects non-platform_admin)
```

### Deferral Resolution

**D3 — Licensing toggle**: Add `isLicensed` field to overlay config. Control panel's existing `isLicensed = false` hardcode gets replaced with a real API check. Admin panel gets a "Licensing" section where platform_admin can toggle per-court licensing. Backend already has `CourtOverlayConfig` — add a `licensed` boolean field or use existing mechanism.

**D4 — Role assignment UI**: UserDetail page gets a role dropdown with all 11 values from migration 00030: `platform_admin`, `organization_admin`, `league_admin`, `tournament_director`, `head_referee`, `referee`, `scorekeeper`, `broadcast_operator`, `team_coach`, `api_readonly`, `player`. Backend `PATCH /admin/users/:id/role` already accepts any valid role.

### Sub-phase Split

- **6A** — Admin core: hooks, types, AdminGuard, AdminDashboard, route wiring, sidebar admin section
- **6B** — Management tools: UserSearch, UserDetail (with role/status), VenueApproval, ActivityLog, ApiKeyManager, UploadBrowser
- **6C** — Deferrals + polish: D3 licensing toggle, D4 role dropdown wiring, progress doc, CHANGELOG

### Shared Components Reused

From Phase 1: Table, Pagination, SearchInput, Badge, StatusBadge, Button, Input, Select, Modal, ConfirmDialog, Card, Skeleton/SkeletonTable, FormField, AdSlot
From Phase 2: InfoRow, TabLayout

### Design Decisions

1. **Admin sidebar section**: New "Admin" group in Sidebar.tsx, visible only when `auth.user?.role === 'platform_admin'`. Contains: Dashboard, Users, Venues, Activity, API Keys, Uploads.
2. **AdminGuard**: Wraps all `/admin/*` routes. Checks role, redirects to `/dashboard` if not platform_admin. Similar to AuthGuard but role-specific.
3. **Stats cards**: Simple number cards (total users, total matches, active tournaments, pending venues, etc.). No charts in v2 — placeholder area for future analytics.
4. **Activity log**: Reverse-chronological, filterable by user/entity_type/action. Expandable rows showing JSON metadata. Paginated.
5. **API key creation**: Modal form with name, scopes checkboxes, optional expiry date. Shows raw key ONCE on creation (not retrievable after).
6. **Venue approval**: Card-based queue showing venue details + approve/reject buttons with optional feedback textarea.

### Acceptance Criteria

- All 7 routes render correctly for platform_admin users
- Non-admin users redirected away from /admin/*
- User role assignment works with all 11 roles
- User suspend/ban works with session revocation confirmation
- Venue approve/reject works with feedback
- API key created, displayed once, revocable
- Activity log filterable and paginated
- Upload browser lists and deletes files
- D3 and D4 explicitly resolved
- tsc 0 errors, pnpm build clean
