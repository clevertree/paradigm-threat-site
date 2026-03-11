'use client'

import React, { useEffect, useRef } from 'react'
import { stripMarkdownForTTS, buildParagraphStarts } from '@/components/Timeline/ttsHelpers'

export interface ArticleTTSScrollSyncProps {
  /** Ref to the article container (must contain .mdx-content) */
  articleRef: React.RefObject<HTMLElement | null>
  currentSentenceIndex: number
  sentences: string[]
  articleContent: string
  articleTitle: string
  isPlaying: boolean
}

/**
 * DOM-only scroll sync for TTS playback. Does not modify or re-render article content.
 * Maps sentence index → paragraph index, then scrolls the corresponding DOM paragraph into view.
 */
export function ArticleTTSScrollSync({
  articleRef,
  currentSentenceIndex,
  sentences,
  articleContent,
  articleTitle,
  isPlaying,
}: ArticleTTSScrollSyncProps) {
  const lastScrolledRef = useRef(-1)

  useEffect(() => {
    if (!isPlaying) {
      lastScrolledRef.current = -1
      return
    }
    if (currentSentenceIndex < 0 || sentences.length === 0) return
    const container = articleRef.current
    if (!container) return
    // Avoid duplicate scroll for same sentence (e.g. from re-renders)
    if (lastScrolledRef.current === currentSentenceIndex) return
    lastScrolledRef.current = currentSentenceIndex

    const text = stripMarkdownForTTS(articleContent, articleTitle)
    const starts = buildParagraphStarts(text)
    // paragraph index = largest i where starts[i] <= currentSentenceIndex
    let paraIdx = 0
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= currentSentenceIndex) paraIdx = i
    }

    const blocks = container.querySelectorAll<HTMLElement>('.mdx-content p, .mdx-content h2, .mdx-content h3, .mdx-content h4, .mdx-content blockquote, .mdx-content li')
    const el = blocks[paraIdx]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [articleRef, articleContent, articleTitle, currentSentenceIndex, sentences.length, isPlaying])

  return null
}
