'use client'

/**
 * AnimationPlanetView — React wrapper for the Three.js Saturnian cosmology scene.
 * BC timeline (-5000 to -670): Shows the collinear configuration breakup,
 * Jupiter's assault, the Deluge, and eventual solar system stabilization.
 *
 * Uses dynamic imports for SSR safety (Three.js requires canvas/WebGL).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface AnimationPlanetViewProps {
    onSelectEvent?: (id: string) => void
}

const MIN_YEAR = -5000
const MAX_YEAR = -670

export function AnimationPlanetView({ onSelectEvent }: AnimationPlanetViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctrlRef = useRef<any>(null)
    const [year, setYear] = useState(MIN_YEAR)
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

        async function init() {
            const { createPlanetController } = await import('paradigm-threat-animation')
            if (cancelled || !canvasRef.current) return

            const ctrl = await createPlanetController(canvasRef.current)
            if (cancelled) { ctrl.destroy(); return }

            ctrlRef.current = ctrl
            ctrl.setYear(MIN_YEAR)
            setPhaseInfo(ctrl.getPhaseInfo())
            setReady(true)
        }

        init()
        return () => {
            cancelled = true
            ctrlRef.current?.destroy()
            ctrlRef.current = null
        }
    }, [])

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
            {/* 3D canvas */}
            <canvas ref={canvasRef} className="flex-1 min-h-0 w-full" style={{ minHeight: 300 }} />

            {/* Phase overlay */}
            {ready && (
                <div className="absolute top-3 left-3 z-[800] bg-black/80 border border-slate-600 rounded-lg px-4 py-3 pointer-events-none max-w-[340px]">
                    <div className="text-2xl font-bold text-purple-400 tabular-nums">{formatBCE(year)}</div>
                    <div className="text-sm text-slate-200 mt-1 font-semibold">{phaseInfo.label}</div>
                    <div className="text-xs text-slate-400 mt-1 leading-relaxed">{phaseInfo.description}</div>
                </div>
            )}

            {/* Orbit counter */}
            {ready && Object.keys(orbitInfo).length > 0 && (
                <div className="absolute bottom-16 left-3 z-[800] bg-black/80 border border-slate-600 rounded-lg px-3 py-2 pointer-events-none">
                    <div className="text-xs text-slate-500 mb-1">Orbits (this era)</div>
                    {Object.entries(orbitInfo).map(([name, count]) => (
                        <div key={name} className="text-xs text-slate-300 py-0.5 flex justify-between gap-3">
                            <span className="text-purple-400 capitalize">{name}</span>
                            <span className="tabular-nums">{count.toFixed(1)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Event feed */}
            {nearbyEvents.length > 0 && (
                <div className="absolute top-3 right-3 z-[800] bg-black/80 border border-slate-600 rounded-lg px-3 py-2 max-w-[260px] pointer-events-none">
                    <div className="text-xs text-slate-500 mb-1">Nearby events</div>
                    {nearbyEvents.slice(0, 4).map((evt: any, i: number) => (
                        <div key={i} className="text-xs text-slate-300 py-0.5 border-t border-slate-700/50 first:border-0">
                            <span className="text-purple-400 tabular-nums mr-1">{formatBCE(evt.year)}</span>
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
