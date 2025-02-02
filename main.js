import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';

// Optimized vector math functions
const vec3 = {
    add: (a, b, dst = []) => {
        dst[0] = a[0] + b[0];
        dst[1] = a[1] + b[1];
        dst[2] = a[2] + b[2];
        return dst;
    },
    multiply: (a, s, dst = []) => {
        dst[0] = a[0] * s;
        dst[1] = a[1] * s;
        dst[2] = a[2] * s;
        return dst;
    },
    cross: (a, b, dst = []) => {
        const ax = a[0], ay = a[1], az = a[2];
        const bx = b[0], by = b[1], bz = b[2];
        dst[0] = ay * bz - az * by;
        dst[1] = az * bx - ax * bz;
        dst[2] = ax * by - ay * bx;
        return dst;
    }
};

// Reusable temporary vectors
const _tempVec1 = [];
const _tempVec2 = [];
const _tempVec3 = [];
const _tempVec4 = [];

function derivatives(r, v, E, B, q, m, gravity, externalForce, friction, a) {
    // Lorentz force: q(E + v × B)
    vec3.cross(v, B, _tempVec1);
    vec3.add(E, _tempVec1, _tempVec2);
    vec3.multiply(_tempVec2, q, _tempVec3);
    
    // Gravity force: m*gravity
    vec3.multiply(gravity, m, _tempVec1);
    
    // Sum all forces
    vec3.add(_tempVec3, _tempVec1, _tempVec2);  // Lorentz + gravity
    vec3.add(_tempVec2, externalForce, _tempVec1); // + external
    vec3.add(_tempVec1, friction, _tempVec4);    // + friction
    
    // Acceleration = F_total / m
    vec3.multiply(_tempVec4, 1/m, a);
    return a;
}

function rungeKutta4(r, v, E, B, q, m, dt) {
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    const friction = vec3.multiply(v, -params.friction, _tempVec1);

    // k1
    const k1v = [...v];
    const k1a = derivatives(r, v, E, B, q, m, gravity, externalForce, friction, []);

    // k2
    const k2r = vec3.add(r, vec3.multiply(k1v, dt/2, _tempVec2), []);
    const k2v = vec3.add(v, vec3.multiply(k1a, dt/2, _tempVec3), []);
    const k2a = derivatives(k2r, k2v, E, B, q, m, gravity, externalForce, friction, []);

    // k3
    const k3r = vec3.add(r, vec3.multiply(k2v, dt/2, _tempVec1), []);
    const k3v = vec3.add(v, vec3.multiply(k2a, dt/2, _tempVec2), []);
    const k3a = derivatives(k3r, k3v, E, B, q, m, gravity, externalForce, friction, []);

    // k4
    const k4r = vec3.add(r, vec3.multiply(k3v, dt, _tempVec3), []);
    const k4v = vec3.add(v, vec3.multiply(k3a, dt, _tempVec1), []);
    const k4a = derivatives(k4r, k4v, E, B, q, m, gravity, externalForce, friction, []);

    // Final combination
    const dr = vec3.multiply(
        vec3.add(
            vec3.add(k1v, vec3.multiply(k2v, 2, _tempVec1), _tempVec2),
            vec3.add(vec3.multiply(k3v, 2, _tempVec3), k4v, _tempVec1),
            _tempVec2
        ),
        dt/6,
        []
    );

    const dv = vec3.multiply(
        vec3.add(
            vec3.add(k1a, vec3.multiply(k2a, 2, _tempVec1), _tempVec2),
            vec3.add(vec3.multiply(k3a, 2, _tempVec3), k4a, _tempVec1),
            _tempVec2
        ),
        dt/6,
        []
    );

    return [dr, dv];
}

const params = {
    q: 1.0,
    vx: 1.0,
    vy: 1.0,
    vz: 1.0,
    Ex: 0.0,
    Ey: 0.0,
    Ez: 0.0,
    Bx: 0.0,
    By: 0.0,
    Bz: 1.0,
    animationSpeed: 2,
    particleColor: 'cyan',
    trailColor: 'yellow',
    showAxes: true,
    fontSize: 0.5,
    fontColor: 'white',
    axisLabelFontSize: 1.0,
    axisNumberingDensity: 2,
    sphereSize: 0.4,
    backgroundColor: 'black',
    showSphere: true,
    showTrail: true,
    show3DGrid: false,
    gridSize: 20,
    gridDivisions: 20,
    lightIntensity: 1,
    lightColor: 'white',
    particleCount: 1,
    mass: 1.0,
    radius: 1.0,
    friction: 0.01,
    gravityX: 0.0,
    gravityY: -9.8,
    gravityZ: 0.0,
    externalForceX: 0.0,
    externalForceY: 0.0,
    externalForceZ: 0.0,
};

