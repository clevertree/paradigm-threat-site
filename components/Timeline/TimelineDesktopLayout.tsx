'use client'

import React, { RefObject } from 'react'
import { BrowserView } from './BrowserView'
import { ListView } from './ListView'
import { VisTimelineView } from './VisTimelineView'
import { TimelineJSView } from './TimelineJSView'
import { CustomTimelineView } from './CustomTimelineView'
import { AnimationMapView } from './AnimationMapView'
import { AnimationPlanetView } from './AnimationPlanetView'
import { ViewModeSelect } from './ViewModeSelect'
import { DocDownloadMenu } from './DocDownloadMenu'
import { TTSPlayButton } from './TTSPlayButton'
import { TimelineArticlePanel } from './TimelineArticlePanel'
import { MIN_LEFT_PCT, MAX_LEFT_PCT } from './constants'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { TimelineViewMode, ExpansionMode } from './constants'

export interface TimelineDesktopLayoutProps {
  fullPage: boolean
  viewMode: TimelineViewMode
  expansionMode: ExpansionMode
  selected: TimelineEntry | null
  events: TimelineEntry[]
  entries: TimelineEntry[]
  baseUrl: string
  browserPath: string | null
  eventIdToEvent: Map<string, TimelineEntry>
  containerRef: RefObject<HTMLDivElement | null>
  leftScrollRef: RefObject<HTMLDivElement | null>
  leftPct: number
  isDragging: boolean
  ttsIsPlaying: boolean
  ttsCurrentSegmentId: string | null
  onToggleFullscreen: () => void
  setViewMode: (mode: TimelineViewMode) => void
  setExpansionMode: (value: React.SetStateAction<ExpansionMode>) => void
  handleSeparatorMouseDown: (e: React.MouseEvent) => void
  handleSelectEvent: (entry: TimelineEntry) => void
  handlePlayEvent: (entry: TimelineEntry) => void
  handleStopTTS: () => void
}

export function TimelineDesktopLayout({
  fullPage,
  viewMode,
  expansionMode,
  selected,
  events,
  entries,
  baseUrl,
  browserPath,
  eventIdToEvent,
  containerRef,
  leftScrollRef,
  leftPct,
  isDragging,
  ttsIsPlaying,
  ttsCurrentSegmentId,
  onToggleFullscreen,
  setViewMode,
  setExpansionMode,
  handleSeparatorMouseDown,
  handleSelectEvent,
  handlePlayEvent,
  handleStopTTS,
}: TimelineDesktopLayoutProps) {
  const articlePanelProps = {
    events,
    baseUrl,
    selectedId: selected?.id ?? null,
    onSelectEvent: handleSelectEvent,
    ttsIsPlaying: ttsIsPlaying && ttsCurrentSegmentId === selected?.id,
    onPlayEvent: () => selected && (ttsIsPlaying ? handleStopTTS() : handlePlayEvent(selected)),
  }

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-h-0 w-full overflow-hidden hidden ${fullPage ? 'sm:flex' : ''}`}
      style={{ minHeight: 0 }}
    >
      {viewMode === 'browser' && (
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold">Alternate Earth History Timeline</h2>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              {fullPage ? 'Exit full page' : 'Full page'}
            </button>
            <ViewModeSelect value={viewMode} onChange={setViewMode} />
          </div>
          <div className="flex-1 min-h-0 w-full overflow-hidden flex">
            <BrowserView initialPath={browserPath} />
          </div>
        </div>
      )}

      {viewMode !== 'browser' && (
        <>
          <div
            data-left-panel
            className="flex flex-col flex-shrink-0 min-h-0 overflow-hidden"
            style={{ width: `${leftPct}%`, minWidth: 200 }}
          >
            <div className="flex flex-wrap items-center gap-4 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Alternate Earth History Timeline</h2>
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  {fullPage ? 'Exit full page' : 'Full page'}
                </button>
                <TTSPlayButton
                  isPlaying={ttsIsPlaying}
                  onPlay={() => selected && handlePlayEvent(selected)}
                  onStop={handleStopTTS}
                />
                <DocDownloadMenu baseUrl={baseUrl} />
              </div>
              {viewMode === 'custom' && (
                <button
                  type="button"
                  onClick={() => setExpansionMode((m) => (m === 'all' ? 'none' : 'all'))}
                  className="rounded border px-2 py-1 text-sm transition-colors border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {expansionMode === 'all' ? 'Collapse all' : 'Expand all'}
                </button>
              )}
              <ViewModeSelect value={viewMode} onChange={setViewMode} />
            </div>
            <div
              ref={leftScrollRef}
              className="flex-1 min-h-0 w-full overflow-y-scroll overflow-x-hidden overscroll-contain touch-pan-y"
              style={{ flex: '1 1 0', minHeight: 0, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {viewMode === 'list' && (
                <ListView onSelectEvent={handleSelectEvent} selectedId={selected?.id} />
              )}
              {viewMode === 'vis' && (
                <VisTimelineView onSelectEvent={handleSelectEvent} eventIdToEvent={eventIdToEvent} />
              )}
              {viewMode === 'timelinejs' && (
                <TimelineJSView onSelectEvent={handleSelectEvent} eventIdToEvent={eventIdToEvent} />
              )}
              {viewMode === 'custom' && (
                <CustomTimelineView
                  expansionMode={expansionMode}
                  onSelectEvent={handleSelectEvent}
                  selectedId={selected?.id}
                />
              )}
              {viewMode === 'animation-map' && (
                <div className="relative w-full h-full">
                  <AnimationMapView />
                </div>
              )}
              {viewMode === 'animation-3d' && (
                <div className="relative w-full h-full min-h-[400px]" style={{ minHeight: 400 }}>
                  <AnimationPlanetView
                    selectedEvent={selected}
                    entries={entries}
                    events={events}
                    onSelectEvent={handleSelectEvent}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            role="slider"
            aria-orientation="vertical"
            aria-valuemin={MIN_LEFT_PCT}
            aria-valuemax={MAX_LEFT_PCT}
            aria-valuenow={leftPct}
            aria-label="Resize panels"
            onMouseDown={handleSeparatorMouseDown}
            className={`flex-shrink-0 w-1 flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-col-resize select-none border-0 p-0 ${isDragging ? 'bg-slate-400 dark:bg-slate-500' : ''}`}
          >
            <span className="w-0.5 h-8 bg-slate-400 dark:bg-slate-500 rounded-full block" aria-hidden />
          </button>

          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
            <TimelineArticlePanel {...articlePanelProps} />
          </div>
        </>
      )}
    </div>
  )
}
