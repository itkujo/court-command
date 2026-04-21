# DB Schema Source-of-Truth Alignment Audit

**Date:** 2026-04-20
**Branch:** `audit/db-schema-alignment`
**Scope:** Verify that every layer (DB schema → sqlc generated → Go handler/service → TypeScript types/forms) is consistent with the database as the single source of truth.

## Trigger

The BUG-09 incident on 2026-04-20 (division creation 500 error) was caused by a frontend form sending enum values that violated Postgres CHECK constraints. Nothing structural prevented that failure — the build passed, tests passed, both sides compiled cleanly, yet every division create attempt 500'd in production. A comprehensive audit was commissioned to catch every similar mismatch.

## Methodology

Six parallel explore-agents each audited one table group across all four layers:

| Agent | Scope |
|---|---|
| 1 | Identity & Access — users, player_profile, organizations, activity_logs, api_keys, user roles, venue_managers, site_settings |
| 2 | Venues & Courts — venues, courts, court_queue_position, address standardization, tournament_courts, formatted_address |
| 3 | Tournaments Core — tournaments, divisions, pods, registrations, tournament_staff |
| 4 | Leagues & Templates — teams, leagues, seasons, division_templates, league_registrations, season_confirmations |
| 5 | Matches & Scoring — scoring_presets, matches, match_events, match_series, standings_entries |
| 6 | Overlays & Content — announcements, court_overlay_configs, source_profiles, overlay_data_overrides, uploads, ad_configs |

Each agent checked, per column: (1) enum values vs CHECK constraints, (2) nullability, (3) numeric widths, (4) defaults, (5) required-on-create, (6) FK cascade, (7) unique constraint handling, (8) status state machines, (9) FK column types, (10) VARCHAR length caps.

## Severity Legend

- **S1 Blocker** — Causes runtime errors (500/409/400) or broken UX. Users cannot complete task.
- **S2 Data integrity** — Works today but allows inconsistent state or silently drops data.
- **S3 Type safety** — No user-visible impact today, but a future code change could turn it into S1.
- **S4 UX polish** — Works correctly but missing nice-to-haves (maxLength, unique-conflict messaging, docs).

---

## Summary Statistics

| Severity | Count (approx) |
|---|---|
| **S1 Blocker** | ~28 |
| **S2 Data integrity** | ~65 |
| **S3 Type safety** | ~80 |
| **S4 UX polish** | ~35 |
| **Total findings** | ~208 |

## S1 Headline Findings (must-fix before next deploy)

These are user-visible or imminent-break bugs. Grouped by impact area; see agent sections for full details.

### Admin panel (Agent 1)
1. **Role assignment broken end-to-end** — `handler/admin.go:223` hardcodes `org_admin` but CHECK + TS use `organization_admin`. Any attempt to grant the Organization Admin role 400s.
2. **PATCH vs PUT mismatch** on `/admin/users/{id}/role` and `/status` — 405 Method Not Allowed.
3. **Status change 400** — frontend sends `reason` field, backend uses `DisallowUnknownFields` → always rejected.
4. **Activity Log page 404** — frontend hits `/admin/activity`, route is `/admin/activity-logs`.
5. **Venue approval broken** — PATCH method + `public_id` used where numeric ID required + response shape mismatches TS type (shows "undefined courts").
6. **API key create broken** — field name + format mismatch (`expires_at` ISO date vs `expires_in` Go duration); `DisallowUnknownFields` rejects.
7. **API key reveal broken** — frontend reads `data.key`, backend returns `raw_key`. One-time key never shown.

### Tournaments & Divisions (Agent 3)
8. **"Create & Publish" tournament silently stays draft** — service overwrites `params.Status = "draft"`.
9. **Wizard's divisions array silently discarded** — handler never decodes nested `divisions`. User creates tournament with 3 divisions, lands on a tournament with 0.
10. **BUG-09 regression inside `TournamentCreate.tsx`** — the wizard's inline DivisionForm still has the old `registration_mode: 'team'/'individual'/'partner'` values. Creating a division via the wizard 500s.
11. **`gender_restriction` can crash DivisionOverview** — DB column is nullable but TS marks non-null; `.replace()` on null throws.

### Registrations (Agent 3)
12. **"Mark no-show" marks EVERY non-checked-in registration in the division** — backend ignores the ID list the frontend sends.

### Matches & Scoring (Agent 5)
13. **`MatchSeries` detail page always 400** — `useMatchSeries` hits `/match-series/{publicId}` which expects a numeric ID. Needs `/match-series/public/{publicId}`.
14. **ScoringPresetPicker expects nested `scoring_config` that doesn't exist** — preset dropdown shows only `p.name`, all metadata silently undefined.
15. **`MatchSeriesSummary.team1/team2` never populated** — detail page always shows "Team 1" / "Team 2" labels.
16. **`ScoreSnapshot` TS type has `team_1_games_won` / `team_2_games_won` Go never emits**, missing `current_set`. Timeline uses undefined fields.
17. **`'bye'` in TS `MatchStatus` union isn't in the DB CHECK** — any write 500s.
18. **`match_type`, `win_reason`, `series_format`, series `status` have no TS enum type** — typos only catch at runtime via DB CHECK.

### Leagues & Seasons (Agent 4)
19. **Season confirmations endpoint doesn't exist** — frontend hooks `useListSeasonConfirmations` / `useConfirmSeason` hit routes that return 404.
20. **"Create & Publish" league silently stays draft** — same pattern as tournaments.

### Venues & Courts (Agent 2)
21. **VenuePicker search does nothing** — `ListVenues` ignores `?query=` parameter.
22. **VenuePicker currently-selected venue fetch is broken** — fetches `?limit=1&offset=0` and expects the one selected venue to be there.

### Overlays & Content (Agent 6)
23. **`idle_display` frontend has 4 values, DB CHECK has 3 different values** — any non-default write 500s.
24. **`source_profiles.auth_config` key mismatch** — form writes `{header, key}`, poller reads `header_name`. API-Key auth silently ignores custom header.
25. **Webhook secret UI instructions are wrong** — tells operator to use `X-Webhook-Secret` header; verifier requires HMAC-SHA256 `X-Webhook-Signature`.
26. **Data-overrides endpoints have no auth check** — any client who knows a court ID can rewrite per-court overrides.
27. **Upload browser shows "NaN B" and random hex filenames** — TS type uses `size`/`filename`, backend returns `size_bytes`/`original_name`.
28. **Announcements: division-scoped announcements cannot be created, flat `/announcements/{id}` routes don't exist** — PATCH/DELETE from frontend 404.
29. **Announcement list's `division_id` filter silently dropped** — handler never reads the query param.

---

<agent_reports>

## Agent 1 — Identity & Access

### Table: `users` (migrations 00001, 00002, 00030, 00033, 00035)

