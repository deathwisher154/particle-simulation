import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add } from 'https://cdn.skypack.dev/mathjs@9.5.1';

function derivatives(r, v, E, B, q, m) {
    const F = multiply(q, add(E, cross(v, B)));
    const a = divide(F, m);
    return [v, a];
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
    animationSpeed: 20,
    particleColor: 'cyan',
    trailColor: 'yellow',
    showAxes: true,
    sphereSize: 2,
    backgroundColor: 'black',
    showSphere: true,
    showTrail: true
};

const gui = new GUI();
gui.add(params, 'q', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'vx', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'vy', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'vz', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'Ex', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'Ey', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'Ez', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'Bx', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'By', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'Bz', -10, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'animationSpeed', 1, 100, 1);
gui.add(params, 'particleColor').onChange(initializeSimulation);
gui.add(params, 'trailColor').onChange(initializeSimulation);
gui.add(params, 'showAxes').onChange(initializeSimulation);
gui.add(params, 'sphereSize', 0.1, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'backgroundColor').onChange(initializeSimulation);
gui.add(params, 'showSphere').onChange(initializeSimulation);
gui.add(params, 'showTrail').onChange(initializeSimulation);

const m = 1.0;
const dt = 0.01;
const num_steps = 5000;

let positions = [];
let particleSphere;
let trail;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

function initializeSimulation() {
    scene.background = new THREE.Color(params.backgroundColor);
    
    // Remove existing objects
    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }

    if (params.showAxes) {
        const axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);
    }

    // Recalculate positions
    let r = [0.0, 0.0, 0.0];
    let v = [params.vx, params.vy, params.vz];
    const E = [params.Ex, params.Ey, params.Ez];
    const B = [params.Bx, params.By, params.Bz];

    positions = Array(num_steps).fill(0).map(() => Array(3).fill(0));
    positions[0] = r;

    for (let i = 1; i < num_steps; i++) {
        const [k1r, k1v] = derivatives(r, v, E, B, params.q, m);
        const [k2r, k2v] = derivatives(add(r, multiply(0.5 * dt, k1r)), add(v, multiply(0.5 * dt, k1v)), E, B, params.q, m);
        const [k3r, k3v] = derivatives(add(r, multiply(0.5 * dt, k2r)), add(v, multiply(0.5 * dt, k2v)), E, B, params.q, m);
        const [k4r, k4v] = derivatives(add(r, multiply(dt, k3r)), add(v, multiply(dt, k3v)), E, B, params.q, m);
        
        r = add(r, multiply(dt / 6, add(add(add(k1r, multiply(2, k2r)), multiply(2, k3r)), k4r)));
        v = add(v, multiply(dt / 6, add(add(add(k1v, multiply(2, k2v)), multiply(2, k3v)), k4v)));
        
        positions[i] = r;
    }

    if (params.showSphere) {
        const sphereGeometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: params.particleColor });
        particleSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(particleSphere);
    }

    if (params.showTrail) {
        const trailGeometry = new THREE.BufferGeometry().setFromPoints(positions.map(p => new THREE.Vector3(...p)));
        const trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor });
        trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
    }
}

initializeSimulation();

let frame = 0;
function animate() {
    requestAnimationFrame(animate);
    
    if (frame < num_steps) {
        if (params.showSphere && particleSphere) {
            particleSphere.position.set(...positions[frame]);
        }
        if (params.showTrail && trail) {
            const segment = positions.slice(0, frame + 1);
            trail.geometry.setFromPoints(segment.map(p => new THREE.Vector3(...p)));
        }
        frame++;
    }
    
    controls.update();
    renderer.render(scene, camera);
}

animate();
