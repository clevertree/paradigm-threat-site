/**
 * Timeline event data extracted from events.json for animation use.
 * Each entry has: year, title, type, location (lat/lng for map pins), chapter ref.
 */
export const timelineEvents = [
    // ── BC / Golden Age (3D planetary, no map) ──
    { year: -5000, title: "Before Creation", type: "planetary", phase: "before-creation" },
    { year: -4077, title: "Proto-Saturn joins Sun's orbit — Golden Age begins", type: "planetary", phase: "golden-age" },
    { year: -3147, title: "Golden Age ends violently — collinear configuration breaks", type: "planetary", phase: "dark-age" },
    { year: -3067, title: "Planets are at war — Jupiter assaults Saturn", type: "planetary", phase: "dark-age" },
    { year: -2860, title: "Non-linear 'Round Table' orbit stabilizes", type: "planetary", phase: "dark-age" },
    { year: -2349, title: "Jupiter disappears — Venus attacks Earth (Deluge)", type: "planetary", phase: "dark-age" },
    { year: -2193, title: "Earth leaves last Absu layer — Jupiter consumes Venus", type: "planetary", phase: "dark-age" },
    { year: -1936, title: "Sodom & Gomorrah destroyed by Mars", type: "planetary", phase: "dark-age" },
    { year: -1492, title: "Passover of Comet Venus — Exodus", type: "planetary", phase: "dark-age" },
    { year: -1442, title: "Sun stands still for Joshua", type: "planetary", phase: "dark-age" },
    { year: -806, title: "Mars, Earth, Mercury finalize orbits", type: "planetary", phase: "dark-age" },
    { year: -670, title: "Priori-Mars loses outer shell — Iron Age begins", type: "planetary", phase: "dark-age" },
    { year: -684, title: "Solar system becomes stable", type: "planetary", phase: "stability" },

    // ── The Blip (phantom period) ──
    { year: -670, endYear: 1053, title: "The Blip: 7th c. BCE to 10th c. CE never occurred (Fomenko)", type: "blip", phase: "blip" },

    // ── CE Map-based events ──
    // 11th century
    { year: 1053, title: "'Year of our Lord' Deception — 1053-year shift", type: "map", lat: 41.01, lng: 28.98, chapter: "05", phase: "empire-formation" },
    { year: 1053, title: "Deep State centralizes world religion at Jerusalem", type: "map", lat: 31.77, lng: 35.23, chapter: "05", phase: "empire-formation" },

    // 12th century
    { year: 1152, title: "Historical Christ born in Crimea", type: "map", lat: 44.95, lng: 34.10, chapter: "06", phase: "empire-formation" },
    { year: 1185, title: "Historical Christ crucified in Istanbul", type: "map", lat: 41.01, lng: 28.98, chapter: "06", phase: "empire-formation" },
    { year: 1196, title: "First Crusade / Trojan War (revenge for Christ)", type: "map", lat: 39.96, lng: 26.24, chapter: "06", phase: "empire-formation" },

    // 13th century — Rus-Horde emerges
    { year: 1200, title: "Russian Horde 'Tartarian' Empire emerges", type: "map", lat: 55.75, lng: 37.62, chapter: "07", phase: "empire-formation" },
    { year: 1258, title: "Historical Christ dies", type: "map", lat: 41.01, lng: 28.98, chapter: "07", phase: "empire-formation" },
    { year: 1285, title: "First Olympic Games", type: "map", lat: 37.64, lng: 21.63, chapter: "07", phase: "empire-formation" },

    // 14th century — Great Expansion
    { year: 1300, title: "Great Expansion of Mongol-Slavic Horde", type: "map", lat: 55.75, lng: 37.62, chapter: "08", phase: "peak-empire" },
    { year: 1380, title: "Battle of Kulikovo — Giants defeated", type: "map", lat: 53.67, lng: 38.67, chapter: "08", phase: "peak-empire" },

    // 15th century — Ottoman = Ataman
    { year: 1421, title: "Meteorite falls on Yaroslavl", type: "map", lat: 57.63, lng: 39.87, chapter: "09", phase: "fragmentation" },
    { year: 1431, title: "Jeanne d'Arc executed (Fomenko: ~1580)", type: "map", lat: 49.44, lng: 1.10, chapter: "09", phase: "fragmentation" },
    { year: 1453, title: "Fall of Czar-Grad (Constantinople)", type: "map", lat: 41.01, lng: 28.98, chapter: "09", phase: "fragmentation" },
    { year: 1455, title: "Gutenberg Bible translated into Latin", type: "map", lat: 49.99, lng: 8.27, chapter: "09", phase: "fragmentation" },
    { year: 1486, title: "Revelation of the coming Apocalypse", type: "map", lat: 41.90, lng: 12.50, chapter: "09", phase: "fragmentation" },
    { year: 1492, title: "The Apocalypse Crusade", type: "map", lat: 37.39, lng: -5.98, chapter: "09", phase: "fragmentation" },

    // 16th century — Reformation
    { year: 1517, title: "Protestant Reformation begins", type: "map", lat: 51.87, lng: 12.64, chapter: "10", phase: "religious-schism" },
    { year: 1523, title: "Jesuits 'Pilgrimage' to Palestine", type: "map", lat: 31.77, lng: 35.23, chapter: "10", phase: "religious-schism" },
    { year: 1542, title: "The Holy Inquisition", type: "map", lat: 41.90, lng: 12.50, chapter: "10", phase: "religious-schism" },
    { year: 1548, title: "Jesuits reach Africa", type: "map", lat: 9.03, lng: 38.74, chapter: "10", phase: "religious-schism" },
    { year: 1552, title: "Khazar Rebellion in Rus-Horde Empire", type: "map", lat: 55.79, lng: 49.11, chapter: "10", phase: "religious-schism" },
    { year: 1565, title: "Oprichnina coup (Romanov dynasty)", type: "map", lat: 55.75, lng: 37.62, chapter: "10", phase: "religious-schism" },
    { year: 1582, title: "Gregorian Calendar introduced", type: "map", lat: 41.90, lng: 12.50, chapter: "10", phase: "religious-schism" },

    // 17th century — Romanovs
    { year: 1611, title: "King James Bible published", type: "map", lat: 51.51, lng: -0.13, chapter: "11", phase: "romanov-split" },
    { year: 1613, title: "Romanov dynasty takes the throne", type: "map", lat: 55.75, lng: 37.62, chapter: "11", phase: "romanov-split" },
    { year: 1618, title: "Thirty Years War begins (Horde provinces vs Vatican)", type: "map", lat: 50.08, lng: 14.44, chapter: "11", phase: "romanov-split" },
    { year: 1627, title: "Deep State erases Russian Empire from chronology", type: "map", lat: 55.75, lng: 37.62, chapter: "11", phase: "romanov-split" },
    { year: 1642, title: "English Civil War begins", type: "map", lat: 51.51, lng: -0.13, chapter: "11", phase: "romanov-split" },
    { year: 1648, title: "Cossack-Polish War — ethnic cleansing in Ukraine", type: "map", lat: 50.45, lng: 30.52, chapter: "11", phase: "romanov-split" },
    { year: 1664, title: "Great Comet of 1664", type: "map", lat: 51.51, lng: -0.13, chapter: "11", phase: "romanov-split" },
    { year: 1666, title: "London burns / Sabbatean crisis / Apocalypse of 1666", type: "map", lat: 51.51, lng: -0.13, chapter: "11", phase: "romanov-split" },
    { year: 1694, title: "Bank of England — central banking solidified", type: "map", lat: 51.51, lng: -0.13, chapter: "11", phase: "romanov-split" },

    // 18th century — Collapse
    { year: 1718, title: "Secret Society of Jesus goes public", type: "map", lat: 51.51, lng: -0.13, chapter: "12", phase: "collapse" },
    { year: 1773, title: "Pugachev Rebellion — Final Tartary vs Romanov war", type: "map", lat: 51.67, lng: 55.10, chapter: "12", phase: "collapse" },
    { year: 1774, title: "Carbon-14 spike / MudFlood begins", type: "map", lat: 55.75, lng: 37.62, chapter: "12", phase: "collapse" },

    // 19th century
    { year: 1803, title: "Napoleonic Wars begin — Reverse Crusade I", type: "map", lat: 48.86, lng: 2.35, chapter: "13", phase: "post-horde" },
    { year: 1812, title: "Napoleon invades Russia — Reverse Crusade I", type: "map", lat: 55.75, lng: 37.62, chapter: "13", phase: "post-horde" },
    { year: 1840, title: "Ecliptic pathway of the Absu last seen", type: "map", lat: 55.75, lng: 37.62, chapter: "13", phase: "post-horde" },
    { year: 1848, title: "Battle for Communism's Soul: Marx vs Kinkel", type: "map", lat: 50.94, lng: 6.96, chapter: "13", phase: "post-horde" },
    { year: 1883, title: "Hijacking of Communism", type: "map", lat: 51.51, lng: -0.13, chapter: "13", phase: "post-horde" },

    // 20th century — Reverse Crusades II & III
    { year: 1914, title: "Reverse Crusade II begins (\"World War I\")", type: "map", lat: 48.21, lng: 16.37, chapter: "14", phase: "modern" },
    { year: 1917, title: "Bolshevik Revolution", type: "map", lat: 59.93, lng: 30.32, chapter: "14", phase: "modern" },
    { year: 1941, title: "Reverse Crusade III — Operation Barbarossa (\"World War II\")", type: "map", lat: 52.52, lng: 13.41, chapter: "14", phase: "modern" },
];

