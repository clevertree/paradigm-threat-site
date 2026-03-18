/**
 * Framework-agnostic Three.js planetary scene controller.
 *
 * Features:
 *  - Sun always visible as central reference
 *  - Venus = GREEN, Saturn = ORANGE
 *  - Full collinear column: Uranus → Neptune → Mercury → Earth → Mars → Venus → Saturn → Jupiter → Sun
 *    The column always POINTS TOWARD the Sun and orbits around it as a rigid unit
 *  - Dark Age (-3147 to -670): Saturn hidden; Earth, Venus, Mars, Mercury, Jupiter form a rotating
 *    circle (nothing in center); circle rotates 4×/year, orbits Sun 1×/year; Moon orbits Earth 1×/month
 *  - Moon appears at -3147 (Earth capture)
 *  - Orbit counting per planet per era
 */
import { planetaryConfigs, timelineEvents } from '../../data/events.js';
import { formatYear } from './utils.js';

let THREE = null;

const MOON_CAPTURE_YEAR = -3147;
const MOON_ORBIT_RADIUS = 0.8;

/* ── Collinear column config ──
 * The column orbits Sun at radius R in the XZ plane.
 * The column axis points radially inward (toward Sun).
 * 'dist' = distance along the column axis from the Sun.
 *   Larger dist = further from Sun.
 *
 * Order toward Sun:  Uranus → Neptune → Mercury → Earth → Mars → Venus → Saturn → Jupiter → [Sun]
 */
const COL = {
    R: 10, // orbital radius of column center around Sun
    period: 1.0,
    // dist: distance from Sun along column axis
    // Correct Saturnian order: Sun → Jupiter → Saturn → Venus → Mars → Earth
    jupiter: { dist: 1.5 },
    saturn: { dist: 4.0 },
    venus: { dist: 6.5 },
    mars: { dist: 8.5 },
    earth: { dist: 10.5 },
    mercury: { dist: 12.0 },
    neptune: { dist: 13.5 },
    uranus: { dist: 15.0 },
};

/* ── Round Table config ──
 * Saturn has fled to the outer solar system after the breakup.
 * Remaining 4 planets (Jupiter, Venus, Mars, Earth) orbit an EMPTY
 * invisible barycenter (no planet at center). Jupiter carries the bulk
 * of the weight but is NOT in the center.
 * Internal rotation: CLOCKWISE (retrograde).
 * Whole array orbits the Sun: COUNTERCLOCKWISE (prograde).
 * Both rotations are synchronous = 1 Earth-year (240 days in this era).
 * Once per orbit Jupiter passes in front of the Sun → eclipse.
 * Mars is unstable "marble between two magnets" — causes eventual breakup.
 */
const RT = {
    sunDist: 12,           // distance from barycenter to Sun
    internalPeriod: 1.0,   // internal rotation period (synchronous = 1 year)
    solarPeriod: 1.0,      // array's orbital period around Sun (same = synchronous)
    // Distance from empty barycenter for each planet
    jupiter: { r: 4.5 },   // opposite side, heaviest body
    venus: { r: 2.5 },   // inner-planets side
    earth: { r: 4.5 },   // outermost on inner side
    mars: { r: 3.5 },   // between Venus and Earth (unstable oscillator)
    saturnFarPos: [25, 2, -15],  // Saturn receding in outer solar system
};

/* ── Dark Age config (3147 to 670 BCE) ──
 * Saturn is NOT visible (no longer seen).
 * Earth, Venus, Mars, Mercury, Jupiter form a rotating circle with nothing in center.
 * Circle rotates 4x per year. Circle orbits Sun once per year.
 * Moon orbits Earth once per month.
 */
const DA = {
    sunDist: 12,           // distance from barycenter to Sun
    circleRadius: 4.0,     // radius of the 5-planet circle
    internalPeriod: 0.25,   // circle rotates 4x per year
    solarPeriod: 1.0,      // circle orbits Sun once per year
    moonPeriod: 1 / 12,    // Moon orbits Earth once per month (in years)
};

/* ── Modern config ──
 * Standard concentric XZ-plane circles around Sun at origin.
 */
const MOD = {
    mercury: { r: 2.0, period: 0.24 },
    venus: { r: 3.5, period: 0.615 },
    earth: { r: 5.0, period: 1.0 },
    mars: { r: 7.0, period: 1.88 },
    jupiter: { r: 10.0, period: 11.86 },
    saturn: { r: 13.0, period: 29.46 },
    uranus: { r: 16.0, period: 84 },
    neptune: { r: 19.0, period: 164 },
    /** Kuiper belt object — shown only in modern-solar (placeModern) */
    pluto: { r: 22.0, period: 248 },
};

/**
 * Create and return a PlanetController bound to the given canvas.
 * @param {HTMLCanvasElement} canvas
 */
