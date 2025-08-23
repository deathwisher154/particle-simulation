import * as THREE from 'three';
import { PARAMS, CONSTANTS, fieldFunctions } from './config.js';

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

    computeCoulombForce(particleIndex, currentParticles) {
        const fi = temp.vec3.set(0, 0, 0);
        const pi = currentParticles[particleIndex];
        for (let j = 0; j < currentParticles.length; j++) {
            if (particleIndex === j) continue;
            const pj = currentParticles[j];
            const r_ji = temp.r.subVectors(pi.r, pj.r);
            const dist2 = Math.max(r_ji.lengthSq(), CONSTANTS.SOFTENING * CONSTANTS.SOFTENING);
            const invDist3 = Math.pow(dist2, -1.5);
            const scalar = PARAMS.physics.k_e * pi.q * pj.q * invDist3;
            fi.addScaledVector(r_ji, scalar);
        }
        return fi;
    },

    computeAcceleration(particleIndex, r, v, t, currentParticles) {
        const particle = currentParticles[particleIndex];
        const m = PARAMS.physics.restMass;

        if (PARAMS.physics.useRelativity) {
            const c = PARAMS.physics.c;
            const cSq = c * c;
            const vSq = Math.min(v.lengthSq(), cSq - CONSTANTS.C_SQUARED_EPSILON);
            
            particle.gamma = 1.0 / Math.sqrt(1.0 - vSq / cSq);

            const E = this.electricField(r, t);
            const B = this.magneticField(r, t);
            
            // Relativistic form of Lorentz Force
            const v_dot_E = v.dot(E);
            const term_v_v_dot_E_over_cSq = temp.vec1.copy(v).multiplyScalar(v_dot_E / cSq);
            const v_cross_B = temp.vec2.crossVectors(v, B);
            const fullForce = temp.force.copy(E).add(v_cross_B).sub(term_v_v_dot_E_over_cSq);

            return fullForce.multiplyScalar(particle.q / (particle.gamma * m));
        } else { // Classical Mechanics
            particle.gamma = 1.0;

            const E = this.electricField(r, t);
            const B = this.magneticField(r, t);

            // F_lorentz = q(E + v x B)
            const v_cross_B = temp.v.crossVectors(v, B);
            const lorentz = temp.force.copy(E).add(v_cross_B).multiplyScalar(particle.q);

            // F_drag = -k * v
            const drag = temp.vec1.copy(v).multiplyScalar(-PARAMS.physics.friction);
            
            // F_coulomb
            const coulomb = this.computeCoulombForce(particleIndex, currentParticles);

            const totalForce = lorentz.add(drag).add(coulomb);
            return totalForce.multiplyScalar(1.0 / m);
        }
    },

    rk4Step(i, p, dt, t, currentParticles) {
        const a = (vel, pos, time) => this.computeAcceleration(i, pos, vel, time, currentParticles);

        // k1
        const a1 = a(p.v, p.r, t);
        temp.k1v.copy(a1).multiplyScalar(dt);
        temp.k1r.copy(p.v).multiplyScalar(dt);

        // k2
        const v2 = temp.vec1.copy(p.v).addScaledVector(temp.k1v, 0.5);
        const r2 = temp.vec2.copy(p.r).addScaledVector(temp.k1r, 0.5);
        const a2 = a(v2, r2, t + dt / 2);
        temp.k2v.copy(a2).multiplyScalar(dt);
        temp.k2r.copy(v2).multiplyScalar(dt);

        // k3
        const v3 = temp.vec1.copy(p.v).addScaledVector(temp.k2v, 0.5);
        const r3 = temp.vec2.copy(p.r).addScaledVector(temp.k2r, 0.5);
        const a3 = a(v3, r3, t + dt / 2);
        temp.k3v.copy(a3).multiplyScalar(dt);
        temp.k3r.copy(v3).multiplyScalar(dt);

        // k4
        const v4 = temp.vec1.copy(p.v).add(temp.k3v);
        const r4 = temp.vec2.copy(p.r).add(temp.k3r);
        const a4 = a(v4, r4, t + dt);
        temp.k4v.copy(a4).multiplyScalar(dt);
        temp.k4r.copy(v4).multiplyScalar(dt);
        
        // Combine
        const dr = temp.r.copy(temp.k1r).addScaledVector(temp.k2r, 2).addScaledVector(temp.k3r, 2).add(temp.k4r).multiplyScalar(1 / 6);
        const dv = temp.v.copy(temp.k1v).addScaledVector(temp.k2v, 2).addScaledVector(temp.k3v, 2).add(temp.k4v).multiplyScalar(1 / 6);

        return { dr, dv };
    }
};
