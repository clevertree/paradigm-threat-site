'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

/**
 * Split text into speakable sentences.
 * - Handles abbreviations like B.C., A.D., c., e.g., i.e., etc. without breaking
 * - Treats each line/paragraph as at least one sentence
 * - Merges very short fragments into the previous sentence
 */
function splitSentences(text: string): string[] {
    // Known abbreviations whose trailing period is NOT a sentence end.
    // Protected by temporarily replacing their periods with a placeholder.
    const ABBR_PLACEHOLDER = '\x00'
    const ABBREVIATIONS = /\b(B\.C|A\.D|B\.C\.E|C\.E|A\.M|P\.M|e\.g|i\.e|etc|vs|approx|ca?|Mr|Mrs|Ms|Dr|Jr|Sr|St|Prof|Gen|Gov|Sgt|Lt|Col|Capt|Rev|Vol|No|Fig|Dept|Univ|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi

    let safe = text.replace(ABBREVIATIONS, (m) => m.slice(0, -1) + ABBR_PLACEHOLDER)

    // Also protect single-capital-letter abbreviations like "S. Julius" or initials
    safe = safe.replace(/\b([A-Z])\./g, '$1' + ABBR_PLACEHOLDER)

    // Also protect decimal numbers like "3,147.5"
    safe = safe.replace(/(\d)\.(\d)/g, '$1' + ABBR_PLACEHOLDER + '$2')

    // Split into paragraphs/lines first (each line is at minimum one sentence)
    const lines = safe.split(/\n+/).filter(l => l.trim())

    const allSentences: string[] = []
    for (const line of lines) {
        // Split on sentence-ending punctuation followed by space or end-of-string
        const raw = line.match(/[^.!?]*[.!?]+(?:\s+|$)/g)
        if (!raw) {
            const restored = line.trim().replaceAll(ABBR_PLACEHOLDER, '.')
            if (restored) allSentences.push(restored)
            continue
        }
        const joined = raw.join('')
        const leftover = line.substring(joined.length).trim()
        if (leftover) raw.push(leftover)
        for (const s of raw) {
            const restored = s.trim().replaceAll(ABBR_PLACEHOLDER, '.')
            if (restored) allSentences.push(restored)
        }
    }

    // Merge very short fragments (<30 chars) with the previous sentence
    const merged: string[] = []
    for (const s of allSentences) {
        if (merged.length > 0 && s.length < 30) {
            merged[merged.length - 1] += ' ' + s
        } else {
            merged.push(s)
        }
    }
    return merged.filter(s => s.length > 0)
}

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
    const currentSentenceIdxRef = useRef(0)
    const sentencesRef = useRef<string[]>([])
    const sentenceSpeakersRef = useRef<string[]>([])
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
    const rateRef = useRef(1.0)
    const providerRef = useRef<TTSProvider>('piper')
    const piperVoiceIdRef = useRef<string>('')
    const piperLangRef = useRef<string>('en')
    const quoteVoiceIdRef = useRef<string>('')
    const speakerMapRef = useRef<Record<string, string>>({})
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
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

    // Stop on page unload
    useEffect(() => {
        const handleStop = () => {
            isPlayingRef.current = false
            synthRef.current?.cancel()
            if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        }
        window.addEventListener('beforeunload', handleStop)
        window.addEventListener('pagehide', handleStop)
        return () => {
            handleStop()
            window.removeEventListener('beforeunload', handleStop)
            window.removeEventListener('pagehide', handleStop)
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

    // Re-acquire wake lock when tab becomes visible again (browser auto-releases on hide)
    useEffect(() => {
        const onVisChange = () => {
            if (document.visibilityState === 'visible' && isPlayingRef.current) acquireWakeLock()
        }
        document.addEventListener('visibilitychange', onVisChange)
        return () => document.removeEventListener('visibilitychange', onVisChange)
    }, [acquireWakeLock])

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
        currentSentenceIdxRef.current = 0
        sentencesRef.current = []
        sentenceSpeakersRef.current = []
        releaseWakeLock()
        piperSegmentFailsRef.current = 0
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

        const seg = segments[segIndex]

        // On first sentence of a segment: load text and split into sentences
        if (sentenceIndex === 0) {
            setState(prev => ({ ...prev, currentSegmentIndex: segIndex, isPlaying: true }))
            setState(prev => ({ ...prev, error: null }))

            let rawText = seg.text ?? ''
            if (!rawText && seg.fetchText) {
                try {
                    rawText = await seg.fetchText()
                    seg.text = rawText // cache
                } catch { rawText = '' }
            }
            if (!isPlayingRef.current) return

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
            setState(prev => ({ ...prev, sentences, currentSentenceIndex: 0 }))
        }

        const sentences = sentencesRef.current
        if (sentenceIndex >= sentences.length) {
            // All sentences spoken — advance to next segment
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

                // Helper: when Piper fails for a sentence (after retries), skip to
                // the next segment.  After 2 consecutive segment failures, pause and
                // offer the user a "Switch to Speech API & Resume" button.
                const handlePiperSegmentFail = (errorMsg: string) => {
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

                fetchWithRetry()
                    .then(blob => {
                        if (!isPlayingRef.current) return
                        // Success — reset consecutive-fail counter
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
                        audioRef.current.onended = () => {
                            if (isPlayingRef.current) {
                                speak(segIndex, segments, sentenceIndex + 1).catch((err) => {
                                    console.error('TTS next-sentence error:', err)
                                    setState(prev => ({ ...prev, error: `TTS playback error: ${err instanceof Error ? err.message : String(err)}` }))
                                    stop()
                                })
                            }
                        }
                        audioRef.current.onerror = (e) => {
                            const mediaErr = audioRef.current?.error
                            const detail = mediaErr ? `${mediaErr.message} (code ${mediaErr.code})` : 'unknown'
                            console.error('Piper audio playback error:', detail, e)
                            handlePiperSegmentFail(`Audio playback failed: ${detail}`)
                        }
                        audioRef.current.play().catch((err) => {
                            console.error('Audio play() rejected:', err)
                            handlePiperSegmentFail(`Could not start audio: ${err instanceof Error ? err.message : 'Autoplay blocked?'}`)
                        })
                    })
                    .catch((err) => {
                        // Don't treat aborted fetches (user stopped) as errors
                        if (err instanceof DOMException && err.name === 'AbortError') return
                        console.error('[TTS] Piper fetch error (all retries exhausted):', err)
                        if (isPlayingRef.current) {
                            handlePiperSegmentFail(`Piper synthesis failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
                        }
                    })

                return
            }
        }

        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        synth.cancel()

        // Small delay after cancel to let the synth settle
        cancelTimeoutRef.current = setTimeout(() => {
            if (!isPlayingRef.current) return

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
                if (isPlayingRef.current) {
                    speak(segIndex, segments, sentenceIndex + 1).catch((err) => {
                        console.error('TTS next-sentence error:', err)
                        setState(prev => ({ ...prev, error: `Speech API error: ${err instanceof Error ? err.message : String(err)}` }))
                        stop()
                    })
                }
            }
            utt.onerror = (e) => {
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error('TTS error:', e)
                    isPlayingRef.current = false
                    setState(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentChunkText: null,
                        error: 'Speech API error. Try Piper or reload.',
                    }))
                }
            }

            utteranceRef.current = utt
            synth.speak(utt)
        }, 20)
    }, [stop])

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
        if (currentSegmentIndex + 1 < segments.length) {
            speak(currentSegmentIndex + 1, segments, 0).catch((err) => {
                console.error('TTS next error:', err)
                setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        } else stop()
    }, [state, speak, stop])

    const prev = useCallback(() => {
        const { currentSegmentIndex, segments } = state
        if (currentSegmentIndex > 0) {
            speak(currentSegmentIndex - 1, segments, 0).catch((err) => {
                console.error('TTS prev error:', err)
                setState(prev => ({ ...prev, error: `TTS error: ${err instanceof Error ? err.message : String(err)}` }))
                stop()
            })
        }
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
        play, pause, stop, next, prev, clearError, switchToSpeechAndResume,
        setVoice, setRate, setLangFilter, setLocalOnly, setSubtitleMode,
        setProvider, setPiperVoiceId, setPiperLang, setQuoteVoiceId, setSpeakerMapInput,
    }
}
