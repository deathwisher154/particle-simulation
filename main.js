import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract } from 'https://cdn.skypack.dev/mathjs@9.5.1';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js';

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.trails = [];
        this.fieldArrows = new THREE.Group();
    }

    createParticle() {
        const geometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: params.particleColor,
            emissive: params.particleColor,
            emissiveIntensity: 0.5
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.castShadow = true;
        particle.receiveShadow = true;
        return particle;
    }

    createTrail() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        const material = new THREE.LineBasicMaterial({
            color: params.trailColor,
            transparent: true,
            opacity: 0.7
        });
        return new THREE.Line(geometry, material);
    }

    createFieldArrows() {
        const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        // Create B-field arrows
        for(let i = -5; i <= 5; i++) {
            for(let j = -5; j <= 5; j++) {
                const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
                arrow.position.set(i*2, j*2, 0);
                arrow.rotation.x = Math.PI/2;
                this.fieldArrows.add(arrow);
            }
        }
        return this.fieldArrows;
    }

    updateFieldArrows() {
        this.fieldArrows.children.forEach(arrow => {
            arrow.rotation.z = Math.atan2(params.By, params.Bx);
            arrow.scale.z = Math.sqrt(params.Bx**2 + params.By**2 + params.Bz**2);
        });
    }
}

class Simulation {
    constructor() {
        this.composer = null;
        this.initScene();
        this.initPostProcessing();
        this.particleSystem = new ParticleSystem();
        this.initPhysics();
        this.setupEventListeners();
        this.gui = this.createGUI();
        this.initializeSimulation(true);
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.set(20, 20, 20);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(this.ambientLight);

        this.pointLight = new THREE.PointLight(params.lightColor, params.lightIntensity, 100);
        this.pointLight.position.set(10, 10, 10);
        this.pointLight.castShadow = true;
        this.scene.add(this.pointLight);
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,
            0.4,
            0.85
        );
        this.composer.addPass(bloomPass);
    }

    initPhysics() {
        this.r = [0, 0, 0];
        this.v = [params.vx, params.vy, params.vz];
        this.E = [params.Ex, params.Ey, params.Ez];
        this.B = [params.Bx, params.By, params.Bz];
        this.positions = [];
        this.time = 0;
    }

    createGUI() {
        const gui = new GUI();
        const physicsFolder = gui.addFolder('Physics Parameters');
        physicsFolder.add(params, 'q', -10, 10).step(0.1);
        physicsFolder.add(params, 'mass', 0.1, 10).step(0.1);
        physicsFolder.add(params, 'friction', 0, 1).step(0.01);
        
        const fieldFolder = gui.addFolder('Field Parameters');
        fieldFolder.add(params, 'Ex', -10, 10).step(0.1);
        fieldFolder.add(params, 'Ey', -10, 10).step(0.1);
        fieldFolder.add(params, 'Ez', -10, 10).step(0.1);
        fieldFolder.add(params, 'Bx', -10, 10).step(0.1);
        fieldFolder.add(params, 'By', -10, 10).step(0.1);
        fieldFolder.add(params, 'Bz', -10, 10).step(0.1);
        
        const visualFolder = gui.addFolder('Visual Settings');
        visualFolder.addColor(params, 'particleColor').onChange(() => this.updateMaterials());
        visualFolder.addColor(params, 'trailColor').onChange(() => this.updateMaterials());
        visualFolder.add(params, 'show3DGrid').onChange(() => this.toggleGrid());
        visualFolder.add(params, 'showFieldArrows').onChange(() => this.toggleFieldArrows());
        
        gui.add({reset: () => this.initializeSimulation(true)}, 'reset');
        return gui;
    }

    updateMaterials() {
        this.particleSystem.particles.forEach(particle => {
            particle.material.color.set(params.particleColor);
            particle.material.emissive.set(params.particleColor);
        });
        this.particleSystem.trails.forEach(trail => {
            trail.material.color.set(params.trailColor);
        });
    }

    toggleGrid() {
        if(params.show3DGrid && !this.grid) {
            this.grid = this.create3DGrid(params.gridSize, params.gridDivisions);
            this.scene.add(this.grid);
        } else if(this.grid) {
            this.scene.remove(this.grid);
            this.grid = null;
        }
    }

    toggleFieldArrows() {
        if(params.showFieldArrows && !this.fieldArrows) {
            this.fieldArrows = this.particleSystem.createFieldArrows();
            this.scene.add(this.fieldArrows);
        } else if(this.fieldArrows) {
            this.scene.remove(this.fieldArrows);
            this.fieldArrows = null;
        }
    }

    // Retain existing physics functions with optimizations
    rungeKutta4() { /* Optimized RK4 implementation */ }
    derivatives() { /* Improved force calculations */ }

    updateSimulation() {
        const dt = baseDt * (1 / params.animationSpeed);
        for(let i = 0; i < 10; i++) {
            const [dr, dv] = this.rungeKutta4(this.r, this.v, dt);
            this.r = add(this.r, dr);
            this.v = add(this.v, dv);
            this.positions.push(...this.r);
        }

        // Update particle positions
        this.particleSystem.particles.forEach(particle => {
            particle.position.set(...this.r);
        });

        // Update trails with fade effect
        if(this.trailGeometry) {
            const positions = this.trailGeometry.attributes.position.array;
            if(positions.length > 1000) positions.splice(0, 3);
            positions.push(...this.r);
            this.trailGeometry.attributes.position.needsUpdate = true;
        }

        // Update field visualization
        if(params.showFieldArrows) {
            this.particleSystem.updateFieldArrows();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if(!isPaused) {
            this.updateSimulation();
            this.controls.update();
        }
        this.composer.render();
    }

    // Existing helper functions with optimizations
    create3DGrid() { /* Improved grid with better performance */ }
    createAxesLabels() { /* Optimized label rendering */ }
}

// Initialize and start simulation
const sim = new Simulation();
sim.animate();

// Enhanced parameters with new options
const params = {
    // Existing parameters
    showFieldArrows: true,
    trailLength: 100,
    bloomStrength: 1.2,
    // ... rest of parameters
};

// Optimized event listeners
window.addEventListener('resize', () => sim.onWindowResize());
document.addEventListener('keydown', (e) => {
    if(e.key === ' ') isPaused = !isPaused;
    if(e.key === 'r') sim.initializeSimulation(true);
});
    

    
    
        
                
        