/**
 * @file main.js
 * @author Gemini
 * @description An advanced 3D particle simulation in electromagnetic fields.
 * This enhanced version includes:
 * - Relativistic mechanics (using the correct relativistic form of the Lorentz force).
 * - Spatially and temporally variable fields defined by user functions (e.g., "sin(t)", "k*x").
 * - A more robust and modular code structure.
 * - Performance optimizations to reduce garbage collection.
 * - An improved GUI with real-time feedback and better organization.
 */

import * as THREE from 'https://esm.sh/three@0.128.0';
import { OrbitControls } from 'https://esm.sh/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://esm.sh/dat.gui@0.7.7/build/dat.gui.module.js';

//
// --- CONFIGURATION & GLOBAL STATE ---
//

/**
 * Global parameters for simulation control.
 */
const params = {
  // Physics
  useRelativity: false,
  c: 20.0, // Speed of light (set low to easily see effects)
  restMass: 1.0,
  friction: 0.0,
  k_e: 1.0,
  // Particle Setup
  particleCount: 3,
  baseCharge: 1.0,
  randomCharge: false,
  initVx: 1.0, initVy: 0.0, initVz: 0.0,
  // Field Function Strings
  E_x_str: '0.0', E_y_str: '0.0', E_z_str: '0.0',
  B_x_str: '0.0', B_y_str: '0.0', B_z_str: '1.0',
  // Visuals
  animationSpeed: 1.5,
  radius: 0.3,
  trailPersistence: false,
  backgroundColor: '#050510',
  particleColor: '#00ffff',
  trailColor: '#ffff00',
  showAxes: true,
  showTrail: true,
  showSpheres: true,
  showGrid: false,
};

/**
 * Constants used throughout the simulation.
 */
const CONSTANTS = {
  SOFTENING: 1e-6,      // Prevents singularity in Coulomb force
  MAX_DT: 1 / 30,       // Max timestep for stability
  C_SQUARED_EPSILON: 1e-9 // Prevents v=c issues
};

// --- Global Variables ---
let scene, camera, renderer, controls, dirLight;
let axesGroup = null, gridHelper = null;
let particles = [];
let isPaused = false;
let lastTimeSec = performance.now() / 1000;
let totalTimeSec = 0;
const gui = new GUI();
let chargesFolder = null;
let infoFolder = null;

/**
 * Reusable THREE.Vector3 objects to prevent memory allocation in the animation loop.
 */
const temp = {
  vec1: new THREE.Vector3(), vec2: new THREE.Vector3(), vec3: new THREE.Vector3(),
  force: new THREE.Vector3(), r: new THREE.Vector3(), v: new THREE.Vector3(),
  k1r: new THREE.Vector3(), k1v: new THREE.Vector3(),
  k2r: new THREE.Vector3(), k2v: new THREE.Vector3(),
  k3r: new THREE.Vector3(), k3v: new THREE.Vector3(),
  k4r: new THREE.Vector3(), k4v: new THREE.Vector3(),
};

/**
 * Storage for compiled user-defined field functions.
 */
const fieldFunctions = {
  Ex: (x, y, z, t) => 0, Ey: (x, y, z, t) => 0, Ez: (x, y, z, t) => 0,
  Bx: (x, y, z, t) => 0, By: (x, y, z, t) => 0, Bz: (x, y, z, t) => 0,
};

//
// --- CORE PARTICLE CLASS ---
//

class Particle {
  constructor(initPos, initVel, charge, radius, particleColor, trailColor, showSpheres, showTrail) {
    this.r = initPos.clone(); // Position vector
    this.v = initVel.clone(); // Velocity vector
    this.q = charge;          // Charge
    this.gamma = 1.0;         // Lorentz factor

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshStandardMaterial({ color: particleColor })
    );
    this.mesh.position.copy(this.r);
    this.mesh.visible = showSpheres;

    this.maxTrailPoints = 10_000;
    this.positions = new Float32Array(this.maxTrailPoints * 3);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.trailMaterial = new THREE.LineBasicMaterial({ color: trailColor, transparent: true, opacity: 0.7 });
    this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.trail.frustumCulled = false;
    this.trail.visible = showTrail;
    this.positionCount = 0;
    this.trailIndex = 0;

