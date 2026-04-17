# Frontend Phase 6B — Management Tools

> **For agentic workers:** Depends on Phase 6A. Read spec at `docs/superpowers/specs/2026-04-16-frontend-phase-6-design.md`.

**Goal:** User management, venue approval, activity log, API keys, upload browser.

---

### Task 1: UserSearch

**Files:**
- Create: `frontend/src/features/admin/UserSearch.tsx`
- Modify: `frontend/src/routes/admin/users.tsx` — render UserSearch inside AdminGuard

Searchable, filterable, paginated user table. Filters: text query (name/email), role dropdown (all 11 roles + "All"), status dropdown (active/suspended/banned + "All"). Table columns: Public ID, Name, Email, Role (Badge), Status (StatusBadge), Created. Row click navigates to `/admin/users/:userId`. Uses `useSearchUsers` hook.

Commit: `feat(admin): add user search with role and status filters`

---

### Task 2: UserDetail

**Files:**
- Create: `frontend/src/features/admin/UserDetail.tsx`
- Modify: `frontend/src/routes/admin/users.$userId.tsx` — render UserDetail inside AdminGuard

Sections:
1. **Header**: name, public_id, email, current role badge, current status badge
2. **Role Assignment (D4)**: Select dropdown with all 11 roles from migration 00030: `platform_admin`, `organization_admin`, `league_admin`, `tournament_director`, `head_referee`, `referee`, `scorekeeper`, `broadcast_operator`, `team_coach`, `api_readonly`, `player`. Save button calls `useUpdateUserRole`. Toast on success.
3. **Status Management**: Three buttons — Suspend (if active), Ban (if active/suspended), Reinstate (if suspended/banned). Each opens ConfirmDialog with required reason textarea. Calls `useUpdateUserStatus` with `{status, reason}`. Warning text: "This will revoke all active sessions."
4. **Info section**: InfoRow grid with created_at, updated_at, date_of_birth, etc.

Commit: `feat(admin): add user detail with role assignment and suspend/ban`

---

### Task 3: VenueApproval

**Files:**
- Create: `frontend/src/features/admin/VenueApproval.tsx`
- Modify: `frontend/src/routes/admin/venues.tsx` — render VenueApproval inside AdminGuard

Card-based queue of pending venues. Each card shows: name, city/state, submitted by, created date. Two action buttons: Approve (green), Reject (red). Reject opens Modal with feedback textarea. Calls `useUpdateVenueStatus` with `{status: 'published'|'draft', feedback}`. Empty state when no pending venues.

Commit: `feat(admin): add venue approval queue`

---

### Task 4: ActivityLog

**Files:**
- Create: `frontend/src/features/admin/ActivityLog.tsx`
- Modify: `frontend/src/routes/admin/activity.tsx` — render ActivityLog inside AdminGuard

Filterable, paginated activity log. Filters: entity_type dropdown (user/tournament/league/venue/match/etc + "All"), action text input. Table columns: Timestamp, User (email or "System"), Action, Entity Type, Entity ID. Expandable row showing JSON metadata in `<pre>` block. Uses `useActivityLogs` hook with pagination.

Commit: `feat(admin): add activity log viewer`

---

### Task 5: ApiKeyManager

**Files:**
- Create: `frontend/src/features/admin/ApiKeyManager.tsx`
- Modify: `frontend/src/routes/admin/api-keys.tsx` — render ApiKeyManager inside AdminGuard

List of API keys with: name, key_prefix (e.g. "ccapi_a1b2c3d4..."), scopes, created, last_used, status. "Create API Key" button opens Modal with: name input, scopes checkboxes (["read"]), optional expiry DateInput. On create success, show the raw key in a highlighted box with copy button + warning "This key will not be shown again." Revoke button per key with ConfirmDialog.

Commit: `feat(admin): add API key management`

---

### Task 6: UploadBrowser

**Files:**
- Create: `frontend/src/features/admin/UploadBrowser.tsx`
- Modify: `frontend/src/routes/admin/uploads.tsx` — render UploadBrowser inside AdminGuard

Grid of uploaded files. Each card shows: thumbnail (if image), filename, content_type, size (formatted), uploaded date. Delete button with ConfirmDialog. Uses `useMyUploads` and `useDeleteUpload` hooks.

Commit: `feat(admin): add upload browser`

---

### Task 7: Verification

- `pnpm tsc -b --noEmit` — 0 errors
- `pnpm build` — clean
- Push all 6B commits to origin/V2
