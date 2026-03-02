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
    }

    function getPhaseLabel() {
        const phase = empirePhases.find(p => currentYear >= p.yearStart && currentYear <= p.yearEnd);
        return phase ? phase.label : '';
    }

    function destroy() {
        map.remove();
    }

    return { map, setYear, getPhaseLabel, destroy };
}

function getPhaseColor(phaseId) {
    const phase = empirePhases.find(p => p.id === phaseId);
    return phase ? phase.color : '#888';
}
