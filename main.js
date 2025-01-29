import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/dat.gui@0.7.7';
import { cross, divide, multiply, add, subtract } from 'https://cdn.skypack.dev/mathjs@9.5.1';

function derivatives(r, v, E, B, q, m) {
    const gravity = [params.gravityX, params.gravityY, params.gravityZ];
    const externalForce = [params.externalForceX, params.externalForceY, params.externalForceZ];
    const velocityMagnitude = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
    const frictionForce = velocityMagnitude > 0 ? multiply(-params.friction, v) : [0, 0, 0];

    const lorentzForce = multiply(q, add(E, cross(v, B)));
    const totalForce = add(add(add(lorentzForce, multiply(m, gravity)), externalForce), frictionForce);
    const a = divide(totalForce, m);

    return [v, a];
}

function rungeKutta4(r, v, E, B, q, m, dt) {
    const k1 = derivatives(r, v, E, B, q, m);
    const k2 = derivatives(
        add(r, multiply(k1[0], dt / 2)),
        add(v, multiply(k1[1], dt / 2)),
        E, B, q, m
    );
    const k3 = derivatives(
        add(r, multiply(k2[0], dt / 2)),
        add(v, multiply(k2[1], dt / 2)),
        E, B, q, m
    );
    const k4 = derivatives(
        add(r, multiply(k3[0], dt)),
        add(v, multiply(k3[1], dt)),
        E, B, q, m
    );

    const dr = multiply(
        add(
            add(k1[0], multiply(2, k2[0])),
            add(multiply(2, k3[0]), k4[0])
        ),
        dt / 6
    );
    const dv = multiply(
        add(
            add(k1[1], multiply(2, k2[1])),
            add(multiply(2, k3[1]), k4[1])
        ),
        dt / 6
    );

    return [dr, dv];
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
    animationSpeed: 2,
    particleColor: 'cyan',
    trailColor: 'yellow',
    showAxes: true,
    fontSize: 0.5,
    fontColor: 'white',
    axisLabelFontSize: 1.0,
    axisNumberingDensity: 2,
    sphereSize: 0.4,
    backgroundColor: 'black',
    showSphere: true,
    showTrail: true,
    show3DGrid: false,
    gridSize: 20,
    gridDivisions: 20,
    lightIntensity: 1,
    lightColor: 'white',
    particleCount: 1,
    mass: 1.0,
    radius: 1.0,
    friction: 0.01,
    gravityX: 0.0,
    gravityY: -9.8,
    gravityZ: 0.0,
    externalForceX: 0.0,
    externalForceY: 0.0,
    externalForceZ: 0.0,
};

const gui = new GUI();
const guiFolder = gui.addFolder('Simulation Parameters');
guiFolder.add(params, 'q', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'vx', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'vy', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'vz', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'Ex', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'Ey', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'Ez', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'Bx', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'By', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'Bz', -10, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'animationSpeed', 1, 100, 1);
guiFolder.add(params, 'particleColor').onChange(initializeSimulation);
guiFolder.add(params, 'trailColor').onChange(initializeSimulation);
guiFolder.add(params, 'showAxes').onChange(initializeSimulation);
guiFolder.add(params, 'fontSize', 0.1, 2, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'fontColor').onChange(initializeSimulation);
guiFolder.add(params, 'axisLabelFontSize', 0.1, 5, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'axisNumberingDensity', 1, 50, 1).onChange(initializeSimulation);
guiFolder.add(params, 'sphereSize', 0.1, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'backgroundColor').onChange(initializeSimulation);
guiFolder.add(params, 'showSphere').onChange(initializeSimulation);
guiFolder.add(params, 'showTrail').onChange(initializeSimulation);
guiFolder.add(params, 'show3DGrid').onChange(initializeSimulation);
guiFolder.add(params, 'gridSize', 1, 100, 1).onChange(initializeSimulation);
guiFolder.add(params, 'gridDivisions', 1, 100, 1).onChange(initializeSimulation);
guiFolder.add(params, 'lightIntensity', 0, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'lightColor').onChange(initializeSimulation);
guiFolder.add(params, 'particleCount', 1, 1000, 1).onChange(initializeSimulation);
guiFolder.add(params, 'mass', 0.1, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'radius', 0.1, 10, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'friction', 0, 1, 0.01).onChange(initializeSimulation);
guiFolder.add(params, 'gravityX', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'gravityY', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'gravityZ', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'externalForceX', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'externalForceY', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add(params, 'externalForceZ', -20, 20, 0.1).onChange(initializeSimulation);
guiFolder.add({ reset: () => initializeSimulation(true) }, 'reset').name('Reset Simulation');

const baseDt = 0.01;
let r = [0.0, 0.0, 0.0];
let v = [params.vx, params.vy, params.vz];
let E = [params.Ex, params.Ey, params.Ez];
let B = [params.Bx, params.By, params.Bz];
let positions = [];

let particleSphere;
let trail;
let isPaused = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const directionalLight = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

function create3DGrid(size, divisions) {
    const gridHelper = new THREE.Group();

    const gridMaterial = new THREE.LineBasicMaterial({ color: 'gray' });
    for (let i = -divisions / 2; i <= divisions / 2; i++) {
        const offset = size / divisions * i;
        const halfSize = size / 2;
        const pointsX = [
            new THREE.Vector3(offset, -halfSize, -halfSize),
            new THREE.Vector3(offset, halfSize, -halfSize),
            new THREE.Vector3(offset, halfSize, halfSize),
            new THREE.Vector3(offset, -halfSize, halfSize),
            new THREE.Vector3(offset, -halfSize, -halfSize),
        ];
        const pointsY = [
            new THREE.Vector3(-halfSize, offset, -halfSize),
            new THREE.Vector3(halfSize, offset, -halfSize),
            new THREE.Vector3(halfSize, offset, halfSize),
            new THREE.Vector3(-halfSize, offset, halfSize),
            new THREE.Vector3(-halfSize, offset, -halfSize),
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
                size: size,
                height: 0.1
            });
            const textMaterial = new THREE.MeshBasicMaterial({ color: color });
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

        createLabel('X', [11, 0, 0], 'red', params.axisLabelFontSize);
        createLabel('Y', [0, 11, 0], 'green', params.axisLabelFontSize);
        createLabel('Z', [0, 0, 11], 'blue', params.axisLabelFontSize);
    });
}

