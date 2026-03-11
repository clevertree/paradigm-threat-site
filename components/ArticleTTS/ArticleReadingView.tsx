'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import { stripMarkdownForTTS, splitSentences } from '@/components/Timeline/ttsHelpers'

export interface ArticleReadingViewProps {
  articleContent: string
  articleTitle: string
  currentSentenceIndex: number
  sentences: string[]
}

/**
 * Build paragraphs (sentence arrays) that match TTS sentence order.
 * TTS uses splitSentences on the full stripped text; we replicate paragraph
 * structure by splitting on \n\n and splitSentences per paragraph.
 */
function buildParagraphs(text: string): string[][] {
  const paras = text.split(/\n\n+/).filter(p => p.trim())
  return paras.map(para => splitSentences(para))
}

export function ArticleReadingView({
  articleContent,
  articleTitle,
  currentSentenceIndex,
  sentences,
}: ArticleReadingViewProps) {
  const sentenceRefs = useRef<Map<number, HTMLSpanElement>>(new Map())

  const paragraphs = useMemo(() => {
    const text = stripMarkdownForTTS(articleContent, articleTitle)
    return buildParagraphs(text)
  }, [articleContent, articleTitle])

  useEffect(() => {
    if (currentSentenceIndex < 0) return
    const el = sentenceRefs.current.get(currentSentenceIndex)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentSentenceIndex])

  let globalIndex = 0
  return (
    <div className="mdx-content">
      {paragraphs.map((para, pi) => (
        <p key={pi} className="mb-4">
          {para.map((sent, si) => {
            const idx = globalIndex++
            const isActive = idx === currentSentenceIndex
            return (
              <span
                key={idx}
                ref={el => {
                  if (el) sentenceRefs.current.set(idx, el)
                  else sentenceRefs.current.delete(idx)
                }}
                data-sentence-index={idx}
                className={isActive ? 'bg-indigo-500/20 rounded px-0.5 -mx-0.5' : undefined}
              >
                {sent}
                {si < para.length - 1 ? ' ' : ''}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