/**
 * Empire phase configs for map overlay coloring and labels.
 */
export const empirePhases = [
    {
        id: "pre-empire",
        label: "No Empires / No Borders",
        yearStart: 1053,
        yearEnd: 1149,
        color: "#888888",
        opacity: 0.1,
    },
    {
        id: "empire-formation",
        label: "Rus-Horde Formation",
        yearStart: 1150,
        yearEnd: 1299,
        color: "#c62828",
        opacity: 0.3,
    },
    {
        id: "peak-empire",
        label: "Great Tartary — Peak Expansion",
        yearStart: 1300,
        yearEnd: 1399,
        color: "#b71c1c",
        opacity: 0.45,
    },
    {
        id: "fragmentation",
        label: "Regional Fragmentation — Ottoman/Spain/Habsburg",
        yearStart: 1400,
        yearEnd: 1499,
        color: "#e65100",
        opacity: 0.35,
    },
    {
        id: "religious-schism",
        label: "Protestant vs Orthodox Schism",
        yearStart: 1500,
        yearEnd: 1599,
        color: "#f57f17",
        opacity: 0.35,
    },
    {
        id: "romanov-split",
        label: "Romanov Takeover — Empire Fractures",
        yearStart: 1600,
        yearEnd: 1699,
        color: "#ff6f00",
        opacity: 0.3,
    },
    {
        id: "collapse",
        label: "Final Collapse — Pugachev / MudFlood",
        yearStart: 1700,
        yearEnd: 1799,
        color: "#4e342e",
        opacity: 0.3,
    },
    {
        id: "post-horde",
        label: "Post-Horde — Nation-States Emerge",
        yearStart: 1800,
        yearEnd: 1899,
        color: "#37474f",
        opacity: 0.2,
    },
    {
        id: "modern",
        label: "Modern Borders",
        yearStart: 1900,
        yearEnd: 2026,
        color: "#263238",
        opacity: 0.15,
    },
];

