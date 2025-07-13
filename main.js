import * as THREE from 'https://esm.sh/three@0.128.0';
import { OrbitControls } from 'https://esm.sh/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://esm.sh/dat.gui@0.7.7/build/dat.gui.module.js';

// Parameters with initial defaults
const params = {
  q: 1.0,
  mass: 1.0,
  friction: 0.0,
  particleCount: 3,
  animationSpeed: 2,
  radius: 0.3,
  trailPersistence: true,
  backgroundColor: '#000000',
  particleColor: '#00ffff',
  trailColor: '#ffff00',
  showAxes: true,
  showTrail: true,
  showSpheres: true,
  showGrid: false,
  Ex: 0.0,
  Ey: 0.0,
  Ez: 0.0,
  Bx: 0.0,
  By: 0.0,
  Bz: 1.0,
  initVx: 1.0,
  initVy: 0.0,
  initVz: 0.0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.backgroundColor);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.AmbientLight(0x404040, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Helper axes group (will be recreated)
let axesHelper = null;
let gridHelper = null; // <-- Add this line
function createLabeledAxes(size = 10) {
  const group = new THREE.Group();
  const matX = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const matY = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const matZ = new THREE.LineBasicMaterial({ color: 0x0000ff });

  const pointsX = [new THREE.Vector3(0,0,0), new THREE.Vector3(size,0,0)];
  const pointsY = [new THREE.Vector3(0,0,0), new THREE.Vector3(0,size,0)];
  const pointsZ = [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,size)];

  const geomX = new THREE.BufferGeometry().setFromPoints(pointsX);
  const geomY = new THREE.BufferGeometry().setFromPoints(pointsY);
  const geomZ = new THREE.BufferGeometry().setFromPoints(pointsZ);

  group.add(new THREE.Line(geomX, matX));
  group.add(new THREE.Line(geomY, matY));
  group.add(new THREE.Line(geomZ, matZ));

  function makeLabel(text, color) {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 70px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size/2, size/2);
    const tex = new THREE.CanvasTexture(canvas);
    const sprMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
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

  group.add(labelX);
  group.add(labelY);
  group.add(labelZ);
  return group;
}

if(params.showAxes) {
  axesHelper = createLabeledAxes(10);
  scene.add(axesHelper);
}

// Particle class with trails
class Particle {
  constructor() {
    this.r = new THREE.Vector3(0,0,0);
    this.v = new THREE.Vector3(params.initVx, params.initVy, params.initVz);

    this.maxTrailPoints = 2000;
    this.positions = new Float32Array(this.maxTrailPoints * 3);
    this.positionCount = 0;
    this.trailIndex = 0;
    this.trajectoryData = [];

    this.geometry = new THREE.SphereGeometry(params.radius, 16, 16);
    this.material = new THREE.MeshStandardMaterial({color: params.particleColor});
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.r);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.trailMaterial = new THREE.LineBasicMaterial({color: params.trailColor, transparent:true, opacity:0.7});
    this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
  }

  updateTrail() {
    if (!params.trailPersistence && this.positionCount >= this.maxTrailPoints) {
      this.positionCount = 0;
      this.trailIndex = 0;
    }
    this.positions[this.trailIndex * 3] = this.r.x;
    this.positions[this.trailIndex * 3 + 1] = this.r.y;
    this.positions[this.trailIndex * 3 + 2] = this.r.z;

    this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
    this.positionCount = Math.min(this.positionCount + 1, this.maxTrailPoints);

    this.trailGeometry.setDrawRange(0, this.positionCount);
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  logTrajectory(time) {
    this.trajectoryData.push({time, x:this.r.x, y:this.r.y, z:this.r.z});
  }

  resetTrajectory() {
    this.trajectoryData = [];
  }
}

let particles = [];
let isPaused = false;

const baseDt = 0.01;

function lorentzForce(v, q, E, B) {
  const vxB = new THREE.Vector3().crossVectors(v, B);
  return new THREE.Vector3().addVectors(E, vxB).multiplyScalar(q);
}

