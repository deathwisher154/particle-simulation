import * as THREE from 'three';
import { PARAMS } from './config.js';

const DUMMY = new THREE.Object3D(); // Reusable object for matrix updates

class Particle {
    constructor(initPos, initVel, charge) {
        this.r = initPos.clone(); // Position
        this.v = initVel.clone(); // Velocity
        this.q = charge;
        this.gamma = 1.0;
        this.color = new THREE.Color(PARAMS.visuals.particleColor);
    }
}

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.setupParticles();
        this.setupTrails();
    }

    setupParticles() {
        const count = PARAMS.particles.count;
        const geometry = new THREE.SphereGeometry(PARAMS.visuals.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        this.instancedMesh.visible = PARAMS.visuals.showSpheres;
        this.scene.add(this.instancedMesh);
        
        const radius = 2.5;
        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count;
            const initPos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
            const initVel = new THREE.Vector3(PARAMS.particles.initVx, PARAMS.particles.initVy, PARAMS.particles.initVz);
            const charge = PARAMS.particles.randomCharge ? (Math.random() - 0.5) * 2 * PARAMS.physics.baseCharge : PARAMS.physics.baseCharge;
            
            const p = new Particle(initPos, initVel, charge);
            this.particles.push(p);

            DUMMY.position.copy(p.r);
            DUMMY.updateMatrix();
            this.instancedMesh.setMatrixAt(i, DUMMY.matrix);
            this.instancedMesh.setColorAt(i, p.color);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;
    }
    
    setupTrails() {
        // Trail logic can be added here, similar to the original,
        // but now managed by the ParticleSystem.
    }

    update(stagedUpdates) {
        let needsMatrixUpdate = false;
        let needsColorUpdate = false;

        this.particles.forEach((p, i) => {
            const { dr, dv } = stagedUpdates[i];
            p.r.add(dr);
            p.v.add(dv);

            if (PARAMS.visuals.showSpheres) {
                DUMMY.position.copy(p.r);
                DUMMY.updateMatrix();
                this.instancedMesh.setMatrixAt(i, DUMMY.matrix);
                needsMatrixUpdate = true;

                if (PARAMS.physics.useRelativity) {
                    const speedRatio = p.v.length() / PARAMS.physics.c;
                    p.color.setHSL(0.6, 1.0, 0.5 + speedRatio * 0.5);
                    this.instancedMesh.setColorAt(i, p.color);
                    needsColorUpdate = true;
                }
            }
        });
        
        if (needsMatrixUpdate) this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (needsColorUpdate) this.instancedMesh.instanceColor.needsUpdate = true;
    }

    dispose() {
        this.instancedMesh.geometry.dispose();
        this.instancedMesh.material.dispose();
        this.scene.remove(this.instancedMesh);
        // Dispose trails here
    }
}