**Files inspected:**
- `api/db/migrations/00001_create_users.sql`, `00002_add_player_profile.sql`, `00030_expand_user_roles.sql`, `00033_standardize_address_fields.sql`, `00035_add_formatted_address.sql`
- `api/db/generated/users.sql.go`, `players.sql.go`, `models.go` (User struct lines 576–614)
- `api/handler/auth.go`, `admin.go`, `player.go`
- `api/service/auth.go`, `player.go`
- `web/src/features/auth/hooks.ts`
- `web/src/routes/register.tsx`, `login.tsx`
- `web/src/features/admin/types.ts`, `UserDetail.tsx`, `UserSearch.tsx`
- `web/src/features/registry/players/hooks.ts`, `PlayerForm.tsx`, `PlayerDetail.tsx`, `PlayerList.tsx`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | Enum | `role` | CHECK IN (`platform_admin`, `organization_admin`, `league_admin`, `tournament_director`, `head_referee`, `referee`, `scorekeeper`, `broadcast_operator`, `team_coach`, `api_readonly`, `player`) | `handler/admin.go:221–225` `validRoles` uses `org_admin` (not `organization_admin`) | `admin/types.ts` `ALL_ROLES` uses `organization_admin` | Form sends `organization_admin` → Go validator rejects with 400; if Go is "fixed" to `org_admin`, DB CHECK then rejects. Org-admin assignment is fully broken end-to-end. | Change `handler/admin.go:223` from `"org_admin"` to `"organization_admin"`. |
| 2 | S1 | HTTP verb | `role`, `status` endpoints | n/a | `handler/admin.go:51–52` registers `r.Put(...)` | `admin/hooks.ts:57,77` calls `apiPatch(...)` | Method mismatch → 405 on chi. | Change route to `r.Patch(...)` or switch hook to `apiPut`. |
| 3 | S1 | Unknown field | `status` endpoint body | body `{status}` only | `handler/admin.go:258–270` uses `DecodeJSON` with `DisallowUnknownFields` | `UserDetail.tsx:73` sends `{status, reason}` | Backend rejects with 400 "unknown field reason". Status change always fails. | Add `Reason string` to the handler body (preferred — persist it) or stop sending it. |
| 4 | S3 | Numeric width | `id` | `BIGSERIAL` / `BIGINT` | `int64` | `AdminUser.id: number`, `Player.id: number`, `VenueManager.user_id: number` | JS Number 2^53 ceiling. Also passed into `useStartImpersonation(userId: number)`. | Document the ceiling or switch `useStartImpersonation` to take `public_id`. |
| 5 | S2 | Nullability | `email` | nullable (unclaimed players have no email) | `*string` (correct) | `auth/hooks.ts` `User.email: string`, `admin/types.ts` `AdminUser.email: string` (both non-null) | TS claims email always present; unclaimed users have `email = null`. | Change both TS types to `email: string \| null`. |
| 6 | S2 | Nullability | `date_of_birth` | `DATE NOT NULL` | `time.Time` | `AdminUser.date_of_birth: string \| null` | DB is NOT NULL; TS marks nullable. | Change `AdminUser.date_of_birth` to `string`. |
| 7 | S3 | Missing fields (data loss) | `phone`, `dupr_id`, `vair_id`, `emergency_contact_name/phone`, `medical_notes`, `avatar_url`, `waiver_accepted_at` | all present in DB | Returned via `PrivatePlayerProfileResponse` | `registry/players/hooks.ts` `Player` interface lacks them | Backend returns them; TS drops them. `PlayerForm.tsx:74–81` sets these to `''` on init because the hook type has no fields to read from — **user loses all existing DUPR/VAIR/phone/emergency/medical data on every profile edit**. | Add all fields to `Player` interface and populate in PlayerForm init. |
| 8 | S2 | Extraneous field | `skill_rating` | column does not exist on users | not returned | `registry/players/hooks.ts` `Player.skill_rating: number \| null` | TS declares a column that isn't in DB. Always `undefined`. | Remove `skill_rating` from `Player`. |
| 9 | S1 | Enum duplicate | `gender` | CHECK IN (`male`, `female`, `non_binary`, `prefer_not_to_say`) | `handler/player.go:119` validates the same set | `PlayerForm.tsx:16–22` has TWO entries labeled "Prefer not to say": `{value: '', ...}` AND `{value: 'prefer_not_to_say', ...}` | Default `''` is mapped to null before POST; two identical labels confuse users and produce NULL instead of `prefer_not_to_say`. | Remove the empty-value "Prefer not to say" option. |
| 10 | S3 | Nullability | `latitude`, `longitude` | DOUBLE PRECISION nullable | `pgtype.Float8` | `Player.latitude: number \| null` ✅ | PlayerForm never wires lat/lng into payload. | Either wire `AddressInput` lat/lng into PlayerForm or remove from backend Update DTO. |
| 11 | S3 | Role-based auth dead code | `role` | 11 allowed values | Only `platform_admin` is enforced | Frontend shows dropdown for all 11 | 9 roles are UI-only today. | Document operational semantics or trim the CHECK + types.ts. |
| 12 | S4 | maxLength | `display_name`, `bio`, `city` | unbounded TEXT | no length limit | `PlayerForm` client-enforces `display_name ≤ 100`; others uncapped | Potential abuse vector. | Add service-layer caps. |
| 13 | S3 | Status claim workflow | `status` | CHECK includes `unclaimed` | admin transitions allow only `active/suspended/banned` | TS `USER_STATUSES` matches admin transitions | No code ever transitions `unclaimed → active` when placeholder is claimed. | Add a claim endpoint or remove `unclaimed` from CHECK. |
| 14 | S4 | Unique conflict handling | `email`, partial `dupr_id`/`vair_id` indexes | Postgres 23505 on email; partial indexes on DUPR/VAIR are non-unique | `service/auth.go:101` returns `NewConflict` on email | `register.tsx:42` displays err.message | Aligned for email. DUPR/VAIR duplicates silently coexist. | Promote DUPR/VAIR to UNIQUE WHERE NOT NULL. |
| 15 | S2 | Duplicate detection | dedup index | `idx_users_dedup(first_name, last_name, date_of_birth)` NOT UNIQUE | `CheckDuplicateUser` is advisory only | `CreateUnclaimedPlayer` doesn't call it | Race: two admins creating same player yields two rows. | Add UNIQUE constraint + 409 handling. |
| 16 | S3 | Serialization safety | `password_hash` | stored | `generated.User` has json tag `password_hash` | Wrapped responses don't leak it | Safe today, but a future raw return of `generated.User` would leak hash. | Change generated model json tag to `-`. |

**Additional notes:**
- `merged_into_id` default RESTRICT. Soft-delete-only → not reachable today.
- `password_hash` json tag on the generated model is a footgun.

### Table: `organizations` (migrations 00004, 00033, 00035)

**Files inspected:**
- `api/db/migrations/00004_create_organizations.sql`, `00033`, `00035`
- `api/db/generated/organizations.sql.go`, `org_memberships.sql.go`, `org_blocks.sql.go`, `models.go`
- `api/handler/organization.go`, `api/service/organization.go`
- `web/src/features/registry/organizations/hooks.ts`, `OrgForm.tsx`, `OrgDetail.tsx`, `OrgList.tsx`, `MembersPanel.tsx`, `OrgTeamsPanel.tsx`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Missing on create | `primary_color`, `secondary_color`, `contact_phone` | TEXT nullable | handler accepts | `OrgForm.tsx:62–78` omits from payload | New orgs always have null branding/phone. | Add color/phone inputs or drop cols. |
| 2 | S3 | Numeric width | `id`, `created_by_user_id` | BIGINT | `int64` | `number` | 2^53 risk. | Document. |
| 3 | S3 | Validation | `founded_year` | INT | `pgtype.Int4` | `number \| null`; form min=1900 client-only | No server bounds. | Add `founded_year BETWEEN 1900 AND currentYear+1` server-side. |
| 4 | S2 | Missing field | `updated_at` | TIMESTAMPTZ NOT NULL | Returned by `toOrgResponse` | `Organization` interface lacks it | Stale-write detection impossible. | Add to TS interface. |
| 5 | S3 | Serialization | `social_links` | JSONB | `[]byte` (base64-encoded in JSON!) | not exposed | If ever exposed, broken. | Switch sqlc override to `json.RawMessage`. |
| 6 | S4 | Enum typing | `org_memberships.role` | CHECK IN (`member`, `admin`) | validated | hook accepts arbitrary string | No client-side type safety. | Narrow role param to `'member' \| 'admin'`. |
| 7 | S2 | Dead column | `org_memberships.status` | CHECK IN (`active`, `inactive`, `suspended`) | Never written | Never surfaced | No transition code, no UI. | Implement or drop. |
| 8 | S4 | maxLength | `name`, `bio` | unbounded TEXT | no limit | no maxLength | Abuse vector. | Add caps. |
| 9 | S2 | Cascade | memberships/blocks/teams → org | default RESTRICT | soft-delete on org doesn't cascade | no UI warning | Inconsistent semantics. | Document or add cascade. |
| 10 | S2 | Cascade | `created_by_user_id` → users | default RESTRICT | no guard on user soft-delete | n/a | Orphan FK pointing at soft-deleted user. | Prohibit user delete if owns active orgs or reassign. |
| 11 | S3 | Partial unique race | `(org_id, player_id, left_at)` | NULL ≠ NULL so not really unique | `CheckMemberInOrg` pre-check | n/a | Race: two AddMember calls both see 0 active. | Use `UNIQUE (org_id, player_id) WHERE left_at IS NULL`. |
| 12 | S2 | Response asymmetry | address fields | n/a | `MyOrgResponse` omits address cols that `OrgResponse` includes | n/a | `ListMyOrgs` vs `GetOrg` return different shapes. | Unify response DTO. |

### Table: `activity_logs` (migration 00027)

**Files inspected:**
- `api/db/migrations/00027_create_activity_logs.sql`
- `api/db/generated/activity_logs.sql.go`, `models.go:13–22`
- `api/handler/admin.go:435–467`
- `api/service/activity_log.go`
- `web/src/features/admin/hooks.ts:116–130`, `ActivityLog.tsx`, `types.ts:26–36`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | Endpoint path | n/a | n/a | Route `/admin/activity-logs` | hook calls `/admin/activity` | 404 on Activity Log page. | Fix hook URL. |
| 2 | S2 | Missing join | `user_email` | backend doesn't join users | not in Go response | TS has it; UI uses it | Every row shows "System". | Add JOIN in `ListActivityLogs`. |
| 3 | S3 | Type | `entity_id` | BIGINT nullable | `*int64` in JSON | TS `string` | Type lies; comparisons fail. | Change TS to `number \| null`. |
| 4 | S2 | Nullability | `user_id` | NOT NULL | `int64` | TS `number \| null` | Misleading. | Change TS to `number`. |
| 5 | S4 | Filter type | `user_id` | INT | `ParseInt` | hook takes `user_id: string` | Unclear contract. | Type as `number \| string`. |
| 6 | S4 | Enum drift | `entity_type` | no CHECK | accepts any | FE dropdown hardcodes 10 values | New types never appear in filter. | Add CHECK or dynamic endpoint. |

