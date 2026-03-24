/** index.json file entries may include `_updated` (ISO 8601 UTC from generate-index). */

export function parseIndexUpdated(iso: unknown): Date | null {
  if (typeof iso !== 'string' || !iso.trim()) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getIndexUpdatedTime(iso: unknown): number {
  const d = parseIndexUpdated(iso)
  return d ? d.getTime() : 0
}

/** Short locale date for compact index rows (folder listings, default AutoIndex). */
export function formatIndexDateTiny(iso: unknown): string | null {
  const d = parseIndexUpdated(iso)
  if (!d) return null
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export interface IndexDateBlogParts {
  weekday: string
  day: string
  monthYear: string
}

/** Larger blog-style date block (local calendar). */
export function formatIndexDateBlogParts(iso: unknown): IndexDateBlogParts | null {
  const d = parseIndexUpdated(iso)
  if (!d) return null
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(d.getDate()),
    monthYear: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
  }
}
