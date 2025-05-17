import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';

const params = {
    q: 1.0,
    vx: 1.0, vy: 1.0, vz: 0.0,
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
    friction: 0.1,
    gravityX: 0.0, gravityY: -9.8, gravityZ: 0.0,
    externalForceX: 0.0, externalForceY: 0.0, externalForceZ: 0.0,
    backgroundColor: '#000000',
    trailPersistence: true,  // Keep trails indefinitely if true
};

const baseDt = 0.01;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const directionalLight = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0x404040));

class Particle {
    constructor() {
        // Start all particles at origin
        this.r = new THREE.Vector3(0, 0, 0);
        this.v = new THREE.Vector3(params.vx, params.vy, params.vz);

        this.maxTrailPoints = 5000; // Longer trails
        this.positions = new Float32Array(this.maxTrailPoints * 3);
        this.positionCount = 0;
        this.trailIndex = 0;

        this.trajectoryData = [];

        const geometry = new THREE.SphereGeometry(params.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.r);

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor, transparent: true, opacity: 0.7 });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    }

    updateTrail() {
        if (!params.trailPersistence && this.positionCount >= this.maxTrailPoints) {
            this.positionCount = 0;
            this.trailIndex = 0;
        }
        this.positions[this.trailIndex * 3] = this.r.x;
        this.positions[this.trailIndex * 3 + 1] = this.r.y;
        this.positions[this.trailIndex * 3 + 2] = this.r.z;

        this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
        this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);

        this.trailGeometry.setDrawRange(0, this.positionCount);
        this.trailGeometry.attributes.position.needsUpdate = true;
    }

    logTrajectory(time) {
        this.trajectoryData.push({ time, x: this.r.x, y: this.r.y, z: this.r.z });
    }

    resetTrajectory() {
        this.trajectoryData = [];
    }
}

let particles = [];
let isPaused = false;
let gridHelper, axesHelper;

function getVector3(x, y, z) {
    return new THREE.Vector3(x, y, z);
}

function derivatives(particle) {
    const E = getVector3(params.Ex, params.Ey, params.Ez);
    const B = getVector3(params.Bx, params.By, params.Bz);
    const gravity = getVector3(params.gravityX, params.gravityY, params.gravityZ);
    const externalForce = getVector3(params.externalForceX, params.externalForceY, params.externalForceZ);

    const v = particle.v.clone();
    const frictionForce = v.length() > 0 ? v.clone().multiplyScalar(-params.friction) : new THREE.Vector3(0, 0, 0);
    const lorentzForce = E.clone().add(v.clone().cross(B)).multiplyScalar(params.q);

    const totalForce = lorentzForce.add(gravity.multiplyScalar(params.mass)).add(externalForce).add(frictionForce);
    const acceleration = params.mass > 0 ? totalForce.clone().divideScalar(params.mass) : new THREE.Vector3(0, 0, 0);

    return [v, acceleration];
}

function rk4Step(particle, dt) {
    const r0 = particle.r.clone();
    const v0 = particle.v.clone();

    let [k1r, k1v] = derivatives(particle);

    let tempParticle = {
        r: r0.clone().add(k1r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k1v.clone().multiplyScalar(dt / 2))
    };
    let [k2r, k2v] = derivatives(tempParticle);

    tempParticle = {
        r: r0.clone().add(k2r.clone().multiplyScalar(dt / 2)),
        v: v0.clone().add(k2v.clone().multiplyScalar(dt / 2))
    };
    let [k3r, k3v] = derivatives(tempParticle);

    tempParticle = {
        r: r0.clone().add(k3r.clone().multiplyScalar(dt)),
        v: v0.clone().add(k3v.clone().multiplyScalar(dt))
    };
    let [k4r, k4v] = derivatives(tempParticle);

    const drdt = k1r.clone().add(k2r.clone().multiplyScalar(2)).add(k3r.clone().multiplyScalar(2)).add(k4r).multiplyScalar(1 / 6);
    const dvdt = k1v.clone().add(k2v.clone().multiplyScalar(2)).add(k3v.clone().multiplyScalar(2)).add(k4v).multiplyScalar(1 / 6);

    return [drdt.multiplyScalar(dt), dvdt.multiplyScalar(dt)];
}

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

function createBetterAxes(size = 10) {
    const axesGroup = new THREE.Group();

    // Thick colored axes lines
    const axisMaterialX = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
    const axisMaterialY = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
    const axisMaterialZ = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 });

    // Lines for X, Y, Z
    const xGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 0, 0)]);
    const xAxis = new THREE.Line(xGeometry, axisMaterialX);
    axesGroup.add(xAxis);

    const yGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size, 0)]);
    const yAxis = new THREE.Line(yGeometry, axisMaterialY);
    axesGroup.add(yAxis);

    const zGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, size)]);
    const zAxis = new THREE.Line(zGeometry, axisMaterialZ);
    axesGroup.add(zAxis);

    // Create text sprites for axis labels
    const createTextSprite = (text, color) => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.font = 'Bold 70px Arial';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, size / 2, size / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 1.5, 1.5);
        return sprite;
    };

    const labelX = createTextSprite('X', '#ff0000');
    labelX.position.set(size + 0.7, 0, 0);
    axesGroup.add(labelX);

    const labelY = createTextSprite('Y', '#00ff00');
    labelY.position.set(0, size + 0.7, 0);
    axesGroup.add(labelY);

    const labelZ = createTextSprite('Z', '#0000ff');
    labelZ.position.set(0, 0, size + 0.7);
    axesGroup.add(labelZ);

    return axesGroup;
}

