'use client'

import React from 'react'
import { Play, Square } from 'lucide-react'

interface TTSPlayButtonProps {
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  className?: string
}

export function TTSPlayButton({ isPlaying, onPlay, onStop, className }: TTSPlayButtonProps) {
  return (
    <button
      type="button"
      title={isPlaying ? 'Stop audio' : 'Listen (audio slideshow)'}
      onClick={() => (isPlaying ? onStop() : onPlay())}
      className={
        className ??
        `shrink-0 rounded border px-2.5 py-1.5 text-sm transition-colors ${
          isPlaying
            ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
            : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`
      }
    >
      {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} />}
    </button>
  )
}
