// main.js

import * as THREE from 'https://esm.sh/three@0.128.0';
import { OrbitControls } from 'https://esm.sh/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://esm.sh/dat.gui@0.7.7/build/dat.gui.module.js';

/**
 * Global parameters
 */
const params = {
  q: 1.0,
  mass: 1.0,
  friction: 0.05,
  particleCount: 3,
  animationSpeed: 2,
  radius: 0.3,
  trailPersistence: false,
  backgroundColor: '#000000',
  particleColor: '#00ffff',
  trailColor: '#ffff00',
  showAxes: true,
  showTrail: true,
  showSpheres: true,
  showGrid: false,
  Ex: 0.0, Ey: 0.0, Ez: 0.0,
  Bx: 0.0, By: 0.0, Bz: 0.0,
  initVx: 1.0, initVy: 0.0, initVz: 0.0,
  k_e: 1.0,
  randomCharge: false,
};

//
// Three.js setup
//
const scene = new THREE.Scene();
scene.background = new THREE.Color(params.backgroundColor);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1_000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0x404040, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

//
// Helpers
//
let axesGroup = null;
let gridHelper = null;

function createLabeledAxes(size = 10) {
  const group = new THREE.Group();

  const matX = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const matY = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const matZ = new THREE.LineBasicMaterial({ color: 0x0000ff });

  const line = (a, b, mat) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, mat);
    l.frustumCulled = false;
    return l;
  };

  group.add(line(new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 0, 0), matX));
  group.add(line(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size, 0), matY));
  group.add(line(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, size), matZ));

  function makeLabel(text, color) {
    const canvas = document.createElement('canvas');
    const S = 128;
    canvas.width = S; canvas.height = S;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.font = 'Bold 70px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, S / 2, S / 2);

    const tex = new THREE.CanvasTexture(canvas);
    const sprMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(sprMat);
    sprite.scale.set(1.5, 1.5, 1.5);
    return sprite;
  }

  const labelX = makeLabel('X', '#ff0000');
  labelX.position.set(size + 0.7, 0, 0);
  const labelY = makeLabel('Y', '#00ff00');
  labelY.position.set(0, size + 0.7, 0);
  const labelZ = makeLabel('Z', '#0000ff');
  labelZ.position.set(0, 0, size + 0.7);
  group.add(labelX, labelY, labelZ);

  return group;
}

function setAxesVisibility(visible) {
  if (visible) {
    if (!axesGroup) {
      axesGroup = createLabeledAxes(10);
      scene.add(axesGroup);
    } else {
      axesGroup.visible = true;
    }
  } else if (axesGroup) {
    axesGroup.visible = false;
  }
}

function setGridVisibility(visible) {
  if (visible) {
    if (!gridHelper) {
      gridHelper = new THREE.GridHelper(20, 20);
      scene.add(gridHelper);
    } else {
      gridHelper.visible = true;
    }
  } else if (gridHelper) {
    gridHelper.visible = false;
  }
}

// Initialize helpers once
setAxesVisibility(params.showAxes);
setGridVisibility(params.showGrid);

//
// Physics and Simulation
//
class Particle {
  constructor(initPos, initVel, charge, radius, particleColor, trailColor, showSpheres, showTrail) {
    this.r = initPos.clone();
    this.v = initVel.clone();
    this.q = charge;

    // Visual sphere
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshStandardMaterial({ color: particleColor })
    );
    this.mesh.position.copy(this.r);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = showSpheres;

