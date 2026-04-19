# Ghost CMS Integration

## Overview

Integrate Ghost CMS as the content platform for Court Command news. Ghost runs as a standalone site at `news.courtcommand.com` with its own theme. The main Court Command app embeds lightweight news widgets that pull headlines from Ghost's Content API and link out to the news site. Admin users configure the Ghost connection through a settings page.

This is intentionally minimal: Ghost handles all content management, editorial workflow, and article rendering. Court Command only consumes headlines.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  courtcommand.com   │     │ news.courtcommand.com │
│  (React SPA)        │     │ (Ghost 5)             │
│                     │     │                       │
│  ┌───────────────┐  │     │  Casper fork theme    │
│  │ NewsWidget    │──┼──GET──▶ Content API        │
│  │ (3 placements)│  │  /ghost/api/content/posts  │
│  └───────────────┘  │     │                       │
│                     │     │  cms.courtcommand.com  │
│  ┌───────────────┐  │     │  (Ghost Admin)        │
│  │ Admin Settings│  │     └──────────────────────┘
│  │ ghost_url     │  │
│  │ ghost_api_key │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Go Backend    │  │
│  │ site_settings │  │
│  │ table (PG)    │  │
│  └───────────────┘  │
└─────────────────────┘
```

**Data flow:**
1. Admin saves Ghost URL + Content API key in Court Command admin panel
2. Frontend fetches config from `GET /api/settings/ghost` (public, read-only)
3. Frontend calls Ghost Content API directly (no backend proxy) to fetch posts
4. Posts render as compact headline cards linking to `news.courtcommand.com`

## 1. Backend — Site Settings

### Database

New migration: `site_settings` table.

```sql
CREATE TABLE site_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with empty defaults
INSERT INTO site_settings (key, value) VALUES
    ('ghost_url', ''),
    ('ghost_content_api_key', '');
```

Key-value design allows adding future settings without schema changes. No SQLC models needed for this — raw queries are fine given the simplicity (2 rows, 2 queries).

### API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/settings` | Admin | Get all settings (key-value pairs) |
| `PUT` | `/api/admin/settings` | Admin | Update one or more settings |
| `GET` | `/api/settings/ghost` | Public | Get ghost_url + ghost_content_api_key only |

**`GET /api/admin/settings`** — returns all rows from `site_settings`:
```json
{
  "settings": {
    "ghost_url": "https://news.courtcommand.com",
    "ghost_content_api_key": "abc123..."
  }
}
```

**`PUT /api/admin/settings`** — accepts partial updates:
```json
{
  "ghost_url": "https://news.courtcommand.com",
  "ghost_content_api_key": "abc123..."
}
```
Validates: keys must exist in `site_settings`. Returns updated settings object.

**`GET /api/settings/ghost`** — public endpoint, returns only Ghost-related keys:
```json
{
  "ghost_url": "https://news.courtcommand.com",
  "ghost_content_api_key": "abc123..."
}
```
Returns empty strings if not configured (widgets handle this gracefully).

### File Structure

```
backend/
  service/settings.go          # SettingsService: Get, GetByKey, Update
  handler/settings.go          # HTTP handlers for 3 endpoints
  db/migrations/00039_create_site_settings.sql
```

Follow existing patterns:
- Service returns `*ValidationError` for unknown keys
- Handlers use `response.Success(w, data)` and `response.HandleServiceError(w, err)`
- Admin routes registered under `r.Route("/api/admin/settings", ...)` with `session.RequireAdmin` middleware
- Public route at `r.Get("/api/settings/ghost", ...)`

## 2. Frontend — Admin Settings Page

### Route

New route: `/admin/settings` (admin-only).

### Component

`AdminSettingsPage.tsx` — simple form with two fields:

- **Ghost URL** — text input, placeholder: `https://news.courtcommand.com`
- **Ghost Content API Key** — text input (not password — Content API keys are public)
- **Save** button

