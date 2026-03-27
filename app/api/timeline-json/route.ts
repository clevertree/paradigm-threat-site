import { NextResponse } from 'next/server'
import { timelineManifestCacheQuery } from '@/lib/timelineManifestCacheBust'

const TIMELINE_BASE =
  process.env.NEXT_PUBLIC_TIMELINE_BASE_URL ||
  'https://clevertree.github.io/paradigm-threat-timeline'

const UNKNOWN_START_YEAR = -50000

function getEventYear(evt: { dates?: { start?: number | null; end?: number; value?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  const start = d.start ?? (d as { value?: number }).value
  if (start != null) return start
  return d.end ?? null
}

function getEventStartYear(evt: { dates?: { start?: number | null; end?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  if (d.start != null) return d.start
  if (d.end != null) return UNKNOWN_START_YEAR
  return null
}

function flattenEntries(entries: { children?: unknown[] }[]): object[] {
  const result: object[] = []
  function visit(nodes: { children?: unknown[] }[]) {
    for (const e of nodes) {
      result.push(e)
      visit((e.children as { children?: unknown[] }[]) || [])
    }
  }
  visit(entries)
  return result
}

function groupForYear(year: number): string {
  if (year < -3000) return 'Before Creation'
  if (year < 0) return 'BCE'
  if (year < 1000) return 'CE 1-999'
  if (year < 1500) return 'CE 1000-1499'
  if (year < 1800) return 'CE 1500-1799'
  return 'CE 1800+'
}

const ERAS = [
  { start: -5000, end: -4078, name: 'Before Creation' },
  { start: -4077, end: -3148, name: 'The Golden Age' },
  { start: -3147, end: -670, name: 'The Dark Ages' },
  { start: -670, end: 1053, name: 'Iron Age / Blip' },
  { start: 1053, end: 1499, name: 'CE 1053-1499' },
  { start: 1500, end: 1799, name: 'CE 1500-1799' },
  { start: 1800, end: 2100, name: 'CE 1800+' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const maxDepth = Math.min(4, Math.max(1, parseInt(searchParams.get('maxDepth') || '4', 10)))

  try {
    const res = await fetch(`${TIMELINE_BASE}/data/events.json${timelineManifestCacheQuery()}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error('Failed to fetch events')
    const data = await res.json()
    const entries = data.entries || []
    type Entry = { id: string; title: string; md_path?: string; dates?: { start?: number | null; end?: number }[] }
    const events = flattenEntries(entries) as Entry[]

    const eraEvents = ERAS.map((e) => ({
      start_date: { year: e.start },
      end_date: { year: e.end },
      text: { headline: e.name },
    }))
    const candidates = events
      .map((evt: Entry) => {
        const startYear = getEventStartYear(evt)
        const endYear = evt.dates?.[0]?.end ?? getEventYear(evt)
        if (startYear == null && endYear == null) return null
        const year = endYear ?? startYear!
        return {
          unique_id: evt.id,
          md_path: evt.md_path,
          start_date: { year: startYear ?? year },
          end_date: endYear != null && endYear !== (startYear ?? year) ? { year: endYear } : undefined,
          text: { headline: evt.title },
          group: groupForYear(year),
          _startYear: startYear ?? year,
        }
      })
      .filter(Boolean) as { unique_id: string; md_path?: string; start_date: { year: number }; end_date?: { year: number }; text: { headline: string }; group: string; _startYear: number }[]

    // Deduplicate by md_path: keep one event per article (earliest start year)
    const byPath = new Map<string, typeof candidates[0]>()
    for (const c of candidates) {
      const key = c.md_path || c.unique_id
      const existing = byPath.get(key)
      if (!existing || c._startYear < existing._startYear) {
        byPath.set(key, c)
      }
    }
    const slideEvents = Array.from(byPath.values()).map(({ _startYear, ...rest }) => rest)

    const json = {
      scale: 'cosmological',
      title: { text: { headline: 'Alternate Earth History Timeline', text: '' } },
      eras: eraEvents,
      events: slideEvents,
    }

    return NextResponse.json(json, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to build timeline' }, { status: 500 })
  }
}
