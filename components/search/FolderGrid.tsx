'use client'

import React from 'react'
import Link from 'next/link'
import { Folder } from 'lucide-react'

interface FolderGridProps {
    folders: string[]
}

export function FolderGrid({ folders }: FolderGridProps) {
    if (folders.length === 0) return null

    return (
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
    )
}
