'use client'

import { useEffect, useState } from 'react'

/** After mount: stable `nowMs` and calendar `refYear` for elapsed-time labels (avoids SSR/client mismatch). */
export function useClientClock(): { nowMs: number; refYear: number } | null {
  const [state, setState] = useState<{ nowMs: number; refYear: number } | null>(null)
  useEffect(() => {
    queueMicrotask(() => {
      const nowMs = Date.now()
      setState({ nowMs, refYear: new Date(nowMs).getFullYear() })
    })
  }, [])
  return state
}