let axesHelper = null;
let gridHelper = null;

function initializeSimulation(resetCamera = false) {
    clearScene();

    scene.background = new THREE.Color(params.backgroundColor);

    scene.add(directionalLight);
    scene.add(new THREE.AmbientLight(0x404040));

    if (params.showAxes) {
        axesHelper = createBetterAxes(10);
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
        p.resetTrajectory();
        particles.push(p);
    }

    if (resetCamera) {
        camera.position.set(0, 0, 20);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed);
    const currentTime = performance.now() / 1000;

    particles.forEach(particle => {
        const [dr, dv] = rk4Step(particle, dt);
        particle.r.add(dr);
        particle.v.add(dv);

        if (params.showSphere) particle.mesh.position.copy(particle.r);
        if (params.showTrail) particle.updateTrail();
        particle.logTrajectory(currentTime);
    });
}

// Preset motions
function presetCyclotron() {
    params.Ex = 0; params.Ey = 0; params.Ez = 0;
    params.Bx = 0; params.By = 0; params.Bz = 1;
    params.friction = 0;
    params.mass = 1;
    params.q = 1;
    params.vx = 1;
    params.vy = 0;
    params.vz = 0;
    initializeSimulation(true);
}

function presetCycloidal() {
    params.Ex = 1;
    params.Ey = 0;
    params.Ez = 0;
    params.Bx = 0;
    params.By = 0;
    params.Bz = 1;
    params.friction = 0;
    params.mass = 1;
    params.q = 1;
    params.vx = 0;
    params.vy = 0;
    params.vz = 0;
    initializeSimulation(true);
}

function presetStraightLine() {
    params.Ex = 0;
    params.Ey = 0;
    params.Ez = 0;
    params.Bx = 0;
    params.By = 0;
    params.Bz = 0;
    params.friction = 0;
    params.mass = 1;
    params.q = 1;
    params.vx = 1;
    params.vy = 0;
    params.vz = 0;
    initializeSimulation(true);
}

function invertChargeSign() {
    params.q = -params.q;
    initializeSimulation(false);
}

function exportTrajectories() {
    let csv = 'particle,time,x,y,z\n';
    particles.forEach((p, i) => {
        p.trajectoryData.forEach(point => {
            csv += `${i},${point.time.toFixed(3)},${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}\n`;
        });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'trajectories.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// GUI
const gui = new GUI();

const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(params, 'q', -10, 10, 0.1).name('Charge (q)').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'vx', -10, 10, 0.1).name('Init Vx').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'vy', -10, 10, 0.1).name('Init Vy').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'vz', -10, 10, 0.1).name('Init Vz').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'Ex', -10, 10, 0.1).name('Electric Ex').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'Ey', -10, 10, 0.1).name('Electric Ey').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'Ez', -10, 10, 0.1).name('Electric Ez').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'Bx', -10, 10, 0.1).name('Magnetic Bx').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'By', -10, 10, 0.1).name('Magnetic By').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'Bz', -10, 10, 0.1).name('Magnetic Bz').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'mass', 0.01, 10, 0.01).name('Mass').onChange(() => initializeSimulation(false));
physicsFolder.add(params, 'friction', 0, 1, 0.01).name('Friction coeff').onChange(() => initializeSimulation(false));
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
visualsFolder.add(params, 'showAxes').name('Show axes').onChange(() => {
    if (axesHelper) axesHelper.visible = params.showAxes;
});
visualsFolder.add(params, 'show3DGrid').name('Show grid').onChange(() => {
    if (gridHelper) gridHelper.visible = params.show3DGrid;
});
visualsFolder.addColor(params, 'backgroundColor').name('Background color').onChange(() => {
    scene.background.set(params.backgroundColor);
});
visualsFolder.add(params, 'particleCount', 1, 10, 1).name('Particle count').onFinishChange(() => initializeSimulation());
visualsFolder.add(params, 'trailPersistence').name('Persist Trails (No Auto Clear)').onChange(() => {
    if (!params.trailPersistence) {
        particles.forEach(p => {
            p.positionCount = 0;
            p.trailIndex = 0;
            p.trailGeometry.setDrawRange(0, 0);
            p.trailGeometry.attributes.position.needsUpdate = true;
        });
    }
});
visualsFolder.open();

const presetsFolder = gui.addFolder('Presets');
presetsFolder.add({ Cyclotron: presetCyclotron }, 'Cyclotron');
presetsFolder.add({ Cycloidal: presetCycloidal }, 'Cycloidal');
presetsFolder.add({ 'Straight Line': presetStraightLine }, 'Straight Line');
presetsFolder.add({ 'Invert Charge Sign': invertChargeSign }, 'Invert Charge Sign');
presetsFolder.open();

gui.add({ Export: exportTrajectories }, 'Export').name('Export Trajectories (CSV)');

gui.add({ PauseResume: () => { isPaused = !isPaused; } }, 'PauseResume').name('Pause / Resume (space)');
gui.add({ Reset: () => initializeSimulation(true) }, 'Reset').name('Reset (R)');

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') isPaused = !isPaused;
    if (event.key.toLowerCase() === 'r') initializeSimulation(true);
});

initializeSimulation(true);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!isPaused) updateSimulation();
    renderer.render(scene, camera);
}


    
        
                
        
