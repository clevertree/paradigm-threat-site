/**
 * Convert year (negative = BCE) to Date for vis-timeline.
 * Uses approximate solar year in ms.
 */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function yearToDate(year: number): Date {
  return new Date(year * MS_PER_YEAR)
}

/** Sentinel year for unknown start (before creation, undatable). Used for timeline positioning. */
export const UNKNOWN_START_YEAR = -50000

/** Phantom / conventional “blip” interval (Fomenko); subtract from BCE→present elapsed counts. */
export const BLIP_SIGNED_START = -670
export const BLIP_SIGNED_END = 1053

/** Overlap of [segmentLo, segmentHi] with the blip interval (inclusive signed years), or null if disjoint. */
function blipOverlapSegment(segmentLo: number, segmentHi: number): { o0: number; o1: number } | null {
  const lo = Math.min(segmentLo, segmentHi)
  const hi = Math.max(segmentLo, segmentHi)
  const o0 = Math.max(lo, BLIP_SIGNED_START)
  const o1 = Math.min(hi, BLIP_SIGNED_END)
  if (o0 > o1) return null
  return { o0, o1 }
}

/**
 * Calendar years from signed `fromSigned` to `refYear` (no year 0; negative = BCE).
 * Returns null if the event lies after `refYear` on the timeline.
 */
export function calendarYearsElapsed(fromSigned: number, refYear: number): number | null {
  if (fromSigned > refYear) return null
  if (fromSigned < 0 && refYear > 0) {
    return Math.abs(fromSigned) + refYear - 1
  }
  return Math.abs(refYear - fromSigned)
}

/**
 * Days elapsed in the same 365.25-day-year model as `yearToDate` / vis-timeline (not civil Gregorian days).
 */
export function approxSolarDaysElapsed(fromSigned: number, nowMs: number): number {
  return Math.round((nowMs - yearToDate(fromSigned).getTime()) / MS_PER_DAY)
}

/**
 * Elapsed label from a signed start year to “now” (calendar years, solar-model days; BCE adjusts for blip).
 */
export function formatElapsedForSignedStart(
  start: number,
  refYear: number,
  nowMs: number
): string | null {
  if (start === UNKNOWN_START_YEAR) return null
  const years = calendarYearsElapsed(start, refYear)
  if (years == null) return null
  let adjYears = years
  let adjDays = approxSolarDaysElapsed(start, nowMs)
  if (adjDays < 0) return null
  let blipNote = ''
  if (start < 0) {
    const overlap = blipOverlapSegment(start, refYear)
    if (overlap) {
      const blipYears = calendarYearsElapsed(overlap.o0, overlap.o1)
      if (blipYears != null && blipYears > 0) {
        adjYears = years - blipYears
        // Match calendar blip span to the solar-year model (365.25 d/y), same as `yearToDate`.
        adjDays -= Math.round(blipYears * (MS_PER_YEAR / MS_PER_DAY))
        blipNote = ' since event (blip omitted)'
      }
    }
  }
  if (adjYears < 0) return null
  if (adjDays < 0) {
    // Blip day deduction uses calendar-years×365.25; raw span uses real `nowMs` vs `yearToDate(start)`.
    // For some BCE dates that span can be shorter than the deduction — align days with adjusted years.
    adjDays = Math.round(adjYears * (MS_PER_YEAR / MS_PER_DAY))
  }
  return `~${adjYears.toLocaleString('en-US')} calendar years · ~${adjDays.toLocaleString('en-US')} days${blipNote}`
}

/**
 * Supplementary label: elapsed calendar years and solar-model days to “now”.
 * Uses explicit start only (not end fallback when start is unknown).
 */
