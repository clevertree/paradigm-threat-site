'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { getFilesIndex } from '@/server/remoteFiles'
import { flattenFilesIndex } from '@/components/helpers/indexHelper'

interface FileSearchFormProps {
    keywords?: string,
}

export default function FileSearchForm({ keywords = "" }: FileSearchFormProps) {
    const [keywordString, setKeywordString] = useState<string>(keywords)
    const [fileIndex, setFileIndex] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchIndex = async () => {
            try {
                setLoading(true)
                const index = await getFilesIndex()
                setFileIndex(flattenFilesIndex(index))
                setError(null)
            } catch (err: any) {
                console.error('Failed to fetch file index:', err)
                setError('Failed to load search index')
            } finally {
                setLoading(false)
            }
        }
        fetchIndex()
    }, [])

    const searchResults = useMemo(() => {
        if (!keywordString || keywordString.length < 2) return []

        const searchTerms = keywordString.toLowerCase().split(/\s+/).filter(Boolean)
        return fileIndex.filter(path => {
            const lowerPath = path.toLowerCase()
            return searchTerms.every(term => lowerPath.includes(term))
        })
    }, [keywordString, fileIndex])

    const isImage = (path: string) => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(path)

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={24} />
                <input
                    type="text"
                    placeholder="Search files and articles..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-lg"
                    value={keywordString}
                    onChange={(e) => setKeywordString(e.target.value)}
                />
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-center">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                {keywordString.length >= 2 ? (
                    <>
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Search Results</h2>
                            <span className="text-sm text-slate-400">{searchResults.length} found</span>
                        </div>

                        {searchResults.length > 0 ? (
                            <div className="grid gap-2">
                                {searchResults.slice(0, 100).map((path, i) => (
                                    <Link
                                        key={path}
                                        href={`/${path}`}
                                        className="flex items-center gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group"
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-colors">
                                            {isImage(path) ? <ImageIcon size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {path.split('/').pop()?.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {path}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                                {searchResults.length > 100 && (
                                    <div className="text-center py-4 text-slate-500 text-sm italic">
                                        Showing first 100 results...
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <div className="text-slate-400 dark:text-slate-600 mb-2">No matching files found</div>
                                <div className="text-xs text-slate-500">Try different keywords or check your spelling</div>
                            </div>
                        )}
                    </>
                ) : keywordString.length > 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        Type at least 2 characters to search...
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                        <Search size={48} className="opacity-20" />
                        <p>Enter keywords to start exploring the repository</p>
                    </div>
                )}
            </div>

            {loading && (
                <div className="fixed inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={48} />
                        <span className="font-semibold">Indexing files...</span>
                    </div>
                </div>
            )}
        </div>
    )
}

function processKeywordList(keywordString: string) {
    return (keywordString || '').split(/[;, /]+/g)
        .map(s => s.replace(/[^a-zA-Z]+/g, ''))
        .filter(i => !!i)
}

