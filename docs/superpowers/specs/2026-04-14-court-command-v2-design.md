# Court Command 2.0 — Product Design Specification

**Date:** 2026-04-14
**Status:** Approved — Ready for Implementation Planning
**Authors:** Brainstorm collaboration (22 categories, multi-session)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Architecture Principles](#2-architecture-principles)
3. [Tech Stack](#3-tech-stack)
4. [Entity Hierarchy](#4-entity-hierarchy)
5. [Roles & Permissions](#5-roles--permissions)
6. [Category 1: Identity, Accounts & Access](#6-category-1-identity-accounts--access)
7. [Category 2: Players & Teams](#7-category-2-players--teams)
8. [Category 3: Organizations](#8-category-3-organizations)
9. [Category 4: Venues & Courts](#9-category-4-venues--courts)
10. [Category 5: Tournaments](#10-category-5-tournaments)
11. [Category 6: Leagues & Seasons](#11-category-6-leagues--seasons)
12. [Category 7: Scheduling & Draws](#12-category-7-scheduling--draws)
13. [Category 8: Live Scoring & Match Engine](#13-category-8-live-scoring--match-engine)
14. [Category 9: Broadcast / Overlay System](#14-category-9-broadcast--overlay-system)
15. [Category 10: Integrations](#15-category-10-integrations)
16. [Category 11: Notifications & Communications](#16-category-11-notifications--communications)
17. [Category 12: Player Experience](#17-category-12-player-experience)
18. [Category 13: Spectator Experience](#18-category-13-spectator-experience)
19. [Category 14: Admin & Platform Management](#19-category-14-admin--platform-management)
20. [Category 15: Search & Discovery](#20-category-15-search--discovery)
21. [Category 16: Data & Analytics](#21-category-16-data--analytics)
22. [Category 17: Asset Management & Media](#22-category-17-asset-management--media)
23. [Category 18: API](#23-category-18-api)
24. [Category 19: Accessibility & Responsiveness](#24-category-19-accessibility--responsiveness)
25. [Category 20: Performance & Infrastructure](#25-category-20-performance--infrastructure)
26. [Category 21: Testing & Quality](#26-category-21-testing--quality)
27. [Category 22: Cross-cutting Concerns](#27-category-22-cross-cutting-concerns)
28. [Data Model Summary](#28-data-model-summary)
29. [Competitive Differentiation](#29-competitive-differentiation)

---

## 1. Product Vision

Court Command 2.0 is two products sharing a unified data model:

- **Court Command (Management)** — Full-featured tournament and league management platform for pickleball. Tournaments and Leagues are co-equal first-class pillars with a shared data model (players, teams, orgs, venues, matches). Competitive with PickleballTournaments.com and PickleballLeagues.com.

- **Court Command Overlay (Broadcast)** — Best-in-class broadcast overlay system for live streaming. Sells standalone or bundled with the management platform. Third-party API adapter enables customers to use the overlay connected to any external data source, not just Court Command.

**Target market:** Pickleball-focused. The data model is generic enough to support padel/tennis without rewrites, but those are not officially supported at launch.

**Freemium model:** Free tier = full product with persistent "Court Command" brand mark on overlay. Paid tier = identical product, no brand mark. No feature gating.

**Implementation order:** Operations-first. TD tools, ref console, bracket management, scoring, and overlays get built first. Player-facing self-service registration and discovery are built after, but ALL are designed into the architecture from day one.

**No feature tiers.** Everything in this spec is v2. We tag implementation phase (1/2/3) for dev planning only — nothing gets architecturally punted.

---

## 2. Architecture Principles

### Single-tenant flat namespace
One global namespace for all players, tournaments, leagues, teams, venues, courts. No `organization_id` on every table, no cross-org permission routing. If white-labeling is needed, spin up a parallel stack.

### Two products, one codebase
Court Command (Management) and Court Command Overlay (Broadcast) ship from the same monolith. The overlay consumes the management platform's API as its native data source. Third-party customers can point the overlay at their own API via the adapter system.

### Extraction-ready overlay boundary
The overlay subsystem (routes, database tables, WebSocket channels, control panel) is implemented in isolated Go packages with a clean interface to the rest of Court Command. The canonical overlay data contract and Source Profile adapter system define the seam. If market demand requires a standalone overlay product deployable on customer infrastructure, extraction is a packaging exercise — no rewrite needed.

### Automation is a suggestion engine
Every automated system (bracket generation, match creation, scoring rules, advancement logic, scheduling, seeding) has a manual mode. The TD always has the last word. Override permissions: TD, Head Referee, and League Admin within their respective scopes.

### Event sourcing lite
Each scoring action creates a `MatchEvent` with a full match state snapshot. Undo restores the previous snapshot. Proven pattern from v1.

### Independent top-level entities
Orgs, Teams, Players, Leagues, and Tournaments are ALL independent top-level entities connected through registrations and memberships. Nothing is hard-nested inside anything else.

### Mobile-first referee interface
The ref console is a locked cross-category requirement. Works on phone (portrait primary), tablet, and desktop. The ref console is the single source of truth for live match data — all other surfaces (overlay, public page, player app, stats) subscribe downstream.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Backend | Go |
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| Cache / Realtime | Redis (pub/sub, caching, sessions, rate limiting, job queues) |
| Migrations | Go-native migration tool (goose/golang-migrate/Atlas). SQL files in git, applied on deploy. |
| File storage | Single upload system, local disk initially, S3-compatible later |
| Background jobs | In-process goroutines + Redis queues. No separate worker binary. |
| Deployment | Coolify + Docker Compose |
| CI/CD | GitHub Actions. Tests + lint + build on PR. Auto-deploy to Coolify on merge to main. |

---

## 4. Entity Hierarchy

```
League → Season → Tournament → Division → Pod (optional) → Match
                                                          → MatchSeries (optional, MLP-style)
```

Standalone tournaments are fully supported — same `Division → Pod → Match` structure without a league/season wrapper.

**Independent top-level entities:** Player, Team, Organization, Venue, Court

**Connected through:** TeamRoster, OrgMembership, Registration, LeagueRegistration, SeasonConfirmation, court assignment (Match.court_id)

---

## 5. Roles & Permissions

| Role | Scope | Description |
|---|---|---|
| Platform Admin | Global | Everything. God mode. |
| League Admin | Per-league | Full league control: seasons, divisions, schedules, standings, comms, overlay config. Can create/manage tournaments within league. Can assign/reassign TDs. |
| Tournament Director (TD) | Per-tournament | Create/manage tournaments, draws, brackets, court assignments, ref assignments, registrations, score overrides, event comms, overlay config. |
| Organization Admin | Per-org | Manage org's teams, rosters, player assignments. Register teams for leagues/tournaments. |
| Team Coach | Per-team | Manage their team's roster, view team schedule, submit lineup changes. |
| Head Referee | Per-league or per-tournament | Full ref console + override other refs, reassign refs, incident reports. Can be generic or personal account. |
| Referee | Per-league or per-tournament | Mobile ref console for assigned matches. Scores, serve tracking, timeouts. Can be generic shared account. |
| Scorekeeper | Per-league or per-tournament | Score input only (two big buttons) for casual events. Stripped-down referee. Can be generic shared account. |
| Player | Global | Register for events, manage profile, view schedule/results/stats, link DUPR/VAIR. |
| Spectator | Public | Read-only, no account needed. |
| Broadcast Operator | Per-court | Controls overlays. No admin access to brackets, scores, or tournament management. |
| API Consumer (Read-Only) | Scoped or global | Authenticated via API key, non-human, read-only, rate-limited. |

### Self-service role creation
- Any authenticated user can create a tournament → becomes its TD
- Any authenticated user can create a league → becomes its League Admin
- Any authenticated user can create an org → becomes its Org Admin
- Any authenticated user can create a venue or court (including floating courts for overlay-only use)
- Platform Admin can revoke any role or suspend/ban any user
- Roles are resource-scoped, not global. Same user can be TD for one tournament, Player in another, League Admin for a league.

### Generic ref accounts
- Created by League Admin or TD, scoped to league or tournament
- Shared credentials for volunteer referees
- Open pool model: ref sees all matches in scope, taps into any one to score
- Soft lock: match shows "being scored" while active — not hard-locked
- Optional `scored_by_name` (string) for audit trail

---

## 6. Category 1: Identity, Accounts & Access

### Authentication
- Email + password only. Social login deferred.
- Primary identifier: email address.

### Player identity fields (required)
- `first_name`, `last_name`, `date_of_birth` (required for all accounts)

### Identity deduplication
- **Primary dedup key:** `first_name + last_name + date_of_birth`
- **Secondary anchors:** email, DUPR ID, VAIR ID, phone
- **Player record statuses:** `active` | `unclaimed` | `merged`
- TD-created placeholder records (`unclaimed`) can be claimed by real users, with TD approval if the record has tournament history
- **Merge-not-delete policy:** when duplicates are resolved, one record absorbs the other, all match history follows

### Public ID
- Platform-native human-readable identifier: `CC-28491` format
- Independent of DUPR/VAIR IDs
- Assigned on account creation, never changes
- Merged player's public ID becomes an alias redirecting to primary

### Merge flow
1. Admin identifies duplicates, picks primary account
2. Secondary's data reassigned to primary: match history (`player_id` rewritten), roster memberships, tournament registrations, stats recompute
3. Profile fields from secondary fill blanks on primary; primary wins on conflicts
4. Secondary set to `status: merged` with `merged_into_id` pointer — never hard-deleted
5. Secondary's public ID becomes alias redirecting to primary

### Merge approval chain

| Requester | Approver |
|---|---|
| TD | League Admin or Platform Admin |
| Org Admin | Platform Admin |
| League Admin | Platform Admin |
| Platform Admin | Self-approve |

### API keys
- **Read-only API keys with tiered creation permissions**
- Platform Admins create global API keys (read all data platform-wide)
- All other admin roles create scoped API keys limited to their own resources
- All API keys are read-only
- Rate-limited (configurable, default 100 req/min)

---

## 7. Category 2: Players & Teams

### Player profile fields (all optional except identity fields from Cat 1)
- `display_name`, `avatar_url`, `bio`
- `gender` (enum: `male` | `female` | `non_binary` | `prefer_not_to_say`)
- `handedness` (enum: `right` | `left` | `ambidextrous`)
- `city`, `state_province`, `country`
- `paddle_brand`, `paddle_model`
- `emergency_contact_name`, `emergency_contact_phone`
- `medical_notes` (private — TD/Head Ref only)
- `waiver_accepted_at`
- `dupr_id` (optional), `vair_id` (optional)
- `is_profile_hidden` (bool, default false)

Note: Emergency contact + medical notes can be required at tournament check-in time (tournament-level gate, not player-level) — configured in Cat 5.

### Player profile privacy
- Players can hide their public profile (`is_profile_hidden: true`)
- Hidden = invisible to other players/spectators/public search
- Still fully visible to Org Admins (their org's players), TDs, League Admins, Head Refs, Platform Admins
- Hidden players in public brackets show name only — no profile link, no stats, no avatar

### Team model

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `short_name` | Yes | 3-4 characters |
| `slug` | Yes | Auto-generated |
| `logo_url` | No | |
| `primary_color` | No | Hex string |
| `secondary_color` | No | Hex string |
| `org_id` | No | FK to Organization (nullable) |
| `city` | No | |
| `founded_year` | No | |
| `bio` | No | |

**Team logo fallback chain:** `Team.logo_url` → `Organization.logo_url` → generated default (initials + primary_color)

### TeamRoster join table
Replaces v1's JSON array approach.

| Field | Type | Notes |
|---|---|---|
| `team_id` | FK | |
| `player_id` | FK | |
| `role` | enum | `player` | `captain` | `substitute` |
| `jersey_number` | int | nullable |
| `joined_at` | datetime | |
| `left_at` | datetime | nullable (null = active) |
| `status` | enum | `active` | `inactive` | `suspended` |

Enables: multi-team membership, point-in-time roster queries, per-team jersey numbers. Captain role is optional.

### Player stats (score-derived only)
- `matches_played`, `matches_won`, `matches_lost`, `win_rate` (overall + per-format: singles/doubles/mixed)
- `games_played`, `games_won`, `games_lost`
- `points_scored`, `avg_points_per_game`
- `titles_won`, `podium_finishes` (gold/silver/bronze)
- `current_streak`, `best_streak`
- Head-to-head record vs specific opponents
- `rating_history` (DUPR + VAIR over time)
- Match history: chronological per player, filterable by format/tournament/opponent/date range

**Boundary:** If a ref records it through the scoring flow (points, sideouts, game/match outcomes), we compute stats. Anything requiring per-rally manual tagging is out of scope.

### Team stats
Minimal. Teams show wins/losses within tournament context only. No career aggregates, streaks, or dedicated team stats page. Data model doesn't prevent adding later.

### Roster limits
Global default set by Platform Admin. Division has nullable `max_roster_size` (if set, overrides global; if null, inherits). Build global now; division-level UI later.

### Player search vectors
Name (fuzzy), public ID (CC-28491), DUPR ID, VAIR ID, email (admin only), location (city/state), rating range, org membership, team membership, tournament history.

### Team search vectors
Name, org, division, league, location, rating range.

### Player → Org → Team assignment flow
Org Admin adds players to Org first (creates membership), then assigns to Teams within that org. Must be org member before team assignment.

### Teams and Orgs visibility
Teams and Orgs are always publicly visible. No privacy toggle.

---

## 8. Category 3: Organizations

### Definition
Org = club / facility / competitive entity. NOT governing bodies. Governing bodies operate through League Admin or TD roles. If a governing body also wants to field teams or run a facility, they create an Org like anyone else.

### Org profile fields

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated |
| `logo_url` | No | |
| `primary_color` | No | |
| `secondary_color` | No | |
| `website_url` | No | |
| `contact_email` | No | |
| `contact_phone` | No | |
| `city` | No | |
| `state_province` | No | |
| `country` | No | |
| `bio` | No | |
| `founded_year` | No | |
| `social_links` | No | JSON |
| System fields | Auto | `id`, `public_id`, `created_at`, `updated_at` |

No separate public ID format — name + slug sufficient.

### OrgMembership join table

| Field | Type | Notes |
|---|---|---|
| `org_id` | FK | |
| `player_id` | FK | |
| `role` | enum | `member` | `admin` |
| `joined_at` | datetime | |
| `left_at` | datetime | nullable (null = active) |
| `status` | enum | `active` | `inactive` | `suspended` |

### Membership rules
- **Multi-org membership:** Yes. Player can belong to multiple Orgs simultaneously.
- **Join flow:** Org Admin adds directly. No invite/accept ceremony.
- **Leave:** Player can leave an Org voluntarily. Self-service. Cascades to deactivate all TeamRoster entries within that Org.
- **Block:** Player can block an Org. `OrgBlock` table (`player_id`, `org_id`, `blocked_at`). Blocked Org gets generic "this player is unavailable" message when trying to re-add.

### Org registration flow
- **League play:** Org registers into League (League Admin approves) → Teams register into Divisions within that League's Tournaments.
- **Standalone tournaments:** Teams register directly into Divisions — no Org-level registration step. TD can see which orgs are represented via `team.org_id`.

### Org aggregate dashboard
Org Admin gets a "my org" view showing all teams across all leagues/tournaments — filtered rollup of existing team/match data by `org_id`. Win/loss records, upcoming matches, active registrations, roster status. Not a new stats engine.

### Out of scope
Org-level communications (handled by league/tournament comms), Org billing (handled per-registration in Cat 5/6), Org transfers (team changing orgs — create new team instead).

---

## 9. Category 4: Venues & Courts

### Hierarchy
Venue → Court (two-level). Venue is the physical location, Court is an individual playing surface within it.

### Venue profile fields

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated |
| `address_line_1` | No | |
| `address_line_2` | No | |
| `city` | No | |
| `state_province` | No | |
| `country` | No | |
| `postal_code` | No | |
| `latitude` | No | For proximity search |
| `longitude` | No | For proximity search |
| `timezone` | No | For event time display |
| `website_url` | No | |
| `contact_email` | No | |
| `contact_phone` | No | |
| `logo_url` | No | |
| `photo_url` | No | |
| `venue_map_url` | No | Simple image upload for floor plan |
| `description` | No | Rich text with HTML injection |
| `surface_types` | No | JSON array |
| `amenities` | No | JSON array |
| `org_id` | No | FK — the org that operates this venue |
| `managed_by_user_id` | No | Individual operator if no org |
| `bio` | No | |
| `notes` | No | TD-only |
| System fields | Auto | `id`, `created_at`, `updated_at` |

`court_count` is computed from Court records.

**Venue can be operated by an Org (`org_id`) OR an individual user (`managed_by_user_id`). Both nullable.** Multiple orgs play at a venue — the `org_id` link is "who manages this building," not exclusive access.

**All timestamps stored as UTC.** Frontend converts to local display time using venue's `timezone` field (for event/match times) or user's browser timezone (for general UI).

### Court fields

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated, scoped to venue |
| `venue_id` | No | FK — **nullable** (floating courts for overlay-only use) |
| `surface_type` | No | enum: `indoor_hard` | `outdoor_concrete` | `outdoor_sport_court` | `outdoor_wood` | `temporary` | `other` |
| `is_show_court` | No | bool, default false — flags streaming/broadcast courts |
| `is_active` | No | bool, default true — soft-disable |
| `is_temporary` | No | bool, default false — TD-created event courts |
| `sort_order` | No | int |
| `notes` | No | TD-only |
| `stream_url` | No | Live stream URL |
| `stream_type` | No | enum: `youtube` | `twitch` | `vimeo` | `hls` | `other` — auto-detected from URL |
| `stream_is_live` | No | bool, default false — manual toggle |
| `stream_title` | No | |
| System fields | Auto | `id`, `created_at`, `updated_at` |

**Court.venue_id is nullable.** Tournament validation enforces that courts assigned to a tournament must have a venue. Overlay-only courts can exist without one.

### Live stream embed
- Displays on court public page + match detail page (match inherits from assigned court)
- Permissions: TD, League Admin, Broadcast Operator, Venue Operator
- Rendering: YouTube iframe, Twitch player, Vimeo player, HLS via hls.js, generic iframe fallback for `other`
- Auto-detection: URL pattern matching (youtube.com/youtu.be → youtube, twitch.tv → twitch, vimeo.com → vimeo, .m3u8 → hls, else → other)
- Extensible: new platforms = new enum value + renderer

### Venue lifecycle
Any authenticated user can create a Venue. Venues start in `draft` status. Platform Admin approval required to publish.

States: `draft` → `pending_review` → `published` → `archived`
- Creator submits → `pending_review`. Platform Admin approves → `published`, or rejects → `draft` with feedback.
- TD can use a draft venue for their own tournament (they created it) — just won't appear in public search until approved.

### Court management permissions
- Venue operator (individual `managed_by_user_id`)
- Org Admin (if venue's `org_id` is their org)
- League Admin (if they have a league with a tournament assigned to that venue)
- Platform Admin

### Temporary courts
TDs can add temporary courts at venues where they have an assigned tournament. Courts created by TD are `is_temporary: true`. Auto-archived after tournament ends. Venue operator or League Admin can promote to permanent.

### Venue search
Name (fuzzy), location (proximity via lat/lng), surface type, show court availability, org affiliation, court count range.

### Scope boundaries
- **Venue map = simple image upload** (`venue_map_url`) on a "Map" tab on the venue page. Not an interactive map builder.
- **No court reservation/booking system in v2.** Courts exist for tournament/league match assignment only.

---

## 10. Category 5: Tournaments

### Tournament lifecycle
States: `draft` → `published` → `registration_open` → `registration_closed` → `in_progress` → `completed` → `archived`

Plus `cancelled` — reachable from any state except `draft`, with `cancellation_reason` free-text field.

- `published` and `registration_open` are separate states. TD can announce before opening registration.
- Check-in is a parallel per-division feature, not a top-level tournament state.

### Tournament profile fields

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated |
| `status` | Yes | Lifecycle enum |
| `start_date` | Yes | |
| `end_date` | Yes | |
| `venue_id` | No | FK to Venue |
| `description` | No | Rich text with HTML injection (TDs can embed payment links, iframes, maps) |
| `logo_url` | No | |
| `banner_url` | No | |
| `contact_email` | No | |
| `contact_phone` | No | |
| `website_url` | No | |
| `registration_open_at` | No | |
| `registration_close_at` | No | |
| `max_participants` | No | |
| `rules_document_url` | No | |
| `cancellation_reason` | No | |
| `social_links` | No | JSON |
| `notes` | No | TD-only |
| `sponsor_info` | No | JSON array of `{name, logo_url, link_url, tier, is_header_sponsor}` |
| `show_registrations` | No | bool — controls public visibility of registered players/teams |
| `league_id` | No | FK — nullable for standalone tournaments |
| `season_id` | No | FK — nullable |
| `created_by_user_id` | Yes | FK |
| `td_user_id` | No | FK — nullable. If null, creator acts as TD. Both have full TD permissions. |
| System fields | Auto | `id`, `public_id`, `created_at`, `updated_at` |

**No billing/payment processing in v2.** Display-only fee fields for structured data. TDs describe how to pay in the description.

### Division model

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated, scoped to tournament |
| `tournament_id` | Yes | FK |
| `format` | Yes | enum: `singles` | `doubles` | `mixed_doubles` | `team_match` |
| `gender_restriction` | No | enum: `open` | `mens` | `womens` | `mixed` |
| `age_restriction` | No | JSON: `{min_age, max_age}` |
| `skill_min` | No | float |
| `skill_max` | No | float |
| `rating_system` | No | enum: `dupr` | `vair` | `self_rated` | `none` |
| `bracket_format` | Yes | enum: `single_elimination` | `double_elimination` | `round_robin` | `pool_play` | `pool_to_bracket` |
| `scoring_format` | No | string — references ScoringPreset or custom config |
| `max_teams` | No | int |
| `max_roster_size` | No | int — overrides global default |
| `entry_fee_amount` | No | decimal — display only |
| `entry_fee_currency` | No | string, default "USD" — display only |
| `check_in_open` | No | bool |
| `allow_self_check_in` | No | bool, default false |
| `status` | Yes | enum: `draft` | `registration_open` | `registration_closed` | `seeding` | `in_progress` | `completed` |
| `seed_method` | No | enum: `manual` | `rating` | `random` |
| `sort_order` | No | int |
| `notes` | No | |
| `auto_approve` | No | bool, default true |
| `registration_mode` | No | enum: `open` | `invite_only` |
| `auto_promote_waitlist` | No | bool, default true (FIFO) |
| `grand_finals_reset` | No | bool, default true |
| `advancement_count` | No | int, default 2 — top N from each pool advance |
| `current_phase` | No | enum: `pool` | `bracket` — for pool-to-bracket |
| `report_to_dupr` | No | bool, default false |
| `report_to_vair` | No | bool, default false |
| `allow_ref_player_add` | No | bool — allows refs to add non-rostered players |

### Pod model
Minimal grouping container for pools/groups.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `division_id` | FK | |
| `sort_order` | int | |

Used when `bracket_format` is `round_robin` or `pool_to_bracket`. Pool-to-bracket uses phase indicator within same Division. Bracket-phase matches have `pod_id: null`.

### Registration model

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `division_id` | FK | |
| `team_id` | FK | nullable — team events |
| `player_id` | FK | nullable — singles |
| `registered_by_user_id` | FK | |
| `status` | enum | `pending` | `approved` | `waitlisted` | `withdrawn` | `rejected` | `checked_in` | `no_show` | `withdrawn_mid_tournament` |
| `seed` | int | nullable |
| `final_placement` | int | nullable — 1st through last |
| `registration_notes` | text | |
| `admin_notes` | text | |
| `seeking_partner` | bool | default false — free agent flag |
| `registered_at` | datetime | |
| `approved_at` | datetime | nullable |
| `withdrawn_at` | datetime | nullable |
| `checked_in_at` | datetime | nullable |

### Registration rules
- **Approval configurable per-division:** `auto_approve: true/false` on Division. Default auto-approve.
- **Registration mode per-division:** `open` (public register button) or `invite_only` (TD adds manually).
- **Free agent registration:** Solo players register into doubles/mixed with `seeking_partner: true`. TD sees unmatched players list and manually pairs them.
- **Waitlist promotion configurable per-division:** `auto_promote_waitlist: true/false`. Default auto-promote (FIFO). TD can switch to manual.

### Check-in flow
- Both TD-side and player self-check-in, controlled per-division (`allow_self_check_in`)
- No-show handling: unchecked players flipped to `no_show` when TD starts the division
- Waitlist auto-promotes if enabled
- TD can manually reverse a no-show at any time

### Seeding
- Seeds are draft until TD explicitly locks them
- Flow: registration closes → check-in → TD reviews seeds → TD locks → bracket generates
- Rating-based: auto-rank by DUPR/VAIR per division's `rating_system`; unrated players go to bottom for TD placement
- Manual: TD assigns by hand
- Random: system shuffles, TD can adjust
- Pool-to-bracket re-seeding: system proposes snake-draft order from pool results (avoiding same-pool rematches in early rounds), TD reviews and confirms/edits before locking

### Tournament clone
Clone only (no separate template entity). Clone copies: name (prefixed), venue, description, divisions (all settings), sponsor info, rules doc. Does NOT copy: seeds, brackets, matches, dates.

**Optional registration cloning:** TD gets a checkbox "Include registrations" during clone. If checked, all `approved` registrations from source are copied as `pending` (or `approved` if `auto_approve` on) into new tournament's matching divisions. `withdrawn`/`rejected`/`no_show` are NOT copied.

### Live substitution
- Ref can swap between rostered players (always allowed)
- Adding non-rostered player requires TD permission (`allow_ref_player_add` toggle) or Head Ref override
- All substitutions logged as match events with full audit trail

### Results & awards
- Every team/player gets a `final_placement` (int) on Registration — 1st through last, entire field is placed
- Elimination: winner=1st, finals loser=2nd, semifinal losers=tied 3rd, etc.
- Round-robin/pool: derived from final standings
- TD can manually override any placement
- Player stats (Cat 2) compute `titles_won` and `podium_finishes` from these records

### Mid-tournament withdrawal
- Teams can withdraw mid-tournament ("drop for placement")
- Registration status: `withdrawn_mid_tournament`
- Team receives worst-case placement for their current bracket position
- Opponent gets bye/walkover
- TD can manually adjust placement
- Different from `withdrawn` (never played) — preserves match history

### TD Dashboard
8 sections: Header (name, status, dates, venue, contextual quick-actions), At-a-Glance stats, Division cards, Court map/status grid, Live matches feed (real-time via WS), Announcements panel, Referee assignments, Activity log. Desktop + tablet layout (not phone).

League Admin has same TD Dashboard access (enters via league → tournament list → click into tournament).

### Public tournament page
7 sections: Hero (name, logo, banner, dates, venue, status), Description tab (rich text + rules + sponsors), Divisions tab, Schedule tab, Results tab, Registered players/teams tab (controlled by `show_registrations` toggle), Live scores panel (persistent WS-powered ticker).

### Tournament communications
Tournament-wide + division-scoped announcements, in-app only for v2.

**Announcement entity:**

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `tournament_id` | FK | nullable |
| `league_id` | FK | nullable |
| `division_id` | FK | nullable |
| `title` | string | |
| `body` | text | rich text |
| `created_by_user_id` | FK | |
| `created_at` | datetime | |
| `is_pinned` | bool | |

At least one scope (`league_id` or `tournament_id`) must be set. Null `division_id` = tournament/league-wide; set = targets that division's registrants.

---

## 11. Category 6: Leagues & Seasons

### League model

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated |
| `status` | Yes | enum: `draft` | `published` | `active` | `archived` | `cancelled` |
| `logo_url` | No | |
| `banner_url` | No | |
| `description` | No | Rich text |
| `website_url` | No | |
| `contact_email` | No | |
| `contact_phone` | No | |
| `city` | No | |
| `state_province` | No | |
| `country` | No | |
| `rules_document_url` | No | |
| `social_links` | No | JSON |
| `sponsor_info` | No | JSON array of `{name, logo_url, link_url, tier, is_header_sponsor}` |
| `notes` | No | League Admin only |
| `created_by_user_id` | Yes | FK |
| System fields | Auto | `id`, `public_id`, `created_at`, `updated_at` |

### Division templates
League defines canonical division definitions. New tournaments created within the league inherit these as starting Division records. TD can customize per-tournament after creation. Templates are lightweight (same fields as Division minus tournament-specific state). After creation, tournament divisions are independent — template changes don't retroactively update existing tournaments.

### Season model

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | |
| `slug` | Yes | Auto-generated, scoped to league |
| `league_id` | Yes | FK |
| `status` | Yes | enum: `draft` | `active` | `completed` | `archived` |
| `start_date` | No | |
| `end_date` | No | |
| `description` | No | |
| `notes` | No | League Admin only |
| `roster_confirmation_deadline` | No | |
| `standings_method` | No | enum: `placement_points` | `win_loss` | `match_points` | `custom` |
| `standings_config` | No | JSON — scoring rules for chosen method |
| System fields | Auto | `id`, `created_at`, `updated_at` |

Multiple concurrent Seasons allowed within a League (e.g., regional splits).

### Standings configuration

**Preset methods:**
1. `placement_points` — Points per tournament based on `final_placement`. Config: `{points_table: {1: 10, 2: 7, 3: 5, ...}, participation_points: 1}`
2. `win_loss` — Cumulative W-L record. Config: `{tiebreakers: ["point_differential", "head_to_head", "games_won"]}`
3. `match_points` — Points per match result. Config: `{win: 3, loss: 1, forfeit_win: 3, forfeit_loss: 0, bye: 3}`
4. `custom` — Freeform points table combining any of the above.

**Tiebreaker chain:** League Admin configures ordered list from: `point_differential`, `head_to_head`, `games_won`, `games_lost_fewest`, `rating`. Manual override always available.

### StandingsEntry

| Field | Type |
|---|---|
| `season_id` | FK |
| `division_id` | FK |
| `registration_id` | FK |
| `team_id` / `player_id` | FK |
| `points` | int |
| `matches_played` | int |
| `matches_won` | int |
| `matches_lost` | int |
| `games_won` | int |
| `games_lost` | int |
| `point_differential` | int |
| `tournaments_played` | int |
| `rank` | int (computed) |

Recomputed after each tournament completes or on-demand.

### League registration

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `league_id` | FK | |
| `org_id` | FK | |
| `status` | enum | `active` | `suspended` | `withdrawn` |
| `registered_at` | datetime | |
| `approved_at` | datetime | nullable |
| `notes` | text | |

Register once at League level, active for all Seasons. Optional "Season roster confirmation" deadline.

### SeasonConfirmation

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `season_id` | FK | |
| `team_id` | FK | |
| `division_id` | FK | |
| `confirmed` | bool | |
| `confirmed_at` | datetime | nullable |
| `deadline` | datetime | |

### League public page
7 sections: Hero, Seasons tab, Season detail view (standings + tournament schedule + results), Divisions tab, Teams tab, Announcements, Sponsors.

### League Admin Dashboard
9 sections: Header, Season overview cards, Tournament pipeline (status badges + click-through to TD Dashboard), Org/Team management, Division templates, Standings management, Referee pool (league-wide ref list), Announcements, Activity log.

### Sponsor display
Two zones on League and Tournament public pages:
1. **Header sponsor bar** — slim "Presented by [Sponsor]" above/below hero. Single sponsor slot. `is_header_sponsor: true` flag.
2. **Sponsors section** — full sponsor wall at bottom with tiered logos.

### Edge cases
- **Cross-season player movement:** Historical stats stay with old team. New team accumulates going forward. Player's individual profile shows full history.
- **Mid-season team withdrawal:** Completed results stand. Remaining matches become forfeits/byes per League Admin choice. Standings entry flagged `withdrawn`.
- **Standings override:** League Admin can manually override any standings entry. All overrides logged with reason.
- **Season rollover:** Standings reset to zero. Previous season preserved and viewable.

---

## 12. Category 7: Scheduling & Draws

### Bracket generation flow
TD locks seeds → clicks "Generate Bracket" → system creates shell Match records → TD reviews (drag-and-drop reposition, swap matchups, add/remove byes) → TD confirms → bracket locked, matches become schedulable.

### Match entity model

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `public_id` | uuid | Indexed |
| `division_id` | FK | |
| `pod_id` | FK | nullable |
| `court_id` | FK | nullable |
| `match_series_id` | FK | nullable — for MLP-style |
| `round` | int | |
| `match_number` | int | |
| `bracket_side` | enum | `winners` | `losers` | `grand_finals` | null |
| `scheduled_at` | datetime | nullable — informational, not enforced |
| `started_at` | datetime | nullable |
| `completed_at` | datetime | nullable |
| `status` | enum | `scheduled` | `in_progress` | `completed` | `bye` | `forfeit` | `cancelled` |
| `team_1_id` | FK | nullable (null for shell matches) |
| `team_2_id` | FK | nullable |
| `team_1_registration_id` | FK | nullable |
| `team_2_registration_id` | FK | nullable |
| `winner_id` | FK | nullable |
| `loser_id` | FK | nullable |
| `team_1_seed` | int | nullable (denormalized) |
| `team_2_seed` | int | nullable (denormalized) |
| `scoring_config` | JSON | Inherited from Division, overridable per-match |
| `completed_games` | JSON | Array of per-game results |
| `current_game_num` | int | |
| `team_1_score` | int | |
| `team_2_score` | int | |
| `serving_team` | int | 1 or 2 |
| `server_number` | int | 1 or 2 |
| `serving_player_id` | FK | nullable |
| `is_show_court_match` | bool | |
| `is_quick_match` | bool | default false |
| `referee_user_id` | FK | nullable |
| `scorekeeper_user_id` | FK | nullable |
| `next_match_id` | FK | nullable — bracket progression |
| `loser_next_match_id` | FK | nullable — double-elim loser bracket |
| `series_match_type` | enum | `mens_doubles` | `womens_doubles` | `mixed_doubles` | `singles` | `dreambreaker` | null |
| `notes` | text | |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### Court assignment
Multi-slot court queue with single on-deck highlight:
- Each court has an ordered queue of upcoming matches (no depth limit)
- Visual distinction: Active (1, currently scored) → On-deck (1, next up, highlighted) → Queued (N, remaining)
- Auto-promotion: active completes → on-deck promotes → next queued becomes on-deck
- TD can reorder queue at any time (drag-and-drop), move matches between courts
- Pre-scheduling: TD assigns `scheduled_at` + `court_id` before event day, queue sorted by `scheduled_at`
- Auto-suggest: proposes assignments based on court availability, surface preference, show court priority, avoids double-booking. TD reviews and confirms.
- Court status board: `available` (green), `in_progress` (yellow + live score), `on_deck` (blue), `maintenance` (grey, TD toggle)

### Time scheduling
`scheduled_at` on Match is informational/suggested — not enforced. No `min_rest_minutes` field. No estimated match duration stored.

### Bracket progression
Automatic via `next_match_id` / `loser_next_match_id` wiring:
- Match finalized → `winner_id`/`loser_id` set → winner auto-slotted into `next_match_id` → loser into `loser_next_match_id` (double elim)
- Round robin/pool: all matches pre-generated, standings from results (wins → head-to-head → point differential → games won)
- Pool-to-bracket: system ranks per pool, proposes snake-draft seeding, TD reviews/edits/confirms

### Grand finals
Configurable per-division: `grand_finals_reset: true/false` (default true).

### Advancement count
Configurable per-division: `advancement_count` (int, default 2). Top N from each pool advance. TD can manually override who advances.

### Consolation brackets
Handled as separate Divisions. TD creates a consolation division, manually moves early-round losers into it, runs independently with same tools.

### Byes & forfeits
- Top seeds get byes, distributed for bracket balance (standard algorithm)
- Bye match: `status: 'bye'`, one team populated, auto-advances
- Forfeit: `status: 'forfeit'`, opponent gets win — distinct from structural bye
- TD can convert between bye/forfeit

### Public bracket & schedule views
- **Interactive bracket view:** Live-updating React component (not static image). Seeds, team names, live scores, clickable match detail cards. Filterable by division. Real-time via WebSocket. Desktop + mobile (horizontal scroll).
- **Round robin / pool view:** Standings table + cross-table grid per pod. Live-updating.
- **Schedule view:** Chronological list filterable by division, court, team/player, status, round. "My matches" filter for logged-in players.
- **Match detail page:** Teams with rosters, per-game scores, match timeline from MatchEvent log, referee, court, division context. Live-updating.
- **TV/kiosk mode:** Toggle strips nav/chrome, scales to fill screen, auto-cycles between divisions on configurable timer. For venue lobby TVs. Separate from broadcast overlays (Cat 9).

### Print / export
- PDF brackets (printable bracket sheet per division with empty score boxes)
- PDF schedules (per-division or full tournament)
- PDF pool sheets (cross-table scorecards)
- CSV registrations (admin-only, includes contact info)
- CSV results (placements, scores, standings)
- All on-demand from live data. Public bracket PDF excludes contact info.

### Bracket modifications after generation
- **Pre-play:** Full edit freedom (regenerate, reseed, swap, add/remove)
- **Mid-play:** Score correction with cascade + warnings if downstream played, team withdrawal → forfeits + auto-advance, team swap on unplayed matches only, NO structural restructuring
- **Post-completion:** Placement edits only, match results and bracket structure frozen

---

## 13. Category 8: Live Scoring & Match Engine

### Scoring engine architecture
Hybrid: structured form for most TDs + advanced expression/JSON editor for power users. Presets are readable in both modes. Validator runs config through simulation before saving.

Scoring DSL scoped to match logic only: when a game ends, who scores, when sides switch, serve rotation. Bracket progression and standings use configurable systems from Cat 6-7.

### ScoringPreset entity

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `description` | text | |
| `scoring_config` | JSON | |
| `is_system` | bool | |
| `created_by_user_id` | FK | nullable (null for system presets) |
| `is_active` | bool | |
| `created_at` | datetime | |
| `updated_at` | datetime | |

**10 system presets ship out of the box:**

| Preset | Type | Points | Win by | Best of |
|---|---|---|---|---|
| Standard Side-Out (11) | side_out | 11 | 2 | 3 |
| Standard Side-Out (15) | side_out | 15 | 2 | 3 |
| Standard Side-Out (21) | side_out | 21 | 2 | 1 |
| Rally Scoring (11) | rally | 11 | 2 | 3 |
| Rally Scoring (15) | rally | 15 | 2 | 3 |
| Rally Scoring (21) | rally | 21 | 2 | 1 |
| MLP Singles | rally | 21 | 2 | 1 |
| MLP Doubles | rally | 21 | 2 | 1 |
| MLP Dreambreaker | rally | 21 | 2 | 1 |
| Quick Play (Single Game) | side_out | 11 | 2 | 1 |

Platform Admin can create new global presets; can deactivate but not delete system presets.

### MatchSeries entity (optional MLP-style wrapper)

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `public_id` | uuid | |
| `division_id` | FK | |
| `pod_id` | FK | nullable |
| `court_id` | FK | nullable |
| `round` | int | |
| `match_number` | int | |
| `bracket_side` | enum | nullable |
| `scheduled_at` | datetime | nullable |
| `status` | enum | |
| `team_1_id` / `team_2_id` | FK | |
| `team_1_registration_id` / `team_2_registration_id` | FK | nullable |
| `winner_id` / `loser_id` | FK | nullable |
| `series_config` | JSON | `{best_of, match_types}` |
| `series_score_team_1` / `series_score_team_2` | int | |
| `next_series_id` / `loser_next_series_id` | FK | nullable |
| `notes` | text | |
| `created_at` / `updated_at` | datetime | |

Division `format` enum gains `team_match` value for MLP-style events.

### Match lifecycle
`scheduled` → `in_progress` → `completed` (plus `bye`, `forfeit`, `cancelled`). No warm_up state.

### MatchEvent entity

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `match_id` | FK | |
| `sequence_id` | int | |
| `event_type` | enum | See below |
| `timestamp` | datetime | |
| `payload` | JSON | |
| `score_snapshot` | JSON | Full match state |
| `created_by_user_id` | FK | nullable |
| `scored_by_name` | string | nullable — for generic accounts |

**16 event types:**
`MATCH_STARTED` | `POINT_SCORED` | `POINT_REMOVED` | `SIDE_OUT` | `GAME_COMPLETE` | `MATCH_COMPLETE` | `TIMEOUT_CALLED` | `TIMEOUT_ENDED` | `END_CHANGE` | `SUBSTITUTION` | `MATCH_RESET` | `MATCH_CONFIGURED` | `SCORE_OVERRIDE` | `FORFEIT_DECLARED` | `MATCH_PAUSED` | `MATCH_RESUMED`

**Snapshot-based undo** (proven v1 pattern). Each event stores full match state snapshot.

### Scoring console UI
- **Side-out scoring:** Separate "Point" (awards to serving team) and "Side Out" buttons
- **Rally scoring:** "Point Team 1" / "Point Team 2" only — no Side Out button
- **Score correction:** "Remove Point" action logged as `POINT_REMOVED` event
- **Keyboard shortcuts:** `1` = point team 1, `2` = point team 2, `S` = side out, `Z` = undo, `T` = timeout. Configurable.
- **Haptic/sound feedback:** Short vibration + subtle sound on scoring actions. On by default, toggleable.
- **Score call display:** Prominent (e.g., "4-7-2" for side-out, "4-7" for rally)
- **Match info header:** Teams, division, round, court, bracket position
- **Game history bar:** Per-game scores for completed games
- **Serve indicator:** Serving team, server number, player name — prominent
- **Team color coding:** Each team's side uses their team colors
- **Player roster display:** Active players, serving player highlighted, substitution accessible

### Timeouts
Configurable count per game in `scoring_config`. System shows remaining, warns at zero, allows over-limit with `over_limit: true` flag. Advisory only — not enforced.

### End changes
Configurable rules in `scoring_config`. Visual alert when threshold met. Ref can dismiss.

### Serve tracking
`serving_team` (1/2), `server_number` (1/2), `serving_player_id` (FK nullable). Ref sets serve order at match start. System auto-rotates. Manual override available.

### Game/match detection
Prompted: system detects scoring threshold met → shows "Game Over — Confirm?" → ref confirms or dismisses. Re-prompts after each additional point. Same for match completion.

### Quick Match
Ephemeral standalone scoring. Any authenticated user can create. Pick teams (registry or inline names), scoring preset, optional court. Full ref console + overlay support. **Auto-deletes after 24 hours** with clear warning. No stats impact, no DUPR/VAIR reporting. `Match.is_quick_match: true`.

### Score override
TD/Head Ref modal: enter corrected game scores, required reason field, preview downstream effects, confirm. `SCORE_OVERRIDE` event logged.

### Match pause
Visual only. Disables scoring buttons, overlay shows "Match Paused". No timer tracking.

### Forfeits
TD + Head Ref only. Select forfeiting team + reason. `FORFEIT_DECLARED` event. Opponent auto-advances.

### Offline support
Online-only with smart reconnect. No offline queue, no PWA. On disconnect: visual indicator, scoring buttons disabled, auto-reconnect with exponential backoff, re-fetch state on reconnect.

### WebSocket channels (6 total)
`match:{public_id}`, `court:{court_id}`, `division:{division_id}`, `tournament:{tournament_id}`, `league:{league_id}`, `overlay:{court_id}`

### Scope boundaries
- No structured infraction tracking. Match.notes field sufficient.
- No in-match notes for refs. Console stays focused on scoring.

---

## 14. Category 9: Broadcast / Overlay System

### Architecture
- **One browser source per court.** URL: `/overlay/court/{court_slug}`. Full-screen transparent 1080p (1920×1080) page with predefined zones. Elements togglable independently.
- Same URL openable on unlimited devices simultaneously — all render identically.
- **Per-court overlay settings page** — separate admin URL for Broadcast Operator configuration. Changes push via WebSocket in real-time.
- **All overlay state lives server-side** — overlay page is a pure renderer.

### CourtOverlayConfig entity

| Field | Type | Notes |
|---|---|---|
| `court_id` | FK | unique |
| `theme_id` | string | References a theme |
| `elements` | JSON | Per-element visibility + settings |
| `updated_at` | datetime | |

### 12 overlay elements

1. **Scoreboard** — live score, team names/colors, game score, serve indicator, server number, timeouts
2. **Lower third bar** — team names, player names, division, round, match info
3. **Player card** — individual spotlight: name, photo, stats, rating, team
4. **Team card** — team spotlight: name, logo, roster, record
5. **Sponsor bug** — logo in corner, rotates on timer
6. **Tournament/league bug** — persistent small logo + name
7. **"Coming up next"** — next match from court queue
8. **Match result** — post-match final score + winner
9. **Custom text** — free-text banner/lower third for announcements
10. **Bracket snapshot** — current bracket state for active division
11. **Pool standings** — current pool standings table
12. **Series score** — MLP-style MatchSeries tally

### Themes & customization
- Ship 6-8 curated themes (Classic, Modern, Minimal, Bold, Dark, Broadcast Pro, etc.)
- Each defines layout, fonts, borders, animation style, proportions
- Operator picks theme per court
- Color override: custom primary/secondary/accent colors replace theme defaults
- Team colors auto-populate from team data
- Implemented as CSS custom properties — color overrides swap `--primary`, `--secondary`, `--accent`

### Animations
- Data-driven animation triggers on by default, disableable per-element
- Score change: pulse/flash on point, game-complete graphic, match-complete winner graphic
- Element show/hide: slide/fade/scale transitions defined by theme
- Operator-triggered overlays: auto-dismiss timer or manual dismiss
- When auto-animate disabled, data updates snap without animation

### Broadcast Operator Control Panel
URL: `/overlay/court/{court_slug}/settings`. Access: Broadcast Operator, TD, League Admin.

6 sections:
1. Live preview (scaled-down real-time)
2. Theme selector + color overrides
3. Element panel (show/hide + auto-animate + per-element settings)
4. Manual triggers (player card, team card, custom text, match result, bracket)
5. Data source (auto from court's active match, manual override available)
6. Overlay URL display (copyable)

### Third-party API adapter (Source Profile)

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `name` | string | |
| `created_by_user_id` | FK | |
| `source_type` | enum | `court_command`, `rest_api`, `webhook` |
| `api_url` | string | nullable |
| `webhook_secret` | string | nullable |
| `auth_type` | enum | `none`, `api_key`, `bearer`, `basic` |
| `auth_config` | JSON | encrypted |
| `poll_interval_seconds` | int | nullable |
| `field_mapping` | JSON | — |

**Field mapping UI:** Left = external API shape (auto-discovered or manual), right = canonical overlay slots, drag connections. Saved as reusable profiles.

**Canonical overlay data contract:**
```
match_status, team_1_name, team_1_short_name, team_1_score, team_1_color,
team_1_logo_url, team_1_players[], team_2_*, serving_team, server_number,
current_game, completed_games[], timeouts_remaining_1/2, division_name,
tournament_name, league_name, round_label, match_info, sponsor_logos[],
tournament_logo_url, league_logo_url
```

**Webhook endpoint:** `POST /api/webhook/overlay/{court_id}` with secret validation.

### Third-party overlay creation flow
1. Create account → create court (no venue/tournament required) → switch data source to External API → configure Source Profile → use overlay URL
2. Court serves dual purpose: physical surface (tournament) AND bare overlay container (standalone)

### Freemium model
Free = full product with persistent "Court Command" brand mark on overlay. Paid = identical product, no brand mark. Small logo + text, fixed position, semi-transparent, unobtrusive.

### Resolution
1080p (1920×1080) default. 4K deferred.

### Auto-transitions between matches
- Match result auto-shows on complete (configurable delay, default 30s)
- Elements auto-repopulate with next match from queue
- Idle state when no match (court name or branding)
- Manual "skip to next" in control panel

### Producer monitor
URL: `/overlay/monitor` (or `?tournament={id}` to scope). Grid of all active courts: court name, team names, live score, game score, serve indicator, "heat" badge (match point, deuce, close game). Read-only, no controls. Pure frontend consuming existing WS channels.

### Element positioning
Fixed zones only for v2. Themes own element positioning. `elements` JSON can gain `x`, `y`, `width`, `height` overrides later without schema changes.

### First-time setup
Wizard-style: pick theme → set colors → choose elements → copy OBS URL → done. `CourtOverlayConfig` existence = setup complete.

### Preview without live data
Built-in demo data matching canonical overlay contract. Preview always renders something.

### Overlay URL authentication
Public by default. Optional long-lived, revocable token as query param (`?token=abc123`). Token validated server-side on WS connect and page load.

### WebSocket channels for overlay
Overlay page subscribes to three channels: `overlay:{court_id}` (config changes), `court:{court_id}` (court state), `match:{public_id}` (live scoring).

---

## 15. Category 10: Integrations

### DUPR + VAIR
- **Scope:** Rating only. Pull current rating, push match results. Store periodic rating snapshots in `rating_history`.
- **No external match history pull.**
- **Sync trigger:** Automatic with manual fallback. Ratings auto-pulled on player link, division registration, and daily background job. Results auto-pushed on tournament completion (if reporting enabled). Manual sync always available.
- **Reporting toggle:** Per-division. `report_to_dupr: bool`, `report_to_vair: bool` on Division. League division templates set defaults, TD overrides per-tournament.
- **Player linking:** Self-service ID entry. Player enters DUPR/VAIR ID on profile. System validates via external API. If API unavailable, stored as "unverified" and retried later. Admins can also set/override.

### Other integrations
None beyond DUPR/VAIR + third-party overlay adapter (Cat 9). No streaming platform metadata, no calendar export.

---

## 16. Category 11: Notifications & Communications

- **In-app announcements only** (Cat 5 Announcement entity). No email, SMS, or push in v2.
- **No player notification center.** Players check tournament/league pages for updates. No bell icon, no `Notification` table.
- Data model supports adding notification channels later.

---

## 17. Category 12: Player Experience

### "My Court Command" dashboard
Sections:
- My upcoming matches (time, court, opponent, division)
- My active tournaments (status, next match, bracket position)
- My results (recent match outcomes)
- My stats summary (win rate, rating, streaks)
- My teams (roster status, team schedule)
- Aggregated announcements (from all tournaments/leagues the player is registered in)

All read-only, derived from existing data. Frontend aggregation views + API endpoints.

---

## 18. Category 13: Spectator Experience

### Public landing page
- **Tournament/league directory on TOP, marketing hero BELOW.**
- Directory filterable by location, date, status, sport.
- No account needed to browse.
- Account required to register.

---

## 19. Category 14: Admin & Platform Management

### Platform Admin panel
Sections:
- User management (search, view, edit roles, suspend/ban)
- Venue approval queue
- Player merge approval queue
- Scoring preset management
- System stats (users, tournaments, matches, etc.)
- API key management
- System health indicators

### Suspend + ban
Two tiers:
- `suspended` — temporary, reversible
- `banned` — permanent, requires Platform Admin reinstatement
- Both require reason field, both logged

**User status enum:** `active` | `suspended` | `banned`

### Unified audit log (ActivityLog)

| Field | Type | Notes |
|---|---|---|
| `id` | PK | |
| `actor_user_id` | FK | |
| `action` | string | enum of action types |
| `target_type` | string | entity type |
| `target_id` | int | |
| `details` | JSON | |
| `ip_address` | string | |
| `created_at` | datetime | |

Scoped queries by context (tournament, league, user, etc.).

---

## 20. Category 15: Search & Discovery

### Unified global search
- Single search bar in app header
- Searches players, teams, orgs, tournaments, leagues, venues simultaneously
- Results grouped by type (top 5 per type)
- Respects privacy settings (hidden player profiles excluded from public results)

---

## 21. Category 16: Data & Analytics

No additional analytics beyond existing stats (Cat 2 player stats, Cat 6 standings). Raw data supports building advanced analytics later.

---

## 22. Category 17: Asset Management & Media

- Simple file upload to app storage
- Single `POST /api/upload` endpoint
- Accepts images (logos, avatars, photos, venue maps)
- Local disk initially, S3-compatible later
- Returns URL
- Max ~2MB
- Basic image type validation
- One system for all uploads across app

---

## 23. Category 18: API

- **REST with URL versioning.** `/api/v1/` prefix.
- **OpenAPI spec auto-generated.** JSON responses.
- **Read-only for external consumers, full CRUD internal.** One API, two auth tiers:
  - External API keys → read-only access to all public resources
  - Internal frontend → session auth granting write access per role
- Rate limiting for API keys (configurable, default 100 req/min, 429 + `Retry-After`)

---

## 24. Category 19: Accessibility & Responsiveness

### WCAG 2.2 AA
All surfaces except overlay renderer (OBS browser source).

### Device priority matrix

| Surface | Primary | Secondary |
|---|---|---|
| Referee console | Phone (portrait) | Tablet |
| Scorekeeper console | Phone (portrait) | Tablet |
| TD Dashboard | Desktop | Tablet (landscape) |
| League Admin Dashboard | Desktop | Tablet (landscape) |
| Broadcast Operator control panel | Desktop | Tablet |
| Overlay (OBS browser source) | Desktop 1080p | — |
| Producer monitor | Desktop | Tablet (landscape) |
| Public tournament/league pages | Phone | Desktop |
| Player dashboard | Phone | Desktop |
| Registry / admin panels | Desktop | Tablet |
| Platform Admin panel | Desktop only | — |
| TV/kiosk bracket view | TV/large display | — |

### Dark/light mode
System preference auto (`prefers-color-scheme`) with user override toggle. Default follows OS. User can force dark or light in profile settings.

---

## 25. Category 20: Performance & Infrastructure

| Component | Choice |
|---|---|
| Deployment | Coolify + Docker Compose |
| Database | PostgreSQL 17 |
| Cache / Realtime | Redis (pub/sub, caching, sessions, rate limiting, job queues) |
| Backend | Go |
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 |
| Migrations | Go-native migration tool. SQL files in git, applied on deploy. |
| File storage | Local disk → S3-compatible |
| Background jobs | In-process goroutines + Redis queues. No separate worker binary. |

---

## 26. Category 21: Testing & Quality

### Testing strategy
Critical paths only:
- **Unit tests:** Scoring engine, bracket generation logic, standings computation, serve rotation
- **Integration tests:** API endpoints
- **E2E tests:** Ref console + overlay + bracket progression

### CI/CD
GitHub Actions:
- Tests + lint + build on PR
- Auto-deploy to Coolify on merge to main

---

## 27. Category 22: Cross-cutting Concerns

| Concern | Decision |
|---|---|
| **i18n** | English only for v2. All user-facing strings extracted to locale file (`en.json`). Spanish later = add `es.json` + language toggle. |
| **Currency** | Store ISO code, display with localized symbol. No conversion. |
| **Error handling** | Structured responses `{error: {code, message, details?}}`. No raw errors leaked. |
| **Rate limiting** | Redis-backed sliding window. External API keys: configurable (default 100 req/min). 429 + `Retry-After`. |
| **Soft deletes** | `deleted_at` timestamp on all major entities. Hard deletes only for ephemeral data. |
| **Logging** | Structured JSON logging (Go `slog`). Request ID per log line. No PII in logs. |
| **CORS** | Explicit origin allowlist per environment. No `allow_origins=["*"]`. |
| **Pagination** | All list endpoints paginated. Cursor-based for feeds, offset-based for admin tables. |
| **Slug uniqueness** | Global for top-level entities, scoped for nested. |

---

## 28. Data Model Summary

### Major entities (~25)

| Entity | Category | Purpose |
|---|---|---|
| `Player` | 1, 2 | User account + player profile |
| `Team` | 2 | Competitive unit |
| `TeamRoster` | 2 | Player ↔ Team join table |
| `Organization` | 3 | Club/facility/competitive entity |
| `OrgMembership` | 3 | Player ↔ Org join table |
| `OrgBlock` | 3 | Player blocks Org from re-adding |
| `Venue` | 4 | Physical location |
| `Court` | 4 | Playing surface (or overlay container) |
| `League` | 6 | Top-level league entity |
| `Season` | 6 | Time-bounded competition period within a league |
| `Tournament` | 5 | Event entity |
| `Division` | 5 | Format/skill/bracket grouping within a tournament |
| `Pod` | 5 | Pool/group within a division |
| `Registration` | 5 | Team/player enrolled in a division |
| `Match` | 7, 8 | Individual game/match |
| `MatchEvent` | 8 | Append-only event log per match |
| `MatchSeries` | 8 | Optional MLP-style match wrapper |
| `ScoringPreset` | 8 | Reusable scoring configuration |
| `CourtOverlayConfig` | 9 | Per-court overlay settings |
| `SourceProfile` | 9 | Third-party API adapter configuration |
| `Announcement` | 5, 6 | Tournament/league/division announcements |
| `StandingsEntry` | 6 | Computed standings per season/division |
| `LeagueRegistration` | 6 | Org enrolled in a league |
| `SeasonConfirmation` | 6 | Team confirms for a new season |
| `ActivityLog` | 14 | Unified audit trail |
| `ApiKey` | 1, 18 | External API access tokens |

### Key relationships
- Player → TeamRoster → Team
- Player → OrgMembership → Organization
- Team → Organization (optional)
- Court → Venue (optional)
- Venue → Organization (optional)
- League → Season → Tournament → Division → Pod → Match
- Match → MatchEvent (1:many, append-only)
- Match → MatchSeries (optional)
- Division → Registration (1:many)
- Season → StandingsEntry (1:many)
- Court → CourtOverlayConfig (1:1)
- Court → SourceProfile (via CourtOverlayConfig)

---

## 29. Advertising & Monetization (Added During Implementation)

### Ad Slot System
- **AdSlot component** with 6 IAB standard sizes: leaderboard (728×90), mobile-banner (320×50), medium-rectangle (300×250), skyscraper (160×600), billboard (970×250), responsive-banner (auto desktop/mobile)
- Each slot renders `data-ad-slot` and `data-ad-size` attributes for ad network targeting
- Ad slots appear on **public-facing and registry pages only**: list pages (responsive-banner below title), detail pages (medium-rectangle below content), auth pages (medium-rectangle below form)
- **Explicitly excluded from ads**: broadcast overlays, referee console, scorekeeper console, broadcast operator control panel, overlay config pages, platform admin panel, all settings pages
- **Exception**: TV/kiosk bracket view gets a dedicated ad slot (billboard size)
- Placeholder ads render with dashed border and "Advertisement" label until real ad network is configured

### Community Theme Presets (Added During Implementation)
- Ship with presets based on popular community color palettes: **Catppuccin** (Mocha, Latte, Frappe, Macchiato), **Dracula**, **Nord**, **Gruvbox**, **Tokyo Night**, **One Dark**, **Solarized**
- Each preset overrides CSS custom properties (--color-bg-primary, --color-text-primary, etc.)
- For overlay themes, community color palettes stack as color presets within each structural overlay theme (Classic, Modern, Minimal, Bold, Dark, Broadcast Pro)
- User selects theme in profile settings; persisted in localStorage with system-preference fallback

### Data Overrides for Broadcast Operators (Added During Implementation)
- `data_overrides JSONB` column on `court_overlay_configs` table (migration 00025)
- Broadcast Operator can override any canonical overlay field (team names, scores, player names, custom text, etc.) from the control panel without modifying tournament/match settings
- Overrides applied after resolver populates data from match state — operator overrides always win
- `PUT /api/v1/overlay/court/{courtID}/config/data-overrides` to set, `DELETE` to clear
- Use case: last-minute corrections visible on stream without changing official records

### Live Stream Embed (Locked in Brainstorm)
- `stream_url`, `stream_type` (youtube/twitch/vimeo/hls/other), `stream_is_live`, `stream_title` on Court entity
- Auto-detection of platform from URL pattern
- Displays on court public page + match detail page

### Venue Managers & RBAC (Added During Bug Testing)
- **`venue_managers` join table** (migration 00032): `venue_id`, `user_id`, `role` (manager|admin), `added_at`, `added_by`
- Venue creator is auto-added as admin manager on creation (backfill migration covers existing venues)
- **Permission gating**: UpdateVenue, DeleteVenue, SubmitForReview, CreateCourtForVenue all check `CanManageVenue()` — returns 403 if user is not platform_admin, venue creator, or venue manager
- **Admin-level actions** (add/remove managers, change roles) require `CanAdminVenue()` — platform_admin, venue creator, or manager with role='admin'
- **Frontend**: VenueManagersPanel on VenueDetail page with search-to-add, role toggle, remove with confirmation
- **API endpoints**: `GET/POST /venues/{id}/managers`, `DELETE/PATCH /venues/{id}/managers/{userId}`

### Operator Hub / My Assets (Added During Bug Testing)
- **`/manage` route** — authenticated page showing resources the current user owns or manages
- **4 sections**: My Venues (via venue_managers), My Tournaments (creator or TD), My Leagues (creator), My Organizations (member, with role badge)
- Each section shows card grid with status badges and links to detail pages
- Quick-create links for tournaments and leagues
- **Sidebar entry**: "My Assets" with FolderKanban icon, between Dashboard and Events
- **Backend endpoints**: `GET /api/v1/venues/my` (new), `GET /api/v1/organizations/my` (new). Tournaments and leagues `/my` already existed.

### Admin Create Unclaimed Player (Added During Bug Testing)
- **`POST /api/v1/admin/users/create-player`** — Platform Admin or TD can create placeholder player accounts
- Creates user with `status: 'unclaimed'`, requires only `first_name`, `last_name`, `date_of_birth`
- No email or password needed — placeholder accounts can be claimed by real users later (per Cat 1 dedup model)
- **Frontend**: "Create Player" button on PlayerList page (gated by admin role), modal with 3 required fields

### State & Timezone Dropdowns (Added During Bug Testing)
- Venue and Organization forms use `<Select>` dropdowns instead of free-text `<Input>` for:
  - **State/Province**: 55 US states and territories (AL through WY + DC, AS, GU, MP, PR, VI)
  - **Timezone**: 10 US IANA timezone entries (America/New_York through Pacific/Honolulu)
- Constants defined in `frontend/src/lib/constants.ts`
- International state/timezone support deferred — current implementation covers US launch market

### Content Management System (Decided During Bug Testing — Not Yet Built)
- **Ghost CMS** selected as the content platform for news, blog, and editorial content
- **Deployment**: Ghost as invisible backend at `cms.courtcommand.com`, React frontend renders articles at `courtcommand.com/news`
- Writers access Ghost admin separately (acceptable for small writer pool — no SSO needed at launch)
- **Separate branded news domain** planned for future (Court Command branded, separate domain for SEO)
- **Legal pages** (Terms of Service, Privacy Policy, DMCA, betting disclaimer) are **static React routes** — no CMS needed
- Readers don't need Ghost accounts — articles rendered in Court Command's frontend, not Ghost's theme layer
- This is PARKED — not built yet, revisit after core product launch

### Navigation Hierarchy (Added During Bug Testing)
- **Sidebar order**: Home > Dashboard > My Assets > Events (Leagues, Tournaments) > Manage (Venues, Players, Teams, Orgs) > Scoring > Broadcast > Admin
- **Leagues listed above Tournaments** — matches data hierarchy (League → Season → Tournament)
- **Home link** at top of both authenticated and anonymous sidebar nav
- **Anonymous users** see reduced "Browse" nav: Home, Leagues, Tournaments, Venues (linking to /public/* routes)
- **Public layout** renders sidebar immediately during auth loading (no flash)

### Google Places Address Standardization (Added Post-Phase 7)
- **AddressInput component** (`frontend/src/components/AddressInput.tsx`) — shared address input with Google Places Autocomplete integration
- **Google Places API (New)** + **Maps JavaScript API** used for address auto-complete
- API key configured via `VITE_GOOGLE_MAPS_API_KEY` environment variable
- **Auto-fill behavior**: user starts typing street address → Google suggests matches → selecting a suggestion auto-fills all fields (street, city, state, country, postal code, lat/lng)
- **Fallback**: if Google API unavailable, falls back to manual text inputs with US state dropdown
- **`compact` prop** hides street address + postal code for entities needing only city/state/country
- **Entities with full address support**: Venues (all 8 fields), Organizations (migration 00033), Leagues (migration 00033), Players/Users (migration 00033, private)
- **All address fields**: address_line_1, address_line_2, city, state_province, country, postal_code, latitude (DOUBLE PRECISION), longitude (DOUBLE PRECISION)
- **Backend handlers updated**: org Create/Update, league Create/Update, player UpdateProfile — all accept and pass the 5 new fields (postal_code, address_line_1, address_line_2, latitude, longitude)
- **Forms using AddressInput**: VenueForm, OrgForm, LeagueCreate
- **PlayerForm**: still a stub; backend ready, form needs building
- Tournaments inherit venue address (no separate address fields)

---

## 30. Competitive Differentiation

1. **Unified platform** — tournaments + leagues + overlay in one app (competitors fragment across 5+ sites)
2. **Standalone overlay product** — no pickleball-specific broadcast overlay exists in market; third-party API adapter enables selling overlay independently
3. **Mobile-first referee console** — most competitors still use paper scorecards
4. **Live interactive brackets** — real-time React components, not static bracket images
5. **DUPR + VAIR dual integration** — auto-push results, pull ratings
6. **Operations-first design** — TD tools and ref console built first, player-facing features on same data model
7. **Extraction-ready overlay** — can be packaged as standalone product for white-label customers without rewrite
8. **Freemium with zero feature gating** — free tier is the full product with a brand mark; paid just removes it
9. **MLP-style team match support** — MatchSeries entity handles multi-format team events natively
10. **Producer monitor** — real-time multi-court overview for broadcast directors, a feature no competitor offers
11. **Ad monetization built-in** — IAB-standard ad slots on public/registry pages, excluded from broadcast surfaces and admin
12. **Community theme presets** — popular palettes (Catppuccin, Dracula, Nord, etc.) ship out of the box for app UI and overlay color customization
13. **Multi-manager venues** — venue_managers RBAC allows multiple operators per venue with admin/manager roles, unlike competitors with single-owner models
14. **Operator hub** — dedicated /manage page shows all assets a user controls (venues, tournaments, leagues, orgs) in one view
15. **Google Places address standardization** — all entities use the same AddressInput with autocomplete, structured address components, and lat/lng for future proximity search
