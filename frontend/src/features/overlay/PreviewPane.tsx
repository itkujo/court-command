// frontend/src/features/overlay/PreviewPane.tsx
//
// Live preview pane for the overlay control panel. Embeds the same
// <OverlayRenderer> that OBS uses, scaled down to fit the available
// width via CSS `transform: scale(...)`. Shares TanStack cache keys
// with the live renderer so edits in the control panel reflect
// immediately without an additional fetch round-trip.
//
// Design notes:
//   - Fixed design resolution: 1920 × 1080 (target broadcast size)
//   - Transparent checkered background mimics the OBS canvas so
//     operators can see the overlay composited on "nothing".
//   - pointer-events: none on the renderer so nested tab controls
//     below remain focusable.
//   - ResizeObserver recomputes scale on every container resize,
//     keeping the preview crisp on tablets, laptops, and ultrawides.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OverlayRenderer } from './OverlayRenderer'

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

export interface PreviewPaneProps {
  slug: string
  /** Optional access token, passed through to OverlayRenderer. */
  token?: string | null
  /** Force demo data regardless of live availability. */
  demo?: boolean
  className?: string
}

export function PreviewPane({ slug, token = null, demo = false, className }: PreviewPaneProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

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

  return (
    <div
      ref={frameRef}
      className={
        'relative w-full overflow-hidden rounded-lg border border-(--color-border) ' +
        'preview-checkered ' +
        (className ?? '')
      }
      // Maintain 16:9 aspect via inline style so the container has
      // deterministic dimensions for the ResizeObserver math above.
      style={{ aspectRatio: '16 / 9' }}
      aria-label="Overlay preview"
    >
      {/* Checkered background (transparency indicator) */}
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

      {/* Scale readout (bottom-right, muted) so operators know what
          they're looking at. */}
      <ScaleReadout scale={scale} />
    </div>
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
