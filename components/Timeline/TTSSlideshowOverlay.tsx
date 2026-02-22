'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import type { TTSState } from '@/lib/hooks/useTTS'
import type { TimelineEntry } from '@/components/TimelineContext'

const KEN_BURNS = [
    'animate-ken-burns-zoom-in',
    'animate-ken-burns-zoom-out',
    'animate-ken-burns-pan-right',
    'animate-ken-burns-pan-left',
]

interface SlideshowImage {
    src: string
    eventId: string
}

interface TTSSlideshowOverlayProps {
    ttsState: TTSState
    availableVoices: SpeechSynthesisVoice[]
    onPause: () => void
    onNext: () => void
    onPrev: () => void
    onStop: () => void
    onSetVoice: (v: SpeechSynthesisVoice) => void
    onSetRate: (r: number) => void
    onSetLangFilter: (l: string) => void
    onSetLocalOnly: (b: boolean) => void
    events: TimelineEntry[]
    baseUrl: string
    /** Index into `events` where TTS started */
    startEventIndex: number
    onSelectEvent: (entry: TimelineEntry) => void
}

const RATES = [0.75, 1.0, 1.25, 1.5, 2.0]

export function TTSSlideshowOverlay({
    ttsState,
    availableVoices,
    onPause,
    onNext,
    onPrev,
    onStop,
    onSetVoice,
    onSetRate,
    onSetLangFilter,
    onSetLocalOnly,
    events,
    baseUrl,
    startEventIndex,
    onSelectEvent,
}: TTSSlideshowOverlayProps) {
    const [showControls, setShowControls] = useState(true)
    const lastInteractionRef = useRef(Date.now())
    const [currentImgIndex, setCurrentImgIndex] = useState(0)
    const prevImgIndexRef = useRef(-1)
    const [fadeIn, setFadeIn] = useState(true)

    // Build flat image list from startEventIndex through all events
    const allImages = useMemo<SlideshowImage[]>(() => {
        return events.slice(startEventIndex).flatMap(ev =>
            (ev.media || []).map(path => ({
                src: `${baseUrl}${path}`,
                eventId: ev.id,
            }))
        )
    }, [events, baseUrl, startEventIndex])

    // Map eventId -> first image index in allImages
    const eventToFirstImgIndex = useMemo(() => {
        const map = new Map<string, number>()
        allImages.forEach((img, i) => {
            if (!map.has(img.eventId)) map.set(img.eventId, i)
        })
        return map
    }, [allImages])

    // When TTS moves to a new segment, jump to that event's first image
    const prevSegIndexRef = useRef(ttsState.currentSegmentIndex)
    useEffect(() => {
        const seg = ttsState.currentSegmentIndex
        if (seg === prevSegIndexRef.current || seg < 0) return
        prevSegIndexRef.current = seg
        const event = ttsState.segments[seg]
        if (!event) return
        const imgIdx = eventToFirstImgIndex.get(event.id)
        if (imgIdx != null) {
            prevImgIndexRef.current = currentImgIndex
            setCurrentImgIndex(imgIdx)
        }
    }, [ttsState.currentSegmentIndex, ttsState.segments, eventToFirstImgIndex, currentImgIndex])

    // Cycle images on interval; duration = 8s / rate (faster speech = faster images)
    const intervalMs = Math.round(8000 / ttsState.rate)
    useEffect(() => {
        if (allImages.length <= 1) return
        const t = setInterval(() => {
            setCurrentImgIndex(i => (i + 1) % allImages.length)
        }, intervalMs)
        return () => clearInterval(t)
    }, [allImages.length, intervalMs])

    // Cross-fade: trigger opacity reset on image change
    useEffect(() => {
        setFadeIn(false)
        const t = setTimeout(() => setFadeIn(true), 50)
        return () => clearTimeout(t)
    }, [currentImgIndex])

    // Auto-hide controls after 3s idle
    useEffect(() => {
        const t = setInterval(() => {
            if (Date.now() - lastInteractionRef.current > 3000) setShowControls(false)
        }, 1000)
        return () => clearInterval(t)
    }, [])

    const handleInteraction = useCallback(() => {
        setShowControls(true)
        lastInteractionRef.current = Date.now()
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onStop()
            if (e.key === ' ') { e.preventDefault(); onPause() }
            if (e.key === 'ArrowRight') onNext()
            if (e.key === 'ArrowLeft') onPrev()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onStop, onPause, onNext, onPrev])

    if (ttsState.currentSegmentIndex < 0) return null

    const currentSeg = ttsState.segments[ttsState.currentSegmentIndex]
    const currentImg = allImages[currentImgIndex]
    const animClass = KEN_BURNS[currentImgIndex % KEN_BURNS.length]
    const slideshowDuration = `${Math.round(intervalMs / 1000)}s`

    // Filtered voices for dropdowns
    const filteredVoices = availableVoices
        .filter(v => ttsState.langFilter === 'all' || v.lang.startsWith(ttsState.langFilter))
        .filter(v => !ttsState.localOnly || v.localService)

    // Current event for jump select
    const segmentEvents = ttsState.segments.map(seg => {
        const idx = startEventIndex + ttsState.segments.findIndex(s => s.id === seg.id)
        return { seg, entry: events[idx] ?? null }
    })

    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            className="fixed inset-0 z-[300] bg-black overflow-hidden"
            onMouseMove={handleInteraction}
            onClick={handleInteraction}
            style={{ cursor: showControls ? 'default' : 'none' }}
        >
            {/* ── Background Ken Burns Slideshow ── */}
            <div className="absolute inset-0">
                {currentImg ? (
                    <div
                        key={currentImgIndex}
                        className="absolute inset-0"
                        style={{ '--slideshow-duration': slideshowDuration } as React.CSSProperties}
                    >
                        {/* Static base image */}
                        <div
                            className="absolute inset-0 bg-center bg-contain bg-no-repeat"
                            style={{ backgroundImage: `url(${currentImg.src})` }}
                        />
                        {/* Animated Ken Burns layer */}
                        <div
                            className={`absolute inset-0 bg-center bg-contain bg-no-repeat ${animClass}`}
                            style={{
                                backgroundImage: `url(${currentImg.src})`,
                                opacity: fadeIn ? 1 : 0,
                                transition: 'opacity 1s ease-in-out',
                            }}
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
                )}
                {/* Dark vignette */}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* ── Subtitle ── */}
            {ttsState.currentChunkText && (
                <div className="absolute bottom-28 inset-x-0 z-10 flex justify-center px-6 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-sm text-white text-lg md:text-xl font-medium px-8 py-4 rounded-xl max-w-4xl text-center leading-relaxed drop-shadow-lg">
                        {ttsState.currentChunkText}
                    </div>
                </div>
            )}

            {/* ── Top bar ── */}
            <div
                className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-5 bg-gradient-to-b from-black/70 to-transparent transition-transform duration-500 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="flex flex-col min-w-0 mr-4">
                    <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Timeline Audio</span>
                    <span className="text-white font-semibold text-lg truncate drop-shadow-md">
                        {currentSeg?.title ?? ''}
                    </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Jump-to-event select */}
                    {ttsState.segments.length > 1 && (
                        <select
                            value={ttsState.currentSegmentIndex}
                            onChange={e => {
                                const idx = parseInt(e.target.value)
                                const entry = events[startEventIndex + idx]
                                if (entry) onSelectEvent(entry)
                                onNext() // trigger play at new index via parent
                            }}
                            className="bg-black/50 border border-white/20 text-white text-xs rounded px-2 py-1 max-w-[160px] truncate"
                        >
                            {ttsState.segments.map((seg, i) => (
                                <option key={seg.id} value={i} className="bg-slate-900">{seg.title}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={e => { e.stopPropagation(); onStop() }}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all pointer-events-auto"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* ── Bottom controls ── */}
            <div
                className={`absolute bottom-0 inset-x-0 z-20 flex flex-col items-center gap-4 px-6 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent transition-transform duration-500 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}
            >
                {/* Transport */}
                <div className="flex items-center gap-6 pointer-events-auto">
                    <button
                        onClick={e => { e.stopPropagation(); onPrev() }}
                        className="text-white/60 hover:text-white transition-colors"
                        aria-label="Previous event"
                    >
                        <SkipBack size={32} />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onPause() }}
                        className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-500/30 transition-all"
                        aria-label={ttsState.isPlaying ? 'Pause' : 'Resume'}
                    >
                        {ttsState.isPlaying
                            ? <Pause size={28} fill="currentColor" />
                            : <Play  size={28} fill="currentColor" className="ml-1" />
                        }
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onNext() }}
                        className="text-white/60 hover:text-white transition-colors"
                        aria-label="Next event"
                    >
                        <SkipForward size={32} />
                    </button>
                </div>

                {/* Settings strip */}
                <div className="flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                        <span className="text-white/40 text-[10px] uppercase font-bold">Lang</span>
                        <select
                            value={ttsState.langFilter}
                            onChange={e => { e.stopPropagation(); onSetLangFilter(e.target.value) }}
                            className="bg-transparent text-white text-xs outline-none cursor-pointer"
                        >
                            {['en', 'de', 'fr', 'es', 'ja', 'zh', 'all'].map(l => (
                                <option key={l} value={l} className="bg-slate-900">{l}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={e => { e.stopPropagation(); onSetLocalOnly(!ttsState.localOnly) }}
                        className={`bg-black/40 backdrop-blur-md border rounded-lg px-3 py-2 text-[10px] uppercase font-bold transition-colors ${ttsState.localOnly ? 'border-indigo-500 text-indigo-400' : 'border-white/10 text-white/40'}`}
                    >
                        Local only
                    </button>

                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                        <span className="text-white/40 text-[10px] uppercase font-bold">Voice</span>
                        <select
                            value={ttsState.voice?.name ?? ''}
                            onChange={e => {
                                e.stopPropagation()
                                const v = availableVoices.find(v => v.name === e.target.value)
                                if (v) onSetVoice(v)
                            }}
                            className="bg-transparent text-white text-xs outline-none cursor-pointer max-w-[140px] truncate"
                        >
                            {filteredVoices.map(v => (
                                <option key={v.name} value={v.name} className="bg-slate-900">
                                    {v.name.replace('Google ', '')} {v.localService ? '🏠' : '🌐'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                        <span className="text-white/40 text-[10px] uppercase font-bold">Speed</span>
                        <select
                            value={ttsState.rate}
                            onChange={e => { e.stopPropagation(); onSetRate(parseFloat(e.target.value)) }}
                            className="bg-transparent text-white text-xs outline-none cursor-pointer"
                        >
                            {RATES.map(r => (
                                <option key={r} value={r} className="bg-slate-900">{r}x</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Image counter */}
                {allImages.length > 0 && (
                    <span className="text-white/25 text-xs font-mono">
                        {currentImgIndex + 1} / {allImages.length} images
                    </span>
                )}
            </div>
        </div>
    )
}
