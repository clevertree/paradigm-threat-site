'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Play, Square, FileDown, FileText, BookOpen, X, ChevronDown } from 'lucide-react'
import { useTimeline } from '@/components/TimelineContext'
import { ListView } from './ListView'
import { VisTimelineView } from './VisTimelineView'
import { TimelineJSView } from './TimelineJSView'
import { CustomTimelineView } from './CustomTimelineView'
import { MarkdownCarousel } from './MarkdownCarousel'
import { TimelineGalleryProvider } from './TimelineGalleryProvider'
import { TTSSlideshowOverlay } from './TTSSlideshowOverlay'
import { AnimationMapView } from './AnimationMapView'
import { AnimationPlanetView } from './AnimationPlanetView'
import { BrowserView } from './BrowserView'
import { TimelineLinkProvider } from './TimelineLinkContext'
import { formatDateRange } from './utils'
import { useTTS } from '@/lib/hooks/useTTS'
import { stripMarkdownForTTS } from './ttsHelpers'
import type { TimelineEntry } from '@/components/TimelineContext'

const STORAGE_KEY = 'paradigm-threat-timeline-left-panel-pct'
const DEFAULT_LEFT_PCT = 35
const MIN_LEFT_PCT = 20
const MAX_LEFT_PCT = 50

export type TimelineViewMode = 'list' | 'vis' | 'timelinejs' | 'custom' | 'animation-map' | 'animation-3d' | 'browser'

const VIEW_LABELS: Record<TimelineViewMode, string> = {
  list: 'List',
  vis: 'vis-timeline',
  timelinejs: 'TimelineJS',
  custom: 'Custom',
  'animation-map': 'Map (CE)',
  'animation-3d': 'Planets (BC)',
  browser: 'Browser',
}

export type ExpansionMode = 'all' | 'none'


function getStoredLeftPct(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v == null) return null
    const n = parseInt(v, 10)
    if (Number.isNaN(n) || n < MIN_LEFT_PCT || n > MAX_LEFT_PCT) return null
    return n
  } catch {
    return null
  }
}