Uses existing patterns:
- `useQuery` to fetch current settings on load
- `useMutation` to save, with `toast('success', 'Settings saved')` on success
- Loading state: skeleton form
- Error state: error banner with retry

### Navigation

Add "Settings" link to admin sidebar/nav (last item, below existing admin pages).

## 3. Frontend — News Widgets

### Hooks

**`useGhostConfig()`**
- Calls `GET /api/settings/ghost`
- TanStack Query: `staleTime: 5 * 60 * 1000` (5 minutes)
- Returns `{ ghostUrl, apiKey, isConfigured }` where `isConfigured = ghostUrl !== '' && apiKey !== ''`

**`useGhostPosts({ tag?, limit, enabled })`**
- Depends on `useGhostConfig()` — disabled when Ghost not configured
- Calls Ghost Content API: `GET {ghostUrl}/ghost/api/content/posts/?key={apiKey}&limit={limit}&include=tags&filter=tag:{tag}`
- When no tag filter: omit `filter` param (fetches all posts)
- TanStack Query: `staleTime: 2 * 60 * 1000` (2 minutes)
- Returns `{ posts, isLoading, isError }`

### NewsWidget Component

Single reusable component with props:
```typescript
interface NewsWidgetProps {
  title: string
  tag?: string           // Ghost tag slug to filter by (omit for all posts)
  limit?: number         // Default: 3
  viewAllUrl?: string    // Link for "View all →"
  emptyMessage?: string  // Default: "No news articles yet"
}
```

**Rendering:**
- Header row: title (left) + "View all →" link (right)
- List of compact cards, each with:
  - Thumbnail image (left, small square, `feature_image` from Ghost)
  - Headline (right, 2-line clamp, links to article on `news.courtcommand.com`)
  - Category tag badge (cyan `#22d3ee` on dark)
  - Relative timestamp ("2h ago", "3d ago")
- Each card links to `{ghostUrl}/{post.slug}` in a new tab

**States:**
- **Loading:** 3 skeleton cards (pulse animation)
- **Error:** "Unable to load news" with subtle retry link
- **Empty:** Icon + `emptyMessage` text
- **Not configured:** Component renders nothing (hidden entirely — no broken state for non-admin users)

### File Structure

```
frontend/src/
  hooks/useGhostConfig.ts
  hooks/useGhostPosts.ts
  components/NewsWidget.tsx
  routes/admin/settings.tsx     # AdminSettingsPage
```

## 4. Widget Placements

### 4a. Public Homepage

- Location: right column, alongside "Upcoming Tournaments"
- Widget config: `title="Latest News"`, `limit={3}`, no tag filter, `viewAllUrl="https://news.courtcommand.com"`
- Visible to all visitors (logged out included)

### 4b. Dashboard (Logged In)

- Location: bottom row, two widgets side by side
- Left: `title="Tournament News"`, `tag="tournament-news"`, `limit={3}`, `viewAllUrl="https://news.courtcommand.com/tag/tournament-news"`
- Right: `title="League Updates"`, `tag="league-updates"`, `limit={3}`, `viewAllUrl="https://news.courtcommand.com/tag/league-updates"`

### 4c. Player Profile Pages

- Location: right column, above Tournament History section
- Widget config: `title="Player Headlines"`, `tag="player-{slug}"`, `limit={3}`, `emptyMessage="No articles mentioning this player yet"`
- Tag convention: writers tag articles with `player-{slug}` in Ghost to associate with a player

## 5. Ghost Deployment — Docker

### Development (docker-compose.yml)

Add Ghost service:

```yaml
ghost:
  image: ghost:5
  ports:
    - "2368:2368"
  environment:
    url: http://localhost:2368
    database__client: sqlite3
    database__connection__filename: /var/lib/ghost/content/data/ghost.db
  volumes:
    - ghost_content:/var/lib/ghost/content
```

Add `ghost_content` to the `volumes:` section. No profile — Ghost starts with default `docker compose up` alongside db and redis.

### Production (Coolify)

