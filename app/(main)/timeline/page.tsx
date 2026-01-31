'use client'

import React from 'react'
import { TimelineProvider, TimelineView, RemoteMarkdown } from '@/components/Timeline'

const TIMELINE_BASE = process.env.NEXT_PUBLIC_TIMELINE_BASE_URL || 'https://clevertree.github.io/paradigm-threat-timeline'

const INTRO_PATHS: { path: string; title: string }[] = [
  { path: 'articles/overview/introduction.md', title: 'Introduction' },
  { path: 'articles/saturnian-cosmology-timeline-video/saturnian-cosmology-timeline-video.md', title: 'Saturnian Cosmology Timeline Video' },
  { path: 'articles/project-objective/project-objective.md', title: 'Project Objective' },
  { path: 'articles/project-objective/the-length-of-a-year-changes-throughout-antiquity.md', title: 'The length of a Year changes throughout Antiquity' },
  { path: 'articles/project-objective/timeline-synchronization.md', title: 'Timeline synchronization' },
  { path: 'articles/project-objective/cosmic-life-cycle.md', title: 'Cosmic Life Cycle' },
]

export default function TimelinePage() {
  return (
    <article className="w-full max-w-[56rem] mx-auto flex flex-col px-4 py-4 min-h-0" style={{ minHeight: 0 }}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Alternate Earth History Timeline</h1>
      <TimelineProvider>
        <TimelineView />
        <div className="mt-12 space-y-10">
          {INTRO_PATHS.map(({ path, title }) => (
            <RemoteMarkdown
              key={path}
              src={path}
              baseUrl={TIMELINE_BASE}
              title={title}
              className="max-w-[56rem]"
            />
          ))}
        </div>
      </TimelineProvider>
    </article>
  )
}