    // Trail setup
    this.maxTrailPoints = 10_000;
    this.positions = new Float32Array(this.maxTrailPoints * 3);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.trailMaterial = new THREE.LineBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: 0.7,
    });
    this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.trail.frustumCulled = false;
    this.trail.visible = showTrail;
    this.positionCount = 0;
    this.trailIndex = 0;

    // For export
    this.trajectoryData = [];
  }

  setColors(particleColor, trailColor) {
    this.mesh.material.color.set(particleColor);
    this.trailMaterial.color.set(trailColor);
  }

  setVisibility(showSpheres, showTrail) {
    this.mesh.visible = showSpheres;
    this.trail.visible = showTrail;
  }

  resetTrail() {
    this.positionCount = 0;
    this.trailIndex = 0;
    this.trailGeometry.setDrawRange(0, 0);
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  updateTrail(persist) {
    if (!persist && this.positionCount >= this.maxTrailPoints) {
      // Reset when not persisting
      this.resetTrail();
    }

    // Write current position to circular buffer
    const i = this.trailIndex;
    this.positions[i * 3 + 0] = this.r.x;
    this.positions[i * 3 + 1] = this.r.y;
    this.positions[i * 3 + 2] = this.r.z;
    this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
    this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);
    this.trailGeometry.setDrawRange(0, this.positionCount);
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  logTrajectory(time) {
    this.trajectoryData.push({ time, x: this.r.x, y: this.r.y, z: this.r.z });
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }
}

let particles = [];
let isPaused = false;
let lastTimeSec = performance.now() / 1000;

const SOFTENING = 1e-3; // avoids singularity in Coulomb
const MAX_DT = 1 / 60;  // clamp dt for stability

function electricField() {
  return new THREE.Vector3(params.Ex, params.Ey, params.Ez);
}

function magneticField() {
  return new THREE.Vector3(params.Bx, params.By, params.Bz);
}

function computeCoulombForce(i) {
  const fi = new THREE.Vector3();
  const pi = particles[i];
  for (let j = 0; j < particles.length; j++) {
    if (i === j) continue;
    const pj = particles[j];
    const r_ji = new THREE.Vector3().subVectors(pi.r, pj.r); // r_i - r_j
    const dist2 = Math.max(r_ji.lengthSq(), SOFTENING * SOFTENING);
    const invDist = 1 / Math.sqrt(dist2);
    const invDist3 = invDist * invDist * invDist;
    // F = k_e * q_i q_j * r_vec / r^3
    const scalar = params.k_e * pi.q * pj.q * invDist3;
    fi.addScaledVector(r_ji, scalar);
  }
  return fi;
}

function totalForce(i, vel) {
  const q = particles[i].q;
  const E = electricField();
  const B = magneticField();
  // Lorentz q(E + v x B)
  const vxB = new THREE.Vector3().crossVectors(vel, B);
  const lorentz = E.add(vxB).multiplyScalar(q);
  // Linear drag: -gamma * v (dimensionless for demo)
  const drag = vel.clone().multiplyScalar(-params.friction);
  // Coulomb interactions
  const coulomb = computeCoulombForce(i);
  return lorentz.add(drag).add(coulomb);
}

function rk4Step(i, r, v, dt) {
  if (params.mass === 0) throw new Error('Mass cannot be zero!');
  const invM = 1 / params.mass;
  const a = (vel) => totalForce(i, vel).multiplyScalar(invM);

  const k1r = v.clone();
  const k1v = a(v);

  const k2r = v.clone().addScaledVector(k1v, dt / 2);
  const k2v = a(v.clone().addScaledVector(k1v, dt / 2));

  const k3r = v.clone().addScaledVector(k2v, dt / 2);
  const k3v = a(v.clone().addScaledVector(k2v, dt / 2));

  const k4r = v.clone().addScaledVector(k3v, dt);
  const k4v = a(v.clone().addScaledVector(k3v, dt));

  const dr = k1r.clone().addScaledVector(k2r, 2).addScaledVector(k3r, 2).add(k4r).multiplyScalar(dt / 6);
  const dv = k1v.clone().addScaledVector(k2v, 2).addScaledVector(k3v, 2).add(k4v).multiplyScalar(dt / 6);

  return { dr, dv };
}

function randomVelocity() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 2 * params.initVx,
    (Math.random() - 0.5) * 2 * params.initVy,
    (Math.random() - 0.5) * 2 * params.initVz
  );
}

function randomCharge() {
  return (Math.random() - 0.5) * 2 * params.q;
}

function removeNonLightObjects() {
  // Remove everything except the lights and persistent helpers (we toggle visibility)
  const keep = new Set([dirLight, ...scene.children.filter(c => c instanceof THREE.AmbientLight)]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (!keep.has(obj) && obj !== axesGroup && obj !== gridHelper) {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose?.();
      if (obj.children?.length) {
        obj.traverse(o => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) o.material.dispose?.();
        });
      }
    }
  }
}