function createAxesLines() {
    const materialX = new THREE.LineBasicMaterial({ color: 'red' });
    const materialY = new THREE.LineBasicMaterial({ color: 'green' });
    const materialZ = new THREE.LineBasicMaterial({ color: 'blue' });

    const pointsX = [new THREE.Vector3(-100, 0, 0), new THREE.Vector3(100, 0, 0)];
    const pointsY = [new THREE.Vector3(0, -100, 0), new THREE.Vector3(0, 100, 0)];
    const pointsZ = [new THREE.Vector3(0, 0, -100), new THREE.Vector3(0, 0, 100)];

    const geometryX = new THREE.BufferGeometry().setFromPoints(pointsX);
    const geometryY = new THREE.BufferGeometry().setFromPoints(pointsY);
    const geometryZ = new THREE.BufferGeometry().setFromPoints(pointsZ);

    const lineX = new THREE.Line(geometryX, materialX);
    const lineY = new THREE.Line(geometryY, materialY);
    const lineZ = new THREE.Line(geometryZ, materialZ);

    scene.add(lineX);
    scene.add(lineY);
    scene.add(lineZ);
}

function initializeSimulation(resetCamera = false) {
    scene.clear();
    directionalLight.color.set(params.lightColor);
    directionalLight.intensity = params.lightIntensity;
    scene.add(directionalLight);
    scene.add(ambientLight);

    if (resetCamera) {
        camera.position.set(0, 0, 20);
        controls.update();
    }

    if (params.showAxes) {
        createAxesLines();
        createAxesLabels();
    }

    if (params.show3DGrid) {
        scene.add(create3DGrid(params.gridSize, params.gridDivisions));
    }

    if (params.showSphere) {
        const particleGeometry = new THREE.SphereGeometry(params.sphereSize, 32, 32);
        const particleMaterial = new THREE.MeshStandardMaterial({ color: params.particleColor });
        particleSphere = new THREE.Mesh(particleGeometry, particleMaterial);
        particleSphere.castShadow = true;
        particleSphere.receiveShadow = true;
        scene.add(particleSphere);
    }

    if (params.showTrail) {
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        const trailMaterial = new THREE.LineBasicMaterial({ color: params.trailColor });
        trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
    }

    r = [0.0, 0.0, 0.0];
    v = [params.vx, params.vy, params.vz];
    E = [params.Ex, params.Ey, params.Ez];
    B = [params.Bx, params.By, params.Bz];
    positions = [];
}

function updateSimulation() {
    const dt = baseDt * (1 / params.animationSpeed);
    const m = params.mass;
    for (let step = 0; step < 10; step++) {
        const [dr, dv] = rungeKutta4(r, v, E, B, params.q, m, dt);
        r = add(r, dr);
        v = add(v, dv);
        positions.push(...r);
    }

    particleSphere.position.set(r[0], r[1], r[2]);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trail.geometry = trailGeometry;
}

function animate() {
    requestAnimationFrame(animate);
    if (!isPaused) {
        updateSimulation();
    }
    renderer.render(scene, camera);
}

initializeSimulation(true);
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        isPaused = !isPaused;
    }
});











