// web/src/features/overlay/PreviewPane.tsx
//
// Live preview pane for the overlay control panel. Embeds the same
// <OverlayRenderer> that OBS uses, scaled down to fit the available
// width via CSS `transform: scale(...)`. Shares TanStack cache keys
// with the live renderer so edits in the control panel reflect
// immediately without an additional fetch round-trip.
//
// Design notes:
//   - Fixed design resolution: 1920 × 1080 (target broadcast size)
//   - Backdrop cycles through transparent (checkered) → black → white
//     so operators can sanity-check contrast against any expected
//     broadcast background.
//   - pointer-events: none on the renderer so nested tab controls
//     below remain focusable.
//   - ResizeObserver recomputes scale on every container resize,
//     keeping the preview crisp on tablets, laptops, and ultrawides.

import { Contrast, FlaskConical } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OverlayRenderer } from './OverlayRenderer'

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

type PreviewBackdrop = 'transparent' | 'black' | 'white'
const BACKDROP_ORDER: PreviewBackdrop[] = ['transparent', 'black', 'white']
const BACKDROP_LABEL: Record<PreviewBackdrop, string> = {
  transparent: 'Transparent',
  black: 'Black',
  white: 'White',
}

export interface PreviewPaneProps {
  slug: string
  /** Optional access token, passed through to OverlayRenderer. */
  token?: string | null
  /**
   * Default demo-data state. Caller can force it on; otherwise the
   * preview starts from whatever the local sessionStorage toggle
   * says and can be flipped via the in-pane DemoToggle pill.
   * Scope is preview-only — live OBS output is untouched.
   */
  demo?: boolean
  className?: string
}

export function PreviewPane({ slug, token = null, demo: demoProp = false, className }: PreviewPaneProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [backdrop, setBackdrop] = useBackdrop(slug)
  const [demo, setDemo] = useDemoMode(slug, demoProp)

  // Recompute scale on mount + on every container resize.
  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const recompute = () => {
      const w = frame.clientWidth
      const h = frame.clientHeight
      if (w <= 0 || h <= 0) return
      const sx = w / DESIGN_WIDTH
      const sy = h / DESIGN_HEIGHT
      // Use the smaller scale so the 1920×1080 design fully fits
      // the available area without cropping either dimension.
      setScale(Math.max(0.05, Math.min(sx, sy)))
    }

    recompute()

    const ro = new ResizeObserver(recompute)
    ro.observe(frame)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [])

  const cycleBackdrop = () => {
    const next = BACKDROP_ORDER[(BACKDROP_ORDER.indexOf(backdrop) + 1) % BACKDROP_ORDER.length]
    setBackdrop(next)
  }

  const toggleDemo = () => setDemo(!demo)

  return (
    <div
      ref={frameRef}
      data-overlay-preview="true"
      data-overlay-backdrop={backdrop}
      className={
        'relative w-full overflow-hidden rounded-lg border border-(--color-border) ' +
        (backdrop === 'transparent' ? 'preview-checkered ' : '') +
        (className ?? '')
      }
      style={backdropStyle(backdrop)}
      aria-label="Overlay preview"
    >
      {/* Checkered background CSS (only used for the transparent mode,
          but safe to keep mounted — selector is class-scoped). */}
      <PreviewCheckerStyle />

      {/* The 1920×1080 "virtual" canvas, scaled via CSS transform. */}
      <div
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* fullscreen={false} prevents the renderer from mutating
            document.body styles — critical for the control-panel page
            which still needs its normal chrome. */}
        <OverlayRenderer
          slug={slug}
          token={token}
          demo={demo}
          fullscreen={false}
        />
      </div>

      {/* Controls cluster (top-right, small, always visible). */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <DemoToggle demo={demo} onToggle={toggleDemo} />
        <BackdropToggle backdrop={backdrop} onCycle={cycleBackdrop} />
      </div>

      {/* Scale readout (bottom-right, muted) so operators know what
          they're looking at. */}
      <ScaleReadout scale={scale} />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Backdrop persistence. Stored in sessionStorage per-slug so operators can
// flip backgrounds for one court without affecting the rest.
// -----------------------------------------------------------------------------

function useBackdrop(slug: string) {
  const storageKey = `cc:overlay:preview-backdrop:${slug}`
  const [backdrop, setBackdrop] = useState<PreviewBackdrop>(() => {
    if (typeof window === 'undefined') return 'transparent'
    const raw = window.sessionStorage.getItem(storageKey)
    if (raw === 'black' || raw === 'white' || raw === 'transparent') return raw
    return 'transparent'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(storageKey, backdrop)
  }, [storageKey, backdrop])

  return [backdrop, setBackdrop] as const
}

function backdropStyle(backdrop: PreviewBackdrop): React.CSSProperties {
  switch (backdrop) {
    case 'black':
      return { backgroundColor: '#000000', backgroundImage: 'none' }
    case 'white':
      return { backgroundColor: '#ffffff', backgroundImage: 'none' }
    case 'transparent':
    default:
      // .preview-checkered class supplies the background.
      return {}
  }
}

function BackdropToggle({
  backdrop,
  onCycle,
}: {
  backdrop: PreviewBackdrop
  onCycle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      className={
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded ' +
        'bg-black/60 text-white/90 hover:bg-black/75 hover:text-white ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) transition-colors'
      }
      aria-label={`Preview backdrop: ${BACKDROP_LABEL[backdrop]} — click to cycle`}
      title={`Backdrop: ${BACKDROP_LABEL[backdrop]} (click to cycle)`}
    >
      <Contrast size={12} />
      <span>{BACKDROP_LABEL[backdrop]}</span>
    </button>
  )
}

// -----------------------------------------------------------------------------
// Demo-data toggle. Preview-only; does NOT affect live OBS output.
// sessionStorage key is per-slug so turning on demo for one court doesn't
// cross-contaminate others. Default off unless caller forces it via props.
// -----------------------------------------------------------------------------

function useDemoMode(slug: string, fallback: boolean) {
  const storageKey = `cc:overlay:preview-demo:${slug}`
  const [demo, setDemo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return fallback
    const raw = window.sessionStorage.getItem(storageKey)
    if (raw === '1') return true
    if (raw === '0') return false
    return fallback
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(storageKey, demo ? '1' : '0')
  }, [storageKey, demo])

  return [demo, setDemo] as const
}