function rk4Step(r, v, dt) {
  const accel = (vel) => {
    return lorentzForce(vel, params.q, new THREE.Vector3(params.Ex, params.Ey, params.Ez), new THREE.Vector3(params.Bx, params.By, params.Bz)).divideScalar(params.mass);
  };

  const k1r = v.clone();
  const k1v = accel(v);

  const k2r = v.clone().addScaledVector(k1v, dt/2);
  const k2v = accel(v.clone().addScaledVector(k1v, dt/2));

  const k3r = v.clone().addScaledVector(k2v, dt/2);
  const k3v = accel(v.clone().addScaledVector(k2v, dt/2));

  const k4r = v.clone().addScaledVector(k3v, dt);
  const k4v = accel(v.clone().addScaledVector(k3v, dt));

  const dr = k1r.clone().addScaledVector(k2r, 2).addScaledVector(k3r, 2).add(k4r).multiplyScalar(dt/6);
  const dv = k1v.clone().addScaledVector(k2v, 2).addScaledVector(k3v, 2).add(k4v).multiplyScalar(dt/6);

  return {dr, dv};
}

function initializeSimulation(resetCamera = false) {
  // Clear scene objects except lights and GUI
  for(let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if(obj !== dirLight && !(obj instanceof THREE.AmbientLight)) {
      scene.remove(obj);
      if(obj.geometry) obj.geometry.dispose();
      if(obj.material) obj.material.dispose();
    }
  }

  if(params.showAxes) {
    axesHelper && scene.remove(axesHelper);
    axesHelper = createLabeledAxes(10);
    scene.add(axesHelper);
  } else {
    axesHelper && scene.remove(axesHelper);
    axesHelper = null;
  }

  if(params.showGrid) {
    if(!gridHelper) {
      gridHelper = new THREE.GridHelper(20, 20);
      scene.add(gridHelper);
    } else {
      gridHelper.visible = true;
    }
  } else {
    if(gridHelper) gridHelper.visible = false;
  }

  particles = [];
  for(let i=0; i < params.particleCount; i++) {
    const p = new Particle();
    if(params.showSpheres) scene.add(p.mesh);
    if(params.showTrail) scene.add(p.trail);
    p.resetTrajectory();
    particles.push(p);
  }

  if(resetCamera) {
    camera.position.set(0, 0, 20);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function updateSimulation() {
  const dt = baseDt / params.animationSpeed;
  const time = performance.now() / 1000;
  particles.forEach(p => {
    const {dr, dv} = rk4Step(p.r, p.v, dt);
    p.r.add(dr);
    p.v.add(dv);

    if(params.showSpheres) p.mesh.position.copy(p.r);
    if(params.showTrail) p.updateTrail();
    p.logTrajectory(time);
  });
}

function exportTrajectories() {
  let csv = 'particle,time,x,y,z\n';
  particles.forEach((p,i) => {
    p.trajectoryData.forEach(pt => {
      csv += `${i},${pt.time.toFixed(3)},${pt.x.toFixed(6)},${pt.y.toFixed(6)},${pt.z.toFixed(6)}\n`;
    });
  });
  const blob = new Blob([csv], {type:'text/csv'});
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
  params.friction = 0;
  params.Ex = 0; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 1;
  params.initVx = 1; params.initVy = 0; params.initVz = 0;
  initializeSimulation(true);
}

function presetCycloidal() {
  params.q = 1;
  params.mass = 1;
  params.friction = 0;
  params.Ex = 1; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 1;
  params.initVx = 0; params.initVy = 0; params.initVz = 0;
  initializeSimulation(true);
}

function presetStraightLine() {
  params.q = 1;
  params.mass = 1;
  params.friction = 0;
  params.Ex = 0; params.Ey = 0; params.Ez = 0;
  params.Bx = 0; params.By = 0; params.Bz = 0;
  params.initVx = 1; params.initVy = 0; params.initVz = 0;
  initializeSimulation(true);
}

const gui = new GUI();

const physFolder = gui.addFolder('Physics');
physFolder.add(params, 'q', -10, 10, 0.1).name('Charge (q)').onChange(() => initializeSimulation(false));
physFolder.add(params, 'mass', 0.01, 10, 0.01).name('Mass').onChange(() => initializeSimulation(false));
physFolder.add(params, 'friction', 0, 1, 0.01).name('Friction').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ex', -10, 10, 0.1).name('Electric Ex').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ey', -10, 10, 0.1).name('Electric Ey').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Ez', -10, 10, 0.1).name('Electric Ez').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Bx', -10, 10, 0.1).name('Magnetic Bx').onChange(() => initializeSimulation(false));
physFolder.add(params, 'By', -10, 10, 0.1).name('Magnetic By').onChange(() => initializeSimulation(false));
physFolder.add(params, 'Bz', -10, 10, 0.1).name('Magnetic Bz').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVx', -10, 10, 0.1).name('Init Velocity X').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVy', -10, 10, 0.1).name('Init Velocity Y').onChange(() => initializeSimulation(false));
physFolder.add(params, 'initVz', -10, 10, 0.1).name('Init Velocity Z').onChange(() => initializeSimulation(false));
physFolder.add(params, 'particleCount', 1, 10, 1).name('Particle Count').onFinishChange(() => initializeSimulation());
physFolder.open();

