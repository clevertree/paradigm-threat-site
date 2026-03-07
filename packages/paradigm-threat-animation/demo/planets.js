/**
 * Three.js planetary scene for BC / Golden Age visualization.
 * Renders simplified Saturnian collinear configuration and transitions.
 */
import * as THREE from 'three';
import { planetaryConfigs } from '../data/events.js';

let scene, camera, renderer, animationId;
let planets = {};
let plasmaParticles;
let currentConfig = null;

export function initPlanetScene(canvas) {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 15);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Ambient light
    scene.add(new THREE.AmbientLight(0x222244, 0.5));

    // Point light (for Saturn glow effect)
    const saturnLight = new THREE.PointLight(0xffcc00, 2, 30);
    saturnLight.position.set(0, 4, 0);
    scene.add(saturnLight);
    planets.saturnLight = saturnLight;

    // Create planetary bodies
    createSaturn();
    createVenus();
    createVenusStar();
    createMars();
    createMarsShell();
    createEarth();
    createJupiter();
    createCometTail();
    createDragonTether();
    createPlasmaField();
    createStarfield();

    // Handle resize
    window.addEventListener('resize', () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // Start render loop
    animate();
}

function createSaturn() {
    const geo = new THREE.SphereGeometry(1.2, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xff8800,
        emissiveIntensity: 0.8,
        roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 4, 0);
    scene.add(mesh);
    planets.saturn = mesh;

    // Saturn glow (sprite)
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffaa00,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(5, 5, 1);
    mesh.add(glowSprite);
    planets.saturnGlow = glowSprite;

    // Saturn rings (hidden by default — only in stabilization+ phases)
    const ringGeo = new THREE.RingGeometry(1.6, 2.4, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xccaa66,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    mesh.add(ringMesh);
    planets.saturnRings = ringMesh;
}

function createVenus() {
    // Venus as 8-pointed star plasmoid (geometry nodes approximation)
    const geo = new THREE.SphereGeometry(0.35, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
        roughness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 2, 0);
    scene.add(mesh);
    planets.venus = mesh;

    // Venus plasmoid glow
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xaaccff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(2.5, 2.5, 1);
    mesh.add(glowSprite);
    planets.venusGlow = glowSprite;
}

function createMars() {
    const geo = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xcc3300,
        roughness: 0.7,
        metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.5, 0);
    scene.add(mesh);
    planets.mars = mesh;
}

function createEarth() {
    const geo = new THREE.SphereGeometry(0.4, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x3366cc,
        roughness: 0.5,
        metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -1.5, 0);
    scene.add(mesh);
    planets.earth = mesh;
}

function createJupiter() {
    const geo = new THREE.SphereGeometry(0.9, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xcc9944,
        roughness: 0.5,
        emissive: 0x442200,
        emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false; // Only visible in round-table+ phases
    scene.add(mesh);
    planets.jupiter = mesh;
}

/** Venus Plasmoid Star — morphing N-pointed star (4→5→6→7→8 sides) for Golden Age */
function createVenusStar() {
    const shape = new THREE.Shape();
    const n = 8, outerR = 0.5, innerR = 0.2;
    for (let i = 0; i <= n * 2; i++) {
        const angle = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xeeffee, emissiveIntensity: 1.0,
        roughness: 0, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.set(0, 2, 0);
    scene.add(mesh);
    planets.venusStar = mesh;

    // Star glow
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
        map: glowTex, color: 0xaaffcc, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(3.5, 3.5, 1);
    mesh.add(glow);
    planets.venusStarGlow = glow;
}

/** Mars Outer Shell — translucent sphere around Mars core */
function createMarsShell() {
    const geo = new THREE.SphereGeometry(0.55, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xcc6644, emissive: 0x883300, emissiveIntensity: 0.15,
        roughness: 0.4, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    planets.marsShell = mesh;

    // Wireframe overlay for crust lines
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0xcc4400, wireframe: true, transparent: true, opacity: 0.12,
    });
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 10), wireMat));
}

/** Comet Tail particles for Venus in comet/dragon phases */
function createCometTail() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = Math.random() * 3 + 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.06, color: 0xaaff88, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    scene.add(pts);
    planets.cometTail = pts;
}

/** Dragon Tether — electric arc between Venus and Mars */
function createDragonTether() {
    const segments = 60;
    const positions = new Float32Array(segments * 3);
    const colors = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
        const frac = i / segments;
        colors[i * 3] = 0.3 + 0.7 * (1 - frac);     // red → fade
        colors[i * 3 + 1] = 0.2 + 0.6 * frac;        // → green
        colors[i * 3 + 2] = 0.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    scene.add(line);
    planets.dragonTether = line;
}

function createPlasmaField() {
    // Particle system for Absu plasma layers
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 6 + Math.random() * 3;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        // Purple/blue plasma colors
        colors[i * 3] = 0.3 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.1 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.5 + Math.random() * 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    plasmaParticles = new THREE.Points(geo, mat);
    scene.add(plasmaParticles);
}

