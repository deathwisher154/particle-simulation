import * as THREE from 'three';
import { PARAMS } from './config.js';

const DUMMY = new THREE.Object3D(); // Reusable object for matrix updates

class Trail {
    constructor(scene, color) {
        this.maxPoints = 5000;
        this.positions = new Float32Array(this.maxPoints * 3);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        
        this.material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
        this.line = new THREE.Line(this.geometry, this.material);
        this.line.frustumCulled = false;
        this.line.visible = PARAMS.visuals.showTrail;
        
        this.positionCount = 0;
        this.trailIndex = 0;
        scene.add(this.line);
    }

    update(point) {
        if (!PARAMS.visuals.trailPersistence && this.positionCount >= this.maxPoints) this.reset();

        const i = this.trailIndex;
        this.positions[i * 3 + 0] = point.x;
        this.positions[i * 3 + 1] = point.y;
        this.positions[i * 3 + 2] = point.z;
        this.trailIndex = (this.trailIndex + 1) % this.maxPoints;
        this.positionCount = Math.min(this.positionCount + 1, this.maxPoints);
        this.geometry.setDrawRange(0, this.positionCount);
        this.geometry.attributes.position.needsUpdate = true;
    }

    reset() {
        this.positionCount = 0;
        this.trailIndex = 0;
        this.geometry.setDrawRange(0, 0);
    }

    dispose(scene) {
        scene.remove(this.line);
        this.geometry.dispose();
        this.material.dispose();
    }
}

class Particle {
    constructor(initPos, initVel, charge, scene) {
        this.r = initPos.clone(); // Position
        this.v = initVel.clone(); // Velocity
        this.q = charge;
        this.gamma = 1.0;
        this.color = new THREE.Color(PARAMS.visuals.particleColor);
        this.trail = new Trail(scene, new THREE.Color(PARAMS.visuals.trailColor));
    }
}

export class ParticleSystem {
    constructor(scene, randomizeVelocities) {
        this.scene = scene;
        this.particles = [];
        this.setupParticles(randomizeVelocities);
    }

    setupParticles(randomize) {
        const count = PARAMS.particles.count;
        const geometry = new THREE.SphereGeometry(PARAMS.visuals.radius, 12, 12);
        const material = new THREE.MeshStandardMaterial(); // Color will be set per-instance
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        this.instancedMesh.visible = PARAMS.visuals.showSpheres;
        this.scene.add(this.instancedMesh);
        
        const radius = 2.5;
        for (let i = 0; i < count; i++) {
            const angle = count > 1 ? (2 * Math.PI * i) / count : 0;
            const initPos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
            
            const initVel = randomize ? 
                new THREE.Vector3(
                    (Math.random() - 0.5) * 2 * PARAMS.particles.initVx,
                    (Math.random() - 0.5) * 2 * PARAMS.particles.initVy,
                    (Math.random() - 0.5) * 2 * PARAMS.particles.initVz
                ) : 
                new THREE.Vector3(PARAMS.particles.initVx, PARAMS.particles.initVy, PARAMS.particles.initVz);
            
            const charge = PARAMS.particles.randomCharge ? (Math.random() - 0.5) * 2 * PARAMS.physics.baseCharge : PARAMS.physics.baseCharge;
            
            const p = new Particle(initPos, initVel, charge, this.scene);
            this.particles.push(p);

            // Set initial visual state
            DUMMY.position.copy(p.r);
            DUMMY.updateMatrix();
            this.instancedMesh.setMatrixAt(i, DUMMY.matrix);
            this.instancedMesh.setColorAt(i, p.color);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;
    }

    applyUpdates(stagedUpdates) {
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
                    p.color.setHSL(0.6, 1.0, 0.5 + Math.min(speedRatio, 1.0) * 0.5);
                } else {
                    p.color.set(PARAMS.visuals.particleColor);
                }
                this.instancedMesh.setColorAt(i, p.color);
                needsColorUpdate = true;
            }
            if(PARAMS.visuals.showTrail) {
                p.trail.update(p.r);
            }
        });
        
        if (needsMatrixUpdate) this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (needsColorUpdate) this.instancedMesh.instanceColor.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.instancedMesh);
        this.instancedMesh.geometry.dispose();
        this.instancedMesh.material.dispose();
        this.particles.forEach(p => p.trail.dispose(this.scene));
    }
}