    this.trajectoryData = [];
  }

  updateTrail(persist) {
    if (!persist && this.positionCount >= this.maxTrailPoints) this.resetTrail();

    const i = this.trailIndex;
    this.positions[i * 3 + 0] = this.r.x;
    this.positions[i * 3 + 1] = this.r.y;
    this.positions[i * 3 + 2] = this.r.z;
    this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
    this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);
    this.trailGeometry.setDrawRange(0, this.positionCount);
    this.trailGeometry.attributes.position.needsUpdate = true;
  }
  
  updateVisuals() {
    if (params.showSpheres) {
      this.mesh.position.copy(this.r);
      // Optional: change color based on speed
      if (params.useRelativity) {
        const speedRatio = this.v.length() / params.c;
        const color = new THREE.Color().setHSL(0.6, 1.0, 0.5 + speedRatio * 0.5);
        this.mesh.material.color.copy(color);
      } else {
        this.mesh.material.color.set(params.particleColor);
      }
    }
    if (params.showTrail) this.updateTrail(params.trailPersistence);
  }

  logTrajectory(time) {
    this.trajectoryData.push({ time, x: this.r.x, y: this.r.y, z: this.r.z, vx: this.v.x, vy: this.v.y, vz: this.v.z });
  }

  resetTrail() {
    this.positionCount = 0;
    this.trailIndex = 0;
    this.trailGeometry.setDrawRange(0, 0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }
}

//
// --- PHYSICS ENGINE ---
//

const Physics = {
  /**
   * Computes the electric field at a given point in space and time.
   */
  electricField(r, t) {
    return temp.vec1.set(
      fieldFunctions.Ex(r.x, r.y, r.z, t),
      fieldFunctions.Ey(r.x, r.y, r.z, t),
      fieldFunctions.Ez(r.x, r.y, r.z, t)
    );
  },

  /**
   * Computes the magnetic field at a given point in space and time.
   */
  magneticField(r, t) {
    return temp.vec2.set(
      fieldFunctions.Bx(r.x, r.y, r.z, t),
      fieldFunctions.By(r.x, r.y, r.z, t),
      fieldFunctions.Bz(r.x, r.y, r.z, t)
    );
  },

  /**
   * Computes the net Coulomb force on particle `i` from all other particles.
   */
  computeCoulombForce(particleIndex, currentParticles) {
    const fi = temp.vec3.set(0, 0, 0);
    const pi = currentParticles[particleIndex];
    for (let j = 0; j < currentParticles.length; j++) {
      if (particleIndex === j) continue;
      const pj = currentParticles[j];
      const r_ji = temp.r.subVectors(pi.r, pj.r);
      const dist2 = Math.max(r_ji.lengthSq(), CONSTANTS.SOFTENING * CONSTANTS.SOFTENING);
      const invDist3 = Math.pow(dist2, -1.5);
      const scalar = params.k_e * pi.q * pj.q * invDist3;
      fi.addScaledVector(r_ji, scalar);
    }
    return fi;
  },

  /**
   * Computes the total force on a particle (Lorentz + Coulomb + Drag).
   */
  totalForce(particleIndex, r, v, t, currentParticles) {
    const q = currentParticles[particleIndex].q;
    const E = this.electricField(r, t);
    const B = this.magneticField(r, t);
    const v_cross_B = temp.v.crossVectors(v, B);
    const lorentz = temp.force.copy(E).add(v_cross_B).multiplyScalar(q);
    const drag = temp.vec1.copy(v).multiplyScalar(-params.friction);
    const coulomb = this.computeCoulombForce(particleIndex, currentParticles);
    return lorentz.add(drag).add(coulomb);
  },

  /**
   * Calculates acceleration based on the chosen physics model (Classical or Relativistic).
   */
  computeAcceleration(particleIndex, r, v, t, currentParticles) {
    if (params.useRelativity) {
      const vSq = v.lengthSq();
      const c = params.c;
      const cSq = c * c;
      
      // Clamp velocity to prevent v >= c due to numerical errors
      const safeVSq = Math.min(vSq, cSq - CONSTANTS.C_SQUARED_EPSILON);
      const gamma = 1.0 / Math.sqrt(1.0 - safeVSq / cSq);
      currentParticles[particleIndex].gamma = gamma; // Store for info display

      const E = this.electricField(r, t);
      const B = this.magneticField(r, t);
      const q = currentParticles[particleIndex].q;
      
      const v_dot_E = v.dot(E);
      const term_v_v_dot_E_over_cSq = temp.vec1.copy(v).multiplyScalar(v_dot_E / cSq);
      const v_cross_B = temp.vec2.crossVectors(v, B);

      // Relativistic acceleration: a = (q / γm) * (E + v x B - (v(v⋅E)/c²))
      const fullForce = temp.vec3.copy(E).add(v_cross_B).sub(term_v_v_dot_E_over_cSq);
      return fullForce.multiplyScalar(q / (gamma * params.restMass));

    } else { // Classical
      currentParticles[particleIndex].gamma = 1.0;
      const F = this.totalForce(particleIndex, r, v, t, currentParticles);
      return F.multiplyScalar(1.0 / params.restMass);
    }
  },

  /**
   * Performs one step of the 4th-order Runge-Kutta integration.
   */
  rk4Step(i, p, dt, t, currentParticles) {
    if (params.restMass === 0) throw new Error('Rest mass cannot be zero!');
    const a = (vel, pos) => this.computeAcceleration(i, pos, vel, t, currentParticles);

    // k1
    temp.k1v.copy(a(p.v, p.r));
    temp.k1r.copy(p.v);

    // k2
    temp.k2v.copy(a(temp.vec1.copy(p.v).addScaledVector(temp.k1v, dt / 2), temp.vec2.copy(p.r).addScaledVector(temp.k1r, dt/2)));
    temp.k2r.copy(p.v).addScaledVector(temp.k1v, dt / 2);

    // k3
    temp.k3v.copy(a(temp.vec1.copy(p.v).addScaledVector(temp.k2v, dt / 2), temp.vec2.copy(p.r).addScaledVector(temp.k2r, dt/2)));
    temp.k3r.copy(p.v).addScaledVector(temp.k2v, dt / 2);

    // k4
    temp.k4v.copy(a(temp.vec1.copy(p.v).addScaledVector(temp.k3v, dt), temp.vec2.copy(p.r).addScaledVector(temp.k3r, dt)));
    temp.k4r.copy(p.v).addScaledVector(temp.k3v, dt);
    
    // Combine
    const dr = temp.k1r.addScaledVector(temp.k2r, 2).addScaledVector(temp.k3r, 2).add(temp.k4r).multiplyScalar(dt / 6);
    const dv = temp.k1v.addScaledVector(temp.k2v, 2).addScaledVector(temp.k3v, 2).add(temp.k4v).multiplyScalar(dt / 6);

    return { dr, dv };
  }
};

