export const PARAMS = {
    physics: {
        useRelativity: false,
        c: 20.0,
        restMass: 1.0,
        friction: 0.0,
        k_e: 1.0,
        baseCharge: 1.0,
        animationSpeed: 1.5,
    },
    particles: {
        count: 3,
        randomCharge: false,
        initVx: 1.0, initVy: 0.0, initVz: 0.0,
    },
    fields: {
        E_x_str: '0.0', E_y_str: '0.0', E_z_str: '0.0',
        B_x_str: '0.0', B_y_str: '0.0', B_z_str: '1.0',
    },
    visuals: {
        radius: 0.3,
        trailPersistence: false,
        backgroundColor: '#050510',
        particleColor: '#00ffff',
        trailColor: '#ffff00',
        showAxes: true,
        showTrail: true,
        showSpheres: true,
        showGrid: false,
    }
};

export const CONSTANTS = {
    SOFTENING: 1e-6,
    MAX_DT: 1 / 30,
    C_SQUARED_EPSILON: 1e-9
};

export const fieldFunctions = {
    Ex: (x, y, z, t) => 0, Ey: (x, y, z, t) => 0, Ez: (x, y, z, t) => 0,
    Bx: (x, y, z, t) => 0, By: (x, y, z, t) => 0, Bz: (x, y, z, t) => 0,
};

export function compileFieldFunctions() {
    // ... (same compilation logic as original)
    return true; // or false on error
}
