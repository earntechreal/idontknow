import * as THREE from '../../libs/three.module.js';

export class Zombie {
    constructor(scene, x, y, z) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y, z);

        const mat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 }); // Green
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        head.position.y = 1.7;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), new THREE.MeshStandardMaterial({color: 0x3333ff}));
        body.position.y = 1.0;
        
        // Arms forward (Zombie style)
        const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const armL = new THREE.Mesh(armGeo, mat);
        armL.position.set(-0.4, 1.3, 0.4);
        armL.rotation.x = -Math.PI/2;
        const armR = new THREE.Mesh(armGeo, mat);
        armR.position.set(0.4, 1.3, 0.4);
        armR.rotation.x = -Math.PI/2;

        this.mesh.add(head, body, armL, armR);
        this.scene.add(this.mesh);
    }

    update(delta, targetPos) {
        // Very simple tracking
        const dist = this.mesh.position.distanceTo(targetPos);
        if(dist < 15 && dist > 1) {
            const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
            dir.y = 0; // Don't fly
            this.mesh.position.addScaledVector(dir, 2.0 * delta);
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
        }
        // Gravity
        if(this.mesh.position.y > 0) this.mesh.position.y -= 9.8 * delta;
        if(this.mesh.position.y < 0) this.mesh.position.y = 0; // Simple floor
    }
}

