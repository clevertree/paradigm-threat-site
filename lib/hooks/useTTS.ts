'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { splitSentences } from '@/components/Timeline/ttsHelpers'
import {
    startSpeechKeepalive,
    stopSpeechKeepalive,
    startAudioWatchdog,
    clearAudioWatchdog,
    startUtteranceWatchdog,
    clearUtteranceWatchdog,
    isPageHidePersisted,
    type KeepaliveHandle,
    type WatchdogHandle,
    type UtteranceWatchdogHandle,
} from '@/lib/tts/ttsResilience'

export interface TTSSegment {
    id: string
    title: string
    /** Pre-loaded text, OR use fetchText for lazy loading */
    text?: string
    fetchText?: () => Promise<string>
}

export type TTSProvider = 'piper' | 'webSpeech'

export interface PiperVoice {
    id: string
    name: string
    lang: string
}

export type SubtitleMode = 'caption' | 'scroll'

export interface TTSState {
    isPlaying: boolean
    currentSegmentIndex: number
    segments: TTSSegment[]
    voice: SpeechSynthesisVoice | null
    rate: number
    langFilter: string
    localOnly: boolean
    provider: TTSProvider
    piperVoiceId: string
    piperLang: string
    quoteVoiceId: string
    speakerMapInput: string
    error: string | null
    /** The sentence currently being spoken */
    currentChunkText: string | null
    /** All sentences for the current segment */
    sentences: string[]
    /** Index of the sentence currently being spoken */
    currentSentenceIndex: number
    /** Display mode: caption (1-2 sentences) or scroll (all text, auto-scrolling) */
    subtitleMode: SubtitleMode
    /** When Piper fails on consecutive segments, stores resume info for Speech API fallback UI */
    piperFallbackOffer: { segIndex: number } | null
}

const LS_VOICE = 'tl-tts-voice'
const LS_RATE = 'tl-tts-rate'
const LS_LANG = 'tl-tts-lang'
const LS_LOCAL = 'tl-tts-local-only'
const LS_SUBTITLE = 'tl-tts-subtitle'
const LS_PROVIDER = 'tl-tts-provider'
const LS_PIPER_VOICE = 'tl-tts-piper-voice'
const LS_PIPER_LANG = 'tl-tts-piper-lang'
const LS_PIPER_QUOTE = 'tl-tts-piper-quote-voice'
const LS_SPEAKER_MAP = 'tl-tts-speaker-map'

type SpeakerBlock = { speaker: string; text: string }

function normalizeSpeaker(speaker: string): string {
    return speaker.trim().toLowerCase()
}

function parseSpeakerBlocks(text: string): SpeakerBlock[] {
    const blocks: SpeakerBlock[] = []
    const tag = /\[SPEAKER:([^\]]+)\]/gi
    let lastIndex = 0
    let currentSpeaker = 'narrator'
    let match: RegExpExecArray | null
    while ((match = tag.exec(text)) !== null) {
        const idx = match.index ?? 0
        const before = text.slice(lastIndex, idx).trim()
        if (before) blocks.push({ speaker: currentSpeaker, text: before })
        currentSpeaker = normalizeSpeaker(match[1] ?? 'narrator')
        lastIndex = idx + match[0].length
    }
    const tail = text.slice(lastIndex).trim()
    if (tail) blocks.push({ speaker: currentSpeaker, text: tail })
    return blocks.length > 0 ? blocks : [{ speaker: 'narrator', text }]
}

function parseSpeakerMapInput(input: string): Record<string, string> {
    if (!input.trim()) return {}
    const pairs = input.split(',')
    const map: Record<string, string> = {}
    for (const pair of pairs) {
        const [rawKey, rawVal] = pair.split('=')
        if (!rawKey || !rawVal) continue
        const key = normalizeSpeaker(rawKey)
        const val = rawVal.trim()
        if (key && val) map[key] = val
    }
    return map
}

