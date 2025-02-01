import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract, norm } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// Enhanced parameters with new features
const params = {
    // Original parameters remain unchanged
    // ... (keep all original params from the initial code)

    // New advanced parameters
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

let particles = [];
let vectorField;
let statsDiv;
let trailMaterial;

// Modified derivatives function with new physics
function derivatives(r, v, E, B, q, m) {
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    
    // Original friction force
    const velocityMagnitude = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
    const frictionForce = velocityMagnitude > 0 ? multiply(-params.friction, v) : [0, 0, 0];

    // New advanced forces
    const dragForce = multiply(
        -params.dragCoefficient * velocityMagnitude ** 2,
        divide(v, velocityMagnitude || 1)
    );

    // Thermal fluctuations
    const thermalForce = multiply(
        Math.sqrt(2 * 1.38e-23 * params.temperature * params.friction),
        [Math.random()-0.5, Math.random()-0.5, Math.random()-0.5]
    );

    // Original Lorentz force with relativistic correction
    const gamma = 1 / Math.sqrt(1 - (velocityMagnitude ** 2) / (9e16));
    const lorentzForce = multiply(q/gamma, add(E, cross(v, B)));

    // Combined forces
    const totalForce = add(
        add(add(lorentzForce, multiply(m, gravity)), externalForce),
        add(add(frictionForce, dragForce), thermalForce)
    );

    return [v, divide(totalForce, m)];
}

// Enhanced Runge-Kutta implementation
function rungeKutta4(r, v, E, B, q, m, dt) {
    // Original RK4 implementation remains unchanged
    // ... (keep original RK4 code)
}

// New vector field visualization
function createVectorField() {
    const fieldGroup = new THREE.Group();
    
    // Electric field arrows
    const eDirection = new THREE.Vector3(...divide([params.Ex, params.Ey, params.Ez], 
        norm([params.Ex, params.Ey, params.Ez]) || 1)).normalize();
    const eArrow = new THREE.ArrowHelper(
        eDirection,
        new THREE.Vector3(0, 0, 0),
        norm([params.Ex, params.Ey, params.Ez]) * params.vectorScale,
        0xff0000
    );
    
    // Magnetic field arrows
    const bDirection = new THREE.Vector3(...divide([params.Bx, params.By, params.Bz], 
        norm([params.Bx, params.By, params.Bz]) || 1)).normalize();
    const bArrow = new THREE.ArrowHelper(
        bDirection,
        new THREE.Vector3(0, 0, 0),
        norm([params.Bx, params.By, params.Bz]) * params.vectorScale,
        0x0000ff
    );

    fieldGroup.add(eArrow);
    fieldGroup.add(bArrow);
    return fieldGroup;
}

// Enhanced initialization function
function initializeSimulation(resetCamera = false) {
    // Original initialization code
    // ... (keep all original initialization code)

    // New features initialization
    if (params.fieldVisualization) {
        vectorField = createVectorField();
        scene.add(vectorField);
    }

    // Initialize multiple particles
    particles = Array.from({length: params.particleCount}, () => ({
        position: [0, 0, 0],
        velocity: [params.vx, params.vy, params.vz],
        trail: new THREE.BufferGeometry(),
        trailLine: null
    }));

    // Initialize statistics display
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.style.position = 'absolute';
        statsDiv.style.top = '10px';
        statsDiv.style.left = '10px';
        statsDiv.style.color = 'white';
        document.body.appendChild(statsDiv);
    }
}

// Enhanced update function
function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed);
    const m = params.mass;

    particles.forEach(particle => {
        // Original RK4 integration
        let [dr, dv] = params.integrationMethod === 'RK4' ?
            rungeKutta4(particle.position, particle.velocity, 
                        [params.Ex, params.Ey, params.Ez], 
                        [params.Bx, params.By, params.Bz], 
                        params.q, m, dt) :
            eulerStep(particle.position, particle.velocity, 
                     [params.Ex, params.Ey, params.Ez], 
                     [params.Bx, params.By, params.Bz], 
                     params.q, m, dt);

        particle.position = add(particle.position, dr);
        particle.velocity = add(particle.velocity, dv);

        // Boundary handling
        if (params.boundaryType === 'reflect') {
            particle.position.forEach((coord, i) => {
                if (Math.abs(coord) > 20) {
                    particle.position[i] = Math.sign(coord) * 20;
                    particle.velocity[i] *= -0.8;
                }
            });
        }

        // Update trail
        if (params.showTrail) {
            const positions = particle.trail.attributes.position?.array || [];
            const newPositions = new Float32Array([...positions, ...particle.position]);
            particle.trail.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
            if (!particle.trailLine) {
                particle.trailLine = new THREE.Line(particle.trail, trailMaterial);
                scene.add(particle.trailLine);
            }
        }
    });

    // Update statistics
    const totalEnergy = particles.reduce((sum, p) => 
        sum + 0.5 * m * norm(p.velocity) ** 2, 0);
    statsDiv.textContent = `Total Energy: ${totalEnergy.toFixed(2)} J`;
}

// New GUI controls for advanced features
const advancedFolder = gui.addFolder('Advanced Physics');
advancedFolder.add(params, 'integrationMethod', ['RK4', 'Euler']);
advancedFolder.add(params, 'dragCoefficient', 0, 1).step(0.01);
advancedFolder.add(params, 'temperature', 0, 1000);
advancedFolder.add(params, 'boundaryType', ['none', 'reflect', 'periodic']);
advancedFolder.add(params, 'fieldVisualization').onChange(initializeSimulation);
advancedFolder.add(params, 'vectorScale', 0.1, 2).onChange(initializeSimulation);

// Preset configurations
const presets = {
    cyclotron: () => {
        params.Bz = 5;
        params.vx = 3;
        params.vy = 0;
        params.vz = 0;
        params.Ex = params.Ey = params.Ez = 0;
        initializeSimulation();
    },
    cathodeRay: () => {
        params.Ez = 5;
        params.vz = 0.1;
        params.Bz = 0.5;
        initializeSimulation();
    }
};

// Euler integration method
function eulerStep(r, v, E, B, q, m, dt) {
    const a = derivatives(r, v, E, B, q, m)[1];
    return [multiply(v, dt), multiply(a, dt)];
}

// Keep original animation and event handling code
// ... (keep original animate(), resize handler, and keydown listener)

// Initialize with both original and new features
initializeSimulation(true);
animate();

