'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface TTSSegment {
    id: string
    title: string
    /** Pre-loaded text, OR use fetchText for lazy loading */
    text?: string
    fetchText?: () => Promise<string>
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
    /** The sentence currently being spoken */
    currentChunkText: string | null
    /** All sentences for the current segment */
    sentences: string[]
    /** Index of the sentence currently being spoken */
    currentSentenceIndex: number
    /** Display mode: caption (1-2 sentences) or scroll (all text, auto-scrolling) */
    subtitleMode: SubtitleMode
}

const LS_VOICE = 'tl-tts-voice'
const LS_RATE = 'tl-tts-rate'
const LS_LANG = 'tl-tts-lang'
const LS_LOCAL = 'tl-tts-local-only'
const LS_SUBTITLE = 'tl-tts-subtitle'

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

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        isPlaying: false,
        currentSegmentIndex: -1,
        segments: [],
        voice: null,
        rate: 1.0,
        langFilter: 'en',
        localOnly: false,
        currentChunkText: null,
        sentences: [],
        currentSentenceIndex: -1,
        subtitleMode: 'caption',
    })

    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

    const synthRef = useRef<SpeechSynthesis | null>(null)
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const cancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isPlayingRef = useRef(false)
    const currentSentenceIdxRef = useRef(0)
    const sentencesRef = useRef<string[]>([])
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
    const rateRef = useRef(1.0)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)

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
        setState(prev => ({
            ...prev,
            rate: savedRate ? parseFloat(savedRate) : prev.rate,
            langFilter: savedLang ?? prev.langFilter,
            localOnly: savedLocal === 'true',
            subtitleMode: (savedSubtitle === 'scroll' ? 'scroll' : 'caption') as SubtitleMode,
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
    }, [state.voice, state.rate])

    const stop = useCallback(() => {
        const synth = synthRef.current
        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        synth?.cancel()
        isPlayingRef.current = false
        currentSentenceIdxRef.current = 0
        sentencesRef.current = []
        releaseWakeLock()
        setState(prev => ({
            ...prev,
            isPlaying: false,
            currentSegmentIndex: -1,
            currentChunkText: null,
            sentences: [],
            currentSentenceIndex: -1,
        }))
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

        const seg = segments[segIndex]

        // On first sentence of a segment: load text and split into sentences
        if (sentenceIndex === 0) {
            setState(prev => ({ ...prev, currentSegmentIndex: segIndex, isPlaying: true }))

            let rawText = seg.text ?? ''
            if (!rawText && seg.fetchText) {
                try {
                    rawText = await seg.fetchText()
                    seg.text = rawText // cache
                } catch { rawText = '' }
            }
            if (!isPlayingRef.current) return

            const clean = rawText
                .replace(/[#*_~`\[\]()]/g, ' ')
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            const full = clean
            const sentences = splitSentences(full)
            sentencesRef.current = sentences
            setState(prev => ({ ...prev, sentences, currentSentenceIndex: 0 }))
        }

        const sentences = sentencesRef.current
        if (sentenceIndex >= sentences.length) {
            // All sentences spoken — advance to next segment
            if (segIndex + 1 < segments.length) {
                speak(segIndex + 1, segments, 0)
            } else {
                stop()
            }
            return
        }

        currentSentenceIdxRef.current = sentenceIndex

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
                if (isPlayingRef.current) speak(segIndex, segments, sentenceIndex + 1)
            }
            utt.onerror = (e) => {
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error('TTS error:', e)
                    isPlayingRef.current = false
                    setState(prev => ({ ...prev, isPlaying: false, currentChunkText: null }))
                }
            }

            utteranceRef.current = utt
            synth.speak(utt)
        }, 20)
    }, [stop])

    const play = useCallback((segments: TTSSegment[], startIndex = 0) => {
        isPlayingRef.current = true
        acquireWakeLock()
        setState(prev => ({ ...prev, segments, currentSegmentIndex: startIndex, isPlaying: true }))
        speak(startIndex, segments, 0)
    }, [speak])

    const pause = useCallback(() => {
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
            speak(state.currentSegmentIndex, state.segments, currentSentenceIdxRef.current)
        }
    }, [state.isPlaying, state.currentSegmentIndex, state.segments, speak])

    const next = useCallback(() => {
        const { currentSegmentIndex, segments } = state
        if (currentSegmentIndex + 1 < segments.length) speak(currentSegmentIndex + 1, segments, 0)
        else stop()
    }, [state, speak, stop])

    const prev = useCallback(() => {
        const { currentSegmentIndex, segments } = state
        if (currentSegmentIndex > 0) speak(currentSegmentIndex - 1, segments, 0)
    }, [state, speak])

    const setVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
        if (voice) localStorage.setItem(LS_VOICE, voice.name)
        else localStorage.removeItem(LS_VOICE)
        voiceRef.current = voice
        setState(prev => ({ ...prev, voice }))
        if (state.isPlaying) speak(state.currentSegmentIndex, state.segments, 0)
    }, [state, speak])

    const setRate = useCallback((rate: number) => {
        localStorage.setItem(LS_RATE, String(rate))
        rateRef.current = rate
        setState(prev => ({ ...prev, rate }))
        if (state.isPlaying) speak(state.currentSegmentIndex, state.segments, 0)
    }, [state, speak])

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
        state, availableVoices,
        play, pause, stop, next, prev,
        setVoice, setRate, setLangFilter, setLocalOnly, setSubtitleMode,
    }
}
