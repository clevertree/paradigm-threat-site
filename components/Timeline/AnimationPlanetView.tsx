'use client'

/**
 * AnimationPlanetView — React wrapper for the Three.js Saturnian cosmology scene.
 * BC timeline (-5000 to -670): Shows the collinear configuration breakup,
 * Jupiter's assault, the Deluge, and eventual solar system stabilization.
 *
 * Uses dynamic imports for SSR safety (Three.js requires canvas/WebGL).
 * Syncs to selectedEvent's year when in range (4077 and below).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import type { TimelineEntry } from '@/components/TimelineContext'
import { getEventYearForSim, findNearestEventToYear } from './utils'

interface AnimationPlanetViewProps {
    onSelectEvent?: (entry: TimelineEntry) => void
    /** When set and event has a year in [-5000, -670], sync planet sim to that year */
    selectedEvent?: TimelineEntry | null
    /** Hierarchical entries; used to inherit parent year when event has no dates */
    entries?: TimelineEntry[]
    /** All events; used to select nearest event when year slider changes */
    events?: TimelineEntry[]
}

const MIN_YEAR = -5000
const MAX_YEAR = 3000  // CE years use modern solar config

export function AnimationPlanetView({ onSelectEvent, selectedEvent, entries = [], events = [] }: AnimationPlanetViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctrlRef = useRef<any>(null)
    const eventYear = getEventYearForSim(selectedEvent, entries)
    const [year, setYear] = useState(() => eventYear)
    const [phaseInfo, setPhaseInfo] = useState<{ label: string; description: string }>({ label: '', description: '' })
    const [ready, setReady] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const playRef = useRef(false)
    const yearRef = useRef(eventYear)
    const [nearbyEvents, setNearbyEvents] = useState<any[]>([])
    const [orbitInfo, setOrbitInfo] = useState<Record<string, number>>({})

    // Initialise planet controller
    useEffect(() => {
        let cancelled = false
        const initialYear = eventYear

        async function init() {
            const { createPlanetController } = await import('paradigm-threat-animation')
            if (cancelled || !canvasRef.current) return

            // Wait for layout: canvas may be 0×0 on first paint (e.g. fullscreen flex layout)
            const hasSize = await new Promise<boolean>((resolve) => {
                let resolved = false
                const done = (ok: boolean) => {
                    if (resolved) return
                    resolved = true
                    resolve(ok)
                }
                const check = () => {
                    if (cancelled || !canvasRef.current) return done(false)
                    const w = canvasRef.current.clientWidth
                    const h = canvasRef.current.clientHeight
                    if (w > 0 && h > 0) return done(true)
                    return false
                }
                if (check()) return
                if (typeof ResizeObserver !== 'undefined' && canvasRef.current) {
                    const ro = new ResizeObserver(() => {
                        if (check()) { ro.disconnect(); done(true) }
                    })
                    ro.observe(canvasRef.current)
                    setTimeout(() => {
                        ro.disconnect()
                        done(canvasRef.current ? canvasRef.current.clientWidth > 0 && canvasRef.current.clientHeight > 0 : false)
                    }, 3000)
                } else {
                    let frames = 0
                    const loop = () => {
                        if (check() || cancelled || !canvasRef.current || frames++ >= 120) {
                            if (!resolved) done(!!canvasRef.current && canvasRef.current.clientWidth > 0 && canvasRef.current.clientHeight > 0)
                            return
                        }
                        requestAnimationFrame(loop)
                    }
                    requestAnimationFrame(loop)
                }
            })
            if (cancelled || !canvasRef.current) return

            const ctrl = await createPlanetController(canvasRef.current)
            if (cancelled) { ctrl.destroy(); return }

            ctrlRef.current = ctrl
            ctrl.setYear(initialYear)
            yearRef.current = initialYear
            setYear(initialYear)
            setPhaseInfo(ctrl.getPhaseInfo())
            // Trigger initial resize to match container
            if (ctrl.resize) ctrl.resize()
            setReady(true)
        }

        init()
        return () => {
            cancelled = true
            ctrlRef.current?.destroy()
            ctrlRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update scene when year changes (must be declared before use in effects)
    const updateYear = useCallback((y: number) => {
        yearRef.current = y
        setYear(y)
        if (!ctrlRef.current) return
        ctrlRef.current.setYear(y)
        setPhaseInfo(ctrlRef.current.getPhaseInfo())
        if (ctrlRef.current.getOrbitInfo) setOrbitInfo(ctrlRef.current.getOrbitInfo())
    }, [])

    // Sync year only when user selects a different event — never overwrite manual slider drag.
    const selectedId = selectedEvent?.id ?? null
    const prevSelectedIdRef = useRef<string | null>(null)
    useEffect(() => {
        if (!ready || selectedId == null) return
        if (prevSelectedIdRef.current === selectedId) return
        prevSelectedIdRef.current = selectedId
        updateYear(eventYear)
    }, [selectedId, eventYear, updateYear, ready])

    // Update nearby events when year changes
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                const { getNearbyEvents, timelineEvents } = await import('paradigm-threat-animation')
                if (cancelled) return
                setNearbyEvents(getNearbyEvents(timelineEvents, year, '3d', 60))
            })()
        return () => { cancelled = true }
    }, [year])

    // Playback loop — time-based: 1× = 1 Earth orbit per 10 seconds. BC loops within era; CE plays forward to present.
    const BC_MAX = -670
    const CE_END_YEAR = MAX_YEAR  // 3000 — modern-solar config supports to 3000
    useEffect(() => {
        if (!playing) return
        playRef.current = true
        const initialYear = yearRef.current
        const loopStart = initialYear <= -4077 ? MIN_YEAR
            : initialYear <= -3147 ? -4077
            : initialYear <= BC_MAX ? -3147
            : initialYear
        const isModernEra = initialYear > BC_MAX
        let raf: number
        let lastT = performance.now()

        function tick() {
            if (!playRef.current) return
            const now = performance.now()
            const dt = (now - lastT) / 1000 // seconds elapsed
            lastT = now
            // Base rate: 0.1 years/sec at 1×  (1 full orbit in 10 sec)
            const advance = 0.1 * speed * dt
            let next = yearRef.current + advance
            if (isModernEra) {
                // CE: play forward; stop at CE_END_YEAR (3000)
                next = Math.min(next, CE_END_YEAR)
                if (next >= CE_END_YEAR) {
                    updateYear(CE_END_YEAR)
                    setPlaying(false)
                    return
                }
            } else {
                if (next > BC_MAX) next = loopStart
            }
            updateYear(next)
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        return () => {
            playRef.current = false
            cancelAnimationFrame(raf)
        }
    }, [playing, speed, updateYear])

    const handleReset = useCallback(() => {
        setPlaying(false)
        updateYear(eventYear)
    }, [updateYear, eventYear])

    // Space toggles Play/Pause (useful when overlay blocks button clicks)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== ' ' || !ready) return
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
            e.preventDefault()
            setPlaying(p => !p)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [ready])

    const formatYearLabel = (y: number) => y < 0 ? `${Math.abs(Math.round(y))} BCE` : `${Math.round(y)} CE`

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 relative">
            {/* 3D canvas — explicit min-height so canvas gets dimensions even when flex parent is 0 */}
            <div className="flex-1 min-h-[300px] w-full relative" style={{ minHeight: 300 }}>
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            </div>

            {/* Timeline controls */}
            <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 bg-slate-900 border-t border-slate-700">
                <button
                    type="button"
                    onClick={() => setPlaying(p => !p)}
                    className="rounded border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800"
                    title={playing ? 'Pause' : 'Play'}
                >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800"
                    title="Reset"
                >
                    <RotateCcw size={14} />
                </button>

                <input
                    type="range"
                    min={MIN_YEAR}
                    max={MAX_YEAR}
                    value={year}
                    onChange={e => {
                        const y = +e.target.value
                        updateYear(y)
                        if (onSelectEvent && events.length > 0) {
                            const nearest = findNearestEventToYear(events, y, entries)
                            if (nearest) onSelectEvent(nearest)
                        }
                    }}
                    className="flex-1 accent-purple-500 cursor-pointer"
                />

                <span className="text-xs text-slate-400 tabular-nums w-20 text-right">{formatYearLabel(year)}</span>

                <select
                    value={speed}
                    onChange={e => setSpeed(+e.target.value)}
                    className="rounded border border-slate-600 bg-slate-800 text-slate-300 text-xs px-1.5 py-1"
                >
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                    <option value={5}>5×</option>
                    <option value={10}>10×</option>
                    <option value={25}>25×</option>
                    <option value={100}>100×</option>
                    <option value={500}>500×</option>
                </select>
            </div>
        </div>
    )
}
