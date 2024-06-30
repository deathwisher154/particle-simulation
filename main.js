import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { cross, divide, multiply, add } from 'https://cdn.skypack.dev/mathjs@9.5.1';

function derivatives(r, v, E, B, q, m) {
    const F = multiply(q, add(E, cross(v, B)));
    const a = divide(F, m);
    return [v, a];
}

const m = 1.0;
const dt = 0.01;
const num_steps = 5000;  // Increased number of steps for longer animation

const q = parseFloat(prompt("Enter the charge of the particle (q): ", "1.0"));
const vx = parseFloat(prompt("Enter initial velocity vx: ", "1.0"));
const vy = parseFloat(prompt("Enter initial velocity vy: ", "1.0"));
const vz = parseFloat(prompt("Enter initial velocity vz: ", "1.0"));
const Ex = parseFloat(prompt("Enter electric field Ex: ", "0.0"));
const Ey = parseFloat(prompt("Enter electric field Ey: ", "0.0"));
const Ez = parseFloat(prompt("Enter electric field Ez: ", "0.0"));
const Bx = parseFloat(prompt("Enter magnetic field Bx: ", "0.0"));
const By = parseFloat(prompt("Enter magnetic field By: ", "0.0"));
const Bz = parseFloat(prompt("Enter magnetic field Bz: ", "1.0"));

const animationSpeed = parseInt(prompt("Enter the animation speed (milliseconds per frame, e.g., 20): ", "20"));
const particleColor = prompt("Enter the color for the particle sphere (e.g., 'cyan'): ", "cyan");
const trailColor = prompt("Enter the color for the trail (e.g., 'yellow'): ", "yellow");
const showAxes = prompt("Do you want to show the axes? (yes/no): ", "yes").toLowerCase() === 'yes';
const sphereSize = parseFloat(prompt("Enter the size of the particle sphere (e.g., 2): ", "2"));
const backgroundColor = prompt("Enter the background color (e.g., 'black'): ", "black");
const showSphere = prompt("Do you want to show the particle sphere? (yes/no): ", "yes").toLowerCase() === 'yes';
const showTrail = prompt("Do you want to show the trail? (yes/no): ", "yes").toLowerCase() === 'yes';

let r = [0.0, 0.0, 0.0];
let v = [vx, vy, vz];
const E = [Ex, Ey, Ez];
const B = [Bx, By, Bz];

const positions = Array(num_steps).fill(0).map(() => Array(3).fill(0));
positions[0] = r;

for (let i = 1; i < num_steps; i++) {
    const [k1r, k1v] = derivatives(r, v, E, B, q, m);
    const [k2r, k2v] = derivatives(add(r, multiply(0.5 * dt, k1r)), add(v, multiply(0.5 * dt, k1v)), E, B, q, m);
    const [k3r, k3v] = derivatives(add(r, multiply(0.5 * dt, k2r)), add(v, multiply(0.5 * dt, k2v)), E, B, q, m);
    const [k4r, k4v] = derivatives(add(r, multiply(dt, k3r)), add(v, multiply(dt, k3v)), E, B, q, m);
    
    r = add(r, multiply(dt / 6, add(add(add(k1r, multiply(2, k2r)), multiply(2, k3r)), k4r)));
    v = add(v, multiply(dt / 6, add(add(add(k1v, multiply(2, k2v)), multiply(2, k3v)), k4v)));
    
    positions[i] = r;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(backgroundColor);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

if (showAxes) {
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
}

let particleSphere;
if (showSphere) {
    const sphereGeometry = new THREE.SphereGeometry(sphereSize, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: particleColor });
    particleSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(particleSphere);
}

let trail;
if (showTrail) {
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(positions.map(p => new THREE.Vector3(...p)));
    const trailMaterial = new THREE.LineBasicMaterial({ color: trailColor });
    trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);
}

let frame = 0;
function animate() {
    requestAnimationFrame(animate);
    
    if (frame < num_steps) {
        if (showSphere) {
            particleSphere.position.set(...positions[frame]);
        }
        if (showTrail) {
            const segment = positions.slice(0, frame + 1);
            trail.geometry.setFromPoints(segment.map(p => new THREE.Vector3(...p)));
        }
        frame++;
    }
    
    controls.update();
    renderer.render(scene, camera);
}

animate();
