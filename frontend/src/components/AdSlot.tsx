import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { useActiveAds, type AdConfig } from '../features/admin/ad-hooks'

type AdSize =
  | 'leaderboard'       // 728x90
  | 'mobile-banner'     // 320x50
  | 'medium-rectangle'  // 300x250
  | 'skyscraper'        // 160x600
  | 'billboard'         // 970x250
  | 'responsive-banner' // 728x90 desktop, 320x50 mobile

interface AdSlotProps {
  size: AdSize
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
  const { data: ads } = useActiveAds()

  if (size === 'responsive-banner') {
    return (
      <>
        <div className={cn('hidden md:block', className)}>
          <AdRenderer
            width={728}
            height={90}
            sizeLabel="leaderboard"
            slot={slot}
            ads={ads}
          />
        </div>
        <div className={cn('block md:hidden', className)}>
          <AdRenderer
            width={320}
            height={50}
            sizeLabel="mobile-banner"
            slot={slot}
            ads={ads}
          />
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
      <AdRenderer
        width={dims.width}
        height={dims.height}
        sizeLabel={size}
        slot={slot}
        ads={ads}
      />
    </div>
  )
}

interface AdRendererProps {
  width: number
  height: number
  sizeLabel: string
  slot?: string
  ads?: AdConfig[]
}

function AdRenderer({ width, height, sizeLabel, slot, ads }: AdRendererProps) {
  // Filter ads that target this size (or have no size restriction)
  const matchingAds = ads?.filter(ad => {
    if (ad.sizes.length === 0) return true
    return ad.sizes.includes(sizeLabel)
  }) ?? []

  if (matchingAds.length === 0) {
    return <AdPlaceholder width={width} height={height} label={`${AD_DIMENSIONS[sizeLabel as keyof typeof AD_DIMENSIONS]?.label ?? sizeLabel}`} slot={slot} />
  }

  return <AdCarousel ads={matchingAds} width={width} height={height} slot={slot} />
}

interface AdCarouselProps {
  ads: AdConfig[]
  width: number
  height: number
  slot?: string
}

function AdCarousel({ ads, width, height, slot }: AdCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (ads.length <= 1) return

    function scheduleNext() {
      const currentAd = ads[currentIndex % ads.length]
      const durationMs = (currentAd?.display_duration_sec || 8) * 1000
      timerRef.current = setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length)
      }, durationMs)
    }

    scheduleNext()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [ads, currentIndex])

  const ad = ads[currentIndex % ads.length]
  if (!ad) return null

  if (ad.ad_type === 'embed') {
    return (
      <div
        className="mx-auto overflow-hidden rounded-lg"
        style={{ maxWidth: width, minHeight: height }}
        data-ad-slot={slot}
        role="complementary"
        aria-label="Advertisement"
        dangerouslySetInnerHTML={{ __html: ad.embed_code ?? '' }}
      />
    )
  }

  // Image ad
  const content = (
    <div
      className="mx-auto overflow-hidden rounded-lg"
      style={{ maxWidth: width, height }}
      data-ad-slot={slot}
      role="complementary"
      aria-label={ad.alt_text || 'Advertisement'}
    >
      <img
        src={ad.image_url ?? ''}
        alt={ad.alt_text ?? 'Advertisement'}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  )

  if (ad.link_url) {
    return (
      <a
        href={ad.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block"
      >
        {content}
      </a>
    )
  }

  return content
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
