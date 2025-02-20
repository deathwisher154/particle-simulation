 
   import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add } from 'https://cdn.skypack.dev/mathjs@9.5.1';

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
    particleCount: 1,
    mass: 1.0,
    radius: 0.4,
    friction: 0.01,
    gravityX: 0.0, gravityY: -9.8, gravityZ: 0.0,
    externalForceX: 0.0, externalForceY: 0.0, externalForceZ: 0.0
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
        this.r = new THREE.Vector3();
        this.v = new THREE.Vector3(params.vx, params.vy, params.vz);
        this.positions = new Float32Array(3000); // Pre-allocate trail buffer
        this.positionCount = 0;

        const geometry = new THREE.SphereGeometry(params.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    }

    updateTrail() {
        const offset = (this.positionCount % 1000) * 3;
        this.positions[offset] = this.r.x;
        this.positions[offset + 1] = this.r.y;
        this.positions[offset + 2] = this.r.z;
        this.positionCount++;
        this.trailGeometry.setAttribute('position', 
            new THREE.BufferAttribute(this.positions.slice(0, Math.min(this.positionCount, 1000) * 3), 3));
    }
}

// Simulation State
let particles = [];
let isPaused = false;
let gridHelper, axesHelper;

// Physics Calculations
function derivatives(particle) {
    const E = [params.Ex, params.Ey, params.Ez];
    const B = [params.Bx, params.By, params.Bz];
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    
    const v = [particle.v.x, particle.v.y, particle.v.z];
    const vMag = particle.v.length();
    const friction = vMag > 0 ? multiply(-params.friction * vMag, v) : [0, 0, 0];
    const lorentz = multiply(params.q, add(E, cross(v, B)));
    const totalForce = add(add(add(lorentz, multiply(params.mass, gravity)), externalForce), friction);
    return [v, divide(totalForce, params.mass)];
}

function rk4Step(particle, dt) {
    const v = [particle.v.x, particle.v.y, particle.v.z];
    const r = [particle.r.x, particle.r.y, particle.r.z];
    
    const k1 = derivatives(particle);
    const k2 = derivatives({
        ...particle,
        r: add(r, multiply(k1[0], dt/2)),
        v: new THREE.Vector3(...add(v, multiply(k1[1], dt/2)))
    });
    const k3 = derivatives({
        ...particle,
        r: add(r, multiply(k2[0], dt/2)),
        v: new THREE.Vector3(...add(v, multiply(k2[1], dt/2)))
    });
    const k4 = derivatives({
        ...particle,
        r: add(r, multiply(k3[0], dt)),
        v: new THREE.Vector3(...add(v, multiply(k3[1], dt)))
    });

    const dr = multiply(add(k1[0], multiply(2, add(k2[0], multiply(2, k3[0]))), k4[0]), dt/6);
    const dv = multiply(add(k1[1], multiply(2, add(k2[1], multiply(2, k3[1]))), k4[1]), dt/6);
    
    return [new THREE.Vector3(...dr), new THREE.Vector3(...dv)];
}

// Scene Management
function initializeSimulation(resetCamera = false) {
    scene.clear();
    scene.background = new THREE.Color(params.backgroundColor);
    
    scene.add(directionalLight);
    scene.add(new THREE.AmbientLight(0x404040));

    if (resetCamera) {
        camera.position.set(0, 0, 20);
        controls.target.set(0, 0, 0);
        controls.update();
    }

    if (params.showAxes) {
        axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);
    }

    if (params.show3DGrid) {
        gridHelper = new THREE.GridHelper(params.gridSize, params.gridDivisions);
        scene.add(gridHelper);
    }

    particles = Array(params.particleCount).fill().map(() => {
        const p = new Particle();
        if (params.showSphere) scene.add(p.mesh);
        if (params.showTrail) scene.add(p.trail);
        return p;
    });
}

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
visualsFolder.add(params, 'particleCount', 1, 10, 1).onFinishChange(() => initializeSimulation());

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') isPaused = !isPaused;
    if (event.key === 'r') initializeSimulation();
});

// Start
initializeSimulation(true);
animate(); 
    
        
                
        