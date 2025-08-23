import * as THREE from 'three';
import { PARAMS, CONSTANTS, fieldFunctions } from './config.js';

// Reusable THREE.Vector3 objects to prevent memory allocation in the loop.
const temp = {
    vec1: new THREE.Vector3(), vec2: new THREE.Vector3(), vec3: new THREE.Vector3(),
    force: new THREE.Vector3(), r: new THREE.Vector3(), v: new THREE.Vector3(),
    k1r: new THREE.Vector3(), k1v: new THREE.Vector3(),
    k2r: new THREE.Vector3(), k2v: new THREE.Vector3(),
    k3r: new THREE.Vector3(), k3v: new THREE.Vector3(),
    k4r: new THREE.Vector3(), k4v: new THREE.Vector3(),
};

export const Physics = {
    electricField(r, t) {
        return temp.vec1.set(
            fieldFunctions.Ex(r.x, r.y, r.z, t),
            fieldFunctions.Ey(r.x, r.y, r.z, t),
            fieldFunctions.Ez(r.x, r.y, r.z, t)
        );
    },

    magneticField(r, t) {
        return temp.vec2.set(
            fieldFunctions.Bx(r.x, r.y, r.z, t),
            fieldFunctions.By(r.x, r.y, r.z, t),
            fieldFunctions.Bz(r.x, r.y, r.z, t)
        );
    },

    computeAcceleration(particleIndex, r, v, t, currentParticles) {
        const particle = currentParticles[particleIndex];
        if (PARAMS.physics.useRelativity) {
            const c = PARAMS.physics.c;
            const cSq = c * c;
            const vSq = Math.min(v.lengthSq(), cSq - CONSTANTS.C_SQUARED_EPSILON);
            
            particle.gamma = 1.0 / Math.sqrt(1.0 - vSq / cSq);

            const E = this.electricField(r, t);
            const B = this.magneticField(r, t);
            
            const v_dot_E = v.dot(E);
            const term_v_v_dot_E_over_cSq = temp.vec1.copy(v).multiplyScalar(v_dot_E / cSq);
            const v_cross_B = temp.vec2.crossVectors(v, B);

            const fullForce = temp.vec3.copy(E).add(v_cross_B).sub(term_v_v_dot_E_over_cSq);
            return fullForce.multiplyScalar(particle.q / (particle.gamma * PARAMS.physics.restMass));
        } else {
            particle.gamma = 1.0;
            const E = this.electricField(r, t);
            const B = this.magneticField(r, t);
            const v_cross_B = temp.v.crossVectors(v, B);
            const lorentz = temp.force.copy(E).add(v_cross_B).multiplyScalar(particle.q);
            // Coulomb and drag forces can be added here as in the original
            return lorentz.multiplyScalar(1.0 / PARAMS.physics.restMass);
        }
    },

    rk4Step(i, p, dt, t, currentParticles) {
        const a = (vel, pos) => this.computeAcceleration(i, pos, vel, t, currentParticles);

        temp.k1v.copy(a(p.v, p.r)).multiplyScalar(dt);
        temp.k1r.copy(p.v).multiplyScalar(dt);

        temp.k2v.copy(a(temp.vec1.copy(p.v).addScaledVector(temp.k1v, 0.5), temp.vec2.copy(p.r).addScaledVector(temp.k1r, 0.5))).multiplyScalar(dt);
        temp.k2r.copy(temp.vec1).multiplyScalar(dt);

        temp.k3v.copy(a(temp.vec1.copy(p.v).addScaledVector(temp.k2v, 0.5), temp.vec2.copy(p.r).addScaledVector(temp.k2r, 0.5))).multiplyScalar(dt);
        temp.k3r.copy(temp.vec1).multiplyScalar(dt);

        temp.k4v.copy(a(temp.vec1.copy(p.v).add(temp.k3v), temp.vec2.copy(p.r).add(temp.k3r))).multiplyScalar(dt);
        temp.k4r.copy(temp.vec1).multiplyScalar(dt);

        const dr = temp.r.copy(temp.k1r).addScaledVector(temp.k2r, 2).addScaledVector(temp.k3r, 2).add(temp.k4r).multiplyScalar(1 / 6);
        const dv = temp.v.copy(temp.k1v).addScaledVector(temp.k2v, 2).addScaledVector(temp.k3v, 2).add(temp.k4v).multiplyScalar(1 / 6);

        return { dr, dv };
    }
};
