'use client'

import React from 'react'
import { TimelineProvider, TimelineView, RemoteMarkdown } from '@/components/Timeline'

const TIMELINE_BASE = process.env.NEXT_PUBLIC_TIMELINE_BASE_URL || 'https://clevertree.github.io/paradigm-threat-timeline'


export default function TimelinePage() {
  return (
    <article className="w-full max-w-[56rem] mx-auto flex flex-col px-4 py-4 min-h-0" style={{ minHeight: 0 }}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Alternate Earth History Timeline</h1>
      <TimelineProvider>
        <TimelineView />
      </TimelineProvider>
    </article>
  )
}
