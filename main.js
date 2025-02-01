import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';

// Custom vector math functions to replace math.js
const vec3 = {
    add: (a, b, dst = new Array(3)) => {
        dst[0] = a[0] + b[0];
        dst[1] = a[1] + b[1];
        dst[2] = a[2] + b[2];
        return dst;
    },
    multiply: (a, s, dst = new Array(3)) => {
        dst[0] = a[0] * s;
        dst[1] = a[1] * s;
        dst[2] = a[2] * s;
        return dst;
    },
    cross: (a, b, dst = new Array(3)) => {
        dst[0] = a[1] * b[2] - a[2] * b[1];
        dst[1] = a[2] * b[0] - a[0] * b[2];
        dst[2] = a[0] * b[1] - a[1] * b[0];
        return dst;
    }
};

// Pre-allocated arrays for RK4 calculations
const _tempVec1 = new Array(3);
const _tempVec2 = new Array(3);
const _tempVec3 = new Array(3);

function derivatives(r, v, E, B, q, m, gravity, friction, externalForce, a) {
    // Lorentz force: q(E + v × B)
    vec3.cross(v, B, _tempVec1);
    vec3.add(E, _tempVec1, _tempVec2);
    vec3.multiply(_tempVec2, q, _tempVec3);
    
    // Total force: Lorentz + gravity + external + friction
    vec3.multiply(gravity, m, _tempVec1);
    vec3.add(_tempVec3, _tempVec1, _tempVec2);
    vec3.add(_tempVec2, externalForce, _tempVec1);
    vec3.add(_tempVec1, friction, a);
    
    return a;
}

function rungeKutta4(r, v, E, B, q, m, dt, gravity, friction, externalForce) {
    const k1v = v.slice();
    const k1a = derivatives(r, v, E, B, q, m, gravity, friction, externalForce, new Array(3));
    
    const k2r = vec3.add(r, vec3.multiply(k1v, dt/2, _tempVec1), new Array(3));
    const k2v = vec3.add(v, vec3.multiply(k1a, dt/2, _tempVec1), new Array(3));
    const k2a = derivatives(k2r, k2v, E, B, q, m, gravity, friction, externalForce, new Array(3));
    
    const k3r = vec3.add(r, vec3.multiply(k2v, dt/2, _tempVec1), new Array(3));
    const k3v = vec3.add(v, vec3.multiply(k2a, dt/2, _tempVec1), new Array(3));
    const k3a = derivatives(k3r, k3v, E, B, q, m, gravity, friction, externalForce, new Array(3));
    
    const k4r = vec3.add(r, vec3.multiply(k3v, dt, _tempVec1), new Array(3));
    const k4v = vec3.add(v, vec3.multiply(k3a, dt, _tempVec1), new Array(3));
    const k4a = derivatives(k4r, k4v, E, B, q, m, gravity, friction, externalForce, new Array(3));

    const dr = vec3.multiply(
        vec3.add(
            vec3.add(k1v, vec3.multiply(k2v, 2, _tempVec1), _tempVec2),
            vec3.add(vec3.multiply(k3v, 2, _tempVec3), k4v, _tempVec1),
            _tempVec2
        ),
        dt/6,
        _tempVec1
    );
    
    const dv = vec3.multiply(
        vec3.add(
            vec3.add(k1a, vec3.multiply(k2a, 2, _tempVec1), _tempVec2),
            vec3.add(vec3.multiply(k3a, 2, _tempVec3), k4a, _tempVec1),
            _tempVec2
        ),
        dt/6,
        _tempVec3
    );

    return [dr, dv];
}

// Parameters and GUI setup remains mostly the same, but with optimized callbacks
const params = { /* ... keep original params ... */ };

class SimulationSystem {
    constructor() {
        this.geometryCache = new Map();
        this.font = null;
        this.trailPositions = new Float32Array(3000); // Max 1000 points
        this.trailIndex = 0;
        
        this.initThree();
        this.loadFont();
        this.setupGUI();
        this.initializeSimulation(true);
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // ... rest of Three.js initialization ...
    }

    loadFont() {
        new THREE.FontLoader().load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', font => {
            this.font = font;
            this.createAxesLabels();
        });
    }

    getGeometry(type, params) {
        const key = JSON.stringify([type, params]);
        if (!this.geometryCache.has(key)) {
            switch(type) {
                case 'sphere': 
                    this.geometryCache.set(key, new THREE.SphereGeometry(...params));
                    break;
                // Add other geometry types as needed
            }
        }
        return this.geometryCache.get(key).clone();
    }

    initializeSimulation(resetCamera = false) {
        // Optimized scene clearing with object reuse
        while(this.scene.children.length > 0) { 
            this.scene.remove(this.scene.children[0]); 
        }
        
        // Reuse lights instead of recreating
        this.directionalLight = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
        // ... rest of initialization with object reuse ...
    }

    updateSimulation() {
        const dt = baseDt * (1 / params.animationSpeed);
        const gravity = [params.gravityX, params.gravityY, params.gravityZ];
        const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
        const friction = vec3.multiply(v, -params.friction, _tempVec1);
        
        // Single RK4 step per frame with larger dt
        const [dr, dv] = rungeKutta4(r, v, E, B, params.q, params.mass, dt, 
            gravity, friction, externalForce);
        
        vec3.add(r, dr, r);
        vec3.add(v, dv, v);

        // Update trail positions in circular buffer
        const baseIndex = this.trailIndex * 3;
        this.trailPositions[baseIndex] = r[0];
        this.trailPositions[baseIndex + 1] = r[1];
        this.trailPositions[baseIndex + 2] = r[2];
        
        this.trailIndex = (this.trailIndex + 1) % 1000;
        this.trail.geometry.attributes.position.needsUpdate = true;
    }
}

// Initialize the optimized system
const simSystem = new SimulationSystem();
animate();

// Remaining helper functions and event listeners...