export function TimelineView() {
  const { entries, events, loading, error, baseUrl } = useTimeline()
  const [fullPage, setFullPage] = useState(false)
  const initialEventIdRef = useRef<string | null>(null)
  const [browserPath, setBrowserPath] = useState<string | null>(null)

  // Read ?fullscreen=1, ?view=<mode>, and event id from URL on mount
  // Supports both /timeline/<eventId> and /timeline?event=<eventId>
  // Also supports ?view=browser&path=... for deep linking to the file browser
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fullscreen') === '1') setFullPage(true)
    // Restore view mode from URL
    const viewParam = params.get('view') as TimelineViewMode | null
    const validViews: TimelineViewMode[] = ['list', 'vis', 'timelinejs', 'custom', 'animation-map', 'animation-3d', 'browser']
    if (viewParam && validViews.includes(viewParam)) {
      setViewModeRaw(viewParam)
      // Deep link to browser mode with optional path
      if (viewParam === 'browser') {
        setFullPage(true)
        const p = params.get('path')
        if (p) setBrowserPath(p)
      }
    }
    // Prefer path-based event ID: /timeline/<eventId>
    const pathMatch = window.location.pathname.match(/^\/timeline\/(.+)$/)
    const evtId = pathMatch ? decodeURIComponent(pathMatch[1]) : params.get('event')
    if (evtId) initialEventIdRef.current = evtId
  }, [])

  useEffect(() => {
    if (!fullPage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If slideshow is open, let the overlay's own Escape handler close it;
        // don't also exit fullscreen.
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
  }, [fullPage])

  const onToggleFullscreen = useCallback(() => {
    setFullPage((p) => {
      const next = !p
      const params = new URLSearchParams(window.location.search)
      if (next) {
        params.set('fullscreen', '1')
        const q = params.toString()
        window.history.pushState({ fullscreen: true }, '', window.location.pathname + (q ? '?' + q : ''))
      } else {
        params.delete('fullscreen')
        const q = params.toString()
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
      }
      return next
    })
  }, [])
  const [viewMode, setViewModeRaw] = useState<TimelineViewMode>('custom')
  const setViewMode = useCallback((mode: TimelineViewMode) => {
    setViewModeRaw(mode)
    const params = new URLSearchParams(window.location.search)
    // Persist the view mode in the URL (use 'custom' as default — omit it)
    if (mode === 'custom') {
      params.delete('view')
    } else {
      params.set('view', mode)
    }
    // When switching to browser, auto-enter fullscreen
    if (mode === 'browser') {
      setFullPage(true)
      params.set('fullscreen', '1')
    } else {
      // Clean up browser-specific params
      params.delete('path')
    }
    const q = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
  }, [])
  const [expansionMode, setExpansionMode] = useState<ExpansionMode>('none')
  const [selected, setSelected] = useState<TimelineEntry | null>(null)
  const [leftPct, setLeftPct] = useState<number>(DEFAULT_LEFT_PCT)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showContentDrawer, setShowContentDrawer] = useState(false)
  const showContentDrawerRef = useRef(false)
  useEffect(() => { showContentDrawerRef.current = showContentDrawer }, [showContentDrawer])
  const [docMenuOpen, setDocMenuOpen] = useState(false)
  const docMenuRef = useRef<HTMLDivElement>(null)

  // Close doc dropdown on outside click
  useEffect(() => {
    if (!docMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as Node)) {
        setDocMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [docMenuOpen])

  const docDropdownLinks = [
    { label: 'Book PDF', href: `${baseUrl}/export/timeline-book.pdf` },
    { label: 'Appendix PDF', href: `${baseUrl}/export/timeline-appendix.pdf` },
    { label: 'Book (Google Docs)', href: 'https://docs.google.com/document/d/1nLm73Z-xCyQKOkNLQwH3hFia6H4Me3FW' },
    { label: 'Appendix (Google Docs)', href: 'https://docs.google.com/document/d/1vyxQlF7xjQtKX6xLyxpZWZzdJv6X-3tx' },
  ]

  const eventIdToEvent = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events]
  )

  useEffect(() => {
    const stored = getStoredLeftPct()
    if (stored != null) setLeftPct(stored)
  }, [])

  useEffect(() => {
    if (events.length > 0 && selected === null) {
      const urlId = initialEventIdRef.current
      const target = urlId ? (events.find((e) => e.id === urlId) ?? events[0]) : events[0]
      setSelected(target ?? null)
    }
  }, [events, selected])

  const leftScrollRef = useRef<HTMLDivElement>(null)
  const initialScrollDoneRef = useRef(false)

  // ── TTS ──────────────────────────────────────────────────────────────
  const tts = useTTS()
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  // Track slideshowOpen in a ref so the Escape handler always sees the latest value
  const slideshowOpenRef = useRef(false)
  useEffect(() => { slideshowOpenRef.current = slideshowOpen }, [slideshowOpen])
  const ttsStartIndexRef = useRef(0)

  /** Build TTS segments from a start event through all remaining events */
  const buildSegments = useCallback((startEntry: TimelineEntry) => {
    const startIdx = events.findIndex(e => e.id === startEntry.id)
    if (startIdx < 0) return []
    return events.slice(startIdx).map(evt => ({
      id: evt.id,
      title: evt.title,
      fetchText: async () => {
        try {
          const res = await fetch(`${baseUrl}/${evt.md_path}`)
          const text = res.ok ? await res.text() : ''
          return stripMarkdownForTTS(text, evt.title)
        } catch { return evt.title }
      },
    }))
  }, [events, baseUrl])

  const handlePlayEvent = useCallback((entry: TimelineEntry) => {
    const idx = events.findIndex(e => e.id === entry.id)
    ttsStartIndexRef.current = idx >= 0 ? idx : 0
    tts.play(buildSegments(entry), 0)
    setSlideshowOpen(true)
    // Push a history entry so the browser back button can close the slideshow
    window.history.pushState({ slideshowOpen: true }, '')
  }, [events, tts, buildSegments])

  const handleStopTTS = useCallback(() => {
    tts.stop()
    tts.clearError()
    setSlideshowOpen(false)
  }, [tts])

  // Handle browser back button: close slideshow, then content drawer, then exit fullscreen
  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      if (slideshowOpenRef.current) {
        tts.stop()
        tts.clearError()
        setSlideshowOpen(false)
      } else if (showContentDrawerRef.current) {
        setShowContentDrawer(false)
      } else {
        setFullPage(false)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [tts])

  /** Jump to an already-loaded segment without rebuilding the segment list */
  const handleSeekToSegment = useCallback((segmentIndex: number) => {
    const segments = tts.state.segments
    if (segmentIndex < 0 || segmentIndex >= segments.length) return
    tts.play(segments, segmentIndex)
  }, [tts])

  // Stop TTS when the component unmounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { tts.stop() }, [])
  // ─────────────────────────────────────────────────────────────────────

  const handleSelectEvent = useCallback((evt: TimelineEntry) => {
    setSelected(evt)
    const params = new URLSearchParams(window.location.search)
    params.delete('event') // clean up legacy query param if present
    const q = params.toString()
    window.history.replaceState(null, '', `/timeline/${evt.id}` + (q ? '?' + q : ''))
  }, [])

  const timelineLinkContextValue = useMemo(
    () => ({
      onTimelineNavigate: (eventId: string) => {
        const entry = eventIdToEvent.get(eventId)
        if (entry) handleSelectEvent(entry)
      },
    }),
    [eventIdToEvent, handleSelectEvent]
  )

  // When TTS auto-advances to a new segment, sync the carousel
  const prevTTSSegRef = useRef(-1)
  useEffect(() => {
    const seg = tts.state.currentSegmentIndex
    if (seg < 0 || seg === prevTTSSegRef.current) return
    prevTTSSegRef.current = seg
    const event = tts.state.segments[seg]
    if (!event) return
    const entry = events.find(e => e.id === event.id)
    if (entry && entry.id !== selected?.id) handleSelectEvent(entry)
  }, [tts.state.currentSegmentIndex, tts.state.segments, events, selected, handleSelectEvent])

  const handleSeparatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const lastPctRef = useRef(leftPct)

  useEffect(() => {
    lastPctRef.current = leftPct
  }, [leftPct])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.round((x / rect.width) * 100)
      const clamped = Math.max(MIN_LEFT_PCT, Math.min(MAX_LEFT_PCT, pct))
      lastPctRef.current = clamped
      setLeftPct(clamped)
    }
    const onUp = () => {
      setIsDragging(false)
      try {
        localStorage.setItem(STORAGE_KEY, String(lastPctRef.current))
      } catch {
        // ignore
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

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
  }, [selected?.id])

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

  // Whether the current view is a full-canvas view (animation/browser) that shouldn't show carousel inline
  const isFullCanvasView = viewMode === 'animation-map' || viewMode === 'animation-3d' || viewMode === 'browser'

  return (
    <TimelineLinkProvider value={timelineLinkContextValue}>
    <div className={
      fullPage
        ? 'fixed inset-0 z-[110] flex flex-col bg-white dark:bg-slate-950 overflow-hidden p-4 select-none'
        : 'flex flex-col flex-1 min-h-0 w-full overflow-hidden max-h-[80vh] min-h-[80vh] select-none'
    }>
      {/* ══════════ COMPACT / MOBILE LAYOUT ══════════
           Shown: always when NOT fullscreen
           Shown: in fullscreen when viewport < sm (640px)
           Below sm: just show article, no sidebar */}
      <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${fullPage ? 'sm:hidden' : ''}`}>
        <div className={`flex-shrink-0 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 ${fullPage ? 'space-y-2' : ''}`}>
          <div className="flex items-center gap-2">
            <select
              id="timeline-event-select"
              value={selected?.id ?? (events[0]?.id ?? '')}
              onChange={(e) => {
                const evt = events.find((x) => x.id === e.target.value)
                if (evt) handleSelectEvent(evt)
              }}
              className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {hierarchicalOptions.map(({ entry: evt, depth }) => {
                const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth)
                const label = evt.type === 'article' ? evt.title : `${formatDateRange(evt)} — ${evt.title}`
                return (
                  <option key={evt.id} value={evt.id}>
                    {indent}{label}
                  </option>
                )
              })}
            </select>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {fullPage ? 'Exit' : 'Full page'}
            </button>
            <div className="relative" ref={!fullPage ? docMenuRef : undefined}>
              <button
                type="button"
                onClick={() => setDocMenuOpen(o => !o)}
                className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                title="Download documents"
              >
                <FileDown size={14} /> <ChevronDown size={12} />
              </button>
              {docMenuOpen && !fullPage && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1">
                  {docDropdownLinks.map(link => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setDocMenuOpen(false)}
                      className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Action row: view mode + TTS + PDF + expand/collapse — only rendered in fullscreen */}
          {fullPage && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm text-slate-500">
                View:
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as TimelineViewMode)}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                >
                  {(['list', 'vis', 'timelinejs', 'custom', 'animation-map', 'animation-3d', 'browser'] as const).map((m) => (
                    <option key={m} value={m}>
                      {VIEW_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              {viewMode === 'custom' && (
                <button
                  type="button"
                  onClick={() => setExpansionMode((m) => m === 'all' ? 'none' : 'all')}
                  className="rounded border px-2 py-1 text-xs transition-colors border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {expansionMode === 'all' ? 'Collapse' : 'Expand'}
                </button>
              )}
              <button
                type="button"
                title={tts.state.isPlaying ? 'Stop audio' : 'Listen (audio slideshow)'}
                onClick={() => {
                  if (tts.state.isPlaying) handleStopTTS()
                  else if (selected) handlePlayEvent(selected)
                }}
                className={`shrink-0 rounded border px-2.5 py-1.5 text-sm transition-colors ${tts.state.isPlaying
                  ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {tts.state.isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} />}
              </button>
              <div className="relative" ref={fullPage ? docMenuRef : undefined}>
                <button
                  type="button"
                  onClick={() => setDocMenuOpen(o => !o)}
                  className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  title="Download documents"
                >
                  <FileDown size={14} /> <ChevronDown size={12} />
                </button>
                {docMenuOpen && fullPage && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1">
                    {docDropdownLinks.map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDocMenuOpen(false)}
                        className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {/* Content drawer toggle — only in fullscreen with full-canvas views */}
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
        {/* Main content area: view fills the remaining space */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          {viewMode === 'browser' && (
            <div className="flex-1 min-h-0 w-full overflow-hidden flex">
              <BrowserView initialPath={browserPath} />
            </div>
          )}
          {viewMode === 'animation-map' && (
            <div className="relative w-full flex-1 min-h-0">
              <AnimationMapView />
            </div>
          )}
          {viewMode === 'animation-3d' && (
            <div className="relative w-full flex-1 min-h-0">
              <AnimationPlanetView selectedEvent={selected} entries={entries} />
            </div>
          )}
          {/* For non-full-canvas views: below sm show article only; non-fullscreen always article */}
          {!isFullCanvasView && (
            <TimelineGalleryProvider
              events={events}
              baseUrl={baseUrl}
              selectedEventId={selected?.id ?? null}
              onSelectEvent={handleSelectEvent}
            >
              <MarkdownCarousel
                events={events}
                baseUrl={baseUrl}
                selectedId={selected?.id ?? null}
                onSelectEvent={handleSelectEvent}
                ttsIsPlaying={tts.state.isPlaying && tts.state.segments[tts.state.currentSegmentIndex]?.id === selected?.id}
                onPlayEvent={() => selected && (tts.state.isPlaying ? handleStopTTS() : handlePlayEvent(selected))}
              />
            </TimelineGalleryProvider>
          )}
        </div>
        {/* Content drawer overlay — slides up over the view in narrow fullscreen */}
        {fullPage && showContentDrawer && (
          <div className="absolute inset-0 z-[120] flex flex-col bg-white dark:bg-slate-950">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <select
                value={selected?.id ?? ''}
                onChange={(e) => {
                  const evt = events.find((x) => x.id === e.target.value)
                  if (evt) handleSelectEvent(evt)
                }}
                className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {hierarchicalOptions.map(({ entry: evt, depth }) => {
                  const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth)
                  const label = evt.type === 'article' ? evt.title : `${formatDateRange(evt)} — ${evt.title}`
                  return (
                    <option key={evt.id} value={evt.id}>
                      {indent}{label}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowContentDrawer(false) }}
                className="shrink-0 rounded border border-slate-300 dark:border-slate-600 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TimelineGalleryProvider
                events={events}
                baseUrl={baseUrl}
                selectedEventId={selected?.id ?? null}
                onSelectEvent={handleSelectEvent}
              >
                <MarkdownCarousel
                  events={events}
                  baseUrl={baseUrl}
                  selectedId={selected?.id ?? null}
                  onSelectEvent={handleSelectEvent}
                  ttsIsPlaying={tts.state.isPlaying && tts.state.segments[tts.state.currentSegmentIndex]?.id === selected?.id}
                  onPlayEvent={() => selected && (tts.state.isPlaying ? handleStopTTS() : handlePlayEvent(selected))}
                />
              </TimelineGalleryProvider>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ DESKTOP SPLIT-PANEL LAYOUT ══════════
           Only in fullscreen when viewport >= sm (640px) */}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 w-full overflow-hidden hidden ${fullPage ? 'sm:flex' : ''}`}
        style={{ minHeight: 0 }}
      >
        {/* Browser view takes over the entire container */}
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
              <label className="flex items-center gap-2 text-sm text-slate-500">
                View:
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as TimelineViewMode)}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                >
                  {(['list', 'vis', 'timelinejs', 'custom', 'animation-map', 'animation-3d', 'browser'] as const).map((m) => (
                    <option key={m} value={m}>
                      {VIEW_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex-1 min-h-0 w-full overflow-hidden flex">
              <BrowserView initialPath={browserPath} />
            </div>
          </div>
        )}

        {viewMode !== 'browser' && <div
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
              {/* TTS Play button */}
              <button
                type="button"
                title={tts.state.isPlaying ? 'Stop audio' : 'Listen (audio slideshow)'}
                onClick={() => {
                  if (tts.state.isPlaying) handleStopTTS()
                  else if (selected) handlePlayEvent(selected)
                }}
                className={`shrink-0 rounded border px-2.5 py-1.5 text-sm transition-colors ${tts.state.isPlaying
                  ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {tts.state.isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} />}
              </button>
              {/* PDF + DOCX download dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDocMenuOpen(o => !o)}
                  className="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  title="Download documents"
                >
                  <FileDown size={14} /> <ChevronDown size={12} />
                </button>
                {docMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1">
                    {docDropdownLinks.map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDocMenuOpen(false)}
                        className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {viewMode === 'custom' && (
              <button
                type="button"
                onClick={() => setExpansionMode((m) => m === 'all' ? 'none' : 'all')}
                className="rounded border px-2 py-1 text-sm transition-colors border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {expansionMode === 'all' ? 'Collapse all' : 'Expand all'}
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-500">
              View:
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as TimelineViewMode)}
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
              >
                {(['list', 'vis', 'timelinejs', 'custom', 'animation-map', 'animation-3d', 'browser'] as const).map((m) => (
                  <option key={m} value={m}>
                    {VIEW_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
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
              <VisTimelineView
                onSelectEvent={handleSelectEvent}
                eventIdToEvent={eventIdToEvent}
              />
            )}
            {viewMode === 'timelinejs' && (
              <TimelineJSView
                onSelectEvent={handleSelectEvent}
                eventIdToEvent={eventIdToEvent}
              />
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
              <div className="relative w-full h-full">
                <AnimationPlanetView selectedEvent={selected} entries={entries} />
              </div>
            )}
          </div>
        </div>}

        {/* Draggable separator — hidden in browser mode */}
        {viewMode !== 'browser' && (
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
        )}

        {viewMode !== 'browser' && (<div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <TimelineGalleryProvider
            events={events}
            baseUrl={baseUrl}
            selectedEventId={selected?.id ?? null}
            onSelectEvent={handleSelectEvent}
          >
            <MarkdownCarousel
              events={events}
              baseUrl={baseUrl}
              selectedId={selected?.id ?? null}
              onSelectEvent={handleSelectEvent}
              ttsIsPlaying={tts.state.isPlaying && tts.state.segments[tts.state.currentSegmentIndex]?.id === selected?.id}
              onPlayEvent={() => selected && (tts.state.isPlaying ? handleStopTTS() : handlePlayEvent(selected))}
            />
          </TimelineGalleryProvider>
        </div>)}
      </div>

      {/* TTS Slideshow Overlay */}
      {slideshowOpen && (
        <TTSSlideshowOverlay
          ttsState={tts.state}
          availableVoices={tts.availableVoices}
          availablePiperVoices={tts.availablePiperVoices}
          onPause={tts.pause}
          onNext={tts.next}
          onPrev={tts.prev}
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
