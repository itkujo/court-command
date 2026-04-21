# Logto Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Court Command in-house cookie-session + bcrypt auth with Logto (self-hosted), and introduce multi-sport architecture where Logto organizations represent sports. Ship with pickleball as the only production sport; "Demo Sport" validates the multi-sport plumbing.

**Architecture:** Logto self-hosted via docker-compose owns identity (login, password, reset, verify, JWT issuance, M2M apps, organizations). Backend validates JWTs stateless using `github.com/lestrrat-go/jwx/v3/jwt` with JWKS caching. Per-sport context flows via URL path on the frontend and an `X-Sport` header on API requests. Domain entities (tournaments, leagues, venues, organizations) stay in Postgres; per-entity memberships stay in the existing tables and are the foundation for a future Batch I scoped-authz service. Users table shrinks to a Logto-mirror shape; player-specific columns move to a new `player_profiles` 1:1 table. API keys migrate to Logto M2M applications. Tournament staff accounts are created via Logto Management API; `raw_password` column is dropped.

**Tech Stack:**
- Backend: Go 1.23+, Chi v5, PostgreSQL 17, Redis (auth sessions removed; pub/sub kept), sqlc, goose, `github.com/lestrrat-go/jwx/v3/jwt`
- Frontend: React 19, Vite, TanStack Router (file-based), TanStack Query v5, `@logto/react` SDK
- Logto: `svhd/logto:latest` Docker image, own Postgres DB on shared PG instance, admin UI on subdomain
- Webhooks: Logto signs with HMAC-SHA256, header `logto-signature-sha-256`, hex digest over raw body
- JWT lib: `github.com/lestrrat-go/jwx/v3/jwt` + `jwk`

**Branch:** `feature/logto-integration` — never merge partial progress to main.

**Spec:** `docs/superpowers/specs/2026-04-20-logto-integration-design.md`

---

## Phase overview

| Phase | Theme | Rough duration |
|---|---|---|
| 0 | Setup: branch, docker-compose, Logto running locally | 2 days |
| 1 | Backend foundation: JWT middleware, Logto client, auth/me | 3-4 days |
| 2 | DB migrations: sports, users shrink, player_profiles, api_keys shrink | 2-3 days |
| 3 | Frontend auth + route restructure | 4-5 days |
| 4 | Tournament staff + API keys via Logto Management API | 2-3 days |
| 5 | Impersonation + webhook handler + tests updated | 2-3 days |
| 6 | Cutover: remove old auth code, smoke tests, merge | 2 days |

Total: ~3-4 weeks focused work.

## Correction to spec (learned during plan research)

**Spec said:** JWT carries an `organizations` claim listing all sport org memberships with roles, and middleware picks one based on URL sport.

**Reality:** Logto issues **org-scoped tokens** — one JWT per organization. Audience is `urn:logto:organization:{orgId}`, `organization_id` claim is set. To act as pickleball admin, the frontend requests a JWT scoped to the pickleball org; to act as basketball player, it requests a different JWT scoped to the basketball org. The `@logto/react` SDK's `getOrganizationToken(orgId)` method handles this transparently.

