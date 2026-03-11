'use client'

import React, { useState } from 'react'
import { Play, Pause, Square, ChevronUp, Settings2, X } from 'lucide-react'
import type { TTSState, SubtitleMode, PiperVoice, TTSProvider } from '@/lib/hooks/useTTS'

const RATES = [0.75, 1.0, 1.25, 1.5, 2.0]

export interface ArticleTTSOverlayProps {
  ttsState: TTSState
  availableVoices: SpeechSynthesisVoice[]
  availablePiperVoices: PiperVoice[]
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onClearError: () => void
  onSetVoice: (v: SpeechSynthesisVoice | null) => void
  onSetRate: (r: number) => void
  onSetProvider: (p: TTSProvider) => void
  onSetPiperVoiceId: (id: string) => void
  onSetPiperLang: (lang: string) => void
  onSetQuoteVoiceId: (id: string) => void
  onSetSpeakerMapInput: (input: string) => void
  onSetLangFilter: (l: string) => void
  onSetLocalOnly: (b: boolean) => void
  onSetSubtitleMode: (m: SubtitleMode) => void
  onSwitchToSpeechAndResume?: () => void
  onScrollToTop: () => void
  isScrolled: boolean
}

export function ArticleTTSOverlay({
  ttsState,
  availableVoices,
  availablePiperVoices,
  onPlay,
  onPause,
  onStop,
  onClearError,
  onSetVoice,
  onSetRate,
  onSetProvider,
  onSetPiperVoiceId,
  onSetPiperLang,
  onSetQuoteVoiceId,
  onSetSpeakerMapInput,
  onSetLangFilter,
  onSetLocalOnly,
  onSetSubtitleMode,
  onSwitchToSpeechAndResume,
  onScrollToTop,
  isScrolled,
}: ArticleTTSOverlayProps) {
  const [expanded, setExpanded] = useState(false)

  const filteredVoices = availableVoices
    .filter(v => ttsState.langFilter === 'all' || v.lang.startsWith(ttsState.langFilter))
    .filter(v => !ttsState.localOnly || v.localService)

  const filteredPiperVoices = availablePiperVoices

  return (
    <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-8 md:bottom-8 md:max-w-md z-50">
      {/* Error banner */}
      {ttsState.error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-950/90 border border-red-500/50 text-red-100 px-4 py-3 flex items-center justify-between gap-4 shadow-xl">
          <span className="text-sm flex-1 min-w-0 truncate">{ttsState.error}</span>
          <div className="flex items-center gap-2 shrink-0">
            {ttsState.provider === 'piper' && ttsState.piperFallbackOffer && onSwitchToSpeechAndResume && (
              <button
                onClick={onSwitchToSpeechAndResume}
                className="text-xs uppercase font-bold bg-indigo-600/80 hover:bg-indigo-500/90 px-2 py-1 rounded"
              >
                Speech API &amp; Resume
              </button>
            )}
            {ttsState.provider === 'piper' && !ttsState.piperFallbackOffer && (
              <button
                onClick={() => onSetProvider('webSpeech')}
                className="text-xs uppercase font-bold text-red-300 hover:text-red-100"
              >
                Use Speech API
              </button>
            )}
            <button onClick={onClearError} className="text-red-300/60 hover:text-red-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main overlay panel */}
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/50 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Transport + Back to top row */}
        <div className="flex items-center gap-2 p-3">
          {ttsState.sentences.length > 0 ? (
            <>
              <button
                onClick={ttsState.isPlaying ? onPause : () => { onScrollToTop(); onPlay(); }}
                className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                aria-label={ttsState.isPlaying ? 'Pause' : 'Play'}
              >
                {ttsState.isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>
              <button
                onClick={onStop}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Stop"
              >
                <Square size={18} fill="currentColor" />
              </button>
            </>
          ) : (
            <button
              onClick={() => { onScrollToTop(); onPlay(); }}
              className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
              aria-label="Play article"
            >
              <Play size={24} fill="currentColor" className="ml-1" />
            </button>
          )}
          {isScrolled && (
            <button
              onClick={onScrollToTop}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="Back to top"
            >
              <ChevronUp size={20} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`ml-auto w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expanded ? 'bg-indigo-600/30 text-indigo-400' : 'bg-white/5 hover:bg-white/10 text-slate-400'}`}
            aria-label="TTS settings"
            aria-expanded={expanded}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {/* Settings strip (expandable) */}
        {expanded && (
          <div className="border-t border-slate-700/50 dark:border-slate-800 px-4 py-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Provider</span>
              <select
                value={ttsState.provider}
                onChange={e => onSetProvider(e.target.value as TTSProvider)}
                className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer"
              >
                <option value="piper" className="bg-slate-900">Piper</option>
                <option value="webSpeech" className="bg-slate-900">Speech API</option>
              </select>
            </div>

            {ttsState.provider === 'piper' ? (
              <>
                <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Voice</span>
                  <select
                    value={ttsState.piperVoiceId}
                    onChange={e => onSetPiperVoiceId(e.target.value)}
                    className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {filteredPiperVoices.map(v => (
                      <option key={v.id} value={v.id} className="bg-slate-900">{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Quote</span>
                  <select
                    value={ttsState.quoteVoiceId}
                    onChange={e => onSetQuoteVoiceId(e.target.value)}
                    className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer max-w-[120px] truncate"
                  >
                    <option value="" className="bg-slate-900">Narrator</option>
                    {filteredPiperVoices.map(v => (
                      <option key={v.id} value={v.id} className="bg-slate-900">{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 w-full min-w-0">
                  <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Speakers</span>
                  <input
                    value={ttsState.speakerMapInput}
                    onChange={e => onSetSpeakerMapInput(e.target.value)}
                    placeholder="alice=en_US, bob=en_US"
                    className="bg-transparent text-slate-100 text-xs outline-none placeholder:text-slate-500 flex-1 min-w-0"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Lang</span>
                  <select
                    value={ttsState.langFilter}
                    onChange={e => onSetLangFilter(e.target.value)}
                    className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer"
                  >
                    {['en', 'de', 'fr', 'es', 'ja', 'zh', 'all'].map(l => (
                      <option key={l} value={l} className="bg-slate-900">{l}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => onSetLocalOnly(!ttsState.localOnly)}
                  className={`rounded-lg px-3 py-2 text-[10px] uppercase font-bold transition-colors ${ttsState.localOnly ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'bg-black/30 text-slate-400 border border-transparent hover:text-slate-300'}`}
                >
                  Local only
                </button>
                <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Voice</span>
                  <select
                    value={ttsState.voice?.name ?? ''}
                    onChange={e => {
                      const v = availableVoices.find(v => v.name === e.target.value)
                      if (v) onSetVoice(v)
                    }}
                    className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {filteredVoices.map(v => (
                      <option key={v.name} value={v.name} className="bg-slate-900">
                        {v.name.replace('Google ', '')} {v.localService ? '🏠' : '🌐'}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <button
              onClick={() => onSetSubtitleMode(ttsState.subtitleMode === 'caption' ? 'scroll' : 'caption')}
              className={`rounded-lg px-3 py-2 text-[10px] uppercase font-bold transition-colors ${ttsState.subtitleMode === 'scroll' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'bg-black/30 text-slate-400 border border-transparent hover:text-slate-300'}`}
            >
              {ttsState.subtitleMode === 'caption' ? 'Caption' : 'Transcript'}
            </button>

            <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Speed</span>
              <select
                value={ttsState.rate}
                onChange={e => onSetRate(parseFloat(e.target.value))}
                className="bg-transparent text-slate-100 text-xs outline-none cursor-pointer"
              >
                {RATES.map(r => (
                  <option key={r} value={r} className="bg-slate-900">{r}x</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
