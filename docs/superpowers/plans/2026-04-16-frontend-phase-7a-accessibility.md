# Phase 7A — Accessibility Audit + Fixes

> **For agentic workers:** Execute tasks in order. Each task is a focused fix area.

**Goal:** Achieve WCAG 2.2 AA compliance across all frontend surfaces.

---

### Task 1: Audit — Run axe-core on major page types

**Files:** None created — this is an investigation task.

- [ ] Start dev server (`cd frontend && pnpm dev`)
- [ ] Open each major route in Chrome DevTools with axe-core extension
- [ ] Document findings per page in a scratch file or commit message
- [ ] Prioritize: Critical > Serious > Moderate

Pages to audit: `/login`, `/register`, `/players`, `/players/:id`, `/teams`, `/teams/:id`, `/organizations`, `/tournaments`, `/tournaments/:id`, `/leagues`, `/leagues/:id`, `/ref`, `/ref/matches/:id`, `/scorekeeper/matches/:id`, `/matches/:id`, `/overlay/court/:slug/settings`, `/admin`, `/dashboard`, `/` (public landing)

### Task 2: Clickable non-button elements — add keyboard handlers

**Files to check and fix:**
- `frontend/src/components/Card.tsx` — if `onClick` prop present, add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
- `frontend/src/components/Table.tsx` — if `onRowClick` prop, add `tabIndex={0}`, `onKeyDown`, `role="button"` to `<tr>`
- Any `<div onClick>` patterns in feature components (search with grep for `onClick` on non-button elements)

Pattern for keyboard handler:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onClick?.()
  }
}}
```

- [ ] Fix Card.tsx
- [ ] Fix Table.tsx
- [ ] Grep for other `<div onClick` / `<span onClick` patterns and fix
- [ ] Verify: tab to element, press Enter/Space — action fires
- [ ] Commit

### Task 3: Modal focus management verification

**Files:** `frontend/src/components/Modal.tsx`

- [ ] Verify Modal uses `<dialog>` element with `showModal()` — this natively traps focus
- [ ] Verify Escape closes the modal
- [ ] Verify focus returns to trigger element on close (if not, add `useRef` to capture trigger and restore)
- [ ] Verify ConfirmDialog inherits these behaviors
- [ ] Fix if any gaps found
- [ ] Commit

### Task 4: Form label association

**Files:** All form components across features

- [ ] Grep for `<input` / `<select` / `<textarea` without `id` + matching `<label htmlFor>`
- [ ] Verify FormField component associates label correctly
- [ ] Add `aria-label` to any icon-only inputs (search bars, etc.)
- [ ] Verify SearchInput and SearchModal have proper labels
- [ ] Commit

### Task 5: Error announcements

**Files:** Form components with validation

- [ ] Verify form validation errors use `role="alert"` or `aria-live="polite"`
- [ ] Check: login, register, tournament create wizard, team/org/venue forms, overlay settings
- [ ] Add `aria-live="polite"` to error message containers if missing
- [ ] Commit

### Task 6: Image alt text

**Files:** Components that render `<img>` tags

- [ ] Grep for `<img` across all frontend files
- [ ] Ensure meaningful `alt` on content images (logos, avatars, venue photos)
- [ ] Ensure `alt=""` on decorative images
- [ ] Add `loading="lazy"` to non-critical images (venue photos, sponsor logos)
- [ ] Commit

### Task 7: Color contrast verification

- [ ] Check CSS custom properties in `frontend/src/styles.css` — verify text/bg combinations meet 4.5:1
- [ ] Pay special attention to: `--color-text-muted` on `--color-bg-primary`, `--color-text-secondary` on `--color-bg-secondary`
- [ ] Check Badge component hardcoded dark: colors (known Phase 1 issue)
- [ ] Fix any failing combinations by adjusting token values
- [ ] Commit

### Task 8: Skip-to-content + landmark verification

**Files:** `frontend/src/routes/__root.tsx`, `frontend/src/components/Sidebar.tsx`

- [ ] Verify skip-to-content link targets `id="main-content"` on the `<main>` element
- [ ] Verify `<nav>` landmark on sidebar
- [ ] Verify `<main>` landmark on content area
- [ ] Add `aria-label` to nav if multiple nav elements exist
- [ ] Commit

### Task 9: Final a11y verification

- [ ] Re-run axe-core on 3 key pages: public landing, ref console, admin panel
- [ ] Confirm 0 Critical, 0 Serious
- [ ] Document any remaining Moderate/Minor in commit message
- [ ] Commit all fixes
- [ ] `pnpm tsc -b --noEmit && pnpm build` — must pass
