'use client'

import React, { useState, useEffect, useMemo, memo, useRef } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { RemoteMDX } from '@/components/RemoteMDX'
import { PopImage, useFiles, ArticleNav } from '@/components'
import Link from 'next/link'
import matter from 'gray-matter'
import { ArticleTTSProvider } from '@/components/ArticleTTS/ArticleTTSProvider'
import { ArticleTTSOverlay } from '@/components/ArticleTTS/ArticleTTSOverlay'
import { ArticleTTSScrollSync } from '@/components/ArticleTTS/ArticleTTSScrollSync'
import { stripMarkdownForTTS, buildParagraphStarts } from '@/components/Timeline/ttsHelpers'
import { SuspenseLoader } from '@client'

export const CatchAllClient = memo(function CatchAllClient () {
  const params = useParams()
  const pathname = usePathname()
  const { fileList } = useFiles()
  const [content, setContent] = useState<string | null>(null)
  const [compiledMdx, setCompiledMdx] = useState<{ compiledSource: string; frontmatter?: Record<string, unknown>; scope?: Record<string, unknown> } | null>(null)
  const [basePath, setBasePath] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [unusedImages, setUnusedImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filesIndex, setFilesIndex] = useState<any>(null)
  const [directFiles, setDirectFiles] = useState<string[]>([])
  const [subDirs, setSubDirs] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [mds, setMds] = useState<string[]>([])
  const [mdContents, setMdContents] = useState<Record<string, { title: string; content: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  const slugArray = useMemo(() => {
    if (!params.slug) return []
    return Array.isArray(params.slug) ? params.slug : [params.slug]
  }, [params.slug])

  const path = useMemo(() => slugArray.join('/'), [slugArray])
  const loadingPathRef = useRef<string | null>(null)
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!fileList) return
    setFilesIndex(fileList)

    const baseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net'
    const version = typeof fileList?._version === 'string' ? fileList._version : ''
    const vParam = version ? `?v=${version}` : ''

    const requestPath = path
    loadingPathRef.current = requestPath
    let isMounted = true
    const abortController = new AbortController()

    const loadPage = async () => {
      window.scrollTo(0, 0)
      try {
        setLoading(true)

        const articleUrl = `/api/article?path=${encodeURIComponent(requestPath)}${version ? `&v=${encodeURIComponent(version)}` : ''}`
        const articleRes = await fetch(articleUrl, { signal: abortController.signal })

        if (loadingPathRef.current !== requestPath || !isMounted) return

        if (articleRes.ok) {
          const data = await articleRes.json()

          if (loadingPathRef.current !== requestPath || !isMounted) return

          const { compiledSource, frontmatter, scope, content: mdxSource, title: articleTitle, basePath: calcBasePath } = data

          if (isMounted && loadingPathRef.current === requestPath) {
            setBasePath(calcBasePath || '')
            setContent(mdxSource)
            setCompiledMdx({ compiledSource, frontmatter, scope })
            setArticleTitle(articleTitle || 'Article')
            setDirectFiles([])
            setSubDirs([])
            setImages([])
            setMds([])
            try {
              if (pathname) localStorage.setItem('pt-last-read-path', pathname)
            } catch (_) {}
          }

          let current = fileList
          for (const s of (calcBasePath || '').split('/').filter(Boolean)) {
            if (current && current[s]) current = current[s]
            else { current = null; break }
          }

          if (current && typeof current === 'object') {
            const imagesInDir = Object.keys(current).filter(k => {
              if (k === '_count') return false
              const val = current[k]
              const isFile = val !== null && typeof val === 'object' && !('_count' in val)
              return isFile && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(k)
            })
            const unused = imagesInDir.filter((img: string) => {
              const escapedImg = img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const regex = new RegExp(`[\\(/\\s"'.]${escapedImg}([\\?\\s"')]|$)`, 'i')
              return !regex.test(mdxSource)
            })
            if (isMounted && loadingPathRef.current === requestPath) setUnusedImages(unused)
          }
        } else {
          let current = fileList
          for (const s of slugArray) {
            if (current && typeof current === 'object' && current[s]) current = current[s]
            else { current = null; break }
          }

          if (current && typeof current === 'object') {
            const dirs: string[] = []
            const files: string[] = []

            Object.keys(current).forEach(key => {
              if (key === '_count' || key.startsWith('_')) return
              const val = current[key]
              const isFile = val !== null && typeof val === 'object' && !('_count' in val)
              if (isFile) {
                files.push(key)
              } else {
                dirs.push(key)
              }
            })

            if (isMounted && loadingPathRef.current === requestPath) {
              setContent(null)
              setCompiledMdx(null)
              setArticleTitle('')
              setDirectFiles(files.sort())
              setSubDirs(dirs.sort())

              const imgFiles = files.filter((f: string) => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f))
              const mdFiles = files.filter((f: string) => f.endsWith('.md') && f !== 'page.md' && !f.endsWith('.auto.md'))

              setImages(imgFiles)
              setMds(mdFiles)

              const contents: Record<string, { title: string; content: string }> = {}

              mdFiles.forEach(f => {
                const fileData = current[f]
                if (fileData?._title) {
                  contents[f] = { title: fileData._title, content: '' }
                }
              })

              await Promise.all(mdFiles.map(async (f) => {
                if (!isMounted || loadingPathRef.current !== requestPath) return
                const fullPath = path ? `${path}/${f}` : f
                try {
                  const response = await fetch(`${baseUrl}/${fullPath}${vParam}`, { signal: abortController.signal })
                  if (response.ok) {
                    const text = await response.text()
                    const { content: mdxSource, data: frontMatter } = matter(text)
                    contents[f] = {
                      title: frontMatter.title || contents[f]?.title || f.replace(/_/g, ' ').replace('.md', ''),
                      content: mdxSource
                    }
                  }
                } catch (e) {}
              }))
              if (isMounted && loadingPathRef.current === requestPath) setMdContents(contents)
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && isMounted && loadingPathRef.current === requestPath) {
          setError(String(e))
        }
      } finally {
        if (loadingPathRef.current === requestPath) setLoading(false)
      }
    }

    loadPage()
    return () => {
      isMounted = false
      loadingPathRef.current = null
      abortController.abort()
    }
  }, [path, slugArray, fileList])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><SuspenseLoader /></div>
  }

  if (content) {
    return (
      <ArticleTTSProvider
        articleTitle={articleTitle}
        articleContent={content}
        basePath={basePath}
      >
        {({ onPlay, onPause, onStop, onPlayFromSentence, isPlaying, currentSentenceIndex, sentences, onClearError, ttsState, availableVoices, availablePiperVoices, setVoice, setRate, setProvider, setPiperVoiceId, setPiperLang, setQuoteVoiceId, setSpeakerMapInput, setLangFilter, setLocalOnly, setSubtitleMode, switchToSpeechAndResume, retry }) => {
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
            const text = stripMarkdownForTTS(content, articleTitle)
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
                {compiledMdx ? (
                  <RemoteMDX compiled={compiledMdx} basePath={basePath} />
                ) : (
                  <div className="animate-pulse h-32 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
                )}
              </article>
              <ArticleTTSScrollSync
                articleRef={articleRef}
                currentSentenceIndex={currentSentenceIndex}
                sentences={sentences}
                articleContent={content}
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

              {unusedImages.length > 0 && (
                <div className="space-y-8 pt-12 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-purple-500 rounded-full" />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gallery</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {unusedImages.map(img => {
                      let curr: any = filesIndex
                      const baseParts = basePath.split('/').filter(Boolean)
                      for (const p of baseParts) {
                        if (curr) curr = curr[p]
                      }
                      const lqip = curr?.[img]?._lqip

                      return (
                        <div key={img} className="group aspect-square relative transition-transform duration-300 hover:-translate-y-1">
                          <PopImage
                            src={img}
                            basePath={basePath}
                            lqip={lqip}
                            w={400}
                            className="w-full h-full object-cover rounded-xl shadow-sm border border-slate-100 dark:border-slate-900"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        }}
      </ArticleTTSProvider>
    )
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-extrabold mb-8 capitalize tracking-tight text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">
          {path.split('/').pop() || 'Home'}
        </h1>

        {directFiles.length === 0 && subDirs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">No content found for this path</p>
            {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
            <Link href="/" className="text-blue-500 hover:underline">
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            {subDirs.length > 0 && (
              <div className="space-y-6 mb-16">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-8 bg-blue-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">Categories</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subDirs.map(dir => {
                    let current = filesIndex
                    for (const s of slugArray) if (current) current = current[s]
                    const node = current?.[dir]
                    const count = node?._count || 0
                    const title = node?._title

                    return (
                      <Link
                        key={dir}
                        href={`/${path ? `${path}/${dir}` : dir}`}
                        className="group p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {count} files
                          </span>
                        </div>
                        <div className="flex flex-col">
                          {title && (
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                              {title}
                            </span>
                          )}
                          <span className="text-lg font-bold text-slate-900 dark:text-white capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {dir.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {mds.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">Documents</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {mds.map(file => (
                    <Link
                      key={file}
                      href={`/${path ? `${path}/${file}` : file}`}
                      className="group p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          {mdContents[file]?.title && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                              {mdContents[file]?.title}
                            </span>
                          )}
                          <span className="text-lg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {file.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-16 space-y-6">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-8 bg-amber-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">Media</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {images.map(img => {
                    let current = filesIndex
                    for (const s of slugArray) if (current) current = current[s]
                    const node = current?.[img]
                    const title = node?._title

                    return (
                      <div key={img} className="flex flex-col gap-2">
                        <div className="aspect-square relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
                          <PopImage
                            src={img}
                            basePath={path}
                            w={200}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="px-1 min-w-0">
                          {title && (
                            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate">
                              {title}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 truncate">
                            {img}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})
