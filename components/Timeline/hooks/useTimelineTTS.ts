'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTTS } from '@/lib/hooks/useTTS'
import { stripMarkdownForTTS } from '../ttsHelpers'
import type { TimelineEntry } from '@/components/TimelineContext'

interface UseTimelineTTSOptions {
  events: TimelineEntry[]
  baseUrl: string
  setFullPage: (value: boolean | ((prev: boolean) => boolean)) => void
  showContentDrawerRef: React.MutableRefObject<boolean>
  setShowContentDrawer: (value: boolean | ((prev: boolean) => boolean)) => void
}

export function useTimelineTTS({
  events,
  baseUrl,
  setFullPage,
  showContentDrawerRef,
  setShowContentDrawer,
}: UseTimelineTTSOptions) {
  const tts = useTTS()
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const slideshowOpenRef = useRef(false)
  useEffect(() => {
    slideshowOpenRef.current = slideshowOpen
  }, [slideshowOpen])
  const ttsStartIndexRef = useRef(0)

  const buildSegments = useCallback(
    (startEntry: TimelineEntry) => {
      const startIdx = events.findIndex((e) => e.id === startEntry.id)
      if (startIdx < 0) return []
      return events.slice(startIdx).map((evt) => ({
        id: evt.id,
        title: evt.title,
        fetchText: async () => {
          try {
            const res = await fetch(`${baseUrl}/${evt.md_path}`)
            const text = res.ok ? await res.text() : ''
            return stripMarkdownForTTS(text, evt.title)
          } catch {
            return evt.title
          }
        },
      }))
    },
    [events, baseUrl]
  )

  const handlePlayEvent = useCallback(
    (entry: TimelineEntry) => {
      const idx = events.findIndex((e) => e.id === entry.id)
      ttsStartIndexRef.current = idx >= 0 ? idx : 0
      tts.play(buildSegments(entry), 0)
      setSlideshowOpen(true)
      window.history.pushState({ slideshowOpen: true }, '')
    },
    [events, tts, buildSegments]
  )

  const handleStopTTS = useCallback(() => {
    tts.stop()
    tts.clearError()
    setSlideshowOpen(false)
  }, [tts])

  const ttsRef = useRef(tts)
  useEffect(() => {
    ttsRef.current = tts
  }, [tts])
  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      if (slideshowOpenRef.current) {
        ttsRef.current.stop()
        ttsRef.current.clearError()
        setSlideshowOpen(false)
      } else if (showContentDrawerRef.current) {
        setShowContentDrawer(false)
      } else {
        setFullPage(false)
        const params = new URLSearchParams(window.location.search)
        if (params.get('fullscreen')) {
          params.delete('fullscreen')
          const q = params.toString()
          window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setFullPage, setShowContentDrawer, showContentDrawerRef])

  const handleSeekToSegment = useCallback(
    (segmentIndex: number) => {
      const segments = tts.state.segments
      if (segmentIndex < 0 || segmentIndex >= segments.length) return
      tts.play(segments, segmentIndex)
    },
    [tts]
  )

  const handleSlideshowPrev = useCallback(() => {
    const { currentSegmentIndex, segments } = tts.state
    if (currentSegmentIndex <= 0 && segments.length > 0) {
      const currentId = segments[0]?.id
      if (currentId) {
        const idx = events.findIndex((e) => e.id === currentId)
        if (idx > 0) {
          handlePlayEvent(events[idx - 1]!)
          return
        }
      }
    }
    tts.prev()
  }, [tts, events, handlePlayEvent])

  useEffect(() => {
    return () => {
      ttsRef.current.stop()
    }
  }, [])

  return {
    tts,
    slideshowOpen,
    setSlideshowOpen,
    slideshowOpenRef,
    handlePlayEvent,
    handleStopTTS,
    handleSeekToSegment,
    handleSlideshowPrev,
    ttsStartIndexRef,
  }
}