function DemoToggle({ demo, onToggle }: { demo: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={demo}
      className={
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) transition-colors ' +
        (demo
          ? 'bg-amber-500/90 text-black hover:bg-amber-400 '
          : 'bg-black/60 text-white/90 hover:bg-black/75 hover:text-white ')
      }
      aria-label={demo ? 'Demo data enabled — click to show live match data' : 'Live match data — click to switch preview to demo data'}
      title={demo ? 'Demo data (preview only) — click for live' : 'Live data — click for demo preview'}
    >
      <FlaskConical size={12} />
      <span>{demo ? 'Demo' : 'Live'}</span>
    </button>
  )
}

// Small helper component — injects the checkered-background CSS once.
// Kept inline instead of in index.css so this feature stays portable.
function PreviewCheckerStyle() {
  // Inline <style> is a no-op after the first render (React dedupes by
  // ownership) but React 19 still warns about multiple <style> with the
  // same content — guarded by a static `id`.
  return (
    <style>{`
      .preview-checkered {
        background-color: #1a1a1a;
        background-image:
          linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
          linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
          linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
        background-size: 24px 24px;
        background-position: 0 0, 0 12px, 12px -12px, -12px 0;
      }
    `}</style>
  )
}

function ScaleReadout({ scale }: { scale: number }) {
  const [hidden, setHidden] = useState(false)
  // Fade the readout after 2s so it doesn't distract during editing.
  useEffect(() => {
    const t = window.setTimeout(() => setHidden(true), 2000)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div
      className={
        'absolute bottom-2 right-2 px-2 py-0.5 text-xs font-medium rounded ' +
        'bg-black/60 text-white/80 transition-opacity duration-500 ' +
        (hidden ? 'opacity-0' : 'opacity-100')
      }
      aria-hidden="true"
    >
      {Math.round(scale * 100)}%
    </div>
  )
}
