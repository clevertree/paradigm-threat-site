/**
 * Framework-agnostic Leaflet map controller.
 * Accepts a container element instead of hardcoded DOM id.
 * Can be used standalone (Vite) or wrapped in a React component (Next.js).
 */
import { timelineEvents, empirePhases } from '../../data/events.js';
import { formatYear } from './utils.js';

// Lazily resolved — Leaflet imported dynamically so SSR doesn't break
let L = null;

/**
 * @typedef {Object} MapController
 * @property {function(number): void} setYear
 * @property {function(): string} getPhaseLabel
 * @property {function(): void} destroy
 * @property {object} map - the Leaflet map instance
 */

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/**
 * Create and return a MapController bound to the given container element.
 * @param {HTMLElement} container - DOM element to render the map into
 * @param {object|string} geojsonData - parsed GeoJSON or raw JSON string
 * @returns {Promise<MapController>}
 */
export async function createMapController(container, geojsonData) {
    // Dynamic import for SSR safety
    if (!L) {
        L = (await import('leaflet')).default;
    }

    const map = L.map(container, {
        center: [48, 40],
        zoom: 4,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false,
    });

    L.tileLayer(TILE_URL, {
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // Parse GeoJSON
    const geojson = typeof geojsonData === 'string'
        ? JSON.parse(geojsonData)
        : geojsonData;

    const empireLayers = {};
    const eventMarkers = [];
    let currentYear = 1053;

    // Add empire boundary layers
    geojson.features.forEach((feature) => {
        const props = feature.properties;
        const layer = L.geoJSON(feature, {
            style: () => ({
                color: getPhaseColor(props.phase),
                weight: 2,
                opacity: 0,
                fillColor: getPhaseColor(props.phase),
                fillOpacity: 0,
                dashArray: props.subRegion ? '5,5' : null,
            }),
        });

        layer.bindTooltip(props.label || props.name, {
            className: 'empire-tooltip',
            direction: 'center',
            permanent: false,
        });

        layer.addTo(map);
        empireLayers[props.name] = { layer, props };
    });

    // Create event markers
    const mapEvents = timelineEvents.filter(e => e.type === 'map' && e.lat);
    mapEvents.forEach((evt) => {
        const icon = L.divIcon({
            className: 'pulse-marker',
            iconSize: [12, 12],
        });

        const marker = L.marker([evt.lat, evt.lng], { icon, opacity: 0 });
        marker.bindPopup(
            `<div class="event-popup">
        <h3>${evt.title}</h3>
        <p class="year">${formatYear(evt.year)}</p>
      </div>`,
            { maxWidth: 250 }
        );
        marker.addTo(map);
        eventMarkers.push({ marker, evt });
    });

    // ── HUD overlay ──
    const hud = buildMapHUD(container);

    function setYear(year) {
        currentYear = year;

        Object.values(empireLayers).forEach(({ layer, props }) => {
            const visible = year >= props.yearStart && year <= props.yearEnd;
            const phase = empirePhases.find(p => p.id === props.phase);

            let opacity = 0;
            if (visible) {
                const totalSpan = props.yearEnd - props.yearStart;
                const elapsed = year - props.yearStart;
                const remaining = props.yearEnd - year;
                const rampYears = Math.min(50, totalSpan * 0.1);
                const fadeIn = Math.min(1, elapsed / rampYears);
                const fadeOut = Math.min(1, remaining / rampYears);
                opacity = Math.min(fadeIn, fadeOut) * (phase ? phase.opacity : 0.3);
            }

            layer.setStyle({
                opacity: visible ? 0.7 : 0,
                fillOpacity: opacity,
            });
        });

        eventMarkers.forEach(({ marker, evt }) => {
            const isActive = Math.abs(evt.year - year) <= 10;
            const isVisible = evt.year <= year;
            marker.setOpacity(isVisible ? (isActive ? 1 : 0.3) : 0);
        });

        // Update HUD
        const phaseObj = empirePhases.find(p => currentYear >= p.yearStart && currentYear <= p.yearEnd);
        const label = phaseObj ? phaseObj.label : '';
        const ceEvents = timelineEvents.filter(e => e.type === 'map');
        let nearest = null, nearestDist = Infinity;
        for (const e of ceEvents) {
            const d = Math.abs(e.year - year);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        const evtStr = (nearest && nearestDist <= 15) ? nearest.title : '';
        hud.update(formatYear(year), label, evtStr);
    }

    function getPhaseLabel() {
        const phase = empirePhases.find(p => currentYear >= p.yearStart && currentYear <= p.yearEnd);
        return phase ? phase.label : '';
    }

    function destroy() {
        hud.remove();
        map.remove();
    }

    return { map, setYear, getPhaseLabel, destroy };
}

/** Build an HTML HUD overlay for the map view */
function buildMapHUD(container) {
    container.style.position = 'relative';

    const el = document.createElement('div');
    el.className = 'map-hud';
    Object.assign(el.style, {
        position: 'absolute',
        top: '0', left: '0', right: '0',
        zIndex: '900',
        padding: '10px 14px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 70%, transparent 100%)',
        pointerEvents: 'none',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        color: '#e0e0e0',
    });

    const yearEl = document.createElement('div');
    Object.assign(yearEl.style, {
        fontSize: '22px', fontWeight: '700',
        color: '#f97316', fontVariantNumeric: 'tabular-nums',
        lineHeight: '1.2',
    });

    const labelEl = document.createElement('div');
    Object.assign(labelEl.style, {
        fontSize: '13px', fontWeight: '600',
        color: '#e2e8f0', marginTop: '2px',
    });

    const eventEl = document.createElement('div');
    Object.assign(eventEl.style, {
        fontSize: '11px', color: '#fdba74',
        marginTop: '3px', opacity: '0.85',
    });

    el.appendChild(yearEl);
    el.appendChild(labelEl);
    el.appendChild(eventEl);
    container.appendChild(el);

    let lastText = '';
    return {
        update(yearStr, label, evtTitle) {
            const key = yearStr + label;
            if (key === lastText) return;
            lastText = key;
            yearEl.textContent = yearStr;
            labelEl.textContent = label;
            eventEl.textContent = evtTitle;
        },
        remove() {
            el.remove();
        },
    };
}

function getPhaseColor(phaseId) {
    const phase = empirePhases.find(p => p.id === phaseId);
    return phase ? phase.color : '#888';
}
