'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import type { TTSState, SubtitleMode, PiperVoice, TTSProvider } from '@/lib/hooks/useTTS'
import type { TimelineEntry } from '@/components/TimelineContext'
import { getEventYearForSim, formatEventLabelWithDate } from './utils'
import { isTimelineBookIllustrationMedia, timelineMediaPath } from '@/lib/timelineMedia'

const KEN_BURNS = [
    'animate-ken-burns-zoom-in',
    'animate-ken-burns-zoom-out',
    'animate-ken-burns-pan-right',
    'animate-ken-burns-pan-left',
]

interface SlideshowImage {
    src: string
    eventId: string
    type?: 'image' | 'planet'
}

const PLANET_ANIM_PASSES = 8  // ~64s at 1.0× rate → several orbits

function clampSeek(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}
const PLANET_BC_MIN = -5000
const PLANET_BC_MAX = -670
// Per-chapter order: 1st image → planet sim → remaining images → loop (see ANIMATION_TRACKER §2.7)

interface TTSSlideshowOverlayProps {
    ttsState: TTSState
    availableVoices: SpeechSynthesisVoice[]
    availablePiperVoices: PiperVoice[]
    onPause: () => void
    onNext: () => void
    onPrev: () => void
    onStop: () => void
    onClearError: () => void
    onSetVoice: (v: SpeechSynthesisVoice) => void
    onSetRate: (r: number) => void
    onSetLangFilter: (l: string) => void
    onSetLocalOnly: (b: boolean) => void
    onSetSubtitleMode: (m: SubtitleMode) => void
    onSetProvider: (p: TTSProvider) => void
    onSetPiperVoiceId: (id: string) => void
    onSetPiperLang: (lang: string) => void
    onSetQuoteVoiceId: (id: string) => void
    onSetSpeakerMapInput: (input: string) => void
    events: TimelineEntry[]
    /** Hierarchical entries for parent-year inheritance; omit if not available */
    entries?: TimelineEntry[]
    baseUrl: string
    /** Index into `events` where TTS started */
    startEventIndex: number
    onSelectEvent: (entry: TimelineEntry) => void
    /** Jump TTS to a specific segment index without rebuilding the segment list */
    onSeekToSegment: (segmentIndex: number) => void
    /** Jump to sentence index in current chapter and resume playback */
    onSeekToSentence: (sentenceIndex: number) => void
    /** Restart TTS from an event before the current start (rebuilds segments) */
    onRestartFromEvent?: (entry: TimelineEntry) => void
    /** Switch to Speech API and resume playback from the failed segment */
    onSwitchToSpeechAndResume?: () => void
    /** When true, do not append the planet animation slide (e.g. for article pages) */
    skipPlanetSlide?: boolean
}

const RATES = [0.75, 1.0, 1.25, 1.5, 2.0]

