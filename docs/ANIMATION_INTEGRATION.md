# Animation Integration Plan

How to integrate the `paradigm-threat-animation` module (from paradigm-threat-timeline/animation/) into the Next.js site.

## Step 1: Link the animation package

Since both repos are local siblings, use a relative file dependency:

```bash
cd /home/ari/dev/paradigm-threat-site
npm install ../paradigm-threat-timeline/animation
# This adds: "paradigm-threat-animation": "file:../paradigm-threat-timeline/animation"
```

Also install the peer dependencies:

```bash
npm install leaflet three @types/three
npm install -D @types/leaflet
```

## Step 2: Create React wrapper components

### `components/Timeline/AnimationMapView.tsx`

```tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { TimelineEntry } from '@/components/TimelineContext'

interface Props {
  onSelectEvent?: (id: string) => void
  year?: number
}

export function AnimationMapView({ onSelectEvent, year: externalYear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ctrlRef = useRef<any>(null)
  const [year, setYear] = useState(externalYear ?? 1200)
  const [phase, setPhase] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { createMapController } = await import('paradigm-threat-animation')
      const geojsonMod = await import('paradigm-threat-animation/data/empire-boundaries.geojson')
      const geojson = typeof geojsonMod.default === 'string'
        ? JSON.parse(geojsonMod.default)
        : geojsonMod.default

      if (cancelled || !containerRef.current) return
      const ctrl = await createMapController(containerRef.current, geojson)
      if (cancelled) { ctrl.destroy(); return }
      ctrlRef.current = ctrl
      ctrl.setYear(year)
      setPhase(ctrl.getPhaseLabel())
    }

    init()
    return () => { cancelled = true; ctrlRef.current?.destroy() }
  }, [])

  useEffect(() => {
    if (!ctrlRef.current) return
    ctrlRef.current.setYear(year)
    setPhase(ctrlRef.current.getPhaseLabel())
  }, [year])

  useEffect(() => {
    if (externalYear != null) setYear(externalYear)
  }, [externalYear])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-800 text-xs">
        <input
          type="range" min={1050} max={2025} value={year}
          onChange={e => setYear(+e.target.value)}
          className="flex-1"
        />
        <span className="font-mono">{year} CE</span>
        <span className="text-slate-500">{phase}</span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
```

### `components/Timeline/AnimationPlanetView.tsx`

```tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Props {
  year?: number
}

export function AnimationPlanetView({ year: externalYear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctrlRef = useRef<any>(null)
  const [year, setYear] = useState(externalYear ?? -3000)
  const [info, setInfo] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { createPlanetController } = await import('paradigm-threat-animation')
      if (cancelled || !canvasRef.current) return
      const ctrl = await createPlanetController(canvasRef.current)
      if (cancelled) { ctrl.destroy(); return }
      ctrlRef.current = ctrl
      ctrl.setYear(year)
      setInfo(ctrl.getPhaseInfo()?.name || '')
    }

    init()
    return () => { cancelled = true; ctrlRef.current?.destroy() }
  }, [])

  useEffect(() => {
    if (!ctrlRef.current) return
    ctrlRef.current.setYear(year)
    setInfo(ctrlRef.current.getPhaseInfo()?.name || '')
  }, [year])

  useEffect(() => {
    if (externalYear != null) setYear(externalYear)
  }, [externalYear])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-800 text-xs">
        <input
          type="range" min={-5000} max={0} value={year}
          onChange={e => setYear(+e.target.value)}
          className="flex-1"
        />
        <span className="font-mono">{Math.abs(year)} BCE</span>
        <span className="text-slate-500">{info}</span>
      </div>
      <canvas ref={canvasRef} className="flex-1 min-h-0 w-full" />
    </div>
  )
}
```

## Step 3: Add view mode to TimelineView.tsx

In `components/Timeline/TimelineView.tsx`:

1. Extend the type:
```ts
export type TimelineViewMode = 'list' | 'vis' | 'timelinejs' | 'custom' | 'animation'
```

2. Add label:
```ts
const VIEW_LABELS: Record<TimelineViewMode, string> = {
  list: 'List',
  vis: 'vis-timeline',
  timelinejs: 'TimelineJS',
  custom: 'Custom',
  animation: 'Animation',
}
```

3. Add the view in the render switch:
```tsx
{viewMode === 'animation' && (
  <AnimationMapView onSelectEvent={handleSelectEvent} />
)}
```

## Step 4: Next.js config

Add transpile for the local package in `next.config.js`:

```js
const nextConfig = {
  transpilePackages: ['paradigm-threat-animation'],
  // ... existing config
}
```

## Step 5: Leaflet CSS

Import Leaflet CSS in `app/globals.css` or the animation component:

```css
@import 'leaflet/dist/leaflet.css';
```

Or dynamically in the component:
```ts
useEffect(() => {
  import('leaflet/dist/leaflet.css')
}, [])
```

## Notes

- All Three.js / Leaflet imports are dynamic → SSR-safe
- The animation module uses `"type": "module"` (ESM) — Next.js handles this via `transpilePackages`
- The GeoJSON file needs to be importable; may need to configure `next.config.js` webpack for `.geojson` → JSON
- The animation module is versioned independently; no build step needed for the site to consume it