### Table: `api_keys` (migration 00028)

**Files inspected:**
- `api/db/migrations/00028_create_api_keys.sql`
- `api/db/generated/api_keys.sql.go`, `models.go:56–68`
- `api/handler/admin.go:488–549`
- `api/service/api_key.go`
- `web/src/features/admin/hooks.ts:132–161`, `ApiKeyManager.tsx`, `types.ts:38–48`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | Body field | `expires_at` / `expires_in` | TIMESTAMPTZ nullable | handler body expects `expires_in *string` (Go duration "720h"); `DisallowUnknownFields` | `ApiKeyManager.tsx:254` sends `expires_at: string` (ISO date) | 400 "unknown field expires_at" when user enters a date. Expiry UI is cosmetic. | Accept `expires_at` as ISO and compute duration server-side. |
| 2 | S1 | Response field | raw key | n/a | Go returns `raw_key` | FE reads `data.key` | One-time reveal broken — user never sees key. | Rename TS field or Go response tag. |
| 3 | S2 | Scope allowlist | `scopes` | TEXT[] NOT NULL | no CHECK | FE hardcodes `['read']` | No server-side validation of allowed scopes. | Document + validate. |
| 4 | S3 | Numeric | `id`, `user_id` | BIGINT | `int64` | `number` | 2^53. | Document. |
| 5 | S4 | UX hint | 10-key limit | n/a | `service/api_key.go:77` | not surfaced until hit | Generic error. | Disable Create button at 10. |
| 6 | S4 | maxLength | `name` | unbounded | no limit | no maxLength | Long names could DoS UI. | Add cap. |

### Table: `venue_managers` (migration 00032)

**Files inspected:**
- `api/db/migrations/00032_create_venue_managers.sql`
- `api/db/generated/venue_managers.sql.go`, `models.go:650–657`
- `api/handler/venue.go:595–755`
- `api/service/venue.go:236–244, 732–894`
- `web/src/features/registry/venues/hooks.ts:185–239`, `VenueManagersPanel.tsx`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S3 | BIGINT | `id`, `venue_id`, `user_id`, `added_by` | BIGINT | `int64` | `number` | 2^53. | Document. |
| 2 | S2 | Silent auto-add | venue creator bootstrap | n/a | `service/venue.go:237–242` ignores error with `_, _ =` | n/a | If insert fails, venue is orphaned (no admin). | Log + propagate. |
| 3 | S2 | Upsert semantics | `(venue_id, user_id)` UNIQUE | ON CONFLICT DO UPDATE flips role | Upsert | Frontend calls AddManager without checking | Re-adding existing manager with different role silently changes their role. | Split into Add vs Update endpoints. |
| 4 | S2 | Last-admin guard | n/a | n/a | `handler/venue.go:697–700` prevents self-removal but not last-admin removal | Hides controls for self only | Admin could demote/remove all other admins; venue becomes unmanageable. | Add last-admin invariant. |
| 5 | S4 | Missing `updated_at` | — | no column | role changes untracked | n/a | No audit trail. | Add column. |

### Table: `site_settings` (migrations 00039, 00040)

**Files inspected:**
- `api/db/migrations/00039_create_site_settings.sql`, `00040`
- `api/handler/settings.go`, `api/service/settings.go`
- `web/src/features/admin/AdminSettings.tsx`, `web/src/lib/google-maps.ts`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Whitelist-by-existence | allowed keys | `Update` errors "unknown setting key" if row missing | `AdminSettings.tsx:52–54` always sends all three | Fragile; deleting a row breaks all saves. | Use UPSERT with known allowlist. |
| 2 | S4 | URL validation | `ghost_url` | no format check | none | `type="url"` browser-only | Malformed URLs stored. | Parse URL server-side. |
| 3 | S4 | Schema discoverability | `key` | no CHECK | magic strings scattered | hardcoded three keys | Easy to forget one on add. | Add CHECK enum. |
| 4 | S3 | Concurrency | `updated_at` | NOT NULL, bumped | not returned | no optimistic-lock | Last-write-wins silently. | Return + require on PUT. |
| 5 | S2 | No audit | `updated_by`/log | missing | no activity_log call | no UI audit | Platform admins rotate keys invisibly. | Log to activity_logs. |

---

## Agent 2 — Venues & Courts

### Table: `venues` (migrations 00005, 00033, 00035)

**Files inspected:**
- `api/db/migrations/00005_create_venues.sql`, `00033`, `00035`
- `api/db/queries/venues.sql`, `api/db/generated/venues.sql.go`, `models.go:616-648`
- `api/handler/venue.go`, `admin.go:291-349`, `api/service/venue.go`
- `web/src/features/registry/venues/*`, `web/src/features/admin/VenueApproval.tsx`, `admin/types.ts`
- `web/src/components/VenuePicker.tsx`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | HTTP method | status endpoint | — | Admin route `PUT /admin/venues/{id}/status` | `hooks.ts:107` `apiPatch` | 405 on every approval/reject/archive. | Switch hook to `apiPut` or route to PATCH. |
| 2 | S1 | FK column type | `id` | BIGINT (no `public_id`) | `ParseInt` numeric | `VenueApproval.tsx` passes `venue.public_id` | 400 "invalid venue ID" regardless. | Use `String(venue.id)` and drop `public_id` from `VenueApprovalItem`. |
| 3 | S1 | Response shape | multiple | n/a | `ListPendingVenues` returns raw `[]generated.Venue` (no `court_count`, `owner_email`, `public_id`; field is `state_province` not `state`) | `VenueApprovalItem` declares all of those | Admin card shows "undefined courts". | Build enriched response DTO. |
| 4 | S2 | Admin-bypass validation | `status` | CHECK 4 values | admin endpoint does NOT whitelist | accepts anything | Invalid status leaks 500. | Add validStatuses map. |
| 5 | S2 | Admin-bypass state machine | `status` | transitions in service | admin endpoint skips service transition rules | n/a | Illegal transitions via admin. | Route admin writes through service. |
| 6 | S1 | Missing filter | `query` | — | `ListVenues` ignores `query` param | `VenuePicker.tsx:32` passes `?query=` | Search is a no-op. | Add `query` filter server-side or re-point to `/venues/search`. |
| 7 | S2 | Wrong lookup | selected venue | n/a | — | `VenuePicker.tsx:37-48` fetches `limit=1&offset=0` | Always renders "Unknown Venue" for selected. | `GET /venues/{id}` to resolve. |
| 8 | S3 | BIGINT | IDs | BIGINT | `int64` | `number` | 2^53. | Document. |
| 9 | S3 | Enum typing | `status` | CHECK enum | `string` | `Venue.status: string` | No typed union. | `export type VenueStatus = ...`. |
| 10 | S4 | Missing form fields | `description`, `surface_types`, `amenities`, `org_id`, `managed_by_user_id`, `notes` | nullable | accepted | not in VenueForm | Cannot set from UI. | Add inputs. |
| 11 | S4 | Missing TS fields | same as above | — | Present in response | `Venue` interface omits them | Detail pages can't render without casts. | Extend interface. |
| 12 | S4 | maxLength | all TEXT | no DB cap | — | no maxLength | — | Consider UX caps. |
| 13 | S4 | Slug conflict hint | — | — | 100-retry then ConflictError | generic toast | No pre-check UX. | Add slug-check endpoint. |
| 14 | S2 | Status override on create | `status` | DEFAULT 'draft' | service force-sets `params.Status = "draft"` | — | Silently discards client input. | Reject explicitly or honor with validation. |
| 15 | S3 | Nullability | address/lat/lng/timezone | nullable | `*string`/`pgtype.Float8` | `string \| null`/`number \| null` | ✅ aligned. | — |
| 16 | S4 | Auto-manager silent fail | `managed_by_user_id` | — | `_, _ = AddVenueManager(...)` | — | Creator loses admin if insert races. | Wrap in transaction. |

### Table: `courts` (migration 00006)

