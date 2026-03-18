'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VIEW_MODES } from '../constants'
import type { TimelineViewMode } from '../constants'
import type { TimelineEntry } from '@/components/TimelineContext'

export function useTimelineUrlState() {
  const [fullPage, setFullPage] = useState(false)
  const [viewMode, setViewModeRaw] = useState<TimelineViewMode>('custom')
  const [browserPath, setBrowserPath] = useState<string | null>(null)
  const initialEventIdRef = useRef<string | null>(null)

  // Read ?fullscreen=1, ?view=<mode>, and event id from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    queueMicrotask(() => {
      if (params.get('fullscreen') === '1') setFullPage(true)
      const viewParam = params.get('view') as TimelineViewMode | null
      if (viewParam && (VIEW_MODES as readonly string[]).includes(viewParam)) {
        setViewModeRaw(viewParam)
        if (viewParam === 'browser') {
          setFullPage(true)
          const p = params.get('path')
          if (p) setBrowserPath(p)
        }
      }
    })
    const pathMatch = window.location.pathname.match(/^\/timeline\/(.+)$/)
    const evtId = pathMatch ? decodeURIComponent(pathMatch[1]) : params.get('event')
    if (evtId) initialEventIdRef.current = evtId
  }, [])

  const setViewMode = useCallback((mode: TimelineViewMode) => {
    setViewModeRaw(mode)
    if (mode === 'browser') {
      setFullPage(true)
    } else {
      // path query only applies to browser mode
    }
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      if (mode === 'custom') {
        params.delete('view')
      } else {
        params.set('view', mode)
      }
      if (mode === 'browser') {
        params.set('fullscreen', '1')
      } else {
        params.delete('path')
      }
      const q = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
    })
  }, [])

  const onToggleFullscreen = useCallback(() => {
    // Never call history APIs inside setState updaters — React/Next may run them while
    // TimelineView is rendering, which triggers "Cannot update Router while rendering".
    let next = false
    setFullPage((p) => {
      next = !p
      return next
    })
    queueMicrotask(() => {
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
    })
  }, [])

  const updateUrlForEvent = useCallback((evt: TimelineEntry) => {
    const params = new URLSearchParams(window.location.search)
    params.delete('event')
    const q = params.toString()
    window.history.replaceState(null, '', `/timeline/${evt.id}` + (q ? '?' + q : ''))
  }, [])

  return {
    fullPage,
    setFullPage,
    viewMode,
    setViewMode,
    onToggleFullscreen,
    browserPath,
    initialEventIdRef,
    updateUrlForEvent,
  }
}
