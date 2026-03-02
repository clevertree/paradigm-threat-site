/**
 * Shared utility functions for the animation system.
 * Framework-agnostic — no DOM or library dependencies.
 */

/** Format a year number as "YYYY BCE" or "YYYY CE" */
export function formatYear(year) {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
}

/**
 * Given a year, return nearby events (within `radius` years).
 * @param {Array} events - timelineEvents array
 * @param {number} year - current year
 * @param {string} mode - 'map' | '3d'
 * @param {number} [radius=25]
 */
export function getNearbyEvents(events, year, mode, radius = 25) {
    return events
        .filter(e => {
            if (mode === 'map') return e.type === 'map';
            return e.type === 'planetary' || e.type === 'blip';
        })
        .filter(e => Math.abs(e.year - year) <= radius)
        .sort((a, b) => a.year - b.year);
}

/**
 * Linear interpolation.
 */
export function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

/**
 * Clamp value between min and max.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
