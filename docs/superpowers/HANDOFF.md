# Court Command v2 — Agent Handoff Document

**Last updated:** 2026-04-18
**Release:** v0.1.0 at `33aee12` on `main`
**Active branch:** `feature/cms-integration` (empty, ready for work)
**Repo:** `itkujo/court-command` on GitHub

---

## What This Project Is

Court Command is a pickleball tournament/league management platform with a broadcast overlay system. Two products in one codebase:

1. **Court Command (Management)** — tournaments, leagues, brackets, scoring, registrations, venues, courts, player/team/org management
2. **Court Command Overlay (Broadcast)** — OBS browser source overlays, control panel, producer monitor, TV/kiosk bracket views, third-party API adapter

Target market: pickleball tournament directors, league operators, venue managers, broadcast operators. Competitive with pickleballtournaments.com but differentiated by the integrated overlay system (no competitor offers this).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.26, Chi v5 HTTP router, PostgreSQL 17, Redis 7 |
| ORM/Queries | sqlc (SQL-first, type-safe code generation) |
| Migrations | Goose v3 (embedded SQL files) |
| Auth | Redis sessions (cookie-based, 30-day TTL) |
| Realtime | Redis Pub/Sub + gorilla/websocket (6 channels) |
| Frontend | React 19, Vite, TanStack Router (file-based), TanStack Query v5 |
| Styling | Tailwind CSS v4 with CSS custom properties for theming |
| Icons | lucide-react |
| PWA | vite-plugin-pwa with service worker |
| Deployment | Docker Compose (PostgreSQL + Redis + Go backend + Nginx frontend) |
| License | PolyForm Noncommercial 1.0.0 with attribution |

## Project Structure

```
new-cc/
├── backend/
│   ├── main.go                    # Entrypoint, wires everything
│   ├── config/                    # Environment config
│   ├── db/
│   │   ├── migrations/            # 00001-00038 Goose SQL files
│   │   ├── queries/               # sqlc .sql files (source of truth)
│   │   ├── generated/             # sqlc output (tracked in git)
│   │   └── seed.sql               # Dev seed data (make seed)
│   ├── handler/                   # HTTP handlers (Chi)
│   ├── service/                   # Business logic layer
│   ├── middleware/                 # Auth, CORS, rate limiting, body limit
│   ├── engine/                    # Scoring engine (stateless)
│   ├── bracket/                   # Bracket generation (single/double elim, round robin)
│   ├── overlay/                   # Overlay contract, themes, resolver, webhook, poller
│   ├── pubsub/                    # Redis pub/sub wrapper
│   ├── ws/                        # WebSocket handler
│   ├── session/                   # Redis session store
│   ├── router/                    # Chi router assembly
│   ├── jobs/                      # Background jobs (cleanup)
│   └── testutil/                  # Test helpers (separate test DB)
├── frontend/
│   ├── src/
│   │   ├── routes/                # TanStack Router file-based routes
│   │   ├── features/              # Feature-based folders
│   │   │   ├── auth/              # Login, register, hooks
│   │   │   ├── admin/             # Admin panel, user mgmt, ads
│   │   │   ├── dashboard/         # Player dashboard
│   │   │   ├── leagues/           # League CRUD, seasons, templates
│   │   │   ├── manage/            # Operator hub (my assets)
│   │   │   ├── matches/           # Public match detail
│   │   │   ├── match-series/      # Match series detail
│   │   │   ├── overlay/           # Overlay renderer, control panel, monitor, TV
│   │   │   ├── public/            # Public landing, directory pages
│   │   │   ├── quick-match/       # Quick match CRUD
│   │   │   ├── referee/           # Ref console, court grid
│   │   │   ├── registry/          # Players, teams, orgs, venues, courts
│   │   │   ├── scorekeeper/       # Scorekeeper console
│   │   │   ├── scoring/           # Scoring hooks, components, engine UI
│   │   │   ├── search/            # Global Cmd+K search
│   │   │   └── tournaments/       # Tournament CRUD, divisions, brackets
│   │   ├── components/            # Shared UI components (~30)
│   │   ├── hooks/                 # Shared hooks (theme, debounce, media query)
│   │   └── lib/                   # Utilities (api, cn, formatters, themes, constants)
│   └── public/                    # Static assets (logos, ad placeholders)
├── docs/
│   ├── superpowers/
│   │   ├── specs/                 # Design specs (main + per-phase)
│   │   ├── plans/                 # Implementation plans (all phases)
│   │   ├── lessons/               # Retrospective docs
│   │   ├── PHASE_LAUNCH.md        # Agent launch manifest
│   │   └── HANDOFF.md             # This file
│   ├── QA_REPORT.md               # QA audit results
│   ├── DATABASE_GUIDE.md          # DB persistence + backup guide
│   └── ...
├── docker-compose.yml
├── Makefile
├── CHANGELOG.md
├── README.md
└── LICENSE
```

