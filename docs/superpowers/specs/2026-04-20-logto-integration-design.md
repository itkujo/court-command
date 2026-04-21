# Logto Integration — Design Spec

**Date:** 2026-04-20
**Status:** Approved, pending plan
**Branch:** `feature/logto-integration` (to be created)
**Related audit:** `docs/superpowers/audits/2026-04-20-db-schema-alignment.md`

---

## Goal

Replace the Court Command in-house auth (Redis-backed cookie sessions + bcrypt password storage in the `users` table) with **Logto** as the identity provider. Introduce a **multi-sport architecture** at the same time, using Logto's organizations as the top-level sport boundary. Ship with pickleball as the only production sport; prove the multi-sport plumbing works via a parallel "Demo Sport" org.

This is foundational work that unblocks scoped per-entity authorization (Batch I), a proper password reset flow, future multi-sport expansion, and several security findings from the schema alignment audit.

## Why now

- **Zero-user window.** No registered users today means no migration of humans, no session-revocation waves, no password-reset storms. Every day this waits, the window narrows.
- **The audit surfaced auth-adjacent structural gaps.** Platform admin is the only globally-enforced role; tournament_staff stores plaintext passwords; the scoped authz concept isn't wired; password reset doesn't exist. Most of these get solved cleanly by adopting Logto correctly.
- **Multi-sport is a product decision we've made.** Pre-committing the architecture now avoids retrofitting pickleball-shaped assumptions into basketball later.

## Non-goals (explicitly out of scope)

The following are valuable but deferred to keep this migration focused:

| Deferred item | Why out of scope |
|---|---|
| Batch I: Scoped per-entity authorization | Separate feature on top of Logto; designed for after this lands |
| Audit batches E, F, G | Unrelated cleanup; independent schedule |
| PWA cache auto-update prompt | Unrelated dev-ex improvement |
| Player-side registration flow | Product gap surfaced during audit testing; needs its own spec |
| OAuth / magic link / MFA | Email+password only on day 1 |
| Second real sport (basketball, etc.) | Architecture only; no real-sport gameplay |

## Architecture

### Identity layer (Logto)
Logto owns: user identity (email + password), authentication, JWT issuance, password reset flow, email verification flow, machine-to-machine app credentials, multi-org membership.

Deployment:
- Self-hosted via `docker-compose.yaml` alongside existing Postgres and Redis containers
- Its own Postgres database on the shared PG instance (Logto requires a dedicated DB)
- Exposed on a separate subdomain: `logto.courtcommand.app` (admin UI + OIDC endpoints)
- RAM footprint: ~200MB for the Logto container

### Sport boundary (Logto organizations)
Two Logto orgs are seeded during initial setup:
- **Pickleball** — the real sport. All pickleball users belong to this org.
- **Demo Sport** — a test org that proves multi-sport plumbing works. No gameplay, no real users.

Every user is auto-joined to every sport org at registration time with a default role of `player`. This happens via a Logto `User.Created` webhook calling your backend, which then calls Logto's Management API to add the org memberships.

### Roles (per sport org)
Each sport org has the same role set:
- `player` (default) — can read, register, view own profile
- `tournament_director` — can manage tournaments
- `referee` — can score matches they're assigned to
- `scorekeeper` — same as referee, different label
- `platform_admin` — full platform access for that sport

Platform admin is **per-sport**, not global. Alice can be platform_admin of Pickleball but only a player in Basketball.

### Scopes (coarse-grained, sport-agnostic)
Logto defines ~12 scopes that land in JWT claims:
```
read:profile, write:profile
read:tournaments, write:tournaments
read:matches, write:matches
read:registrations, write:registrations
read:overlay, write:overlay
read:admin, write:admin
```

Role-to-scope mappings are configured per sport org in Logto admin UI. Sport scoping enforced by combining (a) URL path sport segment, (b) JWT `organization_data[sport].roles`, (c) JWT `scope` claim.

