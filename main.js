import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';

// Simulation parameters with defaults
const params = {
    q: 1.0,
    vx: 1.0, vy: 1.0, vz: 1.0,
    Ex: 0.0, Ey: 0.0, Ez: 0.0,
    Bx: 0.0, By: 0.0, Bz: 1.0,
    animationSpeed: 2,
    particleColor: '#00ffff',
    trailColor: '#ffff00',
    showAxes: true,
    showSphere: true,
    showTrail: true,
    show3DGrid: false,
    gridSize: 20,
    gridDivisions: 20,
    lightIntensity: 1,
    lightColor: '#ffffff',
    particleCount: 3,
    mass: 1.0,
    radius: 0.4,
    friction: 0.1,  // friction coefficient (force proportional to velocity)
    gravityX: 0.0, gravityY: -9.8, gravityZ: 0.0,
    externalForceX: 0.0, externalForceY: 0.0, externalForceZ: 0.0,
    backgroundColor: '#000000'
};

const baseDt = 0.01; // Base timestep

// THREE.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const directionalLight = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0x404040));

/**
 * Particle class represents a charged particle in 3D space,
 * including position, velocity, mesh for visualization, and trail.
 */
class Particle {
    constructor() {
        // Initialize position randomly in cube [-5,5]^3
        this.r = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );

        // Initial velocity from params
        this.v = new THREE.Vector3(params.vx, params.vy, params.vz);

        this.maxTrailPoints = 1000; // trail length
        this.positions = new Float32Array(this.maxTrailPoints * 3);
        this.positionCount = 0; // how many points currently in trail
        this.trailIndex = 0;    // circular buffer index

        // Create sphere mesh
        const geometry = new THREE.SphereGeometry(params.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.r);

        // Trail line
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor, transparent: true, opacity: 0.7 });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    }

    updateTrail() {
        // Save current position in circular buffer
        this.positions[this.trailIndex * 3] = this.r.x;
        this.positions[this.trailIndex * 3 + 1] = this.r.y;
        this.positions[this.trailIndex * 3 + 2] = this.r.z;

        this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
        this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);

        // Tell three.js to update the attribute buffer and draw correct range
        this.trailGeometry.setDrawRange(0, this.positionCount);
        this.trailGeometry.attributes.position.needsUpdate = true;
    }
}

// Simulation state
let particles = [];
let isPaused = false;
let gridHelper, axesHelper;

// Convenience to get Vector3 from params
function getVector3(x, y, z) {
    return new THREE.Vector3(x, y, z);
}

/**
 * Calculate derivatives for particle motion:
 * dr/dt = velocity
 * dv/dt = acceleration = total_force / mass
 * Forces included: Lorentz, gravity, friction, external
 */
function derivatives(particle) {
    const E = getVector3(params.Ex, params.Ey, params.Ez);
    const B = getVector3(params.Bx, params.By, params.Bz);
    const gravity = getVector3(params.gravityX, params.gravityY, params.gravityZ);
    const externalForce = getVector3(params.externalForceX, params.externalForceY, params.externalForceZ);

    const v = particle.v.clone();

    // Friction force opposite to velocity direction, proportional to velocity magnitude
    const frictionForce = v.length() > 0 ? v.clone().multiplyScalar(-params.friction) : new THREE.Vector3(0, 0, 0);

    // Lorentz force: q(E + v x B)
    const lorentzForce = E.clone().add(v.clone().cross(B)).multiplyScalar(params.q);

    // Total force = Lorentz + gravity*mass + external + friction
    const totalForce = lorentzForce.add(gravity.multiplyScalar(params.mass)).add(externalForce).add(frictionForce);

    // Avoid division by zero mass (mass=0 -> acceleration = 0)
    const acceleration = params.mass > 0 ? totalForce.clone().divideScalar(params.mass) : new THREE.Vector3(0, 0, 0);

    // dr/dt = v, dv/dt = acceleration
    return [v, acceleration];
}

/**
 * Perform one RK4 integration step.
 * Returns [delta position, delta velocity]
 */
function rk4Step(particle, dt) {
    const r0 = particle.r.clone();
    const v0 = particle.v.clone();

    // k1
    let [k1r, k1v] = derivatives(particle);

    // k2
    let tempParticle = {
        r: r0.clone().add(k1r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k1v.clone().multiplyScalar(dt / 2))
    };
    let [k2r, k2v] = derivatives(tempParticle);

    // k3
    tempParticle = {
        r: r0.clone().add(k2r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k2v.clone().multiplyScalar(dt / 2))
    };
    let [k3r, k3v] = derivatives(tempParticle);

    // k4
    tempParticle = {
        r: r0.clone().add(k3r.clone().multiplyScalar(dt)),
        v: v0.clone().add(k3v.clone().multiplyScalar(dt))
    };
    let [k4r, k4v] = derivatives(tempParticle);

    // Combine increments with RK4 weights
    const drdt = k1r.clone()
        .add(k2r.clone().multiplyScalar(2))
        .add(k3r.clone().multiplyScalar(2))
        .add(k4r)
        .multiplyScalar(1 / 6);

    const dvdt = k1v.clone()
        .add(k2v.clone().multiplyScalar(2))
        .add(k3v.clone().multiplyScalar(2))
        .add(k4v)
        .multiplyScalar(1 / 6);

    return [drdt.multiplyScalar(dt), dvdt.multiplyScalar(dt)];
}

