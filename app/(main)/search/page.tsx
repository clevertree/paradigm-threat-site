'use client'

import React, { useEffect, useState, useMemo, Suspense } from 'react'
import { getFilesIndex, getRemoteFile } from '@/server/remoteFiles'
import { SearchHeader, FolderGrid, ArticleStack, ImageGallery } from '@/components/search'
import matter from 'gray-matter'
import { Loader2, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { flattenFilesIndex } from '@/components/helpers/indexHelper'

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
                <SearchHeader
                    query={query}
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