function createStarfield() {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.1,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
    });
    scene.add(new THREE.Points(geo, mat));
}

function createGlowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,200,100,0.5)');
    gradient.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

/**
 * Update the 3D scene based on the current year.
 */
export function updatePlanetScene(year) {
    const config = planetaryConfigs.find(
        c => year >= c.yearStart && year <= c.yearEnd
    );
    if (!config) return;

    currentConfig = config;
    const id = config.id;
    const elapsed = year - config.yearStart;

    // Sky color
    scene.background = new THREE.Color(config.skyColor);

    // Saturn
    if (config.saturn) {
        planets.saturn.visible = true;
        lerpPosition(planets.saturn, config.saturn.position);
        planets.saturnGlow.material.opacity = config.saturn.glow * 0.6;
        planets.saturnLight.intensity = config.saturn.glow * 2;
        if (config.saturn.color) {
            planets.saturn.material.color.set(config.saturn.color);
            planets.saturn.material.emissive.set(config.saturn.color);
        }
        // Rings — animate fade-in during stabilization
        if (id === 'stabilization') {
            const dur = config.yearEnd - config.yearStart;
            const progress = Math.min(1, elapsed / dur);
            planets.saturnRings.material.opacity = progress * 0.5;
        } else {
            planets.saturnRings.material.opacity = config.saturn.rings ? 0.5 : 0;
        }
    }

    // ── Venus phases ──
    const isGolden = (id === 'golden-age');
    const isBreakup = (id === 'breakup');
    const isComet = (id === 'round-table' || id === 'deluge');
    const isDragon = (id === 'venus-returns');
    const isCalming = (id === 'stabilization');

    // Plasmoid star (golden-age / breakup)
    if (planets.venusStar) {
        planets.venusStar.visible = isGolden || isBreakup;
        if (isGolden && config.venus?.position) {
            lerpPosition(planets.venusStar, config.venus.position);
            planets.venusStar.material.emissiveIntensity = 1.0;
        } else if (isBreakup && config.venus?.position) {
            lerpPosition(planets.venusStar, config.venus.position);
            planets.venusStar.material.emissiveIntensity = 0.5 + 0.5 * Math.random();
        }
    }

    // Venus sphere
    if (config.venus) {
        planets.venus.visible = !(isGolden || isBreakup); // hide sphere when star is showing
        if (planets.venus.visible) {
            lerpPosition(planets.venus, config.venus.position);
            const isPlasma = config.venus.type === 'plasmoid';
            planets.venus.material.emissiveIntensity = isPlasma ? 1.0 : 0.3;
            planets.venusGlow.material.opacity = isPlasma ? 0.5 : 0.15;
            if (config.venus.color) {
                planets.venus.material.color.set(config.venus.color);
                planets.venus.material.emissive.set(config.venus.color);
            }
        }
    } else {
        planets.venus.visible = false;
    }

    // Comet tail
    if (planets.cometTail) {
        planets.cometTail.visible = isComet || isDragon || isCalming;
        if (isComet) {
            planets.cometTail.material.color.set(id === 'deluge' ? 0xff4444 : 0xaaff88);
            planets.cometTail.material.opacity = 0.5;
        } else if (isDragon) {
            planets.cometTail.material.color.set(0x44ff88);
            planets.cometTail.material.opacity = 0.6;
        } else if (isCalming) {
            const dur = config.yearEnd - config.yearStart;
            const progress = Math.min(1, elapsed / dur);
            planets.cometTail.material.opacity = 0.5 * (1 - progress);
        }
    }

    // ── Mars phases ──
    if (config.mars) {
        planets.mars.visible = true;
        lerpPosition(planets.mars, config.mars.position);
    } else {
        planets.mars.visible = false;
    }

    // Mars outer shell
    if (planets.marsShell) {
        const shellPhases = ['round-table', 'deluge', 'post-deluge', 'venus-returns'];
        const showShell = shellPhases.includes(id);
        planets.marsShell.visible = showShell;
        if (showShell && config.mars?.position) {
            lerpPosition(planets.marsShell, config.mars.position);
            if (id === 'venus-returns') {
                planets.marsShell.material.emissive.set(0xff4400);
                planets.marsShell.material.emissiveIntensity = 0.3;
            } else {
                planets.marsShell.material.emissive.set(0x883300);
                planets.marsShell.material.emissiveIntensity = 0.15;
            }
        }
        // Mars shrinks during stabilization (shell lost)
        if (id === 'stabilization') {
            const dur = config.yearEnd - config.yearStart;
            const loss = Math.min(1, elapsed / dur);
            planets.mars.scale.setScalar(1.0 - loss * 0.3);
        } else if (id === 'modern-solar') {
            planets.mars.scale.setScalar(0.7);
        } else {
            planets.mars.scale.setScalar(1.0);
        }
    }

    // Dragon tether
    if (planets.dragonTether) {
        planets.dragonTether.visible = isDragon;
    }

    // Earth
    if (config.earth) {
        planets.earth.visible = true;
        lerpPosition(planets.earth, config.earth.position);
        if (config.earth.color) {
            planets.earth.material.color.set(config.earth.color);
        }
    }

    // Jupiter
    if (config.jupiter) {
        planets.jupiter.visible = true;
        lerpPosition(planets.jupiter, config.jupiter.position);
    } else {
        planets.jupiter.visible = false;
    }

    // Plasma field (Absu) — visible before stabilization
    const plasmaVisible = year < -806;
    plasmaParticles.visible = plasmaVisible;
    if (plasmaVisible) {
        const intensity = Math.max(0, Math.min(1, (-year - 670) / 2477));
        plasmaParticles.material.opacity = intensity * 0.6;
    }
}

