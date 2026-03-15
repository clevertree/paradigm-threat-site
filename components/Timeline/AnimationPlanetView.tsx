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
import { getEventYearWithInheritance } from './utils'

interface AnimationPlanetViewProps {
    onSelectEvent?: (id: string) => void
    /** When set and event has a year in [-5000, -670], sync planet sim to that year */
    selectedEvent?: TimelineEntry | null
    /** Hierarchical entries; used to inherit parent year when event has no dates */
    entries?: TimelineEntry[]
}

const MIN_YEAR = -5000
const MAX_YEAR = -670

function yearFromEvent(evt: TimelineEntry | null | undefined, entries: TimelineEntry[] = []): number | null {
    if (!evt) return null
    const y = getEventYearWithInheritance(evt, entries)
    if (y == null) return null
    if (y >= MIN_YEAR && y <= MAX_YEAR) return y
    return null
}

export function AnimationPlanetView({ onSelectEvent, selectedEvent, entries = [] }: AnimationPlanetViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctrlRef = useRef<any>(null)
    const eventYear = yearFromEvent(selectedEvent, entries)
    const [year, setYear] = useState(() => eventYear ?? MIN_YEAR)
    const [phaseInfo, setPhaseInfo] = useState<{ label: string; description: string }>({ label: '', description: '' })
    const [ready, setReady] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const playRef = useRef(false)
    const yearRef = useRef(MIN_YEAR)
    const [nearbyEvents, setNearbyEvents] = useState<any[]>([])
    const [orbitInfo, setOrbitInfo] = useState<Record<string, number>>({})

    // Initialise planet controller
    useEffect(() => {
        let cancelled = false
        const initialYear = eventYear ?? MIN_YEAR

        async function init() {
            const { createPlanetController } = await import('paradigm-threat-animation')
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

    // Sync year when selected event changes and has a year in sim range (4077 and below).
    // Also sync when controller becomes ready (eventYear may have been set before init finished).
    useEffect(() => {
        if (eventYear == null || !ready) return
        updateYear(eventYear)
    }, [eventYear, updateYear, ready])

    // Update scene when year changes
    const updateYear = useCallback((y: number) => {
        yearRef.current = y
        setYear(y)
        if (!ctrlRef.current) return
        ctrlRef.current.setYear(y)
        setPhaseInfo(ctrlRef.current.getPhaseInfo())
        if (ctrlRef.current.getOrbitInfo) setOrbitInfo(ctrlRef.current.getOrbitInfo())
    }, [])

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

    // Playback loop — time-based: 1× = 1 Earth orbit per 10 seconds
    useEffect(() => {
        if (!playing) return
        playRef.current = true
        let raf: number
        let lastT = performance.now()

        function tick() {
            if (!playRef.current) return
            const now = performance.now()
            const dt = (now - lastT) / 1000 // seconds elapsed
            lastT = now
            // Base rate: 0.1 years/sec at 1×  (1 full orbit in 10 sec)
            const advance = 0.1 * speed * dt
            const next = yearRef.current + advance
            if (next > MAX_YEAR) {
                updateYear(MAX_YEAR)
                setPlaying(false)
                return
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
        updateYear(MIN_YEAR)
    }, [updateYear])

    const formatBCE = (y: number) => `${Math.abs(Math.round(y))} BCE`

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 relative">
            {/* 3D canvas — the controller renders its own HUD overlay inside this container */}
            <div className="flex-1 min-h-0 w-full relative" style={{ minHeight: 300 }}>
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
                    onChange={e => updateYear(+e.target.value)}
                    className="flex-1 accent-purple-500 cursor-pointer"
                />

                <span className="text-xs text-slate-400 tabular-nums w-20 text-right">{formatBCE(year)}</span>

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
