import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { Vec3, evaluate } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// Constants and Utilities
const Vec3Zero = new THREE.Vector3();
const baseDt = 0.01;

// Particle class for multiple particles with collision detection
class Particle {
    constructor(params) {
        this.r = new THREE.Vector3();
        this.v = new THREE.Vector3(params.vx, params.vy, params.vz);
        this.q = params.q;
        this.m = params.mass;
        this.radius = params.radius;
        
        // Create mesh
        const geometry = new THREE.SphereGeometry(params.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: params.particleColor,
            roughness: 0.7,
            metalness: 0.2
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Trail setup
        this.trailPositions = new Float32Array(params.trailLength * 3);
        this.trailCount = 0;
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    }

    updateTrail(position) {
        const offset = (this.trailCount % params.trailLength) * 3;
        this.trailPositions[offset] = position.x;
        this.trailPositions[offset + 1] = position.y;
        this.trailPositions[offset + 2] = position.z;
        this.trailCount++;
        this.trailGeometry.setAttribute('position', 
            new THREE.BufferAttribute(this.trailPositions, 3));
    }

    checkCollision(other) {
        const distance = this.r.distanceTo(other.r);
        return distance < (this.radius + other.radius);
    }
}

// Simulation Parameters
const params = {
    q: 1.0,
    vx: 1.0, vy: 1.0, vz: 1.0,
    Ex: '0', Ey: '0', Ez: '0', // Now strings for expression evaluation
    Bx: '0', By: '0', Bz: '1',
    animationSpeed: 2,
    particleColor: 'cyan',
    trailColor: 'yellow',
    trailLength: 500,
    showAxes: true,
    fontSize: 0.5,
    fontColor: 'white',
    axisLabelFontSize: 1.0,
    axisNumberingDensity: 2,
    backgroundColor: 'black',
    showSphere: true,
    showTrail: true,
    show3DGrid: false,
    gridSize: 20,
    gridDivisions: 20,
    lightIntensity: 1,
    lightColor: 'white',
    particleCount: 3,
    mass: 1.0,
    radius: 0.4,
    friction: 0.01,
    gravityX: 0.0, gravityY: -9.8, gravityZ: 0.0,
    externalForceX: '0', externalForceY: '0', externalForceZ: '0',
    collisionElasticity: 0.9,
    adaptiveTimeStep: true,
    solver: 'RK4', // Options: 'Euler', 'RK2', 'RK4'
};

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.castShadow = true;
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0x404040));

// Simulation State
let particles = [];
let gridHelper, axesHelper;
let isPaused = false;
let time = 0;

// Optimized Physics Calculations
function calculateForces(particle, t) {
    const E = new THREE.Vector3(
        evaluate(params.Ex, { t }), 
        evaluate(params.Ey, { t }), 
        evaluate(params.Ez, { t })
    );
    const B = new THREE.Vector3(
        evaluate(params.Bx, { t }), 
        evaluate(params.By, { t }), 
        evaluate(params.Bz, { t })
    );
    const externalForce = new THREE.Vector3(
        evaluate(params.externalForceX, { t }),
        evaluate(params.externalForceY, { t }),
        evaluate(params.externalForceZ, { t })
    );
    const gravity = new THREE.Vector3(params.gravityX, params.gravityY, params.gravityZ);

    const vMag = particle.v.length();
    const friction = vMag > 0 ? particle.v.clone().multiplyScalar(-params.friction * vMag) : Vec3Zero;
    const lorentz = particle.v.clone().cross(B).add(E).multiplyScalar(particle.q);
    return lorentz.add(gravity.multiplyScalar(particle.m)).add(externalForce).add(friction);
}

function rk4Step(particle, dt) {
    const k1v = calculateForces(particle, time).divideScalar(particle.m);
    const k1r = particle.v.clone();

    const halfDt = dt * 0.5;
    const v2 = particle.v.clone().add(k1v.clone().multiplyScalar(halfDt));
    const k2v = calculateForces({ ...particle, v: v2 }, time + halfDt).divideScalar(particle.m);
    const k2r = v2;

    const v3 = particle.v.clone().add(k2v.clone().multiplyScalar(halfDt));
    const k3v = calculateForces({ ...particle, v: v3 }, time + halfDt).divideScalar(particle.m);
    const k3r = v3;

    const v4 = particle.v.clone().add(k3v.clone().multiplyScalar(dt));
    const k4v = calculateForces({ ...particle, v: v4 }, time + dt).divideScalar(particle.m);
    const k4r = v4;

    const dr = k1r.add(k2r.multiplyScalar(2)).add(k3r.multiplyScalar(2)).add(k4r).multiplyScalar(dt / 6);
    const dv = k1v.add(k2v.multiplyScalar(2)).add(k3v.multiplyScalar(2)).add(k4v).multiplyScalar(dt / 6);

    return [dr, dv];
}

