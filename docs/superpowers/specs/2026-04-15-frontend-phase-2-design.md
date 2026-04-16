# Frontend Phase 2: Tournament & League Management — Design Spec

## Overview

Frontend Phase 2 builds the full tournament and league management interface. This is the largest CRUD surface in the app — covering leagues, seasons, division templates, tournaments, divisions, pods, registrations, announcements, league registrations, and season confirmations. It also adds file upload integration to existing entity forms and extracts shared components identified during Phase 1 review.

## Scope

### Included
- Tournament list, creation wizard (3-step), and detail hub (5 tabs)
- Division detail pages (4 tabs) with registration management, seed ordering, bracket generation
- League list, creation form, and detail hub (5 tabs)
- Season detail pages with tournament list and confirmation tracking
- Division template CRUD on league hub
- Announcement system (tournament-scoped and league-scoped)
- Tournament cloning
- File upload component integrated into entity forms
- Scoring preset picker
- Shared component extractions (InfoRow, StatusBadge, TabLayout)

### Explicitly NOT Included
- Interactive bracket scoring (read-only bracket display + generation button only — Phase 3)
- Referee/scorekeeper assignment
- Court assignment and queue management
- Match scheduling
- WebSocket real-time updates
- Player self-registration (TD-managed only)
- Standings computation and display (Phase 6)
- Public tournament/league pages (Phase 5)
- Platform admin panel (Phase 7)

## Tech Stack

Same as Phase 1 — no new dependencies except:
- None required. All features built with existing React 19 + TanStack Router + TanStack Query + Tailwind v4 + Lucide stack.

## Route Structure

### Tournament Routes
```
/tournaments                          → Tournament list (search, filter by status)
/tournaments/create                   → Multi-step creation wizard (3 steps)
/tournaments/:id                      → Tournament hub (tabbed)
/tournaments/:id/divisions/:divisionId → Division detail (tabbed)
```

### League Routes
```
/leagues                              → League list (search)
/leagues/create                       → League creation form
/leagues/:id                          → League hub (tabbed)
/leagues/:id/seasons/:seasonId        → Season detail
```

### Sidebar
Already configured in Phase 1 — "Events" group has "Tournaments" (`/tournaments`) and "Leagues" (`/leagues`). No sidebar changes needed.

## Feature Structure

```
frontend/src/
  features/
    tournaments/
      hooks.ts                    # TanStack Query hooks for all tournament entities
      TournamentList.tsx          # Searchable list with status filter
      TournamentCreate.tsx        # 3-step wizard
      TournamentDetail.tsx        # Hub: Overview, Divisions, Registrations, Announcements, Settings tabs
      TournamentOverview.tsx      # Overview tab content
      TournamentSettings.tsx      # Settings tab (edit form)
      DivisionList.tsx            # Division card grid (Divisions tab)
      DivisionForm.tsx            # Create/edit division form
      DivisionDetail.tsx          # Division hub: Overview, Registrations, Seeds, Bracket tabs
      DivisionOverview.tsx        # Division overview + edit
      DivisionRegistrations.tsx   # Full registration management for one division
      DivisionSeeds.tsx           # Seed ordering with drag/manual entry
      DivisionBracket.tsx         # Read-only bracket display + generate button
      RegistrationTable.tsx       # Cross-division registration table (Tournament Registrations tab)
      AnnouncementFeed.tsx        # Announcement list + inline composer (reused by leagues)
      CloneDialog.tsx             # Clone tournament modal
    leagues/
      hooks.ts                    # TanStack Query hooks for league entities
      LeagueList.tsx              # Searchable list
      LeagueCreate.tsx            # Creation form
      LeagueDetail.tsx            # Hub: Overview, Seasons, Division Templates, Registrations, Announcements tabs
      LeagueOverview.tsx          # Overview tab content
      SeasonList.tsx              # Season card grid
      SeasonForm.tsx              # Create/edit season form
      SeasonDetail.tsx            # Season detail: tournaments + confirmations
      DivisionTemplateList.tsx    # Template card grid + CRUD
      DivisionTemplateForm.tsx    # Template create/edit form
      LeagueRegistrations.tsx     # Org-level registration management
  components/
    ImageUpload.tsx               # Reusable file upload with preview
    StatusBadge.tsx               # Color-coded status badges
    TabLayout.tsx                 # Reusable tab container
    RichTextDisplay.tsx           # Safe HTML rendering for descriptions
    SponsorEditor.tsx             # Inline sponsor list editor
    ScoringPresetPicker.tsx       # Dropdown listing scoring presets
    VenuePicker.tsx               # Searchable venue dropdown
    InfoRow.tsx                   # Extracted from Phase 1 detail pages
  routes/
    tournaments/
      index.tsx                   # → TournamentList
      create.tsx                  # → TournamentCreate
      $tournamentId/
        index.tsx                 # → TournamentDetail
        divisions/
          $divisionId/
            index.tsx             # → DivisionDetail
    leagues/
      index.tsx                   # → LeagueList
      create.tsx                  # → LeagueCreate
      $leagueId/
        index.tsx                 # → LeagueDetail
        seasons/
          $seasonId/
            index.tsx             # → SeasonDetail
```