### Domain layer (your database)
Domain entities stay in your Postgres database, Logto has no opinion on them:
- `organizations` (app-level — pickleball clubs, league operators, etc.)
- `leagues`
- `tournaments`
- `venues`
- `divisions`, `pods`, `matches`, `registrations`, everything else

Per-entity memberships also stay in your database:
- `org_memberships` (which users are members of which orgs, at what role)
- `tournament_staff` (which users are ref/scorekeeper for which tournaments)
- `venue_managers`
- `league_memberships` (new, to be added in Batch I)

These tables are not touched in this migration; they become inputs to the Batch I scoped authorization service later.

### Sport scoping in the database
A new `sports` lookup table holds the canonical list (Pickleball, Demo Sport). Every top-level domain table gets a `sport_id BIGINT NOT NULL REFERENCES sports(id)` column:
- `tournaments`
- `leagues`
- `organizations` (a pickleball club vs. a basketball club)
- `venues` (some venues might support multiple sports, but keep it simple — one sport per venue for v1)
- `divisions`, `pods`, `matches` inherit their sport via their parent tournament (no direct column needed, but denormalized for query perf if warranted)

All existing pickleball data backfilled with the Pickleball sport_id in the migration.

### URL layout
**Frontend:**
- `courtcommand.app/` — public landing, sport picker tiles
- `courtcommand.app/pickleball/` — pickleball app root (redirects to dashboard if logged in, else landing)
- `courtcommand.app/pickleball/dashboard` — user dashboard (authenticated)
- `courtcommand.app/pickleball/tournaments` — tournament directory (public)
- `courtcommand.app/pickleball/tournaments/{slug}` — public tournament detail
- `courtcommand.app/pickleball/admin/*` — admin panel (authenticated, requires platform_admin role in pickleball org)
- `courtcommand.app/overlay/*` — unchanged, court-token authenticated (not Logto)
- `courtcommand.app/auth/*` — Logto SDK handles; redirects to `logto.courtcommand.app` for login/logout/reset

TanStack Router file tree reorganizes around a `$sport` param at the top level.

**Backend:**
- `api.courtcommand.app/api/v1/...` — sport-agnostic URLs
- Every authenticated request MUST include `X-Sport: pickleball` header
- Middleware validates: sport exists, user is a member of that sport org, JWT `organization_data[sport].roles` + `scope` grant the required permission for the route
- Public routes (existing `/matches/public/{id}`, `/tournaments/{slug}`, etc.) also accept `X-Sport` as a filter but don't require auth

### Account model
Your `users` table shrinks to a minimal mirror:
```sql
users (
    id BIGSERIAL PRIMARY KEY,
    logto_user_id TEXT NOT NULL UNIQUE,
    email TEXT,              -- cached, synced via Logto webhook on change
    display_name TEXT,       -- cached, same
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
)
```

All existing FKs to `users.id` stay intact. The row is upserted on first JWT seen for a new Logto user.

