'use client'

import React from 'react'
import { BookOpen, X } from 'lucide-react'
import { EventSelectDropdown } from './EventSelectDropdown'
import { ViewModeSelect } from './ViewModeSelect'
import { DocDownloadMenu } from './DocDownloadMenu'
import { TTSPlayButton } from './TTSPlayButton'
import { TimelineArticlePanel } from './TimelineArticlePanel'
import { TimelineViewContent } from './TimelineViewContent'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { TimelineViewMode, ExpansionMode } from './constants'
import type { EventSelectOption } from './EventSelectDropdown'

export interface TimelineCompactLayoutProps {
  fullPage: boolean
  viewMode: TimelineViewMode
  expansionMode: ExpansionMode
  selected: TimelineEntry | null
  events: TimelineEntry[]
  entries: TimelineEntry[]
  baseUrl: string
  browserPath: string | null
  hierarchicalOptions: EventSelectOption[]
  isFullCanvasView: boolean
  showContentDrawer: boolean
  ttsIsPlaying: boolean
  ttsCurrentSegmentId: string | null
  onToggleFullscreen: () => void
  setViewMode: (mode: TimelineViewMode) => void
  setExpansionMode: (value: React.SetStateAction<ExpansionMode>) => void
  setShowContentDrawer: (value: boolean) => void
  handleSelectEvent: (entry: TimelineEntry) => void
  handlePlayEvent: (entry: TimelineEntry) => void
  handleStopTTS: () => void
}

export function TimelineCompactLayout({
  fullPage,
  viewMode,
  expansionMode,
  selected,
  events,
  entries,
  baseUrl,
  browserPath,
  hierarchicalOptions,
  isFullCanvasView,
  showContentDrawer,
  ttsIsPlaying,
  ttsCurrentSegmentId,
  onToggleFullscreen,
  setViewMode,
  setExpansionMode,
  setShowContentDrawer,
  handleSelectEvent,
  handlePlayEvent,
  handleStopTTS,
}: TimelineCompactLayoutProps) {
  const articlePanelProps = {
    events,
    baseUrl,
    selectedId: selected?.id ?? null,
    onSelectEvent: handleSelectEvent,
    ttsIsPlaying: ttsIsPlaying && ttsCurrentSegmentId === selected?.id,
    onPlayEvent: () => selected && (ttsIsPlaying ? handleStopTTS() : handlePlayEvent(selected)),
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${fullPage ? 'sm:hidden' : ''}`}>
      <div className={`flex-shrink-0 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 ${fullPage ? 'space-y-2' : ''}`}>
        <div className="flex items-center gap-2">
          <EventSelectDropdown
            options={hierarchicalOptions}
            value={selected?.id ?? (events[0]?.id ?? '')}
            onChange={(id) => {
              const evt = events.find((x) => x.id === id)
              if (evt) handleSelectEvent(evt)
            }}
          />
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {fullPage ? 'Exit' : 'Full page'}
          </button>
          <DocDownloadMenu baseUrl={baseUrl} buttonVariant="compact" />
        </div>
        {fullPage && (
          <div className="flex items-center gap-2 flex-wrap">
            <ViewModeSelect
              value={viewMode}
              onChange={setViewMode}
              selectClassName="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
            />
            {viewMode === 'custom' && (
              <button
                type="button"
                onClick={() => setExpansionMode((m) => (m === 'all' ? 'none' : 'all'))}
                className="rounded border px-2 py-1 text-xs transition-colors border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {expansionMode === 'all' ? 'Collapse' : 'Expand'}
              </button>
            )}
            <TTSPlayButton
              isPlaying={ttsIsPlaying}
              onPlay={() => selected && handlePlayEvent(selected)}
              onStop={handleStopTTS}
            />
            <DocDownloadMenu baseUrl={baseUrl} />
            {isFullCanvasView && (
              <button
                type="button"
                title="Show article content"
                onClick={() => {
                  setShowContentDrawer(true)
                  window.history.pushState({ contentDrawer: true }, '')
                }}
                className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <BookOpen size={14} /> Content
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        <TimelineViewContent
          viewMode={viewMode}
          isFullCanvasView={isFullCanvasView}
          selected={selected}
          events={events}
          entries={entries}
          baseUrl={baseUrl}
          browserPath={browserPath}
          ttsIsPlaying={ttsIsPlaying}
          ttsCurrentSegmentId={ttsCurrentSegmentId}
          onSelectEvent={handleSelectEvent}
          handlePlayEvent={handlePlayEvent}
          handleStopTTS={handleStopTTS}
          compact
        />
      </div>
      {fullPage && showContentDrawer && (
        <div className="absolute inset-0 z-[120] flex flex-col bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <EventSelectDropdown
              options={hierarchicalOptions}
              value={selected?.id ?? ''}
              onChange={(id) => {
                const evt = events.find((x) => x.id === id)
                if (evt) handleSelectEvent(evt)
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowContentDrawer(false)
              }}
              className="shrink-0 rounded border border-slate-300 dark:border-slate-600 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TimelineArticlePanel {...articlePanelProps} />
          </div>
        </div>
      )}
    </div>
  )
}
