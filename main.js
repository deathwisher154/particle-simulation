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
    animationSpeed: 2, // Changed default animation speed
    particleColor: 'cyan',
    trailColor: 'yellow',
    showAxes: true,
    fontSize: 0.5,
    fontColor: 'white',
    axisLabelFontSize: 1.0, // Changed default axis label size
    axisNumberingDensity: 2, // Changed default axis numbering density
    sphereSize: 0.4, // Changed default sphere size
    backgroundColor: 'black',
    showSphere: true,
    showTrail: true,
    show3DGrid: false // Changed default to not show 3D grid
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
gui.add(params, 'fontSize', 0.1, 2, 0.1).onChange(initializeSimulation);
gui.add(params, 'fontColor').onChange(initializeSimulation);
gui.add(params, 'axisLabelFontSize', 0.1, 5, 0.1).onChange(initializeSimulation); // GUI control for axis label size
gui.add(params, 'axisNumberingDensity', 1, 50, 1).onChange(initializeSimulation);
gui.add(params, 'sphereSize', 0.1, 10, 0.1).onChange(initializeSimulation);
gui.add(params, 'backgroundColor').onChange(initializeSimulation);
gui.add(params, 'showSphere').onChange(initializeSimulation);
gui.add(params, 'showTrail').onChange(initializeSimulation);
gui.add(params, 'show3DGrid').onChange(initializeSimulation);
gui.add({ reset: () => initializeSimulation(true) }, 'reset').name('Reset Simulation');

const m = 1.0;
const baseDt = 0.01;
let r = [0.0, 0.0, 0.0];
let v = [params.vx, params.vy, params.vz];
let E = [params.Ex, params.Ey, params.Ez];
let B = [params.Bx, params.By, params.Bz];
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

function create3DGrid(size, divisions) {
    const gridHelper = new THREE.Group();
    const step = size / divisions;
    const halfSize = size / 2;

    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });

    for (let i = 0; i <= divisions; i++) {
        const offset = -halfSize + i * step;
        
        const pointsX = [
            new THREE.Vector3(-halfSize, offset, -halfSize),
            new THREE.Vector3(halfSize, offset, -halfSize),
            new THREE.Vector3(halfSize, offset, halfSize),
            new THREE.Vector3(-halfSize, offset, halfSize),
            new THREE.Vector3(-halfSize, offset, -halfSize),
        ];

        const pointsY = [
            new THREE.Vector3(offset, -halfSize, -halfSize),
            new THREE.Vector3(offset, halfSize, -halfSize),
            new THREE.Vector3(offset, halfSize, halfSize),
            new THREE.Vector3(offset, -halfSize, halfSize),
            new THREE.Vector3(offset, -halfSize, -halfSize),
        ];

        const pointsZ = [
            new THREE.Vector3(-halfSize, -halfSize, offset),
            new THREE.Vector3(halfSize, -halfSize, offset),
            new THREE.Vector3(halfSize, halfSize, offset),
            new THREE.Vector3(-halfSize, halfSize, offset),
            new THREE.Vector3(-halfSize, -halfSize, offset),
        ];

        const geometryX = new THREE.BufferGeometry().setFromPoints(pointsX);
        const geometryY = new THREE.BufferGeometry().setFromPoints(pointsY);
        const geometryZ = new THREE.BufferGeometry().setFromPoints(pointsZ);

        const lineX = new THREE.Line(geometryX, gridMaterial);
        const lineY = new THREE.Line(geometryY, gridMaterial);
        const lineZ = new THREE.Line(geometryZ, gridMaterial);

        gridHelper.add(lineX);
        gridHelper.add(lineY);
        gridHelper.add(lineZ);
    }

    return gridHelper;
}

function createAxesLabels() {
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
        const createLabel = (text, position, color, size) => {
            const textGeometry = new THREE.TextGeometry(text, {
                font: font,
                size: size, // Use the provided size for the label
                height: 0.1
            });
            const textMaterial = new THREE.MeshBasicMaterial({ color: color }); // Use the provided color for the label
            const mesh = new THREE.Mesh(textGeometry, textMaterial);
            mesh.position.set(...position);
            scene.add(mesh);
        };

        const density = params.axisNumberingDensity;
        for (let i = -100; i <= 100; i += density) {
            createLabel(i.toString(), [i, 0, 0], params.fontColor, params.fontSize);
            createLabel(i.toString(), [0, i, 0], params.fontColor, params.fontSize);
            createLabel(i.toString(), [0, 0, i], params.fontColor, params.fontSize);
        }

        // Axis Labels (closer to the axis, e.g., 10 units away)
        createLabel('X', [10, 0, 0], 'green', params.axisLabelFontSize);
        createLabel('Y', [0, 10, 0], 'green', params.axisLabelFontSize);
        createLabel('Z', [0, 0, 10], 'green', params.axisLabelFontSize);
    });
}

function initializeSimulation(reset = false) {
    scene.background = new THREE.Color(params.backgroundColor);
    
    // Remove existing objects
    while (scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }

    if (params.showAxes) {
        const axesHelper = new THREE.AxesHelper(100); // Extend axes length
        scene.add(axesHelper);
        createAxesLabels();
    }

    if (params.show3DGrid) { // Add 3D grid
        const gridHelper = create3DGrid(20, 20);
        scene.add(gridHelper);
    }

    if (params.showSphere) {
        const sphereGeometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: params.particleColor });
        particleSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(particleSphere);
    }

    if (params.showTrail) {
        trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: params.trailColor })
        );
        scene.add(trail);
    }

    if (reset) {
        r = [0.0, 0.0, 0.0];
        v = [params.vx, params.vy, params.vz];
        E = [params.Ex, params.Ey, params.Ez];
        B = [params.Bx, params.By, params.Bz];
        positions = [[...r]];
        frame = 0; // Reset the animation frame counter
    }
}

initializeSimulation();

let frame = 0;
function animate() {
    requestAnimationFrame(animate);

    const dt = baseDt * params.animationSpeed;
    const [k1r, k1v] = derivatives(r, v, E, B, params.q, m);
    const [k2r, k2v] = derivatives(add(r, multiply(0.5 * dt, k1r)), add(v, multiply(0.5 * dt, k1v)), E, B, params.q, m);
    const [k3r, k3v] = derivatives(add(r, multiply(0.5 * dt, k2r)), add(v, multiply(0.5 * dt, k2v)), E, B, params.q, m);
    const [k4r, k4v] = derivatives(add(r, multiply(dt, k3r)), add(v, multiply(dt, k3v)), E, B, params.q, m);
    
    r = add(r, multiply(dt / 6, add(add(add(k1r, multiply(2, k2r)), multiply(2, k3r)), k4r)));
    v = add(v, multiply(dt / 6, add(add(add(k1v, multiply(2, k2v)), multiply(2, k3v)), k4v)));

    positions.push([...r]);

    if (params.showSphere && particleSphere) {
        particleSphere.position.set(...r);
    }
    if (params.showTrail && trail) {
        trail.geometry.setFromPoints(positions.map(p => new THREE.Vector3(...p)));
    }
    
    frame += dt;
    controls.update();
    renderer.render(scene, camera);
}

animate();

