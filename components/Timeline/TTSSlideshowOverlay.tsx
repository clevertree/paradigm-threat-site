'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import type { TTSState, SubtitleMode, PiperVoice, TTSProvider } from '@/lib/hooks/useTTS'
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
    baseUrl: string
    /** Index into `events` where TTS started */
    startEventIndex: number
    onSelectEvent: (entry: TimelineEntry) => void
    /** Jump TTS to a specific segment index without rebuilding the segment list */
    onSeekToSegment: (segmentIndex: number) => void
    /** Switch to Speech API and resume playback from the failed segment */
    onSwitchToSpeechAndResume?: () => void
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
    baseUrl,
    startEventIndex,
    onSelectEvent,
    onSeekToSegment,
    onSwitchToSpeechAndResume,
}: TTSSlideshowOverlayProps) {
    const [showControls, setShowControls] = useState(true)
    const lastInteractionRef = useRef(Date.now())
    const controlsFocusedRef = useRef(false)
    const [currentImgIndex, setCurrentImgIndex] = useState(0)
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

    const allImages = useMemo<SlideshowImage[]>(() => {
        return events.slice(startEventIndex).flatMap(ev =>
            (ev.media || []).map(path => ({
                src: `${baseUrl}${path}`,
                eventId: ev.id,
            }))
        )
    }, [events, baseUrl, startEventIndex])

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

    // Preload the next few images so crossfade never reveals an unloaded src
    useEffect(() => {
        if (allImages.length === 0) return
        // Preload current + next 2 images
        for (let offset = 0; offset <= 2; offset++) {
            const idx = (currentImgIndex + offset) % allImages.length
            const url = allImages[idx]?.src
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
            if (!controlsFocusedRef.current && Date.now() - lastInteractionRef.current > 3000) setShowControls(false)
        }, 1000)
        return () => clearInterval(t)
    }, [])

    const handleInteraction = useCallback(() => {
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
                        {renderLayer(layerA, activeFront === 'A', 'A')}
                        {renderLayer(layerB, activeFront === 'B', 'B')}
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
                    {/* Jump-to-event select */}
                    {ttsState.segments.length > 1 && (
                        <select
                            value={ttsState.currentSegmentIndex}
                            onChange={e => {
                                const idx = parseInt(e.target.value)
                                if (isNaN(idx) || idx < 0 || idx >= ttsState.segments.length) return
                                // Look up the timeline entry by id — never use positional offset
                                const segId = ttsState.segments[idx]?.id
                                const entry = segId ? events.find(ev => ev.id === segId) : undefined
                                if (entry) onSelectEvent(entry)
                                // Actually jump TTS to the chosen segment
                                onSeekToSegment(idx)
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
                onFocus={handleControlsFocus}
                onBlur={handleControlsBlur}
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
