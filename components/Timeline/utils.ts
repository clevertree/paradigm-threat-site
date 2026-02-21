/**
 * Convert year (negative = BCE) to Date for vis-timeline.
 * Uses approximate solar year in ms.
 */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export function yearToDate(year: number): Date {
  return new Date(year * MS_PER_YEAR)
}

export function getEventYear(evt: { dates?: { start?: number; value?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  return d.start ?? (d as { value?: number }).value ?? null
}

function formatYear(year: number, _calendar?: string): string {
  const era = year <= 0 ? 'BCE' : 'CE'
  const absYear = Math.abs(year)
  return `${absYear} ${era}`
}

export function formatDateRange(evt: { type?: 'article' | 'event'; dates?: { start?: number; end?: number; calendar?: string; value?: number }[] }): string {
  if (evt.type === 'article') return '—'
  const d = evt.dates?.[0]
  if (!d) return '—'
  const start = d.start ?? (d as { value?: number }).value
  if (start == null) return '—'
  const end = d.end
  const cal = d.calendar
  const startStr = formatYear(start, cal)
  if (end != null && end !== start) {
    return `${startStr} – ${formatYear(end, cal)}`
  }
  return startStr
}
