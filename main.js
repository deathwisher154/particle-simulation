

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/SMAAPass.js';
import Stats from 'https://cdn.skypack.dev/stats.js';
import { cross, add, multiply, divide } from 'https://cdn.skypack.dev/mathjs@9.5.1';

// Enhanced Configuration
const params = {
    // Core Physics
    simulationType: 'Electromagnetic',
    particleTypes: ['Sphere', 'Cube', 'Torus', 'Icosahedron'],
    particleType: 'Sphere',
    chargeDistribution: 'Uniform',
    massVariation: 0.2,
    
    // Advanced Visualization
    particleLOD: true,
    environmentMap: true,
    bloomEffect: true,
    motionBlur: false,
    depthOfField: false,
    particleGlow: true,
    starField: true,
    
    // Interactive Features
    particleExplosions: true,
    touchInteraction: false,
    particlePainting: false,
    fieldVisualization3D: true,
    
    // Performance
    instancedRendering: true,
    maxParticles: 2000,
    qualityPreset: 'High'
};

let scene, camera, renderer, composer, controls, stats;
let particles = [], particlePool = [];
let gui, particleEditor;
let lastTouch = new THREE.Vector2();
let isDragging = false;

class AdvancedParticle {
    constructor() {
        this.mesh = null;
        this.velocity = new THREE.Vector3();
        this.charge = params.q * (1 + (Math.random() - 0.5) * params.massVariation);
        this.mass = params.mass * (1 + (Math.random() - 0.5) * params.massVariation);
        this.age = 0;
        this.lifespan = Infinity;
        this.trail = [];
        this.forceFields = [];
    }
}

function initAdvancedScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000);
    camera.position.set(50, 50, 50);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Post-processing pipeline
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    composer.addPass(bloomPass);
    
    const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
    composer.addPass(smaaPass);

    // Environment
    if(params.environmentMap) {
        const envTexture = new THREE.CubeTextureLoader()
            .load([
                'px.jpg', 'nx.jpg',
                'py.jpg', 'ny.jpg',
                'pz.jpg', 'nz.jpg'
            ], () => scene.background = envTexture);
    }

    // Interactive lighting
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
    light.position.set(0, 100, 0);
    scene.add(light);
}

function createParticleGeometry(type) {
    switch(type) {
        case 'Cube': return new THREE.BoxGeometry(1, 1, 1);
        case 'Torus': return new THREE.TorusGeometry(0.5, 0.2, 16, 100);
        case 'Icosahedron': return new THREE.IcosahedronGeometry(0.8);
        default: return new THREE.SphereGeometry(0.5);
    }
}

function createParticleMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: 0x00ffff,
        metalness: 0.5,
        roughness: 0.1,
        transparent: true,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5
    });
}

function initParticleSystem() {
    // Create particle pool
    for(let i = 0; i < params.maxParticles; i++) {
        const particle = new AdvancedParticle();
        particle.mesh = new THREE.Mesh(createParticleGeometry(params.particleType), createParticleMaterial());
        particle.mesh.visible = false;
        scene.add(particle.mesh);
        particlePool.push(particle);
    }
}

function spawnParticle(position, velocity) {
    const particle = particlePool.find(p => !p.mesh.visible);
    if(particle) {
        particle.mesh.position.copy(position);
        particle.velocity.copy(velocity);
        particle.mesh.visible = true;
        particles.push(particle);
    }
}

function createInteractiveUI() {
    gui = new GUI({ width: 300 });
    
    // Simulation Control Panel
    const simCtrl = gui.addFolder('Simulation Control');
    simCtrl.add(params, 'simulationType', ['Electromagnetic', 'Fluid', 'Gravitational']);
    simCtrl.add(params, 'qualityPreset', ['Low', 'Medium', 'High']).onChange(updateQuality);
    simCtrl.add(params, 'maxParticles', 100, 10000).step(100);
    simCtrl.add({ reset: () => particles = [] }, 'reset').name('Clear Particles');
    
    // Particle Design Panel
    const design = gui.addFolder('Particle Design');
    design.add(params, 'particleType', params.particleTypes).onChange(updateParticleGeometry);
    design.addColor({ color: 0x00ffff }, 'color').onChange(v => particlePool.forEach(p => p.mesh.material.color.set(v)));
    design.add(params, 'particleGlow');
    design.add(params, 'particleLOD');
    
    // Environmental Effects
    const env = gui.addFolder('Environment Effects');
    env.add(params, 'environmentMap').onChange(v => scene.background = v ? new THREE.Color(0x000000) : null);
    env.add(params, 'starField').onChange(toggleStarField);
    env.add(params, 'bloomEffect').onChange(v => composer.passes[1].enabled = v);
    env.add(params, 'motionBlur');
    
    // Advanced Physics
    const physics = gui.addFolder('Advanced Physics');
    physics.add(params, 'chargeDistribution', ['Uniform', 'Random', 'Bipolar']);
    physics.add(params, 'massVariation', 0, 1).step(0.1);
    physics.add(params, 'particleExplosions');
    
    // Interactive Tools
    const tools = gui.addFolder('Interactive Tools');
    tools.add(params, 'touchInteraction').onChange(v => {
        if(v) initTouchControls();
    });
    tools.add(params, 'particlePainting');
    tools.add(params, 'fieldVisualization3D');
    
    gui.close();
}

