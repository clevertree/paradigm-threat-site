'use client'

import React from 'react'
import { BrowserView } from './BrowserView'
import { AnimationMapView } from './AnimationMapView'
import { AnimationPlanetView } from './AnimationPlanetView'
import { TimelineArticlePanel } from './TimelineArticlePanel'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { TimelineViewMode } from './constants'

interface TimelineViewContentProps {
  viewMode: TimelineViewMode
  isFullCanvasView: boolean
  selected: TimelineEntry | null
  events: TimelineEntry[]
  entries: TimelineEntry[]
  baseUrl: string
  browserPath: string | null
  ttsIsPlaying: boolean
  ttsCurrentSegmentId: string | null
  onSelectEvent: (entry: TimelineEntry) => void
  handlePlayEvent: (entry: TimelineEntry) => void
  handleStopTTS: () => void
  /** When true, render in a flex-1 container suitable for compact layout; when false, minimal wrapper for desktop right panel */
  compact?: boolean
}

export function TimelineViewContent({
  viewMode,
  isFullCanvasView,
  selected,
  events,
  entries,
  baseUrl,
  browserPath,
  ttsIsPlaying,
  ttsCurrentSegmentId,
  onSelectEvent,
  handlePlayEvent,
  handleStopTTS,
  compact = true,
}: TimelineViewContentProps) {
  const articlePanelProps = {
    events,
    baseUrl,
    selectedId: selected?.id ?? null,
    onSelectEvent,
    ttsIsPlaying: ttsIsPlaying && ttsCurrentSegmentId === selected?.id,
    onPlayEvent: () => selected && (ttsIsPlaying ? handleStopTTS() : handlePlayEvent(selected)),
  }

  const wrapperClass = compact
    ? 'flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden'
    : 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'

  if (viewMode === 'browser') {
    return (
      <div className={wrapperClass} style={compact ? undefined : { minHeight: 0 }}>
        <div className="flex-1 min-h-0 w-full overflow-hidden flex">
          <BrowserView initialPath={browserPath} />
        </div>
      </div>
    )
  }

  if (viewMode === 'animation-map') {
    return (
      <div className={wrapperClass}>
        <div className={compact ? 'relative w-full flex-1 min-h-0' : 'relative w-full h-full'}>
          <AnimationMapView />
        </div>
      </div>
    )
  }

  if (viewMode === 'animation-3d') {
    return (
      <div className={wrapperClass}>
        <div
          className={compact ? 'relative w-full flex-1 min-h-[400px]' : 'relative w-full h-full min-h-[400px]'}
          style={{ minHeight: 400 }}
        >
          <AnimationPlanetView
            selectedEvent={selected}
            entries={entries}
            events={events}
            onSelectEvent={onSelectEvent}
          />
        </div>
      </div>
    )
  }

  if (!isFullCanvasView) {
    return (
      <div className={wrapperClass} style={compact ? undefined : { minHeight: 0 }}>
        <TimelineArticlePanel {...articlePanelProps} />
      </div>
    )
  }

  return null
}