Player-specific fields move to a new `player_profiles` table joined 1:1 on `user_id`:
```sql
player_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    dupr_id TEXT,
    vair_id TEXT,
    paddle_brand TEXT,
    paddle_model TEXT,
    gender TEXT CHECK (gender IN ('male','female','non_binary','prefer_not_to_say')),
    handedness TEXT CHECK (handedness IN ('right','left','ambidextrous')),
    date_of_birth DATE,
    bio TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state_province TEXT,
    country TEXT,
    postal_code TEXT,
    formatted_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_notes TEXT,
    waiver_accepted_at TIMESTAMPTZ,
    avatar_url TEXT,
    is_profile_hidden BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Password-related columns (`password_hash`) are removed from `users` — Logto owns passwords. Role (`role`) is removed — roles live in Logto org membership claims.

### API keys (migrated to Logto M2M)
Your `api_keys` table shrinks to a mirror:
```sql
api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    logto_m2m_app_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
)
```

`key_hash`, `key_prefix`, `scopes`, `expires_at`, `raw_key` columns are removed. Logto owns all of that.

The admin "Create API Key" UI flow:
1. User clicks Create, enters name + scopes
2. Backend calls Logto Management API to create a new M2M application
3. Logto returns `client_id` + `client_secret`
4. Backend mirrors a row in `api_keys` with `logto_m2m_app_id`
5. Frontend shows the one-time reveal: client_id + client_secret (two values, yellow warning box)
6. Partner later exchanges these for short-lived JWTs via `logto.courtcommand.app/oidc/token` (OAuth2 client credentials flow)
7. Partner calls your API with `Authorization: Bearer <jwt>`
8. Your middleware validates the JWT (same code path as user JWTs), checks scope claims

### Tournament staff accounts
Currently: `TournamentService.Create` creates two real DB users with auto-generated passwords stored in plaintext in `tournament_staff.raw_password` (audit finding S-01 security issue).

With Logto: `TournamentService.Create` calls Logto Management API to create two real Logto users (`ref{tournamentID}@cc.dev`, `score{tournamentID}@cc.dev`) with the auto-generated password. Logto stores the hash, not you. The backend returns the password ONCE to the TD in the Create response; it is never persisted on your side. The `tournament_staff.raw_password` column is dropped in a migration that's part of this work.

The assignment to the correct sport org + role (referee / scorekeeper) happens via Logto Management API as part of the same create flow.

### Impersonation
Platform admin impersonates user X:
1. Backend calls Logto Management API to mint a JWT representing user X, plus an additional `impersonator` claim identifying the admin
2. Response returns the impersonation JWT to the frontend, which stores it (replacing the admin's own JWT for the session)
3. All subsequent API calls use the impersonation JWT — to the backend, the request looks like user X
4. Activity log records both the admin's start-impersonation and stop-impersonation actions, including the target user ID
5. "Stop Impersonating" in the UI requests a fresh JWT for the original admin user via Logto

**Research task in the plan:** confirm Logto has a native impersonation / token-exchange API. If not, implement via Management API user lookup + custom JWT signing.

### Password reset + email verification
Logto-hosted. Both flows live on `logto.courtcommand.app`. Logto sends the emails via configured SMTP (SendGrid, Postmark, SES, or similar — a deploy prerequisite). After reset/verify success, Logto redirects back to `courtcommand.app`.

No frontend code written for these flows in this migration — Logto provides them.

## Components

Listed as the files/packages that change or are new. Implementation details go in the plan document.

### New (backend)
- `api/auth/` — new package wrapping Logto JWT validation, JWKS caching, claims parsing
- `api/middleware/jwt.go` — replaces `middleware/auth.go` session-based middleware. Validates JWT signature + expiry + scopes. Extracts sport from `X-Sport` header, validates against user's org memberships.
- `api/handler/webhooks.go` — handles Logto webhooks (User.Created, User.Updated, User.Deleted)
- `api/logto/` — client wrapper for Logto Management API calls (create M2M app, add org membership, fetch user, impersonation)
- `api/db/migrations/00041_sports_and_logto.sql` (or similar numbering) — creates `sports` table, adds `sport_id` columns, shrinks `users`, creates `player_profiles`, shrinks `api_keys`, drops `tournament_staff.raw_password`, seeds Pickleball + Demo Sport
- `api/db/queries/sports.sql` — sqlc queries for the new sports table

### Changed (backend)
- `api/handler/auth.go` — login/register/logout handlers removed (Logto owns these). `/auth/me` kept but re-implemented to parse JWT claims and upsert the users row if missing.
- `api/session/` — package removed; `SessionData` replaced by a JWT claims extractor in a new location
- `api/handler/admin.go` — API key CRUD delegates to Logto Management API. Impersonation endpoints delegate to Logto.
- `api/service/tournament_staff.go` — staff creation delegates to Logto Management API
- `api/service/player.go` — reads/writes `player_profiles` instead of user columns
- `api/router/router.go` — middleware swap. All `RequireAuth` usages become `RequireJWT`. `X-Sport` header validation added as separate middleware on sport-scoped route groups.
- `api/db/queries/users.sql` — queries simplified (many columns removed)
- `api/db/queries/players.sql` — queries rewritten to read from `player_profiles`

### Removed (backend)
- `api/handler/auth.go` login/register/logout flow
- `api/session/` entire package
- All password-hashing code paths
- API key creation flow in `api/service/api_key.go` (replaced by Logto M2M wrapper)

### New (frontend)
- `web/src/lib/logto.ts` — Logto React SDK setup + config
- `web/src/routes/$sport/` — new top-level sport param route tree
- `web/src/routes/index.tsx` — new public sport picker landing
- `web/src/features/auth/LogtoCallback.tsx` — handles the OIDC redirect back from Logto
- `web/src/features/auth/hooks.ts` — rewritten to use Logto SDK instead of cookie-session endpoints
- `web/src/features/admin/api-keys/` — UX updated to show client_id + client_secret reveal instead of ccapi_xxx

### Changed (frontend)
- `web/src/lib/api.ts` — `apiFetch` helper adds `Authorization: Bearer <logto_jwt>` from the SDK and `X-Sport` from the URL sport param
- `web/src/routes/` — all routes nested under `$sport`
- `web/src/features/auth/*` — login/register pages removed (Logto-hosted); redirect wrappers added
- `web/src/components/NavBar.tsx` — adds a sport indicator; login button redirects to Logto
- `web/src/features/registry/players/PlayerForm.tsx` — reads/writes the new player_profiles shape (field list unchanged since Batch A4 already added all those fields to the TS Player type)

### Removed (frontend)
- `web/src/features/auth/LoginPage.tsx` and `RegisterPage.tsx` (Logto hosts these)
- Password reset / email verify pages (Logto hosts these)

### Infra
- `docker-compose.yaml` — add Logto service
- `docker-compose.local.yaml` — same
- `.env.example` — add LOGTO_* env vars
- `Makefile` — `make seed` updated to also check that Logto has the sport orgs + seed admin users. Document the first-time setup in `docs/LOGTO_SETUP.md`.

### Documentation
- `docs/LOGTO_SETUP.md` — new, covers initial Logto setup, org creation, admin bootstrap, SMTP config
- `docs/superpowers/HANDOFF.md` — updates to reflect the new auth model
- `CHANGELOG.md` — v0.2.0 entry covering the auth migration

## Data flow

### User registration
1. User clicks "Sign up" on `courtcommand.app/` (or Logto-hosted page)
2. Logto presents registration form (email + password)
3. User submits
4. Logto creates user → fires `User.Created` webhook to `api.courtcommand.app/api/v1/webhooks/logto`
5. Backend webhook handler:
   - Validates Logto webhook signature
   - Upserts row in `users` table with new logto_user_id
   - Calls Logto Management API: add user to Pickleball org with role=player
   - Calls Logto Management API: add user to Demo Sport org with role=player
6. Logto issues JWT, redirects user to `courtcommand.app/pickleball/dashboard`
7. Frontend hits `/api/v1/auth/me` with JWT → backend returns user data from DB

### Login
1. User clicks "Sign in" on any page
2. Frontend redirects to Logto via SDK
3. Logto authenticates → issues JWT → redirects back to `courtcommand.app/auth/callback?code=...`
4. Frontend SDK exchanges code for JWT, stores JWT
5. Frontend navigates to `/pickleball/dashboard` (or wherever user was)

### Authenticated API call
1. Frontend calls `apiFetch('/api/v1/tournaments')` with method PATCH
2. `apiFetch` adds headers: `Authorization: Bearer <jwt>`, `X-Sport: pickleball`
3. Backend middleware:
   - Validates JWT signature against Logto JWKS (cached)
   - Reads `X-Sport`, confirms user's `organization_data.pickleball` exists
   - Confirms user's role in pickleball grants `write:tournaments` scope
   - If all pass, passes request to handler with user context
4. Handler processes, returns response

### Tournament staff creation
1. TD creates a tournament via `POST /api/v1/tournaments`
2. `TournamentService.Create` runs inside a DB transaction:
   - Inserts tournament row
   - Generates referee + scorekeeper passwords
   - Calls Logto Management API: create user for referee (email: `ref{tournamentID}@cc.dev`, password set)
   - Calls Logto Management API: add referee user to Pickleball org with role=referee
   - Calls Logto Management API: create + assign scorekeeper identically
   - Upserts rows in local `users` for ref + scorekeeper with their logto_user_ids
   - Inserts rows in `tournament_staff` linking tournament + user + role
3. Response to TD includes one-time password display for both accounts
4. Passwords never persisted on your side after the response

### API key creation
1. Admin hits "Create API Key" in admin UI
2. Frontend calls `POST /api/v1/admin/api-keys` with `{name, scopes}`
3. Backend:
   - Calls Logto Management API: create M2M app with the given name + scopes
   - Receives client_id + client_secret from Logto
   - Inserts mirror row in `api_keys` with logto_m2m_app_id
4. Response includes `{id, name, client_id, client_secret, scopes}` — the one-time reveal payload
5. Frontend shows both in the copy-me modal
6. Partner uses them to get JWTs from Logto and call your API

## Error handling

- **Logto Management API errors** (creating user, assigning org, creating M2M app): retry with exponential backoff once; if that fails, surface as 503 to the caller with a meaningful message. Admin operations (API key creation, staff creation) must be idempotent — if Logto succeeded but your DB mirror insert failed, the next retry should detect the logto_user_id / logto_m2m_app_id already exists and skip the Logto step.
- **Webhook failures**: if the User.Created webhook fails (network, bug), the user is stuck without sport memberships. Fallback: on the first authenticated API request that has a valid JWT but no local users row, upsert + attempt the sport memberships on-demand. Log prominently so we know webhooks are missing.
- **JWT expired / invalid signature**: 401, client should re-auth via Logto
- **Missing X-Sport header on authed route**: 400
- **X-Sport doesn't match any of user's org memberships**: 403
- **Logto unreachable**: 503 on any management-API-backed endpoint. Read-only routes that only validate JWT signature via cached JWKS continue working (no Logto round-trip needed after initial JWKS fetch).

## Testing

### Backend tests
- `api/handler/auth_test.go` — removed (endpoints gone) or rewritten for `/auth/me` with a test JWT
- `api/handler/settings_test.go` — update to issue test JWTs instead of test sessions
- `api/handler/webhooks_test.go` — new, covers User.Created webhook happy path + signature validation + idempotency
- `api/middleware/jwt_test.go` — new, covers JWT validation, X-Sport enforcement, scope checks
- `api/logto/` — new package has its own tests using a fake Logto Management API
- Other existing service/handler tests: update the test harness helper that creates a session to instead issue a test JWT with appropriate org + scope claims

### Frontend tests
- `web/src/features/auth/*` — existing tests mostly removed (pages gone)
- `apiFetch` helper gets a unit test covering Authorization and X-Sport header injection
- Manual smoke tests enumerated below in this spec; the implementation plan will reproduce the checklist in its verification section

### Manual smoke checklist (before merging)
1. Fresh dev environment: `docker-compose up`, set up Logto, seed admin
2. Register a new user → verify User.Created webhook fires, user appears in pickleball + demo_sport orgs as player
3. Log in as that user → verify JWT has correct org memberships + roles
4. Create a tournament as platform_admin → verify two Logto users created for staff, response has one-time passwords, `tournament_staff` rows correct
5. Score a match as the referee staff account → verify JWT is accepted for that role
6. Create an API key → verify Logto M2M app created, one-time reveal works
7. Use API key credentials to fetch a tournament via external API call → verify OAuth2 client credentials exchange + subsequent API call with Bearer JWT
8. Impersonate another user as platform_admin → verify subsequent requests act as that user + activity log records both
9. Password reset: forgot password link → email received → reset works → old session invalidated
10. Email verification: new signup → verify email → subsequent login succeeds
11. Spectator (unauthenticated) views a tournament and overlay URL → works unchanged
12. Overlay browser source using court token → works unchanged
13. Suspend a user as admin → verify their Logto sessions invalidated (they're logged out)
14. Delete a user account → Logto user + local users + player_profiles cascaded
15. Log out → JWT invalidated, redirect to public landing

## Deployment prerequisites

Before the merge can go to production:
- Logto container deployed and reachable at `logto.courtcommand.app`
- SMTP provider configured in Logto admin UI (SendGrid / Postmark / SES account)
- Initial platform_admin users created in Logto admin UI (daniel.f.velez@gmail.com, admin@courtcommand.com, test accounts)
- Pickleball + Demo Sport orgs created with full role + scope matrix
- Webhook endpoint registered in Logto admin UI pointing at `api.courtcommand.app/api/v1/webhooks/logto`
- Webhook signing secret configured in backend env

## Rollback plan

Since we're in the zero-user window and the migration is a single-branch hard cutover:
1. If the merge to `main` causes problems, `git revert` the merge commit
2. Redeploy main
3. Logto container keeps running but is unused
4. DB schema changes persist but old code ignores new columns/tables — no data loss
5. If necessary, manually roll back the migration via `goose down` (or equivalent)

No data preservation logic needed because there are no production users.

## Success criteria

- [ ] All existing Go tests updated to use JWTs and pass
- [ ] New webhook + JWT middleware + Logto client tests pass
- [ ] Frontend typecheck + build clean
- [ ] Manual smoke checklist (15 items above) all pass
- [ ] `docs/LOGTO_SETUP.md` walks a new developer from zero to working dev environment in under an hour
- [ ] `docs/superpowers/HANDOFF.md` reflects the new auth model
- [ ] No plaintext passwords anywhere in the codebase (grep for `password`, `pwd`, `raw_password` and confirm all are either Logto-managed or removed)
- [ ] No cookie-session code remains (grep for `cc_session`, `SessionStore`, `session.Data` returns zero non-test hits)

## Timeline estimate

Rough, with ranges because Logto-specific quirks may surface:

- Week 1: Logto setup + deployment scaffolding + docker-compose + docs
- Week 1-2: Backend JWT middleware + /auth/me + webhook handler + Logto client package
- Week 2: DB migrations + users table shrink + player_profiles + sports table
- Week 2-3: Frontend route restructure (`$sport` param tree) + Logto SDK wiring + login flow
- Week 3: Tournament staff Logto integration + API key Logto M2M migration
- Week 3-4: Impersonation + test updates + manual smoke + docs cleanup

Total: ~3-4 weeks of focused work. Shippable milestone per week if we want intermediate checkpoints.

## Open questions for the implementation plan

These get resolved in the plan doc, not the spec:

1. **Logto version / Docker image tag** — pin to a specific version or use `latest`
2. **Exact Logto Management API endpoints** for create-M2M-app and org-membership ops — confirm against Logto docs at plan time
3. **JWT signing algorithm** — ES256 vs RS256 (Logto defaults, use theirs)
4. **JWKS caching TTL** — typical 1 hour, confirm
5. **How to get `organizations` claim into the JWT** — Logto might require requesting a specific scope during authorization
6. **Sport-in-URL structure for TanStack Router** — exact file layout

These are research tasks for the implementation plan, not blockers for spec approval.

---

## Appendix: relationship to Batch I (Scoped Authorization)

This spec does NOT implement scoped per-entity authorization. It establishes the scaffolding:
- JWT carries the platform-level scope set + sport org memberships
- Middleware enforces sport-level permissions
- Per-tournament, per-league, per-venue, per-org memberships remain in your DB tables, untouched

Batch I (a future, separate spec) will add:
- A new `authz` service package with `CanManageTournament(ctx, userID, tournamentID)` style helpers
- Helpers consult `tournament_staff`, `org_memberships`, `venue_managers`, and a new `league_memberships` table
- Frontend `useCan(action, entityId)` hook replacing today's `isAdmin = role === 'platform_admin'` checks
- Admin UI for managing per-entity assignments

That work is designed to build directly on top of this Logto migration.
