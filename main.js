import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract, norm } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// Enhanced particle system with multiple particles and instanced rendering
class ParticleSystem {
    constructor(count, size, color) {
        this.particles = new THREE.InstancedMesh(
            new THREE.SphereGeometry(size, 16, 16),
            new THREE.MeshStandardMaterial({ color }),
            count
        );
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.visibleCount = count;
    }

    updatePositions() {
        this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < this.visibleCount; i++) {
            dummy.position.set(
                this.positions[i * 3],
                this.positions[i * 3 + 1],
                this.positions[i * 3 + 2]
            );
            dummy.updateMatrix();
            this.particles.setMatrixAt(i, dummy.matrix);
        }
        this.particles.instanceMatrix.needsUpdate = true;
    }
}

// Enhanced physics with additional forces and collision detection
function derivatives(r, v, E, B, q, m) {
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    
    // Air resistance (quadratic drag)
    const speed = norm(v);
    const dragForce = speed > 0 ? 
        multiply(-params.airDensity * params.dragCoefficient * speed, v) : 
        [0, 0, 0];

    // Electromagnetic forces
    const lorentzForce = multiply(q, add(E, cross(v, B)));
    
    // Total force composition
    const totalForce = add(
        add(
            add(lorentzForce, multiply(m, gravity)),
            externalForce
        ),
        add(
            dragForce,
            multiply(-params.friction, v) // Linear friction
        )
    );

    return [v, divide(totalForce, m)];
}

// Adaptive Runge-Kutta 4th order with error estimation
function adaptiveRungeKutta(r, v, E, B, q, m, dt) {
    let error;
    let newDt = dt;
    do {
        const k1 = derivatives(r, v, E, B, q, m);
        const k2 = derivatives(
            add(r, multiply(k1[0], newDt / 2)),
            add(v, multiply(k1[1], newDt / 2)),
            E, B, q, m
        );
        const k3 = derivatives(
            add(r, multiply(k2[0], newDt / 2)),
            add(v, multiply(k2[1], newDt / 2)),
            E, B, q, m
        );
        const k4 = derivatives(
            add(r, multiply(k3[0], newDt)),
            add(v, multiply(k3[1], newDt)),
            E, B, q, m
        );

        const dr = multiply(add(add(k1[0], multiply(4, k2[0])), k3[0]), newDt / 6);
        const dv = multiply(add(add(k1[1], multiply(4, k2[1])), k3[1]), newDt / 6);

        // Error estimation for adaptive step sizing
        const errorEstimate = Math.max(...dv.map(x => Math.abs(x * newDt)));
        error = errorEstimate;
        
        if (error > params.maxError && newDt > params.minDt) {
            newDt /= 2;
        }
    } while (error > params.maxError && newDt > params.minDt);

    return [dr, dv, newDt];
}

// Enhanced parameters with new physics options
const params = {
    // ... (keep previous parameters and add:)
    airDensity: 1.2,
    dragCoefficient: 0.47,
    maxError: 0.0001,
    minDt: 0.0001,
    fieldVisualization: true,
    particleInteraction: false,
    collisionDetection: true,
    boundingBoxSize: 50,
    timeWarp: 1.0,
    // ... rest of parameters
};

// Enhanced initialization with particle system
let particleSystem;
let fieldArrows;
let trailGeometry;
let trailMaterial;

function initializeSimulation(resetCamera = false) {
    // ... existing setup code ...

    // Initialize particle system with instanced rendering
    particleSystem = new ParticleSystem(params.particleCount, params.sphereSize, params.particleColor);
    scene.add(particleSystem.particles);

    // Initialize field visualization
    if (params.fieldVisualization) {
        fieldArrows = new THREE.Group();
        createFieldArrows();
        scene.add(fieldArrows);
    }

    // Enhanced trail system with fade effect
    trailMaterial = new THREE.LineBasicMaterial({
        color: params.trailColor,
        transparent: true,
        opacity: 0.7
    });
    trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(params.trailLength * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);

    // ... rest of initialization ...
}

// Enhanced visualization: Electric/Magnetic field arrows
function createFieldArrows() {
    const arrowLength = 2;
    const arrowColor = new THREE.Color(0xff0000);
    
    for (let x = -10; x <= 10; x += 5) {
        for (let y = -10; y <= 10; y += 5) {
            for (let z = -10; z <= 10; z += 5) {
                const direction = new THREE.Vector3(params.Bx, params.By, params.Bz).normalize();
                const arrowHelper = new THREE.ArrowHelper(
                    direction,
                    new THREE.Vector3(x, y, z),
                    arrowLength,
                    arrowColor
                );
                fieldArrows.add(arrowHelper);
            }
        }
    }
}

// Enhanced update loop with collision detection
function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed) * params.timeWarp;
    
    for (let i = 0; i < particleSystem.visibleCount; i++) {
        let [r, v] = getParticleState(i);
        let [dr, dv, newDt] = adaptiveRungeKutta(r, v, E, B, params.q, params.mass, dt);
        
        // Collision detection with bounding box
        if (params.collisionDetection) {
            const boundingBoxHalfSize = params.boundingBoxSize / 2;
            r = r.map((val, idx) => {
                if (Math.abs(val) > boundingBoxHalfSize) {
                    v[idx] *= -params.restitutionCoefficient;
                    return Math.sign(val) * boundingBoxHalfSize;
                }
                return val;
            });
        }

        // Update particle state
        setParticleState(i, add(r, dr), add(v, dv));
    }

    // Update instanced mesh positions
    particleSystem.updatePositions();

    // Update field visualization
    if (params.fieldVisualization) {
        updateFieldArrows();
    }

    // Update trail with fade effect
    updateTrail();
}

// New features: Particle interaction forces
function calculateParticleInteractions() {
    for (let i = 0; i < particleSystem.visibleCount; i++) {
        for (let j = i + 1; j < particleSystem.visibleCount; j++) {
            const r1 = getParticlePosition(i);
            const r2 = getParticlePosition(j);
            const delta = subtract(r1, r2);
            const distance = norm(delta);
            
            if (distance < params.interactionRadius) {
                const force = multiply(params.interactionStrength / (distance * distance), delta);
                applyForceToParticle(i, multiply(-1, force));
                applyForceToParticle(j, force);
            }
        }
    }
}

// Enhanced GUI with organized sections
function createEnhancedGUI() {
    const gui = new GUI({ width: 350 });
    
    const physicsFolder = gui.addFolder('Physics Settings');
    physicsFolder.add(params, 'airDensity', 0, 5).name('Air Density');
    physicsFolder.add(params, 'dragCoefficient', 0, 2).name('Drag Coefficient');
    physicsFolder.add(params, 'collisionDetection').name('Collision Detection');
    
    const visualizationFolder = gui.addFolder('Visualization');
    visualizationFolder.add(params, 'fieldVisualization').name('Show Field Arrows');
    visualizationFolder.add(params, 'trailFadeSpeed', 0.9, 1.0).name('Trail Fade Speed');
    
    const advancedFolder = gui.addFolder('Advanced');
    advancedFolder.add(params, 'maxError', 0.00001, 0.01).name('Max Simulation Error');
    advancedFolder.add(params, 'minDt', 0.00001, 0.001).name('Min Time Step');
    
    // ... add more organized controls ...
}

// Add event listeners for interactive features
function setupInteractivity() {
    renderer.domElement.addEventListener('click', (event) => {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects([particleSystem.particles]);
        if (intersects.length > 0) {
            const instanceId = intersects[0].instanceId;
            // Handle particle selection
        }
    });
}

// Initialize enhanced system
initializeSimulation(true);
setupInteractivity();
animate();