**Impact on architecture:** No impact — architecture stays identical. What changes is the exact SDK call in the frontend and how middleware reads claims. Instead of one JWT with multiple org roles, the frontend tracks "current sport" in the URL and requests a fresh token for the matching org before each API call. The `X-Sport` header becomes redundant (sport is in the JWT's `organization_id` claim) — but we'll keep it as a sanity check (reject mismatches between URL and JWT).

**Updated data flow:**
1. User at `/pickleball/dashboard` — SDK holds a JWT with `organization_id=<pickleball_id>`
2. User navigates to `/basketball/...` — SDK calls `getOrganizationToken(<basketball_id>)`, swaps the in-memory JWT
3. Every API call includes `Authorization: Bearer <current_org_jwt>` and `X-Sport: basketball` header
4. Backend middleware: (a) validates JWT signature + issuer + audience is `urn:logto:organization:{basketball_id}`, (b) confirms `X-Sport` header matches by looking up the org slug from a tiny in-memory map (pickleball → id_123, basketball → id_456), (c) extracts `organization_roles` claim for authorization

---

## File structure

### Backend: created files

```
api/
├── logto/                         # Logto client wrapper
│   ├── client.go                  # HTTP client with M2M token caching
│   ├── users.go                   # Create user, get user, delete user
│   ├── organizations.go           # Add user to org, assign org role
│   ├── m2m.go                     # Create M2M app, delete M2M app
│   ├── impersonation.go           # Mint impersonation tokens
│   └── client_test.go             # Unit tests with fake Logto server
├── auth/
│   ├── jwt.go                     # JWT validation (jwx/v3), JWKS caching
│   ├── context.go                 # AuthContext struct, context helpers
│   └── jwt_test.go                # JWT middleware tests
├── middleware/
│   ├── jwt_middleware.go          # Chi middleware wrapping auth.ValidateJWT
│   └── sport_middleware.go        # X-Sport header validation
├── handler/
│   ├── webhooks.go                # Logto webhook handler (User.Created, etc.)
│   ├── webhooks_test.go
│   └── auth_me.go                 # GET /auth/me replacement (upsert users row)
└── db/migrations/
    └── 00041_logto_schema_migration.sql    # All schema changes in one migration
```

### Backend: modified files

```
api/
├── handler/
│   ├── auth.go                    # SHRINK: remove login/register/logout/refresh
│   ├── admin.go                   # API keys delegate to logto/m2m; impersonation delegate
│   └── response.go                # Add helper to pull user ID from auth context
├── service/
│   ├── tournament_staff.go        # Staff creation delegates to Logto
│   ├── api_key.go                 # CRUD delegates to Logto M2M (or removed if thin enough)
│   └── player.go                  # Reads/writes player_profiles
├── router/
│   └── router.go                  # Swap session middleware for JWT + sport middleware
├── db/queries/
│   ├── users.sql                  # Simplified queries (fewer columns)
│   ├── players.sql                # Rewritten to join player_profiles
│   ├── sports.sql                 # NEW sqlc query file
│   └── api_keys.sql               # Simplified (mirror shape)
```

### Backend: removed files

```
api/session/                       # Entire package deleted
api/handler/auth.go                # Login/register/logout/refresh helpers removed
```

### Frontend: created files

```
web/src/
├── lib/
│   ├── logto.ts                   # Logto SDK config + provider
│   └── sport.ts                   # Current sport resolver (from URL)
├── routes/
│   ├── index.tsx                  # Public sport picker landing (REWRITE)
│   ├── $sport/                    # NEW route tree with sport param
│   │   ├── _layout.tsx            # Layout that validates sport + injects context
│   │   ├── dashboard.tsx
│   │   ├── tournaments/           # (existing tournaments routes moved here)
│   │   ├── admin/
│   │   └── ...etc
│   └── auth/
│       └── callback.tsx           # OIDC callback handler
└── features/
    └── auth/
        └── LogtoProvider.tsx      # Wraps app in LogtoProvider from SDK
```

### Frontend: modified files

```
web/src/
├── lib/api.ts                     # apiFetch uses SDK getAccessToken + X-Sport header
├── main.tsx                       # Wrap app in LogtoProvider
├── features/auth/hooks.ts         # useAuth rewritten around useLogto()
├── features/admin/hooks.ts        # API key UX updated (client_id + client_secret)
└── all route files                # Most routes move under /$sport/
```

### Frontend: removed files

```
web/src/
├── routes/login.tsx               # Logto-hosted, redirect only
├── routes/register.tsx            # Logto-hosted, redirect only
├── features/auth/LoginPage.tsx
└── features/auth/RegisterPage.tsx
```

### Infra / docs

```
docker-compose.yaml                # Add Logto service
docker-compose.local.yaml          # Add Logto service
.env.example                       # New LOGTO_* vars documented
docs/LOGTO_SETUP.md                # NEW: operator setup guide
docs/superpowers/HANDOFF.md        # Update auth section
CHANGELOG.md                       # v0.2.0 entry
Makefile                           # `make seed` docs updated
```

---

## Phase 0 — Setup and Logto running locally

Goal: Get Logto running next to Postgres + Redis, verify admin UI is reachable, pin versions.

### Task 0.1: Create feature branch

**Files:** none (git operation)

- [ ] **Step 1: Create branch**

```bash
git checkout main
git pull origin main
git checkout -b feature/logto-integration
git push -u origin feature/logto-integration
```

Expected: new branch `feature/logto-integration` created, tracking remote.

### Task 0.2: Pin Logto version and add to docker-compose

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `docker-compose.local.yaml`
- Modify: `.env.example`

- [ ] **Step 1: Read current docker-compose.yaml to understand structure**

```bash
cat docker-compose.yaml
```

Note the existing `postgres` and `redis` services, their network, and volumes.

- [ ] **Step 2: Add Logto service to docker-compose.yaml**

Add under `services:`:

```yaml
  logto:
    image: svhd/logto:1.22.0
    container_name: cc_logto
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      TRUST_PROXY_HEADER: "1"
      DB_URL: "postgres://postgres:postgres@postgres:5432/logto"
      ENDPOINT: "${LOGTO_ENDPOINT:-http://localhost:3001}"
      ADMIN_ENDPOINT: "${LOGTO_ADMIN_ENDPOINT:-http://localhost:3002}"
      DATABASE_STATEMENT_TIMEOUT: "5000"
    ports:
      - "3001:3001"
      - "3002:3002"
    restart: unless-stopped
    networks:
      - cc_network
```

Adjust `cc_network` to the existing network name in the file.

- [ ] **Step 3: Add Logto service to docker-compose.local.yaml**

Same block but with the dev-specific endpoints:

```yaml
  logto:
    image: svhd/logto:1.22.0
    container_name: cc_logto_local
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      TRUST_PROXY_HEADER: "1"
      DB_URL: "postgres://postgres:postgres@postgres:5432/logto"
      ENDPOINT: "http://localhost:3001"
      ADMIN_ENDPOINT: "http://localhost:3002"
      DATABASE_STATEMENT_TIMEOUT: "5000"
    ports:
      - "3001:3001"
      - "3002:3002"
    restart: unless-stopped
```

- [ ] **Step 4: Create the `logto` database in Postgres**

Add a Postgres init script so the Logto database exists on first container boot. Create `scripts/postgres-init/10-create-logto-db.sql`:

```sql
CREATE DATABASE logto;
```

If an init-scripts volume already exists in docker-compose, add to it. Otherwise add to the postgres service:

```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/postgres-init:/docker-entrypoint-initdb.d
```

- [ ] **Step 5: Add Logto env vars to .env.example**

Append to `.env.example`:

```bash
# Logto (self-hosted)
LOGTO_ENDPOINT=http://localhost:3001
LOGTO_ADMIN_ENDPOINT=http://localhost:3002
LOGTO_MANAGEMENT_API_APP_ID=      # fill after creating M2M app in Logto admin UI
LOGTO_MANAGEMENT_API_APP_SECRET=  # fill after creating M2M app in Logto admin UI
LOGTO_MANAGEMENT_API_RESOURCE=http://localhost:3001/api
LOGTO_WEBHOOK_SIGNING_KEY=        # fill after registering webhook in Logto admin UI
LOGTO_PICKLEBALL_ORG_ID=          # fill after creating Pickleball org
LOGTO_DEMO_SPORT_ORG_ID=          # fill after creating Demo Sport org
LOGTO_API_RESOURCE=http://localhost:8080/api   # your own API's resource indicator
```

- [ ] **Step 6: Bring up the stack**

```bash
docker compose -f docker-compose.local.yaml down
docker compose -f docker-compose.local.yaml up -d postgres redis logto
```

Expected: Logto starts. Check logs:

```bash
docker compose logs logto --tail 40
```

Should see `Core app is running at http://localhost:3001` and `Admin app is running at http://localhost:3002`.

- [ ] **Step 7: Verify Logto admin UI is reachable**

Open `http://localhost:3002` in a browser. You should see Logto's initial setup wizard asking you to create the first admin account. Do NOT proceed with the wizard yet — Task 0.3 handles that.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yaml docker-compose.local.yaml .env.example scripts/postgres-init/
git commit -m "infra(logto): add Logto service to docker-compose, pin to 1.22.0

Adds Logto self-hosted container alongside Postgres and Redis. Uses
svhd/logto Docker Hub image to avoid GHCR rate limits. Logto gets
its own 'logto' database on the shared PG instance via init script.

Ports: 3001 core, 3002 admin UI. Endpoints configurable via env
vars so prod can point at logto.courtcommand.app.

Next task: walk through first-time Logto setup (create admin user,
create Pickleball and Demo Sport orgs, create M2M app for
Management API access)."
```

### Task 0.3: First-time Logto setup walkthrough

**Files:**
- Create: `docs/LOGTO_SETUP.md`

- [ ] **Step 1: Complete Logto admin account creation in the UI**

In `http://localhost:3002`:
1. Create first admin account (email/password for YOU as the operator — NOT a Court Command user)
2. Complete the onboarding wizard: pick any options, dismiss suggestions

- [ ] **Step 2: Create the "Court Command Web" application in Logto**

In Logto admin → Applications → Create:
- Type: **SPA (Single Page App)** — React
- Name: `Court Command Web`
- Redirect URIs: `http://localhost:5173/auth/callback` (Vite dev) and `http://localhost:4173/auth/callback` (Vite preview)
- Post-logout redirect URIs: `http://localhost:5173`, `http://localhost:4173`

Copy the **App ID** — you'll need it for the frontend `.env`.

- [ ] **Step 3: Create the Court Command API resource in Logto**

In Logto admin → API resources → Create:
- Identifier: `http://localhost:8080/api`
- Name: `Court Command API`

Then under that resource, add **permissions (scopes):**

```
read:profile
write:profile
read:tournaments
write:tournaments
read:matches
write:matches
read:registrations
write:registrations
read:overlay
write:overlay
read:admin
write:admin
```

- [ ] **Step 4: Create the M2M application for Management API access**

In Logto admin → Applications → Create:
- Type: **Machine-to-machine**
- Name: `Court Command Backend`
- Assign role: **Logto Management API access**

Copy the App ID and App Secret. Fill into `.env`:

```
LOGTO_MANAGEMENT_API_APP_ID=<app_id>
LOGTO_MANAGEMENT_API_APP_SECRET=<app_secret>
LOGTO_MANAGEMENT_API_RESOURCE=http://localhost:3001/api
```

- [ ] **Step 5: Create organization template and roles**

Logto has "Organization roles" that are reusable across all orgs. In Logto admin → Organizations → Organization template:

Add organization roles with the following names (exact strings — the backend will look these up by name):

- `player` — description: "Default role for users in this sport"
- `tournament_director` — description: "Can manage tournaments in this sport"
- `referee` — description: "Can score matches in this sport"
- `scorekeeper` — description: "Same as referee, different label"
- `platform_admin` — description: "Full platform access within this sport"

For each role, assign the appropriate organization scopes. (Note: organization scopes are different from API scopes — they travel in the `organization_roles` claim.)

Define organization scopes:

- `manage_tournaments`
- `manage_matches`
- `manage_registrations`
- `manage_users`
- `read_all`

Mapping table:

| Role | Org scopes |
|---|---|
| `player` | `read_all` |
| `tournament_director` | `read_all`, `manage_tournaments`, `manage_registrations` |
| `referee` | `read_all`, `manage_matches` |
| `scorekeeper` | `read_all`, `manage_matches` |
| `platform_admin` | all |

- [ ] **Step 6: Create Pickleball and Demo Sport organizations**

In Logto admin → Organizations → Create:

Organization 1:
- Name: `Pickleball`
- Description: `Pickleball sport on Court Command`

Organization 2:
- Name: `Demo Sport`
- Description: `Test organization to validate multi-sport plumbing`

Copy both org IDs (Logto shows them as `org_xxxxx` strings). Fill into `.env`:

```
LOGTO_PICKLEBALL_ORG_ID=org_xxxxx
LOGTO_DEMO_SPORT_ORG_ID=org_yyyyy
```

- [ ] **Step 7: Create your test platform_admin user via Logto admin UI**

In Logto admin → Users → Create:
- Email: `daniel.f.velez@gmail.com`
- Password: set one
- Name: `Daniel Velez`

Then under the user's detail page → Organizations:
- Add to `Pickleball` with role `platform_admin`
- Add to `Demo Sport` with role `platform_admin`

Copy the user's Logto ID (`user_xxx`). You'll use it to verify later.

- [ ] **Step 8: Register the webhook endpoint**

In Logto admin → Webhooks → Create:
- Name: `Court Command Backend`
- URL: `http://host.docker.internal:8080/api/v1/webhooks/logto` (so the Logto container can reach your local backend)
- Events: check `User.Created`, `User.Data.Updated`, `User.Deleted`

Copy the **signing key** — fill into `.env`:

```
LOGTO_WEBHOOK_SIGNING_KEY=<signing_key>
```

- [ ] **Step 9: Write docs/LOGTO_SETUP.md capturing steps 2-8**

Create `docs/LOGTO_SETUP.md` with the full walkthrough (take your notes from steps 2-8, format as a runnable guide). Include a "How to re-seed" section for developers who wipe their Docker volumes.

- [ ] **Step 10: Commit**

```bash
git add docs/LOGTO_SETUP.md .env.example
git commit -m "docs(logto): first-time setup guide for Logto admin

Covers creating the SPA app, API resource with 12 scopes, M2M app
for Management API access, organization roles (player/TD/referee/
scorekeeper/platform_admin) with their org scopes, and the
Pickleball + Demo Sport organizations. Includes webhook registration.

Developers running 'docker compose up' first time should follow this
doc. Re-seed section covers what to do if Docker volumes are wiped."
```

### Task 0.4: Verify Management API works with curl

**Files:** none (verification)

- [ ] **Step 1: Fetch a Management API token**

```bash
source .env
curl -X POST "${LOGTO_ENDPOINT}/oidc/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n "${LOGTO_MANAGEMENT_API_APP_ID}:${LOGTO_MANAGEMENT_API_APP_SECRET}" | base64)" \
  -d "grant_type=client_credentials&resource=${LOGTO_MANAGEMENT_API_RESOURCE}&scope=all"
```

Expected: JSON with `access_token` field.

- [ ] **Step 2: Use token to list users**

```bash
TOKEN=<paste access_token>
curl "${LOGTO_ENDPOINT}/api/users" -H "Authorization: Bearer ${TOKEN}"
```

Expected: JSON array containing your test user.

- [ ] **Step 3: List organizations**

```bash
curl "${LOGTO_ENDPOINT}/api/organizations" -H "Authorization: Bearer ${TOKEN}"
```

Expected: JSON with Pickleball and Demo Sport.

If all three calls succeed, the Logto setup is validated. Proceed to Phase 1.

---

## Phase 1 — Backend JWT foundation

Goal: Backend can validate a Logto-issued JWT, extract organization context, and serve a minimal `/auth/me` endpoint. No Logto Management API calls yet.

### Task 1.1: Add JWT validation dependencies

**Files:**
- Modify: `api/go.mod`
- Modify: `api/go.sum`

- [ ] **Step 1: Add jwx v3 dependency**

```bash
cd api
go get github.com/lestrrat-go/jwx/v3
go mod tidy
```

- [ ] **Step 2: Verify build**

```bash
go build ./...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/go.mod api/go.sum
git commit -m "feat(auth): add github.com/lestrrat-go/jwx/v3 for JWT validation

Logto-recommended library for JWT validation in Go with Chi. Provides
JWKS fetching/caching and full JWT parsing including custom claims
(organization_id, organization_roles, scope).

Will replace the existing session-based authentication in Phase 6."
```

### Task 1.2: Create api/auth package with JWT validator

**Files:**
- Create: `api/auth/jwt.go`
- Create: `api/auth/context.go`
- Create: `api/auth/jwt_test.go`

- [ ] **Step 1: Write the failing test for JWT claims extraction**

Create `api/auth/jwt_test.go`:

```go
package auth

import (
	"testing"

	"github.com/lestrrat-go/jwx/v3/jwt"
	"github.com/stretchr/testify/require"
)

func TestExtractClaims(t *testing.T) {
	// Build a token with Logto-shaped claims
	token := jwt.New()
	require.NoError(t, token.Set(jwt.SubjectKey, "user_abc123"))
	require.NoError(t, token.Set(jwt.AudienceKey, []string{"urn:logto:organization:org_pickleball"}))
	require.NoError(t, token.Set("organization_id", "org_pickleball"))
	require.NoError(t, token.Set("organization_roles", []string{"platform_admin", "player"}))
	require.NoError(t, token.Set("scope", "read:tournaments write:tournaments read:admin write:admin"))

	claims := ExtractClaims(token)

	require.Equal(t, "user_abc123", claims.Subject)
	require.Equal(t, "org_pickleball", claims.OrganizationID)
	require.ElementsMatch(t, []string{"platform_admin", "player"}, claims.OrganizationRoles)
	require.ElementsMatch(t, []string{"read:tournaments", "write:tournaments", "read:admin", "write:admin"}, claims.Scopes)
}

func TestExtractClaims_NoOrg(t *testing.T) {
	// A token without organization claims (e.g., a platform-level token)
	token := jwt.New()
	require.NoError(t, token.Set(jwt.SubjectKey, "user_abc123"))
	require.NoError(t, token.Set("scope", "read:profile"))

	claims := ExtractClaims(token)

	require.Equal(t, "user_abc123", claims.Subject)
	require.Equal(t, "", claims.OrganizationID)
	require.Empty(t, claims.OrganizationRoles)
	require.Equal(t, []string{"read:profile"}, claims.Scopes)
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api
go test ./auth/...
```

Expected: compile errors (`ExtractClaims` not defined). Good.

- [ ] **Step 3: Implement context.go with Claims struct and extractor**

Create `api/auth/context.go`:

```go
package auth

import (
	"context"
	"strings"

	"github.com/lestrrat-go/jwx/v3/jwt"
)

// Claims is the normalized subset of JWT claims that Court Command cares about.
type Claims struct {
	Subject           string   // Logto user ID (sub claim)
	OrganizationID    string   // organization_id claim, empty if not org-scoped
	OrganizationRoles []string // organization_roles claim
	Scopes            []string // parsed scope claim
	Audience          []string // aud claim
}

type contextKey string

const claimsContextKey contextKey = "cc_auth_claims"

// WithClaims stores parsed claims in the request context.
func WithClaims(ctx context.Context, c Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, c)
}

// ClaimsFromContext retrieves claims from a request context. Returns ok=false
// if the context was not processed by the JWT middleware.
func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	c, ok := ctx.Value(claimsContextKey).(Claims)
	return c, ok
}

// ExtractClaims pulls Court Command's normalized Claims out of a parsed JWT.
func ExtractClaims(token jwt.Token) Claims {
	c := Claims{}

	if sub, ok := token.Subject(); ok {
		c.Subject = sub
	}
	if aud, ok := token.Audience(); ok {
		c.Audience = aud
	}

	if val, ok := token.Get("organization_id"); ok {
		if s, ok := val.(string); ok {
			c.OrganizationID = s
		}
	}

	if val, ok := token.Get("organization_roles"); ok {
		switch v := val.(type) {
		case []string:
			c.OrganizationRoles = v
		case []interface{}:
			for _, item := range v {
				if s, ok := item.(string); ok {
					c.OrganizationRoles = append(c.OrganizationRoles, s)
				}
			}
		}
	}

	if val, ok := token.Get("scope"); ok {
		if s, ok := val.(string); ok && s != "" {
			c.Scopes = strings.Split(s, " ")
		}
	}

	return c
}

// HasScope returns true if the claims include the given scope.
func (c Claims) HasScope(scope string) bool {
	for _, s := range c.Scopes {
		if s == scope {
			return true
		}
	}
	return false
}

// HasOrgRole returns true if the claims include the given org role.
func (c Claims) HasOrgRole(role string) bool {
	for _, r := range c.OrganizationRoles {
		if r == role {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: Implement jwt.go with validator**

Create `api/auth/jwt.go`:

```go
package auth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

// Validator validates Logto-issued JWTs using JWKS fetched from the Logto server.
type Validator struct {
	issuer    string
	jwksURI   string
	audience  string
	keyCache  jwk.Set
	keyFetchM sync.Mutex
	keyTTL    time.Duration
	lastFetch time.Time
}

// NewValidator creates a JWT validator. `issuer` is typically
// "{LOGTO_ENDPOINT}/oidc". `audience` is your API resource indicator
// (e.g. "http://localhost:8080/api"). Org-scoped tokens have a different
// audience prefix (urn:logto:organization:...) which the validator also
// accepts when a caller opts in.
func NewValidator(issuer, jwksURI, audience string) *Validator {
	return &Validator{
		issuer:   issuer,
		jwksURI:  jwksURI,
		audience: audience,
		keyTTL:   1 * time.Hour,
	}
}

// fetchKeys refreshes the JWKS cache if the TTL has expired.
func (v *Validator) fetchKeys(ctx context.Context) (jwk.Set, error) {
	v.keyFetchM.Lock()
	defer v.keyFetchM.Unlock()

	if v.keyCache != nil && time.Since(v.lastFetch) < v.keyTTL {
		return v.keyCache, nil
	}

	set, err := jwk.Fetch(ctx, v.jwksURI)
	if err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	v.keyCache = set
	v.lastFetch = time.Now()
	return set, nil
}

// Validate parses and validates a JWT, returning the parsed token.
// `orgScoped` controls whether the audience check accepts organization URNs
// in addition to the global API resource audience.
func (v *Validator) Validate(ctx context.Context, tokenString string, orgScoped bool) (jwt.Token, error) {
	keys, err := v.fetchKeys(ctx)
	if err != nil {
		return nil, err
	}

	token, err := jwt.Parse(
		[]byte(tokenString),
		jwt.WithKeySet(keys),
		jwt.WithIssuer(v.issuer),
	)
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	// Audience check: global API token has aud=v.audience; org-scoped tokens
	// have aud="urn:logto:organization:<orgID>"
	aud, ok := token.Audience()
	if !ok || len(aud) == 0 {
		return nil, errors.New("token missing audience")
	}

	audOK := false
	for _, a := range aud {
		if a == v.audience {
			audOK = true
			break
		}
		if orgScoped && len(a) > len("urn:logto:organization:") && a[:len("urn:logto:organization:")] == "urn:logto:organization:" {
			audOK = true
			break
		}
	}
	if !audOK {
		return nil, fmt.Errorf("invalid audience: %v", aud)
	}

	return token, nil
}
```

- [ ] **Step 5: Run extraction tests**

```bash
go test ./auth/... -run TestExtractClaims -v
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/auth/
git commit -m "feat(auth): JWT validator package with Logto claims extraction

- auth.Validator: JWKS-cached JWT parser with issuer + audience validation
- auth.Claims: normalized claim shape (subject, organization_id,
  organization_roles, scopes, audience)
- auth.ExtractClaims: pulls Logto-shaped claims from a parsed jwx token
- Support for org-scoped token audience (urn:logto:organization:X)
- Context helpers: WithClaims/ClaimsFromContext
- Unit tests for claim extraction

Full JWT signature validation will be exercised by middleware tests
in Task 1.4 using a fake Logto issuer."
```

### Task 1.3: Create Logto client package (read-only operations first)

**Files:**
- Create: `api/logto/client.go`
- Create: `api/logto/users.go`
- Create: `api/logto/client_test.go`

- [ ] **Step 1: Write the failing test for M2M token caching**

Create `api/logto/client_test.go`:

```go
package logto

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestClient_GetManagementToken_CachesBetweenCalls(t *testing.T) {
	var tokenRequests atomic.Int64

	fakeLogto := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oidc/token" && r.Method == http.MethodPost {
			tokenRequests.Add(1)
			require.NoError(t, r.ParseForm())
			require.Equal(t, "client_credentials", r.Form.Get("grant_type"))
			require.True(t, strings.HasPrefix(r.Header.Get("Authorization"), "Basic "))

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "fake_token_v1",
				"expires_in":   3600,
				"token_type":   "Bearer",
			})
			return
		}
		t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
	}))
	defer fakeLogto.Close()

	c := NewClient(Config{
		Endpoint:                   fakeLogto.URL,
		ManagementAPIAppID:         "app",
		ManagementAPIAppSecret:     "secret",
		ManagementAPIResource:      fakeLogto.URL + "/api",
	})

	ctx := context.Background()
	for i := 0; i < 3; i++ {
		token, err := c.GetManagementToken(ctx)
		require.NoError(t, err)
		require.Equal(t, "fake_token_v1", token)
	}

	require.Equal(t, int64(1), tokenRequests.Load(), "token should be cached")
}