**Files inspected:**
- `api/db/migrations/00006_create_courts.sql`
- `api/db/queries/courts.sql`, `generated/courts.sql.go`, `models.go:70-89`
- `api/handler/court.go`, `venue.go:469-564`, `court_queue.go`
- `api/service/venue.go`, `court_queue.go`
- `web/src/features/registry/courts/*`, `venues/CourtListPanel.tsx`, `scoring/types.ts`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Clobbering | `stream_type` | CHECK 5 | `service/venue.go:423-426` overrides with `DetectStreamType(url)` | form lets user pick | "Other (iframe)" choice lost; user's explicit pick always overwritten. | Only auto-detect when empty. |
| 2 | S2 | Enum drift risk | `stream_type` | 5 values | matches | 5 values hardcoded in two forms | ✅ today, drift risk. | Centralize constant. |
| 3 | S3 | Enum typing | `stream_type` | CHECK 5 | `*string` | `string \| null` | No TS union. | Add union. |
| 4 | S3 | Enum typing | `surface_type` | CHECK 6 | `*string` | `string \| null` | No TS union; 3 forms duplicate list. | Central constant + union. |
| 5 | S1 (latent) | Unique conflict | `(venue_id, slug)` | 2 partial uniques | auto-suffix | generic error | If 100-retry fails, UX unclear. | Display err.message explicitly. |
| 6 | S2 | Server-generated | `slug` | NOT NULL | service generates from name | FE never sends | ✅ correct. | — |
| 7 | S4 | Cascade semantics | `venue_id` | no ON DELETE | soft-delete only | — | Venue soft-delete leaves courts orphaned. | Cascade soft-delete. |
| 8 | S3 | BIGINT | IDs | BIGINT | `int64` | `number` | 2^53. | Document. |
| 9 | S4 | Missing form controls | `is_temporary`, `sort_order` | writable | supported | not in CourtEditForm | Can't reorder or mark temp after creation. | Add inputs. |
| 10 | S4 | TS drift | `venue_name`, `active_match`, `on_deck_match` | computed | in CourtResponse | `Court` interface missing them; `CourtSummary` has them | Two parallel types for same API. | Merge. |
| 11 | S2 | Missing auth | tournament court ops | — | AssignCourtToTournament/CreateTemp/Unassign only check session != nil | — | Any user can mutate any tournament's courts. | Add `CanManageTournament` gate. |

### Table: `tournament_courts` (migration 00034)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Silent upsert | `(tournament_id, court_id)` UNIQUE | `ON CONFLICT DO UPDATE SET is_temporary = EXCLUDED.is_temporary` hardcodes `false` | — | Re-assigning a temp court flips it to permanent silently. | Change assign endpoint to take explicit `is_temporary` or `DO NOTHING`. |
| 2 | S4 | 409 handling | — | never raised | — | Not reachable today. | Keep typed error path. |
| 3 | S2 | Cascade semantics | `tournament_id`/`court_id` | ON DELETE CASCADE | — | No UI warning when removing a court with matches. | Null-out match.court_id or prompt. |
| 4 | S4 | Misleading comment | CleanupTournamentTempCourts | docstring says "archives/soft-deletes" but only DELETEs join table | — | Comment lies. | Fix comment or do soft-delete. |
| 5 | S4 | Surface free-form | `surface_type` | CHECK | service does not re-validate | `TournamentCourts.tsx` has correct 6-item list | API caller could send "banana" → raw 500. | Add whitelist. |

### Migration 00021 — `matches.court_queue_position`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Dead field | `court_queue_position` | INT nullable on matches | `MatchResponse` omits; `CourtQueueEntry.position` computed from list order | only on `DashboardMatch` (hand-rolled) | Column is write-only; reorder dialog writes, nobody reads. | Include in MatchResponse and sort by it. |
| 2 | S2 | Wrong ORDER BY | — | — | `ListMatchesByCourt` orders by scheduled_at | — | After reorder, refetch shows old order → reorder appears to fail. | Order by `court_queue_position NULLS LAST, scheduled_at, created_at`. |

---

## Agent 3 — Tournaments Core

### Table: `tournaments` (migration 00010)

**Files inspected:**
- `api/db/migrations/00010_create_tournaments.sql`
- `api/db/generated/models.go`, `tournaments.sql.go`
- `api/service/tournament.go`, `api/handler/tournament.go`
- `web/src/features/tournaments/hooks.ts`, `TournamentCreate.tsx`, `TournamentSettings.tsx`, `TournamentOverview.tsx`, `CloneDialog.tsx`
- `web/src/components/StatusBadge.tsx`

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| T-01 | S1 | Override | `status` | DEFAULT 'draft' | `service.Create` force-sets `params.Status = "draft"` | "Create & Publish" sends `status: 'published'` | Publish button silently no-ops. | Honor caller's status or split into create+UpdateStatus. |
| T-02 | S1 | Nested payload dropped | `divisions` | separate table | handler decodes only 18 fields, no `divisions` key | Wizard sends `divisions: [...]` | 3 divisions silently dropped. | Accept nested array in transaction or loop `POST /divisions`. |
| T-03 | S2 | Dropped fields | `start_date/end_date/td_user_id/include_registrations` | present | `CloneTournament` body accepts only `name` + `include_registrations` | CloneDialog sends dates, never surfaces include_registrations | Clone dates ignored; toggle is dead UI. | Extend clone handler body. |
| T-04 | S2 | State machine gaps | `status` | 8 values in CHECK | `validTournamentTransitions` missing `archived` source, missing `cancelled` from `completed/archived` | Cancel button shown for `completed` → 400. | Hide button or extend transitions. |
| T-05 | S3 | BIGINT FK | ids | BIGINT | `int64` | `number` | 2^53 risk. | Document. |
| T-06 | S2 | Nullability | `show_registrations` | BOOL DEFAULT true (nullable) | `pgtype.Bool`; response uses `bool` coercing NULL→false | TS `boolean` | NULL row shows as false silently. | Add NOT NULL. |
| T-07 | S3 | Nullability | `social_links`/`sponsor_info` | JSONB DEFAULT; nullable | non-null in response | TS `... \| null` | TS claims nullable; backend guarantees non-null. | Tighten TS. |
| T-08 | S3 | Missing UI | `registration_open_at`, `registration_close_at` | TIMESTAMPTZ | accepted in params | TS Tournament interface omits; no form inputs | Two most important registration fields unreachable. | Add to TS + form. |
| T-09 | S3 | Unused field | `public_id` | auto-generated | round-tripped | never displayed | Wasted field. | Surface as copyable ID. |
| T-10 | S4 | Conflict UX | `slug` | UNIQUE | 100-retry then ConflictError | generic toast | Raw error on manual slug conflict. | Handle 409 message. |
| T-11 | S4 | FK cascade | `venue_id/league_id/season_id` | default RESTRICT | — | no UI warn | Cryptic FK error on delete. | Add SET NULL or warn. |
| T-12 | S4 | Missing create input | `max_participants` | nullable INT | accepted | not in wizard Step 1 | Cannot set cap at creation. | Add input. |

### Table: `divisions` (migration 00011)

