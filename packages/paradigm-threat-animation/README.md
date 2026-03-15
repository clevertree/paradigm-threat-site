# Paradigm Threat — Animation Module

Interactive animated visualizations of the Paradigm Threat Timeline:

- **Map view (CE)** — Leaflet map showing Rus-Horde empire expansion/fragmentation from the 11th to 21st century, with empire phase overlays and event markers
- **Planetary view (BC)** — Three.js 3D scene showing the Saturnian collinear configuration and its breakup through the Golden Age, Dark Ages (Saturn hidden; 5-planet circle, Moon 1×/month), and into the modern solar system

## Architecture

```
packages/paradigm-threat-animation/
├── data/
│   ├── events.js                  # Timeline events, empire phases, planetary configs
│   └── empire-boundaries.geojson  # GeoJSON polygons for empire regions
├── src/
│   ├── index.js                   # Barrel export for external consumers
│   └── lib/
│       ├── mapController.js       # Framework-agnostic Leaflet map controller
│       ├── planetController.js    # Framework-agnostic Three.js planet scene
│       └── utils.js               # formatYear, getNearbyEvents, lerp, clamp
├── demo/                          # Standalone Vite dev harness
│   ├── index.html                 # HTML page for local preview
│   ├── main.js                    # Vite entry point
│   ├── planets.js                 # Standalone planet demo helpers
│   ├── map.js                     # Standalone map demo helpers
│   ├── style.css                  # Dark theme, timeline controls, map styling
│   └── vite.config.js             # Vite dev server config (port 3333)
├── package.json                   # Exports field for workspace imports
└── README.md
```

### Controller pattern

Both `mapController` and `planetController` are **framework-agnostic** factory functions:

```js
const ctrl = await createMapController(domElement, geojsonData);
ctrl.setYear(1400);          // update display
ctrl.getPhaseLabel();        // "Peak & Regional Names"
ctrl.destroy();              // clean up

const planet = await createPlanetController(canvasElement);
planet.setYear(-3000);       // update to 3000 BCE
planet.getPhaseInfo();       // { name, skyColor, yearLength, ... }
planet.destroy();            // clean up
```

Both use **dynamic imports** (`import('leaflet')`, `import('three')`) so they are SSR-safe and can be wrapped in React `useEffect` / `useRef` on the Next.js site.

## Local development (standalone demo)

```bash
cd packages/paradigm-threat-animation
pnpm install
pnpm dev           # Vite dev server on http://localhost:3333
pnpm build:demo    # Production build → dist/
```

Open the dev server to see the standalone page with map/planetary mode toggle, timeline slider, play controls, and event feed.

## Importing from paradigm-threat-site

This package lives in `packages/paradigm-threat-animation/` within the site's pnpm workspace. The `package.json` exports field allows Next.js components to import controllers and data directly:

```js
// In a React component
import { createMapController, createPlanetController, timelineEvents } from 'paradigm-threat-animation';
import 'paradigm-threat-animation/style.css';
```

The site should install `leaflet` and `three` as its own dependencies (they are listed as optional `peerDependencies`).

### React wrapper example

```tsx
import { useEffect, useRef } from 'react';
import { createMapController } from 'paradigm-threat-animation';
import geojson from 'paradigm-threat-animation/data/empire-boundaries.geojson';

export function AnimationMap({ year }: { year: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<Awaited<ReturnType<typeof createMapController>>>();

  useEffect(() => {
    let cancelled = false;
    createMapController(containerRef.current!, geojson).then(ctrl => {
      if (cancelled) { ctrl.destroy(); return; }
      ctrlRef.current = ctrl;
    });
    return () => { cancelled = true; ctrlRef.current?.destroy(); };
  }, []);

  useEffect(() => { ctrlRef.current?.setYear(year); }, [year]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

## Multi-View Camera System (Golden Age)

During the Golden Age collinear phase, the planetary animation renders **three linked views** of the same 3D scene simultaneously — no duplicate logic or separate scenes:

| View | Description | Camera Position |
|------|-------------|-----------------|
| **Orbital** | Top-down overview of entire column | Elevated (`y=22, z=28`) — current default |
| **North Pole** | Looking up from Earth toward Saturn | At Earth, offset below column plane, 70° elevation toward Saturn |
| **South Pole** | Looking up from Earth toward outer planets | At Earth, offset below column plane, 70° elevation toward Mercury/Neptune/Uranus |

Three layout toggle modes (keyboard `1`/`2`/`3`):
1. **Orbital main** + North & South in corner PIPs
2. **North main** + Orbital & South in corner PIPs
3. **South main** + Orbital & North in corner PIPs

Implementation uses `renderer.setViewport()` + `renderer.setScissor()` to render the shared scene three times per frame with different cameras. Multi-view is only active during the Golden Age (collinear) phase; all other phases use single camera.

See `paradigm-threat-timeline/docs/ANIMATION_TRACKER.md` §2.6 for full specification.

## Data sources

- **`data/events.js`** — 65+ timeline events (planetary + map types), 9 empire phases, 9 planetary configuration stages. Derived from the timeline repo's `data/events.json`.
- **`data/empire-boundaries.geojson`** — 8 GeoJSON polygon features (Rus-Horde Core, Ottoman, Spain/Iberia, Habsburg, Protestant Zone, Eastern Orthodox Zone, Muscovy/Romanov, British Empire) with `yearStart`/`yearEnd` properties.

## Pre-render pipeline (future)

For Kdenlive video export, renderers can write each frame to PNG sequences. See `paradigm-threat-timeline/docs/ANIMATION_TRACKER.md` for the full pre-render workflow plan (QGIS, Blender, Kdenlive).