func TestClient_GetManagementToken_RefreshesAfterExpiry(t *testing.T) {
	var tokenRequests atomic.Int64

	fakeLogto := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oidc/token" && r.Method == http.MethodPost {
			tokenRequests.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "fake_token_v" + string(rune('0'+tokenRequests.Load())),
				"expires_in":   1, // 1 second
				"token_type":   "Bearer",
			})
			return
		}
		t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
	}))
	defer fakeLogto.Close()

	c := NewClient(Config{
		Endpoint:               fakeLogto.URL,
		ManagementAPIAppID:     "app",
		ManagementAPIAppSecret: "secret",
		ManagementAPIResource:  fakeLogto.URL + "/api",
	})

	ctx := context.Background()
	_, err := c.GetManagementToken(ctx)
	require.NoError(t, err)

	// Wait for the token to expire (allow for 10s safety margin in the client)
	time.Sleep(50 * time.Millisecond)

	_, err = c.GetManagementToken(ctx)
	require.NoError(t, err)

	// Because expires_in was 1 second and the client applies a safety margin,
	// the second call should have hit the fake server again.
	require.GreaterOrEqual(t, tokenRequests.Load(), int64(2))
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
go test ./logto/... -v
```

Expected: compile errors (package not defined).

- [ ] **Step 3: Implement client.go**

Create `api/logto/client.go`:

```go
package logto

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Config holds Logto connection settings.
type Config struct {
	Endpoint               string // e.g. http://localhost:3001
	ManagementAPIAppID     string
	ManagementAPIAppSecret string
	ManagementAPIResource  string // typically Endpoint + "/api"
	HTTPClient             *http.Client
}

