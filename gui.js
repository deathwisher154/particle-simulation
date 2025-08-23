import GUI from 'lil-gui';
import { PARAMS, fieldFunctions, compileFieldFunctions } from './config.js';
import { setAxesVisibility, setGridVisibility } from './visuals.js';
import * as presets from './presets.js';

export let gui;
export let chargesFolder;
export let infoFolder;

export function createGUI(simulation) {
    gui = new GUI();

    // --- Physics Folder ---
    const physFolder = gui.addFolder('Physics');
    physFolder.add(PARAMS.physics, 'useRelativity').name('Use Relativity').onChange(() => simulation.initialize());
    // ... (add other physics controls)

    // --- Fields Folder ---
    const fieldsFolder = gui.addFolder('Field Functions f(x,y,z,t)');
    // ... (add field controls)

    // ... (add other folders: Initial Conditions, Visuals)

    // --- Presets & Controls ---
    const actionsFolder = gui.addFolder('Actions & Presets');
    actionsFolder.add(presets, 'cyclotron').name('Preset: Cyclotron');
    // ... (add other presets)
    actionsFolder.add({ fn: () => simulation.togglePause() }, 'fn').name('Pause/Resume (Space)');
    actionsFolder.add({ fn: () => simulation.initialize(true) }, 'fn').name('Reset (R)');

    compileFieldFunctions(); // Initial compile
    return gui;
}

export function updateChargeGUI(particles) {
    if (chargesFolder) chargesFolder.destroy();
    chargesFolder = gui.addFolder('Particle Charges');
    particles.forEach((p, i) => {
        chargesFolder.add(p, 'q', -10, 10, 0.1).name(`Particle ${i + 1} Charge`);
    });
}

export function updateInfoGUI(particles) {
    if (infoFolder) infoFolder.destroy();
    if (!PARAMS.physics.useRelativity) return;
    infoFolder = gui.addFolder('Lorentz Factor (γ)');
    particles.forEach((p, i) => {
        infoFolder.add(p, 'gamma', 0).name(`P${i+1} γ`).listen();
    });
}