Note: BUG-09 re `format`/`gender_restriction`/`bracket_format`/`registration_mode` fixed in 0981ec1.

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| D-01 | S1 | BUG-09 regression | `registration_mode` | CHECK `('open','invite_only')` | accepts *string | **`TournamentCreate.tsx:60-64` redefines `REGISTRATION_MODE_OPTIONS = [{value:'team'},{value:'individual'},{value:'partner'}]` and `EMPTY_DIVISION.registration_mode = 'team'`** | Wizard re-introduces the exact values 0981ec1 removed. Divisions created through wizard 500. | Replace wizard's inline options + default with the canonical values. Fix `templateToDraft` too (line 118). |
| D-02 | S1 | Nullability crash | `gender_restriction` | nullable | `*string` ✅ | TS non-null; `DivisionOverview.tsx:93` does `.replace(/_/g, ' ')` without guard | NULL row crashes overview. | TS `string \| null` + null-guard. |
| D-03 | S2 | Dead feature | `entry_fee_amount` | NUMERIC nullable | sqlc supports | handler body/response both **omit**; FE form collects it | Fee UI is cosmetic — nothing persists or reads it. | Add to body + response. |
| D-04 | S2 | Many unreachable columns | `age_restriction`, `check_in_open`, `allow_self_check_in`, `auto_promote_waitlist`, `grand_finals_reset`, `advancement_count`, `current_phase`, `report_to_dupr`, `report_to_vair`, `allow_ref_player_add`, `sort_order` | present with defaults | sqlc supports; handler body omits; response mostly omits | — | Every advanced division toggle unreachable from API. DUPR/VAIR reporting unusable. | Extend handler body + response + form. |
| D-05 | S2 | Status machine | `status` | 6 values | `validDivisionTransitions` matches ✅ | `DIVISION_STATUS_TRANSITIONS` matches ✅ | ✅ | — |
| D-07 | S2 | Clone field loss | `age_restriction, check_in_open, allow_self_check_in, entry_fee_amount, entry_fee_currency` | — | `tournament.Clone` doesn't copy them | — | Cloned tournaments lose these per division. | Add fields to Clone. |
| D-08 | S3 | Nullability | `auto_approve, auto_promote_waitlist, grand_finals_reset, check_in_open, allow_self_check_in, report_to_*, allow_ref_player_add` | BOOL DEFAULT x (nullable) | `pgtype.Bool` | TS `boolean` (non-null) | NULL silently becomes false. | Add NOT NULL. |
| D-09 | S3 | Missing UI | `skill_min, skill_max, rating_system` | present | decoded | not in TS Division nor form | Eligibility unreachable. | Add. |
| D-10 | S3 | Nullability | `seed_method, registration_mode, entry_fee_currency, scoring_format, notes, rating_system, current_phase` | nullable | `*string` ✅ | TS non-null | TS lies. | Make `string \| null`. |
| D-11 | S3 | Missing display | `skill_min, skill_max, age_restriction` | — | — | not shown in DivisionOverview | Eligibility invisible to players. | Render. |
| D-12 | S4 | Conflict UX | `(tournament_id, slug)` UNIQUE | — | auto-suffix | generic error | — | Surface ConflictError. |
| D-13 | S4 | maxLength | `name, slug, notes` | unbounded | — | no cap | Minor. | Add `maxLength`. |
| D-14 | S4 | Cascade | `tournament_id` | no ON DELETE | soft-delete not cascaded | — | Soft-deleted tournaments still expose divisions via direct ID. | Filter or cascade. |

### Table: `pods` (migration 00012)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| P-01 | S3 | Nullability | `sort_order` | INT DEFAULT 0 (nullable) | `pgtype.Int4` | TS `number` | NULL row → undefined. | NOT NULL or `number \| null`. |
| P-02 | S4 | Conflict handling | `(division_id, name)` UNIQUE | — | no pgError 23505 catch | — | Generic 500 on duplicate. | Catch and return ConflictError. |
| P-03 | S4 | No UI | pods | — | — | hooks exist but no PodForm/PodList | Full backend wiring, zero UI. | Add panel or remove hooks. |
| P-04 | S4 | Cascade | `division_id` | no cascade | — | Division delete leaves orphan pods. | Add cascade-soft-delete. |

### Table: `registrations` (migration 00013)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| R-01 | S1 | Bulk op semantics | — | — | `BulkUpdateNoShow(divisionID)` ignores IDs — marks ALL non-checked-in/withdrawn as no-show | `useBulkNoShow` passes `{registration_ids}`, handler doesn't decode body | UI promises "these IDs", backend no-shows everyone. | Accept IDs filter in query or remove from TS. |
| R-02 | S2 | Missing filter option | `status` | CHECK includes `withdrawn_mid_tournament` | — | dropdown omits it | Cannot filter mid-tournament withdrawals. | Add option. |
| R-03 | S2 | No state machine | `status` | 8 values | `UpdateStatus` accepts any string | — | No transition validation — scorekeeper could skip states. | Add `validRegistrationTransitions`. |
| R-04 | S2 | Conflict UX | `(division_id, team_id)` partial unique | — | no 23505 catch | generic error | Duplicate registration shows raw error. | Catch + return ConflictError. |
| R-05 | S2 | Check constraint | table-level | `CHECK (team_id IS NOT NULL OR player_id IS NOT NULL)` | service doesn't pre-validate | FE only sends one | Direct API caller with both NULL → raw DB error. | Pre-validate in service. |
| R-06 | S2 | Missing UI | capacity count | — | logic only in Register | DivisionOverview shows max_teams, not used | Can't see "N/M slots remaining". | Compute + display. |
| R-07 | S3 | BIGINT | IDs | BIGINT | `int64` | `number` | 2^53. | Document. |
| R-08 | S3 | Nullability | `seeking_partner` | BOOL DEFAULT false (nullable) | `pgtype.Bool` | TS `boolean` | NULL → false silently. | Add NOT NULL. |
| R-09 | S3 | Dropped field | `seed` on create | — | sqlc accepts | handler doesn't decode | Can't pre-seed at create. | Either decode or remove from TS input. |
| R-10 | S3 | Missing display | `final_placement` | INT nullable | present | TS has field but UI never renders | Placement hidden after completion. | Add column when status=completed. |
| R-11 | S4 | Missing edit paths | `registration_notes`, `seeking_partner` | — | no update query | — | Typo in notes unfixable. | Add endpoints. |

### Table: `tournament_staff` (migration 00038)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| S-01 | S2 | **Security** | `raw_password TEXT NOT NULL` | plaintext at rest | returned via API | FE displays + copies | **Plaintext credentials in DB backups/logs.** | Encrypt column or destroy after first view. |
| S-02 | S2 | Missing `updated_at` | — | — | — | — | No rotation audit. | Add column + bump. |
| S-03 | S2 | Enum drift guard | `role` | CHECK 2 values | hardcoded | hardcoded | ✅ today. | Shared constant. |
| S-04 | S2 | Transaction scope | unique(tournament_id, role) | — | `CreateStaffAccounts` wrapped in tx, but called OUTSIDE tournament-create tx | — | Orphan tournament possible on staff failure. | Unified tx. |
| S-05 | S2 | Cascade mismatch | `tournament_id/user_id ON DELETE CASCADE` | — | tournament soft-delete doesn't touch staff | — | Staff logins remain active after tournament soft-delete. | Disable staff on soft-delete. |
| S-06 | S3 | Nullability | `email` | nullable | `*string` | TS `string \| null` ✅ | UI shows `"Email: null"` unguarded. | Fallback. |
| S-07 | S3 | List shape | — | — | `GetAssignmentByUserID :one` (errors on >1) | `MyTournamentAssignment` single | Schema allows many-to-many; query doesn't. | Change to :many or UNIQUE(user_id). |

---

## Agent 4 — Leagues & Templates

### Table: `teams` (migration 00003)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S2 | Missing CHECK | `short_name` | no length CHECK | service validates 2–4 | form maxLength=4 only, no min | min=1 char possible → 400 server. | Add DB CHECK + FE min. |
| 2 | S3 | BIGINT | `id, org_id` | BIGINT | `int64` | `number` | 2^53. | Document. |
| 3 | S3 | Default color surprise | `primary/secondary_color` | nullable | `*string` | default hex always sent | Every team gets default branding. | Sentinel for "not set". |
| 4 | S3 | Implicit Slug | `slug` | NOT NULL | service fills; not in handler struct | — | Relies on service always before query. | Document or move to handler. |
| 5 | S3 | No org UI | `org_id` | nullable | accepted on create | TeamForm doesn't expose | Cannot set org via UI. | Add selector. |
| 6 | S3 | One-way org_id | — | — | no update path | — | Cannot move team between orgs. | Add "move team". |
| 7 | S4 | Bound asymmetry | `founded_year` | INT | — | min=1900 HTML, validate rejects <1900, allows >2100 | Inconsistent. | Unify. |
| 8 | S4 | Roster role typing | `team_rosters.role` | CHECK 3 values | validates | hook accepts `?: string` | No union. | Literal union. |
| 9 | S4 | Dead column | `team_rosters.status` | CHECK 3 values | — | — | No read/write path. | Remove or expose. |

### Table: `leagues` (migrations 00007, 00033, 00035)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 10 | S2 | "Publish" silently drafts | `status` | DEFAULT 'draft' | service force-sets 'draft' | "Create & Publish" button sends `status: 'published'` | Same pattern as tournaments. | Honor status or split create+update. |
| 11 | S2 | Transitions | `status` | 5 values | transitions cover 4 paths; no transition from archived/cancelled | aligned with map | Intentional but strict. | Document. |
| 14 | S2 | Response non-null coerce | `social_links` | DEFAULT `{}` nullable | coerces to `{}` | TS `... \| null` | TS incorrectly nullable. | Tighten. |
| 15 | S2 | Same | `sponsor_info` | DEFAULT `[]` | coerces | TS nullable | Same. | Same. |
| 18 | S3 | FK | `created_by_user_id` | default RESTRICT | no handling | — | User deletion blocked by leagues. | `ON DELETE SET NULL` or document. |
| 19 | S4 | Email validation | `contact_email` | no format check | no service check | loose `.includes('@')` | Easily bypassed. | Regex + `type="email"`. |
| 20 | S4 | URL validation | `website_url` etc. | no CHECK | no validation | — | Any string accepted. | Validate. |