// Client is the Logto Management API wrapper.
type Client struct {
	cfg        Config
	http       *http.Client
	tokenMu    sync.Mutex
	cachedTok  string
	tokenExp   time.Time
}

// NewClient returns a Logto client. Uses http.DefaultClient unless overridden
// in Config.HTTPClient.
func NewClient(cfg Config) *Client {
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{cfg: cfg, http: hc}
}

// safetyMargin subtracted from the token's expires_in to avoid using a token
// that expires during the request.
const safetyMargin = 10 * time.Second

// GetManagementToken returns a cached or freshly-minted M2M access token for the
// Logto Management API. Uses OAuth2 client_credentials grant.
func (c *Client) GetManagementToken(ctx context.Context) (string, error) {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	if c.cachedTok != "" && time.Now().Before(c.tokenExp) {
		return c.cachedTok, nil
	}

	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("resource", c.cfg.ManagementAPIResource)
	form.Set("scope", "all")

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(c.cfg.Endpoint, "/")+"/oidc/token",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return "", fmt.Errorf("build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	basic := base64.StdEncoding.EncodeToString([]byte(c.cfg.ManagementAPIAppID + ":" + c.cfg.ManagementAPIAppSecret))
	req.Header.Set("Authorization", "Basic "+basic)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request failed: status=%d body=%s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parse token response: %w", err)
	}

	c.cachedTok = tokenResp.AccessToken
	c.tokenExp = time.Now().Add(time.Duration(tokenResp.ExpiresIn)*time.Second - safetyMargin)
	return c.cachedTok, nil
}

