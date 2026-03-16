export const STORAGE_KEY = 'paradigm-threat-timeline-left-panel-pct'
export const DEFAULT_LEFT_PCT = 35
export const MIN_LEFT_PCT = 20
export const MAX_LEFT_PCT = 50

export type TimelineViewMode =
  | 'custom'
  | 'list'
  | 'vis'
  | 'timelinejs'
  | 'animation-map'
  | 'animation-3d'
  | 'browser'

export const VIEW_LABELS: Record<TimelineViewMode, string> = {
  custom: 'Default',
  list: 'List',
  vis: 'vis-timeline',
  timelinejs: 'TimelineJS',
  'animation-map': 'Map (CE)',
  'animation-3d': 'Planets (BC)',
  browser: 'Browser',
}

export const VIEW_MODES: readonly TimelineViewMode[] = [
  'custom',
  'animation-map',
  'animation-3d',
  'list',
  'vis',
  'timelinejs',
  'browser',
]

export type ExpansionMode = 'all' | 'none'

export function getStoredLeftPct(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v == null) return null
    const n = parseInt(v, 10)
    if (Number.isNaN(n) || n < MIN_LEFT_PCT || n > MAX_LEFT_PCT) return null
    return n
  } catch {
    return null
  }
}