Single Ghost service at `news.courtcommand.com`:
- Ghost Admin accessed via `news.courtcommand.com/ghost` (built-in path, no separate subdomain needed)
- Writers/editors bookmark `news.courtcommand.com/ghost` for content management
- Ghost uses MySQL in production (Coolify provides managed MySQL or use SQLite for simplicity)
- Persistent volume for `/var/lib/ghost/content`

Configuration in Coolify:
- `url: https://news.courtcommand.com`
- Mail settings for author invites (SMTP via Coolify env vars)

Note: `cms.courtcommand.com` is not needed — Ghost Admin is always at `{url}/ghost`.

## 6. Ghost Theme — Casper Fork

Fork Ghost's default Casper theme. Minimal changes — only add shared navigation chrome.

### New Partials

| File | Purpose |
|------|---------|
| `partials/cc-sidebar.hbs` | Left sidebar (desktop only): Court Command nav matching main app |
| `partials/cc-header.hbs` | Top header bar: CC logo + "Court Command **News**" |
| `partials/cc-bottom-nav.hbs` | Bottom nav (mobile only): matches PublicBottomTabs |
| `partials/cc-category-tabs.hbs` | Category filter tabs/pills below header |

### Layout Changes

**`default.hbs`** — override to wrap content:
- Desktop: sidebar (240px, fixed left) + main content area (fluid)
- Mobile: header + category pills + content + bottom nav (no sidebar)

### Styles

**`assets/css/cc-nav.css`** — all navigation chrome styling:
- Sidebar: `background: #0f172a`, nav items in `#94a3b8`, active item in `#22d3ee`
- Header: `background: #0f172a`, logo + "Court Command News" with cyan accent
- Bottom nav: `background: #0f172a`, 5 icons matching PublicBottomTabs
- Category tabs (desktop): horizontal row below header — "All Stories", "Tournament News", "Player Spotlight", "League Updates"
- Category pills (mobile): horizontally scrollable, compact pill buttons

**All article/content styling remains stock Casper.** The article area stays light-themed — Ghost's editorial design is good and doesn't need customization.

### Navigation Items

Sidebar / bottom nav items (links back to main app):
- Home → `courtcommand.com`
- Tournaments → `courtcommand.com/tournaments`
- Leagues → `courtcommand.com/leagues`
- **News** → `news.courtcommand.com` (active/highlighted)
- Players → `courtcommand.com/players`

### Theme Deployment

Theme lives in the Court Command repo under `ghost-theme/`. Built and uploaded to Ghost via Ghost Admin (Themes → Upload). Can be automated later with Ghost's Theme API.

```
ghost-theme/
  package.json
  default.hbs
  index.hbs              # stock Casper
  post.hbs               # stock Casper
  partials/
    cc-sidebar.hbs
    cc-header.hbs
    cc-bottom-nav.hbs
    cc-category-tabs.hbs
  assets/
    css/cc-nav.css
```

## 7. Main App Navigation Changes

### Desktop Sidebar

Add "News" link to the public left sidebar navigation. External link to `https://news.courtcommand.com`. Opens in new tab. Position: after "Leagues", before "Players" (or wherever feels natural in the existing order).

### Mobile Bottom Tabs

`PublicBottomTabs.tsx` already has a "News" tab linking to `https://news.courtcommand.com`. No change needed — just verify it works correctly.

## Non-Goals

- No server-side rendering of Ghost content inside Court Command
- No backend proxy for Ghost API calls
- No custom article page in the React app
- No user comments or social features on articles
- No Ghost membership/subscription features
- No automated theme deployment (manual upload for now)
- No search within news from the main app

## Success Criteria

1. Ghost running in Docker (dev) and Coolify (production)
2. Admin can configure Ghost URL + API key in Court Command admin panel
3. News widgets appear on homepage, dashboard, and player profiles
4. Widgets show loading/error/empty states correctly
5. Widgets hidden gracefully when Ghost is not configured
6. Ghost theme shows Court Command navigation chrome
7. Navigation between main app and news site feels cohesive
8. All existing tests pass, no regressions