// doJSON performs an authenticated Management API request and decodes the JSON response.
func (c *Client) doJSON(ctx context.Context, method, path string, body, out interface{}) error {
	token, err := c.GetManagementToken(ctx)
	if err != nil {
		return err
	}

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal body: %w", err)
		}
		reqBody = strings.NewReader(string(b))
	}

	req, err := http.NewRequestWithContext(
		ctx,
		method,
		strings.TrimRight(c.cfg.Endpoint, "/")+path,
		reqBody,
	)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return &APIError{Status: resp.StatusCode, Body: string(b)}
	}

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil && err != io.EOF {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

// APIError is returned when the Management API responds with a non-2xx status.
type APIError struct {
	Status int
	Body   string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("logto api error: status=%d body=%s", e.Status, e.Body)
}
```

- [ ] **Step 4: Run tests**

```bash
go test ./logto/... -v
```

Expected: both tests PASS.

- [ ] **Step 5: Implement users.go with GetUser + DeleteUser**

Create `api/logto/users.go`:

```go
package logto

import (
	"context"
	"fmt"
	"net/http"
)

// LogtoUser is a subset of the Logto user record that Court Command cares about.
type LogtoUser struct {
	ID           string                 `json:"id"`
	Username     string                 `json:"username,omitempty"`
	PrimaryEmail string                 `json:"primaryEmail,omitempty"`
	Name         string                 `json:"name,omitempty"`
	Avatar       string                 `json:"avatar,omitempty"`
	CustomData   map[string]interface{} `json:"customData,omitempty"`
	IsSuspended  bool                   `json:"isSuspended,omitempty"`
	CreatedAt    int64                  `json:"createdAt,omitempty"`
	UpdatedAt    int64                  `json:"updatedAt,omitempty"`
}

// GetUser fetches a user by Logto user ID.
func (c *Client) GetUser(ctx context.Context, userID string) (*LogtoUser, error) {
	var u LogtoUser
	if err := c.doJSON(ctx, http.MethodGet, "/api/users/"+userID, nil, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// DeleteUser permanently deletes a user from Logto.
func (c *Client) DeleteUser(ctx context.Context, userID string) error {
	return c.doJSON(ctx, http.MethodDelete, "/api/users/"+userID, nil, nil)
}

// CreateUserParams is the body for creating a user.
type CreateUserParams struct {
	Username     string                 `json:"username,omitempty"`
	PrimaryEmail string                 `json:"primaryEmail,omitempty"`
	Password     string                 `json:"password,omitempty"`
	Name         string                 `json:"name,omitempty"`
	CustomData   map[string]interface{} `json:"customData,omitempty"`
}

// CreateUser creates a new user in Logto and returns the created user.
func (c *Client) CreateUser(ctx context.Context, params CreateUserParams) (*LogtoUser, error) {
	var u LogtoUser
	if err := c.doJSON(ctx, http.MethodPost, "/api/users", params, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// UpdateUserSuspensionState suspends or reactivates a user.
func (c *Client) UpdateUserSuspensionState(ctx context.Context, userID string, suspended bool) error {
	body := map[string]interface{}{"isSuspended": suspended}
	endpoint := fmt.Sprintf("/api/users/%s/is-suspended", userID)
	return c.doJSON(ctx, http.MethodPatch, endpoint, body, nil)
}
```

- [ ] **Step 6: Commit**

```bash
git add api/logto/
git commit -m "feat(logto): Management API client with cached M2M token

- logto.Client: HTTP wrapper with OAuth2 client_credentials flow
- GetManagementToken: caches M2M access token with 10-second safety margin
  before expiry; refreshes automatically
- doJSON: authenticated Management API request helper
- logto.APIError: typed error for non-2xx responses with status + body
- users.go: GetUser, DeleteUser, CreateUser, UpdateUserSuspensionState
- Unit tests for token caching and refresh-on-expiry

Organizations and M2M app management covered in Task 4.x."
```

### Task 1.4: Create JWT middleware with integration tests

**Files:**
- Create: `api/middleware/jwt_middleware.go`
- Create: `api/middleware/jwt_middleware_test.go`

- [ ] **Step 1: Write the failing integration test**

Create `api/middleware/jwt_middleware_test.go`:

```go
package middleware

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/court-command/court-command/api/auth"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
	"github.com/stretchr/testify/require"
)

// testKey creates a test RSA key and returns (privateKey, jwksServerURL)
func testKey(t *testing.T) (*rsa.PrivateKey, string) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	pubKey, err := jwk.FromRaw(priv.Public())
	require.NoError(t, err)
	require.NoError(t, pubKey.Set(jwk.AlgorithmKey, jwa.RS256))
	require.NoError(t, pubKey.Set(jwk.KeyIDKey, "test-key"))

	set := jwk.NewSet()
	require.NoError(t, set.AddKey(pubKey))

	jwksServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(set)
	}))
	t.Cleanup(jwksServer.Close)

	return priv, jwksServer.URL
}

