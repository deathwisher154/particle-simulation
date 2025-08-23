import * as THREE from 'three';
import { ParticleSystem } from './particle.js';
import { Physics } from './physics.js';
import { PARAMS, CONSTANTS } from './config.js';
import { setAxesVisibility, setGridVisibility } from './visuals.js';
import { updateInfoGUI, updateChargeGUI } from './gui.js';

export class Simulation {
    constructor(scene) {
        this.scene = scene;
        this.isPaused = false;
        this.totalTimeSec = 0;
        this.lastTimeSec = performance.now() / 1000;

        this.timeDisplay = document.getElementById('time-display');
        this.statusDisplay = document.getElementById('status-display');
        
        this.initialize(true);
    }

    initialize(resetCamera = false) {
        if (this.particleSystem) {
            this.particleSystem.dispose();
        }
        
        this.particleSystem = new ParticleSystem(this.scene);
        this.totalTimeSec = 0;

        setAxesVisibility(this.scene, PARAMS.visuals.showAxes);
        setGridVisibility(this.scene, PARAMS.visuals.showGrid);
        
        updateChargeGUI(this.particleSystem.particles);
        updateInfoGUI(this.particleSystem.particles);
        
        if (resetCamera) {
            // Placeholder for camera reset logic if needed
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
            const stagedUpdates = this.particleSystem.particles.map((p, i) =>
                Physics.rk4Step(i, p, dt, this.totalTimeSec, this.particleSystem.particles)
            );
            
            this.particleSystem.update(stagedUpdates);
            this.updateUI();

        } catch (e) {
            this.isPaused = true;
            console.error("Simulation error:", e);
            alert(`Simulation paused due to a runtime error: ${e.message}`);
        }
    }
    
    updateUI() {
        this.timeDisplay.textContent = this.totalTimeSec.toFixed(2);
        if (PARAMS.physics.useRelativity && infoFolder) {
            this.particleSystem.particles.forEach((p, i) => {
                if (infoFolder.__controllers[i]) {
                    infoFolder.__controllers[i].setValue(p.gamma.toFixed(3));
                }
            });
        }
    }
}
