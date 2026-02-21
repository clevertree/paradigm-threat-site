import { NextResponse } from 'next/server'

const TIMELINE_BASE =
  process.env.NEXT_PUBLIC_TIMELINE_BASE_URL ||
  'https://clevertree.github.io/paradigm-threat-timeline'

function getEventYear(evt: { dates?: { start?: number; value?: number }[] }): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  return d.start ?? (d as { value?: number }).value ?? null
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
  { start: -3147, end: -687, name: 'The Dark Ages' },
  { start: -670, end: 1053, name: 'Iron Age / Blip' },
  { start: 1053, end: 1499, name: 'CE 1053-1499' },
  { start: 1500, end: 1799, name: 'CE 1500-1799' },
  { start: 1800, end: 2100, name: 'CE 1800+' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const maxDepth = Math.min(4, Math.max(1, parseInt(searchParams.get('maxDepth') || '4', 10)))

  try {
    const res = await fetch(`${TIMELINE_BASE}/data/events.json`, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error('Failed to fetch events')
    const data = await res.json()
    const entries = data.entries || []
    type Entry = { id: string; title: string; dates?: { start?: number; end?: number }[] }
    const events = flattenEntries(entries) as Entry[]

    const eraEvents = ERAS.map((e) => ({
      start_date: { year: e.start },
      end_date: { year: e.end },
      text: { headline: e.name },
    }))
    const slideEvents = events
      .map((evt: Entry) => {
        const year = getEventYear(evt)
        if (year == null) return null
        const d = evt.dates?.[0]
        const endYear = d?.end ?? year
        return {
          unique_id: evt.id,
          start_date: { year },
          end_date: endYear !== year ? { year: endYear } : undefined,
          text: { headline: evt.title },
          group: groupForYear(year),
        }
      })
      .filter(Boolean)

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
