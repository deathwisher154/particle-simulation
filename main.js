import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract, norm } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// Advanced Physics Parameters
const advancedParams = {
    integrationMethod: 'RK4',
    dragCoefficient: 0.1,
    temperature: 300,
    particleInteraction: false,
    boundaryType: 'none',
    fieldVisualization: true,
    vectorScale: 0.5,
    preset: 'custom',
    energyGraph: true,
    momentumGraph: false
};

class ParticleSystem {
    constructor(count) {
        this.particles = Array.from({ length: count }, () => ({
            position: [0, 0, 0],
            velocity: [params.vx, params.vy, params.vz],
            trail: [],
            age: 0
        }));
        this.instancedMesh = null;
        this.trailGeometries = [];
    }

    createInstancedMesh() {
        const geometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: params.particleColor });
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, params.particleCount);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        return this.instancedMesh;
    }

    updateInstances() {
        const matrix = new THREE.Matrix4();
        this.particles.forEach((particle, i) => {
            matrix.makeTranslation(...particle.position);
            this.instancedMesh.setMatrixAt(i, matrix);
        });
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
}

// Enhanced Force Model
function advancedDerivatives(r, v, E, B, q, m) {
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    
    // Advanced drag model (quadratic + Stokes)
    const velocityMag = norm(v);
    const dragForce = multiply(
        -params.friction * velocityMag - advancedParams.dragCoefficient * velocityMag ** 2,
        divide(v, velocityMag)
    );

    // Brownian motion (temperature effect)
    const thermalForce = multiply(
        Math.sqrt(2 * 1.38e-23 * advancedParams.temperature * params.friction),
        [Math.random()-0.5, Math.random()-0.5, Math.random()-0.5]
    );

    // Lorentz force with relativistic correction
    const gamma = 1 / Math.sqrt(1 - (velocityMag ** 2) / (9e16));
    const lorentzForce = multiply(q/gamma, add(E, cross(v, B)));

    const totalForce = add(
        add(add(lorentzForce, multiply(m, gravity)), externalForce),
        add(dragForce, thermalForce)
    );

    return [v, divide(totalForce, m)];
}

// Vector Field Visualization
function createVectorField() {
    const fieldGroup = new THREE.Group();
    
    // Electric Field Arrows
    const eArrow = new THREE.ArrowHelper(
        new THREE.Vector3(...divide(params.E, norm(params.E))).normalize(),
        new THREE.Vector3(0, 0, 0),
        norm(params.E) * advancedParams.vectorScale,
        0xff0000
    );
    
    // Magnetic Field Arrows
    const bArrow = new THREE.ArrowHelper(
        new THREE.Vector3(...divide(params.B, norm(params.B))).normalize(),
        new THREE.Vector3(0, 0, 0),
        norm(params.B) * advancedParams.vectorScale,
        0x0000ff
    );

    fieldGroup.add(eArrow);
    fieldGroup.add(bArrow);
    return fieldGroup;
}

// Enhanced GUI with Presets
const presets = {
    cyclotron: () => {
        params.Bz = 5;
        params.vx = 3;
        params.vy = 0;
        params.vz = 0;
        params.Ex = params.Ey = params.Ez = 0;
        advancedParams.preset = 'cyclotron';
        initializeSimulation();
    },
    cathodeRay: () => {
        params.Ez = 5;
        params.vz = 0.1;
        params.Bz = 0.5;
        advancedParams.preset = 'cathodeRay';
        initializeSimulation();
    }
};

// Real-time Statistics Display
const statsDiv = document.createElement('div');
statsDiv.style.position = 'absolute';
statsDiv.style.top = '10px';
statsDiv.style.left = '10px';
statsDiv.style.color = 'white';
document.body.appendChild(statsDiv);

// Shader-based Fading Trails
const trailMaterial = new THREE.LineBasicMaterial({
    color: params.trailColor,
    transparent: true,
    opacity: 0.7,
    onBeforeCompile: (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            `
            varying float vAlpha;
            void main() {
                gl_FragColor = vec4(outgoingLight, diffuseColor.a * vAlpha);
            `
        );
        shader.vertexShader = shader.vertexShader.replace(
            'void main() {',
            `
            varying float vAlpha;
            void main() {
                vAlpha = position.z; // Use z-coordinate for alpha
            `
        );
    }
});

