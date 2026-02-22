'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import type { TTSState, SubtitleMode } from '@/lib/hooks/useTTS'
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
    onSetSubtitleMode: (m: SubtitleMode) => void
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
    onSetSubtitleMode,
    events,
    baseUrl,
    startEventIndex,
    onSelectEvent,
}: TTSSlideshowOverlayProps) {
    const [showControls, setShowControls] = useState(true)
    const lastInteractionRef = useRef(Date.now())
    const [currentImgIndex, setCurrentImgIndex] = useState(0)
    const [animCycle, setAnimCycle] = useState(0)  // 0, 1, 2 — three animation passes per image
    const ANIM_PASSES = 3
    const prevImgIndexRef = useRef(-1)
    // Dual-layer crossfade: layer A and layer B alternate as foreground
    const [layerA, setLayerA] = useState<{ imgIndex: number; animCycle: number } | null>({ imgIndex: 0, animCycle: 0 })
    const [layerB, setLayerB] = useState<{ imgIndex: number; animCycle: number } | null>(null)
    const [activeFront, setActiveFront] = useState<'A' | 'B'>('A')  // which layer is currently fading in
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const activeSentenceRef = useRef<HTMLParagraphElement>(null)

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
            setAnimCycle(0)
        }
    }, [ttsState.currentSegmentIndex, ttsState.segments, eventToFirstImgIndex, currentImgIndex])

    // Cycle animations on interval; each image gets ANIM_PASSES different animations before advancing
    const intervalMs = Math.round(8000 / ttsState.rate)
    useEffect(() => {
        if (allImages.length === 0) return
        const t = setInterval(() => {
            setAnimCycle(prev => {
                const next = prev + 1
                if (next >= ANIM_PASSES) {
                    // Advance to next image
                    setCurrentImgIndex(i => (i + 1) % allImages.length)
                    return 0
                }
                return next
            })
        }, intervalMs)
        return () => clearInterval(t)
    }, [allImages.length, intervalMs, ANIM_PASSES])

    // Cross-fade: push new image/anim onto the back layer, then flip it to front
    useEffect(() => {
        const payload = { imgIndex: currentImgIndex, animCycle }
        if (activeFront === 'A') {
            setLayerB(payload)
            // Small delay so the browser paints the new layer at opacity 0 first
            const t = setTimeout(() => setActiveFront('B'), 60)
            return () => clearTimeout(t)
        } else {
            setLayerA(payload)
            const t = setTimeout(() => setActiveFront('A'), 60)
            return () => clearTimeout(t)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentImgIndex, animCycle])

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

    // Auto-scroll to active sentence in scroll mode
    useEffect(() => {
        if (ttsState.subtitleMode !== 'scroll') return
        activeSentenceRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        })
    }, [ttsState.currentSentenceIndex, ttsState.subtitleMode])

    if (ttsState.currentSegmentIndex < 0) return null

    const currentSeg = ttsState.segments[ttsState.currentSegmentIndex]
    // Pick a different animation for each pass (offset by image index so sequential images don't repeat)
    const slideshowDuration = `${Math.round(intervalMs / 1000)}s`

    // Helper to render a slideshow layer (used for A/B crossfade)
    const renderLayer = (layer: { imgIndex: number; animCycle: number } | null, isFront: boolean) => {
        if (!layer) return null
        const img = allImages[layer.imgIndex]
        if (!img) return null
        const anim = KEN_BURNS[(layer.imgIndex + layer.animCycle) % KEN_BURNS.length]
        return (
            <div
                key={`layer-${layer.imgIndex}-${layer.animCycle}`}
                className="absolute inset-0"
                style={{
                    '--slideshow-duration': slideshowDuration,
                    opacity: isFront ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                    zIndex: isFront ? 2 : 1,
                } as React.CSSProperties}
            >
                <div
                    className={`absolute inset-0 bg-center bg-contain bg-no-repeat ${anim}`}
                    style={{ backgroundImage: `url(${img.src})` }}
                />
            </div>
        )
    }

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
            {/* ── Background Ken Burns Slideshow (dual-layer crossfade) ── */}
            <div className="absolute inset-0">
                {allImages.length > 0 ? (
                    <>
                        {renderLayer(layerA, activeFront === 'A')}
                        {renderLayer(layerB, activeFront === 'B')}
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
                )}
                {/* Dark vignette */}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* ── Subtitle / Transcription ── */}
            {ttsState.sentences.length > 0 && (
                <div className="absolute bottom-28 inset-x-0 z-10 flex justify-center px-6 pointer-events-none">
                    {ttsState.subtitleMode === 'caption' ? (
                        /* Caption mode: single current sentence */
                        <div className="bg-black/60 backdrop-blur-sm text-white text-lg md:text-xl font-medium px-8 py-4 rounded-xl max-w-4xl text-center leading-relaxed drop-shadow-lg">
                            {ttsState.sentences[Math.max(0, ttsState.currentSentenceIndex)] ?? ''}
                        </div>
                    ) : (
                        /* Scroll mode: all sentences, auto-scroll to current */
                        <div
                            ref={scrollContainerRef}
                            className="bg-black/60 backdrop-blur-sm rounded-xl max-w-4xl w-full max-h-[25vh] overflow-y-auto px-8 py-4 pointer-events-auto scroll-smooth"
                        >
                            {ttsState.sentences.map((s, i) => (
                                <p
                                    key={i}
                                    ref={i === ttsState.currentSentenceIndex ? activeSentenceRef : undefined}
                                    className={`text-base md:text-lg leading-relaxed transition-colors duration-300 mb-1 ${i === ttsState.currentSentenceIndex
                                            ? 'text-white font-semibold'
                                            : i < ttsState.currentSentenceIndex
                                                ? 'text-white/30'
                                                : 'text-white/50'
                                        }`}
                                >
                                    {s}
                                </p>
                            ))}
                        </div>
                    )}
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
                            : <Play size={28} fill="currentColor" className="ml-1" />
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

                    <button
                        onClick={e => {
                            e.stopPropagation()
                            onSetSubtitleMode(ttsState.subtitleMode === 'caption' ? 'scroll' : 'caption')
                        }}
                        className={`bg-black/40 backdrop-blur-md border rounded-lg px-3 py-2 text-[10px] uppercase font-bold transition-colors ${ttsState.subtitleMode === 'scroll' ? 'border-indigo-500 text-indigo-400' : 'border-white/10 text-white/40'}`}
                    >
                        {ttsState.subtitleMode === 'caption' ? 'Caption' : 'Transcript'}
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