export function TTSSlideshowOverlay({
    ttsState,
    availableVoices,
    availablePiperVoices,
    onPause,
    onNext,
    onPrev,
    onStop,
    onClearError,
    onSetVoice,
    onSetRate,
    onSetLangFilter,
    onSetLocalOnly,
    onSetSubtitleMode,
    onSetProvider,
    onSetPiperVoiceId,
    onSetPiperLang,
    onSetQuoteVoiceId,
    onSetSpeakerMapInput,
    events,
    entries = [],
    baseUrl,
    startEventIndex,
    onSelectEvent,
    onSeekToSegment,
    onSeekToSentence,
    onRestartFromEvent,
    onSwitchToSpeechAndResume,
    skipPlanetSlide = false,
}: TTSSlideshowOverlayProps) {
    const [showControls, setShowControls] = useState(true)
    const lastInteractionRef = useRef(Date.now())
    const controlsFocusedRef = useRef(false)
    /** Last pointer pos for idle — ignore sub-pixel jitter (F11 fullscreen never gets mouse-leave) */
    const lastPointerForIdleRef = useRef<{ x: number; y: number } | null>(null)
    const overlayRootRef = useRef<HTMLDivElement>(null)
    const POINTER_IDLE_THRESHOLD_PX = 14

    const [seekValue, setSeekValue] = useState<number | null>(null)
    const seekScrubRef = useRef<number | null>(null)
    const totalSentences = ttsState.sentences.length
    const currentSentenceIndex = ttsState.currentSentenceIndex ?? 0
    const displaySentenceIndex =
        seekValue !== null ? seekValue : clampSeek(currentSentenceIndex, 0, Math.max(0, totalSentences - 1))

    useEffect(() => {
        setSeekValue(null)
        seekScrubRef.current = null
    }, [ttsState.currentSegmentIndex, totalSentences])

    const commitSentenceSeek = useCallback(() => {
        const v = seekScrubRef.current
        seekScrubRef.current = null
        setSeekValue(null)
        if (v !== null && totalSentences > 0) {
            onSeekToSentence(clampSeek(v, 0, totalSentences - 1))
        }
    }, [onSeekToSentence, totalSentences])
    const [currentImgIndex, setCurrentImgIndex] = useState(0)
    const currentImgIndexRef = useRef(0)
    const [animCycle, setAnimCycle] = useState(0)  // 0, 1, 2 — three animation passes per image
    const ANIM_PASSES = 3
    const prevImgIndexRef = useRef(-1)
    // Dual-layer crossfade: layer A and layer B alternate as foreground
    // Both layers always have content — never null — to prevent black flashes
    const [layerA, setLayerA] = useState<{ imgIndex: number; animCycle: number }>({ imgIndex: 0, animCycle: 0 })
    const [layerB, setLayerB] = useState<{ imgIndex: number; animCycle: number }>({ imgIndex: 0, animCycle: 0 })
    const [activeFront, setActiveFront] = useState<'A' | 'B'>('A')
    const preloadedUrls = useRef(new Set<string>())
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const activeSentenceRef = useRef<HTMLParagraphElement>(null)

    // Only current chapter's slides — loop within chapter, no cross-chapter (ANIMATION_TRACKER §2.7)
    const allImages = useMemo<SlideshowImage[]>(() => {
        const seg = ttsState.currentSegmentIndex
        const eventId = ttsState.segments[seg]?.id
        const ev = eventId ? events.find(e => e.id === eventId) : null
        if (!ev) return []
        if (skipPlanetSlide) {
            return (ev.media || [])
                .filter((entry) => !isTimelineBookIllustrationMedia(entry))
                .map((entry) => {
                    const p = timelineMediaPath(entry)
                    return p ? { src: `${baseUrl}${p}`, eventId: ev.id } : null
                })
                .filter((x): x is SlideshowImage => x !== null)
        }
        const imgs = (ev.media || [])
            .filter((entry) => !isTimelineBookIllustrationMedia(entry))
            .map((entry) => {
                const p = timelineMediaPath(entry)
                return p ? { src: `${baseUrl}${p}`, eventId: ev.id } : null
            })
            .filter((x): x is SlideshowImage => x !== null)
        if (imgs.length === 0) {
            return [{ src: '', eventId: ev.id, type: 'planet' }]  // chapter with no images: planet only
        }
        return [
            imgs[0],                                    // 1. first image
            { src: '', eventId: ev.id, type: 'planet' }, // 2. planet sim
            ...imgs.slice(1),                           // 3. remaining images
        ]
    }, [events, baseUrl, ttsState.currentSegmentIndex, ttsState.segments, skipPlanetSlide])

    // Keep ref in sync for use inside setAnimCycle callback
    useEffect(() => { currentImgIndexRef.current = currentImgIndex }, [currentImgIndex])

    const isPlanetSlide = allImages[currentImgIndex]?.type === 'planet'

    const planetInitialYear = useMemo(() => {
        if (!isPlanetSlide) return PLANET_BC_MIN
        const eventId = allImages[currentImgIndex]?.eventId
        if (!eventId) return PLANET_BC_MIN
        const evt = events.find(e => e.id === eventId)
        return getEventYearForSim(evt ?? null, entries)
    }, [isPlanetSlide, currentImgIndex, allImages, events, entries])

    // When TTS moves to a new segment, reset to first slide (image) of that chapter
    const prevSegIndexRef = useRef(ttsState.currentSegmentIndex)
    useEffect(() => {
        const seg = ttsState.currentSegmentIndex
        if (seg === prevSegIndexRef.current || seg < 0) return
        prevSegIndexRef.current = seg
        prevImgIndexRef.current = currentImgIndex
        setCurrentImgIndex(0)
        setAnimCycle(0)
    }, [ttsState.currentSegmentIndex, currentImgIndex])

    // Cycle animations on interval; each image gets ANIM_PASSES different animations before advancing
    // Planet slide gets PLANET_ANIM_PASSES (longer duration for several orbits)
    const intervalMs = Math.round(8000 / ttsState.rate)
    useEffect(() => {
        if (allImages.length === 0) return
        const t = setInterval(() => {
            setAnimCycle(prev => {
                const next = prev + 1
                const onPlanet = allImages[currentImgIndexRef.current]?.type === 'planet'
                const maxPasses = onPlanet ? PLANET_ANIM_PASSES : ANIM_PASSES
                if (next >= maxPasses) {
                    // Advance to next image
                    setCurrentImgIndex(i => (i + 1) % allImages.length)
                    return 0
                }
                return next
            })
        }, intervalMs)
        return () => clearInterval(t)
    }, [allImages, intervalMs, ANIM_PASSES])

    // Preload the next few images so crossfade never reveals an unloaded src
    useEffect(() => {
        if (allImages.length === 0) return
        // Preload current + next 2 images (skip planet sentinel)
        for (let offset = 0; offset <= 2; offset++) {
            const idx = (currentImgIndex + offset) % allImages.length
            const entry = allImages[idx]
            if (entry?.type === 'planet') continue
            const url = entry?.src
            if (url && !preloadedUrls.current.has(url)) {
                const img = new Image()
                img.src = url
                preloadedUrls.current.add(url)
            }
        }
    }, [currentImgIndex, allImages])

    // Cross-fade: push new image/anim onto the back layer, then flip it to front
    // Uses double-rAF to guarantee the browser has painted the hidden layer before we transition
    useEffect(() => {
        const payload = { imgIndex: currentImgIndex, animCycle }
        let rafId1: number, rafId2: number
        if (activeFront === 'A') {
            setLayerB(payload)
            // Double-rAF: first frame paints the new layer at opacity 0, second frame triggers crossfade
            rafId1 = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => setActiveFront('B'))
            })
        } else {
            setLayerA(payload)
            rafId1 = requestAnimationFrame(() => {
                rafId2 = requestAnimationFrame(() => setActiveFront('A'))
            })
        }
        return () => { cancelAnimationFrame(rafId1); cancelAnimationFrame(rafId2) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentImgIndex, animCycle])

    // Auto-hide controls after 3s idle (skip while a dropdown/input is focused)
    useEffect(() => {
        const t = setInterval(() => {
            if (controlsFocusedRef.current) return
            if (Date.now() - lastInteractionRef.current <= 3000) return
            setShowControls(false)
            // Drop focus from selects/inputs so controlsFocusedRef cannot stay true off-screen
            const root = overlayRootRef.current
            const ae = document.activeElement
            if (root && ae instanceof HTMLElement && root.contains(ae) && ae !== root) {
                ae.blur()
                controlsFocusedRef.current = false
            }
        }, 500)
        return () => clearInterval(t)
    }, [])

    const handleInteraction = useCallback(() => {
        setShowControls(true)
        lastInteractionRef.current = Date.now()
    }, [])

    const handlePointerMoveForIdle = useCallback((e: React.MouseEvent) => {
        const { clientX: x, clientY: y } = e
        const prev = lastPointerForIdleRef.current
        if (prev == null) {
            lastPointerForIdleRef.current = { x, y }
            return
        }
        const dx = x - prev.x
        const dy = y - prev.y
        if (dx * dx + dy * dy < POINTER_IDLE_THRESHOLD_PX * POINTER_IDLE_THRESHOLD_PX) return
        lastPointerForIdleRef.current = { x, y }
        setShowControls(true)
        lastInteractionRef.current = Date.now()
    }, [])

    const handleControlsFocus = useCallback(() => {
        controlsFocusedRef.current = true
        setShowControls(true)
        lastInteractionRef.current = Date.now()
    }, [])

    const handleControlsBlur = useCallback(() => {
        controlsFocusedRef.current = false
        lastInteractionRef.current = Date.now()
    }, [])

    // Keyboard shortcuts (also surface controls like mouse click)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowControls(true)
                lastInteractionRef.current = Date.now()
                onStop()
            }
            if (e.key === ' ') {
                e.preventDefault()
                setShowControls(true)
                lastInteractionRef.current = Date.now()
                onPause()
            }
            if (e.key === 'ArrowRight') {
                setShowControls(true)
                lastInteractionRef.current = Date.now()
                onNext()
            }
            if (e.key === 'ArrowLeft') {
                setShowControls(true)
                lastInteractionRef.current = Date.now()
                onPrev()
            }
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

    if (ttsState.currentSegmentIndex < 0 && !ttsState.error) return null

    // When stopped with an error, show a minimal error overlay instead of the full slideshow
    if (ttsState.currentSegmentIndex < 0 && ttsState.error) {
        return (
            <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center">
                <div className="max-w-lg w-full mx-6">
                    <div className="bg-red-950/80 border border-red-500/50 text-red-100 px-6 py-5 rounded-xl flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div>
                                <p className="font-semibold text-sm mb-1">Piper TTS Error</p>
                                <p className="text-sm text-red-200/80">{ttsState.error}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            {ttsState.provider === 'piper' && ttsState.piperFallbackOffer && onSwitchToSpeechAndResume && (
                                <button
                                    onClick={onSwitchToSpeechAndResume}
                                    className="bg-indigo-600/80 hover:bg-indigo-500/90 text-white text-xs uppercase tracking-widest px-4 py-2 rounded transition-colors"
                                >
                                    Switch to Speech API &amp; Resume
                                </button>
                            )}
                            {ttsState.provider === 'piper' && !ttsState.piperFallbackOffer && (
                                <button
                                    onClick={() => { onClearError(); onSetProvider('webSpeech') }}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs uppercase tracking-widest px-4 py-2 rounded transition-colors"
                                >
                                    Switch to Speech API
                                </button>
                            )}
                            <button
                                onClick={() => { onClearError(); onStop() }}
                                className="bg-white/10 hover:bg-white/20 text-white text-xs uppercase tracking-widest px-4 py-2 rounded transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const currentSeg = ttsState.segments[ttsState.currentSegmentIndex]
    // Pick a different animation for each pass (offset by image index so sequential images don't repeat)
    const slideshowDuration = `${Math.round(intervalMs / 1000)}s`

    // Helper to render a slideshow layer (used for A/B crossfade)
    // Both layers are ALWAYS rendered (never null) to prevent black flashes
    const renderLayer = (layer: { imgIndex: number; animCycle: number }, isFront: boolean, layerId: string) => {
        const img = allImages[layer.imgIndex]
        if (!img) return <div className="absolute inset-0" />
        // Planet slide: render dark bg (canvas is overlaid separately)
        if (img.type === 'planet') {
            return (
                <div
                    key={`${layerId}-planet`}
                    className="absolute inset-0 bg-black"
                    style={{
                        opacity: isFront ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out',
                        zIndex: isFront ? 2 : 1,
                    }}
                />
            )
        }
        const anim = KEN_BURNS[(layer.imgIndex + layer.animCycle) % KEN_BURNS.length]
        return (
            <div
                key={`${layerId}-${layer.imgIndex}-${layer.animCycle}`}
                className="absolute inset-0"
                style={{
                    '--slideshow-duration': slideshowDuration,
                    opacity: isFront ? 1 : 0,
                    transition: 'opacity 1.5s ease-in-out',
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

    const filteredPiperVoices = availablePiperVoices

    // Current segment's event id for select value
    const currentSegId = ttsState.segments[ttsState.currentSegmentIndex]?.id ?? null

    return (
         
        <div
            ref={overlayRootRef}
            className="fixed inset-0 z-[300] bg-black overflow-hidden"
            onMouseMove={handlePointerMoveForIdle}
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
            style={{ cursor: showControls ? 'default' : 'none' }}
        >
            {/* ── Background Ken Burns Slideshow (dual-layer crossfade) ── */}
            <div className="absolute inset-0">
                {allImages.length > 0 ? (
                    <>
                        {renderLayer(layerA, activeFront === 'A', 'A')}
                        {renderLayer(layerB, activeFront === 'B', 'B')}
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
                )}
                {/* Planet animation canvas overlay — fixed inset-0 + z-[5] so it fills viewport and stays above crossfade layers (z 1–2) */}
                {isPlanetSlide && (
                    <div className="fixed inset-0 z-[5]">
                        <PlanetSlideCanvas active initialYear={planetInitialYear} />
                    </div>
                )}
                {/* Dark vignette (skip when planet canvas is showing) */}
                {!isPlanetSlide && <div className="absolute inset-0 bg-black/40" />}
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

            {ttsState.error && (
                <div className="absolute top-20 inset-x-0 z-30 flex justify-center px-6 pointer-events-auto">
                    <div className="bg-red-950/70 border border-red-500/40 text-red-100 px-5 py-3 rounded-xl max-w-3xl text-sm flex items-center gap-4">
                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{ttsState.error}</span>
                        {ttsState.provider === 'piper' && ttsState.piperFallbackOffer && onSwitchToSpeechAndResume && (
                            <button
                                onClick={onSwitchToSpeechAndResume}
                                className="ml-auto bg-indigo-600/80 hover:bg-indigo-500/90 text-white text-xs uppercase tracking-widest px-3 py-2 rounded whitespace-nowrap"
                            >
                                Speech API &amp; Resume
                            </button>
                        )}
                        {ttsState.provider === 'piper' && !ttsState.piperFallbackOffer && (
                            <button
                                onClick={() => onSetProvider('webSpeech')}
                                className="ml-auto bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs uppercase tracking-widest px-3 py-2 rounded"
                            >
                                Use Speech API
                            </button>
                        )}
                        <button
                            onClick={onClearError}
                            className="text-red-300/60 hover:text-red-100 transition-colors"
                            aria-label="Dismiss error"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Top bar ── */}
            <div
                className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-5 bg-gradient-to-b from-black/70 to-transparent transition-transform duration-500 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}
                onFocus={handleControlsFocus}
                onBlur={handleControlsBlur}
            >
                <div className="flex flex-col min-w-0 mr-4">
                    <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Timeline Audio</span>
                    <span className="text-white font-semibold text-lg truncate drop-shadow-md">
                        {currentSeg?.title ?? ''}
                    </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Jump-to-event select — all events so user can jump to any chapter */}
                    {events.length > 0 && (
                        <select
                            value={currentSegId ?? events[0]?.id ?? ''}
                            onChange={e => {
                                const eventId = e.target.value
                                if (!eventId) return
                                const entry = events.find(ev => ev.id === eventId)
                                if (!entry) return
                                onSelectEvent(entry)
                                const segIdx = ttsState.segments.findIndex(s => s.id === eventId)
                                if (segIdx >= 0) {
                                    onSeekToSegment(segIdx)
                                } else if (onRestartFromEvent) {
                                    onRestartFromEvent(entry)
                                }
                            }}
                            className="bg-black/50 border border-white/20 text-white text-xs rounded px-2 py-1 max-w-[200px] truncate"
                        >
                            {events.map(evt => {
                                const label = formatEventLabelWithDate(evt)
                                return (
                                    <option key={evt.id} value={evt.id} className="bg-slate-900">{label}</option>
                                )
                            })}
                        </select>
                    )}
                    <button
                        onClick={e => {
                            e.stopPropagation()
                            onStop()
                            if (window.history.state?.slideshowOpen) window.history.back()
                        }}
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
                onFocus={handleControlsFocus}
                onBlur={handleControlsBlur}
            >
                {/* Transport */}
                <div className="flex items-center gap-6 pointer-events-auto">
                    <button
                        onClick={e => {
                            e.stopPropagation()
                            try {
                                onPrev()
                            } catch (err) {
                                console.error('[TTS Slideshow] Skip Back failed:', err)
                            }
                        }}
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
                        onClick={e => {
                            e.stopPropagation()
                            try {
                                onNext()
                            } catch (err) {
                                console.error('[TTS Slideshow] Skip Forward failed:', err)
                            }
                        }}
                        className="text-white/60 hover:text-white transition-colors"
                        aria-label="Next event"
                    >
                        <SkipForward size={32} />
                    </button>
                </div>

                {totalSentences > 0 && (
                    <div className="w-full max-w-lg flex items-center gap-3 pointer-events-auto px-2">
                        <span className="text-white/40 text-[10px] uppercase font-bold shrink-0 hidden sm:inline">
                            Paragraph
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={totalSentences - 1}
                            step={1}
                            value={clampSeek(displaySentenceIndex, 0, totalSentences - 1)}
                            onChange={e => {
                                const n = parseInt(e.target.value, 10)
                                seekScrubRef.current = n
                                setSeekValue(n)
                            }}
                            onPointerDown={() => {
                                const start = clampSeek(currentSentenceIndex, 0, totalSentences - 1)
                                seekScrubRef.current = start
                                setSeekValue(start)
                            }}
                            onPointerUp={commitSentenceSeek}
                            onPointerCancel={commitSentenceSeek}
                            className="flex-1 min-w-0 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow"
                            aria-label="Seek position in current chapter"
                        />
                        <span className="text-white/50 text-xs tabular-nums shrink-0 w-14 text-right">
                            {clampSeek(displaySentenceIndex, 0, totalSentences - 1) + 1} / {totalSentences}
                        </span>
                    </div>
                )}

                {/* Settings strip */}
                <div className="flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                        <span className="text-white/40 text-[10px] uppercase font-bold">Provider</span>
                        <select
                            value={ttsState.provider}
                            onChange={e => { e.stopPropagation(); onSetProvider(e.target.value as TTSProvider) }}
                            className="bg-transparent text-white text-xs outline-none cursor-pointer"
                        >
                            <option value="piper" className="bg-slate-900">Piper</option>
                            <option value="webSpeech" className="bg-slate-900">Speech API</option>
                        </select>
                    </div>

                    {ttsState.provider === 'piper' ? (
                        <>
                            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                                <span className="text-white/40 text-[10px] uppercase font-bold">Voice</span>
                                <select
                                    value={ttsState.piperVoiceId}
                                    onChange={e => { e.stopPropagation(); onSetPiperVoiceId(e.target.value) }}
                                    className="bg-transparent text-white text-xs outline-none cursor-pointer max-w-[160px] truncate"
                                >
                                    {filteredPiperVoices.map(v => (
                                        <option key={v.id} value={v.id} className="bg-slate-900">{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                                <span className="text-white/40 text-[10px] uppercase font-bold">Quote</span>
                                <select
                                    value={ttsState.quoteVoiceId}
                                    onChange={e => { e.stopPropagation(); onSetQuoteVoiceId(e.target.value) }}
                                    className="bg-transparent text-white text-xs outline-none cursor-pointer max-w-[160px] truncate"
                                >
                                    <option value="" className="bg-slate-900">Narrator</option>
                                    {filteredPiperVoices.map(v => (
                                        <option key={v.id} value={v.id} className="bg-slate-900">{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
                                <span className="text-white/40 text-[10px] uppercase font-bold">Speakers</span>
                                <input
                                    value={ttsState.speakerMapInput}
                                    onChange={e => { e.stopPropagation(); onSetSpeakerMapInput(e.target.value) }}
                                    placeholder="alice=en_US, bob=en_US"
                                    className="bg-transparent text-white text-xs outline-none placeholder:text-white/30 w-[200px]"
                                />
                            </div>
                        </>
                    ) : (
                        <>
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
                        </>
                    )}

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

// ── Inline sub-component: renders the Three.js planet animation as a fullscreen canvas ──
function PlanetSlideCanvas({ active, initialYear }: { active: boolean; initialYear: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctrlRef = useRef<any>(null)
    const rafRef = useRef<number | undefined>(undefined)
    const yearRef = useRef(initialYear)

    // Sync year when segment changes (e.g. new planet slide for different event)
    useEffect(() => {
        if (active) {
            yearRef.current = initialYear
            ctrlRef.current?.setYear(initialYear)
        }
    }, [active, initialYear])

    useEffect(() => {
        if (!active) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            ctrlRef.current?.destroy()
            ctrlRef.current = null
            return
        }

        let cancelled = false
        yearRef.current = initialYear

        async function init() {
            const { createPlanetController } = await import('paradigm-threat-animation')
            if (cancelled || !canvasRef.current) return
            // Wait for layout: canvas may be 0×0 on first paint when conditionally mounted
            await new Promise<void>(resolve => {
                let frames = 0
                const maxFrames = 20
                const check = () => {
                    if (cancelled || !canvasRef.current || frames++ >= maxFrames) return resolve()
                    const w = canvasRef.current.clientWidth
                    const h = canvasRef.current.clientHeight
                    if (w > 0 && h > 0) return resolve()
                    requestAnimationFrame(check)
                }
                requestAnimationFrame(check)
            })
            if (cancelled || !canvasRef.current) return
            const ctrl = await createPlanetController(canvasRef.current)
            if (cancelled) { ctrl.destroy(); return }
            ctrlRef.current = ctrl
            ctrl.setYear(yearRef.current)
            if (ctrl.resize) ctrl.resize()

            const canvasEl = canvasRef.current
            const scheduleResize = () => {
                if (cancelled || !canvasEl) return
                requestAnimationFrame(() => {
                    if (!cancelled) ctrlRef.current?.resize?.()
                })
            }
            let ro: ResizeObserver | null = null
            if (canvasEl && typeof ResizeObserver !== 'undefined') {
                ro = new ResizeObserver(scheduleResize)
                ro.observe(canvasEl)
            }
            window.addEventListener('resize', scheduleResize)

            const isModernEra = initialYear > PLANET_BC_MAX  // -670: CE plays forward to 3000
            const CE_END_YEAR = 3000
            // Loop within era containing initialYear — never jump to 5000 BCE for dark/golden age events
            const loopStart = initialYear <= -4077 ? PLANET_BC_MIN
                : initialYear <= -3147 ? -4077
                : initialYear <= PLANET_BC_MAX ? -3147
                : initialYear
            let lastT = performance.now()

            function tick() {
                if (cancelled) return
                const now = performance.now()
                const dt = (now - lastT) / 1000
                lastT = now
                // 1× speed: 0.1 years per second → 1 full Earth orbit every 10 seconds
                yearRef.current += 0.1 * dt
                if (isModernEra) {
                    yearRef.current = Math.min(yearRef.current, CE_END_YEAR)
                } else {
                    if (yearRef.current > PLANET_BC_MAX) yearRef.current = loopStart
                }
                ctrl.setYear(yearRef.current)
                rafRef.current = requestAnimationFrame(tick)
            }
            rafRef.current = requestAnimationFrame(tick)
        }

        let resizeObserver: ResizeObserver | null = null
        const winResize = () => {
            if (cancelled) return
            requestAnimationFrame(() => ctrlRef.current?.resize?.())
        }
        window.addEventListener('resize', winResize)

        init().then(() => {
            if (cancelled || !canvasRef.current) return
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(winResize)
                resizeObserver.observe(canvasRef.current)
            }
        })

        return () => {
            cancelled = true
            window.removeEventListener('resize', winResize)
            resizeObserver?.disconnect()
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            ctrlRef.current?.destroy()
            ctrlRef.current = null
        }
    }, [active, initialYear])

    if (!active) return null

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block"
            style={{ zIndex: 3 }}
        />
    )
}
