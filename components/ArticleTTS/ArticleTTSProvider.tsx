'use client'

import React, { useCallback, useEffect, useRef, useMemo } from 'react'
import { useTTS } from '@/lib/hooks/useTTS'
import type { TTSState, SubtitleMode, PiperVoice, TTSProvider } from '@/lib/hooks/useTTS'
import { stripMarkdownForTTS } from '@/components/Timeline/ttsHelpers'

export interface ArticleTTSContext {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPlayFromSentence: (sentenceIndex: number) => void
  isPlaying: boolean
  currentSentenceIndex: number
  sentences: string[]
  error: string | null
  onClearError: () => void
  ttsState: TTSState
  availableVoices: SpeechSynthesisVoice[]
  availablePiperVoices: PiperVoice[]
  setVoice: (v: SpeechSynthesisVoice | null) => void
  setRate: (r: number) => void
  setProvider: (p: TTSProvider) => void
  setPiperVoiceId: (id: string) => void
  setPiperLang: (lang: string) => void
  setQuoteVoiceId: (id: string) => void
  setSpeakerMapInput: (input: string) => void
  setLangFilter: (l: string) => void
  setLocalOnly: (b: boolean) => void
  setSubtitleMode: (m: SubtitleMode) => void
  switchToSpeechAndResume?: () => void
  retry: () => void
}

export interface ArticleTTSProviderProps {
  articleTitle: string
  articleContent: string
  basePath: string
  children: (ctx: ArticleTTSContext) => React.ReactNode
}

export function ArticleTTSProvider({
  articleTitle,
  articleContent,
  basePath: _basePath,
  children,
}: ArticleTTSProviderProps) {
  const tts = useTTS()
  const ttsRef = useRef(tts)
  useEffect(() => {
    ttsRef.current = tts
  }, [tts])

  const segment = useMemo(() => ({
    id: 'article',
    title: articleTitle,
    text: stripMarkdownForTTS(articleContent, articleTitle),
  }), [articleTitle, articleContent])

  const handlePlay = useCallback(() => {
    tts.play([segment], 0)
  }, [tts, segment])

  const handleStop = useCallback(() => {
    tts.stop()
    tts.clearError()
  }, [tts])

  const handlePlayFromSentence = useCallback((sentenceIndex: number) => {
    tts.playFromSentence([segment], 0, sentenceIndex)
  }, [tts, segment])

  useEffect(
    () => () => ttsRef.current.stop(),
     
    []
  )

  return (
    <>
      {children({
        onPlay: handlePlay,
        onPause: tts.pause,
        onStop: handleStop,
        onPlayFromSentence: handlePlayFromSentence,
        isPlaying: tts.state.isPlaying,
        currentSentenceIndex: tts.state.currentSentenceIndex,
        sentences: tts.state.sentences,
        error: tts.state.error,
        onClearError: tts.clearError,
        ttsState: tts.state,
        availableVoices: tts.availableVoices,
        availablePiperVoices: tts.availablePiperVoices,
        setVoice: tts.setVoice,
        setRate: tts.setRate,
        setProvider: tts.setProvider,
        setPiperVoiceId: tts.setPiperVoiceId,
        setPiperLang: tts.setPiperLang,
        setQuoteVoiceId: tts.setQuoteVoiceId,
        setSpeakerMapInput: tts.setSpeakerMapInput,
        setLangFilter: tts.setLangFilter,
        setLocalOnly: tts.setLocalOnly,
        setSubtitleMode: tts.setSubtitleMode,
        switchToSpeechAndResume: tts.switchToSpeechAndResume,
        retry: tts.retry,
      })}
    </>
  )
}