## Tournament Detail Hub

URL: `/tournaments/:id`

### Tab: Overview
- Tournament name, status badge (StatusBadge component), dates, venue link
- Description (RichTextDisplay)
- Sponsor logos (if any)
- Quick stats cards: total registrations, divisions count, checked-in count
- Action buttons based on status:
  - Draft → "Publish" button
  - Published → "Open Registration" button
  - Registration Open → "Close Registration" button
  - Registration Closed → "Start Tournament" button
  - In Progress → "Complete Tournament" button
  - Any (except draft) → "Cancel" button (opens ConfirmDialog with reason field)
  - Any → "Archive" button
- "Clone Tournament" button → opens CloneDialog

### Tab: Divisions
- Card grid of divisions
- Each card: name, format badge, bracket type, registration count / max, status badge
- "Add Division" button → DivisionForm in modal or inline
- Click card → navigates to `/tournaments/:id/divisions/:divisionId`

### Tab: Registrations (Cross-Division)
- RegistrationTable component
- Table columns: Player/Team Name, Division, Status (badge), Seed, Registered Date
- Search by player/team name
- Filter dropdown by division, filter by status
- Click row → navigates to division detail for that registration
- No bulk actions here — this is the "find anyone" view

### Tab: Announcements
- AnnouncementFeed component (reused by leagues)
- Feed: newest first, pinned announcements at top
- "New Announcement" button → inline composer:
  - Title (required)
  - Body (textarea)
  - Division scope (optional dropdown — null = tournament-wide)
  - Pin toggle
- Each announcement: title, body, author name, timestamp, pin indicator
- Edit/delete buttons on own announcements

### Tab: Settings
- Edit form for tournament fields:
  - Name, slug, start date, end date
  - Venue picker (VenuePicker)
  - League/season pickers (optional)
  - Description (textarea)
  - Contact email, phone, website URL
  - Rules document URL
  - Logo (ImageUpload), Banner (ImageUpload)
  - Sponsors (SponsorEditor)
  - Max participants
  - Show registrations toggle
- Save button
- Delete tournament (ConfirmDialog)

## Division Detail

URL: `/tournaments/:id/divisions/:divisionId`

### Tab: Overview
- Division name, format, bracket type, scoring preset name
- Status badge + transition buttons (same pattern as tournament)
- Config display: gender restriction, age range, skill range, rating system, max teams, max roster, entry fee, check-in settings, reporting toggles
- "Edit" button → opens DivisionForm with current values pre-filled
- Delete division (ConfirmDialog, only if no registrations)

### Tab: Registrations
- Full management table for this division
- Columns: Player/Team Name, Status (badge), Seed (editable inline), Check-in (checkbox), Registered Date, Actions
- Bulk actions bar: "Approve All Pending", "Bulk No-Show" (marks unchecked as no-show)
- Individual row actions: Approve, Reject, Waitlist, Withdraw, Check-in toggle
- Waitlist section: ordered list, auto-promote indicator
- Seeking-partner indicator for doubles registrations
- "Add Registration" button (TD manually registers a player/team)
- Admin notes per registration (expandable row or tooltip)
- Capacity indicator: "24 / 32 registered" with progress bar

