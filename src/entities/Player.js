import * as THREE from '../../libs/three.module.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Physics
        this.position = new THREE.Vector3(0, 20, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = 6.0;
        this.gravity = 25.0;
        this.jumpForce = 10.0;
        
        // Rotation
        this.yaw = 0;
        this.pitch = 0;

        // Visuals
        this.meshGroup = new THREE.Group();
        this.createModel();
        
        // Camera Attachment
        this.cameraPivot = new THREE.Object3D();
        this.cameraPivot.position.y = 1.5;
        this.meshGroup.add(this.cameraPivot);
        
        // Add camera to pivot (Third Person)
        this.camera.position.set(0, 0.5, 4);
        this.cameraPivot.add(this.camera);

        this.scene.add(this.meshGroup);
    }

    createModel() {
        const matSkin = new THREE.MeshStandardMaterial({color: 0xffccaa});
        const matShirt = new THREE.MeshStandardMaterial({color: 0x3498db});
        const matPants = new THREE.MeshStandardMaterial({color: 0x2c3e50});

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSkin);
        head.position.y = 1.75; head.castShadow = true;
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), matShirt);
        body.position.y = 1.125; body.castShadow = true;
        
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), matPants);
        legs.position.y = 0.375; legs.castShadow = true;

        this.meshGroup.add(head, body, legs);
    }

    update(delta, input, worldManager) {
        // 1. Rotation (Look)
        this.yaw -= input.looking.x;
        this.pitch -= input.looking.y;
        this.pitch = Math.max(-1.2, Math.min(0.5, this.pitch));
        
        this.meshGroup.rotation.y = this.yaw;
        this.cameraPivot.rotation.x = this.pitch;

        // 2. Movement Calculation
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
        
        const moveVec = new THREE.Vector3();
        if(input.move.z === 1) moveVec.add(forward);
        if(input.move.z === -1) moveVec.sub(forward);
        if(input.move.x === 1) moveVec.add(right);
        if(input.move.x === -1) moveVec.sub(right);
        
        if(moveVec.lengthSq() > 0) moveVec.normalize();

        // Apply Move
        this.position.addScaledVector(moveVec, this.speed * delta);

        // 3. Gravity & Jumping
        if(input.jumping && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        this.velocity.y -= this.gravity * delta;
        this.position.y += this.velocity.y * delta;

        // 4. Collision (Floor Check)
        this.handleCollisions(worldManager);

        // Update Mesh Position
        this.meshGroup.position.copy(this.position);
    }

    handleCollisions(worldManager) {
        // Simple Raycast Down
        const feetY = this.position.y;
        const groundBlock = worldManager.getBlock(
            Math.floor(this.position.x), 
            Math.floor(feetY), // Check block literally inside feet
            Math.floor(this.position.z)
        );
        
        // Also check block BELOW feet
        const blockBelow = worldManager.getBlock(
            Math.floor(this.position.x), 
            Math.floor(feetY - 0.1), 
            Math.floor(this.position.z)
        );

        // If block below is solid (Not AIR=0, Not Water=6)
        if(blockBelow !== 0 && blockBelow !== 6) {
            const groundHeight = Math.floor(feetY); 
            // If falling and feet intersect ground
            if (this.velocity.y <= 0 && feetY < groundHeight + 1) {
                this.position.y = groundHeight + 1;
                this.velocity.y = 0;
                this.onGround = true;
            }
        } else {
            this.onGround = false;
        }

        // Void kill
        if(this.position.y < -30) {
            this.position.set(0, 30, 0);
            this.velocity.y = 0;
        }
    }
}

