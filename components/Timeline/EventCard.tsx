'use client'

import React from 'react'
import { formatDateRange } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'

interface EventCardProps {
  event: TimelineEntry
  onSelect?: (event: TimelineEntry) => void
  isSelected?: boolean
}

export function EventCard({ event, onSelect, isSelected }: EventCardProps) {
  const dateStr = formatDateRange(event)
  const isArticle = event.type === 'article'

  return (
    <button
      type="button"
      id={`timeline-item-${event.id}`}
      onClick={() => onSelect?.(event)}
      className={`block w-full text-left p-3 rounded-lg border transition-colors ${isArticle
        ? isSelected
          ? 'border-amber-400 dark:border-amber-600 bg-amber-200/70 dark:bg-amber-700/40'
          : 'border-amber-200 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/30'
        : isSelected
          ? 'border-slate-400 dark:border-slate-500 bg-slate-200 dark:bg-slate-700'
          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
    >
      {!isArticle && (
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums text-left">{dateStr}</div>
      )}
      <div className={`font-medium text-slate-900 dark:text-slate-100 text-left ${isArticle ? 'text-sm' : ''}`}>{event.title}</div>
    </button>
  )
}
