'use client'

import React, { useEffect, useState, useMemo, Suspense } from 'react'
import { getFilesIndex, getRemoteFile } from '@/server/remoteFiles'
import * as components from '@/components'
import Link from 'next/link'
import matter from 'gray-matter'
import { Search, FileText, Folder, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Markdown from 'markdown-to-jsx'

const { PopImage } = components;

function SearchContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const query = searchParams.get('q') || ''

    const [filesIndex, setFilesIndex] = useState<string[]>([])
    const [renderedMds, setRenderedMds] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [contentLoading, setContentLoading] = useState(false)

    // Fetch index once
    useEffect(() => {
        setLoading(true)
        getFilesIndex()
            .then(index => {
                if (index && Array.isArray(index)) {
                    setFilesIndex(index)
                } else {
                    setError('Received invalid file index')
                }
            })
            .catch(err => {
                console.error('Search index fetch error:', err)
                setError('Failed to load search index')
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    // Trigger DynamicIndex update when content changes
    useEffect(() => {
        if (!loading && !contentLoading) {
            setTimeout(() => {
                window.dispatchEvent(new Event('dynamic-index-update'));
            }, 500);
        }
    }, [loading, contentLoading, renderedMds]);

    const searchResults = useMemo(() => {
        if (!filesIndex || !Array.isArray(filesIndex)) return []
        const cleanQuery = query.trim().toLowerCase()
        if (cleanQuery.length < 2) return []

        const searchTerms = cleanQuery.split(/\s+/).filter(Boolean)
        return filesIndex.filter(path => {
            if (typeof path !== 'string') return false
            if (path.includes('.auto.md')) return false
            const lowerPath = path.toLowerCase()
            return searchTerms.every(term => lowerPath.includes(term))
        })
    }, [query, filesIndex])

    // Fetch MD content for the top results when search results change
    useEffect(() => {
        const mds = searchResults.filter(path =>
            path.endsWith('.md') &&
            !path.endsWith('page.md') &&
            !path.endsWith('index.md') &&
            !path.includes('.auto.md')
        ).slice(0, 5)

        if (mds.length === 0) {
            setRenderedMds([])
            return
        }

        setContentLoading(true)
        Promise.all(mds.map(async path => {
            const content = await getRemoteFile(path)
            if (!content) return null
            const { content: mdxSource, data: frontMatter } = matter(content)
            const basePath = path.includes('/') ? path.split('/').slice(0, -1).join('/') : ''
            return { path, mdxSource, frontMatter, basePath }
        })).then(results => {
            setRenderedMds(results.filter(Boolean))
            setContentLoading(false)
        })
    }, [searchResults])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        const params = new URLSearchParams(window.location.search)
        if (val) {
            params.set('q', val)
        } else {
            params.delete('q')
        }
        router.replace(`/search?${params.toString()}`, { scroll: false })
    }

    // Extract unique folders
    const folderPaths = Array.from(new Set(searchResults.map(path => {
        const parts = path.split('/')
        return parts.length > 1 ? parts.slice(0, -1).join('/') : null
    }).filter(Boolean))) as string[]

    const folders = folderPaths.sort()
    const images = searchResults.filter(path => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(path))

    return (
        <div className="w-full min-h-screen bg-white dark:bg-slate-950">
            <div className="max-w-[90rem] mx-auto px-4 py-12 space-y-16">
                {/* Search Header */}
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Search Repository
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Explore articles, documents, and media across the paradigm
                        </p>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={28} />
                        <input
                            type="text"
                            value={query}
                            onChange={handleSearchChange}
                            placeholder="Type keywords (e.g. '911 physics', 'mars water')..."
                            className="w-full pl-16 pr-6 py-6 bg-slate-100 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-3xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold text-xl shadow-lg"
                        />
                        {loading && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                <Loader2 className="animate-spin text-blue-500" size={24} />
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="max-w-2xl mx-auto p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-3xl text-center">
                        <div className="font-bold text-lg mb-2">Error</div>
                        <p>{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-6 py-2 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {query.length > 0 && query.length < 2 && (
                    <div className="text-center py-20 text-slate-400">
                        Please enter at least 2 characters to search...
                    </div>
                )}

                {!loading && query.length >= 2 && searchResults.length === 0 && (
                    <div className="text-center py-24 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 max-w-2xl mx-auto">
                        <Search size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <div className="text-xl font-bold text-slate-900 dark:text-white mb-2">No matching files found</div>
                        <p className="text-slate-500 dark:text-slate-400">Try different terms or browse the directory directly.</p>
                    </div>
                )}

                {searchResults.length > 0 && (
                    <div className="space-y-20">
                        {/* Folders Stack */}
                        {folders.length > 0 && (
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-2 h-8 bg-blue-500 rounded-full" />
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Directories</h2>
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-bold text-slate-500">
                                        {folders.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {folders.map(folder => (
                                        <Link
                                            key={folder}
                                            href={`/${folder}`}
                                            className="group relative p-5 bg-slate-50 dark:bg-slate-900/50 hover:bg-blue-600 dark:hover:bg-blue-600 rounded-2xl transition-all duration-300 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-blue-500/20"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold text-slate-400 group-hover:text-blue-200 uppercase tracking-widest mb-1">Folder</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-white truncate text-lg">
                                                        {folder.split('/').pop()?.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 group-hover:text-white/60 truncate mt-1">
                                                        {folder}
                                                    </span>
                                                </div>
                                                <Folder className="text-slate-300 dark:text-slate-700 group-hover:text-white/40 transition-colors" size={32} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Articles Stack */}
                        {(renderedMds.length > 0 || contentLoading) && (
                            <div className="space-y-12">
                                <div className="flex items-center gap-4">
                                    <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Articles</h2>
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-bold text-slate-500">
                                        {searchResults.filter(f => f.endsWith('.md')).length}
                                    </span>
                                    {contentLoading && <Loader2 className="animate-spin text-emerald-500" size={24} />}
                                </div>
                                <div className="space-y-24">
                                    {renderedMds.map(({ path, mdxSource, frontMatter, basePath }) => (
                                        <section key={path} className="relative group">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-2xl text-emerald-500">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <Link href={`/${path}`} className="group-hover:text-blue-500 transition-colors">
                                                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                            {frontMatter.title || path.split('/').pop()?.replace('.md', '').replace(/_/g, ' ')}
                                                        </h3>
                                                    </Link>
                                                    <div className="text-sm text-slate-400 font-mono mt-1">{path}</div>
                                                </div>
                                            </div>
                                            <article className="prose prose-slate dark:prose-invert max-w-none bg-white dark:bg-slate-900/30 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl mdx-content max-h-[80vh] overflow-y-auto custom-scrollbar">
                                                <Markdown
                                                    options={{
                                                        overrides: {
                                                            ...components,
                                                            img: {
                                                                component: PopImage,
                                                                props: { basePath }
                                                            },
                                                            PopImage: {
                                                                component: PopImage,
                                                                props: { basePath }
                                                            },
                                                            OptimizedImage: {
                                                                component: components.OptimizedImage,
                                                                props: { basePath }
                                                            },
                                                            DynamicIndex: {
                                                                component: components.DynamicIndex,
                                                                props: { mode: 'inline', currentPath: basePath }
                                                            },
                                                            AutoContent: {
                                                                component: components.DynamicIndex,
                                                                props: { mode: 'inline', currentPath: basePath }
                                                            },
                                                            autocontent: {
                                                                component: components.DynamicIndex,
                                                                props: { mode: 'inline', currentPath: basePath }
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {mdxSource}
                                                </Markdown>
                                            </article>
                                        </section>
                                    ))}
                                </div>
                                {searchResults.filter(f => f.endsWith('.md')).length > renderedMds.length && !contentLoading && (
                                    <div className="text-center py-8">
                                        <p className="text-slate-500 italic">... and {searchResults.filter(f => f.endsWith('.md')).length - renderedMds.length} more articles. Be more specific for more results.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Gallery Stack */}
                        {images.length > 0 && (
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-2 h-8 bg-purple-500 rounded-full" />
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Gallery</h2>
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-bold text-slate-500">
                                        {images.length}
                                    </span>
                                </div>
                                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-4 space-y-4">
                                    {images.slice(0, 48).map(img => (
                                        <div key={img} className="break-inside-avoid">
                                            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 bg-slate-50 dark:bg-slate-900/50">
                                                <PopImage
                                                    src={img.split('/').pop()!}
                                                    basePath={img.split('/').slice(0, -1).join('/')}
                                                    w={600}
                                                    className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02] clear-none m-0 shadow-none ring-0 rounded-none"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <span className="text-[10px] text-white truncate w-full font-mono">{img.split('/').pop()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}>
            <SearchContent />
        </Suspense>
    )
}
