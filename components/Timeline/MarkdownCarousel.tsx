'use client'

import React, { useEffect, useState } from 'react'
import Markdown from 'markdown-to-jsx'
import type { TimelineEntry } from '@/components/TimelineContext'
import { PopImage } from '@/components'
import { transformImageCaptions, DEFAULT_IMAGE_CLASS } from './markdownTransform'

/** Strip H1 title and YAML frontmatter before rendering. */
function prepareMarkdownContent(md: string): string {
  if (typeof md !== 'string') return ''
  let out = md
    .replace(/^# .+\n*/m, '')
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
  return out.trimStart()
}

interface MarkdownCarouselProps {
  events: TimelineEntry[]
  baseUrl: string
  selectedId: string | null
  onSelectEvent: (entry: TimelineEntry) => void
  /** When provided (mobile), render Full page button between Prev and Next */
  fullPageControl?: { fullPage: boolean; onToggle: () => void }
}

export function MarkdownCarousel({
  events,
  baseUrl,
  selectedId,
  onSelectEvent,
  fullPageControl,
}: MarkdownCarouselProps) {
  const [mdContent, setMdContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const currentIndex = events.findIndex((e) => e.id === selectedId)
  const currentEntry = currentIndex >= 0 ? events[currentIndex]! : null
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < events.length - 1
  const prevEntry = hasPrev ? events[currentIndex! - 1]! : null
  const nextEntry = hasNext ? events[currentIndex! + 1]! : null

  useEffect(() => {
    if (!currentEntry) {
      setMdContent(null)
      return
    }
    setLoading(true)
    fetch(`${baseUrl}/${currentEntry.md_path}`)
      .then((res) => (res.ok ? res.text() : Promise.resolve(null)))
      .then((text) => setMdContent(text ?? '*Failed to load content*'))
      .catch(() => setMdContent('*Failed to load content*'))
      .finally(() => setLoading(false))
  }, [baseUrl, currentEntry])

  return (
    <aside className={`flex flex-col min-w-0 w-full min-h-0 flex-1 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden ${fullPageControl ? 'border-t' : 'border-l'}`} style={{ minHeight: 0 }}>
      {/* Content: single markdown, scrollable */}
      <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden px-4 py-4 overscroll-contain touch-pan-y" style={{ minHeight: 0, WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } as React.CSSProperties}>
        {currentEntry ? (
          <>
            <h2 className={`font-semibold text-slate-900 dark:text-slate-100 mb-4 text-left ${currentEntry.type === 'article' ? 'text-sm' : 'text-lg'}`}>
              {currentEntry.title}
            </h2>
            {loading ? (
              <div className="text-slate-500 text-sm text-left">Loading…</div>
            ) : mdContent ? (
              <div className={`prose dark:prose-invert max-w-none text-left ${currentEntry.type === 'article' ? 'prose-sm text-sm' : 'prose-sm'}`}>
                <Markdown
                  options={{
                    overrides: {
                      img: (props) => (
                        <PopImage
                          {...props}
                          basePath={baseUrl}
                          className={props.className || DEFAULT_IMAGE_CLASS}
                        />
                      ),
                      PopImage: (props: { children?: React.ReactNode;[key: string]: unknown }) => {
                        const captionText = typeof props.children === 'string' ? props.children : null
                        return (
                          <PopImage
                            {...props}
                            basePath={baseUrl}
                            className={(props.className as string) || DEFAULT_IMAGE_CLASS}
                          >
                            {captionText ? (
                              <Markdown
                                options={{
                                  overrides: {
                                    a: { props: { target: '_blank', rel: 'noopener' } },
                                  },
                                }}
                              >
                                {captionText}
                              </Markdown>
                            ) : null}
                          </PopImage>
                        )
                      },
                      a: { props: { target: '_blank', rel: 'noopener' } },
                    },
                  }}
                >
                  {transformImageCaptions(prepareMarkdownContent(typeof mdContent === 'string' ? mdContent : ''))}
                </Markdown>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-slate-500 text-sm">Select an event.</div>
        )}
      </div>

      {/* Bottom: Prev / [Full page] / Next */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => prevEntry && onSelectEvent(prevEntry)}
          disabled={!hasPrev}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ← Prev
        </button>
        {fullPageControl && (
          <button
            type="button"
            onClick={fullPageControl.onToggle}
            className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            {fullPageControl.fullPage ? 'Exit full page' : 'Full page'}
          </button>
        )}
        <button
          type="button"
          onClick={() => nextEntry && onSelectEvent(nextEntry)}
          disabled={!hasNext}
          className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Next →
        </button>
      </div>
    </aside>
  )
}
