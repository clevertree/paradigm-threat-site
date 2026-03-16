'use client'

import React from 'react'
import { formatDateRange } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'

export interface EventSelectOption {
  entry: TimelineEntry
  depth: number
}

interface EventSelectDropdownProps {
  options: EventSelectOption[]
  value: string
  onChange: (eventId: string) => void
  id?: string
  className?: string
}

export function EventSelectDropdown({
  options,
  value,
  onChange,
  id = 'timeline-event-select',
  className = 'flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm',
}: EventSelectDropdownProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {options.map(({ entry: evt, depth }) => {
        const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth)
        const label = evt.type === 'article' ? evt.title : `${formatDateRange(evt)} — ${evt.title}`
        return (
          <option key={evt.id} value={evt.id}>
            {indent}{label}
          </option>
        )
      })}
    </select>
  )
}