//
// --- SIMULATION & SCENE MANAGEMENT ---
//

/**
 * Sets up the initial Three.js scene, camera, renderer, and lights.
 */
function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.backgroundColor);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1_000);
  camera.position.set(0, 0, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0x404040, 1.5));
  dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
}

/**
 * Removes all simulation objects from the scene, preparing for a reset.
 */
function cleanupSceneObjects() {
  const keep = new Set([dirLight, ...scene.children.filter(c => c instanceof THREE.AmbientLight)]);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (!keep.has(obj) && obj !== axesGroup && obj !== gridHelper) {
      scene.remove(obj);
      if (obj.traverse) {
        obj.traverse(o => {
          o.geometry?.dispose();
          o.material?.dispose?.();
        });
      }
    }
  }
}

/**
 * Main simulation initialization function.
 */
function initializeSimulation(resetCamera = false, randomize = false) {
  cleanupSceneObjects();
  particles.forEach(p => p.dispose());
  particles = [];

  setAxesVisibility(params.showAxes);
  setGridVisibility(params.showGrid);

  const radius = 2.5;
  for (let i = 0; i < params.particleCount; i++) {
    const angle = (2 * Math.PI * i) / params.particleCount;
    const initPos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const initVel = randomize
      ? new THREE.Vector3(
          (Math.random() - 0.5) * 2 * params.initVx,
          (Math.random() - 0.5) * 2 * params.initVy,
          (Math.random() - 0.5) * 2 * params.initVz
        )
      : new THREE.Vector3(params.initVx, params.initVy, params.initVz);
    
    const charge = params.randomCharge ? (Math.random() - 0.5) * 2 * params.baseCharge : params.baseCharge;
    
    const p = new Particle(
      initPos, initVel, charge, params.radius, params.particleColor, params.trailColor,
      params.showSpheres, params.showTrail
    );
    scene.add(p.mesh);
    scene.add(p.trail);
    particles.push(p);
  }

  setupParticleChargeGUI();
  setupInfoGUI();

  if (resetCamera) {
    camera.position.set(0, 0, 20);
    controls.target.set(0, 0, 0);
  }
  
  totalTimeSec = 0;
  lastTimeSec = performance.now() / 1000;
}

