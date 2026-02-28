declare module '*.pdf'

declare module '*.geojson' {
    const value: any
    export default value
}

declare module 'paradigm-threat-animation' {
    export function createMapController(
        container: HTMLElement,
        geojsonData: object | string
    ): Promise<{
        map: any
        setYear(year: number): void
        getPhaseLabel(): string
        destroy(): void
    }>

    export function createPlanetController(
        canvas: HTMLCanvasElement
    ): Promise<{
        setYear(year: number): void
        getPhaseInfo(): { label: string; description: string }
        getOrbitInfo(): Record<string, number>
        destroy(): void
    }>

    export const timelineEvents: Array<{
        year: number
        endYear?: number
        title: string
        type: 'planetary' | 'map' | 'blip'
        phase: string
        lat?: number
        lng?: number
        chapter?: string
    }>

    export const empirePhases: Array<{
        id: string
        label: string
        yearStart: number
        yearEnd: number
        color: string
        opacity: number
    }>

    export const planetaryConfigs: Array<{
        id: string
        yearStart: number
        yearEnd: number
        label: string
        description: string
        skyColor: string
        yearLength?: number
        saturn?: any
        venus?: any
        mars?: any
        earth?: any
        jupiter?: any
    }>

    export function formatYear(year: number): string
    export function getNearbyEvents(
        events: any[],
        year: number,
        mode: 'map' | '3d',
        radius?: number
    ): any[]
    export function lerp(a: number, b: number, t: number): number
    export function clamp(value: number, min: number, max: number): number
}

declare module 'paradigm-threat-animation/data/empire-boundaries.geojson' {
    const value: any
    export default value
}

declare module 'paradigm-threat-animation/style.css' { }

