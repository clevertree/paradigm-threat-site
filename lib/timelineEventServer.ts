/**
 * Server-side timeline event lookup for metadata (OG, title).
 */

const TIMELINE_BASE =
  process.env.NEXT_PUBLIC_TIMELINE_BASE_URL ||
  'https://clevertree.github.io/paradigm-threat-timeline'

interface TimelineEntry {
  id: string
  title: string
  media?: string[]
  children?: TimelineEntry[]
}

function flattenEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = []
  function visit(nodes: TimelineEntry[]) {
    for (const e of nodes) {
      result.push(e)
      if (e.children?.length) visit(e.children)
    }
  }
  visit(entries)
  return result
}

export interface TimelineEventMeta {
  title: string
  ogImageUrl?: string
}

export async function getTimelineEventMeta(eventId: string): Promise<TimelineEventMeta | null> {
  try {
    const res = await fetch(`${TIMELINE_BASE}/data/events.json`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    const entries = (data.entries || []) as TimelineEntry[]
    const events = flattenEntries(entries)
    const event = events.find((e) => e.id === eventId)
    if (!event) return null

    const ogImageUrl = event.media?.[0]
      ? `${TIMELINE_BASE.replace(/\/$/, '')}${event.media[0].startsWith('/') ? '' : '/'}${event.media[0]}`
      : undefined

    return {
      title: event.title,
      ogImageUrl
    }
  } catch {
    return null
  }
}
