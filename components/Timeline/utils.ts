/**
 * Convert year (negative = BCE) to Date for vis-timeline.
 * Uses approximate solar year in ms.
 */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export function yearToDate(year: number): Date {
  return new Date(year * MS_PER_YEAR)
}

/** Sentinel year for unknown start (before creation, undatable). Used for timeline positioning. */
export const UNKNOWN_START_YEAR = -50000

/** Return effective start year for timeline positioning. Uses UNKNOWN_START_YEAR when start is unknown. */
export function getEventStartYear(evt: { dates?: { start?: number | null; end?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  if (d.start != null) return d.start
  if (d.end != null) return UNKNOWN_START_YEAR
  return null
}

export function getEventYear(evt: { dates?: { start?: number | null; end?: number; value?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  const start = d.start ?? (d as { value?: number }).value
  if (start != null) return start
  return d.end ?? null
}

function formatYear(year: number, _calendar?: string): string {
  const era = year <= 0 ? 'BCE' : 'CE'
  const absYear = Math.abs(year)
  return `${absYear} ${era}`
}

export function formatDateRange(evt: { type?: 'article' | 'event'; dates?: { start?: number | null; end?: number; calendar?: string; value?: number; start_label?: string }[] }): string {
  if (evt.type === 'article') return '—'
  const d = evt.dates?.[0]
  if (!d) return '—'
  const start = d.start ?? (d as { value?: number }).value
  const end = d.end
  const cal = d.calendar
  if (start == null && end != null) {
    const label = d.start_label ?? 'unknown'
    return `${label} – ${formatYear(end, cal)}`
  }
  if (start == null) return '—'
  const startStr = formatYear(start, cal)
  if (end != null && end !== start) {
    return `${startStr} – ${formatYear(end, cal)}`
  }
  return startStr
}