export function formatElapsedSinceStart(
  evt: {
    type?: 'article' | 'event'
    dates?: { start?: number | null; end?: number; calendar?: string; value?: number; start_label?: string }[]
  },
  refYear: number,
  nowMs: number
): string | null {
  if (evt.type === 'article') return null
  const d = evt.dates?.[0]
  if (!d) return null
  const start = d.start ?? (d as { value?: number }).value
  if (start == null || start === UNKNOWN_START_YEAR) return null
  return formatElapsedForSignedStart(start, refYear, nowMs)
}

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
  evt: { id?: string; dates?: { start?: number | null; end?: number; value?: number }[] } | null | undefined,
  entries: EntryWithChildren[]
): number | null {
  if (!evt?.id) return null
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

/** Minimal shape needed for getEventYearWithInheritance in findNearestEventToYear */
type EventWithYear = { id: string; md_path?: string; dates?: { start?: number | null; end?: number; value?: number }[] }

/** Find the event whose year is closest to the given sim year. Uses getEventYearWithInheritance. Returns same element type as input. */
export function findNearestEventToYear<T extends EventWithYear>(
  events: T[],
  year: number,
  entries: EntryWithChildren[] = []
): T | null {
  if (events.length === 0) return null
  let best: T | null = null
  let bestDist = Infinity
  for (const evt of events) {
    const y = getEventYearWithInheritance(evt, entries)
    if (y == null) continue
    const dist = Math.abs(y - year)
    if (dist < bestDist) {
      bestDist = dist
      best = evt
    }
  }
  return best
}

/** Start year for timeline positioning, with chapter fallback when no dates. */
export function getEventStartYearWithFallback(
  evt: { id?: string; md_path?: string; dates?: { start?: number | null; end?: number }[] } | null | undefined,
  entries: EntryWithChildren[] = []
): number | null {
  const s = evt ? getEventStartYear(evt) : null
  if (s != null) return s
  const y = evt ? getEventYearWithInheritance(evt, entries) : null
  if (y != null) return y
  const ch = getChapterFromMdPath(evt?.md_path)
  return getDefaultSimYearForChapter(ch)
}

/**
 * One timeline: signed years only (negative = BCE, positive = CE).
 * Optional `calendar` on event dates is legacy metadata from events.json; era labels always come from the year value.
 */
function formatYear(year: number): string {
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
  if (start == null && end != null) {
    const label = d.start_label ?? 'unknown'
    return `${label} – ${formatYear(end)}`
  }
  if (start == null) return '—'
  const startStr = formatYear(start)
  if (end != null && end !== start) {
    return `${startStr} – ${formatYear(end)}`
  }
  return startStr
}

/**
 * Dropdown only (sub-chapter rows): parenthetical date to prepend before title —
 * `(1814 CE)` for one year, or `(1803 CE – 1815 CE)` when start ≠ end.
 * Empty if no dates[0].start. Caller joins as `${paren} ${title}`.
 */
export function formatDropdownDateParenthetical(evt: {
  dates?: { start?: number | null; end?: number; calendar?: string; value?: number; start_label?: string }[]
}): string {
  const d = evt.dates?.[0]
  if (!d) return ''
  const start = d.start ?? (d as { value?: number }).value
  const end = d.end
  if (start == null) {
    if (end != null) {
      const label = d.start_label ?? '∞'
      return `[${label} – ${formatYear(end)}]`
    }
    return ''
  }
  if (end == null || start === end) {
    return `[${formatYear(start)}]`
  }
  return `[${formatYear(start)} – ${formatYear(end)}]`
}

/**
 * Label for dropdowns / jump lists: prepend formatted date unless the title already
 * starts with that range (H1s are often "1421 CE — Event name", which would duplicate).
 */
export function formatEventLabelWithDate(evt: {
  type?: 'article' | 'event'
  title: string
  dates?: { start?: number | null; end?: number; calendar?: string; value?: number; start_label?: string }[]
}): string {
  if (evt.type === 'article') return evt.title
  const range = formatDateRange(evt)
  const title = evt.title.trim()
  if (range === '—' || !title) return title || range
  if (title.startsWith(range)) {
    const after = title.slice(range.length)
    if (after === '' || /^\s*[—–-]\s/.test(after)) {
      return title
    }
  }
  return `${range} — ${title}`
}
