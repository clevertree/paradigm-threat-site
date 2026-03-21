'use client'

import React, { useEffect, useState, useMemo, Suspense, useRef, useCallback, startTransition } from 'react'
import { getFilesIndex, getRemoteFile } from '@/server/remoteFiles'
import { SearchHeader, FolderGrid, ArticleStack, ImageGallery } from '@/components/search'
import matter from 'gray-matter'
import { Loader2, Search } from 'lucide-react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { flattenFilesIndex } from '@/components/helpers/indexHelper'

const DEBOUNCE_MS = 350

function SearchContent() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const topicFromPath = Array.isArray(params?.topic) ? params.topic[0] : (params?.topic as string)
    const queryFromPath = topicFromPath ? decodeURIComponent(topicFromPath) : ''
    const queryFromSearch = searchParams.get('q') || ''
    const urlQuery = queryFromPath || queryFromSearch

    // Local state for input - avoids router.replace on every keystroke (prevents mobile keyboard dismiss)
    const [inputValue, setInputValue] = useState(urlQuery)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastUrlUpdateRef = useRef<string>(urlQuery)

    const [filesIndex, setFilesIndex] = useState<string[]>([])
    const [renderedMds, setRenderedMds] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [contentLoading, setContentLoading] = useState(false)

    // Sync from URL to input only when URL changed externally (back/forward), not from our debounce
    useEffect(() => {
        // Only sync if URL changed externally (not from our own updateUrl call)
        if (urlQuery !== lastUrlUpdateRef.current && urlQuery !== inputValue.trim()) {
            // Use startTransition to mark this as a non-urgent update (syncing from external URL change)
            startTransition(() => {
                setInputValue(urlQuery)
            })
        }
        // Update ref to track what we expect the URL to be
        lastUrlUpdateRef.current = urlQuery
    }, [urlQuery, inputValue])

    // Fetch index once
    useEffect(() => {
        queueMicrotask(() => setLoading(true))
        getFilesIndex()
            .then(index => {
                if (index) {
                    setFilesIndex(flattenFilesIndex(index))
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
        const cleanQuery = inputValue.trim().toLowerCase()
        if (cleanQuery.length < 2) return []

        const searchTerms = cleanQuery.split(/\s+/).filter(Boolean)
        return filesIndex.filter(path => {
            if (typeof path !== 'string') return false
            if (path.includes('.auto.md')) return false
            const lowerPath = path.toLowerCase()
            return searchTerms.every(term => lowerPath.includes(term))
        })
    }, [inputValue, filesIndex])

    // Fetch MD content for the top results when search results change
    useEffect(() => {
        const mds = searchResults.filter(path =>
            path.endsWith('.md') &&
            !path.endsWith('page.md') &&
            !path.endsWith('index.md') &&
            !path.includes('.auto.md')
        ).slice(0, 5)

        if (mds.length === 0) {
            queueMicrotask(() => setRenderedMds([]))
            return
        }

        queueMicrotask(() => setContentLoading(true))
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

    const updateUrl = useCallback((val: string) => {
        lastUrlUpdateRef.current = val
        if (val && !val.includes(' ')) {
            router.replace(`/search/${encodeURIComponent(val)}`, { scroll: false })
        } else if (val) {
            router.replace(`/search?q=${encodeURIComponent(val)}`, { scroll: false })
        } else {
            router.replace('/search', { scroll: false })
        }
    }, [router])

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputValue(val)
        const trimmed = val.trim()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null
            updateUrl(trimmed)
        }, DEBOUNCE_MS)
    }, [updateUrl])

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }, [])

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
                <SearchHeader
                    query={inputValue}
                    loading={loading}
                    onChange={handleSearchChange}
                />

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

                {inputValue.length > 0 && inputValue.trim().length < 2 && (
                    <div className="text-center py-20 text-slate-400">
                        Please enter at least 2 characters to search...
                    </div>
                )}

                {!loading && inputValue.trim().length >= 2 && searchResults.length === 0 && (
                    <div className="text-center py-24 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 max-w-2xl mx-auto">
                        <Search size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <div className="text-xl font-bold text-slate-900 dark:text-white mb-2">No matching files found</div>
                        <p className="text-slate-500 dark:text-slate-400">Try different terms or browse the directory directly.</p>
                    </div>
                )}

                {searchResults.length > 0 && (
                    <div className="space-y-20">
                        <FolderGrid folders={folders} />

                        <ArticleStack
                            renderedMds={renderedMds}
                            contentLoading={contentLoading}
                            totalArticles={searchResults.filter(f => f.endsWith('.md')).length}
                        />

                        <ImageGallery images={images} />
                    </div>
                )}
            </div>
        </div>
    )
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}>
            <SearchContent />
        </Suspense>
    )
}