export async function createPlanetController(canvas) {
    if (!THREE) THREE = await import('three');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000
    );
    camera.position.set(0, 10, 25);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x8899bb, 1.4));
    const sunLight = new THREE.PointLight(0xffffcc, 3.0, 120);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0xaabbcc, 0.6);
    fillLight.position.set(0, 5, 15);
    scene.add(fillLight);

    // ── Build scene objects ──
    const p = {};
    buildSun(scene, p, THREE);
    buildSaturn(scene, p, THREE);
    buildVenus(scene, p, THREE);
    buildMars(scene, p, THREE);
    buildEarth(scene, p, THREE);
    buildJupiter(scene, p, THREE);
    buildMercury(scene, p, THREE);
    buildNeptune(scene, p, THREE);
    buildUranus(scene, p, THREE);
    buildPluto(scene, p, THREE);
    buildMoon(scene, p, THREE);
    const plasma = buildPlasmaField(scene, THREE);
    buildStarfield(scene, THREE);

    // ── New planet animation objects ──
    buildVenusStar(scene, p, THREE);        // morphing N-pointed plasmoid star
    buildCometTail(scene, p, THREE);        // Venus comet tail particles
    buildMarsShell(scene, p, THREE);        // translucent outer shell
    buildMarsShellFragments(scene, p, THREE); // explosion fragments
    buildDragonTether(scene, p, THREE);     // electric arc Venus↔Mars
    buildBirkelandCurrents(scene, p, THREE); // collinear phase tethers
    buildWheelOfHeaven(scene, p, THREE);    // Saturn's Wheel of Heaven overlay

    // ── Labels ──
    const L = {};
    L.sun = buildLabel('SUN', '#ffffaa', THREE);
    L.saturn = buildLabel('SATURN', '#ff8833', THREE);
    L.venus = buildLabel('VENUS', '#33ff77', THREE);
    L.mars = buildLabel('MARS', '#ff6644', THREE);
    L.earth = buildLabel('EARTH', '#66aaff', THREE);
    L.jupiter = buildLabel('JUPITER', '#ffaa44', THREE);
    L.mercury = buildLabel('MERCURY', '#bbaa88', THREE);
    L.neptune = buildLabel('NEPTUNE', '#4466ff', THREE);
    L.uranus = buildLabel('URANUS', '#66dddd', THREE);
    L.pluto = buildLabel('PLUTO', '#b8a898', THREE);
    L.moon = buildLabel('MOON', '#cccccc', THREE);
    Object.values(L).forEach(s => scene.add(s));

    // ── Orbital path lines (static geometry) ──
    const oLines = {};
    oLines.collinear = buildCollinearPaths(scene, THREE);
    oLines.roundTable = buildRoundTablePaths(scene, THREE);
    oLines.modern = buildModernPaths(scene, THREE);
    setGroupVis(oLines.collinear, false);
    setGroupVis(oLines.roundTable, false);
    setGroupVis(oLines.modern, false);

    // ── HUD overlay (HTML element on top of canvas) ──
    const hud = buildHUD(canvas);

    // ── Multi-view cameras (Golden Age only) ──
    // North Pole camera: at Earth, looking inward along column toward Saturn
    const northCam = new THREE.PerspectiveCamera(
        50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000
    );
    // South Pole camera: at Earth, looking outward along column toward Uranus
    const southCam = new THREE.PerspectiveCamera(
        60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000
    );

    // ── Multi-view state ──
    let viewMode = 1;            // 1=orbital main, 2=north main, 3=south main
    let multiViewActive = false; // only true during collinear/golden-age

    // ── View toggle UI + labels (HTML overlays) ──
    const viewUI = buildViewToggleUI(canvas, (mode) => { viewMode = mode; });

    // ── Keyboard listener for view toggle ──
    const onKeyDown = (e) => {
        if (!multiViewActive) return;
        if (e.key === '1') viewMode = 1;
        else if (e.key === '2') viewMode = 2;
        else if (e.key === '3') viewMode = 3;
        else return;
        viewUI.setActive(viewMode);
    };
    window.addEventListener('keydown', onKeyDown);

    // ── State ──
    let currentYear = -5000;
    let curStyle = '';
    let orbitCounts = {};
    let animId = null;

    let camPosGoal = new THREE.Vector3(0, 10, 25);
    let camLookGoal = new THREE.Vector3(0, 2, 0);

    // ── Resize ──
    const doResize = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        northCam.aspect = w / h;
        northCam.updateProjectionMatrix();
        southCam.aspect = w / h;
        southCam.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    // Use ResizeObserver on the canvas for container-driven resizing
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(doResize);
        resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', doResize);

    // ── Render loop ──
    function animate() {
        animId = requestAnimationFrame(animate);
        const t = performance.now() * 0.001;

        // Enforce Sun visibility every frame (hidden before -4077 only)
        if (currentYear < -4077) {
            p.sun.visible = false;
            L.sun.visible = false;
        }

        if (p.sun?.visible) p.sun.rotation.y += 0.001;
        if (p.saturn?.visible) p.saturn.rotation.y += 0.002;
        if (p.venus?.visible) p.venus.rotation.y += 0.005;
        if (p.mars?.visible) p.mars.rotation.y += 0.004;
        if (p.earth?.visible) p.earth.rotation.y += 0.003;
        if (p.jupiter?.visible) p.jupiter.rotation.y += 0.001;
        if (p.mercury?.visible) p.mercury.rotation.y += 0.006;
        if (p.neptune?.visible) p.neptune.rotation.y += 0.001;
        if (p.uranus?.visible) p.uranus.rotation.y += 0.001;
        if (p.pluto?.visible) p.pluto.rotation.y += 0.002;
        if (plasma?.visible) {
            plasma.rotation.y += 0.0005;
            plasma.rotation.x = Math.sin(t * 0.1) * 0.05;
        }

        // ── Animate Venus plasmoid star morph (4→5→6→7→8 sided cycle) ──
        if (p.venusStar?.visible) {
            const cycle = 20; // seconds per full 4→8→4 cycle
            const frac = (t % cycle) / cycle;
            // Map 0→1 to 4→8→4 smoothly
            const sides = 4 + 4 * (frac < 0.5 ? frac * 2 : 2 - frac * 2);
            updateVenusStarGeometry(p.venusStar, sides, THREE);
            // Pulsing scale
            const pulse = 1.0 + 0.15 * Math.sin(t * 2.5);
            p.venusStar.scale.setScalar(pulse);
            // Shimmer opacity
            if (p.venusStarGlow?.visible) {
                p.venusStarGlow.material.opacity = 0.4 + 0.2 * Math.sin(t * 3.7);
            }
        }

        // ── Animate comet tail particles ──
        if (p.cometTail?.visible) {
            animateCometTail(p, t, THREE);
        }

        // ── Animate Mars outer shell breathing ──
        if (p.marsShell?.visible) {
            const breathe = 1.0 + 0.05 * Math.sin(t * 1.3);
            p.marsShell.scale.setScalar(breathe);
            // Stress fractures glow in venus-returns phase
            if (p.marsShell.userData.stressed) {
                p.marsShell.material.emissiveIntensity = 0.3 + 0.3 * Math.abs(Math.sin(t * 4.0));
            }
        }

        // ── Animate shell explosion fragments ──
        if (p.marsFragments?.visible) {
            animateShellFragments(p.marsFragments, t, THREE);
        }

        // ── Animate dragon tether (electric arc) ──
        if (p.dragonTether?.visible) {
            animateDragonTether(p, t, THREE);
        }

        // ── Animate Birkeland currents ──
        if (p.birkelandCurrents?.visible) {
            animateBirkelandCurrents(p, t, THREE);
        }

        // ── Animate Wheel of Heaven rotation ──
        if (p.wheelOfHeaven?.visible) {
            p.wheelOfHeaven.rotation.z += 0.003;
            // Gentle pulse
            const wp = 0.9 + 0.1 * Math.sin(t * 0.5);
            p.wheelOfHeaven.scale.setScalar(wp);
        }

        camera.position.lerp(camPosGoal, 0.03);
        camera.lookAt(camLookGoal);

        // ── Update North/South cameras to track column ──
        // Standing on Earth's surface looking along the column in each direction.
        // Camera is at Earth's XZ position, just above ground (y = 0.3).
        // The foreshortened view — near planets big, far planets small — is the
        // correct surface perspective.
        //   North = inner planets (Sun-ward): Mars(8.5)→Venus(6.5)→Saturn(4.0)→Jupiter(1.5)
        //   South = outer planets: Mercury(12.0)→Neptune(13.5)→Uranus(15.0)
        if (multiViewActive && p.earth?.visible) {
            const earthPos = p.earth.position;

            // Column direction (unit vector from Sun outward along the radial bar)
            const colDir = new THREE.Vector3(earthPos.x, 0, earthPos.z).normalize();
            // Inward direction (toward Sun)
            const inward = new THREE.Vector3(-colDir.x, 0, -colDir.z);

            // North cam: standing on Earth, looking inward toward Saturn group
            // Camera up = (0,1,0), look target slightly above column plane (y=0.8)
            // so planets appear in upper half and horizon in lower half.
            const northTarget = (COL.saturn.dist + COL.venus.dist) / 2; // ~5.25
            northCam.position.set(earthPos.x, 0.3, earthPos.z);
            northCam.up.set(0, 1, 0);
            northCam.lookAt(
                earthPos.x + inward.x * (COL.earth.dist - northTarget),
                0.8,
                earthPos.z + inward.z * (COL.earth.dist - northTarget)
            );

            // South cam: standing on Earth, looking outward toward Uranus group
            const southTarget = (COL.mercury.dist + COL.uranus.dist) / 2; // ~13.5
            southCam.position.set(earthPos.x, 0.3, earthPos.z);
            southCam.up.set(0, 1, 0);
            southCam.lookAt(
                earthPos.x + colDir.x * (southTarget - COL.earth.dist),
                0.8,
                earthPos.z + colDir.z * (southTarget - COL.earth.dist)
            );
        }

        // ── Determine the active camera for label syncing ──
        const labelCam = multiViewActive
            ? (viewMode === 2 ? northCam : viewMode === 3 ? southCam : camera)
            : camera;

        // Labels
        syncLabel(L.sun, p.sun, 1.4, labelCam);
        syncLabel(L.saturn, p.saturn, 1.8, labelCam);
        // Venus label tracks the star when the sphere is hidden
        const venusTarget = p.venusStar?.visible ? p.venusStar : p.venus;
        syncLabel(L.venus, venusTarget, 0.8, labelCam);
        // Show Venus label when either sphere or star is visible
        L.venus.visible = p.venus.visible || (p.venusStar?.visible ?? false);
        syncLabel(L.mars, p.mars, 0.7, labelCam);
        syncLabel(L.earth, p.earth, 0.8, labelCam);
        syncLabel(L.jupiter, p.jupiter, 1.4, labelCam);
        syncLabel(L.mercury, p.mercury, 0.5, labelCam);
        syncLabel(L.neptune, p.neptune, 0.7, labelCam);
        syncLabel(L.uranus, p.uranus, 0.7, labelCam);
        syncLabel(L.pluto, p.pluto, 0.35, labelCam);
        syncLabel(L.moon, p.moon, 0.4, labelCam);

        // ── Labels: Y-offset above planets works naturally with ground-level cams ──
        // No perpendicular shift needed — standard Y-offset places labels above
        // planets in the foreshortened ground-level view.

        // ── Render: multi-viewport during collinear, single otherwise ──
        if (multiViewActive) {
            renderMultiView();
        } else {
            // Reset viewport to full canvas (was left at PIP size after last multi-view)
            const w = canvas.clientWidth, h = canvas.clientHeight;
            const pixelRatio = renderer.getPixelRatio();
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, w * pixelRatio, h * pixelRatio);
            renderer.render(scene, camera);
        }
    }
    animate();

    // ═══════════════════ Multi-View Rendering ═══════════════════

    /** Map viewMode (1/2/3) to { main, corner1, corner2 } cameras */
    function getViewCameras() {
        if (viewMode === 2) return { main: northCam, c1: camera, c2: southCam, mainLabel: 'NORTH POLE', c1Label: 'ORBITAL', c2Label: 'SOUTH POLE' };
        if (viewMode === 3) return { main: southCam, c1: camera, c2: northCam, mainLabel: 'SOUTH POLE', c1Label: 'ORBITAL', c2Label: 'NORTH POLE' };
        return { main: camera, c1: northCam, c2: southCam, mainLabel: 'ORBITAL', c1Label: 'NORTH POLE', c2Label: 'SOUTH POLE' };
    }

    /** Render scene 3× with viewport/scissor for main + 2 corner PIPs */
    function renderMultiView() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const pixelRatio = renderer.getPixelRatio();
        const rw = w * pixelRatio;
        const rh = h * pixelRatio;

        const cams = getViewCameras();

        // PIP dimensions (20% of canvas width, 16:9-ish aspect)
        const pipW = Math.floor(rw * 0.22);
        const pipH = Math.floor(pipW * 0.625);
        const pad = Math.floor(8 * pixelRatio);

        renderer.setScissorTest(true);

        // 1. Main view (full canvas)
        renderer.setViewport(0, 0, rw, rh);
        renderer.setScissor(0, 0, rw, rh);
        renderer.render(scene, cams.main);

        // 2. Corner 1 — top-right
        const c1x = rw - pipW - pad;
        const c1y = rh - pipH - pad;
        renderer.setViewport(c1x, c1y, pipW, pipH);
        renderer.setScissor(c1x, c1y, pipW, pipH);
        renderer.render(scene, cams.c1);

        // 3. Corner 2 — bottom-right (below corner 1)
        const c2x = rw - pipW - pad;
        const c2y = c1y - pipH - pad;
        renderer.setViewport(c2x, c2y, pipW, pipH);
        renderer.setScissor(c2x, c2y, pipW, pipH);
        renderer.render(scene, cams.c2);

        renderer.setScissorTest(false);

        // Update PIP overlay label positions
        viewUI.updatePIPPositions(w, h, pipW / pixelRatio, pipH / pixelRatio, pad / pixelRatio, cams);
    }

    // ═══════════════════ Public API ═══════════════════

    function setYear(year) {
        currentYear = year;
        const cfg = planetaryConfigs.find(c => year >= c.yearStart && year <= c.yearEnd);
        if (!cfg) return;

        scene.background = new THREE.Color(cfg.skyColor);
        const yl = cfg.yearLength || 365;
        const elapsed = year - cfg.yearStart;

        // ── Determine orbital style ──
        const darkAgeConfigs = ['breakup', 'round-table', 'deluge', 'post-deluge', 'venus-returns', 'stabilization'];
        const isDarkAge = darkAgeConfigs.includes(cfg.id);
        let style = 'none';
        if (cfg.id === 'golden-age') style = 'collinear';
        else if (isDarkAge) style = 'darkAge';
        else if (cfg.id === 'modern-solar') style = 'modern';

        if (style !== curStyle) {
            setGroupVis(oLines.collinear, style === 'collinear');
            setGroupVis(oLines.roundTable, style === 'darkAge' || style === 'roundTable');
            setGroupVis(oLines.modern, style === 'modern');
            curStyle = style;

            // Multi-view: only active during collinear (Golden Age)
            multiViewActive = (style === 'collinear');
            viewUI.setVisible(multiViewActive);

            if (style === 'collinear') {
                camPosGoal.set(0, 22, 28);
                camLookGoal.set(0, 0, 0);
            } else if (style === 'darkAge' || style === 'roundTable') {
                camPosGoal.set(0, 22, 22);
                camLookGoal.set(0, 0, 0);
            } else if (style === 'modern') {
                camPosGoal.set(0, 30, 30);
                camLookGoal.set(0, 0, 0);
            } else {
                camPosGoal.set(0, 8, 22);
                camLookGoal.set(0, 1, 0);
            }
        }

        // ── Sun visibility ──
        // Sun visible during Golden Age at center of the system
        // Hidden only before 4077 BC (before creation)
        const sunVisible = (year >= -4077);
        p.sun.visible = sunVisible;
        L.sun.visible = sunVisible;
        sunLight.intensity = sunVisible ? 3.0 : 0.6; // dim ambient when hidden

        // ── Position by style ──
        if (style === 'collinear') placeCollinear(elapsed, cfg);
        else if (style === 'darkAge') placeDarkAge(elapsed, cfg);
        else if (style === 'roundTable') placeRoundTable(elapsed, cfg);
        else if (style === 'modern') placeModern(elapsed, cfg);
        else placeFallback(cfg);

        if (style !== 'modern' && p.pluto) {
            p.pluto.visible = false;
            L.pluto.visible = false;
        }

        // ═══════════ PLANET ANIMATION STATE PER PHASE ═══════════

        // ── Saturn: hidden in Dark Age (no longer seen); Wheel of Heaven + ring transition otherwise ──
        if (style === 'darkAge') {
            p.saturn.visible = false;
            L.saturn.visible = false;
            p.saturnGlow.visible = false;
            p.saturnRings.visible = false;
            p.wheelOfHeaven.visible = false;  // Wheel of Heaven (spoked star near Sun) — Golden Age only
        } else {
            updateSaturnPhase(p, cfg, year, elapsed);
        }

        // ── Venus: plasmoid star / comet / dragon ──
        updateVenusPhase(p, cfg, year, elapsed);

        // ── Mars: solid sphere / outer shell / explosion ──
        updateMarsPhase(p, cfg, year, elapsed);

        // ── Dragon tether (Venus ↔ Mars) ──
        updateDragonTetherPhase(p, cfg, year);

        // ── Birkeland currents (collinear phase only) ──
        updateBirkelandPhase(p, cfg, style);

        // ── Moon ──
        if (year >= MOON_CAPTURE_YEAR && p.earth.visible) {
            p.moon.visible = true;
            L.moon.visible = true;
            let moonAngle;
            if (style === 'darkAge') {
                // Dark Age: Moon orbits Earth once per month (period = 1/12 year)
                moonAngle = (elapsed / DA.moonPeriod) * Math.PI * 2;
            } else {
                const frac = Math.min(1, (year - MOON_CAPTURE_YEAR) / (-670 - MOON_CAPTURE_YEAR));
                const periodDays = 10 + (27.3 - 10) * frac;
                const daysElapsed = (year - MOON_CAPTURE_YEAR) * yl;
                moonAngle = (daysElapsed / periodDays) * Math.PI * 2;
            }
            p.moon.position.set(
                p.earth.position.x + MOON_ORBIT_RADIUS * Math.cos(moonAngle),
                p.earth.position.y + MOON_ORBIT_RADIUS * Math.sin(moonAngle) * 0.25,
                p.earth.position.z + MOON_ORBIT_RADIUS * Math.sin(moonAngle)
            );
        } else {
            p.moon.visible = false;
            L.moon.visible = false;
        }

        // ── Plasma field (Absu) ──
        plasma.visible = (year < -806);
        if (plasma.visible) {
            plasma.material.opacity = Math.max(0, Math.min(1, (-year - 670) / 2477)) * 0.6;
        }

        // ── Orbit counts ──
        orbitCounts = {};
        if (style === 'collinear') {
            orbitCounts.column = Math.abs(elapsed); // entire column orbits once per Earth year
            orbitCounts.earth = Math.abs(elapsed);
        } else if (style === 'darkAge') {
            orbitCounts['solar orbit'] = Math.abs(elapsed / DA.solarPeriod);
            orbitCounts['circle rotation'] = Math.abs(elapsed / DA.internalPeriod);
        } else if (style === 'roundTable') {
            orbitCounts['solar orbit'] = Math.abs(elapsed / RT.solarPeriod);
            orbitCounts['internal rot'] = Math.abs(elapsed / RT.internalPeriod);
        } else if (style === 'modern') {
            orbitCounts.mercury = Math.abs(elapsed / 0.24);
            orbitCounts.venus = Math.abs(elapsed / 0.615);
            orbitCounts.earth = Math.abs(elapsed);
            orbitCounts.mars = Math.abs(elapsed / 1.88);
            orbitCounts.jupiter = Math.abs(elapsed / 11.86);
            orbitCounts.saturn = Math.abs(elapsed / 29.46);
            orbitCounts.uranus = Math.abs(elapsed / 84);
            orbitCounts.neptune = Math.abs(elapsed / 164);
            orbitCounts.pluto = Math.abs(elapsed / 248);
        }
        if (year >= MOON_CAPTURE_YEAR) {
            if (style === 'darkAge') {
                orbitCounts.moon = Math.abs(elapsed / DA.moonPeriod);
            } else {
                const frac = Math.min(1, (year - MOON_CAPTURE_YEAR) / (-670 - MOON_CAPTURE_YEAR));
                const periodDays = 10 + (27.3 - 10) * frac;
                orbitCounts.moon = Math.abs((year - MOON_CAPTURE_YEAR) * yl / periodDays);
            }
        }

        // ── Update HUD overlay ──
        updateHUD();
    }

    // ═══════ Phase update helpers (called from setYear) ═══════

    /** Saturn: Wheel of Heaven in golden age; rings animate in stabilization */
    function updateSaturnPhase(p, cfg, year, elapsed) {
        // Wheel of Heaven — only visible in golden-age
        p.wheelOfHeaven.visible = (cfg.id === 'golden-age');
        if (p.wheelOfHeaven.visible) {
            // Position wheel BEHIND Saturn along the column toward Sun
            // (the polar view = looking up the column from Earth toward Saturn)
            const satPos = p.saturn.position;
            // Shift it toward the Sun (inward along column) so it appears as a backdrop
            const toSun = satPos.clone().normalize().multiplyScalar(-1.5);
            p.wheelOfHeaven.position.copy(satPos).add(toSun);
            p.wheelOfHeaven.position.y += 0.1;
            // Make the wheel face the camera
            p.wheelOfHeaven.lookAt(camera.position);
        }

        // Ring fade-in during stabilization (-806 to -670)
        if (cfg.id === 'stabilization') {
            const dur = cfg.yearEnd - cfg.yearStart; // 136 years
            const progress = Math.min(1, elapsed / dur);
            p.saturnRings.material.opacity = progress * 0.5;
            // Color shifts from orange to golden-yellow
            const c = new THREE.Color(0xff8833).lerp(new THREE.Color(0xccaa66), progress);
            p.saturn.material.color.copy(c);
            p.saturn.material.emissive.copy(c);
        } else if (cfg.id === 'modern-solar') {
            p.saturnRings.material.opacity = 0.5;
        }
        // Glow intensity per phase
        if (cfg.saturn) {
            p.saturnGlow.material.opacity = (cfg.saturn.glow || 0.05) * 0.6;
        }
    }

    /** Venus: plasmoid star (golden-age), comet (round-table/deluge), dragon (venus-returns), planet (modern) */
    function updateVenusPhase(p, cfg, year, elapsed) {
        const id = cfg.id;
        const isGolden = (id === 'golden-age');
        const isBreakup = (id === 'breakup');
        const isComet = (id === 'round-table' || id === 'deluge');
        const isDragon = (id === 'venus-returns');
        const isCalming = (id === 'stabilization');
        const isModern = (id === 'modern-solar');
        const isDormant = (id === 'post-deluge');

        // Plasmoid star only in Golden Age; in Dark Age show Venus as sphere on the circle (no star)
        const showPlasmoidStar = (curStyle !== 'darkAge') && (isGolden || isBreakup);
        p.venusStar.visible = showPlasmoidStar;
        if (p.venusStarGlow) p.venusStarGlow.visible = showPlasmoidStar;
        if (isGolden) {
            p.venusStar.material.color.set(0xffffff);
            p.venusStar.material.emissive.set(0xffffff);
            p.venusStar.material.emissiveIntensity = 1.0;
        } else if (isBreakup) {
            // Destabilizing: flicker, color shift
            p.venusStar.material.color.set(0xffee88);
            p.venusStar.material.emissive.set(0xffee88);
            p.venusStar.material.emissiveIntensity = 0.5 + 0.5 * Math.random();
        }

        // Comet tail
        p.cometTail.visible = isComet || isDragon || isCalming;
        if (isComet) {
            p.cometTail.material.color.set(id === 'deluge' ? 0xff4444 : 0xaaff88);
            p.cometTail.material.opacity = 0.5;
        } else if (isDragon) {
            p.cometTail.material.color.set(0x44ff88); // green-white writhing
            p.cometTail.material.opacity = 0.6;
        } else if (isCalming) {
            // Tail shrinking
            const dur = cfg.yearEnd - cfg.yearStart;
            const progress = Math.min(1, elapsed / dur);
            p.cometTail.material.opacity = 0.5 * (1 - progress);
        }

        // Standard sphere Venus — hide when star shown (except in Dark Age: show sphere on circle)
        if (isGolden || isBreakup) {
            p.venus.visible = (curStyle === 'darkAge') && !!cfg.venus;
            p.venusGlow.visible = (curStyle === 'darkAge') && !!cfg.venus;
        } else if (isDormant) {
            p.venus.visible = true;
            p.venusGlow.visible = false;
            p.venus.material.emissiveIntensity = 0.1;
            p.venus.material.color.set(0x888844);
        } else if (isModern) {
            p.venus.visible = !!cfg.venus;
            p.venusGlow.visible = !!cfg.venus;
            p.venus.material.color.set(0xffcc88);
            p.venus.material.emissive.set(0xaa8844);
            p.venus.material.emissiveIntensity = 0.3;
        } else {
            // comet / dragon / calming phases — sphere visible with glow
            if (cfg.venus) {
                p.venus.visible = true;
                p.venusGlow.visible = true;
                p.venus.material.color.set(cfg.venus.color || 0x33ff77);
                p.venus.material.emissive.set(cfg.venus.color || 0x22cc55);
                p.venus.material.emissiveIntensity = isDragon ? 0.8 : 0.6;
            }
        }

        // Sync Venus star position to Venus sphere position (golden-age / breakup)
        if (p.venusStar.visible) {
            if (curStyle === 'darkAge') {
                // Dark Age: placeDarkAge already set p.venus.position on the circle
                p.venusStar.position.copy(p.venus.position);
            } else if (curStyle !== 'collinear') {
                if (p.venus.visible) {
                    p.venusStar.position.copy(p.venus.position);
                } else if (cfg.venus?.position) {
                    p.venusStar.position.set(cfg.venus.position[0], cfg.venus.position[1], cfg.venus.position[2]);
                }
            }
        }
    }

    /** Mars: solid sphere always, outer shell in dark-age, explosion at stabilization */
    function updateMarsPhase(p, cfg, year, elapsed) {
        const id = cfg.id;

        // Mars outer shell — visible from round-table through venus-returns
        const shellPhases = ['round-table', 'deluge', 'post-deluge', 'venus-returns'];
        const showShell = shellPhases.includes(id);
        p.marsShell.visible = showShell;

        if (showShell) {
            // Shell follows Mars position
            p.marsShell.position.copy(p.mars.position);

            if (id === 'venus-returns') {
                // Stress fractures — shell glowing with cracks
                p.marsShell.userData.stressed = true;
                p.marsShell.material.emissive.set(0xff4400);
                p.marsShell.material.opacity = 0.25;
            } else if (id === 'deluge') {
                // Close approach — shell glows red from discharge
                p.marsShell.userData.stressed = false;
                p.marsShell.material.emissive.set(0xcc2200);
                p.marsShell.material.emissiveIntensity = 0.5;
                p.marsShell.material.opacity = 0.2;
            } else {
                p.marsShell.userData.stressed = false;
                p.marsShell.material.emissive.set(0x883300);
                p.marsShell.material.emissiveIntensity = 0.15;
                p.marsShell.material.opacity = 0.15;
            }
        }

        // Shell explosion fragments — visible during stabilization
        const showFragments = (id === 'stabilization');
        p.marsFragments.visible = showFragments;
        if (showFragments) {
            // Set explosion origin to Mars position
            p.marsFragments.userData.origin = p.mars.position.clone();
            // Progress of explosion (0→1 over the stabilization period)
            const dur = cfg.yearEnd - cfg.yearStart;
            p.marsFragments.userData.progress = Math.min(1, elapsed / dur);

            // Mars becomes smaller + darker after losing shell
            const shellLoss = Math.min(1, elapsed / dur);
            p.mars.scale.setScalar(1.0 - shellLoss * 0.3); // shrinks to 0.7
            p.mars.material.color.set(
                new THREE.Color(0xff4422).lerp(new THREE.Color(0x993311), shellLoss)
            );
        } else if (id === 'modern-solar') {
            // Modern Mars — smaller, darker
            p.mars.scale.setScalar(0.7);
            p.mars.material.color.set(0x993311);
        } else {
            p.mars.scale.setScalar(1.0);
        }
    }

    /** Dragon tether (Venus ↔ Mars electric arc) — visible in venus-returns phase */
    function updateDragonTetherPhase(p, cfg, year) {
        const show = (cfg.id === 'venus-returns');
        p.dragonTether.visible = show;
        if (show && p.venus.visible && p.mars.visible) {
            p.dragonTether.userData.venusPos = p.venus.position.clone();
            p.dragonTether.userData.marsPos = p.mars.position.clone();
        }
    }

    /** Birkeland currents — visible in collinear (golden-age) */
    function updateBirkelandPhase(p, cfg, style) {
        p.birkelandCurrents.visible = (style === 'collinear');
    }

    // ── Collinear placement ──
    // The column is a rigid bar pointing radially toward the Sun.
    // It orbits Sun at radius COL.R in the XZ plane (y=0).
    // Each planet sits along the radial direction at its 'dist' from Sun.
    function placeCollinear(elapsed, cfg) {
        const angle = (elapsed / COL.period) * Math.PI * 2;
        // Unit vector pointing from Sun toward the column (outward)
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);

        p.sun.position.set(0, 0, 0);
        sunLight.position.set(0, 0, 0);

        // Helper: place planet along the radial line at distance 'dist' from Sun
        const placeOnColumn = (mesh, label, dist, show) => {
            if (show) {
                mesh.visible = true;
                if (label) label.visible = true;
                mesh.position.set(dx * dist, 0, dz * dist);
            } else {
                mesh.visible = false;
                if (label) label.visible = false;
            }
        };

        // Column order from Sun outward: Jupiter → Saturn → Venus → Mars → Earth → Mercury → …
        placeOnColumn(p.jupiter, L.jupiter, COL.jupiter.dist, true);
        placeOnColumn(p.saturn, L.saturn, COL.saturn.dist, true);
        p.saturnGlow.material.opacity = (cfg.saturn?.glow || 0.5) * 0.3;
        // No rings during Golden Age
        p.saturnRings.visible = !!cfg.saturn?.rings;
        p.saturnRings.material.opacity = cfg.saturn?.rings ? 0.5 : 0;

        placeOnColumn(p.venus, L.venus, COL.venus.dist, !!cfg.venus);
        // Venus star tracks Venus position on the column
        if (p.venusStar?.visible) {
            p.venusStar.position.set(dx * COL.venus.dist, 0, dz * COL.venus.dist);
        }

        // Mars oscillation: gentle bobbing along the column axis
        // Per Saturnian cosmology, Mars oscillated (approached/receded) in the polar column
        const marsOscillation = 0.4 * Math.sin(elapsed * 0.8);
        const marsDist = COL.mars.dist + marsOscillation;
        placeOnColumn(p.mars, L.mars, marsDist, !!cfg.mars);

        placeOnColumn(p.earth, L.earth, COL.earth.dist, !!cfg.earth);
        placeOnColumn(p.mercury, L.mercury, COL.mercury.dist, true);
        placeOnColumn(p.neptune, L.neptune, COL.neptune.dist, true);
        placeOnColumn(p.uranus, L.uranus, COL.uranus.dist, true);
    }

    // ── Round Table placement ──
    // Saturn has left to outer solar system. Jupiter, Venus, Mars, Earth
    // orbit an EMPTY invisible barycenter. No planet at center.
    // Internal rotation: clockwise. Solar orbit: counterclockwise.
    // Both synchronous = 1 year. Mars oscillates (unstable).
    function placeRoundTable(elapsed, cfg) {
        // Solar orbit angle (counterclockwise = positive)
        const solarAngle = (elapsed / RT.solarPeriod) * Math.PI * 2;
        // Internal rotation angle (clockwise = negative direction)
        const intAngle = -(elapsed / RT.internalPeriod) * Math.PI * 2;

        // Barycenter position orbiting the Sun
        const bcX = RT.sunDist * Math.cos(solarAngle);
        const bcZ = RT.sunDist * Math.sin(solarAngle);

        // Sun at origin
        p.sun.position.set(0, 0, 0);
        sunLight.position.set(0, 0, 0);

        // Place planet on the internal circle around the empty barycenter
        const placeRT = (mesh, label, r, angleOffset, show) => {
            if (!show) { mesh.visible = false; if (label) label.visible = false; return; }
            mesh.visible = true; if (label) label.visible = true;
            const a = intAngle + angleOffset;
            mesh.position.set(
                bcX + r * Math.cos(a),
                0,
                bcZ + r * Math.sin(a)
            );
        };

        // Jupiter: opposite side of barycenter (carries most mass)
        placeRT(p.jupiter, L.jupiter, RT.jupiter.r, Math.PI, true);

        // Venus: inner-planets side
        placeRT(p.venus, L.venus, RT.venus.r, 0.3, !!cfg.venus);

        // Mars: unstable oscillator — wobbles between Venus and Earth
        const marsProgress = Math.min(1, Math.abs(elapsed) / 700);
        const marsWobble = marsProgress * 0.8 * Math.sin(elapsed * 0.15);
        placeRT(p.mars, L.mars, RT.mars.r, -0.25 + marsWobble, !!cfg.mars);

        // Earth: outermost on the inner-planets side
        placeRT(p.earth, L.earth, RT.earth.r, -0.5, !!cfg.earth);

        // Saturn: fled to outer solar system — visible but dim and far away
        p.saturn.visible = true; L.saturn.visible = true;
        p.saturn.position.set(...RT.saturnFarPos);
        p.saturnGlow.material.opacity = 0.1;
        p.saturnRings.material.opacity = 0;

        // Mercury, Neptune, Uranus: not part of round table, hide
        p.mercury.visible = false; L.mercury.visible = false;
        p.neptune.visible = false; L.neptune.visible = false;
        p.uranus.visible = false; L.uranus.visible = false;
    }

    // ── Dark Age placement (-3147 to -670) ──
    // Saturn hidden (no longer seen). Earth, Venus, Mars, Mercury, Jupiter form a circle
    // with nothing in center. Circle rotates 4x/year. Circle orbits Sun once per year.
    function placeDarkAge(elapsed, cfg) {
        const solarAngle = (elapsed / DA.solarPeriod) * Math.PI * 2;
        const intAngle = (elapsed / DA.internalPeriod) * Math.PI * 2;  // 4 rotations per year

        const bcX = DA.sunDist * Math.cos(solarAngle);
        const bcZ = DA.sunDist * Math.sin(solarAngle);

        p.sun.position.set(0, 0, 0);
        sunLight.position.set(0, 0, 0);

        const placeDA = (mesh, label, angleOffset, show) => {
            if (!show) { mesh.visible = false; if (label) label.visible = false; return; }
            mesh.visible = true; if (label) label.visible = true;
            const a = intAngle + angleOffset;
            mesh.position.set(
                bcX + DA.circleRadius * Math.cos(a),
                0,
                bcZ + DA.circleRadius * Math.sin(a)
            );
        };

        placeDA(p.earth, L.earth, 0, !!cfg.earth);
        placeDA(p.venus, L.venus, (2 * Math.PI / 5) * 1, !!cfg.venus);
        placeDA(p.mars, L.mars, (2 * Math.PI / 5) * 2, !!cfg.mars);
        placeDA(p.mercury, L.mercury, (2 * Math.PI / 5) * 3, true);
        placeDA(p.jupiter, L.jupiter, (2 * Math.PI / 5) * 4, true);  // always show Jupiter in Dark Age circle

        if (p.venusStar?.visible) p.venusStar.position.copy(p.venus.position);

        p.neptune.visible = false; L.neptune.visible = false;
        p.uranus.visible = false; L.uranus.visible = false;
    }

    // ── Modern placement (concentric around Sun) ──
    function placeModern(elapsed, cfg) {
        p.sun.position.set(0, 0, 0);
        sunLight.position.set(0, 0, 0);

        const placeCircle = (mesh, label, def, show) => {
            if (!show) { mesh.visible = false; if (label) label.visible = false; return; }
            mesh.visible = true; if (label) label.visible = true;
            const a = (elapsed / def.period) * Math.PI * 2;
            mesh.position.set(def.r * Math.cos(a), 0, def.r * Math.sin(a));
        };

        placeCircle(p.mercury, L.mercury, MOD.mercury, true);
        placeCircle(p.venus, L.venus, MOD.venus, !!cfg.venus);
        placeCircle(p.earth, L.earth, MOD.earth, !!cfg.earth);
        placeCircle(p.mars, L.mars, MOD.mars, !!cfg.mars);
        placeCircle(p.jupiter, L.jupiter, MOD.jupiter, !!cfg.jupiter);
        placeCircle(p.saturn, L.saturn, MOD.saturn, !!cfg.saturn);
        if (cfg.saturn) {
            p.saturnGlow.material.opacity = (cfg.saturn.glow || 0.05) * 0.6;
            p.saturnRings.material.opacity = cfg.saturn.rings ? 0.5 : 0;
        }
        placeCircle(p.uranus, L.uranus, MOD.uranus, true);
        placeCircle(p.neptune, L.neptune, MOD.neptune, true);
        placeCircle(p.pluto, L.pluto, MOD.pluto, true);
    }

    // ── Fallback: transitional / chaotic phases ──
    function placeFallback(cfg) {
        // Sun is hidden before -4077 (set in setYear); enforce here too
        const sunVis = currentYear >= -4077;
        p.sun.visible = sunVis;
        L.sun.visible = sunVis;
        sunLight.intensity = sunVis ? 3.0 : 0;
        p.sun.position.set(0, -3, -5);
        sunLight.position.set(0, -3, -5);

        const lerp = (mesh, pos) => {
            if (!pos) return;
            mesh.position.lerp(new THREE.Vector3(pos[0], pos[1], pos[2]), 0.05);
        };

        if (cfg.saturn) {
            p.saturn.visible = true; L.saturn.visible = true;
            lerp(p.saturn, cfg.saturn.position);
            p.saturnGlow.material.opacity = (cfg.saturn.glow || 0.3) * 0.6;
            p.saturnRings.material.opacity = cfg.saturn.rings ? 0.5 : 0;
        }
        if (cfg.venus) { p.venus.visible = true; L.venus.visible = true; lerp(p.venus, cfg.venus.position); }
        else { p.venus.visible = false; L.venus.visible = false; }
        if (cfg.mars) { p.mars.visible = true; L.mars.visible = true; lerp(p.mars, cfg.mars.position); }
        else { p.mars.visible = false; L.mars.visible = false; }
        if (cfg.earth) { p.earth.visible = true; L.earth.visible = true; lerp(p.earth, cfg.earth.position); }
        else { p.earth.visible = false; L.earth.visible = false; }
        if (cfg.jupiter) { p.jupiter.visible = true; L.jupiter.visible = true; lerp(p.jupiter, cfg.jupiter.position); }
        else { p.jupiter.visible = false; L.jupiter.visible = false; }
        // Mercury, Neptune, Uranus — hide in chaotic phases
        p.mercury.visible = false; L.mercury.visible = false;
        p.neptune.visible = false; L.neptune.visible = false;
        p.uranus.visible = false; L.uranus.visible = false;
    }

    function getPhaseInfo() {
        const c = planetaryConfigs.find(c => currentYear >= c.yearStart && currentYear <= c.yearEnd);
        return c ? { label: c.label, description: c.description } : { label: '', description: '' };
    }

    function getOrbitInfo() { return { ...orbitCounts }; }

    /** Update the HUD text from current state */
    function updateHUD() {
        const cfg = planetaryConfigs.find(c => currentYear >= c.yearStart && currentYear <= c.yearEnd);
        const yearStr = formatYear(currentYear);
        const label = cfg ? cfg.label : '';
        const desc = cfg ? cfg.description : '';
        // Find nearest event
        const bcEvents = timelineEvents.filter(e => e.type === 'planetary' || e.type === 'blip');
        let nearest = null;
        let nearestDist = Infinity;
        for (const e of bcEvents) {
            const d = Math.abs(e.year - currentYear);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        const evtStr = (nearest && nearestDist <= 60) ? nearest.title : '';
        const orbitStr = Object.entries(orbitCounts)
            .map(([k, v]) => `${k}: ${v.toFixed(1)}`)
            .join(' · ');
        hud.update(yearStr, label, desc, evtStr, orbitStr);
    }

    function resize() {
        doResize();
    }

    function destroy() {
        if (animId) cancelAnimationFrame(animId);
        window.removeEventListener('resize', doResize);
        window.removeEventListener('keydown', onKeyDown);
        if (resizeObserver) resizeObserver.disconnect();
        hud.remove();
        viewUI.remove();
        renderer.dispose();
    }

    function setViewMode(mode) {
        if (mode >= 1 && mode <= 3) {
            viewMode = mode;
            viewUI.setActive(viewMode);
        }
    }

    return { setYear, getPhaseInfo, getOrbitInfo, setViewMode, resize, destroy };
}

