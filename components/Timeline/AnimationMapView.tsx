'use client'

/**
 * AnimationMapView — React wrapper for the Leaflet empire-expansion map.
 * CE timeline (1053–2026): Shows Rus-Horde empire phases, borders fading in/out,
 * and event markers with popup details.
 *
 * Uses dynamic imports for SSR safety (Leaflet requires DOM).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface AnimationMapViewProps {
    onSelectEvent?: (id: string) => void
}

const MIN_YEAR = 1053
const MAX_YEAR = 2026

export function AnimationMapView({ onSelectEvent }: AnimationMapViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const ctrlRef = useRef<any>(null)
    const [year, setYear] = useState(MIN_YEAR)
    const [phase, setPhase] = useState('')
    const [ready, setReady] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(2)
    const playRef = useRef(false)
    const yearRef = useRef(MIN_YEAR)
    const [nearbyEvents, setNearbyEvents] = useState<any[]>([])

    // Initialise map controller
    useEffect(() => {
        let cancelled = false
        let leafletCSS: HTMLLinkElement | null = null

        async function init() {
            // Inject Leaflet CSS
            if (!document.querySelector('link[href*="leaflet"]')) {
                leafletCSS = document.createElement('link')
                leafletCSS.rel = 'stylesheet'
                leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(leafletCSS)
            }

            const [{ createMapController }, { default: geojsonRaw }] = await Promise.all([
                import('paradigm-threat-animation'),
                import('paradigm-threat-animation/data/empire-boundaries.geojson'),
            ])
            const geojson = typeof geojsonRaw === 'string' ? JSON.parse(geojsonRaw) : geojsonRaw

            if (cancelled || !containerRef.current) return

            const ctrl = await createMapController(containerRef.current, geojson)
            if (cancelled) { ctrl.destroy(); return }

            ctrlRef.current = ctrl
            ctrl.setYear(MIN_YEAR)
            setPhase(ctrl.getPhaseLabel())
            setReady(true)
        }

        init()
        return () => {
            cancelled = true
            ctrlRef.current?.destroy()
            ctrlRef.current = null
            if (leafletCSS) leafletCSS.remove()
        }
    }, [])

    // Update map when year changes
    const updateYear = useCallback((y: number) => {
        yearRef.current = y
        setYear(y)
        if (!ctrlRef.current) return
        ctrlRef.current.setYear(y)
        setPhase(ctrlRef.current.getPhaseLabel())
    }, [])

    // Update nearby events when year changes
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                const { getNearbyEvents, timelineEvents } = await import('paradigm-threat-animation')
                if (cancelled) return
                setNearbyEvents(getNearbyEvents(timelineEvents, year, 'map', 15))
            })()
        return () => { cancelled = true }
    }, [year])

    // Playback loop
    useEffect(() => {
        if (!playing) return
        playRef.current = true
        let raf: number

        function tick() {
            if (!playRef.current) return
            const next = yearRef.current + speed
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

    return (
        <div className="flex flex-col h-full w-full bg-slate-950">
            {/* Map container */}
            <div ref={containerRef} className="flex-1 min-h-0 w-full" style={{ minHeight: 300 }} />

            {/* Year overlay */}
            {ready && (
                <div className="absolute top-3 left-3 z-[800] bg-black/80 border border-slate-600 rounded-lg px-4 py-3 pointer-events-none">
                    <div className="text-2xl font-bold text-orange-500 tabular-nums">{year} CE</div>
                    <div className="text-xs text-slate-400 mt-0.5">{phase}</div>
                </div>
            )}

            {/* Event feed */}
            {nearbyEvents.length > 0 && (
                <div className="absolute top-3 right-3 z-[800] bg-black/80 border border-slate-600 rounded-lg px-3 py-2 max-w-[260px] pointer-events-none">
                    <div className="text-xs text-slate-500 mb-1">Nearby events</div>
                    {nearbyEvents.slice(0, 4).map((evt: any, i: number) => (
                        <div key={i} className="text-xs text-slate-300 py-0.5 border-t border-slate-700/50 first:border-0">
                            <span className="text-orange-400 tabular-nums mr-1">{evt.year}</span>
                            {evt.title}
                        </div>
                    ))}
                </div>
            )}

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
                    className="flex-1 accent-orange-500 cursor-pointer"
                />

                <span className="text-xs text-slate-400 tabular-nums w-16 text-right">{year} CE</span>

                <select
                    value={speed}
                    onChange={e => setSpeed(+e.target.value)}
                    className="rounded border border-slate-600 bg-slate-800 text-slate-300 text-xs px-1.5 py-1"
                >
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                    <option value={5}>5×</option>
                    <option value={10}>10×</option>
                </select>
            </div>
        </div>
    )
}