// Modified initialization and update functions
let particleSystem, vectorField;

function initializeSimulation(resetCamera = false) {
    // ... existing init code ...
    
    // Advanced features initialization
    particleSystem = new ParticleSystem(params.particleCount);
    if (params.showSphere) {
        scene.add(particleSystem.createInstancedMesh());
    }

    if (advancedParams.fieldVisualization) {
        vectorField = createVectorField();
        scene.add(vectorField);
    }

    // Boundary system
    if (advancedParams.boundaryType !== 'none') {
        const boundary = new THREE.BoxHelper(new THREE.Box3(
            new THREE.Vector3(-20, -20, -20),
            new THREE.Vector3(20, 20, 20)
        ), 0x888888);
        scene.add(boundary);
    }
}

function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed);
    const m = params.mass;
    
    particleSystem.particles.forEach((particle, i) => {
        // Apply particle interactions
        if (advancedParams.particleInteraction) {
            particleSystem.particles.forEach(other => {
                if (particle !== other) {
                    const r = subtract(particle.position, other.position);
                    const force = multiply(
                        params.q * other.q / norm(r) ** 3,
                        r
                    );
                    particle.velocity = add(particle.velocity, multiply(force, dt/m));
                }
            });
        }

        // Adaptive integration
        let [dr, dv] = advancedParams.integrationMethod === 'RK4' ?
            rungeKutta4(particle.position, particle.velocity, E, B, params.q, m, dt) :
            eulerStep(particle.position, particle.velocity, E, B, params.q, m, dt);

        particle.position = add(particle.position, dr);
        particle.velocity = add(particle.velocity, dv);
        
        // Boundary handling
        if (advancedParams.boundaryType === 'reflect') {
            particle.position.forEach((coord, i) => {
                if (Math.abs(coord) > 20) {
                    particle.position[i] = Math.sign(coord) * 20;
                    particle.velocity[i] *= -0.8;
                }
            });
        }

        // Update trails
        particle.trail.push(...particle.position);
        if (particle.trail.length > 300) particle.trail.splice(0, 3);
    });

    particleSystem.updateInstances();
    
    // Update statistics
    const kineticEnergy = 0.5 * params.mass * norm(v) ** 2;
    statsDiv.textContent = `Kinetic Energy: ${kineticEnergy.toFixed(2)} J\nMomentum: ${norm(v).toFixed(2)} kg·m/s`;
}

// Additional GUI Controls
const advancedFolder = gui.addFolder('Advanced Physics');
advancedFolder.add(advancedParams, 'integrationMethod', ['RK4', 'Euler']);
advancedFolder.add(advancedParams, 'dragCoefficient', 0, 1).step(0.01);
advancedFolder.add(advancedParams, 'temperature', 0, 1000);
advancedFolder.add(advancedParams, 'particleInteraction');
advancedFolder.add(advancedParams, 'boundaryType', ['none', 'reflect', 'periodic']);
advancedFolder.add(advancedParams, 'fieldVisualization');
advancedFolder.add(advancedParams, 'vectorScale', 0.1, 2);
advancedFolder.add(advancedParams, 'preset', ['custom', 'cyclotron', 'cathodeRay']).onChange(v => presets[v]());

const visualizationFolder = gui.addFolder('Visualization');
visualizationFolder.add(advancedParams, 'energyGraph');
visualizationFolder.add(advancedParams, 'momentumGraph');

// Remaining original code with modifications for new features...
// [Include all original code with necessary modifications to support new features]

// New helper functions
function eulerStep(r, v, E, B, q, m, dt) {
    const a = divide(advancedDerivatives(r, v, E, B, q, m)[1], m);
    return [multiply(v, dt), multiply(a, dt)];
}

function updateFieldVisualization() {
    if (vectorField) {
        scene.remove(vectorField);
        vectorField = createVectorField();
        scene.add(vectorField);
    }
}

// Enhanced animation loop with performance throttling
let lastUpdate = 0;
function animate(timestamp) {
    requestAnimationFrame(animate);
    
    if (!isPaused) {
        if (timestamp - lastUpdate > 16) { // ~60 FPS
            updateSimulation();
            lastUpdate = timestamp;
        }
    }
    
    renderer.render(scene, camera);
}