class SimulationSystem {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.camera.position.set(0, 0, 20);
        this.controls.update();

        this.directionalLight = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
        this.ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(this.directionalLight);
        this.scene.add(this.ambientLight);

        this.trailPositions = new Float32Array(3000);
        this.trailIndex = 0;
        this.font = null;
        this.particleSphere = null;
        this.trail = null;

        this.setupGUI();
        this.loadFont();
        this.initializeSimulation(true);
    }

    setupGUI() {
        const gui = new GUI();
        const folder = gui.addFolder('Simulation Parameters');
        // ... Add GUI controls as in original code ...
        folder.add({ reset: () => this.initializeSimulation(true) }, 'reset').name('Reset Simulation');
    }

    loadFont() {
        new THREE.FontLoader().load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', font => {
            this.font = font;
            this.createAxesLabels();
        });
    }

    createAxesLabels() {
        if (!this.font) return;

        const createLabel = (text, position, color, size) => {
            const geometry = new THREE.TextGeometry(text, {
                font: this.font,
                size: size,
                height: 0.1
            });
            const material = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...position);
            this.scene.add(mesh);
        };

        const density = params.axisNumberingDensity;
        for (let i = -100; i <= 100; i += density) {
            createLabel(i.toString(), [i, 0, 0], params.fontColor, params.fontSize);
            createLabel(i.toString(), [0, i, 0], params.fontColor, params.fontSize);
            createLabel(i.toString(), [0, 0, i], params.fontColor, params.fontSize);
        }

        createLabel('X', [11, 0, 0], 'red', params.axisLabelFontSize);
        createLabel('Y', [0, 11, 0], 'green', params.axisLabelFontSize);
        createLabel('Z', [0, 0, 11], 'blue', params.axisLabelFontSize);
    }

    initializeSimulation(resetCamera = false) {
        // Clear scene but keep lights
        this.scene.children = this.scene.children.filter(obj => 
            obj === this.directionalLight || obj === this.ambientLight
        );

        if (resetCamera) {
            this.camera.position.set(0, 0, 20);
            this.controls.update();
        }

        if (params.showAxes) this.createAxesLabels();
        if (params.showSphere) this.createParticle();
        if (params.showTrail) this.createTrail();

        this.r = [0, 0, 0];
        this.v = [params.vx, params.vy, params.vz];
        this.E = [params.Ex, params.Ey, params.Ez];
        this.B = [params.Bx, params.By, params.Bz];
        this.trailPositions.fill(0);
        this.trailIndex = 0;
    }

    createParticle() {
        const geometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.particleSphere = new THREE.Mesh(geometry, material);
        this.particleSphere.castShadow = true;
        this.scene.add(this.particleSphere);
    }

    createTrail() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        const material = new THREE.LineBasicMaterial({ color: params.trailColor });
        this.trail = new THREE.Line(geometry, material);
        this.scene.add(this.trail);
    }

    updateSimulation(dt) {
        [this.dr, this.dv] = rungeKutta4(this.r, this.v, this.E, this.B, params.q, params.mass, dt);
        vec3.add(this.r, this.dr, this.r);
        vec3.add(this.v, this.dv, this.v);

        if (this.particleSphere) {
            this.particleSphere.position.set(...this.r);
        }

        if (this.trail) {
            const baseIndex = this.trailIndex * 3;
            this.trailPositions[baseIndex] = this.r[0];
            this.trailPositions[baseIndex + 1] = this.r[1];
            this.trailPositions[baseIndex + 2] = this.r[2];
            
            this.trailIndex = (this.trailIndex + 1) % 1000;
            this.trail.geometry.attributes.position.needsUpdate = true;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.isPaused) {
            this.updateSimulation(0.016 * (1 / params.animationSpeed));
        }
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize and run simulation
const sim = new SimulationSystem();
sim.animate();

// Event listeners
window.addEventListener('resize', () => {
    sim.camera.aspect = window.innerWidth / window.innerHeight;
    sim.camera.updateProjectionMatrix();
    sim.renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') sim.isPaused = !sim.isPaused;
});