function isQuotedSentence(text: string): boolean {
    return text.includes('"')
}

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        isPlaying: false,
        currentSegmentIndex: -1,
        segments: [],
        voice: null,
        rate: 1.0,
        langFilter: 'en',
        localOnly: false,
        provider: 'piper',
        piperVoiceId: '',
        piperLang: 'en',
        quoteVoiceId: '',
        speakerMapInput: '',
        error: null,
        currentChunkText: null,
        sentences: [],
        currentSentenceIndex: -1,
        subtitleMode: 'caption',
        piperFallbackOffer: null,
    })

    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
    const [availablePiperVoices, setAvailablePiperVoices] = useState<PiperVoice[]>([])

    const synthRef = useRef<SpeechSynthesis | null>(null)
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const cancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const audioUrlRef = useRef<string | null>(null)
    const fetchAbortRef = useRef<AbortController | null>(null)
    const isPlayingRef = useRef(false)
    const currentSegmentIdxRef = useRef(-1)
    const currentSentenceIdxRef = useRef(0)
    const sentencesRef = useRef<string[]>([])
    const sentenceSpeakersRef = useRef<string[]>([])
    /** Generation counter — incremented on every speak() call to invalidate stale callbacks */
    const speakGenRef = useRef(0)
    /** Piper pre-cache: maps "segIndex:sentenceIndex" → Blob for the next sentence's audio */
    const piperCacheRef = useRef<Map<string, Blob>>(new Map())
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
    const rateRef = useRef(1.0)
    const providerRef = useRef<TTSProvider>('piper')
    const piperVoiceIdRef = useRef<string>('')
    const piperLangRef = useRef<string>('en')
    const quoteVoiceIdRef = useRef<string>('')
    const speakerMapRef = useRef<Record<string, string>>({})
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
    /** Chrome Speech API keepalive (pause/resume every 10s to prevent silent cancel) */
    const speechKeepAliveRef = useRef<KeepaliveHandle | null>(null)
    /** Piper audio element watchdog — detects silent stalls */
    const audioWatchdogRef = useRef<WatchdogHandle | null>(null)
    /** Web Speech utterance watchdog — detects onend non-delivery */
    const uttWatchdogRef = useRef<UtteranceWatchdogHandle | null>(null)
    /** Web Speech sentence-level retry counter */
    const webSpeechRetryRef = useRef(0)
    /** Whether playback was active before a pagehide event (for resume on visibility change) */
    const wasPlayingBeforeHideRef = useRef(false)
    /** Tracks consecutive Piper segment failures for auto-skip / fallback logic */
    const piperSegmentFailsRef = useRef(0)
    const segmentsRef = useRef<TTSSegment[]>([])

    /** Request screen wake lock (keeps screen on during playback) */
    const acquireWakeLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                wakeLockRef.current = await navigator.wakeLock.request('screen')
                wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
            }
        } catch { /* user denied or not supported */ }
    }, [])

    const releaseWakeLock = useCallback(() => {
        wakeLockRef.current?.release().catch(() => { })
        wakeLockRef.current = null
    }, [])

    // Initialize synth reference on client only
    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis
            audioRef.current = new Audio()
        }
    }, [])

    // Stop on page unload, pause on mobile tab-switch (pagehide with bfcache)
    useEffect(() => {
        const handleBeforeUnload = () => {
            isPlayingRef.current = false
            synthRef.current?.cancel()
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
            speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
            audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
            uttWatchdogRef.current = clearUtteranceWatchdog(uttWatchdogRef.current)
            if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        }
        const handlePageHide = (e: PageTransitionEvent) => {
            if (isPageHidePersisted(e)) {
                // bfcache / mobile tab switch — just pause, don't stop
                if (isPlayingRef.current) {
                    wasPlayingBeforeHideRef.current = true
                    isPlayingRef.current = false
                    synthRef.current?.pause()
                    audioRef.current?.pause()
                    speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
                }
            } else {
                // True navigation away — stop everything
                handleBeforeUnload()
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('pagehide', handlePageHide as EventListener)
        return () => {
            handleBeforeUnload()
            window.removeEventListener('beforeunload', handleBeforeUnload)
            window.removeEventListener('pagehide', handlePageHide as EventListener)
        }
    }, [])

    // Restore settings from localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return
        const savedRate = localStorage.getItem(LS_RATE)
        const savedLang = localStorage.getItem(LS_LANG)
        const savedLocal = localStorage.getItem(LS_LOCAL)
        const savedSubtitle = localStorage.getItem(LS_SUBTITLE)
        const savedProvider = localStorage.getItem(LS_PROVIDER)
        const savedPiperVoice = localStorage.getItem(LS_PIPER_VOICE)
        const savedPiperLang = localStorage.getItem(LS_PIPER_LANG)
        const savedQuoteVoice = localStorage.getItem(LS_PIPER_QUOTE)
        const savedSpeakerMap = localStorage.getItem(LS_SPEAKER_MAP)
        setState(prev => ({
            ...prev,
            rate: savedRate ? parseFloat(savedRate) : prev.rate,
            langFilter: savedLang ?? prev.langFilter,
            localOnly: savedLocal === 'true',
            subtitleMode: (savedSubtitle === 'scroll' ? 'scroll' : 'caption') as SubtitleMode,
            provider: (savedProvider === 'webSpeech' ? 'webSpeech' : 'piper') as TTSProvider,
            piperVoiceId: savedPiperVoice ?? prev.piperVoiceId,
            piperLang: savedPiperLang ?? prev.piperLang,
            quoteVoiceId: savedQuoteVoice ?? prev.quoteVoiceId,
            speakerMapInput: savedSpeakerMap ?? prev.speakerMapInput,
        }))
    }, [])

    // Initialize voices
    useEffect(() => {
        const synth = synthRef.current
        if (!synth) return

        const updateVoices = () => {
            const raw = synth.getVoices()
            const sorted = [...raw].sort((a, b) => {
                const aEn = a.lang.startsWith('en')
                const bEn = b.lang.startsWith('en')
                if (aEn && !bEn) return -1
                if (!aEn && bEn) return 1
                return a.name.localeCompare(b.name)
            })
            setAvailableVoices(sorted)

            const savedName = localStorage.getItem(LS_VOICE)
            setState(prev => {
                if (prev.voice) return prev
                const voice =
                    (savedName ? sorted.find(v => v.name === savedName) : null) ??
                    sorted.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ??
                    sorted.find(v => v.lang.startsWith('en')) ??
                    sorted[0] ??
                    null
                voiceRef.current = voice
                return { ...prev, voice }
            })
        }

        updateVoices()
        if ('onvoiceschanged' in synth) {
            synth.onvoiceschanged = updateVoices
        }
    }, [])

    // Load Piper voices from server config
    useEffect(() => {
        if (typeof window === 'undefined') return
        let mounted = true
        fetch('/api/tts/piper/voices')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!mounted || !data) return
                const voices = Array.isArray(data.voices) ? data.voices as PiperVoice[] : []
                setAvailablePiperVoices(voices)

                const savedVoiceId = localStorage.getItem(LS_PIPER_VOICE)
                const defaultVoiceId = data.defaultVoiceId as string | null
                const firstVoiceId = voices[0]?.id ?? ''
                const resolvedVoiceId = savedVoiceId || defaultVoiceId || firstVoiceId

                setState(prev => ({
                    ...prev,
                    piperVoiceId: resolvedVoiceId || prev.piperVoiceId,
                    piperLang: prev.piperLang || voices[0]?.lang || 'en',
                    provider: voices.length > 0 ? prev.provider : 'webSpeech',
                }))
            })
            .catch(() => {
                if (!mounted) return
                setAvailablePiperVoices([])
                setState(prev => ({ ...prev, provider: 'webSpeech' }))
            })

        return () => { mounted = false }
    }, [])

    // Keep refs in sync
    useEffect(() => {
        voiceRef.current = state.voice
        rateRef.current = state.rate
        providerRef.current = state.provider
        piperVoiceIdRef.current = state.piperVoiceId
        piperLangRef.current = state.piperLang
        quoteVoiceIdRef.current = state.quoteVoiceId
        speakerMapRef.current = parseSpeakerMapInput(state.speakerMapInput)
    }, [state.voice, state.rate, state.provider, state.piperVoiceId, state.piperLang, state.quoteVoiceId, state.speakerMapInput])

    const stop = useCallback(() => {
        const synth = synthRef.current
        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        fetchAbortRef.current?.abort()
        fetchAbortRef.current = null
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current)
            audioUrlRef.current = null
        }
        synth?.cancel()
        isPlayingRef.current = false
        speakGenRef.current++          // invalidate any in-flight callbacks
        currentSegmentIdxRef.current = -1
        currentSentenceIdxRef.current = 0
        sentencesRef.current = []
        sentenceSpeakersRef.current = []
        releaseWakeLock()
        piperSegmentFailsRef.current = 0
        webSpeechRetryRef.current = 0
        wasPlayingBeforeHideRef.current = false
        // Clear resilience timers
        speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
        audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
        uttWatchdogRef.current = clearUtteranceWatchdog(uttWatchdogRef.current)
        // Clear Piper pre-cache
        piperCacheRef.current.clear()
        // NOTE: error is intentionally NOT cleared here so it remains visible after stop
        setState(prev => ({
            ...prev,
            isPlaying: false,
            currentSegmentIndex: -1,
            currentChunkText: null,
            sentences: [],
            currentSentenceIndex: -1,
            piperFallbackOffer: null,
        }))
    }, [])

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }))
    }, [])

    /**
     * Speak a segment sentence-by-sentence.
     * Each sentence is its own SpeechSynthesisUtterance so that onstart/onend
     * reliably track position (no reliance on the unreliable onboundary event).
     */
    const speak = useCallback(async (
        segIndex: number,
        segments: TTSSegment[],
        sentenceIndex: number = 0
    ) => {
        const synth = synthRef.current
        if (!synth || !segments[segIndex]) { stop(); return }
        if (!isPlayingRef.current) return
        segmentsRef.current = segments

        // Stamp this invocation with a unique generation so stale callbacks are ignored
        const gen = ++speakGenRef.current

        const seg = segments[segIndex]

        // On first sentence of segment, or when seeking (sentenceIndex > 0) with unloaded segment: load text and split into sentences
        if (sentenceIndex === 0 || sentencesRef.current.length === 0) {
            currentSegmentIdxRef.current = segIndex
            setState(prev => ({ ...prev, currentSegmentIndex: segIndex, isPlaying: true }))
            setState(prev => ({ ...prev, error: null }))

            let rawText = seg.text ?? ''
            if (!rawText && seg.fetchText) {
                try {
                    rawText = await seg.fetchText()
                    seg.text = rawText // cache
                } catch { rawText = '' }
            }
            if (!isPlayingRef.current || speakGenRef.current !== gen) return

            const blocks = parseSpeakerBlocks(rawText).map(block => ({
                speaker: block.speaker,
                text: block.text
                    .replace(/[#*_~`\[\]()]/g, ' ')
                    .replace(/\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim(),
            }))
            const sentences: string[] = []
            const speakers: string[] = []
            for (const block of blocks) {
                const parts = splitSentences(block.text)
                for (const part of parts) {
                    sentences.push(part)
                    speakers.push(block.speaker)
                }
            }
            const resolvedSpeakers = sentences.map((s, i) => {
                const speaker = speakers[i] ?? 'narrator'
                if (speaker === 'narrator' && isQuotedSentence(s)) return 'quote'
                return speaker
            })
            sentencesRef.current = sentences
            sentenceSpeakersRef.current = resolvedSpeakers
            setState(prev => ({ ...prev, sentences, currentSentenceIndex: sentenceIndex }))
        }

        const sentences = sentencesRef.current
        if (sentenceIndex >= sentences.length) {
            // All sentences spoken — advance to next segment
            if (speakGenRef.current !== gen) return  // stale
            if (segIndex + 1 < segments.length) {
                speak(segIndex + 1, segments, 0).catch((err) => {
                    console.error('TTS next-segment error:', err)
                    setState(prev => ({ ...prev, error: `TTS error advancing segment: ${err instanceof Error ? err.message : String(err)}` }))
                    stop()
                })
            } else {
                stop()
            }
            return
        }

        currentSentenceIdxRef.current = sentenceIndex

        if (providerRef.current === 'piper') {
            const text = sentences[sentenceIndex]
            const speakers = sentenceSpeakersRef.current
            const speaker = speakers[sentenceIndex] ?? 'narrator'
            const speakerMap = speakerMapRef.current
            const quoteVoice = quoteVoiceIdRef.current
            const voiceId = speaker === 'quote' && quoteVoice
                ? quoteVoice
                : speakerMap[speaker] ?? piperVoiceIdRef.current

            setState(prev => ({
                ...prev,
                currentSentenceIndex: sentenceIndex,
                currentChunkText: text,
            }))

            if (!voiceId) {
                // No piper voice available — auto-fallback to webSpeech instead of failing
                console.warn('Piper voice not configured, falling back to Speech API.')
                providerRef.current = 'webSpeech'
                setState(prev => ({
                    ...prev,
                    provider: 'webSpeech',
                    error: 'Piper not available (no voices configured — set PIPER1_VOICES_JSON env var). Switched to Speech API.',
                }))
                localStorage.setItem(LS_PROVIDER, 'webSpeech')
                // Continue below to webSpeech path instead of stopping
            } else {

                fetchAbortRef.current?.abort()
                const controller = new AbortController()
                fetchAbortRef.current = controller

                /** Retry the same sentence up to 3 times before failing (on fetch or playback error) */
                const SENTENCE_RETRY_MAX = 3
                const trySentence = (attempt: number, cachedBlob: Blob | null): void => {
                    const blobPromise = cachedBlob ? Promise.resolve(cachedBlob) : fetchWithRetry()
                    blobPromise
                        .then(blob => {
                            if (!isPlayingRef.current || speakGenRef.current !== gen) return
                            piperSegmentFailsRef.current = 0
                            if (!audioRef.current) {
                                setState(prev => ({ ...prev, error: 'Audio element not available. Try reloading the page.' }))
                                stop()
                                return
                            }

                            const url = URL.createObjectURL(blob)
                            if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
                            audioUrlRef.current = url

                            audioRef.current.src = url
                            // Clear any previous watchdog
                            audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
                            audioRef.current.onended = () => {
                                audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
                                if (isPlayingRef.current && speakGenRef.current === gen) {
                                    speak(segIndex, segments, sentenceIndex + 1).catch((err) => {
                                        console.error('TTS next-sentence error:', err)
                                        setState(prev => ({ ...prev, error: `TTS playback error: ${err instanceof Error ? err.message : String(err)}` }))
                                        stop()
                                    })
                                }
                            }
                            audioRef.current.onerror = (e) => {
                                audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
                                if (speakGenRef.current !== gen) return
                                const mediaErr = audioRef.current?.error
                                const detail = mediaErr ? `${mediaErr.message} (code ${mediaErr.code})` : 'unknown'
                                console.error('Piper audio playback error:', detail, e)
                                handlePiperSegmentFail(`Audio playback failed: ${detail}`, attempt)
                            }
                            audioRef.current.play().catch((err) => {
                                audioWatchdogRef.current = clearAudioWatchdog(audioWatchdogRef.current)
                                if (speakGenRef.current !== gen) return
                                console.error('Audio play() rejected:', err)
                                handlePiperSegmentFail(`Could not start audio: ${err instanceof Error ? err.message : 'Autoplay blocked?'}`, attempt)
                            })

                            // Start audio watchdog — detects silent stalls where neither
                            // onended nor onerror fires (browser resource pressure, mobile bg)
                            audioWatchdogRef.current = startAudioWatchdog(audioRef.current, {
                                rate: rateRef.current,
                                onStall: () => {
                                    if (speakGenRef.current !== gen) return
                                    console.warn('[TTS] Audio watchdog fired — retrying sentence')
                                    handlePiperSegmentFail('Audio playback stalled (watchdog)', attempt)
                                },
                            })

                            prefetchNext()
                        })
                        .catch((err) => {
                            if (err instanceof DOMException && err.name === 'AbortError') return
                            if (speakGenRef.current !== gen) return
                            console.error('[TTS] Piper fetch error (all retries exhausted):', err)
                            if (isPlayingRef.current) {
                                handlePiperSegmentFail(`Piper synthesis failed: ${err instanceof Error ? err.message : 'Unknown error'}`, attempt)
                            }
                        })
                }

                // Helper: when Piper fails for a sentence (after retries), skip to
                // the next segment.  After 2 consecutive segment failures, pause and
                // offer the user a "Switch to Speech API & Resume" button.
                const handlePiperSegmentFail = (errorMsg: string, attempt: number = 0) => {
                    if (attempt < SENTENCE_RETRY_MAX) {
                        const delayMs = Math.min(1000 * (attempt + 1), 4000)
                        console.warn(`[TTS] Sentence failed (attempt ${attempt + 1}/${SENTENCE_RETRY_MAX}), retrying in ${delayMs}ms`)
                        setState(prev => ({ ...prev, error: `Retrying… (${attempt + 1}/${SENTENCE_RETRY_MAX})` }))
                        setTimeout(() => {
                            if (!isPlayingRef.current || speakGenRef.current !== gen) return
                            trySentence(attempt + 1, null)
                        }, delayMs)
                        return
                    }
                    piperSegmentFailsRef.current++
                    const fails = piperSegmentFailsRef.current

                    if (fails >= 2) {
                        // Two consecutive segments failed — pause & offer Speech API fallback
                        console.error(`[TTS] Piper failed on ${fails} consecutive segments — offering Speech API fallback`)
                        isPlayingRef.current = false
                        setState(prev => ({
                            ...prev,
                            isPlaying: false,
                            error: `Piper failed on ${fails} consecutive sections. Switch to Speech API to continue.`,
                            piperFallbackOffer: { segIndex },
                        }))
                    } else if (segIndex + 1 < segments.length) {
                        // First failure — skip to the next segment
                        console.warn(`[TTS] Piper failed on segment ${segIndex}, skipping to next. (${errorMsg})`)
                        setState(prev => ({ ...prev, error: `Piper error — skipping to next section…` }))
                        speak(segIndex + 1, segments, 0).catch((err) => {
                            console.error('TTS skip-segment error:', err)
                            stop()
                        })
                    } else {
                        // Last segment — nowhere to skip, offer fallback
                        isPlayingRef.current = false
                        setState(prev => ({
                            ...prev,
                            isPlaying: false,
                            error: errorMsg,
                            piperFallbackOffer: { segIndex },
                        }))
                    }
                }

                // Retry on transient server / network errors with exponential backoff
                const RETRYABLE_STATUS = (s: number) => s >= 500
                const MAX_ATTEMPTS = 3
                const fetchWithRetry = async (): Promise<Blob> => {
                    let lastErr: Error = new Error('Unknown error')
                    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                        if (attempt > 0) {
                            const delayMs = Math.min(2000 * 2 ** (attempt - 1), 16000)
                            console.warn(`[TTS] Attempt ${attempt + 1}/${MAX_ATTEMPTS} — retrying in ${delayMs}ms`)
                            setState(prev => ({ ...prev, error: `Piper error — retry ${attempt}/${MAX_ATTEMPTS - 1}…` }))
                            await new Promise<void>(resolve => setTimeout(resolve, delayMs))
                            if (!isPlayingRef.current) throw new DOMException('Aborted', 'AbortError')
                        }
                        try {
                            const res = await fetch('/api/tts/piper', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text, voiceId, rate: rateRef.current }),
                                signal: controller.signal,
                            })
                            if (!res.ok) {
                                let detail = `HTTP ${res.status}`
                                try {
                                    const errBody = await res.json()
                                    if (errBody?.error) detail = errBody.error
                                } catch { /* ignore */ }
                                const err = new Error(`Piper API error: ${detail}`)
                                console.error(`[TTS] fetch failed (attempt ${attempt + 1}):`, detail)
                                if (RETRYABLE_STATUS(res.status) && attempt < MAX_ATTEMPTS - 1) {
                                    lastErr = err
                                    continue
                                }
                                throw err
                            }
                            setState(prev => prev.error?.startsWith('Piper error — retry') ? { ...prev, error: null } : prev)
                            return res.blob()
                        } catch (fetchErr) {
                            // Re-throw aborts immediately
                            if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') throw fetchErr
                            // Network / timeout errors are retryable
                            const err = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr))
                            console.error(`[TTS] fetch exception (attempt ${attempt + 1}):`, err.message)
                            lastErr = err
                            if (attempt < MAX_ATTEMPTS - 1) continue
                            throw lastErr
                        }
                    }
                    throw lastErr
                }

                // ── Piper pre-cache helper ──
                // Fire-and-forget: pre-fetch audio for the NEXT sentence so it's
                // ready instantly when the current one finishes playing.
                const prefetchNext = () => {
                    const nextSentIdx = sentenceIndex + 1
                    let nextSeg = segIndex
                    let nextSent = nextSentIdx
                    const curSentences = sentencesRef.current
                    if (nextSent >= curSentences.length) {
                        // Next sentence is in the next segment — we can't prefetch
                        // until that segment's text is loaded, but we CAN pre-fetch
                        // the segment text so it's cached for speak().
                        if (segIndex + 1 < segments.length) {
                            const nextSegObj = segments[segIndex + 1]
                            if (!nextSegObj.text && nextSegObj.fetchText) {
                                nextSegObj.fetchText().then(t => { nextSegObj.text = t }).catch(() => { })
                            }
                        }
                        return
                    }
                    const cacheKey = `${nextSeg}:${nextSent}`
                    if (piperCacheRef.current.has(cacheKey)) return  // already cached
                    const nextText = curSentences[nextSent]
                    if (!nextText) return
                    const nextSpeaker = sentenceSpeakersRef.current[nextSent] ?? 'narrator'
                    const nextVoiceId = nextSpeaker === 'quote' && quoteVoice
                        ? quoteVoice
                        : speakerMap[nextSpeaker] ?? piperVoiceIdRef.current
                    if (!nextVoiceId) return
                    fetch('/api/tts/piper', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: nextText, voiceId: nextVoiceId, rate: rateRef.current }),
                    })
                        .then(res => res.ok ? res.blob() : null)
                        .then(blob => { if (blob) piperCacheRef.current.set(cacheKey, blob) })
                        .catch(() => { })  // best-effort, ignore errors
                }

                // Check pre-cache first
                const cacheKey = `${segIndex}:${sentenceIndex}`
                const cachedBlob = piperCacheRef.current.get(cacheKey)
                if (cachedBlob) piperCacheRef.current.delete(cacheKey)

                trySentence(0, cachedBlob ?? null)

                return
            }
        }

        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        // Clear previous keepalive/watchdog
        speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
        uttWatchdogRef.current = clearUtteranceWatchdog(uttWatchdogRef.current)
        synth.cancel()

        // Sentence-level retry constant for Web Speech API
        const WEB_SPEECH_RETRY_MAX = 3

        const tryWebSpeechSentence = (attempt: number) => {
            if (!isPlayingRef.current || speakGenRef.current !== gen) return  // stale

            const text = sentences[sentenceIndex]
            setState(prev => ({
                ...prev,
                currentSentenceIndex: sentenceIndex,
                currentChunkText: text,
            }))

            const utt = new SpeechSynthesisUtterance(text)
            if (voiceRef.current) utt.voice = voiceRef.current
            utt.rate = rateRef.current
            utt.pitch = 1.0
            utt.volume = 1.0

            utt.onend = () => {
                // Clear watchdog + keepalive for this sentence
                uttWatchdogRef.current = clearUtteranceWatchdog(uttWatchdogRef.current)
                speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
                webSpeechRetryRef.current = 0
                // Guard: only advance if this is still the active generation
                if (isPlayingRef.current && speakGenRef.current === gen) {
                    speak(segIndex, segments, sentenceIndex + 1).catch((err) => {
                        console.error('TTS next-sentence error:', err)
                        setState(prev => ({ ...prev, error: `Speech API error: ${err instanceof Error ? err.message : String(err)}` }))
                        stop()
                    })
                }
            }
            utt.onerror = (e) => {
                uttWatchdogRef.current = clearUtteranceWatchdog(uttWatchdogRef.current)
                speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
                if (speakGenRef.current !== gen) return  // stale
                if (e.error === 'interrupted' || e.error === 'canceled') return

                console.error(`[TTS] Speech API error (attempt ${attempt + 1}/${WEB_SPEECH_RETRY_MAX}):`, e.error)

                if (attempt < WEB_SPEECH_RETRY_MAX - 1) {
                    const delayMs = Math.min(1000 * 2 ** attempt, 4000)
                    console.warn(`[TTS] Retrying Web Speech sentence in ${delayMs}ms`)
                    setState(prev => ({ ...prev, error: `Speech API error — retrying… (${attempt + 1}/${WEB_SPEECH_RETRY_MAX})` }))
                    webSpeechRetryRef.current = attempt + 1
                    setTimeout(() => {
                        if (!isPlayingRef.current || speakGenRef.current !== gen) return
                        synth.cancel()
                        tryWebSpeechSentence(attempt + 1)
                    }, delayMs)
                } else {
                    // All retries exhausted
                    webSpeechRetryRef.current = 0
                    isPlayingRef.current = false
                    setState(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentChunkText: null,
                        error: 'Speech API failed after 3 retries. Try Piper or reload.',
                    }))
                }
            }

            utteranceRef.current = utt
            synth.speak(utt)

            // Start Chrome keepalive (pause/resume every 10s to prevent silent cancel)
            speechKeepAliveRef.current = startSpeechKeepalive(synth)

            // Start utterance watchdog — detects onend/onerror non-delivery
            uttWatchdogRef.current = startUtteranceWatchdog(text, rateRef.current, () => {
                if (speakGenRef.current !== gen) return
                speechKeepAliveRef.current = stopSpeechKeepalive(speechKeepAliveRef.current)
                console.warn('[TTS] Utterance watchdog fired — sentence may have silently failed')
                synth.cancel()  // force-cancel the stuck utterance

                if (attempt < WEB_SPEECH_RETRY_MAX - 1) {
                    const delayMs = Math.min(1000 * 2 ** attempt, 4000)
                    console.warn(`[TTS] Retrying Web Speech sentence in ${delayMs}ms (watchdog)`)
                    setState(prev => ({ ...prev, error: `Speech stalled — retrying… (${attempt + 1}/${WEB_SPEECH_RETRY_MAX})` }))
                    webSpeechRetryRef.current = attempt + 1
                    setTimeout(() => {
                        if (!isPlayingRef.current || speakGenRef.current !== gen) return
                        tryWebSpeechSentence(attempt + 1)
                    }, delayMs)
                } else {
                    // Watchdog exhausted all retries — try advancing to next sentence
                    webSpeechRetryRef.current = 0
                    console.warn('[TTS] Watchdog retries exhausted, advancing to next sentence')
                    setState(prev => ({ ...prev, error: null }))
                    if (isPlayingRef.current && speakGenRef.current === gen) {
                        speak(segIndex, segments, sentenceIndex + 1).catch((err) => {
                            console.error('TTS next-sentence error:', err)
                            setState(prev => ({ ...prev, error: `Speech API error: ${err instanceof Error ? err.message : String(err)}` }))
                            stop()
                        })
                    }
                }
            })
        }

        // Small delay after cancel to let the synth settle
        cancelTimeoutRef.current = setTimeout(() => {
            webSpeechRetryRef.current = 0
            tryWebSpeechSentence(0)
        }, 20)
    }, [stop])

    // Re-acquire wake lock and resume playback when tab becomes visible again
    // (must be declared after speak/stop to reference them)
    useEffect(() => {
        const onVisChange = () => {
            if (document.visibilityState === 'visible') {
                if (isPlayingRef.current) {
                    acquireWakeLock()
                } else if (wasPlayingBeforeHideRef.current) {
                    // Was paused by pagehide (mobile tab switch) — resume
                    wasPlayingBeforeHideRef.current = false
                    isPlayingRef.current = true
                    acquireWakeLock()
                    const segments = segmentsRef.current
                    const segIdx = currentSegmentIdxRef.current
                    const sentIdx = currentSentenceIdxRef.current
                    if (segments.length > 0 && segIdx >= 0) {
                        setState(prev => ({ ...prev, isPlaying: true }))
                        speak(segIdx, segments, sentIdx).catch((err) => {
                            console.error('[TTS] Resume after visibility change failed:', err)
                            setState(prev => ({ ...prev, error: `Resume failed: ${err instanceof Error ? err.message : String(err)}` }))
                            stop()
                        })
                    }
                }
            }
        }
        document.addEventListener('visibilitychange', onVisChange)
        return () => document.removeEventListener('visibilitychange', onVisChange)
    }, [acquireWakeLock, speak, stop])

    /** Restart playback from the failed or current segment (e.g. after an error) */
    const retry = useCallback(() => {
        const segments = segmentsRef.current
        if (!segments.length) return
        const segIndex = state.piperFallbackOffer?.segIndex ?? Math.max(0, state.currentSegmentIndex)
        piperSegmentFailsRef.current = 0
        setState(prev => ({ ...prev, error: null, piperFallbackOffer: null, isPlaying: true }))
        isPlayingRef.current = true
        acquireWakeLock()
        speak(segIndex, segments, 0).catch((err) => {
            console.error('TTS retry error:', err)
            setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
            stop()
        })
    }, [state.piperFallbackOffer, state.currentSegmentIndex, speak, stop, acquireWakeLock])

    const switchToSpeechAndResume = useCallback(() => {
        const offer = state.piperFallbackOffer
        if (!offer) return
        const segments = segmentsRef.current
        const resumeIdx = offer.segIndex
        // Switch provider
        providerRef.current = 'webSpeech'
        localStorage.setItem(LS_PROVIDER, 'webSpeech')
        piperSegmentFailsRef.current = 0
        setState(prev => ({
            ...prev,
            provider: 'webSpeech',
            error: null,
            piperFallbackOffer: null,
            isPlaying: true,
        }))
        isPlayingRef.current = true
        acquireWakeLock()
        speak(resumeIdx, segments, 0).catch((err) => {
            console.error('TTS switchToSpeechAndResume error:', err)
            setState(prev => ({ ...prev, error: `Speech API error: ${err instanceof Error ? err.message : String(err)}` }))
            stop()
        })
    }, [state.piperFallbackOffer, speak, stop, acquireWakeLock])

    const play = useCallback((segments: TTSSegment[], startIndex = 0) => {
        isPlayingRef.current = true
        piperSegmentFailsRef.current = 0
        segmentsRef.current = segments
        acquireWakeLock()
        setState(prev => ({ ...prev, segments, currentSegmentIndex: startIndex, isPlaying: true, error: null, piperFallbackOffer: null }))
        speak(startIndex, segments, 0).catch((err) => {
            console.error('TTS speak error:', err)
            setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
            stop()
        })
    }, [speak, stop])

    /**
     * Jump playback to a specific sentence within the current segment.
     * Only valid when playback is active (sentences already loaded).
     */
    const playFromSentence = useCallback((segments: TTSSegment[], segIndex: number, sentenceIndex: number) => {
        if (!segments[segIndex] || sentenceIndex < 0) return
        const loadedLen = sentencesRef.current?.length ?? 0
        if (loadedLen > 0 && sentenceIndex >= loadedLen) return  // only enforce upper bound when sentences are loaded
        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        cancelTimeoutRef.current = null
        fetchAbortRef.current?.abort()
        fetchAbortRef.current = null
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current)
            audioUrlRef.current = null
        }
        synthRef.current?.cancel()
        speakGenRef.current++
        isPlayingRef.current = true
        acquireWakeLock()
        currentSegmentIdxRef.current = segIndex
        setState(prev => ({ ...prev, isPlaying: true, currentSegmentIndex: segIndex, error: null }))
        speak(segIndex, segments, sentenceIndex).catch((err) => {
            console.error('TTS playFromSentence error:', err)
            setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
            stop()
        })
    }, [speak, stop, acquireWakeLock])

    const pause = useCallback(() => {
        if (state.provider === 'piper') {
            if (state.isPlaying) {
                isPlayingRef.current = false
                audioRef.current?.pause()
                releaseWakeLock()
                setState(prev => ({ ...prev, isPlaying: false }))
            } else if (state.currentSegmentIndex !== -1) {
                isPlayingRef.current = true
                acquireWakeLock()
                setState(prev => ({ ...prev, isPlaying: true }))
                speak(state.currentSegmentIndex, state.segments, currentSentenceIdxRef.current).catch((err) => {
                    console.error('TTS resume error:', err)
                    setState(prev => ({ ...prev, error: `Resume failed: ${err instanceof Error ? err.message : String(err)}` }))
                    stop()
                })
            }
            return
        }

        const synth = synthRef.current
        if (!synth) return
        if (state.isPlaying) {
            isPlayingRef.current = false
            synth.cancel()
            releaseWakeLock()
            setState(prev => ({ ...prev, isPlaying: false }))
        } else if (state.currentSegmentIndex !== -1) {
            isPlayingRef.current = true
            acquireWakeLock()
            setState(prev => ({ ...prev, isPlaying: true }))
            speak(state.currentSegmentIndex, state.segments, currentSentenceIdxRef.current).catch((err) => {
                console.error('TTS resume error:', err)
                setState(prev => ({ ...prev, error: `Resume failed: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state.isPlaying, state.currentSegmentIndex, state.segments, speak, stop])

    const next = useCallback(() => {
        const { currentSegmentIndex, segments } = state
        if (segments.length === 0) {
            console.error('[TTS] Skip Forward: no segments loaded')
            return
        }
        if (currentSegmentIndex + 1 < segments.length) {
            speak(currentSegmentIndex + 1, segments, 0).catch((err) => {
                console.error('[TTS] Skip Forward failed:', err)
                setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        } else {
            stop()
        }
    }, [state, speak, stop])

    const prev = useCallback(() => {
        const { currentSegmentIndex, segments } = state
        if (segments.length === 0) {
            console.error('[TTS] Skip Back: no segments loaded')
            return
        }
        if (currentSegmentIndex > 0) {
            speak(currentSegmentIndex - 1, segments, 0).catch((err) => {
                console.error('[TTS] Skip Back failed:', err)
                setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
        // At first segment: no-op (expected); no log to avoid noise
    }, [state, speak, stop])

    const setVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
        if (voice) localStorage.setItem(LS_VOICE, voice.name)
        else localStorage.removeItem(LS_VOICE)
        voiceRef.current = voice
        setState(prev => ({ ...prev, voice }))
        if (state.isPlaying) {
            speak(state.currentSegmentIndex, state.segments, 0).catch((err) => {
                console.error('TTS voice change error:', err)
                setState(prev => ({ ...prev, error: `Voice change error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state, speak, stop])

    const setProvider = useCallback((provider: TTSProvider) => {
        localStorage.setItem(LS_PROVIDER, provider)
        setState(prev => ({ ...prev, provider, error: null }))
        if (state.isPlaying) stop()
    }, [state.isPlaying, stop])

    const setPiperVoiceId = useCallback((voiceId: string) => {
        localStorage.setItem(LS_PIPER_VOICE, voiceId)
        setState(prev => ({ ...prev, piperVoiceId: voiceId }))
        if (state.isPlaying) {
            speak(state.currentSegmentIndex, state.segments, 0).catch((err) => {
                console.error('TTS piper voice change error:', err)
                setState(prev => ({ ...prev, error: `Voice change error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state, speak, stop])

    const setPiperLang = useCallback((lang: string) => {
        localStorage.setItem(LS_PIPER_LANG, lang)
        setState(prev => ({ ...prev, piperLang: lang }))
    }, [])

    const setQuoteVoiceId = useCallback((voiceId: string) => {
        localStorage.setItem(LS_PIPER_QUOTE, voiceId)
        setState(prev => ({ ...prev, quoteVoiceId: voiceId }))
        if (state.isPlaying) {
            speak(state.currentSegmentIndex, state.segments, 0).catch((err) => {
                console.error('TTS quote voice change error:', err)
                setState(prev => ({ ...prev, error: `Voice change error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state, speak, stop])

    const setSpeakerMapInput = useCallback((input: string) => {
        localStorage.setItem(LS_SPEAKER_MAP, input)
        setState(prev => ({ ...prev, speakerMapInput: input }))
        if (state.isPlaying) {
            speak(state.currentSegmentIndex, state.segments, 0).catch((err) => {
                console.error('TTS speaker map change error:', err)
                setState(prev => ({ ...prev, error: `Speaker map error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state, speak, stop])

    const setRate = useCallback((rate: number) => {
        localStorage.setItem(LS_RATE, String(rate))
        rateRef.current = rate
        setState(prev => ({ ...prev, rate }))
        if (state.isPlaying) {
            speak(state.currentSegmentIndex, state.segments, 0).catch((err) => {
                console.error('TTS rate change error:', err)
                setState(prev => ({ ...prev, error: `Rate change error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
    }, [state, speak, stop])

    const setLangFilter = useCallback((langFilter: string) => {
        localStorage.setItem(LS_LANG, langFilter)
        setState(prev => ({ ...prev, langFilter }))
    }, [])

    const setLocalOnly = useCallback((localOnly: boolean) => {
        localStorage.setItem(LS_LOCAL, String(localOnly))
        setState(prev => ({ ...prev, localOnly }))
    }, [])

    const setSubtitleMode = useCallback((mode: SubtitleMode) => {
        localStorage.setItem(LS_SUBTITLE, mode)
        setState(prev => ({ ...prev, subtitleMode: mode }))
    }, [])

    return {
        state, availableVoices, availablePiperVoices,
        play, playFromSentence, pause, stop, next, prev, retry, clearError, switchToSpeechAndResume,
        setVoice, setRate, setLangFilter, setLocalOnly, setSubtitleMode,
        setProvider, setPiperVoiceId, setPiperLang, setQuoteVoiceId, setSpeakerMapInput,
    }
}
