import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.AmbientLight(0x404040, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Particle mesh
const geometry = new THREE.SphereGeometry(0.5, 32, 32);
const material = new THREE.MeshStandardMaterial({color: 0x00ffff});
const particle = new THREE.Mesh(geometry, material);
scene.add(particle);

// Axes helper
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Physics parameters
const params = {
  q: 1.0, // charge
  mass: 1.0,
  B: new THREE.Vector3(0, 0, 1), // magnetic field vector
  E: new THREE.Vector3(0, 0, 0), // electric field vector
  v: new THREE.Vector3(1, 0, 0), // initial velocity
  r: new THREE.Vector3(0, 0, 0), // initial position (origin)
  dt: 0.01
};

// Lorentz force function
function lorentzForce(v, q, E, B) {
  // F = q(E + v x B)
  const vxB = new THREE.Vector3().crossVectors(v, B);
  return new THREE.Vector3().addVectors(E, vxB).multiplyScalar(q);
}

// RK4 integrator for position and velocity
function rk4Step(r, v, dt) {
  // dr/dt = v
  // dv/dt = a = F/m = lorentzForce/m

  function accel(vel) {
    return lorentzForce(vel, params.q, params.E, params.B).divideScalar(params.mass);
  }

  const k1r = v.clone();
  const k1v = accel(v);

  const k2r = v.clone().addScaledVector(k1v, dt / 2);
  const k2v = accel(v.clone().addScaledVector(k1v, dt / 2));

  const k3r = v.clone().addScaledVector(k2v, dt / 2);
  const k3v = accel(v.clone().addScaledVector(k2v, dt / 2));

  const k4r = v.clone().addScaledVector(k3v, dt);
  const k4v = accel(v.clone().addScaledVector(k3v, dt));

  const dr = k1r.clone().addScaledVector(k2r, 2).addScaledVector(k3r, 2).add(k4r).multiplyScalar(dt / 6);
  const dv = k1v.clone().addScaledVector(k2v, 2).addScaledVector(k3v, 2).add(k4v).multiplyScalar(dt / 6);

  return { dr, dv };
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Integrate
  const { dr, dv } = rk4Step(params.r, params.v, params.dt);
  params.r.add(dr);
  params.v.add(dv);

  // Update particle position
  particle.position.copy(params.r);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();






    
        
                
        
