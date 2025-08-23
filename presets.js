import { PARAMS } from './config.js';

export function presetCyclotron() {
    PARAMS.physics.useRelativity = false;
    PARAMS.physics.baseCharge = 1;
    PARAMS.physics.restMass = 1;
    PARAMS.physics.friction = 0;
    PARAMS.physics.k_e = 0;
    PARAMS.fields.E_x_str = '0';
    PARAMS.fields.E_y_str = '0';
    PARAMS.fields.E_z_str = '0';
    PARAMS.fields.B_x_str = '0';
    PARAMS.fields.B_y_str = '0';
    PARAMS.fields.B_z_str = '1';
    PARAMS.particles.initVx = 2;
    PARAMS.particles.initVy = 0;
    PARAMS.particles.initVz = 0;
    PARAMS.particles.randomCharge = false;
    PARAMS.particles.count = 1;
}

export function presetExBDrift() {
    PARAMS.physics.useRelativity = false;
    PARAMS.physics.baseCharge = 1;
    PARAMS.physics.restMass = 1;
    PARAMS.physics.friction = 0;
    PARAMS.physics.k_e = 0;
    PARAMS.fields.E_x_str = '0';
    PARAMS.fields.E_y_str = '0.5';
    PARAMS.fields.E_z_str = '0';
    PARAMS.fields.B_x_str = '0';
    PARAMS.fields.B_y_str = '0';
    PARAMS.fields.B_z_str = '1';
    PARAMS.particles.initVx = 0;
    PARAMS.particles.initVy = 0;
    PARAMS.particles.initVz = 0;
    PARAMS.particles.randomCharge = false;
    PARAMS.particles.count = 1;
}

export function presetQuadrupole() {
    PARAMS.physics.useRelativity = false;
    PARAMS.physics.baseCharge = 1;
    PARAMS.physics.restMass = 1;
    PARAMS.physics.friction = 0.1;
    PARAMS.physics.k_e = 0;
    PARAMS.fields.E_x_str = 'x';
    PARAMS.fields.E_y_str = '-y';
    PARAMS.fields.E_z_str = '0';
    PARAMS.fields.B_x_str = '0';
    PARAMS.fields.B_y_str = '0';
    PARAMS.fields.B_z_str = '0';
    PARAMS.particles.initVx = 1;
    PARAMS.particles.initVy = 1;
    PARAMS.particles.initVz = 1;
    PARAMS.particles.randomCharge = false;
    PARAMS.particles.count = 20;
}

export function presetRelativistic() {
    PARAMS.physics.useRelativity = true;
    PARAMS.physics.c = 20;
    PARAMS.physics.baseCharge = -1;
    PARAMS.physics.restMass = 1;
    PARAMS.physics.friction = 0;
    PARAMS.physics.k_e = 0;
    PARAMS.fields.E_x_str = '0';
    PARAMS.fields.E_y_str = '0';
    PARAMS.fields.E_z_str = '0.5';
    PARAMS.fields.B_x_str = '0';
    PARAMS.fields.B_y_str = '0';
    PARAMS.fields.B_z_str = '5';
    PARAMS.particles.initVx = 18; // v is 90% of c
    PARAMS.particles.initVy = 0;
    PARAMS.particles.initVz = 0;
    PARAMS.particles.randomCharge = false;
    PARAMS.particles.count = 1;
}
