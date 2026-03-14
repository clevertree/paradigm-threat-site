'use client'

import React from 'react'
import { TimelineProvider, TimelineView } from '@/components/Timeline'

export function TimelineEventClient() {
  return (
    <article className="w-full max-w-[56rem] mx-auto flex flex-col px-4 py-4 min-h-0" style={{ minHeight: 0 }}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Alternate Earth History Timeline</h1>
      <TimelineProvider>
        <TimelineView />
      </TimelineProvider>
    </article>
  )
}
