/**
 * Leaflet map module — empire boundaries, event markers, timeline-driven overlays.
 */
import L from 'leaflet';
import { timelineEvents, empirePhases } from '../data/events.js';
import empireBoundariesData from '../data/empire-boundaries.geojson?raw';

let map;
let empireLayers = {};
let eventMarkers = [];
let currentYear = 1053;

/** Dark tile URL (no key required — uses free tiles) */
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export function initMap() {
    map = L.map('map', {
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

    // Parse and add empire boundary layers
    const geojson = JSON.parse(empireBoundariesData);
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

    // Create event markers (hidden initially)
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

    return map;
}

export function updateMap(year) {
    currentYear = year;

    // Update empire boundary visibility/opacity
    Object.values(empireLayers).forEach(({ layer, props }) => {
        const visible = year >= props.yearStart && year <= props.yearEnd;
        const phase = empirePhases.find(p => p.id === props.phase);

        // Fade in/out based on year
        let opacity = 0;
        if (visible) {
            // Ramp up at start, ramp down at end
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

    // Update event markers
    eventMarkers.forEach(({ marker, evt }) => {
        const isActive = Math.abs(evt.year - year) <= 10;
        const isVisible = evt.year <= year;
        marker.setOpacity(isVisible ? (isActive ? 1 : 0.3) : 0);
    });
}

function getPhaseColor(phaseId) {
    const phase = empirePhases.find(p => p.id === phaseId);
    return phase ? phase.color : '#888';
}

function formatYear(year) {
    return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

export function getActivePhaseLabel(year) {
    const phase = empirePhases.find(p => year >= p.yearStart && year <= p.yearEnd);
    return phase ? phase.label : '';
}