const visualFolder = gui.addFolder('Visuals');
visualFolder.add(params, 'animationSpeed', 0.1, 10, 0.1).name('Animation Speed');
visualFolder.addColor(params, 'particleColor').name('Particle Color').onChange(() => {
  particles.forEach(p => p.material.color.set(params.particleColor));
});
visualFolder.addColor(params, 'trailColor').name('Trail Color').onChange(() => {
  particles.forEach(p => p.trailMaterial.color.set(params.trailColor));
});
visualFolder.add(params, 'trailPersistence').name('Persist Trails').onChange(() => {
  if(!params.trailPersistence) {
    particles.forEach(p => {
      p.positionCount = 0;
      p.trailIndex = 0;
      p.trailGeometry.setDrawRange(0, 0);
      p.trailGeometry.attributes.position.needsUpdate = true;
    });
  }
});
visualFolder.add(params, 'showSpheres').name('Show Spheres').onChange(() => {
  particles.forEach(p => p.mesh.visible = params.showSpheres);
});
visualFolder.add(params, 'showTrail').name('Show Trails').onChange(() => {
  particles.forEach(p => p.trail.visible = params.showTrail);
});
visualFolder.add(params, 'showAxes').name('Show Axes').onChange(() => {
  if(axesHelper) axesHelper.visible = params.showAxes;
});
visualFolder.add(params, 'showGrid').name('Show Grid').onChange(() => {
  if(gridHelper) gridHelper.visible = params.showGrid;
});
visualFolder.addColor(params, 'backgroundColor').name('Background Color').onChange(() => {
  scene.background.set(params.backgroundColor);
});
visualFolder.open();

const presetFolder = gui.addFolder('Presets');
presetFolder.add({ Cyclotron: presetCyclotron }, 'Cyclotron').name('Cyclotron');
presetFolder.add({ Cycloidal: presetCycloidal }, 'Cycloidal').name('Cycloidal');
presetFolder.add({ StraightLine: presetStraightLine }, 'StraightLine').name('Straight Line');
presetFolder.add({ InvertCharge: invertChargeSign }, 'InvertCharge').name('Invert Charge Sign');
presetFolder.open();

gui.add({PauseResume: () => { isPaused = !isPaused; }}, 'PauseResume').name('Pause / Resume (Space)');
gui.add({Reset: () => initializeSimulation(true)}, 'Reset').name('Reset (R)');
gui.add({Export: exportTrajectories}, 'Export').name('Export Trajectories (CSV)');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', e => {
  if(e.key === ' ') isPaused = !isPaused;
  if(e.key.toLowerCase() === 'r') initializeSimulation(true);
});

// Initialize & animate
initializeSimulation(true);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if(!isPaused) updateSimulation();
  renderer.render(scene, camera);
}
animate();













  






    
        
                
        
