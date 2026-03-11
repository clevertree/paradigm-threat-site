'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useFiles } from '@/components/FilesContext'
import PopImage from '@/components/Image/PopImage'

export type AutoIndexSort = 'name-asc' | 'name-desc'

export interface AutoIndexProps {
  /** Directory path in the files index (e.g. "blog"). Defaults to currentPath. */
  path?: string
  /** Current path from the parent page (e.g. basePath). Used when path is omitted. */
  currentPath?: string
  /** Sort files by name. "name-desc" = newest first (e.g. for blog). Default: name-asc */
  sort?: AutoIndexSort
  /** Show subdirectories. Default: true */
  showSubdirs?: boolean
  /** Show .md documents. Default: true */
  showDocs?: boolean
  /** Show images. Default: true */
  showImages?: boolean
}

/**
 * Renders directory contents from index.json (same as CatchAllClient when no page.md),
 * embeddable inside a page.md. Use for blog listings, custom indexes, etc.
 */
export default function AutoIndex({
  path: pathProp,
  currentPath = '',
  sort = 'name-desc',
  showSubdirs = true,
  showDocs = true,
  showImages = true,
}: AutoIndexProps) {
  const { fileList, loading, error } = useFiles()
  const [mdContents, setMdContents] = useState<Record<string, { title: string }>>({})

  const path = pathProp ?? currentPath

  // Resolve directory node from index
  const { dirs, mdFiles, imgFiles, node } = React.useMemo(() => {
    if (!fileList || !path) {
      return { dirs: [] as string[], mdFiles: [] as string[], imgFiles: [] as string[], node: null }
    }
    let current: any = fileList
    for (const segment of path.split('/').filter(Boolean)) {
      if (!current?.[segment]) {
        return { dirs: [] as string[], mdFiles: [] as string[], imgFiles: [] as string[], node: null }
      }
      current = current[segment]
    }
    if (!current || typeof current !== 'object') {
      return { dirs: [] as string[], mdFiles: [] as string[], imgFiles: [] as string[], node: null }
    }

    const dirs: string[] = []
    const files: string[] = []

    Object.keys(current).forEach((key) => {
      if (key === '_count' || key.startsWith('_')) return
      const val = current[key]
      const isFile = val !== null && typeof val === 'object' && !('_count' in val)
      if (isFile) {
        files.push(key)
      } else {
        dirs.push(key)
      }
    })

    const mdFiles = files.filter(
      (f) => f.endsWith('.md') && f !== 'page.md' && !f.endsWith('.auto.md')
    )
    const imgFiles = files.filter((f) => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f))

    const sorted = [...mdFiles].sort((a, b) => {
      const cmp = a.localeCompare(b)
      return sort === 'name-desc' ? -cmp : cmp
    })

    return { dirs: dirs.sort(), mdFiles: sorted, imgFiles, node: current }
  }, [fileList, path, sort])

  // Fetch titles for .md files (index may have _title, but fetch for reliability)
  const mdFilesKey = mdFiles.join(',')
  const fileVersion = typeof fileList?._version === 'string' ? fileList._version : ''
  useEffect(() => {
    if (!path || mdFiles.length === 0) return
    const baseUrl =
      process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files'
    const vParam = fileVersion ? `?v=${fileVersion}` : ''

    const initial: Record<string, { title: string }> = {}
    mdFiles.forEach((f) => {
      const fileData = node?.[f]
      const fromIndex = fileData?._title
      initial[f] = { title: fromIndex || f.replace(/_/g, ' ').replace(/\.md$/, '') }
    })
    setMdContents(initial)

    const fetchAll = async () => {
      const matter = (await import('gray-matter')).default
      const results: Record<string, { title: string }> = { ...initial }
      await Promise.all(
        mdFiles.map(async (f) => {
          const fullPath = path ? `${path}/${f}` : f
          try {
            const res = await fetch(`${baseUrl}/${fullPath}${vParam}`)
            if (res.ok) {
              const text = await res.text()
              const { data: fm } = matter(text)
              const t = fm?.title as string | undefined
              if (t) results[f] = { title: t }
            }
          } catch {
            /* ignore */
          }
        })
      )
      setMdContents(results)
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mdFilesKey captures mdFiles identity
  }, [path, mdFilesKey, node, fileVersion])

  if (loading) {
    return (
      <div className="animate-pulse h-32 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl my-8" />
    )
  }

  if (error || (!dirs.length && !mdFiles.length && !imgFiles.length)) {
    return (
      <div className="py-8 text-slate-500 dark:text-slate-400">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p>No content in this directory.</p>
        )}
      </div>
    )
  }

  const hrefBase = path ? `/${path}` : ''

  return (
    <div className="space-y-10 my-10">
      {showSubdirs && dirs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-blue-500 rounded-full" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Categories
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dirs.map((dir) => {
              const subNode = node?.[dir]
              const count = subNode?._count ?? 0
              const title = subNode?._title
              return (
                <Link
                  key={dir}
                  href={`${hrefBase}/${dir}`}
                  className="group p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
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

      {showDocs && mdFiles.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-emerald-500 rounded-full" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Documents
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {mdFiles.map((file) => {
              const fileName = file.replace(/_/g, ' ').replace(/\.md$/, '')
              const title = mdContents[file]?.title || fileName
              return (
              <Link
                key={file}
                href={`${hrefBase}/${file}`}
                className="group p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col font-bold text-slate-900 dark:text-white">
                    <span className="doc-filename text-[11px] font-normal text-slate-500 dark:text-slate-400 mb-1">
                      {file}
                    </span>
                    <span className="doc-title text-xl group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {title}
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            )})}
          </div>
        </div>
      )}

      {showImages && imgFiles.length > 0 && (
        <div className="space-y-6 mt-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-amber-500 rounded-full" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Media
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {imgFiles.map((img) => {
              const imgNode = node?.[img]
              const title = imgNode?._title
              const lqip = imgNode?._lqip
              return (
                <div key={img} className="flex flex-col gap-2">
                  <div className="aspect-square relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
                    <PopImage
                      src={img}
                      basePath={path}
                      lqip={lqip}
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
                    <div className="text-[10px] text-slate-500 truncate">{img}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