### Tab: Seeds
- Ordered list of approved/checked-in registrations
- Each row: seed number (editable), player/team name, rating (if available)
- Drag-and-drop reordering (or manual seed number entry)
- "Auto-Seed by Rating" button (sorts by DUPR/VAIR per division's rating_system)
- "Randomize" button
- "Lock Seeds" button (prevents further changes, enables bracket generation)
- Status indicator: "Seeds Locked" or "Seeds Draft"

### Tab: Bracket/Pools
- If bracket NOT generated:
  - "Generate Bracket" button (requires seeds locked)
  - Format description (e.g., "Single Elimination, 32 teams, Best of 3")
- If bracket generated:
  - **Single/Double Elimination:** Visual bracket tree (horizontal rounds, match cards with team names + seeds). Read-only in Phase 2 — no scoring. Scrollable.
  - **Round Robin / Pool Play:** Pod tables showing round-robin grid (teams × teams matrix with win/loss indicators). One table per pod.
  - **Pool-to-Bracket:** Pool tables + bracket view for elimination phase (shown when division phase transitions)

## Tournament Creation Wizard

URL: `/tournaments/create`

3-step wizard with progress indicator and step validation.

### Step 1: Basic Info
- Name (required, text)
- Start Date (required, DateInput)
- End Date (required, DateInput, must be >= start)
- Venue (VenuePicker, optional)
- League (searchable dropdown, optional)
- Season (dropdown, appears if league selected, optional)
- Description (textarea)
- Contact Email (Input type=email)
- Contact Phone (Input type=tel)
- Website URL (Input type=url)
- Rules Document URL (Input type=url)
- Logo (ImageUpload)
- Banner (ImageUpload)
- Sponsors (SponsorEditor)
- "Next" button (validates required fields)

### Step 2: Divisions
- Division list (initially empty)
- "Add Division" button → expands DivisionForm inline:
  - Name (required)
  - Format: singles / doubles / mixed_doubles / team_match (Select)
  - Gender Restriction: open / mens / womens / mixed (Select)
  - Age Range: min age, max age (optional number inputs)
  - Skill Range: min, max (optional number inputs)
  - Rating System: dupr / vair / self_rated / none (Select)
  - Bracket Format: single_elimination / double_elimination / round_robin / pool_play / pool_to_bracket (Select)
  - Scoring Preset (ScoringPresetPicker)
  - Max Teams (optional number)
  - Max Roster Size (optional number)
  - Entry Fee Amount + Currency (optional)
  - Auto-Approve Registrations (toggle, default on)
  - Registration Mode: open / invite_only (Select)
  - Allow Self Check-In (toggle)
  - Grand Finals Reset (toggle, for double elim)
  - Advancement Count (number, for pool-to-bracket, default 2)
  - Report to DUPR (toggle)
  - Report to VAIR (toggle)
- Each added division shows as a card with summary, edit/remove buttons
- Can add 0+ divisions (skip to add later)
- "Back" and "Next" buttons

### Step 3: Review & Create
- Summary display of all entered info organized in sections
- Division summary cards
- "Save as Draft" button → creates with status=draft, redirects to hub
- "Create & Publish" button → creates with status=published, redirects to hub

## Clone Tournament Dialog

Triggered from tournament hub Overview tab.

- Modal dialog (Modal component)
- Fields:
  - New tournament name (pre-filled: "Copy of {original name}")
  - Start date (required)
  - End date (required)
  - Include registrations checkbox (default unchecked)
- "Clone" button → calls clone API → redirects to new tournament hub
- Loading state during clone

## League Detail Hub

URL: `/leagues/:id`

### Tab: Overview
- League name, status badge, description, contact info
- Sponsor display: header sponsor bar (if `is_header_sponsor` entry exists) + sponsor wall
- Quick stats: seasons count, active orgs, total tournaments across seasons
- Status transition buttons: Publish, Activate, Archive, Cancel
- Edit button → inline form or navigates to settings

### Tab: Seasons
- Card grid of seasons
- Each card: name, date range, status badge, tournament count
- "Create Season" button → SeasonForm modal:
  - Name (required)
  - Start Date, End Date
  - Standings Method: placement_points / win_loss / match_points / custom (Select)
  - Standings Config (JSON textarea for advanced, or simplified fields for common presets)
  - Roster Confirmation Deadline (optional DateInput)
- Click card → `/leagues/:id/seasons/:seasonId`

### Tab: Division Templates
- Card grid of templates
- Each card: name, format, bracket type, scoring preset
- "Create Template" button → DivisionTemplateForm (same fields as division but no tournament-specific state)
- Edit/Delete on each card
- Note: "These templates are cloned into tournaments created within this league"

### Tab: Registrations
- Org-level league registrations
- Table: Org Name, Status (active/suspended/withdrawn), Registered Date
- Actions: Suspend, Withdraw (for active orgs)
- "Register Org" button → searchable org picker → creates league registration

### Tab: Announcements
- AnnouncementFeed (same component as tournament, league-scoped)

## Season Detail

URL: `/leagues/:id/seasons/:seasonId`

- Season header: name, dates, status badge, standings method
- Status transition buttons: Activate, Complete, Archive
- **Tournaments section:** Card grid of tournaments in this season. "Create Tournament" button → pre-fills league + season on wizard step 1. Click card → tournament hub.
- **Season Confirmations section:** Table: Team Name, Division, Confirmed (yes/no), Confirmed Date, Deadline. Action: manually confirm a team.
- Edit season button (inline form)

## File Upload Component

`components/ImageUpload.tsx`

Props:
- `value: string | null` — current image URL
- `onChange: (url: string | null) => void` — callback with new URL or null (removed)
- `label?: string` — e.g., "Tournament Logo"
- `accept?: string` — MIME types (default: "image/jpeg,image/png,image/webp")
- `maxSize?: number` — bytes (default: 10MB)
- `className?: string`

Behavior:
- Shows placeholder area with upload icon when no image
- Shows image preview when URL exists
- Click or drag-and-drop to select file
- Validates file type and size client-side before upload
- Calls `POST /api/v1/uploads` with multipart form data
- On success: calls `onChange(returnedUrl)`
- "Remove" button: calls `onChange(null)`
- Loading spinner during upload
- Error message on failure

Integration points (update existing forms):
- `TeamForm.tsx` — add logo upload field
- `OrgForm.tsx` — add logo upload field
- `VenueForm.tsx` — add photo and map upload fields
- `PlayerForm.tsx` — add avatar upload field (if form exists)

## Shared Components

### StatusBadge
Props: `status: string`, `type: 'tournament' | 'division' | 'league' | 'season' | 'registration' | 'venue'`
Maps status strings to Badge variants (success/warning/danger/info/default) per entity type.

### TabLayout
Props: `tabs: { id: string; label: string; count?: number }[]`, `activeTab: string`, `onTabChange: (id: string) => void`, `children: React.ReactNode`
Renders horizontal tab bar with active indicator. `count` shows a number badge on the tab. Content area renders children (caller switches content based on activeTab).

### RichTextDisplay
Props: `html: string`
Sanitizes and renders HTML content. Uses `dangerouslySetInnerHTML` with DOMPurify (add as dependency) or a simple allowlist-based sanitizer.

### SponsorEditor
Props: `value: SponsorEntry[]`, `onChange: (sponsors: SponsorEntry[]) => void`
Where `SponsorEntry = { name: string; logo_url: string; link_url: string; tier: string; is_header_sponsor: boolean }`
Inline list editor: add/remove/edit entries. Each entry has: name input, logo (ImageUpload), link URL, tier dropdown (title/presenting/gold/silver/bronze), header sponsor checkbox.

### ScoringPresetPicker
Props: `value: number | null`, `onChange: (presetId: number | null) => void`
Fetches scoring presets from `GET /api/v1/scoring-presets`. Renders Select dropdown with preset names. Shows scoring details on hover/selection (points, win by, best of).

### VenuePicker
Props: `value: number | null`, `onChange: (venueId: number | null) => void`
Searchable dropdown. Fetches from `GET /api/v1/venues?query=...`. Shows venue name + city. Clear button to deselect.

### InfoRow (extracted)
Props: `label: string`, `value: React.ReactNode | string | null | undefined`
Renders `label: value` row with muted label and value. Returns null if value is nullish.
Replaces 5 duplicated local `InfoRow` functions in Phase 1 detail pages.

## API Hooks

### Tournament Hooks (`features/tournaments/hooks.ts`)

```typescript
// Tournaments
useListTournaments(query, status, limit, offset)
useGetTournament(id)
useGetTournamentBySlug(slug)
useCreateTournament()
useUpdateTournament(id)
useDeleteTournament(id)
useUpdateTournamentStatus(id)
useCloneTournament(id)

// Divisions
useListDivisions(tournamentId)
useGetDivision(divisionId)
useCreateDivision(tournamentId)
useUpdateDivision(divisionId)
useDeleteDivision(divisionId)
useUpdateDivisionStatus(divisionId)
useCreateDivisionFromTemplate(tournamentId)

// Registrations
useListRegistrations(divisionId, status, limit, offset)
useCreateRegistration(divisionId)
useUpdateRegistrationStatus(registrationId)
useUpdateRegistrationSeed(registrationId)
useUpdateRegistrationPlacement(registrationId)
useCheckInRegistration(registrationId)
useBulkNoShow(divisionId)
useWithdrawMidTournament(registrationId)
useListSeekingPartner(divisionId)
useUpdateAdminNotes(registrationId)

// Cross-division registrations (tournament-level, client-side aggregation)
// No single backend endpoint exists — frontend fetches divisions, then registrations per division
// and merges into a unified searchable list. Works for typical sizes (5-15 divisions).

// Pods
useListPods(divisionId)
useCreatePod(divisionId)
useUpdatePod(podId)
useDeletePod(podId)

// Announcements (tournament-scoped)
useListTournamentAnnouncements(tournamentId, divisionId)
useCreateTournamentAnnouncement(tournamentId)
useUpdateAnnouncement(announcementId)
useDeleteAnnouncement(announcementId)

// Brackets
useGenerateBracket(divisionId)
useListBracketMatches(divisionId)

// Scoring Presets
useListScoringPresets()
```

### League Hooks (`features/leagues/hooks.ts`)

```typescript
// Leagues
useListLeagues(query, limit, offset)
useGetLeague(id)
useGetLeagueBySlug(slug)
useCreateLeague()
useUpdateLeague(id)
useDeleteLeague(id)
useUpdateLeagueStatus(id)

// Seasons
useListSeasons(leagueId)
useGetSeason(seasonId)
useCreateSeason(leagueId)
useUpdateSeason(seasonId)
useDeleteSeason(seasonId)
useUpdateSeasonStatus(seasonId)

// Division Templates
useListDivisionTemplates(leagueId)
useCreateDivisionTemplate(leagueId)
useUpdateDivisionTemplate(templateId)
useDeleteDivisionTemplate(templateId)

// League Registrations (org-level)
useListLeagueRegistrations(leagueId)
useCreateLeagueRegistration(leagueId)
useUpdateLeagueRegistrationStatus(registrationId)

// Season Confirmations
useListSeasonConfirmations(seasonId)
useConfirmSeason(seasonId)

// Announcements (league-scoped)
useListLeagueAnnouncements(leagueId)
useCreateLeagueAnnouncement(leagueId)
```

### Upload Hook
```typescript
useUploadFile()  // mutation that POSTs multipart form to /api/v1/uploads
```

## Backend API Endpoints Consumed

### Tournaments (~22 endpoints)
- `GET /api/v1/tournaments` — list/search
- `GET /api/v1/tournaments/:id` — get by ID
- `GET /api/v1/tournaments/by-slug/:slug` — get by slug
- `POST /api/v1/tournaments` — create
- `PATCH /api/v1/tournaments/:id` — update
- `DELETE /api/v1/tournaments/:id` — delete
- `PATCH /api/v1/tournaments/:id/status` — update status
- `POST /api/v1/tournaments/:id/clone` — clone

### Divisions (~8 endpoints)
- `GET /api/v1/tournaments/:id/divisions` — list
- `GET /api/v1/tournaments/:id/divisions/:id` — get
- `POST /api/v1/tournaments/:id/divisions` — create
- `PATCH /api/v1/tournaments/:id/divisions/:id` — update
- `DELETE /api/v1/tournaments/:id/divisions/:id` — delete
- `PATCH /api/v1/tournaments/:id/divisions/:id/status` — update status
- `POST /api/v1/tournaments/:id/divisions/from-template` — create from template

### Registrations (~12 endpoints)
- `GET /api/v1/divisions/:id/registrations` — list (with status filter)
- `POST /api/v1/divisions/:id/registrations` — create
- `PATCH /api/v1/divisions/:id/registrations/:id/status` — update status
- `PATCH /api/v1/divisions/:id/registrations/:id/seed` — update seed
- `PATCH /api/v1/divisions/:id/registrations/:id/placement` — update placement
- `PATCH /api/v1/divisions/:id/registrations/:id/admin-notes` — update admin notes
- `POST /api/v1/divisions/:id/registrations/:id/check-in` — check in
- `POST /api/v1/divisions/:id/registrations/bulk-no-show` — bulk no-show
- `POST /api/v1/divisions/:id/registrations/:id/withdraw` — withdraw mid-tournament
- `GET /api/v1/divisions/:id/registrations/seeking-partner` — list seeking partner

### Pods (~4 endpoints)
- `GET /api/v1/divisions/:id/pods` — list
- `POST /api/v1/divisions/:id/pods` — create
- `PATCH /api/v1/divisions/:id/pods/:id` — update
- `DELETE /api/v1/divisions/:id/pods/:id` — delete

### Announcements (~4 endpoints per scope)
- `GET /api/v1/tournaments/:id/announcements` — list
- `POST /api/v1/tournaments/:id/announcements` — create
- `PATCH /api/v1/announcements/:id` — update
- `DELETE /api/v1/announcements/:id` — delete
- Same pattern for league-scoped announcements

### Brackets (~2 endpoints)
- `POST /api/v1/divisions/:id/bracket/generate` — generate
- `GET /api/v1/divisions/:id/matches` — list matches (for bracket display)

### Leagues (~7 endpoints)
- `GET /api/v1/leagues` — list/search
- `GET /api/v1/leagues/:id` — get
- `POST /api/v1/leagues` — create
- `PATCH /api/v1/leagues/:id` — update
- `DELETE /api/v1/leagues/:id` — delete
- `PATCH /api/v1/leagues/:id/status` — update status

### Seasons (~6 endpoints)
- `GET /api/v1/leagues/:id/seasons` — list
- `GET /api/v1/leagues/:id/seasons/:id` — get
- `POST /api/v1/leagues/:id/seasons` — create
- `PATCH /api/v1/leagues/:id/seasons/:id` — update
- `DELETE /api/v1/leagues/:id/seasons/:id` — delete
- `PATCH /api/v1/leagues/:id/seasons/:id/status` — update status

### Division Templates (~4 endpoints)
- `GET /api/v1/leagues/:id/division-templates` — list
- `POST /api/v1/leagues/:id/division-templates` — create
- `PATCH /api/v1/leagues/:id/division-templates/:id` — update
- `DELETE /api/v1/leagues/:id/division-templates/:id` — delete

### League Registrations (~3 endpoints)
- `GET /api/v1/leagues/:id/registrations` — list
- `POST /api/v1/leagues/:id/registrations` — create
- `PATCH /api/v1/leagues/:id/registrations/:id/status` — update status

### Season Confirmations (~2 endpoints)
- `GET /api/v1/leagues/:id/seasons/:id/confirmations` — list
- `POST /api/v1/leagues/:id/seasons/:id/confirmations` — confirm

### Scoring Presets (~1 endpoint)
- `GET /api/v1/scoring-presets` — list all

### Uploads (~1 endpoint)
- `POST /api/v1/uploads` — upload file

**Total: ~76 backend endpoints consumed**

## Error Handling

Same patterns as Phase 1:
- API errors shown via Toast (useToast)
- Form validation errors shown inline (FormField error prop)
- Loading states via Skeleton components
- Empty states via EmptyState component
- ErrorBoundary wraps entire app (from Phase 1)

## Accessibility

- Tab navigation works on TabLayout (arrow keys between tabs)
- Status transition buttons have confirmation dialogs
- Form fields have proper labels and error associations
- Tables support keyboard navigation
- Seed drag-and-drop has keyboard alternative (manual number entry)
- WCAG 2.2 AA compliance target (same as Phase 1)

## Performance

- Route-level code splitting via TanStack Router's `autoCodeSplitting`
- Tournament/League lists paginated (20 per page default)
- Registration tables paginated
- Search inputs debounced (300ms, existing useDebounce hook)
- Bracket display lazy-loaded (only when tab active)
- Image uploads show optimistic preview before server response

## Dependencies

- **DOMPurify** (new) — for sanitizing rich text HTML in descriptions. Small, well-maintained library.
- No other new dependencies.
