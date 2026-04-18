interface StreamEmbedProps {
  url: string
  type: string | null
  title?: string | null
  isLive?: boolean
  className?: string
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function extractTwitchChannel(url: string): string | null {
  const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
  return m ? m[1] : null
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? m[1] : null
}

export function StreamEmbed({ url, type, title, isLive, className }: StreamEmbedProps) {
  const streamType = type ?? detectStreamType(url)

  const containerClass = `relative w-full aspect-video rounded-lg overflow-hidden bg-black ${className ?? ''}`

  if (streamType === 'youtube') {
    const videoId = extractYouTubeId(url)
    if (!videoId) return <FallbackEmbed url={url} className={containerClass} />
    return (
      <div className={containerClass}>
        {isLive && <LiveBadge />}
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`}
          title={title ?? 'YouTube stream'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
  }

  if (streamType === 'twitch') {
    const channel = extractTwitchChannel(url)
    if (!channel) return <FallbackEmbed url={url} className={containerClass} />
    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    return (
      <div className={containerClass}>
        {isLive && <LiveBadge />}
        <iframe
          src={`https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`}
          title={title ?? 'Twitch stream'}
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
  }

  if (streamType === 'vimeo') {
    const videoId = extractVimeoId(url)
    if (!videoId) return <FallbackEmbed url={url} className={containerClass} />
    return (
      <div className={containerClass}>
        {isLive && <LiveBadge />}
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1`}
          title={title ?? 'Vimeo stream'}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
  }

  if (streamType === 'hls') {
    return (
      <div className={containerClass}>
        {isLive && <LiveBadge />}
        <HLSPlayer url={url} title={title} />
      </div>
    )
  }

  // Fallback: generic iframe
  return <FallbackEmbed url={url} className={containerClass} />
}

function LiveBadge() {
  return (
    <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
      LIVE
    </span>
  )
}

function FallbackEmbed({ url, className }: { url: string; className: string }) {
  return (
    <div className={className}>
      <iframe
        src={url}
        title="Live stream"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

function HLSPlayer({ url, title }: { url: string; title?: string | null }) {
  // Use native HLS support (Safari) or suggest hls.js
  return (
    <video
      src={url}
      autoPlay
      muted
      controls
      playsInline
      title={title ?? 'HLS stream'}
      className="absolute inset-0 w-full h-full object-contain"
    >
      Your browser does not support HLS playback.
    </video>
  )
}

function detectStreamType(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/twitch\.tv/.test(url)) return 'twitch'
  if (/vimeo\.com/.test(url)) return 'vimeo'
  if (/\.m3u8/.test(url)) return 'hls'
  return 'other'
}