function updateQuality() {
    switch(params.qualityPreset) {
        case 'High':
            renderer.setPixelRatio(window.devicePixelRatio);
            composer.passes[1].strength = 1.5;
            break;
        case 'Medium':
            renderer.setPixelRatio(1);
            composer.passes[1].strength = 1.0;
            break;
        case 'Low':
            renderer.setPixelRatio(0.75);
            composer.passes[1].strength = 0.5;
            break;
    }
}

function initTouchControls() {
    renderer.domElement.addEventListener('pointerdown', onPointerStart);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerEnd);
}

function onPointerStart(event) {
    isDragging = true;
    lastTouch.set(event.clientX, event.clientY);
}

function onPointerMove(event) {
    if(!isDragging) return;
    
    const delta = new THREE.Vector2(
        event.clientX - lastTouch.x,
        event.clientY - lastTouch.y
    );
    
    if(params.particlePainting) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        
        if(intersects.length > 0) {
            spawnParticle(intersects[0].point, new THREE.Vector3());
        }
    }
    
    lastTouch.set(event.clientX, event.clientY);
}

function onPointerEnd() {
    isDragging = false;
}

function toggleStarField(enable) {
    if(enable) {
        const stars = new THREE.BufferGeometry();
        const starPositions = [];
        
        for(let i = 0; i < 10000; i++) {
            starPositions.push(
                Math.random() * 2000 - 1000,
                Math.random() * 2000 - 1000,
                Math.random() * 2000 - 1000
            );
        }
        
        stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.1 });
        const starField = new THREE.Points(stars, starMaterial);
        scene.add(starField);
    } else {
        scene.children.filter(c => c.type === 'Points').forEach(c => scene.remove(c));
    }
}

function updateParticleSystem(delta) {
    particles.forEach((particle, index) => {
        // Advanced physics integration
        const forces = calculateForces(particle);
        const acceleration = forces.divideScalar(particle.mass);
        particle.velocity.add(acceleration.multiplyScalar(delta));
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));
        
        // Particle aging and recycling
        particle.age += delta;
        if(particle.age > particle.lifespan) {
            particle.mesh.visible = false;
            particles.splice(index, 1);
        }
        
        // Visual effects
        if(params.particleGlow) {
            particle.mesh.material.emissiveIntensity = Math.sin(particle.age * 5) * 0.5 + 0.5;
        }
    });
}

function calculateForces(particle) {
    const force = new THREE.Vector3();
    
    // Electromagnetic forces
    if(params.simulationType === 'Electromagnetic') {
        const E = new THREE.Vector3(params.Ex, params.Ey, params.Ez);
        const B = new THREE.Vector3(params.Bx, params.By, params.Bz);
        const lorentz = E.clone().add(particle.velocity.clone().cross(B)).multiplyScalar(particle.charge);
        force.add(lorentz);
    }
    
    // Particle interactions
    if(params.chargeDistribution !== 'Uniform') {
        particles.forEach(other => {
            if(particle !== other) {
                const dir = other.mesh.position.clone().sub(particle.mesh.position);
                const distance = dir.length();
                if(distance < 5) {
                    const strength = (particle.charge * other.charge) / (distance * distance);
                    force.add(dir.normalize().multiplyScalar(strength));
                }
            }
        });
    }
    
    return force;
}

function animate() {
    requestAnimationFrame(animate);
    stats.begin();
    
    const delta = 0.016;
    if(!params.isPaused) {
        updateParticleSystem(delta);
    }
    
    controls.update();
    composer.render();
    stats.end();
}

// Initialize the enhanced system
initAdvancedScene();
initParticleSystem();
createInteractiveUI();
toggleStarField(params.starField);

stats = new Stats();
document.body.appendChild(stats.dom);

controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();



