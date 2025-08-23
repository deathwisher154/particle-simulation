import { ParticleSystem } from './particle.js';
import { Physics } from './physics.js';
import { PARAMS, CONSTANTS } from './config.js';
import { setAxesVisibility, setGridVisibility } from './visuals.js';
import { updateChargeGUI, updateInfoGUI } from './gui.js';

export class Simulation {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.isPaused = false;
        this.totalTimeSec = 0;
        this.lastTimeSec = performance.now() / 1000;

        this.timeDisplay = document.getElementById('time-display');
        this.statusDisplay = document.getElementById('status-display');
        
        this.initialize({ resetCamera: true });
    }

    initialize({ resetCamera = false, randomizeVelocities = false } = {}) {
        if (this.particleSystem) {
            this.particleSystem.dispose();
        }
        
        this.particleSystem = new ParticleSystem(this.scene, randomizeVelocities);
        this.totalTimeSec = 0;
        this.lastTimeSec = performance.now() / 1000;

        setAxesVisibility(this.scene, PARAMS.visuals.showAxes);
        setGridVisibility(this.scene, PARAMS.visuals.showGrid);
        
        updateChargeGUI(this.particleSystem.particles);
        updateInfoGUI(this.particleSystem.particles);
        
        if (resetCamera) {
            this.camera.position.set(0, 0, 25);
            this.controls.target.set(0, 0, 0);
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.statusDisplay.textContent = this.isPaused ? 'Paused' : 'Running';
    }

    update() {
        const nowSec = performance.now() / 1000;
        let dt = nowSec - this.lastTimeSec;
        this.lastTimeSec = nowSec;

        if (this.isPaused || dt <= 0) return;

        dt = Math.min(dt * PARAMS.physics.animationSpeed, CONSTANTS.MAX_DT);
        this.totalTimeSec += dt;

        try {
            // Staging avoids order-dependence in multi-particle calculations like Coulomb force
            const stagedUpdates = this.particleSystem.particles.map((p, i) =>
                Physics.rk4Step(i, p, dt, this.totalTimeSec, this.particleSystem.particles)
            );
            
            this.particleSystem.applyUpdates(stagedUpdates);
            this.updateUI();

        } catch (e) {
            this.togglePause();
            console.error("Simulation error:", e);
            alert(`Simulation paused due to a runtime error: ${e.message}`);
        }
    }
    
    updateUI() {
        this.timeDisplay.textContent = this.totalTimeSec.toFixed(2);
        // The 'infoFolder' is imported from gui.js and checked for existence
        if (PARAMS.physics.useRelativity && infoFolder) {
            this.particleSystem.particles.forEach((p, i) => {
                if (infoFolder.controllers[i]) {
                    infoFolder.controllers[i].setValue(p.gamma.toFixed(3));
                }
            });
        }
    }
}
