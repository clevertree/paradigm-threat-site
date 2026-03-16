'use client'

import React from 'react'
import { TimelineGalleryProvider } from './TimelineGalleryProvider'
import { MarkdownCarousel } from './MarkdownCarousel'
import type { TimelineEntry } from '@/components/TimelineContext'

interface TimelineArticlePanelProps {
  events: TimelineEntry[]
  baseUrl: string
  selectedId: string | null
  onSelectEvent: (entry: TimelineEntry) => void
  ttsIsPlaying: boolean
  onPlayEvent: () => void
}

export function TimelineArticlePanel({
  events,
  baseUrl,
  selectedId,
  onSelectEvent,
  ttsIsPlaying,
  onPlayEvent,
}: TimelineArticlePanelProps) {
  return (
    <TimelineGalleryProvider
      events={events}
      baseUrl={baseUrl}
      selectedEventId={selectedId}
      onSelectEvent={onSelectEvent}
    >
      <MarkdownCarousel
        events={events}
        baseUrl={baseUrl}
        selectedId={selectedId}
        onSelectEvent={onSelectEvent}
        ttsIsPlaying={ttsIsPlaying}
        onPlayEvent={onPlayEvent}
      />
    </TimelineGalleryProvider>
  )
}