// ═══════════════════ Helper Functions ═══════════════════

/**
 * Build an HTML HUD overlay positioned at bottom of the canvas.
 * Returns { update(year, label, desc, event, orbits?), remove() }.
 */
function buildHUD(canvas) {
    // Ensure we have a positioned container around the canvas
    let parent = canvas.parentElement;
    if (parent) {
        const pos = getComputedStyle(parent).position;
        if (pos === 'static' || !pos) parent.style.position = 'relative';
    }
    // If parent isn't available, fall back to document.body
    const container = parent || document.body;

    const el = document.createElement('div');
    el.className = 'planet-hud';
    Object.assign(el.style, {
        position: 'absolute',
        bottom: '0', left: '0', right: '0',
        zIndex: '900',
        padding: '10px 14px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
        pointerEvents: 'none',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        color: '#e0e0e0',
    });

    // Work in progress badge (bottom-right)
    const wipEl = document.createElement('div');
    Object.assign(wipEl.style, {
        position: 'absolute',
        bottom: '10px', right: '14px',
        fontSize: '11px',
        color: '#94a3b8',
        opacity: '0.9',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    });
    wipEl.innerHTML = '&#128295;&#65039; Work in progress';  // wrench emoji + text
    el.appendChild(wipEl);

    const yearEl = document.createElement('div');
    Object.assign(yearEl.style, {
        fontSize: '22px', fontWeight: '700',
        color: '#c084fc', fontVariantNumeric: 'tabular-nums',
        lineHeight: '1.2',
    });

    const labelEl = document.createElement('div');
    Object.assign(labelEl.style, {
        fontSize: '13px', fontWeight: '600',
        color: '#e2e8f0', marginTop: '2px',
    });

    const descEl = document.createElement('div');
    Object.assign(descEl.style, {
        fontSize: '11px', color: '#94a3b8',
        marginTop: '3px', lineHeight: '1.4',
        maxWidth: '420px',
    });

    const eventEl = document.createElement('div');
    Object.assign(eventEl.style, {
        fontSize: '11px', color: '#d8b4fe',
        marginTop: '3px', opacity: '0.85',
    });

    const orbitEl = document.createElement('div');
    Object.assign(orbitEl.style, {
        fontSize: '10px', color: '#94a3b8',
        marginTop: '4px', fontVariantNumeric: 'tabular-nums',
        opacity: '0.9',
    });

    el.appendChild(yearEl);
    el.appendChild(labelEl);
    el.appendChild(descEl);
    el.appendChild(eventEl);
    el.appendChild(orbitEl);
    container.appendChild(el);

    let lastText = '';
    return {
        update(yearStr, label, desc, evtTitle, orbitStr = '') {
            const key = yearStr + label + orbitStr;
            if (key === lastText) return; // avoid unnecessary DOM writes
            lastText = key;
            yearEl.textContent = yearStr;
            labelEl.textContent = label;
            descEl.textContent = desc;
            eventEl.textContent = evtTitle;
            orbitEl.textContent = orbitStr;
        },
        remove() {
            el.remove();
        },
    };
}

