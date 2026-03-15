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

interface EntryWithChildren {
  id: string
  dates?: { start?: number | null; end?: number; value?: number }[]
  children?: EntryWithChildren[]
}

/** Find the parent entry that contains the given child id in the tree */
function findParentEntry(entries: EntryWithChildren[], childId: string): EntryWithChildren | null {
  for (const e of entries) {
    if (e.children?.some(c => c.id === childId)) return e
    const found = findParentEntry(e.children || [], childId)
    if (found) return found
  }
  return null
}

/** Get event year, falling back to parent's year when event has no dates (e.g. child articles) */
export function getEventYearWithInheritance(
  evt: { id: string; dates?: { start?: number | null; end?: number; value?: number }[] } | null | undefined,
  entries: EntryWithChildren[]
): number | null {
  if (!evt) return null
  const y = getEventYear(evt)
  if (y != null) return y
  let parent = findParentEntry(entries, evt.id)
  while (parent) {
    const py = getEventYear(parent)
    if (py != null) return py
    parent = findParentEntry(entries, parent.id)
  }
  return null
}

/** Parse chapter number from md_path (e.g. "content/03.the-dark-ages/..." → 3) */
export function getChapterFromMdPath(mdPath: string | undefined): number {
  if (!mdPath) return 0
  const m = mdPath.match(/content\/(\d{2})\./)
  return m ? parseInt(m[1], 10) : 0
}

/** Default sim year per chapter when event has no dates. Ensures correct planetary config. */
export function getDefaultSimYearForChapter(chapter: number): number {
  if (chapter <= 1) return -4500  // Before Creation / intro
  if (chapter === 2) return -3600  // Golden Age
  if (chapter === 3) return -2000  // Dark Ages
  if (chapter === 4) return 1053   // The Blip — transition to CE (post-blip)
  return new Date().getFullYear()   // CE chapters (5+)
}

/** Year for planet sim: event year when in range, else chapter-based default. */
export function getEventYearForSim(
  evt: { id?: string; md_path?: string; dates?: { start?: number | null; end?: number; value?: number }[] } | null | undefined,
  entries: EntryWithChildren[] = []
): number {
  const y = evt ? getEventYearWithInheritance(evt, entries) : null
  if (y != null) return y
  const ch = getChapterFromMdPath(evt?.md_path)
  return getDefaultSimYearForChapter(ch)
}

/** Start year for timeline positioning, with chapter fallback when no dates. */
export function getEventStartYearWithFallback(
  evt: { id?: string; md_path?: string; dates?: { start?: number | null; end?: number }[] } | null | undefined,
  entries: EntryWithChildren[] = []
): number | null {
  const s = getEventStartYear(evt)
  if (s != null) return s
  const y = evt ? getEventYearWithInheritance(evt, entries) : null
  if (y != null) return y
  const ch = getChapterFromMdPath(evt?.md_path)
  return getDefaultSimYearForChapter(ch)
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
