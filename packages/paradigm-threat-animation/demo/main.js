/**
 * Local standalone entry — wires controllers to the HTML page.
 * This file is ONLY used by the Vite dev server (index.html).
 * paradigm-threat-site imports from src/index.js instead.
 */
import { createMapController } from '../src/lib/mapController.js';
import { createPlanetController } from '../src/lib/planetController.js';
import { formatYear, getNearbyEvents } from '../src/lib/utils.js';
import { timelineEvents } from '../data/events.js';
import empireBoundariesRaw from '../data/empire-boundaries.geojson?raw';

// ─── State ───
let currentYear = 1053;
let mode = 'map'; // 'map' | '3d'
let playing = false;
let playInterval = null;
let speed = 80;

let mapCtrl = null;
let planetCtrl = null;

// ─── DOM refs ───
const slider = document.getElementById('timeline-slider');
const btnMap = document.getElementById('btn-map');
const btn3d = document.getElementById('btn-3d');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const speedSelect = document.getElementById('speed-select');
const mapView = document.getElementById('map-view');
const planetView = document.getElementById('planet-view');
const mapYearDisp = document.getElementById('map-year-display');
const mapPhaseLabel = document.getElementById('map-phase-label');
const plYearDisp = document.getElementById('planet-year-display');
const plPhaseLabel = document.getElementById('planet-phase-label');
const plDescription = document.getElementById('planet-description');
const eventFeed = document.getElementById('event-feed');
const markersEl = document.getElementById('timeline-markers');

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
    // Create controllers using the lib API
    mapCtrl = await createMapController(
        document.getElementById('map'),
        empireBoundariesRaw
    );
    planetCtrl = await createPlanetController(
        document.getElementById('planet-canvas')
    );

    buildTimelineMarkers();
    setYear(currentYear);
    bindControls();
});

function bindControls() {
    btnMap.addEventListener('click', () => switchMode('map'));
    btn3d.addEventListener('click', () => switchMode('3d'));

    slider.addEventListener('input', () => {
        setYear(parseInt(slider.value, 10));
    });

    btnPlay.addEventListener('click', startPlayback);
    btnPause.addEventListener('click', stopPlayback);
    btnReset.addEventListener('click', () => {
        stopPlayback();
        setYear(mode === 'map' ? 1053 : -5000);
    });

    speedSelect.addEventListener('change', () => {
        speed = parseInt(speedSelect.value, 10);
        if (playing) { stopPlayback(); startPlayback(); }
    });
}

function switchMode(newMode) {
    mode = newMode;
    btnMap.classList.toggle('active', mode === 'map');
    btn3d.classList.toggle('active', mode === '3d');
    mapView.classList.toggle('active', mode === 'map');
    planetView.classList.toggle('active', mode === '3d');

    if (mode === 'map') {
        slider.min = 1053; slider.max = 2026;
        if (currentYear < 1053) setYear(1053);
    } else {
        slider.min = -5000; slider.max = 1053;
        if (currentYear > 1053) setYear(-4077);
    }
    slider.value = currentYear;
    buildTimelineMarkers();
}

function setYear(year) {
    currentYear = year;
    slider.value = year;

    if (mode === 'map') {
        mapCtrl.setYear(year);
        mapYearDisp.textContent = formatYear(year);
        mapPhaseLabel.textContent = mapCtrl.getPhaseLabel();
    } else {
        planetCtrl.setYear(year);
        const info = planetCtrl.getPhaseInfo();
        plYearDisp.textContent = formatYear(year);
        plPhaseLabel.textContent = info.label;
        plDescription.textContent = info.description;
    }

    updateEventFeed(year);
}

function startPlayback() {
    if (playing) return;
    playing = true;
    btnPlay.style.display = 'none';
    btnPause.style.display = '';

    const step = mode === 'map' ? 1 : (currentYear < -3000 ? 10 : 5);
    const maxYear = mode === 'map' ? 2026 : 1053;

    playInterval = setInterval(() => {
        const next = currentYear + step;
        if (next > maxYear) { stopPlayback(); return; }
        setYear(next);
    }, speed);
}

function stopPlayback() {
    playing = false;
    btnPlay.style.display = '';
    btnPause.style.display = 'none';
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
}

function updateEventFeed(year) {
    const nearby = getNearbyEvents(timelineEvents, year, mode);
    eventFeed.innerHTML = nearby
        .map(e => {
            const active = Math.abs(e.year - year) <= 5;
            return `<div class="event-item ${active ? 'active' : ''}">${formatYear(e.year)} — ${e.title}</div>`;
        })
        .join('');
}

function buildTimelineMarkers() {
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
    const step = mode === 'map' ? 100 : 500;
    const labels = [];
    for (let y = min; y <= max; y += step) {
        labels.push(`<span>${formatYear(y)}</span>`);
    }
    markersEl.innerHTML = labels.join('');
}