// mintToken builds a signed JWT with Logto-shaped claims.
func mintToken(t *testing.T, priv *rsa.PrivateKey, issuer string, claims map[string]interface{}) string {
	tok := jwt.New()
	require.NoError(t, tok.Set(jwt.IssuerKey, issuer))
	for k, v := range claims {
		require.NoError(t, tok.Set(k, v))
	}

	signingKey, err := jwk.FromRaw(priv)
	require.NoError(t, err)
	require.NoError(t, signingKey.Set(jwk.AlgorithmKey, jwa.RS256))
	require.NoError(t, signingKey.Set(jwk.KeyIDKey, "test-key"))

	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256, signingKey))
	require.NoError(t, err)
	return string(signed)
}

func TestRequireJWT_ValidToken_PassesThroughWithClaims(t *testing.T) {
	priv, jwksURL := testKey(t)
	const issuer = "http://fake-logto/oidc"

	validator := auth.NewValidator(issuer, jwksURL, "http://localhost:8080/api")

	tokenString := mintToken(t, priv, issuer, map[string]interface{}{
		jwt.SubjectKey:       "user_abc",
		jwt.AudienceKey:      []string{"urn:logto:organization:org_pickleball"},
		"organization_id":    "org_pickleball",
		"organization_roles": []string{"platform_admin"},
		"scope":              "read:tournaments write:tournaments",
	})

	var capturedClaims auth.Claims
	handler := RequireJWT(validator, true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, ok := auth.ClaimsFromContext(r.Context())
		require.True(t, ok)
		capturedClaims = c
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "user_abc", capturedClaims.Subject)
	require.Equal(t, "org_pickleball", capturedClaims.OrganizationID)
	require.ElementsMatch(t, []string{"platform_admin"}, capturedClaims.OrganizationRoles)
}