### Table: `seasons` (migration 00008)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 21 | S2 | Fragile override | `status` | NOT NULL DEFAULT 'draft' | handler sends Status: "" then service force-sets 'draft' | — | CHECK violation if service override ever removed. | Handler sets default. |
| 22 | S2 | Transitions | `status` | CHECK 4 values | `validSeasonTransitions` aligned with FE | ✅ | — | — |
| 23 | S2 | Nullability | `standings_method` | nullable DEFAULT | `*string` | TS non-null | Old NULL row breaks render. | Add NOT NULL or TS nullable. |
| 24 | S3 | Orphan column | `standings_config` | nullable JSONB | present in params/struct | TS has it | handler body + response OMIT it | Cannot set/read via API. | Add to handler. |
| 25 | S3 | Dropped field | `roster_confirmation_deadline` | nullable | in sqlc params | FE collects and sends | handler body structs OMIT | Silently dropped. | Add to body. |
| 27 | S3 | Unique slug | `(league_id, slug)` | UNIQUE | service retries | — | Handled. | — |
| 28 | S3 | Cascade | `league_id` | default RESTRICT | — | — | Leagues soft-deleted → orphan seasons. | Document or CASCADE. |

### Table: `division_templates` (migration 00009)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 29 | S2 | Unreachable | `age_restriction` | nullable JSONB | in params | TS has it | handler body/response OMIT | Column unreachable via API. | Add. |
| 30 | S2 | Unreachable | `entry_fee_amount` | nullable NUMERIC | in params | TS has it | handler body/response OMIT | Currency without amount. | Add. |
| 31 | S2 | Six unreachable | `allow_self_check_in, allow_ref_player_add, report_to_dupr, report_to_vair, grand_finals_reset, advancement_count` | present with defaults | in params | TS declares (non-null) | handler body/response OMIT all 6 | Template cols cannot be set or observed via API. | Add all 6. |
| 32-36 | S3 | Nullability | `scoring_format, seed_method, rating_system, gender_restriction, registration_mode, entry_fee_currency` | nullable TEXT | `*string` | TS non-null | TS lies. | Widen to `\| null` OR add NOT NULL DB. |
| 37 | S2 | Ghost field | `scoring_preset_id` | **does not exist** | not in model | TS declares it | Always undefined at runtime. | Remove from TS. |
| 42-43 | S4 | Nullable bool/int | `auto_approve, auto_promote_waitlist, grand_finals_reset, advancement_count` | nullable defaults | `pgtype.Bool/Int4` | TS non-null | NULL → false/wrong value silently. | Add NOT NULL. |
| 44 | S4 | Form coverage | 9 of 21 cols | — | — | DivisionTemplateForm limited | Users can't configure most template fields. | Expand or document. |

### Table: `league_registrations` (migration 00015)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 45 | S2 | No state machine | `status` | 3 values | no validation | FE buttons enforce UI-only | Any client can set any status. | Add transitions map. |
| 46 | S2 | No soft-delete | — | no `deleted_at` | no query | — | Withdrawn terminal; rows stay forever. | Document or add. |
| 47 | S3 | Cascade | `league_id, org_id` | default RESTRICT | — | — | Latent. | Document or CASCADE. |
| 48 | S3 | Conflict UX | `(league_id, org_id)` UNIQUE | — | no pre-check | generic error | Raw SQL error on duplicate. | Pre-check + 409. |
| 50 | S3 | Missing enrich | `org_name` | not a column | not returned | TS has optional `org_name` | Shows `Org #N` fallback always. | Backend enrich. |
| 51 | S4 | Missing UI | `notes` | nullable | accepted | no form field | Write-only via API. | Add textarea. |

### Table: `season_confirmations` (migration 00016)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 52 | **S1** | Missing API | entire table | table + sqlc exist | **no handler, no service, no route** | `useListSeasonConfirmations` + `useConfirmSeason` hit non-existent routes | Both mutations always 404. | Implement handler + mount routes. |
| 53 | S2 | Nullability | `confirmed` | DEFAULT false (nullable) | `pgtype.Bool` | TS `boolean` (non-null) | NULL → undefined. | Add NOT NULL. |
| 54 | S2 | Type | `deadline` | NOT NULL | `time.Time` | TS `string \| null` | Incorrectly nullable. | TS non-null. |
| 55 | S2 | Required | `deadline` on create | NOT NULL | required in params | FE posts `{team_id, division_id}` no deadline | Future handler will fail. | Synthesize from season. |
| 56 | S3 | FK semantics | `division_id` | REFERENCES divisions(id) | int64 | number | Points at tournament-level divisions — odd for seasons. | Document or rename. |
| 57 | S3 | Cascade | `season_id/team_id/division_id` | default RESTRICT | — | — | Delete blocked. | CASCADE or soft-delete. |
| 58 | S3 | Conflict UX | unique(season_id, team_id, division_id) | — | no pre-check | — | Will leak raw error. | Handle 23505. |
| 59 | S3 | Missing enrich | `team_name, division_name` | — | — | TS has optional | Never populated. | Enrich in handler. |
| 60 | S4 | No audit | — | no created_at/updated_at/deleted_at | — | — | No rotation record. | Add columns. |

---

## Agent 5 — Matches & Scoring

### Table: `scoring_presets` (migration 00017)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | Response shape | entire row | flat columns | flat JSON | `ScoringPresetPicker.tsx` declares nested `scoring_config: {...}` | Picker reads nonexistent path — all metadata undefined; only `p.name` renders. | Replace TS interface with flat shape. |
| 2 | S3 | BIGINT | `id, created_by_user_id` | BIGINT | `int64` | `number` | 2^53. | Document. |
| 3 | S3 | Enum freedom | `sport` | TEXT DEFAULT 'pickleball', no CHECK | accepts any | — | No allowlist. | Add CHECK or validate. |

### Table: `matches` (migration 00018, modified by 00020, 00021)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 6 | S1 | Enum mismatch | `status` | CHECK 7 values | matches DB exactly | TS `MatchStatus` adds `'bye'` | Any persist of 'bye' 500s. 'bye' branches in FE are dead. | Remove 'bye' from TS; use `is_bye: boolean` flag. |
| 7 | S1 | No TS enum | `match_type` | CHECK 5 | matches | TS free `string` | No compile-time safety. | Add `MatchType` union. |
| 8 | S1 | No allowlist | `win_reason` | CHECK 5 | no allowlist in CompleteMatch | forfeit hook sends `reason` that's silently dropped | Typo 500s; forfeit reason lost. | Validate + fix forfeit hook + add TS union. |
| 9 | S2 | Unconditional status write | — | — | `applyEngineResult` writes status on every event | — | Latent footgun. | Gate write to explicit transitions. |
| 10 | S2 | Legacy timeout types | `event_type` | 00031 preserved legacy `timeout_team1`, `timeout_team2` | `ListMatchEventsByType(timeout)` misses them | — | Older rows under-report timeout counts. | Data migration or OR together. |
| 12 | S3 | BIGINT | all FKs | BIGINT | `int64` | `number` | 2^53. | Document. |
| 15 | S2 | Dropped fields | `timeouts_per_game, timeout_duration_sec` | NOT NULL defaults | — | quick-match form optional; sends undefined | Defaults to zero (non-preset). | Send explicit values. |
| 19 | S3 | Event validation | `event_type` on POST events | CHECK enforced | `RecordEvent` no validation | — | Unknown type 500s. | Validate against `AllEventTypes`. |
| 20 | S3 | Inline string | — | — | `ScorePoint` uses `Sprintf("point_team%d")` | — | Bypasses contract test. | Use constants. |

### Table: `match_events` (migrations 00019, 00031)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 23 | S2 | Legacy coverage | `event_type` | 20 canonical + 10 legacy | knows only 20 | knows only 20 | Old rows rendered as raw `event_type`. | Data migration. |
| 26 | **S1** | Response shape | `score_snapshot` | team1/team2_score, current_set, current_game, serving, server, set_scores | Go contract matches those keys | **TS `ScoreSnapshot` has `team_1_games_won`, `team_2_games_won` (not emitted), missing `current_set`** | Timeline reads undefined fields; computed fields undefined. | Align TS to Go contract. |
| 27 | S3 | BIGINT | ids | BIGINT | `int64` | `number` | 2^53. | — |
| 28 | S4 | Defaults | `set_scores/payload` | `'[]'`/`'{}'` defaults | passes `[]byte{}` | coerced server-side | Early events may have `""` stored. | Substitute defaults. |
| 29 | S2 | Cascade | `match_id` | ON DELETE CASCADE ✅ | — | — | Correct. | — |

