'use client'

import React, { useEffect, useState } from 'react'
import Markdown from 'markdown-to-jsx'
import { PopImage, DynamicIndex } from '@/components'
import { transformImageCaptions } from '@/components/Timeline/markdownTransform'

/** Strip H1 title and YAML frontmatter before rendering. */
function prepareMarkdownContent(md: string): string {
  if (typeof md !== 'string') return ''
  let out = md
    .replace(/^# .+\n*/m, '')
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
  return out.trimStart()
}

interface RemoteMarkdownProps {
  src: string
  baseUrl: string
  title?: string
  className?: string
}

export function RemoteMarkdown({ src, baseUrl, title, className = '' }: RemoteMarkdownProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = src.startsWith('http') ? src : `${baseUrl.replace(/\/$/, '')}/${src.replace(/^\//, '')}`
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        setContent(text)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setContent(null)
        setLoading(false)
      })
  }, [src, baseUrl])

  if (loading) {
    return <div className={`animate-pulse text-slate-500 text-sm ${className}`}>Loading…</div>
  }
  if (error) {
    return <div className={`text-red-600 dark:text-red-400 text-sm ${className}`}>Failed to load: {error}</div>
  }
  if (!content) return null

  const prepared = prepareMarkdownContent(typeof content === 'string' ? content : '')
  const transformed = transformImageCaptions(prepared)

  return (
    <article className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>}
      <Markdown
        options={{
          overrides: {
            img: (props) => (
              <PopImage
                {...props}
                basePath={baseUrl}
                className={props.className}
              />
            ),
            PopImage: (props: { children?: string;[key: string]: unknown }) => (
              <PopImage
                {...props}
                basePath={baseUrl}
                className={props.className as string}
              >
                {typeof props.children === 'string' ? (
                  <Markdown
                    options={{
                      overrides: {
                        a: { props: { target: '_blank', rel: 'noopener' } },
                      },
                    }}
                  >
                    {props.children}
                  </Markdown>
                ) : null}
              </PopImage>
            ),
            a: { props: { target: '_blank', rel: 'noopener' } },
            DynamicIndex: (props: { [key: string]: unknown }) => <DynamicIndex {...props} mode="inline" currentPath={baseUrl} />,
            dynamicindex: (props: { [key: string]: unknown }) => <DynamicIndex {...props} mode="inline" currentPath={baseUrl} />,
          },
        }}
      >
        {typeof transformed === 'string' ? transformed : ''}
      </Markdown>
    </article>
  )
}