## Key Numbers

- **38 database migrations** (00001-00038)
- **~195+ API endpoints**
- **6 WebSocket channels** (match, court, division, tournament, league, overlay)
- **170+ git commits** on V2
- **62+ backend tests** (bracket, engine, handler, service packages)
- **Frontend integration tests** for scoring + overlay contracts
- **11 community theme presets**
- **12 overlay elements**
- **6 overlay themes**

## Development Commands

```bash
# Start dev environment
make dev              # Docker db + redis
cd backend && go run . # Backend on :8080
cd frontend && pnpm dev # Frontend on :5173

# Seed test data (wipes + rebuilds)
make seed

# Build
cd backend && go build ./...
cd frontend && pnpm build

# Test
cd backend && go test ./... -count=1   # Uses courtcommand_test DB
cd frontend && pnpm tsc -b --noEmit    # Typecheck

# Backup
make backup           # Quick DB backup
make backup-full      # DB + uploads
make restore-db FILE=backups/xxx.sql.gz

# Docker full stack
make full             # All services in Docker
```

## Source of Truth Rules (Critical)

- **Database schema is the master source of truth.** Frontend forms, API payloads, and TypeScript types MUST match DB CHECK constraints, enum values, and column definitions exactly.
- When adding/editing forms with enum-like fields (`format`, `status`, `bracket_format`, `registration_mode`, `gender_restriction`, `seed_method`, etc.), open the corresponding migration in `api/db/migrations/` and copy the `CHECK (x IN (...))` values verbatim.
- If the frontend needs different UX labels (e.g., "Men's" vs `mens`), keep DB values in `value=` and only change the display `label`.
- Changing DB constraints requires a new migration + `sqlc generate` + updating any code that references the old values.
- **Do not** "fix" a frontend/backend value mismatch by making the DB loosen its constraints unless the product genuinely needs new values — prefer aligning the caller to the DB.

## Codebase Patterns (Critical for New Agents)

### Backend
- **Module:** `github.com/court-command/court-command` — NO `backend/` prefix in imports
- **Response:** `handler.Success(w, data)`, `handler.Created(w, data)`, `handler.Paginated(w, data, total, int(limit), int(offset))`, `handler.HandleServiceError(w, err)`
- **Errors:** `&service.ValidationError{}`, `&service.NotFoundError{}`, `&service.ConflictError{}`, `&service.ForbiddenError{}`
- **Auth:** `session.SessionData(r.Context())` returns `*session.Data` with `.UserID`, `.Role`, `.Email`, `.PublicID`
- **DB errors:** Always check `errors.Is(err, pgx.ErrNoRows)` for not-found; let other errors propagate as 500
- **sqlc:** Queries in `db/queries/*.sql`, run `sqlc generate` after changes, generated code tracked in git
- **Migrations:** `db/migrations/NNNNN_name.sql` with Goose `-- +goose Up` / `-- +goose Down` markers