/**
 * Clear scene completely and dispose resources.
 */
function clearScene() {
    while (scene.children.length > 0) {
        const obj = scene.children[0];
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }
}

/**
 * Initialize or reset the simulation.
 * Optionally resets camera position.
 */
function initializeSimulation(resetCamera = false) {
    clearScene();

    scene.background = new THREE.Color(params.backgroundColor);

    scene.add(directionalLight);
    scene.add(new THREE.AmbientLight(0x404040));

    if (params.showAxes) {
        axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);
    } else {
        axesHelper = null;
    }

    if (params.show3DGrid) {
        gridHelper = new THREE.GridHelper(params.gridSize, params.gridDivisions);
        scene.add(gridHelper);
    } else {
        gridHelper = null;
    }

    particles = [];
    for (let i = 0; i < params.particleCount; i++) {
        const p = new Particle();
        if (params.showSphere) scene.add(p.mesh);
        if (params.showTrail) scene.add(p.trail);
        particles.push(p);
    }

    if (resetCamera) {
        camera.position.set(0, 0, 20);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

/**
 * Update all particles by one simulation timestep.
 */
function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed);
    particles.forEach(particle => {
        const [dr, dv] = rk4Step(particle, dt);
        particle.r.add(dr);
        particle.v.add(dv);

        if (params.showSphere) particle.mesh.position.copy(particle.r);
        if (params.showTrail) particle.updateTrail();
    });
}

/**
 * Main animation loop.
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!isPaused) updateSimulation();
    renderer.render(scene, camera);
}

// Setup GUI
const gui = new GUI();

const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(params, 'q', -10, 10, 0.1).name('Charge (q)');
physicsFolder.add(params, 'vx', -10, 10, 0.1).name('Init Vx');
physicsFolder.add(params, 'vy', -10, 10, 0.1).name('Init Vy');
physicsFolder.add(params, 'vz', -10, 10, 0.1).name('Init Vz');
physicsFolder.add(params, 'Ex', -10, 10, 0.1).name('Electric Ex');
physicsFolder.add(params, 'Ey', -10, 10, 0.1).name('Electric Ey');
physicsFolder.add(params, 'Ez', -10, 10, 0.1).name('Electric Ez');
physicsFolder.add(params, 'Bx', -10, 10, 0.1).name('Magnetic Bx');
physicsFolder.add(params, 'By', -10, 10, 0.1).name('Magnetic By');
physicsFolder.add(params, 'Bz', -10, 10, 0.1).name('Magnetic Bz');
physicsFolder.add(params, 'mass', 0.01, 10, 0.01).name('Mass');
physicsFolder.add(params, 'friction', 0, 1, 0.01).name('Friction coeff');
physicsFolder.open();

const visualsFolder = gui.addFolder('Visuals');
visualsFolder.add(params, 'animationSpeed', 0.1, 10, 0.1).name('Animation speed');
visualsFolder.addColor(params, 'particleColor').name('Particle color').onChange(() =>
    particles.forEach(p => p.mesh.material.color.set(params.particleColor)));
visualsFolder.addColor(params, 'trailColor').name('Trail color').onChange(() =>
    particles.forEach(p => p.trailMaterial.color.set(params.trailColor)));
visualsFolder.add(params, 'showSphere').name('Show spheres').onChange(() =>
    particles.forEach(p => p.mesh.visible = params.showSphere));
visualsFolder.add(params, 'showTrail').name('Show trails').onChange(() =>
    particles.forEach(p => p.trail.visible = params.showTrail));
visualsFolder.add(params, 'showAxes').name('Show axes').onChange(() =>
    axesHelper && (axesHelper.visible = params.showAxes));
visualsFolder.add(params, 'show3DGrid').name('Show grid').onChange(() =>
    gridHelper && (gridHelper.visible = params.show3DGrid));
visualsFolder.addColor(params, 'backgroundColor').name('Background color').onChange(() => {
    scene.background.set(params.backgroundColor);
});
visualsFolder.add(params, 'particleCount', 1, 10, 1).name('Particle count').onFinishChange(() => initializeSimulation());
visualsFolder.open();

// Pause and Reset buttons
gui.add({ pauseResume: () => { isPaused = !isPaused; } }, 'pauseResume').name('Pause / Resume (space)');
gui.add({ reset: () => initializeSimulation(true) }, 'reset').name('Reset (R)');

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') isPaused = !isPaused;
    if (event.key.toLowerCase() === 'r') initializeSimulation(true);
});

// Start simulation
initializeSimulation(true);
animate();

    
        
                
        
