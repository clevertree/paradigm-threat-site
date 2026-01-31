'use client'

import React, { useEffect, useRef } from 'react'
import { useTimeline } from '@/components/TimelineContext'
import { yearToDate, getEventYear } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'
import 'vis-timeline/styles/vis-timeline-graph2d.css'

interface VisTimelineViewProps {
  onSelectEvent: (evt: TimelineEntry) => void
  eventIdToEvent: Map<string, TimelineEntry>
}

function groupForYear(year: number): string {
  if (year < -3000) return 'Before Creation'
  if (year < 0) return 'BCE'
  if (year < 1000) return 'CE 1-999'
  if (year < 1500) return 'CE 1000-1499'
  if (year < 1800) return 'CE 1500-1799'
  return 'CE 1800+'
}

export function VisTimelineView({
  onSelectEvent,
  eventIdToEvent,
}: VisTimelineViewProps) {
  const { events } = useTimeline()
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (!containerRef.current || !events.length) return

    let mounted = true

    Promise.all([import('vis-timeline'), import('vis-data')]).then(([timelineMod, dataMod]) => {
      if (!mounted || !containerRef.current) return
      const { Timeline } = timelineMod
      const { DataSet } = dataMod

      const groupNames = [
        'Before Creation',
        'BCE',
        'CE 1-999',
        'CE 1000-1499',
        'CE 1500-1799',
        'CE 1800+',
      ]
      const groups = new DataSet(groupNames.map((id) => ({ id, content: id })))

      const items = events
        .map((evt) => {
          const year = getEventYear(evt)
          if (year == null) return null
          const d = evt.dates?.[0]
          const endYear = d?.end ?? year
          const start = yearToDate(year)
          const end = yearToDate(endYear)
          return {
            id: evt.id,
            group: groupForYear(year),
            start,
            end,
            content: evt.title,
            className: 'timeline-event-item',
          }
        })
        .filter(Boolean) as {
          id: string
          group: string
          start: Date
          end: Date
          content: string
          className: string
        }[]

      const itemsData = new DataSet(items)

      const years = events.flatMap((e) => {
        const y = getEventYear(e)
        if (y == null) return []
        const end = e.dates?.[0]?.end ?? y
        return [y, end]
      })
      const minYear = years.length ? Math.min(...years, -5000) : -5000
      const maxYear = years.length ? Math.max(...years, 2100) : 2100
      const yearMs = 365.25 * 24 * 60 * 60 * 1000

      const timeline = new Timeline(containerRef.current, itemsData, groups, {
        stack: true,
        verticalScroll: true,
        horizontalScroll: true,
        zoomKey: 'ctrlKey',
        orientation: 'top',
        margin: { item: 5 },
        showCurrentTime: false,
        min: yearToDate(minYear),
        max: yearToDate(maxYear),
        start: yearToDate(minYear),
        end: yearToDate(maxYear),
        timeAxis: { scale: 'year', step: 50 },
        zoomMin: 50 * yearMs,
        zoomMax: (maxYear - minYear) * yearMs,
      })

      timeline.on('select', (props) => {
        const id = props.items?.[0]
        if (id) {
          const evt = eventIdToEvent.get(String(id))
          if (evt) onSelectEvent(evt)
        }
      })

      timelineRef.current = timeline
    })

    return () => {
      mounted = false
      timelineRef.current?.destroy()
      timelineRef.current = null
    }
  }, [events, onSelectEvent, eventIdToEvent])

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={containerRef}
        className="vis-timeline-container border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
        style={{ minHeight: 400 }}
      />
      <p className="mt-2 text-sm text-slate-500">
        Ctrl+scroll to zoom. Click event to view details.
      </p>
    </div>
  )
}
