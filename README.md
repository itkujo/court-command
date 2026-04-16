# Court Command

A pickleball tournament and league management platform with a professional broadcast overlay system.

Court Command is two products in one codebase:

1. **Court Command (Management)** -- Tournaments, leagues, seasons, brackets, live scoring, scheduling, and player/team/organization management. Competitive with PickleballTournaments.com.

2. **Court Command Overlay (Broadcast)** -- A standalone broadcast graphics suite with themeable overlays, real-time data, and third-party API integration. Sells bundled with Management or standalone.

## Status

**Backend: Complete** -- All 8 implementation phases done. 170+ API endpoints, 29 database migrations, 62 automated tests, 6 WebSocket channels.

**Frontend: Not started** -- React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4. Planning phase next.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.24+ (Chi v5 router) |
| Database | PostgreSQL 17 |
| Cache / Realtime | Redis 7 (pub/sub, sessions, rate limiting) |
| Query Generation | sqlc (type-safe SQL) |
| Migrations | Goose v3 (embedded in binary) |
| Frontend (planned) | React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4 |
| Deployment | Docker Compose, Coolify |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Go 1.24+
- [sqlc](https://sqlc.dev) (for regenerating queries)

### Development (backend locally, db/redis in Docker)

```sh
git clone https://github.com/itkujo/court-command.git
cd court-command

# Copy environment config
cp .env.example .env

# Start database and Redis
make dev

# In another terminal, start the backend
cd backend
go run .
```

The API is available at `http://localhost:8080`. Health check: `GET /api/v1/health`.

### Full Stack (everything in Docker)

```sh
make full
```

All three services (PostgreSQL, Redis, backend) start in containers. The API is available at `http://localhost:8080`.

### Run Tests

```sh
make test
```

Requires Docker services running (`make dev` or `make full`).

## API Overview

All endpoints are under `/api/v1/` unless noted. WebSocket endpoints are at `/ws/`.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account (email + password) |
| POST | `/auth/login` | Login (returns session cookie) |
| POST | `/auth/logout` | Logout (clears session) |
| GET | `/auth/me` | Current user profile |

### Core Entities

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Players | 6 | Profile management, search, privacy |
| Teams | 10 | CRUD, roster management, search |
| Organizations | 13 | CRUD, membership, blocking |
| Venues | 10 | CRUD, approval workflow, court management |
| Courts | 4 | Standalone/floating courts |

### Tournaments & Leagues

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Leagues | 8 | CRUD, status lifecycle, search |
| Seasons | 6 | CRUD, status management |
| Tournaments | 10 | CRUD, clone, status lifecycle, search |
| Divisions | 7 | CRUD, status, template creation |
| Registrations | 10 | Register, check-in, seed, placement, waitlist |
| Announcements | 6 | Tournament and league scoped |
| Brackets | 1 | Generate (single/double elim, round robin) |
| Standings | 6 | Compute, override, withdraw |

### Live Scoring

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Matches | 20+ | CRUD, scoring actions, events, undo |
| Scoring | 9 | Point, side out, timeout, pause, forfeit |
| Match Series | 8 | MLP-style team format events |
| Quick Match | 2 | Ephemeral 24-hour matches |
| Court Queue | 4 | Queue management for court assignments |

### Broadcast Overlay

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Overlay Data | 2 | Live data + demo data |
| Overlay Config | 7 | Theme, elements, tokens, data overrides |
| Source Profiles | 7 | Third-party API connections (CRUD + `POST /test` auto-discovery) |
| Webhook | 1 | Receive external score data |
| Themes | 2 | List themes, get theme details |

**Frontend surfaces** (all shipped in Phase 4A–E on the `V2` branch):

| Route | Purpose |
|-------|---------|
| `/overlay` | Operator landing page with Your Courts + quick links |
| `/overlay/setup` | 3-step wizard: create court → pick data source → copy OBS URL |
| `/overlay/court/$slug` | Shell-less OBS overlay (what OBS Browser Source loads) |
| `/overlay/court/$slug/settings` | Control panel: preview + 6 tabs (Elements, Theme, Source, Triggers, Overrides, OBS URL) |
| `/overlay/demo/$themeId` | Public theme preview, no auth required, watermark always shown |
| `/overlay/monitor` | Producer monitor grid with heat badges (MP / DEUCE / CLOSE) |
| `/overlay/source-profiles` | Source profile CRUD: list, create, edit, Test Connection |
| `/tv/tournaments/$id` | Fullscreen venue signage: hero + divisions + courts, auto-cycles |
| `/tv/courts/$slug` | Fullscreen single-court display |

12 element components (scoreboard, lower_third, player_card, team_card,
sponsor_bug, tournament_bug, coming_up_next, match_result, custom_text,
bracket_snapshot, pool_standings, series_score) drive the renderer. Data
overrides span 24 keys across 5 groups. 6 backend themes ship with the
built-in palette; custom colour overrides layer on top.

### WebSocket Channels

| Channel | Path | Description |
|---------|------|-------------|
| Match | `/ws/match/{publicID}` | Live match state |
| Court | `/ws/court/{courtID}` | Court state changes |
| Division | `/ws/division/{divisionID}` | Division-wide updates |
| Tournament | `/ws/tournament/{tournamentID}` | Tournament-wide updates |
| League | `/ws/league/{leagueID}` | League-wide updates |
| Overlay | `/ws/overlay/{courtID}` | Overlay config changes |

### Platform

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Dashboard | 1 | Player's "My Court Command" |
| Search | 1 | Global search across all entities |
| Public | 6 | Tournament/league/venue directory |
| Admin | 10+ | User management, venue approval, logs |
| Uploads | 3 | File upload, list, delete |
| External API | 1 | API-key authenticated health check |

## Project Structure

```
court-command/
  backend/
    main.go              # Entrypoint, wiring, graceful shutdown
    config/              # Environment configuration
    db/
      migrations/        # 29 SQL migration files (Goose)
      queries/           # sqlc SQL query definitions
      generated/         # sqlc generated Go code
    handler/             # HTTP handlers (one per domain)
    service/             # Business logic (one per domain)
    middleware/           # Auth, CORS, logging, rate limiting
    engine/              # Pickleball scoring engine
    bracket/             # Bracket generation algorithms
    overlay/             # Broadcast overlay system
    pubsub/              # Redis pub/sub wrapper
    ws/                  # WebSocket handler
    session/             # Redis session store
    router/              # Chi router assembly
    jobs/                # Background jobs (cleanup)
    testutil/            # Test helpers
  docs/
    superpowers/
      specs/             # Design specification
      plans/             # Implementation plans (8 phases)
  old-cc/                # v1 reference code (legacy)
  docker-compose.yml     # Dev (db+redis) and full stack
  Makefile               # Dev commands
```

## Development

### Regenerate sqlc

After modifying SQL queries in `backend/db/queries/`:

```sh
cd backend
sqlc generate
```

### Add a Migration

```sh
cd backend
goose -dir db/migrations create <name> sql
```

Edit the generated file, then restart the backend (migrations run automatically on startup).

### Make Targets

| Target | Description |
|--------|-------------|
| `make dev` | Start db + redis in Docker |
| `make full` | Start full stack in Docker |
| `make full-down` | Stop full stack |
| `make test` | Run all Go tests |
| `make build` | Build Docker images |

## Design Documentation

The complete v2 design specification is at:

```
docs/superpowers/specs/2026-04-14-court-command-v2-design.md
```

Implementation plans for all 8 phases:

```
docs/superpowers/plans/2026-04-14-phase-*.md
```

Progress tracking:

```
docs/superpowers/plans/2026-04-14-progress.md
```

## License

Court Command is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) with an attribution requirement.

**You are free to:**
- Use, modify, and distribute for any non-commercial purpose
- Use for personal projects, education, research, and non-profit organizations
- Build new things on top of it

**You must:**
- Credit Court Command and link to this repository in any derivative work
- Include a copy of the license with any distribution

**You may not:**
- Use Court Command or derivatives for commercial purposes
- Sell Court Command or services built on it for profit

See [LICENSE](LICENSE) for the full legal text.
