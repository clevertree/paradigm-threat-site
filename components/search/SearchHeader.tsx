'use client'

import React from 'react'
import { Search, Loader2 } from 'lucide-react'

interface SearchHeaderProps {
    query: string
    loading: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function SearchHeader({ query, loading, onChange }: SearchHeaderProps) {
    return (
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
                    onChange={onChange}
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
    )
}
