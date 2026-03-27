'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Markdown from 'markdown-to-jsx'
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useTimeline } from '@/components/TimelineContext'
import { PopImage } from '@/components'
import { TimelineAwareLink } from '@/components/Timeline/TimelineAwareLink'
import { transformImageCaptions } from './markdownTransform'
import { getLqipFromIndex, getDimensionsFromIndex, resolveImagePath } from '@/components/helpers/imageHelper'
import { timelineManifestCacheQuery } from '@/lib/timelineManifestCacheBust'

/* ── Types ──────────────────────────────────────────────────────── */

interface IndexNode {
  _title?: string
  _count?: number
  [key: string]: IndexNode | string | number | undefined
}

interface TreeFile {
  path: string
  name: string
  title: string
}

interface TreeDir {
  name: string
  path: string
  children: TreeItem[]
}

type TreeItem = { kind: 'file'; file: TreeFile } | { kind: 'dir'; dir: TreeDir }

/* ── Helpers ────────────────────────────────────────────────────── */

/** Strip H1 title and YAML frontmatter before rendering. */
function prepareMarkdownContent(md: string): string {
  if (typeof md !== 'string') return ''
  return md
    .replace(/^# .+\n*/m, '')
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
    .trimStart()
}

/** Display name for a file (strip .md, prettify) */
function displayName(filename: string): string {
  return filename.replace(/\.md$/, '')
}

/** Build a tree of dirs and .md files from the index.json structure */
function buildTree(node: IndexNode, parentPath: string): TreeItem[] {
  const items: TreeItem[] = []
  for (const key of Object.keys(node)) {
    if (key.startsWith('_')) continue
    const child = node[key]
    if (typeof child !== 'object' || child == null) continue
    const childNode = child as IndexNode
    const fullPath = parentPath ? `${parentPath}/${key}` : key
    if (key.endsWith('.md')) {
      items.push({
        kind: 'file',
        file: { path: fullPath, name: key, title: childNode._title || displayName(key) },
      })
    } else {
      const children = buildTree(childNode, fullPath)
      if (children.length > 0) {
        items.push({
          kind: 'dir',
          dir: { name: key, path: fullPath, children },
        })
      }
    }
  }
  return items
}

/** Flatten tree to get all file paths for prev/next navigation */
function flattenFiles(items: TreeItem[]): TreeFile[] {
  const result: TreeFile[] = []
  for (const item of items) {
    if (item.kind === 'file') result.push(item.file)
    else result.push(...flattenFiles(item.dir.children))
  }
  return result
}

/** Collect all ancestor dir paths for a file path */
function getAncestorPaths(filePath: string): Set<string> {
  const parts = filePath.split('/')
  const result = new Set<string>()
  for (let i = 1; i < parts.length; i++) {
    result.add(parts.slice(0, i).join('/'))
  }
  return result
}

/* ── Tree Node component ────────────────────────────────────────── */

function TreeFileNode({
  file,
  selected,
  onSelect,
}: {
  file: TreeFile
  selected: boolean
  onSelect: (path: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(file.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm rounded transition-colors truncate ${
        selected
          ? 'bg-cyan-600/20 text-cyan-300 font-medium'
          : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
      }`}
      title={file.path}
    >
      <FileText size={14} className="shrink-0 opacity-60" />
      <span className="truncate">{file.title}</span>
    </button>
  )
}

function TreeDirNode({
  dir,
  selectedPath,
  onSelect,
  expandedDirs,
  onToggleDir,
}: {
  dir: TreeDir
  selectedPath: string | null
  onSelect: (path: string) => void
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
}) {
  const isOpen = expandedDirs.has(dir.path)
  const Icon = isOpen ? FolderOpen : Folder

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleDir(dir.path)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-sm rounded transition-colors text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <Icon size={14} className="shrink-0 opacity-70" />
        <span className="truncate">{dir.name}</span>
      </button>
      {isOpen && (
        <div className="pl-3 border-l border-slate-700/50 ml-2 mt-0.5">
          {dir.children.map((item) =>
            item.kind === 'file' ? (
              <TreeFileNode
                key={item.file.path}
                file={item.file}
                selected={item.file.path === selectedPath}
                onSelect={onSelect}
              />
            ) : (
              <TreeDirNode
                key={item.dir.path}
                dir={item.dir}
                selectedPath={selectedPath}
                onSelect={onSelect}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main BrowserView ───────────────────────────────────────────── */

interface BrowserViewProps {
  /** Pre-selected file path from URL deep link */
  initialPath?: string | null
}

export function BrowserView({ initialPath }: BrowserViewProps) {
  const { baseUrl } = useTimeline()
  const [index, setIndex] = useState<IndexNode | null>(null)
  const [loadingIndex, setLoadingIndex] = useState(true)
  const [indexError, setIndexError] = useState<string | null>(null)

  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const [mdContent, setMdContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Fetch index.json
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => setLoadingIndex(true))
    fetch(`${baseUrl}/index.json${timelineManifestCacheQuery()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch index: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setIndex(data)
          setLoadingIndex(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIndexError(err instanceof Error ? err.message : 'Failed to load index')
          setLoadingIndex(false)
        }
      })
    return () => { cancelled = true }
  }, [baseUrl])

  // Build tree from index
  const tree = useMemo(() => (index ? buildTree(index, '') : []), [index])
  const allFiles = useMemo(() => flattenFiles(tree), [tree])

  // Auto-select first file if none selected and auto-expand ancestors
  useEffect(() => {
    if (!index || allFiles.length === 0) return

    const pathToUse = selectedPath || allFiles[0]?.path
    if (!pathToUse) return

    if (!selectedPath) {
      queueMicrotask(() => setSelectedPath(pathToUse))
    }

    // Auto-expand ancestors of selected file
    const ancestors = Array.from(getAncestorPaths(pathToUse))
    queueMicrotask(() => {
      setExpandedDirs((prev) => {
        const next = new Set(prev)
        let changed = false
        ancestors.forEach((a) => {
          if (!next.has(a)) { next.add(a); changed = true }
        })
        return changed ? next : prev
      })
    })
  }, [index, allFiles, selectedPath])

  // Handle initialPath changes (deep link)
  useEffect(() => {
    if (initialPath && index) {
      queueMicrotask(() => setSelectedPath(initialPath))
      const ancestors = Array.from(getAncestorPaths(initialPath))
      queueMicrotask(() => {
        setExpandedDirs((prev) => {
          const next = new Set(prev)
          ancestors.forEach((a) => next.add(a))
          return next
        })
      })
    }
  }, [initialPath, index])

  // Fetch markdown content when selection changes
  useEffect(() => {
    if (!selectedPath) {
      queueMicrotask(() => setMdContent(null))
      return
    }
    queueMicrotask(() => setLoadingContent(true))
    const url = `${baseUrl}/${selectedPath}`
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.resolve(null)))
      .then((text) => setMdContent(text ?? `*Failed to load: ${selectedPath}*`))
      .catch(() => setMdContent(`*Failed to load: ${selectedPath}*`))
      .finally(() => setLoadingContent(false))
  }, [baseUrl, selectedPath])

  // Scroll content to top on selection change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [selectedPath])

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path)
    // Update URL search params for deep linking
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'browser')
    params.set('path', path)
    const q = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
  }, [])

  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Prev / Next navigation
  const currentIdx = allFiles.findIndex((f) => f.path === selectedPath)
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx >= 0 && currentIdx < allFiles.length - 1

  // Title for the selected file
  const selectedFile = allFiles.find((f) => f.path === selectedPath)
  const selectedTitle = selectedFile?.title || selectedPath || 'Select a file'

  if (loadingIndex) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 py-24">
        Loading file index…
      </div>
    )
  }

  if (indexError) {
    return (
      <div className="py-8 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        {indexError}
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Left: file tree */}
      <div className="w-64 shrink-0 flex flex-col min-h-0 border-r border-slate-700/50 bg-slate-900/60">
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-700/50">
          Files
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1">
          {tree.map((item) =>
            item.kind === 'file' ? (
              <TreeFileNode
                key={item.file.path}
                file={item.file}
                selected={item.file.path === selectedPath}
                onSelect={handleSelect}
              />
            ) : (
              <TreeDirNode
                key={item.dir.path}
                dir={item.dir}
                selectedPath={selectedPath}
                onSelect={handleSelect}
                expandedDirs={expandedDirs}
                onToggleDir={handleToggleDir}
              />
            ),
          )}
        </div>
      </div>

      {/* Right: content viewer */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/30">
        {/* Breadcrumb / path bar */}
        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700 truncate font-mono">
          {selectedPath || '—'}
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4"
        >
          {loadingContent ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : mdContent ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 select-text">
                {selectedTitle}
              </h2>
              <div className="prose dark:prose-invert prose-sm max-w-none select-text">
                <Markdown
                  options={{
                    overrides: {
                      img: (props) => {
                        const contentDir = selectedPath?.includes('/') ? selectedPath.replace(/\/[^/]+$/, '') : ''
                        const base = contentDir ? `${baseUrl.replace(/\/$/, '')}/${contentDir}` : baseUrl
                        const resolved = typeof props.src === 'string' ? resolveImagePath(props.src, base).split('?')[0] : ''
                        const lqip = index && resolved ? getLqipFromIndex(index, resolved) : undefined
                        const dims = index && resolved ? getDimensionsFromIndex(index, resolved) : undefined
                        return (
                          <PopImage
                            {...props}
                            basePath={base}
                            lqip={lqip}
                            intrinsicWidth={dims?.width}
                            intrinsicHeight={dims?.height}
                            className={props.className}
                          />
                        )
                      },
                      PopImage: (props: { children?: React.ReactNode; [key: string]: unknown }) => {
                        const captionText = typeof props.children === 'string' ? props.children : null
                        const contentDir = selectedPath?.includes('/') ? selectedPath.replace(/\/[^/]+$/, '') : ''
                        const base = contentDir ? `${baseUrl.replace(/\/$/, '')}/${contentDir}` : baseUrl
                        const resolved = typeof props.src === 'string' ? resolveImagePath(props.src as string, base).split('?')[0] : ''
                        const lqip = index && resolved ? getLqipFromIndex(index, resolved) : undefined
                        const dims = index && resolved ? getDimensionsFromIndex(index, resolved) : undefined
                        return (
                          <PopImage
                            {...props}
                            basePath={base}
                            lqip={lqip}
                            intrinsicWidth={dims?.width}
                            intrinsicHeight={dims?.height}
                            className={props.className as string}
                          >
                            {captionText ? (
                              <Markdown
                                options={{
                                  overrides: {
                                    a: (props: { href?: string; children?: React.ReactNode; [key: string]: unknown }) => <TimelineAwareLink {...props} />,
                                  },
                                }}
                              >
                                {captionText}
                              </Markdown>
                            ) : null}
                          </PopImage>
                        )
                      },
                      a: (props: { href?: string; children?: React.ReactNode; [key: string]: unknown }) => <TimelineAwareLink {...props} />,
                    },
                  }}
                >
                  {transformImageCaptions(prepareMarkdownContent(mdContent))}
                </Markdown>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-sm">Select a file from the tree.</div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && handleSelect(allFiles[currentIdx - 1].path)}
            className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500">
            {currentIdx >= 0 ? `${currentIdx + 1} / ${allFiles.length}` : ''}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && handleSelect(allFiles[currentIdx + 1].path)}
            className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
