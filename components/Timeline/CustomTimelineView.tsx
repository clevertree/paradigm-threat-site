'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { FileText, Calendar, ChevronRight } from 'lucide-react'
import { useTimeline } from '@/components/TimelineContext'
import { formatDateRange } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { ExpansionMode } from './TimelineView'

/* ── Depth-aware visual tokens ─────────────────────────────────── */

const LEVEL_BG: Record<number, string> = {
  0: 'bg-slate-800/70',
  1: 'bg-slate-800/40',
  2: 'bg-slate-800/20',
  3: 'bg-transparent',
  4: 'bg-transparent',
}

const LEVEL_TEXT: Record<number, string> = {
  0: 'text-base font-bold text-slate-100',
  1: 'text-sm font-semibold text-slate-200',
  2: 'text-sm font-medium text-slate-300',
  3: 'text-xs font-medium text-slate-400',
  4: 'text-xs font-normal text-slate-500',
}

const LEVEL_DATE: Record<number, string> = {
  0: 'text-sm text-slate-300',
  1: 'text-xs text-slate-400',
  2: 'text-xs text-slate-400',
  3: 'text-xs text-slate-500',
  4: 'text-xs text-slate-500',
}

/* Left padding per depth (in px) for visual indentation */
const LEVEL_PADDING_LEFT: Record<number, string> = {
  0: 'pl-3',
  1: 'pl-5',
  2: 'pl-5',
  3: 'pl-14',
  4: 'pl-16',
}

/* Left border accent per depth */
const LEVEL_BORDER: Record<number, string> = {
  0: '',
  1: 'border-l-2 border-l-cyan-700/40',
  2: 'border-l-2 border-l-cyan-800/30',
  3: 'border-l-2 border-l-cyan-900/20',
  4: 'border-l-2 border-l-cyan-900/10',
}

function getLevelBg(depth: number): string {
  return LEVEL_BG[depth] ?? 'bg-transparent'
}

function getLevelText(depth: number): string {
  return LEVEL_TEXT[depth] ?? 'text-xs font-normal text-slate-500'
}

function getLevelDate(depth: number): string {
  return LEVEL_DATE[depth] ?? 'text-xs text-slate-500'
}

function getLevelPadding(depth: number): string {
  return LEVEL_PADDING_LEFT[depth] ?? 'pl-16'
}

function getLevelBorder(depth: number): string {
  return LEVEL_BORDER[depth] ?? ''
}

interface CustomTimelineViewProps {
  expansionMode: ExpansionMode
  onSelectEvent?: (entry: TimelineEntry) => void
  selectedId?: string | null
}

interface TreeEntryProps {
  entry: TimelineEntry
  depth: number
  expansionMode: ExpansionMode
  expandedOverrides: Record<string, boolean>
  onToggleExpanded: (id: string, next: boolean) => void
  onSelectEvent?: (entry: TimelineEntry) => void
  selectedId?: string | null
}

function getBaseExpanded(expansionMode: ExpansionMode, _depth: number, hasChildren: boolean): boolean {
  if (!hasChildren) return false
  if (expansionMode === 'all') return true
  if (expansionMode === 'none') return false
  return false
}

function TreeEntry({
  entry,
  depth,
  expansionMode,
  expandedOverrides,
  onToggleExpanded,
  onSelectEvent,
  selectedId,
}: TreeEntryProps) {
  const hasChildren = (entry.children?.length ?? 0) > 0
  const baseExpanded = getBaseExpanded(expansionMode, depth, hasChildren)
  const expanded = entry.id in expandedOverrides ? expandedOverrides[entry.id]! : baseExpanded
  const isArticle = entry.type === 'article'
  const dateStr = formatDateRange(entry)
  const isSelected = selectedId === entry.id
  const levelBg = getLevelBg(depth)
  const levelText = getLevelText(depth)
  const levelDate = getLevelDate(depth)

  return (
    <div
      className={`border-b border-slate-200/30 dark:border-slate-700/40 last:border-b-0 ${levelBg} ${getLevelBorder(depth)}`}
    >
      <div
        role="button"
        tabIndex={0}
        id={`timeline-item-${entry.id}`}
        onClick={() => onSelectEvent?.(entry)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectEvent?.(entry)
          }
        }}
        className={`w-full text-left pr-3 py-2 flex items-center gap-2 transition-colors hover:opacity-90 cursor-pointer ${getLevelPadding(depth)} ${isSelected ? 'ring-1 ring-inset ring-slate-400 dark:ring-slate-500 bg-slate-800/40' : ''}`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded(entry.id, !expanded)
            }}
            className="shrink-0 px-1.5 -m-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-600/40 transition-transform"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <span className="text-slate-400">▶</span>
          </button>
        ) : (
          <span className="shrink-0 w-5" aria-hidden />
        )}
        {isArticle ? (
          <FileText className="shrink-0 w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden />
        ) : (
          <Calendar className="shrink-0 w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden />
        )}
        {!isArticle && (
          <span className={`tabular-nums shrink-0 min-w-[7rem] text-left ${levelDate}`}>
            {dateStr}
          </span>
        )}
        <span className={`truncate text-left flex-1 min-w-0 ${levelText} ${isArticle ? 'italic opacity-80' : ''}`}>
          {entry.title}
        </span>
      </div>
      {expanded && hasChildren && (
        <div className="border-t border-slate-200/20 dark:border-slate-700/30">
          {entry.children!.map((child) => (
            <TreeEntry
              key={child.id}
              entry={child}
              depth={depth + 1}
              expansionMode={expansionMode}
              expandedOverrides={expandedOverrides}
              onToggleExpanded={onToggleExpanded}
              onSelectEvent={onSelectEvent}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function findPathToEntry(entries: TimelineEntry[], targetId: string, path: string[] = []): string[] | null {
  for (const entry of entries) {
    const p = [...path, entry.id]
    if (entry.id === targetId) return p.slice(0, -1)
    const found = findPathToEntry(entry.children || [], targetId, p)
    if (found) return found
  }
  return null
}

export function CustomTimelineView({ expansionMode, onSelectEvent, selectedId }: CustomTimelineViewProps) {
  const { entries } = useTimeline()
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpandedOverrides({})
  }, [expansionMode])

  useEffect(() => {
    if (!selectedId) return
    const path = findPathToEntry(entries, selectedId)
    if (!path?.length) return
    setExpandedOverrides((prev) => {
      const next = { ...prev }
      for (const id of path) next[id] = true
      return next
    })
  }, [selectedId, entries])

  const handleToggleExpanded = useCallback((id: string, next: boolean) => {
    setExpandedOverrides((prev) => ({ ...prev, [id]: next }))
  }, [])

  return (
    <div className="min-w-0">
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 overflow-x-hidden">
        {entries.map((entry) => (
          <TreeEntry
            key={entry.id}
            entry={entry}
            depth={0}
            expansionMode={expansionMode}
            expandedOverrides={expandedOverrides}
            onToggleExpanded={handleToggleExpanded}
            onSelectEvent={onSelectEvent}
            selectedId={selectedId}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-500 flex-shrink-0">
        Click entry to select. Use the ▶ arrow to expand or collapse.
      </p>
    </div>
  )
}
