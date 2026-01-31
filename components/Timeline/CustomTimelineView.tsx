'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { FileText, Calendar } from 'lucide-react'
import { useTimeline } from '@/components/TimelineContext'
import { formatDateRange } from './utils'
import type { TimelineEntry } from '@/components/TimelineContext'
import type { ExpansionMode } from './TimelineView'

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-slate-50 dark:bg-slate-900/60 border-l-slate-300 dark:border-l-slate-600',
  1: 'bg-blue-50/70 dark:bg-blue-950/40 border-l-blue-400 dark:border-l-blue-600',
  2: 'bg-amber-50/70 dark:bg-amber-950/30 border-l-amber-400 dark:border-l-amber-600',
  3: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-emerald-400 dark:border-l-emerald-600',
  4: 'bg-violet-50/70 dark:bg-violet-950/30 border-l-violet-400 dark:border-l-violet-600',
}

function getLevelStyles(depth: number): string {
  return LEVEL_COLORS[depth] ?? 'bg-slate-100/50 dark:bg-slate-800/40 border-l-slate-400 dark:border-l-slate-500'
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

function getBaseExpanded(expansionMode: ExpansionMode, depth: number, hasChildren: boolean): boolean {
  if (!hasChildren) return false
  if (expansionMode === 'all') return true
  if (expansionMode === 'none') return false
  if (expansionMode === 'level2') return depth < 3
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
  const levelStyles = getLevelStyles(depth)

  return (
    <div
      className={`border-b border-slate-200 dark:border-slate-700 last:border-b-0 border-l-2 ${levelStyles}`}
      style={{ marginLeft: depth * 12 }}
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
        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:opacity-90 cursor-pointer ${isSelected ? 'ring-1 ring-inset ring-slate-400 dark:ring-slate-500' : ''}`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded(entry.id, !expanded)
            }}
            className="shrink-0 p-0.5 -m-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-600/40 transition-transform"
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
          <span className="text-slate-500 dark:text-slate-400 text-xs tabular-nums shrink-0 min-w-[7rem] text-left">
            {dateStr}
          </span>
        )}
        <span className={`font-medium text-slate-900 dark:text-slate-100 truncate text-left flex-1 min-w-0 ${isArticle ? 'text-sm' : ''}`}>
          {entry.title}
        </span>
      </div>
      {expanded && hasChildren && (
        <div className="border-t border-slate-200 dark:border-slate-700/50">
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
