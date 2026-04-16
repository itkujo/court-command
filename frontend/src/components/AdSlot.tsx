import { cn } from '../lib/cn'

/**
 * Standard IAB ad sizes.
 * These render placeholder containers sized to standard ad dimensions.
 * Replace the placeholder content with your ad network's script/iframe when ready.
 */

type AdSize =
  | 'leaderboard'       // 728x90  — top of pages, desktop
  | 'mobile-banner'     // 320x50  — top of pages, mobile
  | 'medium-rectangle'  // 300x250 — sidebar / inline
  | 'skyscraper'        // 160x600 — sidebar, desktop only
  | 'billboard'         // 970x250 — large top banner
  | 'responsive-banner' // 728x90 desktop, 320x50 mobile (auto-switches)

interface AdSlotProps {
  size: AdSize
  /** Unique slot identifier for ad network targeting */
  slot?: string
  className?: string
}

const AD_DIMENSIONS: Record<Exclude<AdSize, 'responsive-banner'>, { width: number; height: number; label: string }> = {
  leaderboard:       { width: 728, height: 90,  label: '728 x 90' },
  'mobile-banner':   { width: 320, height: 50,  label: '320 x 50' },
  'medium-rectangle':{ width: 300, height: 250, label: '300 x 250' },
  skyscraper:        { width: 160, height: 600, label: '160 x 600' },
  billboard:         { width: 970, height: 250, label: '970 x 250' },
}

export function AdSlot({ size, slot, className }: AdSlotProps) {
  if (size === 'responsive-banner') {
    return (
      <>
        {/* Desktop: leaderboard */}
        <div className={cn('hidden md:block', className)}>
          <AdPlaceholder width={728} height={90} label="728 x 90" slot={slot} />
        </div>
        {/* Mobile: banner */}
        <div className={cn('block md:hidden', className)}>
          <AdPlaceholder width={320} height={50} label="320 x 50" slot={slot} />
        </div>
      </>
    )
  }

  const dims = AD_DIMENSIONS[size]
  const responsiveClass =
    size === 'leaderboard' ? 'hidden md:block' :
    size === 'mobile-banner' ? 'block md:hidden' :
    size === 'skyscraper' ? 'hidden lg:block' :
    undefined

  return (
    <div className={cn(responsiveClass, className)}>
      <AdPlaceholder width={dims.width} height={dims.height} label={dims.label} slot={slot} />
    </div>
  )
}

interface AdPlaceholderProps {
  width: number
  height: number
  label: string
  slot?: string
}

function AdPlaceholder({ width, height, label, slot }: AdPlaceholderProps) {
  return (
    <div
      className="mx-auto flex items-center justify-center rounded-lg border border-dashed border-(--color-border) bg-(--color-bg-secondary)/50 text-(--color-text-secondary) select-none"
      style={{ maxWidth: width, height }}
      data-ad-slot={slot}
      data-ad-size={label}
      role="complementary"
      aria-label="Advertisement"
    >
      <div className="text-center">
        <p className="text-xs font-medium opacity-60">AD</p>
        <p className="text-[10px] opacity-40">{label}</p>
      </div>
    </div>
  )
}
