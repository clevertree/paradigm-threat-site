'use client'

import React, { useState, useMemo } from 'react'
import { useTimeline } from '@/components/TimelineContext'
import { EventCard } from './EventCard'
import type { TimelineEntry } from '@/components/TimelineContext'

function getYear(evt: TimelineEntry): number | null {
  const d = evt.dates?.[0]
  if (!d) return null
  return d.start ?? (d as { value?: number }).value
}

interface ListViewProps {
  onSelectEvent: (evt: TimelineEntry) => void
  selectedId?: string | null
}

export function ListView({ onSelectEvent, selectedId }: ListViewProps) {
  const { events } = useTimeline()

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const ya = getYear(a)
      const yb = getYear(b)
      if (ya == null && yb == null) return 0
      if (ya == null) return 1
      if (yb == null) return -1
      return ya - yb
    })
  }, [events])

  const filtered = useMemo(() => sorted, [sorted])

  return (
    <div className="min-w-0">
      <div className="space-y-2 pr-2">
        {filtered.map((evt) => (
          <EventCard key={evt.id} event={evt} onSelect={onSelectEvent} isSelected={selectedId === evt.id} />
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500 flex-shrink-0">
        {filtered.length} of {events.length} events
      </p>
    </div>
  )
}