### Table: `match_series` (migrations 00020, 00022)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 33 | S1 | Wrong route | GET series | `/match-series/{id}` numeric; `/match-series/public/{publicId}` | correct | `useMatchSeries(publicId)` hits numeric route with ms_xxx string | Detail page always 400. | Fix hook URL. |
| 32 | S1 | Nested not populated | `team1/team2` | n/a | backend doesn't include nested team objects | TS `MatchSeriesSummary.team1: MatchTeam \| null` | Detail page always shows "Team 1" / "Team 2". | Enrich backend or drop from TS. |
| 34 | S1 | No TS enum | `series_format` | CHECK 3 values | validated | TS `string` | No safety for future forms. | Add union. |
| 35 | S1 | No TS enum | `status` | CHECK 5 | matches | TS `string` | Same. | Add union. |
| 37 | S2 | No transition table | `status` | CHECK 5 | ad-hoc checks in each method | — | No single source of truth. | Unify. |
| 42 | S4 | `games_to_win` consistency | — | DEFAULT 2 | service checks >= 1 | — | No cross-check vs `series_format`. | Add `games_to_win = (format-1)/2 + 1`. |

### Table: `standings_entries` (migration 00026)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 49 | S2 | Wrong aggregation | `points_for/against` | — | recompute sums final-game scores only | — | Under-reports multi-game matches. | Sum across all games in set_scores. |
| 50 | S2 | Missing status filter | — | — | recompute filters status='completed' only | — | Forfeits excluded. | Include `forfeited`. |
| 53 | S2 | Override ignored | `override_points` | INT nullable | stored but not used by ranker | — | Admin override stored but never applied. | Sort by `COALESCE(override_points, standing_points)`. |

---

## Agent 6 — Overlays & Content

### Table: `announcements` (migration 00014)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 1 | S1 | Dropped field | `division_id` | BIGINT REFERENCES divisions | sqlc supports | handler create bodies don't decode | Cannot create division-scoped announcements via API. | Add to request body. |
| 2 | S1 | Missing routes | flat `/announcements/{id}` | — | only nested routes exist | `useUpdateAnnouncement`, `useDeleteAnnouncement` call `/announcements/{id}` | Both mutations 404. | Mount flat routes or fix hooks. |
| 3 | S1 | Dropped filter | `division_id` query | — | `ListAnnouncementsByTournament` doesn't accept it | hook passes `?division_id=` | Filter silently dropped. | Accept in handler. |
| 4 | S2 | Scope validation | — | CHECK (tournament OR league) | service allows division-only | — | Division-only would pass service, fail DB. | Tighten service. |
| 5 | S3 | Nullability | `is_pinned` | DEFAULT false (nullable) | `pgtype.Bool` | TS non-null | NULL → false silently. | NOT NULL. |
| 6 | S3 | Hidden column | `deleted_at` | — | not in response | not in TS | Minor. | Document. |
| 7 | S4 | BIGINT | ids | BIGINT | `int64` | `number` | 2^53. | — |

### Table: `court_overlay_configs` (migrations 00023, 00025)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 8 | S1 | Enum mismatch | `idle_display` | CHECK 3 values (`court_name/branding/none`) | service writes only `'court_name'` | TS constant has **4 values** (`COURT_NAME, NEXT_MATCH, SPONSOR, BLANK`) | Any non-default write via future UI 500s. | Align both sides to one set. |
| 9 | S2 | No UNIQUE | `overlay_token` | non-unique index only | `GetOverlayConfigByToken :one` collapses dupes | used as auth secret | Two courts could share token. | Add UNIQUE (partial). |
| 10 | S2 | Wire-format leak | `source_profile_id` | BIGINT NULL | response uses `pgtype.Int8` — serializes as `{Int64, Valid}` | TS has `PgtypeInt8 \| number \| null` helper | Smell. | Map to `*int64`. |
| 11 | S3 | Unreachable cols | `show_branding, match_result_delay_seconds, idle_display` | defaults | sqlc supports UPDATE | — | No handler calls the update query. | Add endpoint or remove cols. |
| 12 | S3 | Triple default | `elements` JSON | SQL DEFAULT + Go re-materialization | Go duplicates the map | TS duplicates via rendering | 3 sources of truth. | Centralize. |
| 13 | S4 | Cascade surface | `source_profile_id` | ON DELETE SET NULL | correct | — | SP delete silently unbinds courts; no UI warn. | Surface in confirm. |
| 14 | S4 | Race on create | `court_id` UNIQUE | — | `GetOrCreateConfig` has race window | — | Concurrent requests may conflict. | `ON CONFLICT DO NOTHING RETURNING`. |

### Table: `source_profiles` (migration 00024)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 15 | S1 | Key mismatch | `auth_config` | JSONB | **TestConnection reads `"header"`; poller reads `"header_name"`** | form writes `{header, key}` | TestConnection works; live polling silently uses `X-API-Key` fallback. | Standardize on one key. |
| 16 | S2 | Wrong docs | webhook | — | `ReceiveWebhook` verifies `X-Webhook-Signature` (HMAC) | form text says "X-Webhook-Secret" | Following UI → always 403. | Rewrite UI helper. |
| 17 | S2 | No partial update | writable cols | — | UPDATE assigns every col (no COALESCE) | FE sends full payload | Fragile — partial mutation clears secrets. | Switch to COALESCE narg. |
| 18 | S3 | Nullability | `poll_interval_seconds` | DEFAULT 5 (nullable) | `pgtype.Int4` | normalizer returns `number \| null` | Workable but noisy. | NOT NULL. |
| 19-20 | S3 | Enums aligned | `source_type, auth_type` | CHECK | handler re-validates | TS matches | ✅ | — |
| 21 | S3 | `last_poll_status` | no CHECK | accepts any | not surfaced | Should be enum `ok/error/timeout`. | Add CHECK. |
| 22 | S4 | No unique | `(created_by_user_id, name)` | none | — | duplicates allowed | Confusing picker. | UNIQUE. |
| 23 | S4 | Cascade | `created_by_user_id` | no ON DELETE | — | — | User delete blocked. | ON DELETE CASCADE. |

### `overlay_data_overrides` (migration 00025)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 24 | S2 | **No auth** | endpoint | — | **UpdateDataOverrides / ClearDataOverrides handlers don't call `requireSession`** | — | Anyone with court ID can rewrite overrides. | Add session check. |
| 25 | S3 | Key validation | `data_overrides` JSONB | free-form | `ApplyDataOverrides` switch on 29 keys; unknowns silently discarded | TS union matches 29 | Unknown keys stored forever, never applied. | Validate in handler. |
| 26 | S4 | Default | `{}` DEFAULT | — | correct | empty object valid | ✅ | — |

### Table: `uploads` (migration 00029)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 27 | S1 | Field name | `size_bytes` | BIGINT NOT NULL | response emits `"size_bytes"` | TS `Upload.size: number` | Browser shows "NaN B". | Rename TS field + formatFileSize call. |
| 28 | S1 | Missing field | `original_name` | NOT NULL | response emits | TS omits | Shows random hex filename. | Add to TS. |
| 29 | S2 | Wrong type | `entity_id` | BIGINT nullable | response emits `*int64` (number) | TS `string \| null` | Downstream parseInt crashes. | TS `number \| null`. |
| 30 | S2 | No CHECK | `entity_type` | nullable TEXT | accepts any | — | Effectively unused. | CHECK or drop. |
| 31 | S3 | No `updated_at` | — | missing | — | — | Schema inconsistency. | Add if mutable. |
| 32 | S3 | BIGINT | `size_bytes` | BIGINT | `int64` | `number` | Capped at 10MB at write. | — |
| 33 | S4 | Cleanup | `ListOrphanedUploads` WHERE | hardcoded entity tables | matches | — | Any new entity silently swept. | Use `entity_type` + `entity_id`. |

### Table: `ad_configs` (migrations 00036, 00037)

**Findings:**

| # | Severity | Dimension | Column | DB | Go | TS/Form | Mismatch | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| 34 | S1 | Dropped type field | `display_duration_sec` | NOT NULL DEFAULT 8 | sqlc params + handler accept | `useCreateAd`/`useUpdateAd` input types OMIT it | Today works via untyped spread; brittle. | Add to hook input types. |
| 35 | S2 | Enum not enforced | `slot_name` | NOT NULL TEXT | no validation | FE Select 5 values | Any string accepted server-side. | Add CHECK. |
| 36 | S2 | Cannot clear | `image_url, link_url, alt_text, embed_code, name` | nullable | UPDATE UPSERT uses COALESCE with `*string` | handler sets only when `!= nil` | No way to clear → switching ad type leaves stale fields. | Explicit clear semantics. |
| 37 | S3 | Missing response | `created_by_user_id` | BIGINT nullable FK | not in response | not in TS | Admins can't see authors. | Add. |
| 38 | S3 | No bounds | `display_duration_sec` | NOT NULL DEFAULT 8 | handler enforces >= 1 only | FE max=120 | API caller can set 10000s. | Add CHECK. |