/**
 * Build the multi-view toggle UI (HTML overlay on canvas).
 * Shows 3 mode buttons + PIP border/labels during collinear phase.
 * Returns { setVisible(bool), setActive(mode), updatePIPPositions(...), remove() }.
 */
function buildViewToggleUI(canvas, onModeChange) {
    let parent = canvas.parentElement;
    if (parent) {
        const pos = getComputedStyle(parent).position;
        if (pos === 'static' || !pos) parent.style.position = 'relative';
    }
    const container = parent || document.body;

    // ── Toggle button bar (top-left, below HUD) ──
    const bar = document.createElement('div');
    bar.className = 'view-toggle-bar';
    Object.assign(bar.style, {
        position: 'absolute',
        bottom: '12px', left: '12px',
        zIndex: '910',
        display: 'none', // hidden until collinear
        gap: '4px',
        pointerEvents: 'auto',
    });
    bar.style.display = 'none';

    const btnStyle = {
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        border: '1px solid rgba(96, 165, 250, 0.4)',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.6)',
        color: '#94a3b8',
        cursor: 'pointer',
        transition: 'all 0.15s',
    };
    const activeBtnStyle = {
        background: 'rgba(96, 165, 250, 0.2)',
        color: '#e0f2fe',
        borderColor: 'rgba(96, 165, 250, 0.8)',
    };

    const buttons = [];
    const labels = ['1: Orbital', '2: North', '3: South'];
    for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.textContent = labels[i];
        Object.assign(btn.style, btnStyle);
        if (i === 0) Object.assign(btn.style, activeBtnStyle);
        btn.addEventListener('click', () => {
            onModeChange(i + 1);
            setActive(i + 1);
        });
        bar.appendChild(btn);
        buttons.push(btn);
    }
    container.appendChild(bar);

    // ── PIP border overlays + labels ──
    const pip1Border = document.createElement('div');
    const pip2Border = document.createElement('div');
    const pip1Label = document.createElement('div');
    const pip2Label = document.createElement('div');

    const pipBorderStyle = {
        position: 'absolute',
        zIndex: '905',
        border: '1px solid rgba(96, 165, 250, 0.5)',
        borderRadius: '4px',
        pointerEvents: 'none',
        display: 'none',
        boxShadow: '0 0 8px rgba(96, 165, 250, 0.15)',
    };
    Object.assign(pip1Border.style, pipBorderStyle);
    Object.assign(pip2Border.style, pipBorderStyle);

    const pipLabelStyle = {
        position: 'absolute',
        zIndex: '906',
        fontSize: '9px',
        fontWeight: '600',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: 'rgba(148, 163, 184, 0.8)',
        pointerEvents: 'none',
        display: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        letterSpacing: '0.5px',
    };
    Object.assign(pip1Label.style, pipLabelStyle);
    Object.assign(pip2Label.style, pipLabelStyle);

    container.appendChild(pip1Border);
    container.appendChild(pip2Border);
    container.appendChild(pip1Label);
    container.appendChild(pip2Label);

    function setActive(mode) {
        for (let i = 0; i < 3; i++) {
            if (i === mode - 1) {
                Object.assign(buttons[i].style, activeBtnStyle);
            } else {
                Object.assign(buttons[i].style, {
                    background: 'rgba(0,0,0,0.6)',
                    color: '#94a3b8',
                    borderColor: 'rgba(96, 165, 250, 0.4)',
                });
            }
        }
    }

    function setVisible(visible) {
        const disp = visible ? 'flex' : 'none';
        bar.style.display = disp;
        const pipDisp = visible ? 'block' : 'none';
        pip1Border.style.display = pipDisp;
        pip2Border.style.display = pipDisp;
        pip1Label.style.display = pipDisp;
        pip2Label.style.display = pipDisp;
    }

    /**
     * Update PIP overlay positions to match the Three.js viewports.
     * CSS coords are from top-left; Three.js viewport coords are from bottom-left.
     */
    function updatePIPPositions(canvasW, canvasH, pipW, pipH, pad, cams) {
        // PIP 1: top-right corner
        const p1Left = canvasW - pipW - pad;
        const p1Top = pad;
        Object.assign(pip1Border.style, {
            left: p1Left + 'px', top: p1Top + 'px',
            width: pipW + 'px', height: pipH + 'px',
        });
        Object.assign(pip1Label.style, {
            left: (p1Left + 4) + 'px', top: (p1Top + 2) + 'px',
        });
        pip1Label.textContent = cams.c1Label;

        // PIP 2: below PIP 1
        const p2Top = p1Top + pipH + pad;
        Object.assign(pip2Border.style, {
            left: p1Left + 'px', top: p2Top + 'px',
            width: pipW + 'px', height: pipH + 'px',
        });
        Object.assign(pip2Label.style, {
            left: (p1Left + 4) + 'px', top: (p2Top + 2) + 'px',
        });
        pip2Label.textContent = cams.c2Label;
    }

    return {
        setVisible, setActive, updatePIPPositions, remove() {
            bar.remove();
            pip1Border.remove(); pip2Border.remove();
            pip1Label.remove(); pip2Label.remove();
        }
    };
}