// GUI instance is needed in multiple places
const gui = new GUI();
let chargesFolder = null;

function setupParticleChargeGUI() {
  if (chargesFolder) {
    gui.removeFolder(chargesFolder);
    chargesFolder = null;
  }
  chargesFolder = gui.addFolder('Particle Charges');
  particles.forEach((p, i) => {
    chargesFolder.add(p, 'q', -10, 10, 0.1).name(`Particle ${i + 1} Charge`);
  });
  chargesFolder.open();
}

function initializeSimulation(resetCamera = false, randomize = false) {
  // Cleanup visuals (keep lights/helpers)
  removeNonLightObjects();

  // Helpers visibility (do not recreate each time)
  setAxesVisibility(params.showAxes);
  setGridVisibility(params.showGrid);

  // Dispose old particles
  particles.forEach(p => p.dispose());
  particles = [];

  // Create particles
  const radius = 2.5;
  for (let i = 0; i < params.particleCount; i++) {
    const angle = (2 * Math.PI * i) / params.particleCount;
    const initPos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const initVel = randomize
      ? randomVelocity()
      : new THREE.Vector3(params.initVx, params.initVy, params.initVz);
    const charge = params.randomCharge ? randomCharge() : params.q;
    const p = new Particle(
      initPos, initVel, charge,
      params.radius,
      params.particleColor,
      params.trailColor,
      params.showSpheres,
      params.showTrail
    );
    scene.add(p.mesh);
    scene.add(p.trail);
    p.resetTrail();
    p.trajectoryData = [];
    particles.push(p);
  }

  setupParticleChargeGUI();

  if (resetCamera) {
    camera.position.set(0, 0, 20);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function exportTrajectories() {
  let csv = 'particle,charge,time,x,y,z\n';
  particles.forEach((p, i) => {
    p.trajectoryData.forEach(pt => {
      csv += `${i},${p.q.toFixed(2)},${pt.time.toFixed(3)},${pt.x.toFixed(6)},${pt.y.toFixed(6)},${pt.z.toFixed(6)}\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trajectories.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function invertChargeSign() {
  params.q = -params.q;
  initializeSimulation(false);
}

function presetCyclotron() {
  params.q = 1;
  params.mass = 1;
  params.friction = 0.05;
  params.Ex = 0; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 1;
  params.initVx = 1; params.initVy = 0; params.initVz = 0;
  params.randomCharge = false;
  initializeSimulation(true);
}

function presetCycloidal() {
  params.q = 1;
  params.mass = 1;
  params.friction = 0.05;
  params.Ex = 1; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 1;
  params.initVx = 0; params.initVy = 0; params.initVz = 0;
  params.randomCharge = false;
  initializeSimulation(true);
}

function presetStraightLine() {
  params.q = 1;
  params.mass = 1;
  params.friction = 0.05;
  params.Ex = 0; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 0;
  params.initVx = 1; params.initVy = 0; params.initVz = 0;
  params.randomCharge = false;
  initializeSimulation(true);
}

function randomizeParticles() {
  initializeSimulation(true, true);
}

//
// GUI
//
const physFolder = gui.addFolder('Physics');
physFolder.add(params, 'q', -10, 10, 0.1).name('Base Charge (q)').onChange(() => initializeSimulation(false));
physFolder.add(params, 'mass', 0.01, 10, 0.01).name('Mass').onChange(() => initializeSimulation(false));
physFolder.add(params, 'friction', 0, 1, 0.01).name('Friction').onChange(() => initializeSimulation(false));
physFolder.add(params, 'k_e', 0.1, 10, 0.1).name('Coulomb k_e').onChange(() => initializeSimulation(false));
physFolder.add(params, 'randomCharge').name('Randomize Charges').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ex', -10, 10, 0.1).name('Electric Ex').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ey', -10, 10, 0.1).name('Electric Ey').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ez', -10, 10, 0.1).name('Electric Ez').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Bx', -10, 10, 0.1).name('Magnetic Bx').onChange(() => initializeSimulation(false));
physFolder.add(params, 'By', -10, 10, 0.1).name('Magnetic By').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Bz', -10, 10, 0.1).name('Magnetic Bz').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVx', -10, 10, 0.1).name('Init Velocity X').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVy', -10, 10, 0.1).name('Init Velocity Y').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVz', -10, 10, 0.1).name('Init Velocity Z').onChange(() => initializeSimulation(false));
physFolder.add(params, 'particleCount', 1, 50, 1).name('Particle Count').onFinishChange(() => initializeSimulation());
physFolder.open();

const visualFolder = gui.addFolder('Visuals');
visualFolder.add(params, 'animationSpeed', 0.1, 10, 0.1).name('Animation Speed');
visualFolder.addColor(params, 'particleColor').name('Particle Color').onChange(() => {
  particles.forEach(p => p.mesh.material.color.set(params.particleColor));
});
visualFolder.addColor(params, 'trailColor').name('Trail Color').onChange(() => {
  particles.forEach(p => p.trailMaterial.color.set(params.trailColor));
});
visualFolder.add(params, 'trailPersistence').name('Persist Trails').onChange(() => {
  if (!params.trailPersistence) particles.forEach(p => p.resetTrail());
});
visualFolder.add(params, 'showSpheres').name('Show Spheres').onChange(() => {
  particles.forEach(p => p.mesh.visible = params.showSpheres);
});
visualFolder.add(params, 'showTrail').name('Show Trails').onChange(() => {
  particles.forEach(p => p.trail.visible = params.showTrail);
});
visualFolder.add(params, 'showAxes').name('Show Axes').onChange(() => setAxesVisibility(params.showAxes));
visualFolder.add(params, 'showGrid').name('Show Grid').onChange(() => setGridVisibility(params.showGrid));
visualFolder.addColor(params, 'backgroundColor').name('Background Color').onChange(() => {
  scene.background.set(params.backgroundColor);
});
visualFolder.open();

const presetFolder = gui.addFolder('Presets');
presetFolder.add({ Cyclotron: () => presetCyclotron() }, 'Cyclotron').name('Cyclotron');
presetFolder.add({ Cycloidal: () => presetCycloidal() }, 'Cycloidal').name('Cycloidal');
presetFolder.add({ StraightLine: () => presetStraightLine() }, 'StraightLine').name('Straight Line');
presetFolder.add({ InvertCharge: () => invertChargeSign() }, 'InvertCharge').name('Invert Charge Sign');
presetFolder.add({ Randomize: () => randomizeParticles() }, 'Randomize').name('Randomize Velocities');
presetFolder.open();

gui.add({ PauseResume: () => { isPaused = !isPaused; } }, 'PauseResume').name('Pause / Resume (Space)');
gui.add({ Reset: () => initializeSimulation(true) }, 'Reset').name('Reset (R)');
gui.add({ Export: exportTrajectories }, 'Export').name('Export Trajectories (CSV)');

//
// Resize & Keyboard
//
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', e => {
  if (e.key === ' ') isPaused = !isPaused;
  if (e.key.toLowerCase() === 'r') initializeSimulation(true);
});

//
// Update loop
//
function updateSimulation(dt, nowSec) {
  // Stage new states to avoid order dependence
  const staged = particles.map((p, i) => rk4Step(i, p.r, p.v, dt));
  particles.forEach((p, i) => {
    const { dr, dv } = staged[i];
    p.r.add(dr);
    p.v.add(dv);
    if (params.showSpheres) p.mesh.position.copy(p.r);
    if (params.showTrail) p.updateTrail(params.trailPersistence);
    p.logTrajectory(nowSec);
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const nowSec = performance.now() / 1000;
  let dt = (nowSec - lastTimeSec);
  lastTimeSec = nowSec;

  // Adjust dt by animation control and clamp
  dt = Math.min(dt * params.animationSpeed, MAX_DT);

  if (!isPaused) {
    try {
      updateSimulation(dt, nowSec);
    } catch (e) {
      isPaused = true;
      console.error(e);
      alert(e.message);
    }
  }

  renderer.render(scene, camera);
}

//
// Init & run
//
initializeSimulation(true);
animate();