### Frontend
- **Imports:** Relative paths (`../../../lib/api`), NOT `@/` aliases
- **API:** `apiGet/apiPost/apiPatch/apiDelete/apiGetPaginated` from `lib/api.ts` with `credentials: 'include'`
- **Toast:** `const { toast } = useToast(); toast('success'|'error'|'warning'|'info', msg)`
- **Modal:** `<Modal open onClose title>{children}</Modal>`
- **ConfirmDialog:** `{ open, onClose, onConfirm, title, message, confirmText?, variant?, loading? }`
- **Button variants:** `primary | secondary | danger`
- **Badge variants:** `success | warning | error | info | neutral`
- **Router:** TanStack Router file-based. `createFileRoute('/path')({ component })`. Params via `Route.useParams()`
- **After new route files:** `pnpm dev` briefly to regenerate route tree (no CLI)
- **CSS tokens:** `--color-text-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-muted`, `--color-accent`

## Branching Workflow (v0.1.0+)

- All new work on feature branches: `feature/xxx`
- Verify before merge: `go build && go vet && go test && pnpm tsc && pnpm build`
- Merge to `main` via PR or direct merge after verification
- Tag releases on `main`: `git tag -a vX.Y.Z -m "message"`

## Next Steps (Prioritized)

### 1. Ghost CMS Integration (feature/cms-integration — branch created, empty)

**Decision locked during brainstorm:**
- Ghost CMS as invisible backend, React frontend renders articles
- Writers access Ghost admin at `cms.courtcommand.com`
- Articles rendered at `courtcommand.com/news` via Ghost Content API
- Legal pages (terms, privacy, DMCA) as static React routes
- Separate news domain planned eventually

**Implementation scope:**
- Ghost Docker service in docker-compose.yml (or external hosted instance)
- Ghost Content API client in frontend (`lib/ghost.ts`)
- News routes: `/news`, `/news/:slug`
- Article list + detail components
- Static legal page routes: `/terms`, `/privacy`, `/dmca`
- Sidebar/nav entry for News
- SEO meta tags on article pages

### 2. Known Deferred Items

| Item | Description | Effort |
|------|-------------|--------|
| BUG-08 | Division bracket GET endpoint (frontend works around it) | Low |
| D1 residual | Org admin panel (deferred from Phase 6) | Medium |
| SELECT * cleanup | 113 queries use SELECT * — over-fetches | Medium-High |
| Backend test coverage | 11/15 packages have no tests | High |
| Image optimization | 38/40 img tags missing loading="lazy" + dimensions | Low |
| staleTime tuning | 0/85 useQuery hooks set staleTime | Medium |

### 3. Future Feature Ideas (Not Designed Yet)

- DUPR/VAIR rating integration (pull ratings, push results)
- Player merge workflow UI
- Mobile app (React Native or PWA enhancement)
- Stripe payment integration for registration fees
- Email/SMS notifications (currently in-app only)
- Calendar export (iCal)
- Advanced analytics dashboard
- Court reservation/booking system

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| daniel.f.velez@gmail.com | PASSword123! | platform_admin |
| admin@courtcommand.com | TestPass123! | platform_admin |
| td@courtcommand.com | TestPass123! | tournament_director |
| ref@courtcommand.com | TestPass123! | head_referee |

All seed accounts use `TestPass123!` unless noted.

## Key Documentation Files

| File | Purpose |
|------|---------|
| `docs/superpowers/specs/2026-04-14-court-command-v2-design.md` | Master spec (all 22 categories + addenda) |
| `docs/superpowers/PHASE_LAUNCH.md` | Agent launch manifest with handoff template |
| `docs/superpowers/plans/2026-04-14-progress.md` | Phase-by-phase completion tracking |
| `docs/QA_REPORT.md` | QA audit results (14 bugs, all fixed) |
| `docs/DATABASE_GUIDE.md` | DB persistence, backup, migration guide |
| `docs/superpowers/lessons/2026-04-16-phase-3-review-defects.md` | Lessons learned from Phase 3 review cycle |
| `CHANGELOG.md` | Feature changelog |
| `README.md` | Project overview + quick start |
