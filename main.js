import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';

// Simulation Parameters
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
    friction: 0.01,
    gravityX: 0.0, gravityY: -9.8, gravityZ: 0.0,
    externalForceX: 0.0, externalForceY: 0.0, externalForceZ: 0.0,
    backgroundColor: '#000000'  // Added background color param
};

const baseDt = 0.01;

// Scene Setup
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

// Particle Class
class Particle {
    constructor() {
        this.r = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        this.v = new THREE.Vector3(params.vx, params.vy, params.vz);
        this.maxTrailPoints = 1000;
        this.positions = new Float32Array(this.maxTrailPoints * 3);
        this.positionCount = 0;
        this.trailIndex = 0;

        // Sphere representing particle
        const geometry = new THREE.SphereGeometry(params.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.r);

        // Trail line setup
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor, transparent: true, opacity: 0.7 });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    }

    updateTrail() {
        // Circular buffer for trail positions
        this.positions[this.trailIndex * 3] = this.r.x;
        this.positions[this.trailIndex * 3 + 1] = this.r.y;
        this.positions[this.trailIndex * 3 + 2] = this.r.z;
        this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
        this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);

        // Update BufferGeometry draw range and attribute
        this.trailGeometry.setDrawRange(0, this.positionCount);
        this.trailGeometry.attributes.position.needsUpdate = true;
    }
}

// Simulation State
let particles = [];
let isPaused = false;
let gridHelper, axesHelper;

// Convert params to THREE.Vector3 for forces convenience
function getVector3(x, y, z) {
    return new THREE.Vector3(x, y, z);
}

// Compute derivatives: returns [dr/dt, dv/dt]
function derivatives(particle) {
    const E = getVector3(params.Ex, params.Ey, params.Ez);
    const B = getVector3(params.Bx, params.By, params.Bz);
    const gravity = getVector3(params.gravityX, params.gravityY, params.gravityZ);
    const externalForce = getVector3(params.externalForceX, params.externalForceY, params.externalForceZ);

    const v = particle.v.clone();

    // Friction opposite to velocity direction, proportional to speed squared (more realistic)
    const friction = v.length() > 0 ? v.clone().multiplyScalar(-params.friction * v.length()) : new THREE.Vector3(0, 0, 0);

    // Lorentz force: q(E + v x B)
    const lorentz = E.clone().add(v.clone().cross(B)).multiplyScalar(params.q);

    // Total force
    const totalForce = lorentz.add(gravity.multiplyScalar(params.mass)).add(externalForce).add(friction);

    // Velocity derivative = acceleration = totalForce / mass (avoid div by zero)
    const acceleration = totalForce.clone().divideScalar(params.mass > 0 ? params.mass : 1);

    // dr/dt = velocity, dv/dt = acceleration
    return [v, acceleration];
}

// Runge-Kutta 4 integration
function rk4Step(particle, dt) {
    const r0 = particle.r.clone();
    const v0 = particle.v.clone();

    const [k1r, k1v] = derivatives(particle);

    const temp1 = {
        r: r0.clone().add(k1r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k1v.clone().multiplyScalar(dt / 2))
    };
    const [k2r, k2v] = derivatives(temp1);

    const temp2 = {
        r: r0.clone().add(k2r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k2v.clone().multiplyScalar(dt / 2))
    };
    const [k3r, k3v] = derivatives(temp2);

    const temp3 = {
        r: r0.clone().add(k3r.clone().multiplyScalar(dt)),
        v: v0.clone().add(k3v.clone().multiplyScalar(dt))
    };
    const [k4r, k4v] = derivatives(temp3);

    // Weighted average of slopes
    const drdt = k1r.clone().add(k2r.clone().multiplyScalar(2)).add(k3r.clone().multiplyScalar(2)).add(k4r).multiplyScalar(1/6);
    const dvdt = k1v.clone().add(k2v.clone().multiplyScalar(2)).add(k3v.clone().multiplyScalar(2)).add(k4v).multiplyScalar(1/6);

    // Update position and velocity
    return [drdt.multiplyScalar(dt), dvdt.multiplyScalar(dt)];
}

// Remove all objects from scene safely
function clearScene() {
    while(scene.children.length > 0){
        let obj = scene.children[0];
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if(Array.isArray(obj.material)){
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }
}

// Initialize simulation: create particles, helpers
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
    for(let i = 0; i < params.particleCount; i++){
        const p = new Particle();
        if (params.showSphere) scene.add(p.mesh);
        if (params.showTrail) scene.add(p.trail);
        particles.push(p);
    }

    if(resetCamera){
        camera.position.set(0, 0, 20);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// Update particle positions and velocities
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

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!isPaused) updateSimulation();
    renderer.render(scene, camera);
}

// GUI Setup
const gui = new GUI();

const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(params, 'q', -10, 10, 0.1);
physicsFolder.add(params, 'vx', -10, 10, 0.1);
physicsFolder.add(params, 'vy', -10, 10, 0.1);
physicsFolder.add(params, 'vz', -10, 10, 0.1);
physicsFolder.add(params, 'Ex', -10, 10, 0.1);
physicsFolder.add(params, 'Ey', -10, 10, 0.1);
physicsFolder.add(params, 'Ez', -10, 10, 0.1);
physicsFolder.add(params, 'Bx', -10, 10, 0.1);
physicsFolder.add(params, 'By', -10, 10, 0.1);
physicsFolder.add(params, 'Bz', -10, 10, 0.1);
physicsFolder.add(params, 'mass', 0.1, 10, 0.1);
physicsFolder.add(params, 'friction', 0, 1, 0.01);
physicsFolder.open();

const visualsFolder = gui.addFolder('Visuals');
visualsFolder.add(params, 'animationSpeed', 0.1, 10, 0.1);
visualsFolder.addColor(params, 'particleColor').onChange(() =>
    particles.forEach(p => p.mesh.material.color.set(params.particleColor)));
visualsFolder.addColor(params, 'trailColor').onChange(() =>
    particles.forEach(p => p.trailMaterial.color.set(params.trailColor)));
visualsFolder.add(params, 'showSphere').onChange(() =>
    particles.forEach(p => p.mesh.visible = params.showSphere));
visualsFolder.add(params, 'showTrail').onChange(() =>
    particles.forEach(p => p.trail.visible = params.showTrail));
visualsFolder.add(params, 'showAxes').onChange(() =>
    axesHelper && (axesHelper.visible = params.showAxes));
visualsFolder.add(params, 'show3DGrid').onChange(() =>
    gridHelper && (gridHelper.visible = params.show3DGrid));
visualsFolder.addColor(params, 'backgroundColor').onChange(() => {
    scene.background.set(params.backgroundColor);
});
visualsFolder.add(params, 'particleCount', 1, 10, 1).onFinishChange(() => initializeSimulation());

visualsFolder.open();

// Controls for pause and reset
gui.add({ pause: () => { isPaused = !isPaused; } }, 'pause').name('Pause/Resume (space)');
gui.add({ reset: () => initializeSimulation(true) }, 'reset').name('Reset (R)');

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') isPaused = !isPaused;
    if (event.key === 'r') initializeSimulation(true);
});

// Start
initializeSimulation(true);
animate();

    
        
                
        