/**
 * Planetary configuration data for Three.js BC animation.
 */
export const planetaryConfigs = [
    {
        id: "before-creation",
        yearStart: -5000,
        yearEnd: -4077,
        label: "Before Creation",
        description: "Chaotic plasma environment. Saturn coalescing. Proto-configuration forming.",
        saturn: { glow: 0.3, rings: false, position: [0, 2, 0] },
        venus: null,
        mars: null,
        earth: null,
        skyColor: "#1a0a2e",
    },
    {
        id: "golden-age",
        yearStart: -4077,
        yearEnd: -3147,
        label: "Golden Age — Collinear Configuration",
        description: "Saturn-Venus-Mars-Earth aligned. Tree of Life visible. Northern: Wheel of Heaven. Southern: Petroglyph figures.",
        saturn: { glow: 1.0, rings: false, position: [0, 4, 0], color: "#ffcc00" },
        venus: { type: "plasmoid", points: 8, position: [0, 2, 0], color: "#ffffff" },
        mars: { type: "solid", position: [0, 0.5, 0], color: "#cc3300" },
        earth: { position: [0, -1.5, 0], color: "#3366cc" },
        skyColor: "#0d1b4a",
        yearLength: 225,
    },
    {
        id: "breakup",
        yearStart: -3147,
        yearEnd: -3067,
        label: "Collinear Configuration Breaks Apart",
        description: "All 9 planets break from configuration. Exit Saturn's plasma sheath.",
        saturn: { glow: 0.6, rings: false, position: [0, 5, 0] },
        venus: { type: "plasmoid", points: 6, position: [2, 3, 1], color: "#ffffff" },
        mars: { type: "solid", position: [-1, 1, 2], color: "#cc3300" },
        earth: { position: [-3, -1, -2], color: "#3366cc" },
        skyColor: "#2d0a0a",
        chaotic: true,
    },
    {
        id: "round-table",
        yearStart: -3067,
        yearEnd: -2349,
        label: "Non-Linear 'Round Table' — Jupiter Dominates",
        description: "Saturn has fled to the outer solar system. Jupiter, Venus, Mars & Earth orbit an empty barycenter (no planet at center). This rotating circle orbits the Sun. Jupiter eclipses Sun once per orbit.",
        saturn: { glow: 0.3, rings: false, position: [3, 2, 0] },
        venus: { type: "comet", position: [-2, 1, 3], color: "#ffeeaa" },
        mars: { type: "solid", position: [1, 0, -2], color: "#cc3300" },
        earth: { position: [-1, -1, 1], color: "#3366cc" },
        jupiter: { type: "dominant", position: [0, 3, 0], color: "#cc9944" },
        skyColor: "#1a0505",
        yearLength: 273,
    },
    {
        id: "deluge",
        yearStart: -2349,
        yearEnd: -2193,
        label: "The Deluge — Jupiter Disappears, Venus Attacks",
        description: "Jupiter disappears. Venus attacks Earth. Catastrophic flooding.",
        saturn: { glow: 0.2, rings: false, position: [5, 3, 0] },
        venus: { type: "comet", position: [0.5, 0.5, 0], color: "#ff4444", threatening: true },
        mars: { type: "solid", position: [2, -1, 3], color: "#cc3300" },
        earth: { position: [0, 0, 0], color: "#3366cc", flooding: true },
        skyColor: "#330000",
        yearLength: 273,
    },
    {
        id: "post-deluge",
        yearStart: -2193,
        yearEnd: -1492,
        label: "Post-Deluge — Destabilization Continues",
        description: "Jupiter consumes Venus. Sodom & Gomorrah. Configuration widening.",
        saturn: { glow: 0.15, rings: false, position: [6, 4, 0] },
        venus: { type: "consumed", position: [3, 3, 0] },
        mars: { type: "solid", position: [0.5, 0, -1], color: "#cc3300", closeApproach: true },
        earth: { position: [0, 0, 0], color: "#3366cc" },
        skyColor: "#1a0505",
        yearLength: 273,
    },
    {
        id: "venus-returns",
        yearStart: -1492,
        yearEnd: -806,
        label: "Venus Returns as Comet — Exodus",
        description: "Passover of Comet Venus. Venus and Mars tethered as 'the dragon'.",
        saturn: { glow: 0.1, rings: false, position: [8, 5, 0] },
        venus: { type: "comet", position: [-1, 1, 0], color: "#ffaa00" },
        mars: { type: "solid", position: [-0.5, 0.8, 0], color: "#cc3300", tetheredToVenus: true },
        earth: { position: [0, 0, 0], color: "#3366cc" },
        skyColor: "#0a0a1a",
        yearLength: 290,
    },
    {
        id: "stabilization",
        yearStart: -806,
        yearEnd: -670,
        label: "Orbits Finalize — Mars Loses Outer Shell",
        description: "Mars, Earth, Mercury move to final orbits. Iron Age begins.",
        saturn: { glow: 0.08, rings: true, position: [10, 6, 0] },
        venus: { type: "planet", position: [-3, 0, 0], color: "#ffcc88" },
        mars: { type: "solid", position: [2, 0, 0], color: "#cc3300", shedding: true },
        earth: { position: [0, 0, 0], color: "#3366cc" },
        skyColor: "#0a1a2a",
        yearLength: 350,
    },
    {
        id: "modern-solar",
        yearStart: -670,
        yearEnd: 1053,
        label: "Modern Solar System — Phantom Period (The Blip)",
        description: "Solar system stable. 7th c. BCE to 10th c. CE is phantom time per Fomenko.",
        saturn: { glow: 0.05, rings: true, position: [12, 7, 0], color: "#ccaa66" },
        venus: { type: "planet", position: [-4, 0, 0], color: "#ffcc88" },
        mars: { type: "planet", position: [3, 0, 0], color: "#cc3300" },
        earth: { position: [0, 0, 0], color: "#3366cc" },
        skyColor: "#0a1a3a",
        yearLength: 365,
    },
];
