/**
 * Barrel export — clean entry point for external consumers (paradigm-threat-site).
 *
 * Usage from paradigm-threat-site:
 *   import { createMapController, createPlanetController, ... } from 'paradigm-threat-timeline/animation'
 *
 * All exports are framework-agnostic (vanilla JS).
 * Wrap them in React components on the site side.
 */

// Core controllers
export { createMapController } from './lib/mapController.js';
export { createPlanetController } from './lib/planetController.js';

// Data (events, phases, planetary configs)
export {
    timelineEvents,
    empirePhases,
    planetaryConfigs,
} from '../data/events.js';

// Utilities
export { formatYear, getNearbyEvents, lerp, clamp } from './lib/utils.js';
