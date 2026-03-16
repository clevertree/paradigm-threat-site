'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { BookOpen, X } from 'lucide-react'
import { useTimeline } from '@/components/TimelineContext'
import { ListView } from './ListView'
import { VisTimelineView } from './VisTimelineView'
import { TimelineJSView } from './TimelineJSView'
import { CustomTimelineView } from './CustomTimelineView'
import { TTSSlideshowOverlay } from './TTSSlideshowOverlay'
import { AnimationMapView } from './AnimationMapView'
import { AnimationPlanetView } from './AnimationPlanetView'
import { BrowserView } from './BrowserView'
import { TimelineLinkProvider } from './TimelineLinkContext'
import { TimelineCompactLayout } from './TimelineCompactLayout'
import { TimelineDesktopLayout } from './TimelineDesktopLayout'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { EventSelectOption } from './EventSelectDropdown'
import type { TimelineViewMode, ExpansionMode } from './constants'
import { useTimelineUrlState } from './hooks/useTimelineUrlState'
import { useLeftPanelResize } from './hooks/useLeftPanelResize'
import { useTimelineTTS } from './hooks/useTimelineTTS'

export type { TimelineViewMode, ExpansionMode }

export function TimelineView() {
  const { entries, events, loading, error, baseUrl } = useTimeline()
  const {
    fullPage,
    setFullPage,
    viewMode,
    setViewMode,
    onToggleFullscreen,
    browserPath,
    initialEventIdRef,
    updateUrlForEvent,
  } = useTimelineUrlState()

  const [expansionMode, setExpansionMode] = useState<ExpansionMode>('none')
  const [selected, setSelected] = useState<TimelineEntry | null>(null)
  const [showContentDrawer, setShowContentDrawer] = useState(false)
  const showContentDrawerRef = useRef(false)
  useEffect(() => { showContentDrawerRef.current = showContentDrawer }, [showContentDrawer])

  const panelResize = useLeftPanelResize()
  const { containerRef, leftScrollRef, leftPct, isDragging, handleSeparatorMouseDown } = panelResize

  const eventIdToEvent = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events]
  )

  useEffect(() => {
    if (events.length > 0 && selected === null) {
      const urlId = initialEventIdRef.current
      const target = urlId ? (events.find((e) => e.id === urlId) ?? events[0]) : events[0]
      setSelected(target ?? null)
    }
  }, [events, selected, initialEventIdRef])

  const initialScrollDoneRef = useRef(false)

  const {
    tts,
    slideshowOpen,
    slideshowOpenRef,
    handlePlayEvent,
    handleStopTTS,
    handleSeekToSegment,
    handleSlideshowPrev,
    ttsStartIndexRef,
  } = useTimelineTTS({
    events,
    baseUrl,
    setFullPage,
    showContentDrawerRef,
    setShowContentDrawer,
  })

  useEffect(() => {
    if (!fullPage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (slideshowOpenRef.current) return
        setFullPage(false)
        const params = new URLSearchParams(window.location.search)
        params.delete('fullscreen')
        const q = params.toString()
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [fullPage, setFullPage, slideshowOpenRef])

  const handleSelectEvent = useCallback(
    (evt: TimelineEntry) => {
      setSelected(evt)
      updateUrlForEvent(evt)
    },
    [updateUrlForEvent]
  )

  const timelineLinkContextValue = useMemo(
    () => ({
      onTimelineNavigate: (eventId: string) => {
        const entry = eventIdToEvent.get(eventId)
        if (entry) handleSelectEvent(entry)
      },
    }),
    [eventIdToEvent, handleSelectEvent]
  )

  // When TTS auto-advances to a new segment, sync the carousel. Only depend on segment index
  // to avoid re-running when selected/events/segments reference changes (which can cause loops).
  const prevTTSSegRef = useRef(-1)
  const eventsRef = useRef(events)
  const selectedIdRef = useRef(selected?.id ?? null)
  const handleSelectEventRef = useRef(handleSelectEvent)
  eventsRef.current = events
  selectedIdRef.current = selected?.id ?? null
  handleSelectEventRef.current = handleSelectEvent
  useEffect(() => {
    const seg = tts.state.currentSegmentIndex
    if (seg < 0 || seg === prevTTSSegRef.current) return
    prevTTSSegRef.current = seg
    const segments = tts.state.segments
    const event = segments[seg]
    if (!event) return
    const entry = eventsRef.current.find(e => e.id === event.id)
    if (entry && entry.id !== selectedIdRef.current) handleSelectEventRef.current(entry)
    // Omit tts.state.segments to avoid re-run loops when segment list reference changes
  }, [tts.state.currentSegmentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const hierarchicalOptions = useMemo(() => {
    const result: { entry: TimelineEntry; depth: number }[] = []
    function visit(nodes: TimelineEntry[], depth: number) {
      for (const e of nodes) {
        result.push({ entry: e, depth })
        visit(e.children || [], depth + 1)
      }
    }
    visit(entries, 0)
    // Fallback: if entries tree is empty (e.g. during load), use flat events
    if (result.length === 0 && events.length > 0) {
      return events.map((e) => ({ entry: e, depth: 0 }))
    }
    return result
  }, [entries, events])

  // Scroll the left panel to the initially-selected item once on page load.
  // CustomTimelineView expands parent nodes via its own effect, so the target
  // element may not exist in the DOM on the first render pass.  We poll a few
  // times (via rAF) to give the tree time to expand before giving up.
  useEffect(() => {
    if (initialScrollDoneRef.current) return
    if (!selected?.id || !leftScrollRef.current) return
    const container = leftScrollRef.current
    const targetId = selected.id
    let attempts = 0
    const maxAttempts = 15 // ~250 ms at 60 fps — plenty for React to flush

    function tryScroll() {
      if (initialScrollDoneRef.current) return
      const el = container.querySelector<HTMLElement>(`[id="timeline-item-${targetId}"]`)
      if (!el) {
        if (++attempts < maxAttempts) {
          requestAnimationFrame(tryScroll)
        }
        return
      }
      initialScrollDoneRef.current = true
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
        const elTopRelative = elRect.top - containerRect.top + container.scrollTop
        const scrollTop = elTopRelative - container.clientHeight / 2 + el.clientHeight / 2
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
      }
    }

    // Kick off on the next frame so React has a chance to commit the tree
    requestAnimationFrame(tryScroll)
  }, [selected?.id, leftScrollRef])

  if (loading) {
    return (
      <div className="flex flex-col min-[1000px]:flex-row gap-6">
        <div className="flex-1 flex items-center justify-center py-24 text-slate-500">
          Loading timeline…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        Error: {error}
      </div>
    )
  }

  const isFullCanvasView = viewMode === 'animation-map' || viewMode === 'animation-3d' || viewMode === 'browser'
  const ttsCurrentSegmentId = tts.state.segments[tts.state.currentSegmentIndex]?.id ?? null

  const compactLayoutProps = {
    fullPage,
    viewMode,
    expansionMode,
    selected,
    events,
    entries,
    baseUrl,
    browserPath,
    hierarchicalOptions: hierarchicalOptions as EventSelectOption[],
    isFullCanvasView,
    showContentDrawer,
    ttsIsPlaying: tts.state.isPlaying,
    ttsCurrentSegmentId,
    onToggleFullscreen,
    setViewMode,
    setExpansionMode,
    setShowContentDrawer,
    handleSelectEvent,
    handlePlayEvent,
    handleStopTTS,
  }

  const desktopLayoutProps = {
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
    ttsIsPlaying: tts.state.isPlaying,
    ttsCurrentSegmentId,
    onToggleFullscreen,
    setViewMode,
    setExpansionMode,
    handleSeparatorMouseDown,
    handleSelectEvent,
    handlePlayEvent,
    handleStopTTS,
  }

  return (
    <TimelineLinkProvider value={timelineLinkContextValue}>
      <div className={
        fullPage
          ? 'fixed inset-0 z-[110] flex flex-col bg-white dark:bg-slate-950 overflow-hidden p-4 select-none'
          : 'flex flex-col flex-1 min-h-0 w-full overflow-hidden max-h-[80vh] min-h-[80vh] select-none'
      }>
        <TimelineCompactLayout {...compactLayoutProps} />
        <TimelineDesktopLayout {...desktopLayoutProps} />

        {/* TTS Slideshow Overlay */}
        {slideshowOpen && (
          <TTSSlideshowOverlay
            ttsState={tts.state}
            availableVoices={tts.availableVoices}
            availablePiperVoices={tts.availablePiperVoices}
            onPause={tts.pause}
            onNext={tts.next}
            onPrev={handleSlideshowPrev}
            onStop={handleStopTTS}
            onClearError={tts.clearError}
            onSetVoice={tts.setVoice}
            onSetRate={tts.setRate}
            onSetLangFilter={tts.setLangFilter}
            onSetLocalOnly={tts.setLocalOnly}
            onSetSubtitleMode={tts.setSubtitleMode}
            onSetProvider={tts.setProvider}
            onSetPiperVoiceId={tts.setPiperVoiceId}
            onSetPiperLang={tts.setPiperLang}
            onSetQuoteVoiceId={tts.setQuoteVoiceId}
            onSetSpeakerMapInput={tts.setSpeakerMapInput}
            events={events}
            entries={entries}
            baseUrl={baseUrl}
            startEventIndex={ttsStartIndexRef.current}
            onSelectEvent={handleSelectEvent}
            onSeekToSegment={handleSeekToSegment}
            onRestartFromEvent={handlePlayEvent}
            onSwitchToSpeechAndResume={tts.switchToSpeechAndResume}
          />
        )}
      </div>
    </TimelineLinkProvider>
  )
}
