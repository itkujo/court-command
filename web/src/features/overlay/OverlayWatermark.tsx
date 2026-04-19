// web/src/features/overlay/OverlayWatermark.tsx
//
// Free-tier branding badge. Always rendered on unlicensed overlays so the
// free tier remains distinguishable from paid. Licensed deployments gate
// this component out (see renderer for the conditional).

export interface OverlayWatermarkProps {
  /** Optional extra class names for positioning tweaks in embedded contexts */
  className?: string
}

export function OverlayWatermark({ className }: OverlayWatermarkProps) {
  return (
    <div
      className={
        'absolute bottom-4 right-4 px-3 py-1 bg-black/70 text-white text-xs font-medium tracking-wide rounded-full opacity-70 uppercase z-50 pointer-events-none select-none ' +
        (className ?? '')
      }
      aria-hidden="true"
    >
      Powered By Court Command
    </div>
  )
}
