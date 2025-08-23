import GUI from 'lil-gui';
import { PARAMS, compileFieldFunctions } from './config.js';
import { setAxesVisibility, setGridVisibility } from './visuals.js';
import * as presets from './presets.js';

export let gui;
export let chargesFolder;
export let infoFolder;

export function createGUI(simulation) {
    gui = new GUI();
    gui.title("Simulation Controls");

    // --- Physics Folder ---
    const physFolder = gui.addFolder('Physics').close();
    physFolder.add(PARAMS.physics, 'useRelativity').name('Use Relativity').onChange(() => simulation.initialize());
    physFolder.add(PARAMS.physics, 'c', 1, 100, 0.1).name('Speed of Light (c)').onChange(() => simulation.initialize());
    physFolder.add(PARAMS.physics, 'baseCharge', -10, 10, 0.1).name('Base Charge').onChange(() => simulation.initialize());
    physFolder.add(PARAMS.physics, 'restMass', 0.01, 10, 0.01).name('Rest Mass').onChange(() => simulation.initialize());
    physFolder.add(PARAMS.physics, 'friction', 0, 1, 0.01).name('Friction').onChange(() => simulation.initialize());
    physFolder.add(PARAMS.physics, 'k_e', 0, 10, 0.1).name('Coulomb k_e').onChange(() => simulation.initialize());
    
    // --- Fields Folder ---
    const fieldsFolder = gui.addFolder('Field Functions f(x,y,z,t)');
    const fieldErrorDiv = document.getElementById('field-error');
    const onFieldChange = () => {
        const success = compileFieldFunctions();
        if (success) {
            fieldErrorDiv.style.display = 'none';
            simulation.initialize();
        } else {
            fieldErrorDiv.textContent = success.message;
            fieldErrorDiv.style.display = 'block';
        }
    };
    ['E_x_str', 'E_y_str', 'E_z_str', 'B_x_str', 'B_y_str', 'B_z_str'].forEach(key => {
        const name = `${key.charAt(0)}_${key.charAt(2)}`;
        fieldsFolder.add(PARAMS.fields, key).name(`${name}(x,y,z,t)`).onChange(onFieldChange);
    });

    // --- Initial Conditions Folder ---
    const initFolder = gui.addFolder('Initial Conditions');
    initFolder.add(PARAMS.particles, 'count', 1, 100, 1).name('Particle Count').onFinishChange(() => simulation.initialize());
    initFolder.add(PARAMS.particles, 'randomCharge').name('Randomize Charges').onChange(() => simulation.initialize());
    initFolder.add(PARAMS.particles, 'initVx', -30, 30, 0.1).name('Init Vel. X').onChange(() => simulation.initialize());
    initFolder.add(PARAMS.particles, 'initVy', -30, 30, 0.1).name('Init Vel. Y').onChange(() => simulation.initialize());
    initFolder.add(PARAMS.particles, 'initVz', -30, 30, 0.1).name('Init Vel. Z').onChange(() => simulation.initialize());

    // --- Visuals Folder ---
    const visualFolder = gui.addFolder('Visuals').close();
    visualFolder.add(PARAMS.physics, 'animationSpeed', 0.1, 10, 0.1).name('Anim. Speed');
    visualFolder.addColor(PARAMS.visuals, 'particleColor').name('Particle Color');
    visualFolder.addColor(PARAMS.visuals, 'trailColor').name('Trail Color').onChange(v => {
        simulation.particleSystem.particles.forEach(p => p.trail.material.color.set(v));
    });
    visualFolder.add(PARAMS.visuals, 'trailPersistence').name('Persist Trails').onChange(() => {
        if (!PARAMS.visuals.trailPersistence) simulation.particleSystem.particles.forEach(p => p.trail.reset());
    });
    visualFolder.add(PARAMS.visuals, 'showSpheres').name('Show Spheres').onChange(v => simulation.particleSystem.instancedMesh.visible = v);
    visualFolder.add(PARAMS.visuals, 'showTrail').name('Show Trails').onChange(v => simulation.particleSystem.particles.forEach(p => p.trail.line.visible = v));
    visualFolder.add(PARAMS.visuals, 'showAxes').name('Show Axes').onChange(v => setAxesVisibility(simulation.scene, v));
    visualFolder.add(PARAMS.visuals, 'showGrid').name('Show Grid').onChange(v => setGridVisibility(simulation.scene, v));
    visualFolder.addColor(PARAMS.visuals, 'backgroundColor').name('Background').onChange(v => simulation.scene.background.set(v));

    // --- Actions & Presets Folder ---
    const actionsFolder = gui.addFolder('Actions & Presets');
    const presetWrapper = {
        run: (presetFn) => {
            presetFn();
            // Refresh the entire GUI to show new param values
            gui.controllersRecursive().forEach(c => c.updateDisplay());
            simulation.initialize({ resetCamera: true });
        }
    };
    actionsFolder.add(presetWrapper, 'run', presets.presetCyclotron).name('Preset: Cyclotron');
    actionsFolder.add(presetWrapper, 'run', presets.presetExBDrift).name('Preset: E x B Drift');
    actionsFolder.add(presetWrapper, 'run', presets.presetQuadrupole).name('Preset: Quadrupole Trap');
    actionsFolder.add(presetWrapper, 'run', presets.presetRelativistic).name('Preset: Relativistic Helix');
    actionsFolder.add({ fn: () => simulation.initialize({ randomizeVelocities: true }) }, 'fn').name('Randomize Velocities');
    actionsFolder.add({ fn: () => simulation.togglePause() }, 'fn').name('Pause/Resume (Space)');
    actionsFolder.add({ fn: () => simulation.initialize({ resetCamera: true }) }, 'fn').name('Reset (R)');

    compileFieldFunctions(); // Initial compile
    return gui;
}

export function updateChargeGUI(particles) {
    if (chargesFolder) chargesFolder.destroy();
    chargesFolder = gui.addFolder('Particle Charges');
    if (particles.length > 20) {
        chargesFolder.add({ note: "Too many to display" }, 'note').disable();
    } else {
        particles.forEach((p, i) => {
            chargesFolder.add(p, 'q', -10, 10, 0.1).name(`P${i + 1} Charge`);
        });
    }
}

export function updateInfoGUI(particles) {
    if (infoFolder) infoFolder.destroy();
    if (!PARAMS.physics.useRelativity) return;
    infoFolder = gui.addFolder('Lorentz Factor (γ)');
    if (particles.length > 20) {
        infoFolder.add({ note: "Too many to display" }, 'note').disable();
    } else {
        particles.forEach((p, i) => {
            infoFolder.add(p, 'gamma', 0).name(`P${i+1} γ`).listen();
        });
    }
    infoFolder.close();
}
