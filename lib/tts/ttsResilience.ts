/**
 * TTS Resilience Utilities
 *
 * Shared helpers for robust TTS playback — retry with backoff, Chrome keepalive,
 * audio watchdog, and visibility/background handling. Used by useTTS.ts.
 *
 * Designed to be reusable across projects (paradigm-threat-site, forgotten-future-site).
 */

// ─── Retry with exponential backoff ───────────────────────────────────────────

export interface RetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxAttempts?: number
    /** Initial delay in ms before first retry (default: 1000) */
    initialDelayMs?: number
    /** Maximum delay in ms (default: 8000) */
    maxDelayMs?: number
    /** Multiplier for each successive delay (default: 2) */
    backoffFactor?: number
    /** Called before each retry with (attempt, delayMs). Return false to abort. */
    onRetry?: (attempt: number, delayMs: number) => boolean | void
    /** Abort signal — if aborted, retries stop immediately */
    signal?: AbortSignal
}

/**
 * Execute an async function with exponential backoff retries.
 * Throws the last error if all attempts fail.
 */
export async function retryWithBackoff<T>(
    fn: (attempt: number) => Promise<T>,
    opts: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelayMs = 1000,
        maxDelayMs = 8000,
        backoffFactor = 2,
        onRetry,
        signal,
    } = opts

    let lastErr: Error = new Error('Unknown error')
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

        if (attempt > 0) {
            const delayMs = Math.min(initialDelayMs * backoffFactor ** (attempt - 1), maxDelayMs)
            if (onRetry) {
                const cont = onRetry(attempt, delayMs)
                if (cont === false) throw lastErr
            }
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, delayMs)
                if (signal) {
                    const onAbort = () => {
                        clearTimeout(timer)
                        reject(new DOMException('Aborted', 'AbortError'))
                    }
                    signal.addEventListener('abort', onAbort, { once: true })
                }
            })
        }

        try {
            return await fn(attempt)
        } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err))
            if (err instanceof DOMException && err.name === 'AbortError') throw err
        }
    }
    throw lastErr
}

// ─── Chrome Speech Synthesis keepalive ────────────────────────────────────────

/**
 * Chrome (and some Chromium-based browsers) silently cancel SpeechSynthesis
 * utterances after ~15 seconds of continuous speech. The standard workaround
 * is to periodically call pause() then resume() on the synthesis engine.
 *
 * Call `startSpeechKeepalive(synth)` when speech begins and `stopSpeechKeepalive()`
 * when it ends. The returned handle must be passed to stop.
 */
export interface KeepaliveHandle {
    intervalId: ReturnType<typeof setInterval>
}

const KEEPALIVE_INTERVAL_MS = 10_000 // 10s — well under Chrome's ~15s cutoff

export function startSpeechKeepalive(synth: SpeechSynthesis): KeepaliveHandle {
    const intervalId = setInterval(() => {
        if (synth.speaking && !synth.paused) {
            synth.pause()
            synth.resume()
        }
    }, KEEPALIVE_INTERVAL_MS)
    return { intervalId }
}

export function stopSpeechKeepalive(handle: KeepaliveHandle | null): null {
    if (handle) clearInterval(handle.intervalId)
    return null
}

// ─── Audio element watchdog ───────────────────────────────────────────────────

/**
 * Creates a watchdog timer that fires if an HTMLAudioElement doesn't complete
 * playback (via `ended` or `error`) within an expected timeframe.
 *
 * The watchdog estimates expected duration as:
 *   max(audio.duration * 1.5 + buffer, minimumMs)
 *
 * If `audio.duration` is not yet available (NaN/0), falls back to `fallbackMs`.
 */
export interface WatchdogHandle {
    timerId: ReturnType<typeof setTimeout>
    stalledTimerId: ReturnType<typeof setTimeout> | null
}

export interface WatchdogOptions {
    /** Extra buffer on top of estimated duration (default: 5000ms) */
    bufferMs?: number
    /** Minimum watchdog timeout (default: 10000ms) */
    minimumMs?: number
    /** Fallback if audio.duration is unknown (default: 30000ms) */
    fallbackMs?: number
    /** Playback rate — used to adjust expected duration (default: 1) */
    rate?: number
    /** Called when watchdog fires (audio stalled without ending) */
    onStall: () => void
}

