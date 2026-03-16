'use client'

import React from 'react'
import { VIEW_MODES, VIEW_LABELS } from './constants'
import type { TimelineViewMode } from './constants'

interface ViewModeSelectProps {
  value: TimelineViewMode
  onChange: (mode: TimelineViewMode) => void
  className?: string
  selectClassName?: string
}

export function ViewModeSelect({
  value,
  onChange,
  className,
  selectClassName = 'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm',
}: ViewModeSelectProps) {
  return (
    <label className={className ?? 'flex items-center gap-2 text-sm text-slate-500'}>
      View:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimelineViewMode)}
        className={selectClassName}
      >
        {VIEW_MODES.map((m) => (
          <option key={m} value={m}>
            {VIEW_LABELS[m]}
          </option>
        ))}
      </select>
    </label>
  )
}
