'use client'

import React, { useCallback, useEffect, useRef, useMemo } from 'react'
import { useTTS } from '@/lib/hooks/useTTS'
import { stripMarkdownForTTS } from '@/components/Timeline/ttsHelpers'

export interface ArticleTTSProviderProps {
  articleTitle: string
  articleContent: string
  basePath: string
  children: (ctx: {
    onPlay: () => void
    onPause: () => void
    onStop: () => void
    onPlayFromSentence: (sentenceIndex: number) => void
    isPlaying: boolean
    currentSentenceIndex: number
    sentences: string[]
    error: string | null
    onClearError: () => void
  }) => React.ReactNode
}

export function ArticleTTSProvider({
  articleTitle,
  articleContent,
  basePath: _basePath,
  children,
}: ArticleTTSProviderProps) {
  const tts = useTTS()
  const ttsRef = useRef(tts)
  ttsRef.current = tts

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
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
      })}
    </>
  )
}
