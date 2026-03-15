'use client'

import React, { createContext, useContext } from 'react'

export interface TimelineLinkContextValue {
  /** When set, timeline event links (/timeline/evt-*) call this instead of navigating. Keeps fullscreen and avoids full page refresh. */
  onTimelineNavigate?: (eventId: string) => void
}

const TimelineLinkContext = createContext<TimelineLinkContextValue>({})

export function useTimelineLink() {
  return useContext(TimelineLinkContext)
}

export const TimelineLinkProvider = TimelineLinkContext.Provider