/**
 * The core update function, called every frame.
 */
function updateSimulation(dt, nowSec) {
  // Staging avoids order-dependence in multi-particle calculations
  const stagedUpdates = particles.map((p, i) => Physics.rk4Step(i, p, dt, nowSec, particles));
  
  particles.forEach((p, i) => {
    const { dr, dv } = stagedUpdates[i];
    p.r.add(dr);
    p.v.add(dv);
    p.updateVisuals();
    p.logTrajectory(nowSec);
  });

  // Update real-time info panel
  if (infoFolder && !isPaused) {
    infoFolder.__controllers.forEach((c, i) => {
      if (particles[i]) c.setValue(particles[i].gamma.toFixed(3));
    });
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const nowSec = performance.now() / 1000;
  let dt = nowSec - lastTimeSec;
  lastTimeSec = nowSec;

  dt = Math.min(dt * params.animationSpeed, CONSTANTS.MAX_DT);

  if (!isPaused && dt > 0) {
    try {
      totalTimeSec += dt;
      updateSimulation(dt, totalTimeSec);
    } catch (e) {
      isPaused = true;
      console.error("Simulation error:", e);
      alert(`Simulation paused due to an error: ${e.message}`);
    }
  }

  renderer.render(scene, camera);
}

//
// --- GUI SETUP ---
//

function setupGUI() {
  // --- Physics Folder ---
  const physFolder = gui.addFolder('Physics');
  physFolder.add(params, 'useRelativity').name('Use Relativity').onChange(() => initializeSimulation());
  physFolder.add(params, 'c', 1, 100, 0.1).name('Speed of Light (c)').onChange(() => initializeSimulation());
  physFolder.add(params, 'baseCharge', -10, 10, 0.1).name('Base Charge').onChange(() => initializeSimulation());
  physFolder.add(params, 'restMass', 0.01, 10, 0.01).name('Rest Mass').onChange(() => initializeSimulation());
  physFolder.add(params, 'friction', 0, 1, 0.01).name('Friction').onChange(() => initializeSimulation());
  physFolder.add(params, 'k_e', 0, 10, 0.1).name('Coulomb k_e').onChange(() => initializeSimulation());
  physFolder.open();

  // --- Fields Folder ---
  const fieldsFolder = gui.addFolder('Field Functions f(x,y,z,t)');
  const fieldControllers = {};
  ['Ex', 'Ey', 'Ez', 'Bx', 'By', 'Bz'].forEach(key => {
    const paramKey = `${key.slice(0, 1)}_${key.slice(1).toLowerCase()}_str`;
    fieldControllers[key] = fieldsFolder.add(params, paramKey).name(`${key}(x,y,z,t)`);
    fieldControllers[key].onChange(() => {
      if (compileFieldFunctions()) {
        fieldControllers[key].domElement.parentElement.style.borderLeft = '3px solid #2fa1d6'; // Success
        initializeSimulation();
      } else {
        fieldControllers[key].domElement.parentElement.style.borderLeft = '3px solid #e55039'; // Error
      }
    });
  });
  fieldsFolder.open();

  // --- Initial Conditions Folder ---
  const initFolder = gui.addFolder('Initial Conditions');
  initFolder.add(params, 'particleCount', 1, 50, 1).name('Particle Count').onFinishChange(() => initializeSimulation());
  initFolder.add(params, 'randomCharge').name('Randomize Charges').onChange(() => initializeSimulation());
  initFolder.add(params, 'initVx', -20, 20, 0.1).name('Init Vel. X').onChange(() => initializeSimulation());
  initFolder.add(params, 'initVy', -20, 20, 0.1).name('Init Vel. Y').onChange(() => initializeSimulation());
  initFolder.add(params, 'initVz', -20, 20, 0.1).name('Init Vel. Z').onChange(() => initializeSimulation());
  initFolder.open();
  
  // --- Visuals Folder ---
  const visualFolder = gui.addFolder('Visuals');
  visualFolder.add(params, 'animationSpeed', 0.1, 10, 0.1).name('Anim. Speed');
  visualFolder.addColor(params, 'particleColor').name('Particle Color');
  visualFolder.addColor(params, 'trailColor').name('Trail Color').onChange(() => particles.forEach(p => p.trailMaterial.color.set(params.trailColor)));
  visualFolder.add(params, 'trailPersistence').name('Persist Trails').onChange(() => !params.trailPersistence && particles.forEach(p => p.resetTrail()));
  visualFolder.add(params, 'showSpheres').name('Show Spheres').onChange(v => particles.forEach(p => p.mesh.visible = v));
  visualFolder.add(params, 'showTrail').name('Show Trails').onChange(v => particles.forEach(p => p.trail.visible = v));
  visualFolder.add(params, 'showAxes').name('Show Axes').onChange(setAxesVisibility);
  visualFolder.add(params, 'showGrid').name('Show Grid').onChange(setGridVisibility);
  visualFolder.addColor(params, 'backgroundColor').name('Background').onChange(v => scene.background.set(v));
  
  // --- Presets & Controls ---
  const presetFolder = gui.addFolder('Presets & Controls');
  presetFolder.add({ fn: () => presetCyclotron() }, 'fn').name('Cyclotron');
  presetFolder.add({ fn: () => presetExBDrift() }, 'fn').name('E x B Drift');
  presetFolder.add({ fn: () => presetQuadrupole() }, 'fn').name('Quadrupole Trap');
  presetFolder.add({ fn: () => presetRelativistic() }, 'fn').name('Relativistic Helix');
  presetFolder.add({ fn: () => randomizeParticles() }, 'fn').name('Randomize Velocities');
  presetFolder.add({ fn: () => { isPaused = !isPaused; } }, 'fn').name('Pause/Resume (Space)');
  presetFolder.add({ fn: () => initializeSimulation(true) }, 'fn').name('Reset (R)');
  presetFolder.add({ fn: exportTrajectories }, 'fn').name('Export CSV');
  presetFolder.open();

  // Initial compile and style update
  if(compileFieldFunctions()) {
    Object.values(fieldControllers).forEach(c => c.domElement.parentElement.style.borderLeft = '3px solid #2fa1d6');
  }
}

function setupParticleChargeGUI() {
  if (chargesFolder) gui.removeFolder(chargesFolder);
  chargesFolder = gui.addFolder('Particle Charges');
  particles.forEach((p, i) => {
    chargesFolder.add(p, 'q', -10, 10, 0.1).name(`Particle ${i + 1} Charge`);
  });
  chargesFolder.open();
}

function setupInfoGUI() {
  if (infoFolder) gui.removeFolder(infoFolder);
  if (!params.useRelativity) return;
  infoFolder = gui.addFolder('Lorentz Factor (γ)');
  particles.forEach((p, i) => {
      infoFolder.add(p, 'gamma').name(`P${i+1} γ`).listen();
  });
  infoFolder.open();
}

/**
 * Compiles user-provided strings into executable JavaScript functions for fields.
 */
function compileFieldFunctions() {
  try {
    const common = 'const {sin,cos,tan,sqrt,PI,exp,abs,pow,sign} = Math;';
    fieldFunctions.Ex = new Function('x', 'y', 'z', 't', `${common} return ${params.E_x_str};`);
    fieldFunctions.Ey = new Function('x', 'y', 'z', 't', `${common} return ${params.E_y_str};`);
    fieldFunctions.Ez = new Function('x', 'y', 'z', 't', `${common} return ${params.E_z_str};`);
    fieldFunctions.Bx = new Function('x', 'y', 'z', 't', `${common} return ${params.B_x_str};`);
    fieldFunctions.By = new Function('x', 'y', 'z', 't', `${common} return ${params.B_y_str};`);
    fieldFunctions.Bz = new Function('x', 'y', 'z', 't', `${common} return ${params.B_z_str};`);
    // Test one function to ensure syntax is valid
    fieldFunctions.Ex(0,0,0,0);
    return true;
  } catch (e) {
    console.error("Field function compile error:", e.message);
    return false;
  }
}

//
// --- HELPERS, PRESETS & UTILITIES ---
//

function presetCyclotron() {
  params.useRelativity = false;
  params.baseCharge = 1; params.restMass = 1; params.friction = 0;
  params.E_x_str = '0'; params.E_y_str = '0'; params.E_z_str = '0';
  params.B_x_str = '0'; params.B_y_str = '0'; params.B_z_str = '1';
  params.initVx = 1; params.initVy = 0; params.initVz = 0;
  params.randomCharge = false; params.particleCount = 1;
  gui.updateDisplay(); compileFieldFunctions(); initializeSimulation(true);
}

function presetExBDrift() {
  params.useRelativity = false;
  params.baseCharge = 1; params.restMass = 1; params.friction = 0;
  params.E_x_str = '1'; params.E_y_str = '0'; params.E_z_str = '0';
  params.B_x_str = '0'; params.B_y_str = '0'; params.B_z_str = '1';
  params.initVx = 0; params.initVy = 0; params.initVz = 0;
  params.randomCharge = false; params.particleCount = 1;
  gui.updateDisplay(); compileFieldFunctions(); initializeSimulation(true);
}

function presetQuadrupole() {
  params.useRelativity = false;
  params.baseCharge = 1; params.restMass = 1; params.friction = 0.1;
  params.E_x_str = 'x'; params.E_y_str = '-y'; params.E_z_str = '0';
  params.B_x_str = '0'; params.B_y_str = '0'; params.B_z_str = '0';
  params.initVx = 1; params.initVy = 1; params.initVz = 1;
  params.randomCharge = false; params.particleCount = 10;
  gui.updateDisplay(); compileFieldFunctions(); initializeSimulation(true);
}

function presetRelativistic() {
  params.useRelativity = true;
  params.c = 20;
  params.baseCharge = -1; params.restMass = 1; params.friction = 0;
  params.E_x_str = '0'; params.E_y_str = '0'; params.E_z_str = '0.5';
  params.B_x_str = '0'; params.B_y_str = '0'; params.B_z_str = '5';
  params.initVx = 18; params.initVy = 0; params.initVz = 0; // v is 90% of c
  params.randomCharge = false; params.particleCount = 1;
  gui.updateDisplay(); compileFieldFunctions(); initializeSimulation(true);
}

function randomizeParticles() {
  initializeSimulation(true, true);
}

function exportTrajectories() {
  let csv = 'particle,charge,time,x,y,z,vx,vy,vz\n';
  particles.forEach((p, i) => {
    p.trajectoryData.forEach(pt => {
      csv += `${i},${p.q.toFixed(2)},${pt.time.toFixed(3)},${pt.x.toFixed(6)},${pt.y.toFixed(6)},${pt.z.toFixed(6)},${pt.vx.toFixed(6)},${pt.vy.toFixed(6)},${pt.vz.toFixed(6)}\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'trajectories.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Visual Helpers (Axes, Grid) ---
function createLabeledAxes(size = 10) {
    const group = new THREE.Group();
    const line = (a,b,mat) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), mat);
    group.add(line(new THREE.Vector3(0,0,0), new THREE.Vector3(size,0,0), new THREE.LineBasicMaterial({color:0xff0000})));
    group.add(line(new THREE.Vector3(0,0,0), new THREE.Vector3(0,size,0), new THREE.LineBasicMaterial({color:0x00ff00})));
    group.add(line(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,size), new THREE.LineBasicMaterial({color:0x0000ff})));
    function makeLabel(text, color) {
        const canvas = document.createElement('canvas'), S=128; canvas.width=S; canvas.height=S;
        const ctx = canvas.getContext('2d'); ctx.font = 'Bold 70px Arial'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, S/2, S/2);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas), depthTest:false, depthWrite:false}));
        sprite.scale.set(1.5,1.5,1.5); return sprite;
    }
    const labelX = makeLabel('X', '#ff0000'); labelX.position.set(size+0.7,0,0);
    const labelY = makeLabel('Y', '#00ff00'); labelY.position.set(0,size+0.7,0);
    const labelZ = makeLabel('Z', '#0000ff'); labelZ.position.set(0,0,size+0.7);
    group.add(labelX, labelY, labelZ);
    return group;
}
function setAxesVisibility(visible) { if(visible){if(!axesGroup){axesGroup=createLabeledAxes(10); scene.add(axesGroup);} else {axesGroup.visible=true;}} else if(axesGroup){axesGroup.visible=false;} }
function setGridVisibility(visible) { if(visible){if(!gridHelper){gridHelper=new THREE.GridHelper(20,20); scene.add(gridHelper);} else {gridHelper.visible=true;}} else if(gridHelper){gridHelper.visible=false;} }

// --- Event Listeners ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('keydown', e => {
  if (e.target.tagName.toLowerCase() === 'input') return; // Ignore keypresses in GUI inputs
  if (e.key === ' ') { e.preventDefault(); isPaused = !isPaused; }
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); initializeSimulation(true); }
});

//
// --- INITIALIZATION & LAUNCH ---
//

setupScene();
setupGUI();
initializeSimulation(true);
animate();
