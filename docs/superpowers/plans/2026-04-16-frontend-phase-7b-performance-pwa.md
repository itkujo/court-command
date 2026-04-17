# Phase 7B — Performance Optimization + PWA

> **For agentic workers:** Execute tasks in order.

**Goal:** Optimize bundle size, add PWA support with offline banner and install prompt.

---

### Task 1: Bundle analysis

- [ ] Run `pnpm build` and note chunk sizes from output
- [ ] If available, run `npx vite-bundle-visualizer` for visual breakdown
- [ ] Identify any chunk > 50 kB that could be lazy-loaded
- [ ] Document findings in commit message

### Task 2: Lazy loading heavy routes

**Files:** `frontend/src/routes/` — route files for heavy features

- [ ] Verify TanStack Router `autoCodeSplitting: true` is active in `vite.config.ts`
- [ ] Check that admin, overlay, scoring routes are in separate chunks (they should be from file-based routing)
- [ ] If any route imports a heavy component synchronously, convert to `lazy(() => import(...))`
- [ ] Commit

### Task 3: Image optimization

**Files:** Components rendering `<img>`

- [ ] Add `loading="lazy"` to all non-above-fold images (venue photos, sponsor logos, avatar in lists)
- [ ] Verify `ImageUpload` preview uses reasonable max dimensions
- [ ] Add `decoding="async"` to images where appropriate
- [ ] Commit

### Task 4: React.memo for pure display components

**Files:** `frontend/src/components/`

- [ ] Wrap `InfoRow`, `Badge`, `StatusBadge`, `Avatar`, `Skeleton` with `React.memo`
- [ ] Only memo components that receive primitive/stable props and render frequently
- [ ] Do NOT memo components with `children` prop (Card, Modal) — breaks memoization
- [ ] Commit

### Task 5: Query cache tuning

**Files:** Hook files across features

- [ ] Verify list queries use `staleTime: 5 * 60 * 1000` (5 min)
- [ ] Verify live scoring queries use `staleTime: 0` (always fresh from WS)
- [ ] Verify detail queries use `staleTime: 2 * 60 * 1000` (2 min)
- [ ] Add `staleTime` where missing
- [ ] Commit

### Task 6: PWA manifest

**Files:**
- Create: `frontend/public/manifest.json`
- Modify: `frontend/index.html` — add `<link rel="manifest">`

- [ ] Create manifest.json with name, short_name, start_url, display, theme/background colors, icons array
- [ ] Generate PNG icons from existing SVG logos (192x192, 512x512) — or reference SVGs if browser supports
- [ ] Add manifest link to index.html `<head>`
- [ ] Add `<meta name="theme-color">` to index.html
- [ ] Commit

### Task 7: Service Worker via vite-plugin-pwa

**Files:**
- Modify: `frontend/package.json` — add `vite-plugin-pwa` dependency
- Modify: `frontend/vite.config.ts` — add VitePWA plugin config

- [ ] `cd frontend && pnpm add -D vite-plugin-pwa`
- [ ] Add `VitePWA` plugin to vite.config.ts with:
  - `registerType: 'prompt'` (show update prompt)
  - `workbox.runtimeCaching` — network-first for `/api/`, cache-first for static assets
  - `manifest: false` (use the manually created manifest.json)
- [ ] Commit

### Task 8: Offline banner + update prompt

**Files:**
- Create: `frontend/src/hooks/useOnlineStatus.ts`
- Create: `frontend/src/components/OfflineBanner.tsx`
- Create: `frontend/src/components/UpdatePrompt.tsx`
- Modify: `frontend/src/App.tsx` — add both components

`useOnlineStatus`:
```tsx
import { useState, useEffect } from 'react'
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return isOnline
}
```

`OfflineBanner`: fixed-bottom yellow banner "You're offline — some features may be unavailable" with `role="alert"`.

`UpdatePrompt`: uses `useRegisterSW` from `virtual:pwa-register/react` — shows toast "New version available" with Refresh button.

- [ ] Create all 3 files
- [ ] Wire into App.tsx (below ToastProvider, above Router)
- [ ] Commit

### Task 9: Install prompt (A2HS)

**Files:**
- Create: `frontend/src/hooks/useInstallPrompt.ts`
- Create: `frontend/src/components/InstallBanner.tsx`
- Modify: `frontend/src/App.tsx`

Listen for `beforeinstallprompt` event. Show dismissible banner on mobile. Persist dismissal in localStorage (`cc_install_dismissed`).

- [ ] Create hook and component
- [ ] Wire into App.tsx
- [ ] Commit

### Task 10: Final performance verification

- [ ] `pnpm build` — verify bundle < 250 kB gzip for main chunk
- [ ] Run Lighthouse in Chrome DevTools on public landing page
- [ ] Target: Performance > 80, A11y > 90, Best Practices > 90, SEO > 80
- [ ] Document scores in commit message
- [ ] `pnpm tsc -b --noEmit` — must pass
- [ ] Commit