function lerpPosition(mesh, target) {
    if (!target) return;
    mesh.position.lerp(new THREE.Vector3(target[0], target[1], target[2]), 0.05);
}

function animate() {
    animationId = requestAnimationFrame(animate);

    const t = performance.now() * 0.001;

    // Gentle rotation on planets
    if (planets.saturn) planets.saturn.rotation.y += 0.002;
    if (planets.venus?.visible) planets.venus.rotation.y += 0.005;
    if (planets.mars?.visible) planets.mars.rotation.y += 0.004;
    if (planets.earth?.visible) planets.earth.rotation.y += 0.003;
    if (planets.jupiter?.visible) planets.jupiter.rotation.y += 0.001;

    // Venus plasmoid star morph (4→5→6→7→8 cycle)
    if (planets.venusStar?.visible) {
        const cycle = 20;
        const frac = (t % cycle) / cycle;
        const sides = 4 + 4 * (frac < 0.5 ? frac * 2 : 2 - frac * 2);
        // Recreate star geometry with current side count
        const shape = new THREE.Shape();
        const n = Math.round(sides), outerR = 0.5, innerR = 0.2;
        for (let i = 0; i <= n * 2; i++) {
            const angle = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        planets.venusStar.geometry.dispose();
        planets.venusStar.geometry = new THREE.ShapeGeometry(shape);
        // Pulsing scale
        const pulse = 1.0 + 0.15 * Math.sin(t * 2.5);
        planets.venusStar.scale.setScalar(pulse);
    }

    // Comet tail serpentine animation
    if (planets.cometTail?.visible && planets.venus?.visible) {
        const positions = planets.cometTail.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let x = positions.getX(i);
            let y = positions.getY(i);
            let z = positions.getZ(i);
            x += Math.sin(t * 3 + i * 0.1) * 0.01;
            y += Math.cos(t * 2.7 + i * 0.13) * 0.01;
            z += 0.03;
            if (z > 5 || Math.abs(x) > 3) {
                x = (Math.random() - 0.5) * 0.3;
                y = (Math.random() - 0.5) * 0.3;
                z = 0;
            }
            positions.setXYZ(i, x, y, z);
        }
        positions.needsUpdate = true;
        planets.cometTail.position.copy(planets.venus.position);
    }

    // Mars shell breathing
    if (planets.marsShell?.visible) {
        const breathe = 1.0 + 0.05 * Math.sin(t * 1.3);
        planets.marsShell.scale.setScalar(breathe);
    }

    // Dragon tether writhing
    if (planets.dragonTether?.visible && planets.venus?.visible && planets.mars?.visible) {
        const positions = planets.dragonTether.geometry.attributes.position;
        const vp = planets.venus.position;
        const mp = planets.mars.position;
        const segments = positions.count;
        for (let i = 0; i < segments; i++) {
            const frac = i / (segments - 1);
            const x = mp.x + (vp.x - mp.x) * frac;
            const y = mp.y + (vp.y - mp.y) * frac;
            const z = mp.z + (vp.z - mp.z) * frac;
            const amp = 0.3 * Math.sin(frac * Math.PI);
            const wave1 = amp * Math.sin(t * 5 + frac * 12);
            const wave2 = amp * 0.6 * Math.cos(t * 3.7 + frac * 8);
            positions.setXYZ(i, x + wave1 * 0.7, y + wave2, z + wave1 * 0.3);
        }
        positions.needsUpdate = true;
    }

    // Plasma particle slow rotation
    if (plasmaParticles?.visible) {
        plasmaParticles.rotation.y += 0.0005;
        plasmaParticles.rotation.x = Math.sin(t * 0.1) * 0.05;
    }

    renderer.render(scene, camera);
}

export function getActivePlanetLabel(year) {
    const config = planetaryConfigs.find(c => year >= c.yearStart && year <= c.yearEnd);
    return config ? { label: config.label, description: config.description } : { label: '', description: '' };
}

export function destroyPlanetScene() {
    if (animationId) cancelAnimationFrame(animationId);
    renderer?.dispose();
}
