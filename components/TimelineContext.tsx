'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'

export interface TimelineDate {
  start: number
  end?: number
  calendar: string
  source?: string
  confidence?: string
  note?: string
}

export interface TimelineEntry {
  id: string
  title: string
  type?: 'article' | 'event'
  md_path: string
  dates: TimelineDate[]
  children: TimelineEntry[]
  timeline_sources?: string[]
  context?: { mainstream?: boolean; theoretical?: boolean }
  categories?: string[]
  duplicate_of?: string
  related_events?: string[]
  media?: string[]
  tags?: string[]
}

export interface IntroArticle {
  id: string
  title: string
  md_path: string
}

export interface TimelineData {
  entries?: TimelineEntry[]
  introArticles?: IntroArticle[]
  meta?: Record<string, unknown>
}

interface TimelineContextType {
  entries: TimelineEntry[]
  events: TimelineEntry[]
  introArticles: IntroArticle[]
  loading: boolean
  error: string | null
  baseUrl: string
}

function flattenEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = []
  function visit(nodes: TimelineEntry[]) {
    for (const e of nodes) {
      result.push(e)
      visit(e.children || [])
    }
  }
  visit(entries)
  return result
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined)

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [introArticles, setIntroArticles] = useState<IntroArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const baseUrl =
    process.env.NEXT_PUBLIC_TIMELINE_BASE_URL ||
    'https://clevertree.github.io/paradigm-threat-timeline'

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        const res = await fetch(`${baseUrl}/data/events.json`)
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
        const data: TimelineData = await res.json()
        if (isMounted) {
          setEntries(data.entries || [])
          setIntroArticles(data.introArticles || [])
          setLoading(false)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load timeline')
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [baseUrl])

  const events = useMemo(() => flattenEntries(entries), [entries])

  const value = useMemo(
    () => ({ entries, events, introArticles, loading, error, baseUrl }),
    [entries, events, introArticles, loading, error, baseUrl]
  )

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  )
}

export function useTimeline() {
  const ctx = useContext(TimelineContext)
  if (ctx === undefined) {
    throw new Error('useTimeline must be used within TimelineProvider')
  }
  return ctx
}
