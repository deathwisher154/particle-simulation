export const PARAMS = {
    physics: {
        useRelativity: false,
        c: 20.0,
        restMass: 1.0,
        friction: 0.0,
        k_e: 0.0, // Set to 0 by default to not interfere with field presets
        baseCharge: 1.0,
        animationSpeed: 1.5,
    },
    particles: {
        count: 1,
        randomCharge: false,
        initVx: 2.0, initVy: 0.0, initVz: 0.0,
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
        showGrid: true,
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
  try {
    const common = 'const {sin,cos,tan,sqrt,PI,exp,abs,pow,sign,min,max,tanh} = Math;';
    const fields = PARAMS.fields;
    fieldFunctions.Ex = new Function('x', 'y', 'z', 't', `${common} return ${fields.E_x_str};`);
    fieldFunctions.Ey = new Function('x', 'y', 'z', 't', `${common} return ${fields.E_y_str};`);
    fieldFunctions.Ez = new Function('x', 'y', 'z', 't', `${common} return ${fields.E_z_str};`);
    fieldFunctions.Bx = new Function('x', 'y', 'z', 't', `${common} return ${fields.B_x_str};`);
    fieldFunctions.By = new Function('x', 'y', 'z', 't', `${common} return ${fields.B_y_str};`);
    fieldFunctions.Bz = new Function('x', 'y', 'z', 't', `${common} return ${fields.B_z_str};`);
    
    // Test one function to catch syntax errors early
    fieldFunctions.Ex(0,0,0,0);
    return true; // Success
  } catch (e) {
    console.error("Field function compile error:", e.message);
    return { error: true, message: e.message }; // Failure
  }
}

export function compileFieldFunctions() {
    // ... (same compilation logic as original)
    return true; // or false on error
}
