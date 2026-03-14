'use client'

import React, { useRef, useState, useEffect } from 'react'
import { ArticleTTSProvider } from '@/components/ArticleTTS/ArticleTTSProvider'
import { ArticleTTSOverlay } from '@/components/ArticleTTS/ArticleTTSOverlay'
import { ArticleTTSScrollSync } from '@/components/ArticleTTS/ArticleTTSScrollSync'
import { stripMarkdownForTTS, buildParagraphStarts } from '@/components/Timeline/ttsHelpers'
import { ArticleNav, ShareLinks } from '@/components'

export interface ArticleClientShellProps {
  articleTitle: string
  articleContent: string
  basePath: string
  articlePath?: string
  articleDescription?: string
  children: React.ReactNode
}

export function ArticleClientShell ({
  articleTitle,
  articleContent,
  basePath,
  articlePath,
  articleDescription,
  children
}: ArticleClientShellProps) {
  const articleRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Notify DynamicIndex (sidebar TOC) to re-scan headers after SSR content is in the DOM
  useEffect(() => {
    const id = setTimeout(() => {
      window.dispatchEvent(new Event('dynamic-index-update'))
    }, 200)
    return () => clearTimeout(id)
  }, [])

  return (
    <ArticleTTSProvider
      articleTitle={articleTitle}
      articleContent={articleContent}
      basePath={basePath}
    >
      {({
        onPlayFromSentence,
        isPlaying,
        currentSentenceIndex,
        sentences,
        onClearError,
        ttsState,
        availableVoices,
        availablePiperVoices,
        onPlay,
        onPause,
        onStop,
        setVoice,
        setRate,
        setProvider,
        setPiperVoiceId,
        setPiperLang,
        setQuoteVoiceId,
        setSpeakerMapInput,
        setLangFilter,
        setLocalOnly,
        setSubtitleMode,
        switchToSpeechAndResume,
        retry
      }) => {
        const scrollToTop = () => window.scroll({ top: 0, left: 0, behavior: 'smooth' })
        const handleArticleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
          if (sentences.length === 0) return
          const target = e.target as Node
          const container = articleRef.current
          if (!container) return
          const mdx = container.querySelector('.mdx-content')
          if (!mdx?.contains(target)) return
          const block = (target as Element).closest?.('p, h2, h3, h4, blockquote, li')
          if (!block) return
          const blocks = container.querySelectorAll('.mdx-content p, .mdx-content h2, .mdx-content h3, .mdx-content h4, .mdx-content blockquote, .mdx-content li')
          const paraIdx = Array.from(blocks).indexOf(block as Element)
          if (paraIdx < 0) return
          const text = stripMarkdownForTTS(articleContent, articleTitle)
          const starts = buildParagraphStarts(text)
          const sentenceIndex = starts[paraIdx] ?? 0
          onPlayFromSentence(sentenceIndex)
        }

        return (
          <div className="space-y-12 relative">
            <article
              ref={articleRef}
              className="prose prose-slate dark:prose-invert max-w-none"
              onDoubleClick={sentences.length > 0 ? handleArticleDoubleClick : undefined}
            >
              {children}
              {articlePath && (
                <ShareLinks
                  url={`/${articlePath}`}
                  title={articleTitle}
                  description={articleDescription}
                />
              )}
            </article>
            <ArticleTTSScrollSync
              articleRef={articleRef}
              currentSentenceIndex={currentSentenceIndex}
              sentences={sentences}
              articleContent={articleContent}
              articleTitle={articleTitle}
              isPlaying={isPlaying}
            />
            <ArticleNav />
            <ArticleTTSOverlay
              ttsState={ttsState}
              availableVoices={availableVoices}
              availablePiperVoices={availablePiperVoices}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
              onClearError={onClearError}
              onSeekToSentence={onPlayFromSentence}
              sentences={sentences}
              currentSentenceIndex={currentSentenceIndex}
              onRetry={retry}
              onSetVoice={setVoice}
              onSetRate={setRate}
              onSetProvider={setProvider}
              onSetPiperVoiceId={setPiperVoiceId}
              onSetPiperLang={setPiperLang}
              onSetQuoteVoiceId={setQuoteVoiceId}
              onSetSpeakerMapInput={setSpeakerMapInput}
              onSetLangFilter={setLangFilter}
              onSetLocalOnly={setLocalOnly}
              onSetSubtitleMode={setSubtitleMode}
              onSwitchToSpeechAndResume={switchToSpeechAndResume}
              onScrollToTop={scrollToTop}
              isScrolled={isScrolled}
            />
          </div>
        )
      }}
    </ArticleTTSProvider>
  )
}