function buildLabel(text, color, THREE) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = 256; c.height = 64;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false,
    }));
    sprite.scale.set(2.5, 0.6, 1);
    sprite.visible = false;
    return sprite;
}

function syncLabel(label, mesh, offset, camera) {
    if (!label?.visible || !mesh?.visible) return;
    label.position.set(mesh.position.x, mesh.position.y + offset, mesh.position.z);
    label.quaternion.copy(camera.quaternion);
}

function makeLine(pts, color, opacity, THREE) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return new THREE.Line(geo, mat);
}

function setGroupVis(group, vis) {
    if (Array.isArray(group)) group.forEach(l => { l.visible = vis; });
    else if (group) group.visible = vis;
}

/** Collinear: single orbit circle at radius COL.R in XZ plane */
function buildCollinearPaths(scene, THREE) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(COL.R * Math.cos(a), 0, COL.R * Math.sin(a)));
    }
    const line = makeLine(pts, 0xff8833, 0.3, THREE);
    scene.add(line);
    return [line];
}

/** Round Table (Grubaugh): single circle for the array's solar orbit */
function buildRoundTablePaths(scene, THREE) {
    const lines = [];
    // Main solar orbit of the barycenter
    const pts = [];
    for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(RT.sunDist * Math.cos(a), 0, RT.sunDist * Math.sin(a)));
    }
    const line = makeLine(pts, 0xffaa44, 0.25, THREE);
    scene.add(line);
    lines.push(line);
    return lines;
}