</agent_reports>

## Recommended Fix Batches

Prioritized by severity × impact. Each batch is a commit on `audit/db-schema-alignment`. Stop after any batch for review.

### Batch A — S1 blockers, high user impact (deploy-blocking)
**Commit:** `fix: align admin panel endpoints + API key flow with backend contracts`
- Agent 1 #1 (role `org_admin` → `organization_admin`)
- Agent 1 #2 (PATCH vs PUT on admin role/status)
- Agent 1 #3 (DisallowUnknownFields + `reason` field)
- Agent 1 #4 (activity-logs endpoint path)
- Agent 1 #7 (Player TS interface — data loss on profile edit)
- Agent 2 #1, #2, #3 (venue approval method + ID type + response shape)
- API keys #1, #2 (expires field shape + raw_key response field)

### Batch B — S1 blockers, tournament & division workflows
**Commit:** `fix: tournament wizard + division creation consistency`
- Agent 3 D-01 (BUG-09 regression inside TournamentCreate.tsx — divisions created via wizard still 500)
- Agent 3 D-02 (gender_restriction TS nullability crash)
- Agent 3 T-01 (publish on create honors status)
- Agent 3 T-02 (wizard's divisions array decoded)
- Agent 3 R-01 (bulk no-show doesn't mark everyone)

### Batch C — S1 blockers, matches & series
**Commit:** `fix: match series + scoring preset + match event response shape`
- Agent 5 #33 (useMatchSeries route)
- Agent 5 #1 (ScoringPresetPicker TS shape)
- Agent 5 #26 (ScoreSnapshot TS vs Go contract)
- Agent 5 #32 (team1/team2 enrichment)
- Agent 5 #6, #7, #8 (MatchStatus 'bye', MatchType enum, win_reason validation)

### Batch D — S1 blockers, overlay + content
**Commit:** `fix: overlay config + upload + announcement routes`
- Agent 6 #8 (idle_display enum alignment)
- Agent 6 #15 (source_profiles auth_config key)
- Agent 6 #16 (webhook header name documentation)
- Agent 6 #24 (data-overrides auth check)
- Agent 6 #27, #28 (upload size_bytes + original_name)
- Agent 6 #1, #2, #3 (announcement division_id + flat routes + filter)

### Batch E — Season confirmations implementation
**Commit:** `feat: implement season_confirmations handler + service (previously referenced by FE hooks)`
- Agent 4 #52 and related nullability/default fixes (#53, #54, #55, #60)

### Batch F — S2 data integrity sweep
**Commit:** `chore: tighten schema → API → TS alignment (nullability + cascade)`
- All S2 nullability NOT NULL additions: divisions D-08, tournaments T-06, registrations R-08, pods P-01, announcements #5
- All S2 cascade documentation + fixes
- All S2 state-machine additions (registrations R-03, league_registrations #45, match_series #37)
- Agent 5 #10, #49, #50, #53 (scoring math + standings corrections)

### Batch G — S2 unreachable columns
**Commit:** `feat: expose division + template + season + tournament-settings columns through API`
- Agent 3 D-03, D-04 (division entry_fee_amount + 11 unreachable cols)
- Agent 4 #24, #25, #29, #30, #31 (season standings_config, roster_confirmation_deadline; template 8 unreachable cols)
- Agent 3 T-08 (registration_open_at/close_at)

### Batch H — Enhanced Postgres error reporting (per earlier user request)
**Commit:** `feat: surface Postgres CHECK/UNIQUE/FK violations as 4xx with constraint context`
- Detect `*pgconn.PgError` in `HandleServiceError`:
  - `23514` (check_violation) → 400 with constraint name
  - `23505` (unique_violation) → 409 with constraint name
  - `23503` (foreign_key_violation) → 400 or 409 based on context
- Add constraint→message mapping for friendly messages on known constraints
- Goal: prevent the BUG-09 debugging cycle from ever happening again

### Batch I — S3 type safety + S4 UX polish
One or more commits, lowest priority. Can be deferred to a follow-up branch if batches A–H take long enough.

---

## Next Steps

1. User reviews this report and selects batches to execute
2. For selected batches, I write an implementation plan (per-batch) per the `writing-plans` skill
3. Execute plan (likely `subagent-driven-development` for independent-file batches, inline for cross-cutting ones)
4. Verify (`go build/vet/test`, `pnpm tsc`, `pnpm build`, manual smoke test of fixed flows)
5. Merge to `main` per v0.1.0+ branching rules
6. Tag a new patch release (v0.1.1) documenting the audit batch(es)

---

## Execution Log

### 2026-04-20 — Batches A, B, C, D, H shipped

All five batches merged to `main` across 26 commits. Full build green. ~23 S1 blockers resolved.

**Batches merged:**
- `cabee8a` Merge Batch A (admin/player/venue/API key fixes — 6 S1s)
- `823a6b1` Merge Batch B (tournament/division/registration — 5 S1s)
- `f065cfc` Merge Batch C (match-series/scoring/match-events — 5 S1s)
- `20a4ba4` Merge Batch D (overlay/upload/announcements — 6 S1s)
- `0b96f89` Merge Batch H (Postgres constraint error reporting — feature)

**Follow-up fixes (discovered during testing):**
- `391676d` A5 follow-up: second `useUpdateVenueStatus` hook in `registry/venues/hooks.ts` still used `apiPut`. Venue status changes from `/venues/{id}` detail page were 405'ing. Fixed to `apiPatch`.
- `6b77997` B4 follow-up: `isAdmin` check in DivisionDetail/DivisionOverview/TournamentDetail tested against `role === 'admin'` which isn't a valid DB value. platform_admins saw no admin tabs. Fixed to `platform_admin`. Added TODO pointing at Batch I (Scoped Authorization) since the global-role check is still not correct for per-entity admins.

### Testing progress

| Batch | Status | Notes |
|---|---|---|
| A | ✅ Confirmed in production | A1, A2, A3, A4, A5, A6 all verified by user. A3 + A5 needed follow-up fixes (cache + second hook). |
| B | 🟡 Partial | B1, B2, B3 confirmed. B5 (bulk no-show) skipped — division page "Register Now" button routes to tournament home (no player-side registration flow exists yet). See Known Product Gaps below. |
| C | ⏸ Paused | User identified product-flow gaps during testing. Suspended to pivot to Logto integration first, then walk full site flow, then resume. |
| D | ⏸ Paused | Same. |
| H | ⏸ Paused | Same. |
| Regression | ⏸ Paused | Same. |

### Known Product Gaps (not audit findings — feature work)

Discovered during audit testing. These are missing/incomplete product behavior, not alignment bugs:

1. **Player-side registration flow absent.** Division detail page shows a "Register Now" button when `tournament.status === 'registration_open'`, but the button links to the tournament home page with no registration action. There's no UI path for a player to register themselves for a division. API path exists (`POST /api/v1/divisions/{id}/registrations`) but no UI surface.
2. **Scoped authorization not wired.** Current `isAdmin` checks are global-role-based. A user who should be tournament_director of ONE tournament (not all tournaments globally) has no way to be granted that. Schema has `tournament_staff`, `org_memberships`, `venue_managers` tables ready for this but no `CanManageTournament`-style authorization service consumes them. Tracked as "Batch I: Scoped Authorization" in the backlog.
3. **PWA cache staleness creates debugging pain.** Multiple fixes required user cache-clearing to verify (A3, A5). Should add `vite-plugin-pwa` update prompt (`registerType: 'prompt'`) with user-facing "new version available, reload" toast.

### Remaining Audit Work (still on the backlog)

- **Batch E** — Implement season_confirmations handler (currently frontend hooks call nonexistent routes). Full new feature implementation.
- **Batch F** — S2 data integrity sweep (~65 findings: NOT NULL additions, FK cascade fixes, state-machine gaps).
- **Batch G** — S3 unreachable columns (~20 findings: DB columns that neither create bodies, update bodies, nor response DTOs touch).
- **Batch I** — Scoped Authorization (new, surfaced during testing — see Known Product Gaps #2).

### Current pivot (2026-04-20)

User has recognized that remaining audit items are entangled with product-flow gaps that need to be resolved at a higher level than single-point fixes. Pivoting to:

1. Logto integration (auth platform replacement, easier NOW since no registered users)
2. Full site-flow walkthrough with user, documenting what's implemented vs. gaps
3. Resume audit + feature work on the post-Logto codebase
