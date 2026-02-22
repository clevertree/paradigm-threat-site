'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTimeline } from '@/components/TimelineContext'
import { ListView } from './ListView'
import { VisTimelineView } from './VisTimelineView'
import { TimelineJSView } from './TimelineJSView'
import { CustomTimelineView } from './CustomTimelineView'
import { MarkdownCarousel } from './MarkdownCarousel'
import { TimelineGalleryProvider } from './TimelineGalleryProvider'
import { formatDateRange } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'

const STORAGE_KEY = 'paradigm-threat-timeline-left-panel-pct'
const DEFAULT_LEFT_PCT = 50
const MIN_LEFT_PCT = 20
const MAX_LEFT_PCT = 80

export type TimelineViewMode = 'list' | 'vis' | 'timelinejs' | 'custom'

const VIEW_LABELS: Record<TimelineViewMode, string> = {
  list: 'List',
  vis: 'vis-timeline',
  timelinejs: 'TimelineJS',
  custom: 'Custom',
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

  // Read ?fullscreen=1 and ?event=<id> from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fullscreen') === '1') setFullPage(true)
    const evtId = params.get('event')
    if (evtId) initialEventIdRef.current = evtId
  }, [])

  useEffect(() => {
    if (!fullPage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
      } else {
        params.delete('fullscreen')
      }
      const q = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
      return next
    })
  }, [])
  const [viewMode, setViewMode] = useState<TimelineViewMode>('custom')
  const [expansionMode, setExpansionMode] = useState<ExpansionMode>('all')
  const [selected, setSelected] = useState<TimelineEntry | null>(null)
  const [leftPct, setLeftPct] = useState<number>(DEFAULT_LEFT_PCT)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleSelectEvent = useCallback((evt: TimelineEntry) => {
    setSelected(evt)
    const params = new URLSearchParams(window.location.search)
    params.set('event', evt.id)
    const q = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
  }, [])

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
    return result
  }, [entries])

  useEffect(() => {
    if (!selected?.id || !leftScrollRef.current) return
    const el = document.getElementById(`timeline-item-${selected.id}`)
    if (!el) return
    const container = leftScrollRef.current
    const elRect = el.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
      const scrollTop =
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
    }
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

  return (
    <div className={
      fullPage
        ? 'fixed inset-0 z-[110] flex flex-col bg-white dark:bg-slate-950 overflow-hidden p-4 select-none'
        : 'flex flex-col flex-1 min-h-0 w-full overflow-hidden max-h-[80vh] min-h-[80vh] select-none'
    }>
      {/* Mobile: always show when not fullscreen; when fullscreen, show only when viewport < 1000px */}
      <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${fullPage ? 'min-[1000px]:hidden' : ''}`}>
        <div className="flex-shrink-0 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2">
          <label htmlFor="timeline-event-select" className="block text-sm font-medium text-slate-600 dark:text-slate-400">Select event</label>
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
              {fullPage ? 'Exit full page' : 'Full page'}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
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
            />
          </TimelineGalleryProvider>
        </div>
      </div>

      {/* Desktop: resizable panels — only in fullscreen when viewport >= 1000px */}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 w-full overflow-hidden hidden ${fullPage ? 'min-[1000px]:flex' : ''}`}
        style={{ minHeight: 0 }}
      >
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
                {(['list', 'vis', 'timelinejs', 'custom'] as const).map((m) => (
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
          </div>
        </div>

        {/* Draggable separator */}
        <button
          type="button"
          role="slider"
          aria-orientation="vertical"
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={leftPct}
          aria-label="Resize panels"
          onMouseDown={handleSeparatorMouseDown}
          className={`flex-shrink-0 w-1 flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-col-resize select-none border-0 p-0 ${isDragging ? 'bg-slate-400 dark:bg-slate-500' : ''}`}
        >
          <span className="w-0.5 h-8 bg-slate-400 dark:bg-slate-500 rounded-full block" aria-hidden />
        </button>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
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
            />
          </TimelineGalleryProvider>
        </div>
      </div>
    </div>
  )
}
