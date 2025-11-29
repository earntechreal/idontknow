import * as THREE from '../../libs/three.module.js';

export class Sky {
    constructor(scene) {
        this.scene = scene;
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.castShadow = true;
        this.scene.add(this.sun);
        
        this.ambient = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(this.ambient);
        
        this.time = 0;
    }

    update(delta, playerPos) {
        this.time += delta * 0.1; // Speed of day
        
        // Rotate sun around player
        const x = Math.sin(this.time) * 50;
        const y = Math.cos(this.time) * 50;
        
        this.sun.position.set(playerPos.x + x, y, playerPos.z + 10);
        this.sun.target.position.copy(playerPos);
        this.sun.target.updateMatrixWorld();

        // Change background color based on height of sun
        if (y > 0) {
            this.scene.background = new THREE.Color(0x87CEEB); // Day
            this.scene.fog.color.setHex(0x87CEEB);
            this.sun.intensity = 1;
        } else {
            this.scene.background = new THREE.Color(0x050510); // Night
            this.scene.fog.color.setHex(0x050510);
            this.sun.intensity = 0;
        }
    }
}