/** Modern: concentric circles in XZ plane */
function buildModernPaths(scene, THREE) {
    const lines = [];
    const defs = [
        { r: MOD.mercury.r, color: 0xbbaa88 },
        { r: MOD.venus.r, color: 0x33ff77 },
        { r: MOD.earth.r, color: 0x66aaff },
        { r: MOD.mars.r, color: 0xff6644 },
        { r: MOD.jupiter.r, color: 0xffaa44 },
        { r: MOD.saturn.r, color: 0xff8833 },
        { r: MOD.uranus.r, color: 0x66dddd },
        { r: MOD.neptune.r, color: 0x4466ff },
        { r: MOD.pluto.r, color: 0xa09080 },
    ];
    for (const d of defs) {
        const pts = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(d.r * Math.cos(a), 0, d.r * Math.sin(a)));
        }
        const line = makeLine(pts, d.color, 0.25, THREE);
        scene.add(line);
        lines.push(line);
    }
    return lines;
}

// ── Glow texture ──
function glowTex(color, THREE) {
    const sz = 128;
    const c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const ctx = c.getContext('2d');
    const tmp = new THREE.Color(color);
    const r = Math.round(tmp.r * 255), g = Math.round(tmp.g * 255), b = Math.round(tmp.b * 255);
    const grad = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.5)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
}