export function startAudioWatchdog(
    audio: HTMLAudioElement,
    opts: WatchdogOptions
): WatchdogHandle {
    const {
        bufferMs = 5000,
        minimumMs = 10000,
        fallbackMs = 30000,
        rate = 1,
        onStall,
    } = opts

    const computeTimeout = (): number => {
        const dur = audio.duration
        if (!dur || !isFinite(dur) || dur <= 0) return fallbackMs
        return Math.max((dur / Math.max(rate, 0.1)) * 1500 + bufferMs, minimumMs)
    }

    // If duration is already known, set watchdog immediately.
    // Otherwise wait for loadedmetadata then set it.
    let timerId: ReturnType<typeof setTimeout>
    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        timerId = setTimeout(() => {
            console.warn('[TTS watchdog] Audio stalled — did not end within expected timeframe')
            onStall()
        }, computeTimeout())
    } else {
        // Use fallback initially, then refine when metadata loads
        timerId = setTimeout(() => {
            console.warn('[TTS watchdog] Audio stalled (no duration available) — treating as stall')
            onStall()
        }, fallbackMs)

        const onMeta = () => {
            clearTimeout(timerId)
            timerId = setTimeout(() => {
                console.warn('[TTS watchdog] Audio stalled — did not end within expected timeframe')
                onStall()
            }, computeTimeout())
        }
        audio.addEventListener('loadedmetadata', onMeta, { once: true })
    }

    // Also listen for the `stalled` network event — the browser reports the
    // media download has stalled. Give it a few seconds to recover, then fire.
    let stalledTimerId: ReturnType<typeof setTimeout> | null = null
    const onStalled = () => {
        // Don't double-fire if the main watchdog already triggered
        stalledTimerId = setTimeout(() => {
            // Check if still stuck (currentTime hasn't changed)
            const t1 = audio.currentTime
            setTimeout(() => {
                if (audio.currentTime === t1 && !audio.paused && !audio.ended) {
                    console.warn('[TTS watchdog] Audio network stalled and not progressing')
                    onStall()
                }
            }, 3000)
        }, 2000)
    }
    audio.addEventListener('stalled', onStalled, { once: true })

    return { timerId, stalledTimerId }
}

export function clearAudioWatchdog(handle: WatchdogHandle | null): null {
    if (handle) {
        clearTimeout(handle.timerId)
        if (handle.stalledTimerId) clearTimeout(handle.stalledTimerId)
    }
    return null
}

// ─── Web Speech utterance watchdog ────────────────────────────────────────────

/**
 * Estimates the speaking duration of text and sets a watchdog.
 * If `onend`/`onerror` don't fire within the expected window, calls `onStall`.
 *
 * Estimate: ~150 words per minute at rate=1 → (words / 150) * 60s / rate + buffer
 */
export interface UtteranceWatchdogHandle {
    timerId: ReturnType<typeof setTimeout>
}

export function startUtteranceWatchdog(
    text: string,
    rate: number,
    onStall: () => void,
    bufferMs: number = 15000
): UtteranceWatchdogHandle {
    const words = text.split(/\s+/).filter(Boolean).length
    const estimatedMs = (words / 130) * 60_000 / Math.max(rate, 0.1)
    // Generous margin: underestimating fires cancel+retry and replays the sentence (often the long last one).
    const timeoutMs = Math.max(estimatedMs * 2.25 + bufferMs, 22_000)

    const timerId = setTimeout(() => {
        console.warn(`[TTS watchdog] Utterance did not complete within ${Math.round(timeoutMs / 1000)}s — treating as stall`)
        onStall()
    }, timeoutMs)

    return { timerId }
}

export function clearUtteranceWatchdog(handle: UtteranceWatchdogHandle | null): null {
    if (handle) clearTimeout(handle.timerId)
    return null
}

// ─── Visibility / background helpers ──────────────────────────────────────────

export interface VisibilityState {
    wasPlayingBeforeHide: boolean
    lastSentenceIndex: number
}

/**
 * Determines whether a `pagehide` event is a bfcache navigation (tab switch on
 * mobile) vs a true page unload.
 *
 * - `persisted = true`:  Page going into bfcache (mobile tab switch) → should pause, not stop
 * - `persisted = false`: True navigation away → should stop
 */
export function isPageHidePersisted(event: PageTransitionEvent): boolean {
    return event.persisted
}