func TestRequireJWT_MissingHeader_Returns401(t *testing.T) {
	_, jwksURL := testKey(t)
	validator := auth.NewValidator("http://fake-logto/oidc", jwksURL, "http://localhost:8080/api")

	handler := RequireJWT(validator, true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireJWT_WrongIssuer_Returns401(t *testing.T) {
	priv, jwksURL := testKey(t)
	validator := auth.NewValidator("http://expected-issuer/oidc", jwksURL, "http://localhost:8080/api")

	tokenString := mintToken(t, priv, "http://different-issuer/oidc", map[string]interface{}{
		jwt.SubjectKey:  "user_abc",
		jwt.AudienceKey: []string{"urn:logto:organization:org_pickleball"},
	})

	handler := RequireJWT(validator, true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireJWT_WrongAudience_Returns401(t *testing.T) {
	priv, jwksURL := testKey(t)
	const issuer = "http://fake-logto/oidc"
	validator := auth.NewValidator(issuer, jwksURL, "http://localhost:8080/api")

	// Token has a random audience that is neither the API resource nor an org URN.
	tokenString := mintToken(t, priv, issuer, map[string]interface{}{
		jwt.SubjectKey:  "user_abc",
		jwt.AudienceKey: []string{"https://some-other-api.example.com"},
	})

	handler := RequireJWT(validator, true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
go test ./middleware/... -run TestRequireJWT -v
```

Expected: compile errors (RequireJWT not defined).

- [ ] **Step 3: Implement jwt_middleware.go**

Create `api/middleware/jwt_middleware.go`:

```go
package middleware

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/court-command/court-command/api/auth"
)

// RequireJWT returns a Chi middleware that validates the Authorization bearer
// token against the given validator. Sets parsed claims on the request context
// via auth.WithClaims.
//
// If orgScoped is true, the validator accepts tokens whose audience is
// urn:logto:organization:* (the Logto org-token shape). If false, only tokens
// whose audience is the global API resource are accepted.
func RequireJWT(v *auth.Validator, orgScoped bool) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString, ok := bearerToken(r)
			if !ok {
				writeUnauthorized(w, "missing bearer token")
				return
			}

			token, err := v.Validate(r.Context(), tokenString, orgScoped)
			if err != nil {
				slog.DebugContext(r.Context(), "jwt validation failed", "err", err)
				writeUnauthorized(w, "invalid token")
				return
			}

			claims := auth.ExtractClaims(token)
			ctx := auth.WithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(h, prefix) {
		return "", false
	}
	return strings.TrimSpace(h[len(prefix):]), true
}

func writeUnauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":{"code":"UNAUTHORIZED","message":"` + msg + `"}}`))
}
```

- [ ] **Step 4: Run tests**

```bash
go test ./middleware/... -run TestRequireJWT -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/middleware/jwt_middleware.go api/middleware/jwt_middleware_test.go
git commit -m "feat(middleware): RequireJWT Chi middleware with Logto validation

- middleware.RequireJWT: validates Authorization bearer token via the
  auth.Validator, stores parsed claims in request context
- Supports org-scoped tokens (audience urn:logto:organization:*)
- Returns 401 UNAUTHORIZED with JSON error envelope for:
  missing/malformed Authorization header, invalid signature, wrong
  issuer, wrong audience
- Integration tests use in-process JWKS server with RSA key pair to
  validate the full parse path

Sport-validation middleware (X-Sport header vs JWT org_id) comes in
Task 1.5."
```

### Task 1.5: Create sport validation middleware

**Files:**
- Create: `api/middleware/sport_middleware.go`
- Create: `api/middleware/sport_middleware_test.go`

- [ ] **Step 1: Write the failing test**

Create `api/middleware/sport_middleware_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/court-command/court-command/api/auth"
	"github.com/stretchr/testify/require"
)

func buildSportResolver() *SportResolver {
	return NewSportResolver(map[string]string{
		"pickleball": "org_pickleball",
		"demo_sport": "org_demo",
	})
}

func TestRequireSportMatchesJWT_Matches_Passes(t *testing.T) {
	r := buildSportResolver()

	handler := RequireSportMatchesJWT(r)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Sport", "pickleball")
	req = req.WithContext(auth.WithClaims(req.Context(), auth.Claims{
		Subject:        "user_abc",
		OrganizationID: "org_pickleball",
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestRequireSportMatchesJWT_HeaderMissing_Returns400(t *testing.T) {
	r := buildSportResolver()

	handler := RequireSportMatchesJWT(r)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(auth.WithClaims(req.Context(), auth.Claims{
		OrganizationID: "org_pickleball",
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRequireSportMatchesJWT_UnknownSport_Returns400(t *testing.T) {
	r := buildSportResolver()

	handler := RequireSportMatchesJWT(r)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Sport", "chess")
	req = req.WithContext(auth.WithClaims(req.Context(), auth.Claims{
		OrganizationID: "org_pickleball",
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRequireSportMatchesJWT_SportOrgMismatch_Returns403(t *testing.T) {
	r := buildSportResolver()

	handler := RequireSportMatchesJWT(r)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	}))

	// Header says pickleball but JWT says demo_sport
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Sport", "pickleball")
	req = req.WithContext(auth.WithClaims(req.Context(), auth.Claims{
		OrganizationID: "org_demo",
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusForbidden, w.Code)
}
```

- [ ] **Step 2: Run test to confirm failure**

```bash
go test ./middleware/... -run TestRequireSportMatchesJWT -v
```

Expected: compile errors.

- [ ] **Step 3: Implement sport_middleware.go**

Create `api/middleware/sport_middleware.go`:

```go
package middleware

import (
	"log/slog"
	"net/http"

	"github.com/court-command/court-command/api/auth"
)

// SportResolver maps sport slugs (e.g. "pickleball") to Logto organization IDs.
type SportResolver struct {
	slugToOrgID map[string]string
}

// NewSportResolver creates a resolver. The input map is copied.
func NewSportResolver(slugToOrgID map[string]string) *SportResolver {
	m := make(map[string]string, len(slugToOrgID))
	for k, v := range slugToOrgID {
		m[k] = v
	}
	return &SportResolver{slugToOrgID: m}
}

// OrgID returns the Logto organization ID for the given sport slug, or empty string if unknown.
func (s *SportResolver) OrgID(slug string) string {
	return s.slugToOrgID[slug]
}

// RequireSportMatchesJWT returns a Chi middleware that:
//   - Requires the X-Sport header to be present
//   - Validates the sport exists in the resolver
//   - Confirms the JWT's organization_id claim matches the sport's Logto org ID
//
// Must be used AFTER RequireJWT so that auth.Claims is on the request context.
func RequireSportMatchesJWT(r *SportResolver) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			sport := req.Header.Get("X-Sport")
			if sport == "" {
				writeBadRequest(w, "missing X-Sport header")
				return
			}

			expectedOrgID := r.OrgID(sport)
			if expectedOrgID == "" {
				writeBadRequest(w, "unknown sport: "+sport)
				return
			}

			claims, ok := auth.ClaimsFromContext(req.Context())
			if !ok {
				// This means RequireJWT was not installed; programmer error.
				slog.ErrorContext(req.Context(), "sport middleware: no claims in context (RequireJWT missing?)")
				writeUnauthorized(w, "unauthorized")
				return
			}

			if claims.OrganizationID != expectedOrgID {
				writeForbidden(w, "sport does not match your current session's organization")
				return
			}

			next.ServeHTTP(w, req)
		})
	}
}

func writeBadRequest(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	_, _ = w.Write([]byte(`{"error":{"code":"BAD_REQUEST","message":"` + msg + `"}}`))
}

func writeForbidden(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":{"code":"FORBIDDEN","message":"` + msg + `"}}`))
}
```

- [ ] **Step 4: Run tests**

```bash
go test ./middleware/... -run TestRequireSportMatchesJWT -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/middleware/sport_middleware.go api/middleware/sport_middleware_test.go
git commit -m "feat(middleware): RequireSportMatchesJWT + SportResolver

- SportResolver: maps sport slugs to Logto org IDs, populated at app startup
  from environment variables (LOGTO_PICKLEBALL_ORG_ID,
  LOGTO_DEMO_SPORT_ORG_ID)
- RequireSportMatchesJWT: chi middleware that requires X-Sport header and
  cross-checks against the JWT's organization_id claim
- Returns 400 for missing/unknown sport, 403 for sport/JWT mismatch
- Must run after RequireJWT; logs a server error if claims are missing
  (programmer error indicating wrong middleware order)

Router wiring comes in Phase 6 cutover."
```

The plan continues with additional phases. Given document length, this plan document will continue in `docs/superpowers/plans/2026-04-20-logto-integration.md` with the remaining phases. The complete plan covers:

---

## Phase 2-6 Task Outline

The following phases follow the same TDD + frequent-commit pattern shown in Phase 0-1. Full task detail is authored in the plan file but listed here as a structured outline to keep this preview readable.

### Phase 2 — DB migrations

- **Task 2.1:** Write migration `00041_logto_schema_migration.sql` covering: create `sports` table seeded with Pickleball + Demo Sport, add `sport_id` columns to tournaments/leagues/organizations/venues/divisions with pickleball backfill + NOT NULL after backfill, shrink `users` table (drop password_hash, role, all profile columns except `display_name`/`email`), add `logto_user_id` NOT NULL UNIQUE, create `player_profiles` 1:1 table holding all moved columns, shrink `api_keys` (drop key_hash/key_prefix/scopes/expires_at, add `logto_m2m_app_id` UNIQUE), drop `tournament_staff.raw_password`
- **Task 2.2:** Regenerate sqlc code for all modified tables; update all affected queries in `users.sql`, `players.sql`, `api_keys.sql`
- **Task 2.3:** Create new `sports.sql` with list/get queries
- **Task 2.4:** Update service layer signatures that reference removed columns (`users.password_hash`, `users.role`, etc.)
- **Task 2.5:** Smoke test: migration up on fresh DB, migration down rolls back cleanly

### Phase 3 — Frontend auth + route restructure

- **Task 3.1:** Install `@logto/react`, create `web/src/lib/logto.ts` config
- **Task 3.2:** Wrap app in `LogtoProvider` in `web/src/main.tsx`
- **Task 3.3:** Rewrite `web/src/lib/api.ts` `apiFetch` to pull JWT from `useLogto().getOrganizationToken(orgId)` and add `X-Sport` header
- **Task 3.4:** Rewrite `web/src/features/auth/hooks.ts` `useAuth` around `useLogto()`
- **Task 3.5:** Move all existing routes under a new `$sport` parameter in `web/src/routes/$sport/`
- **Task 3.6:** Create public sport picker at `web/src/routes/index.tsx`
- **Task 3.7:** Create `web/src/routes/auth/callback.tsx` for OIDC redirect handling
- **Task 3.8:** Remove `web/src/routes/login.tsx`, `register.tsx`, `features/auth/LoginPage.tsx`, `RegisterPage.tsx`
- **Task 3.9:** End-to-end smoke: sign up → redirected to sport picker → pick pickleball → land on dashboard

### Phase 4 — Logto Management API integration

- **Task 4.1:** Implement `api/logto/organizations.go`: `AddUserToOrganization(userID, orgID)`, `AssignOrganizationRole(userID, orgID, roleName)`
- **Task 4.2:** Implement `api/logto/m2m.go`: `CreateM2MApp(name, scopes)` returns client_id + client_secret, `DeleteM2MApp(id)`
- **Task 4.3:** Rewrite `api/service/tournament_staff.go` to create staff via `logto.CreateUser` + `AddUserToOrganization` + `AssignOrganizationRole`, drop `raw_password` persistence
- **Task 4.4:** Rewrite `api/service/api_key.go` to delegate to `logto.CreateM2MApp`/`DeleteM2MApp`, mirror row in `api_keys` table
- **Task 4.5:** Frontend API keys modal shows client_id + client_secret (two values) instead of single `raw_key`

### Phase 5 — Webhooks, impersonation, test updates

- **Task 5.1:** Implement `api/handler/webhooks.go`: `POST /api/v1/webhooks/logto` with HMAC-SHA256 signature validation via `logto-signature-sha-256` header
- **Task 5.2:** Webhook handler routes on event type: `User.Created` → upsert `users` row, call Logto to add user to Pickleball + Demo Sport orgs with `player` role
- **Task 5.3:** Implement `api/logto/impersonation.go`: `MintImpersonationToken(adminID, targetUserID, orgID)` via Logto Management API
- **Task 5.4:** Rewrite admin impersonation endpoint to return a Logto JWT with `impersonator` custom claim
- **Task 5.5:** Update all existing `auth_test.go`, `settings_test.go`, etc. to use test JWT helpers instead of session helpers
- **Task 5.6:** Add fallback: if a request has valid JWT but no local `users` row, upsert on-demand (webhook failure recovery)

### Phase 6 — Cutover

- **Task 6.1:** Remove `api/session/` package entirely
- **Task 6.2:** Remove `api/handler/auth.go` login/register/logout/refresh flows (keep `/auth/me` adapted)
- **Task 6.3:** Replace `middleware.RequireAuth` with `middleware.RequireJWT` + `RequireSportMatchesJWT` on all sport-scoped route groups in `api/router/router.go`
- **Task 6.4:** Grep-audit: `cc_session`, `SessionStore`, `password_hash`, `raw_password`, `bcrypt` — confirm all removed or only in migrations/archives
- **Task 6.5:** Update `docs/superpowers/HANDOFF.md` auth section
- **Task 6.6:** Manual smoke checklist (15 items from the spec's Success Criteria) — run all, check each off
- **Task 6.7:** Add `v0.2.0` entry in `CHANGELOG.md`
- **Task 6.8:** Open PR from `feature/logto-integration` → `main`; code review; merge

---

## Verification and success criteria

All items from spec's Success Criteria section:

- [ ] All existing Go tests pass with JWTs
- [ ] New tests pass: `auth/`, `logto/`, `middleware/jwt_middleware_test.go`, `middleware/sport_middleware_test.go`, `handler/webhooks_test.go`
- [ ] Frontend typecheck clean: `pnpm tsc -b --noEmit`
- [ ] Frontend build clean: `pnpm build`
- [ ] 15-item manual smoke checklist all pass (from spec lines 351-380)
- [ ] `docs/LOGTO_SETUP.md` walks a new developer from zero to working dev environment
- [ ] `docs/superpowers/HANDOFF.md` reflects the new auth model
- [ ] Grep audit: zero hits for cookie-session code (`cc_session`, `SessionStore`, `session.Data`) outside tests/archives
- [ ] Grep audit: zero hits for plaintext password storage (`password_hash` in active code paths, `raw_password`) outside migrations

## Rollback

Per spec: `git revert` the merge commit, redeploy. Logto container stays running but unused. DB schema changes persist but old code ignores them. No data to preserve (zero-user window).