// ── Scene Builders ──

function buildSun(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 32, 32),
        new THREE.MeshStandardMaterial({
            color: 0xffffcc, emissive: 0xffdd44, emissiveIntensity: 1.5, roughness: 0,
        })
    );
    scene.add(mesh);
    p.sun = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xffdd44, THREE), color: 0xffdd44,
        transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(5, 5, 1);
    mesh.add(glow);
}

function buildSaturn(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 32, 32),
        new THREE.MeshStandardMaterial({
            color: 0xff8833, emissive: 0xcc6622, emissiveIntensity: 0.8, roughness: 0.3,
        })
    );
    scene.add(mesh);
    p.saturn = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xff8833, THREE), color: 0xff8833,
        transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(3, 3, 1);
    mesh.add(glow);
    p.saturnGlow = glow;
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.4, 64),
        new THREE.MeshBasicMaterial({ color: 0xccaa66, side: THREE.DoubleSide, transparent: true, opacity: 0 })
    );
    ring.rotation.x = Math.PI / 2.3;
    ring.visible = false; // hidden by default, enabled per phase
    mesh.add(ring);
    p.saturnRings = ring;
}

function buildVenus(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0x33ff77, emissive: 0x22cc55, emissiveIntensity: 1.0, roughness: 0,
        })
    );
    scene.add(mesh);
    p.venus = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0x33ff77, THREE), color: 0x33ff77,
        transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(3, 3, 1);
    mesh.add(glow);
    p.venusGlow = glow;
}

function buildMars(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0xff4422, emissive: 0xcc3300, emissiveIntensity: 0.6,
            roughness: 0.6, metalness: 0.2,
        })
    );
    scene.add(mesh);
    p.mars = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xff4422, THREE), color: 0xff4422,
        transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.5, 1.5, 1);
    mesh.add(glow);
}

function buildEarth(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 24, 24),
        new THREE.MeshStandardMaterial({
            color: 0x4488ff, emissive: 0x2244aa, emissiveIntensity: 0.5,
            roughness: 0.4, metalness: 0.1,
        })
    );
    scene.add(mesh);
    p.earth = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0x4488ff, THREE), color: 0x4488ff,
        transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.8, 1.8, 1);
    mesh.add(glow);
}

function buildJupiter(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 24, 24),
        new THREE.MeshStandardMaterial({
            color: 0xddaa44, emissive: 0x886622, emissiveIntensity: 0.5, roughness: 0.5,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.jupiter = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xddaa44, THREE), color: 0xddaa44,
        transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(3, 3, 1);
    mesh.add(glow);
}

function buildMercury(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0xbbaa88, emissive: 0x887755, emissiveIntensity: 0.4, roughness: 0.7,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.mercury = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xbbaa88, THREE), color: 0xbbaa88,
        transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.0, 1.0, 1);
    mesh.add(glow);
}

function buildNeptune(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 20, 20),
        new THREE.MeshStandardMaterial({
            color: 0x4466ff, emissive: 0x2233aa, emissiveIntensity: 0.5, roughness: 0.4,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.neptune = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0x4466ff, THREE), color: 0x4466ff,
        transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(2, 2, 1);
    mesh.add(glow);
}

function buildUranus(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 20, 20),
        new THREE.MeshStandardMaterial({
            color: 0x66dddd, emissive: 0x44aaaa, emissiveIntensity: 0.5, roughness: 0.4,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.uranus = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0x66dddd, THREE), color: 0x66dddd,
        transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(2, 2, 1);
    mesh.add(glow);
}

/** Pluto — modern-solar era only (Kuiper belt) */
function buildPluto(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 14, 14),
        new THREE.MeshStandardMaterial({
            color: 0xc4b8a8, emissive: 0x6a6058, emissiveIntensity: 0.25, roughness: 0.85,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.pluto = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xa09080, THREE), color: 0xa09080,
        transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.9, 0.9, 1);
    mesh.add(glow);
}

function buildMoon(scene, p, THREE) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0xbbbbbb, emissive: 0x666666, emissiveIntensity: 0.3, roughness: 0.8,
        })
    );
    mesh.visible = false;
    scene.add(mesh);
    p.moon = mesh;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xaaaaaa, THREE), color: 0xaaaaaa,
        transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.6, 0.6, 1);
    mesh.add(glow);
}

function buildPlasmaField(scene, THREE) {
    const count = 2000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 6 + Math.random() * 3;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        col[i * 3] = 0.3 + Math.random() * 0.3;
        col[i * 3 + 1] = 0.1 + Math.random() * 0.2;
        col[i * 3 + 2] = 0.5 + Math.random() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.08, vertexColors: true, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return pts;
}

function buildStarfield(scene, THREE) {
    const count = 5000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 200;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 200;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.1, color: 0xffffff, transparent: true, opacity: 0.6,
    })));
}

// ═══════════════════ PLANET ANIMATION BUILDERS ═══════════════════

/**
 * Venus Plasmoid Star — morphing N-pointed star geometry.
 * In the Golden Age, Venus appears as a single luminous plasma star that shifts
 * between 4, 5, 6, 7, and 8 points. This is the "star and crescent" motif.
 */
function buildVenusStar(scene, p, THREE) {
    // Create initial 8-pointed star shape
    const geo = createStarGeometry(8, 0.5, 0.2, THREE);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xeeffee,
        emissiveIntensity: 1.0,
        roughness: 0,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    p.venusStar = mesh;

    // Star glow sprite
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xaaffcc, THREE),
        color: 0xaaffcc,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(3.5, 3.5, 1);
    glow.visible = false;
    mesh.add(glow);
    p.venusStarGlow = glow;
}

/** Create a flat N-pointed star shape geometry (like a Shamash wheel) */
function createStarGeometry(points, outerR, innerR, THREE) {
    const shape = new THREE.Shape();
    const n = Math.round(points);
    for (let i = 0; i <= n * 2; i++) {
        const angle = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    const geo = new THREE.ShapeGeometry(shape);
    return geo;
}

/** Update Venus star to morph between N points (called each frame) */
function updateVenusStarGeometry(mesh, sides, THREE) {
    const newGeo = createStarGeometry(sides, 0.5, 0.2, THREE);
    mesh.geometry.dispose();
    mesh.geometry = newGeo;
}

/**
 * Venus Comet Tail — particle system for comet/dragon phases.
 * Represents the "long disheveled hair" and "multi-headed serpent" tail.
 */
function buildCometTail(scene, p, THREE) {
    const count = 500;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3); // velocities for animation
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 2] = Math.random() * 3 + 0.5; // trail behind
        vel[i * 3] = (Math.random() - 0.5) * 0.02;
        vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        vel[i * 3 + 2] = Math.random() * 0.05 + 0.02;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(vel, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.06,
        color: 0xaaff88,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    scene.add(pts);
    p.cometTail = pts;
}

