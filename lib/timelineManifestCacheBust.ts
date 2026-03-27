/**
 * 60-second URL bucket for timeline `data/events.json` and root `index.json`.
 * Aligns with FilesProvider’s index.json busting so CDN / HTTP cache / Workbox
 * are less likely to serve stale manifests in the PWA.
 */
export function timelineManifestCacheQuery(): string {
  return `?v=${Math.floor(Date.now() / 60000)}`
}
