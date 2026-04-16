// frontend/src/features/scoring/feedback.ts

/**
 * Trigger short haptic vibration if supported and enabled.
 */
export function vibrate(durationMs = 50): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(durationMs)
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) {
    audioCtx = new Ctor()
  }
  return audioCtx
}

/**
 * Play a short synthesized tick (~80–120ms) at a given frequency.
 * Frequencies tuned: 880 Hz for point, 660 Hz for side-out, 440 Hz for undo.
 */
export function playTick(
  variant: 'point' | 'side_out' | 'undo' | 'error' = 'point',
): void {
  const ctx = getAudioContext()
  if (!ctx) return
  // Resume if browser suspended
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* ignore */
    })
  }

  const freq =
    variant === 'point'
      ? 880
      : variant === 'side_out'
        ? 660
        : variant === 'undo'
          ? 440
          : 220

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = freq
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  // Quick attack + decay envelope to avoid clicks
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

  oscillator.start(now)
  oscillator.stop(now + 0.12)
}