/** Animate comet tail particles — writhing serpentine motion */
function animateCometTail(p, t, THREE) {
    if (!p.cometTail?.visible || !p.venus?.visible) return;
    const positions = p.cometTail.geometry.attributes.position;
    const velocities = p.cometTail.geometry.attributes.velocity;
    const vpos = p.venus.position;

    for (let i = 0; i < positions.count; i++) {
        let x = positions.getX(i);
        let y = positions.getY(i);
        let z = positions.getZ(i);
        const vx = velocities.getX(i);
        const vy = velocities.getY(i);
        const vz = velocities.getZ(i);

        // Move along tail direction with serpentine writhing
        x += vx + Math.sin(t * 3 + i * 0.1) * 0.01;
        y += vy + Math.cos(t * 2.7 + i * 0.13) * 0.01;
        z += vz;

        // Reset particles that drift too far back to Venus position
        if (z > 5 || Math.abs(x) > 3 || Math.abs(y) > 3) {
            x = (Math.random() - 0.5) * 0.3;
            y = (Math.random() - 0.5) * 0.3;
            z = 0;
        }

        positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;

    // Position entire tail at Venus
    p.cometTail.position.copy(vpos);
    // Orient tail away from Sun direction
    if (p.sun?.visible) {
        const dir = new THREE.Vector3().subVectors(vpos, p.sun.position).normalize();
        p.cometTail.lookAt(vpos.x + dir.x, vpos.y + dir.y, vpos.z + dir.z);
    }
}

/**
 * Mars Outer Shell — translucent sphere around Mars's solid core.
 * Represents "Priori-Mars" with its light-element crust that eventually
 * becomes iron and breaks away.
 */
function buildMarsShell(scene, p, THREE) {
    const geo = new THREE.SphereGeometry(0.55, 24, 24); // larger than Mars core (0.35)
    const mat = new THREE.MeshStandardMaterial({
        color: 0xcc6644,
        emissive: 0x883300,
        emissiveIntensity: 0.15,
        roughness: 0.4,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        wireframe: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.userData = { stressed: false };
    scene.add(mesh);
    p.marsShell = mesh;

    // Add visible wireframe on top for "crust" appearance
    const wireGeo = new THREE.SphereGeometry(0.56, 12, 10);
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0xcc4400,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    mesh.add(wire);
}

/**
 * Mars Shell Explosion Fragments — particle burst for the stabilization phase.
 * The outer shell shatters into fragments that scatter outward, forming the asteroid belt.
 */
function buildMarsShellFragments(scene, p, THREE) {
    const count = 300;
    const pos = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3); // explosion directions
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        // Start at origin (will be repositioned to Mars)
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = 0;
        // Random explosion direction (spherical)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        dirs[i * 3] = Math.sin(phi) * Math.cos(theta);
        dirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
        dirs[i * 3 + 2] = Math.cos(phi);
        sizes[i] = 0.03 + Math.random() * 0.08; // varied fragment sizes
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('direction', new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1)); // not used directly but stored

    const mat = new THREE.PointsMaterial({
        size: 0.1,
        color: 0xcc5533,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    pts.userData = { origin: new THREE.Vector3(), progress: 0 };
    scene.add(pts);
    p.marsFragments = pts;
}

/** Animate shell fragments expanding outward */
function animateShellFragments(fragments, t, THREE) {
    if (!fragments?.visible) return;
    const positions = fragments.geometry.attributes.position;
    const dirs = fragments.geometry.attributes.direction;
    const origin = fragments.userData.origin || new THREE.Vector3();
    const progress = fragments.userData.progress || 0;
    const expansionRadius = progress * 8; // max 8 units expansion

    for (let i = 0; i < positions.count; i++) {
        const dx = dirs.getX(i);
        const dy = dirs.getY(i);
        const dz = dirs.getZ(i);
        // Each fragment expands outward, with a slight wobble
        const wobble = Math.sin(t * 2 + i * 0.5) * 0.05;
        positions.setXYZ(
            i,
            origin.x + dx * expansionRadius + wobble,
            origin.y + dy * expansionRadius * 0.7 + wobble, // flatten slightly (asteroid belt is planar)
            origin.z + dz * expansionRadius + wobble
        );
    }
    positions.needsUpdate = true;

    // Fade out as they expand
    fragments.material.opacity = Math.max(0.1, 0.8 * (1 - progress * 0.5));
}

/**
 * Dragon Tether — electric arc (Birkeland current) between Venus and Mars.
 * In the venus-returns phase (-1492 to -806), Venus and Mars are tethered together
 * as "the dragon". Red + green plasma streams interweave.
 */
function buildDragonTether(scene, p, THREE) {
    const segments = 60;
    const pos = new Float32Array(segments * 3);
    const colors = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = 0;
        // Alternate red (Mars) and green (Venus) with gradient
        const frac = i / segments;
        const r = 0.3 + 0.7 * (1 - frac); // red → fade
        const g = 0.2 + 0.6 * frac;       // → green
        const b = 0.1;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        linewidth: 2,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.userData = { venusPos: new THREE.Vector3(), marsPos: new THREE.Vector3() };
    scene.add(line);
    p.dragonTether = line;
}

/** Animate dragon tether — writhing electric arc between Venus and Mars */
function animateDragonTether(p, t, THREE) {
    if (!p.dragonTether?.visible) return;
    const positions = p.dragonTether.geometry.attributes.position;
    const vp = p.dragonTether.userData.venusPos;
    const mp = p.dragonTether.userData.marsPos;
    if (!vp || !mp) return;

    const segments = positions.count;
    for (let i = 0; i < segments; i++) {
        const frac = i / (segments - 1);
        // Lerp between Mars and Venus positions
        const x = mp.x + (vp.x - mp.x) * frac;
        const y = mp.y + (vp.y - mp.y) * frac;
        const z = mp.z + (vp.z - mp.z) * frac;

        // Add writhing sine waves (multi-armed serpent / dragon body)
        const amplitude = 0.3 * Math.sin(frac * Math.PI); // max displacement at midpoint
        const wave1 = amplitude * Math.sin(t * 5 + frac * 12); // fast serpentine
        const wave2 = amplitude * 0.6 * Math.cos(t * 3.7 + frac * 8); // secondary undulation
        const wave3 = amplitude * 0.3 * Math.sin(t * 7.3 + frac * 20); // high-frequency crackle

        positions.setXYZ(
            i,
            x + wave1 * 0.7 + wave3 * 0.3,
            y + wave2 + wave3 * 0.2,
            z + wave1 * 0.3 + wave2 * 0.5
        );
    }
    positions.needsUpdate = true;
}

/**
 * Birkeland Currents — visible electric tethers between all collinear planets.
 * Represents the Bifröst / Tree of Life / magnetic tube connecting the planets
 * in the Golden Age configuration.
 */
function buildBirkelandCurrents(scene, p, THREE) {
    // We draw lines connecting all planets in the column
    // These will be repositioned each frame in the collinear phase
    const segments = 30;
    const pos = new Float32Array(segments * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.LineBasicMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    scene.add(line);
    p.birkelandCurrents = line;
}

/** Animate Birkeland currents — flowing blue-white energy along the column */
function animateBirkelandCurrents(p, t, THREE) {
    if (!p.birkelandCurrents?.visible) return;
    const positions = p.birkelandCurrents.geometry.attributes.position;

    // Connect Jupiter → Saturn → Venus(star) → Mars → Earth → Mercury → Neptune → Uranus
    const bodies = [p.jupiter, p.saturn, p.venusStar?.visible ? p.venusStar : p.venus, p.mars, p.earth, p.mercury, p.neptune, p.uranus]
        .filter(b => b?.visible);

    if (bodies.length < 2) return;

    // Interpolate through all visible bodies
    const totalPathLength = bodies.length - 1;
    const segs = positions.count;

    for (let i = 0; i < segs; i++) {
        const frac = i / (segs - 1);
        const scaledFrac = frac * totalPathLength;
        const idx = Math.floor(scaledFrac);
        const subFrac = scaledFrac - idx;
        const bodyA = bodies[Math.min(idx, bodies.length - 1)];
        const bodyB = bodies[Math.min(idx + 1, bodies.length - 1)];

        const x = bodyA.position.x + (bodyB.position.x - bodyA.position.x) * subFrac;
        const y = bodyA.position.y + (bodyB.position.y - bodyA.position.y) * subFrac;
        const z = bodyA.position.z + (bodyB.position.z - bodyA.position.z) * subFrac;

        // Add gentle flowing energy wave
        const wave = 0.08 * Math.sin(t * 4 + frac * 15);

        positions.setXYZ(i, x + wave, y + wave * 0.5, z + wave * 0.3);
    }
    positions.needsUpdate = true;
}

/**
 * Wheel of Heaven — Saturn's spoked wheel / Sun Wheel / Shamash motif.
 * Visible only during Golden Age. An 8-spoked wheel behind Saturn
 * representing the polar view up the magnetic tube.
 */
function buildWheelOfHeaven(scene, p, THREE) {
    const group = new THREE.Group();

    // Outer ring
    const ringGeo = new THREE.RingGeometry(2.0, 2.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    // Inner ring
    const innerRingGeo = new THREE.RingGeometry(0.8, 1.0, 64);
    group.add(new THREE.Mesh(innerRingGeo, ringMat));

    // 8 spokes (Dharmachakra / Shamash style)
    const spokeMat = new THREE.LineBasicMaterial({
        color: 0xffdd66,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const pts = [
            new THREE.Vector3(0.9 * Math.cos(angle), 0.9 * Math.sin(angle), 0),
            new THREE.Vector3(2.1 * Math.cos(angle), 2.1 * Math.sin(angle), 0),
        ];
        const spokeGeo = new THREE.BufferGeometry().setFromPoints(pts);
        group.add(new THREE.Line(spokeGeo, spokeMat));
    }

    // Central glow
    const centerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(0xffcc44, THREE),
        color: 0xffcc44,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
    }));
    centerGlow.scale.set(4, 4, 1);
    group.add(centerGlow);

    // Orient wheel to face the camera (we'll update rotation in animate)
    group.visible = false;
    scene.add(group);
    p.wheelOfHeaven = group;
}
