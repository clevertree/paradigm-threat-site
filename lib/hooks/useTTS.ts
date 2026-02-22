'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface TTSSegment {
    id: string
    title: string
    /** Pre-loaded text, OR use fetchText for lazy loading */
    text?: string
    fetchText?: () => Promise<string>
}

export interface TTSState {
    isPlaying: boolean
    currentSegmentIndex: number
    segments: TTSSegment[]
    voice: SpeechSynthesisVoice | null
    rate: number
    langFilter: string
    localOnly: boolean
    /** The chunk of text currently being spoken (for subtitle display) */
    currentChunkText: string | null
}

const LS_VOICE = 'tl-tts-voice'
const LS_RATE = 'tl-tts-rate'
const LS_LANG = 'tl-tts-lang'
const LS_LOCAL = 'tl-tts-local-only'

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
    })

    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

    const synthRef = useRef<SpeechSynthesis | null>(null)
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const cancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isPlayingRef = useRef(false)
    const currentChunkIndexRef = useRef(0)
    // Keep latest voice/rate in refs for use inside speak()
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
    const rateRef = useRef(1.0)

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
        setState(prev => ({
            ...prev,
            rate: savedRate ? parseFloat(savedRate) : prev.rate,
            langFilter: savedLang ?? prev.langFilter,
            localOnly: savedLocal === 'true' ? true : savedLocal === 'false' ? false : prev.localOnly,
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
        currentChunkIndexRef.current = 0
        setState(prev => ({ ...prev, isPlaying: false, currentSegmentIndex: -1, currentChunkText: null }))
    }, [])

    const speak = useCallback(async (
        index: number,
        segments: TTSSegment[],
        chunkIndex: number = 0
    ) => {
        const synth = synthRef.current
        if (!synth || !segments[index]) { stop(); return }
        if (!isPlayingRef.current) return

        if (chunkIndex === 0) {
            setState(prev => ({ ...prev, currentSegmentIndex: index, isPlaying: true }))
        }
        currentChunkIndexRef.current = chunkIndex

        // Lazy-load text if needed
        const seg = segments[index]
        let rawText = seg.text ?? ''
        if (!rawText && seg.fetchText) {
            try {
                rawText = await seg.fetchText()
                // Cache on the segment so we don't refetch
                seg.text = rawText
            } catch {
                rawText = ''
            }
        }
        if (!isPlayingRef.current) return

        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current)
        synth.cancel()

        cancelTimeoutRef.current = setTimeout(() => {
            if (!isPlayingRef.current) return

            const clean = rawText
                .replace(/[#*_~`\[\]()]/g, ' ')
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            const MAX = 2800
            const full = chunkIndex === 0 && seg.title ? `${seg.title}. ${clean}` : clean
            const chunks: string[] = []
            let remaining = full
            while (remaining.length > 0) {
                if (remaining.length <= MAX) { chunks.push(remaining); break }
                let split = remaining.lastIndexOf('.', MAX)
                if (split === -1 || split < MAX * 0.5) split = remaining.lastIndexOf(' ', MAX)
                if (split === -1) split = MAX
                chunks.push(remaining.substring(0, split + 1).trim())
                remaining = remaining.substring(split + 1).trim()
            }

            if (chunkIndex >= chunks.length) {
                if (index + 1 < segments.length) speak(index + 1, segments, 0)
                else stop()
                return
            }

            const chunkText = chunks[chunkIndex]
            setState(prev => ({ ...prev, currentChunkText: chunkText }))

            const utt = new SpeechSynthesisUtterance(chunkText)
            if (voiceRef.current) utt.voice = voiceRef.current
            utt.rate = rateRef.current
            utt.pitch = 1.0
            utt.volume = 1.0

            utt.onstart = () => {
                setState(prev => ({ ...prev, currentSegmentIndex: index, isPlaying: true, currentChunkText: chunkText }))
            }
            utt.onend = () => {
                if (isPlayingRef.current) speak(index, segments, chunkIndex + 1)
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
        setState(prev => ({ ...prev, segments, currentSegmentIndex: startIndex, isPlaying: true }))
        speak(startIndex, segments, 0)
    }, [speak])

    const pause = useCallback(() => {
        const synth = synthRef.current
        if (!synth) return
        if (state.isPlaying) {
            isPlayingRef.current = false
            synth.cancel()
            setState(prev => ({ ...prev, isPlaying: false }))
        } else {
            if (state.currentSegmentIndex !== -1) {
                isPlayingRef.current = true
                setState(prev => ({ ...prev, isPlaying: true }))
                speak(state.currentSegmentIndex, state.segments, currentChunkIndexRef.current)
            }
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

    return { state, availableVoices, play, pause, stop, next, prev, setVoice, setRate, setLangFilter, setLocalOnly }
}
