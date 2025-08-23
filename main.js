import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Simulation } from './simulation.js';
import { createGUI } from './gui.js';
import { PARAMS } from './config.js';

class App {
    constructor() {
        this.setupScene();
        this.simulation = new Simulation(this.scene);
        this.gui = createGUI(this.simulation);
        this.addEventListeners();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PARAMS.visuals.backgroundColor);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.scene.add(new THREE.AmbientLight(0x404040, 2.5));
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.dirLight.position.set(5, 10, 7);
        this.scene.add(this.dirLight);
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        document.addEventListener('keydown', e => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            if (e.code === 'Space') { e.preventDefault(); this.simulation.togglePause(); }
            if (e.code === 'KeyR') { e.preventDefault(); this.simulation.initialize(true); }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();

        this.simulation.update();

        this.renderer.render(this.scene, this.camera);
    }
}

// Launch the application
new App();
