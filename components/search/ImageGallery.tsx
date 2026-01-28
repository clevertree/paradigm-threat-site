'use client'

import React from 'react'
import * as components from '@/components'

const { PopImage } = components;

interface ImageGalleryProps {
    images: string[]
}

export function ImageGallery({ images }: ImageGalleryProps) {
    if (images.length === 0) return null

    return (
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
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="text-[10px] text-white truncate w-full font-mono">
                                    {img.split('/').pop()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {images.length > 48 && (
                <div className="text-center py-8">
                    <p className="text-slate-500 italic">Showing first 48 images...</p>
                </div>
            )}
        </div>
    )
}
