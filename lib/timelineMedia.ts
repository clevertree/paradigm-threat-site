/**
 * Normalizes timeline events.json `media[]` entries (string legacy or { path, bookIllustration? }).
 */

export function timelineMediaPath (entry: unknown): string {
  if (typeof entry === 'string') {
    const s = entry.trim()
    if (!s) return ''
    return s.startsWith('/') ? s : `/${s.replace(/^\//, '')}`
  }
  if (entry && typeof entry === 'object' && 'path' in entry) {
    const p = (entry as { path?: unknown }).path
    if (typeof p !== 'string' || !p.trim()) return ''
    return p.startsWith('/') ? p : `/${p.replace(/^\//, '')}`
  }
  return ''
}

/** True when build-events marked this asset as print/book-only (skip TTS fullscreen slideshow). */
export function isTimelineBookIllustrationMedia (entry: unknown): boolean {
  if (entry === null || typeof entry !== 'object') return false
  return (entry as { bookIllustration?: boolean }).bookIllustration === true
}

/** First media path suitable for social/OG preview (skips book-only figures). */
export function firstTimelineOgMediaPath (media: unknown[] | undefined): string | undefined {
  if (!media?.length) return undefined
  for (const m of media) {
    const path = timelineMediaPath(m)
    if (path && !isTimelineBookIllustrationMedia(m)) return path
  }
  const fallback = timelineMediaPath(media[0])
  return fallback || undefined
}
