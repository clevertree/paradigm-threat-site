'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  STORAGE_KEY,
  DEFAULT_LEFT_PCT,
  MIN_LEFT_PCT,
  MAX_LEFT_PCT,
  getStoredLeftPct,
} from '../constants'

export function useLeftPanelResize() {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT)
  const [isDragging, setIsDragging] = useState(false)
  const lastPctRef = useRef(leftPct)

  useEffect(() => {
    const stored = getStoredLeftPct()
    if (stored != null) queueMicrotask(() => setLeftPct(stored))
  }, [])

  useEffect(() => {
    lastPctRef.current = leftPct
  }, [leftPct])

  const handleSeparatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.round((x / rect.width) * 100)
      const clamped = Math.max(MIN_LEFT_PCT, Math.min(MAX_LEFT_PCT, pct))
      lastPctRef.current = clamped
      setLeftPct(clamped)
    }
    const onUp = () => {
      setIsDragging(false)
      try {
        localStorage.setItem(STORAGE_KEY, String(lastPctRef.current))
      } catch {
        // ignore
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  return {
    containerRef,
    leftScrollRef,
    leftPct,
    setLeftPct,
    isDragging,
    handleSeparatorMouseDown,
  }
}
