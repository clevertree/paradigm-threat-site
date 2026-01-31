'use client'

import React, { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { TimelineEntry } from '@/components/TimelineContext'

interface TimelineJSViewProps {
  onSelectEvent?: (evt: TimelineEntry) => void
  eventIdToEvent?: Map<string, TimelineEntry>
}

declare global {
  interface Window {
    TL?: { Timeline: new (el: HTMLElement | string, data: object, options?: object) => { goToId: (id: string) => void } }
  }
}

/**
 * TimelineJS loaded from CDN, with JSON fetched same-origin.
 * Avoids CORS/Private Network Access blocks when developing on localhost.
 */
export function TimelineJSView({
  onSelectEvent: _onSelectEvent,
  eventIdToEvent: _eventIdToEvent,
}: TimelineJSViewProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !ready || !window.TL) return

    let mounted = true
    setError(null)

    fetch('/api/timeline-json')
      .then((r) => r.json())
      .then((json) => {
        if (!mounted || !containerRef.current) return
        containerRef.current.innerHTML = ''
        new window.TL!.Timeline(containerRef.current, json, {
          hash_bookmark: true,
          initial_zoom: 3,
          use_bc: true,
          script_path: 'https://cdn.knightlab.com/libs/timeline3/latest/',
        })
      })
      .catch((err) => {
        if (mounted) setError(err.message)
      })

    return () => { mounted = false }
  }, [ready])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css'
    document.head.appendChild(link)
    return () => { link.remove() }
  }, [])

  return (
    <div className="flex-1 min-w-0">
      <Script
        src="https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
      />
      <div
        ref={containerRef}
        className="timeline-js-container border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
        style={{ minHeight: 450 }}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Failed to load timeline: {error}
        </p>
      )}
      <p className="mt-2 text-sm text-slate-500">
        TimelineJS view. Click events in timeline.
      </p>
    </div>
  )
}
