import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract, norm } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// ======== FIXED PARTICLE SYSTEM ========
class ParticleSystem {
    constructor(count, size, color) {
        this.geometry = new THREE.SphereGeometry(size, 16, 16);
        this.material = new THREE.MeshStandardMaterial({ color });
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
        this.count = count;
        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        
        // Initialize positions and velocities
        for(let i = 0; i < count; i++) {
            this.positions.set([0, 0, 0], i * 3);
            this.velocities.set([params.vx, params.vy, params.vz], i * 3);
        }
    }

    updateInstances() {
        for(let i = 0; i < this.count; i++) {
            this.dummy.position.set(
                this.positions[i * 3],
                this.positions[i * 3 + 1],
                this.positions[i * 3 + 2]
            );
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

// ======== FIXED PHYSICS CALCULATIONS ========
function adaptiveRungeKutta(r, v, E, B, q, m, dt) {
    const k1 = derivatives(r, v, E, B, q, m);
    const k2 = derivatives(
        add(r, multiply(k1[0], dt/2)),
        add(v, multiply(k1[1], dt/2)),
        E, B, q, m
    );
    const k3 = derivatives(
        add(r, multiply(k2[0], dt/2)),
        add(v, multiply(k2[1], dt/2)),
        E, B, q, m
    );
    const k4 = derivatives(
        add(r, multiply(k3[0], dt)),
        add(v, multiply(k3[1], dt)),
        E, B, q, m
    );

    const dr = multiply(
        add(add(k1[0], multiply(2, k2[0])), add(multiply(2, k3[0]), k4[0])),
        dt / 6
    );
    
    const dv = multiply(
        add(add(k1[1], multiply(2, k2[1])), add(multiply(2, k3[1]), k4[1])),
        dt / 6
    );

    return [dr, dv];
}

// ======== FIXED SIMULATION PARAMETERS ========
const params = {
    // ... keep original parameters ...
    airDensity: 1.2,
    dragCoefficient: 0.47,
    restitutionCoefficient: 0.8,
    trailLength: 1000,
    interactionRadius: 5.0,
    interactionStrength: 0.1,
    maxError: 0.0001,
    minDt: 0.0001,
    fieldVisualization: true,
    particleInteraction: false,
    collisionDetection: true,
    boundingBoxSize: 50,
    timeWarp: 1.0
};

// ======== FIXED INITIALIZATION ========
let particleSystem, fieldArrows, trail;

function initializeSimulation(resetCamera = false) {
    // Clear existing objects
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }

    // Initialize particle system
    particleSystem = new ParticleSystem(params.particleCount, params.sphereSize, params.particleColor);
    scene.add(particleSystem.mesh);

    // Initialize trail
    const trailPositions = new Float32Array(params.trailLength * 3);
    trail = new THREE.Line(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(trailPositions, 3)),
        new THREE.LineBasicMaterial({ color: params.trailColor })
    );
    scene.add(trail);

    // Add lights back
    scene.add(directionalLight);
    scene.add(ambientLight);
}

// ======== FIXED UPDATE LOOP ========
function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed) * params.timeWarp;
    const boundingBoxHalf = params.boundingBoxSize / 2;
    
    for(let i = 0; i < particleSystem.count; i++) {
        let r = Array.from(particleSystem.positions.subarray(i*3, i*3+3));
        let v = Array.from(particleSystem.velocities.subarray(i*3, i*3+3));
        
        // Physics step
        const [dr, dv] = adaptiveRungeKutta(
            r,
            v,
            [params.Ex, params.Ey, params.Ez],
            [params.Bx, params.By, params.Bz],
            params.q,
            params.mass,
            dt
        );
        
        // Update position and velocity
        const newR = add(r, dr);
        const newV = add(v, dv);

        // Collision detection
        if(params.collisionDetection) {
            newR.forEach((val, idx) => {
                if(Math.abs(val) > boundingBoxHalf) {
                    newV[idx] *= -params.restitutionCoefficient;
                    newR[idx] = Math.sign(val) * boundingBoxHalf;
                }
            });
        }

        // Store updated values
        particleSystem.positions.set(newR, i*3);
        particleSystem.velocities.set(newV, i*3);
    }

    // Update instances and trail
    particleSystem.updateInstances();
    updateTrail();
}

// ======== FIXED TRAIL UPDATE ========
function updateTrail() {
    const positions = trail.geometry.attributes.position.array;
    
    // Shift old positions
    positions.copyWithin(0, 3, positions.length);
    
    // Add new position at head
    const headPos = particleSystem.positions.subarray(0, 3);
    positions.set(headPos, positions.length - 3);
    
    trail.geometry.attributes.position.needsUpdate = true;
}

// ======== MAIN EXECUTION ========
initializeSimulation(true);
animate();