function updatePhysics(dt) {
    time += dt;
    const steps = params.adaptiveTimeStep ? Math.ceil(10 * dt / baseDt) : 10;

    particles.forEach(particle => {
        let [dr, dv] = [Vec3Zero, Vec3Zero];
        switch (params.solver) {
            case 'Euler':
                dv = calculateForces(particle, time).multiplyScalar(dt / particle.m);
                dr = particle.v.clone().multiplyScalar(dt);
                break;
            case 'RK2':
                const k1 = calculateForces(particle, time).multiplyScalar(dt / particle.m);
                const k2 = calculateForces({ ...particle, v: particle.v.clone().add(k1) }, time + dt)
                    .multiplyScalar(dt / particle.m);
                dv = k1.add(k2).multiplyScalar(0.5);
                dr = particle.v.clone().multiplyScalar(dt);
                break;
            case 'RK4':
                [dr, dv] = rk4Step(particle, dt);
                break;
        }

        particle.r.add(dr);
        particle.v.add(dv);
        particle.mesh.position.copy(particle.r);
        if (params.showTrail) particle.updateTrail(particle.r);

        // Collision detection
        particles.forEach(other => {
            if (particle !== other && particle.checkCollision(other)) {
                const normal = particle.r.clone().sub(other.r).normalize();
                const relativeVelocity = particle.v.clone().sub(other.v);
                const impulse = normal.multiplyScalar(
                    -(1 + params.collisionElasticity) * relativeVelocity.dot(normal) /
                    (1/particle.m + 1/other.m)
                );
                particle.v.add(impulse.clone().divideScalar(particle.m));
                other.v.sub(impulse.divideScalar(other.m));
            }
        });
    });
}

// Scene Initialization
function initializeSimulation(resetCamera = false) {
    scene.clear();
    scene.background = new THREE.Color(params.backgroundColor);
    
    directionalLight.color.set(params.lightColor);
    directionalLight.intensity = params.lightIntensity;
    scene.add(directionalLight, new THREE.AmbientLight(0x404040));

    if (resetCamera) {
        camera.position.set(0, 10, 20);
        controls.target.set(0, 0, 0);
    }

    if (params.showAxes) {
        axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);
    }

    if (params.show3DGrid) {
        gridHelper = new THREE.GridHelper(params.gridSize, params.gridDivisions);
        scene.add(gridHelper);
    }

    particles = Array.from({ length: params.particleCount }, () => {
        const p = new Particle(params);
        p.r.set(
            (Math.random() - 0.5) * params.gridSize,
            (Math.random() - 0.5) * params.gridSize,
            (Math.random() - 0.5) * params.gridSize
        );
        if (params.showSphere) scene.add(p.mesh);
        if (params.showTrail) scene.add(p.trail);
        return p;
    });

    time = 0;
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    if (!isPaused) {
        const dt = baseDt * (1 / params.animationSpeed);
        updatePhysics(dt);
    }
    
    renderer.render(scene, camera);
}

// GUI Setup
const gui = new GUI();
const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(params, 'q', -10, 10, 0.1);
physicsFolder.add(params, 'vx', -10, 10, 0.1);
physicsFolder.add(params, 'vy', -10, 10, 0.1);
physicsFolder.add(params, 'vz', -10, 10, 0.1);
physicsFolder.add(params, 'Ex').name('E-field X (expr)');
physicsFolder.add(params, 'Ey').name('E-field Y (expr)');
physicsFolder.add(params, 'Ez').name('E-field Z (expr)');
physicsFolder.add(params, 'Bx').name('B-field X (expr)');
physicsFolder.add(params, 'By').name('B-field Y (expr)');
physicsFolder.add(params, 'Bz').name('B-field Z (expr)');
physicsFolder.add(params, 'mass', 0.1, 10, 0.1);
physicsFolder.add(params, 'radius', 0.1, 2, 0.1);
physicsFolder.add(params, 'friction', 0, 1, 0.01);
physicsFolder.add(params, 'collisionElasticity', 0, 1, 0.1);
physicsFolder.add(params, 'gravityX', -20, 20, 0.1);
physicsFolder.add(params, 'gravityY', -20, 20, 0.1);
physicsFolder.add(params, 'gravityZ', -20, 20, 0.1);
physicsFolder.add(params, 'externalForceX').name('Force X (expr)');
physicsFolder.add(params, 'externalForceY').name('Force Y (expr)');
physicsFolder.add(params, 'externalForceZ').name('Force Z (expr)');
physicsFolder.add(params, 'solver', ['Euler', 'RK2', 'RK4']);

const visualsFolder = gui.addFolder('Visuals');
visualsFolder.add(params, 'particleCount', 1, 100, 1).onChange(() => initializeSimulation());
visualsFolder.add(params, 'trailLength', 100, 1000, 10).onChange(() => initializeSimulation());
visualsFolder.addColor(params, 'particleColor').onChange(() => particles.forEach(p => p.mesh.material.color.set(params.particleColor)));
visualsFolder.addColor(params, 'trailColor').onChange(() => particles.forEach(p => p.trailMaterial.color.set(params.trailColor)));
visualsFolder.add(params, 'showSphere').onChange(() => particles.forEach(p => p.mesh.visible = params.showSphere));
visualsFolder.add(params, 'showTrail').onChange(() => particles.forEach(p => p.trail.visible = params.showTrail));
visualsFolder.add(params, 'showAxes').onChange(() => axesHelper.visible = params.showAxes);
visualsFolder.add(params, 'show3DGrid').onChange(() => gridHelper.visible = params.show3DGrid);
visualsFolder.addColor(params, 'backgroundColor').onChange(() => scene.background.set(params.backgroundColor));
visualsFolder.add(params, 'animationSpeed', 0.1, 10, 0.1);
visualsFolder.add(params, 'adaptiveTimeStep');

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

// Start Simulation
initializeSimulation(true);
animate();   

    
    
        
                
        