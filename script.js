import * as THREE from 'https://unpkg.com/three@0.150.0/build/three.module.js';

// --- Global Variables ---
let camera, scene, renderer;
let raycaster;
const objects = [];

// Movement Flags
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocityY = 0;
let canJump = false;

// Camera / Look Variables
let pitch = 0; // Up/Down
let yaw = 0;   // Left/Right
const lookSpeed = 0.005;

// Physics Constants
const GRAVITY = 30.0;
const SPEED = 10.0;
const JUMP_FORCE = 15.0;

// Time tracking
let prevTime = performance.now();

// Materials
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const cubeMat = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
const placedMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

init();
animate();

function init() {
    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0xffffff, 0, 750);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Important: Order YXZ allows FPS style rotation (Yaw then Pitch)
    camera.rotation.order = 'YXZ'; 
    camera.position.set(0, 2, 0);

    // 2. Lights
    const hemiLight = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.9);
    hemiLight.position.set(0.5, 1, 0.75);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 3. World Generation (Floor)
    const floorSize = 10;
    for (let x = -floorSize; x <= floorSize; x++) {
        for (let z = -floorSize; z <= floorSize; z++) {
            const voxel = new THREE.Mesh(cubeGeo, cubeMat);
            voxel.position.set(x, 0, z);
            scene.add(voxel);
            objects.push(voxel);
        }
    }

    // 4. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 5. Raycaster
    raycaster = new THREE.Raycaster();

    // 6. Setup Inputs
    setupTouchControls();

    window.addEventListener('resize', onWindowResize);
}

function setupTouchControls() {
    // --- Button Mappings ---
    const btnFwd = document.getElementById('btn-fwd');
    const btnBack = document.getElementById('btn-back');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');
    const btnPlace = document.getElementById('btn-place');
    const btnBreak = document.getElementById('btn-break');

    // Helper to bind events
    const bindBtn = (elem, actionStart, actionEnd) => {
        // Handle Touch
        elem.addEventListener('touchstart', (e) => { e.preventDefault(); actionStart(); }, {passive: false});
        elem.addEventListener('touchend', (e) => { e.preventDefault(); actionEnd(); }, {passive: false});
        // Handle Mouse (for testing on PC)
        elem.addEventListener('mousedown', (e) => { actionStart(); });
        elem.addEventListener('mouseup', (e) => { actionEnd(); });
        elem.addEventListener('mouseleave', (e) => { actionEnd(); });
    };

    bindBtn(btnFwd, () => moveForward = true, () => moveForward = false);
    bindBtn(btnBack, () => moveBackward = true, () => moveBackward = false);
    bindBtn(btnLeft, () => moveLeft = true, () => moveLeft = false);
    bindBtn(btnRight, () => moveRight = true, () => moveRight = false);

    bindBtn(btnJump, () => {
        if (canJump) {
            velocityY = JUMP_FORCE;
            canJump = false;
        }
    }, () => {});

    // Action Buttons (Place/Break) trigger immediately on press
    btnPlace.addEventListener('touchstart', (e) => { e.preventDefault(); interactWithWorld('place'); });
    btnPlace.addEventListener('mousedown', (e) => { e.preventDefault(); interactWithWorld('place'); });

    btnBreak.addEventListener('touchstart', (e) => { e.preventDefault(); interactWithWorld('break'); });
    btnBreak.addEventListener('mousedown', (e) => { e.preventDefault(); interactWithWorld('break'); });


    // --- Camera Touch Look Logic ---
    // We listen to touch moves on the canvas (background)
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        // Only track if touching the canvas, not the buttons
        if (e.target.tagName !== 'BUTTON') {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (e.target.tagName === 'BUTTON') return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;

        // Apply rotation
        yaw -= deltaX * lookSpeed;
        pitch -= deltaY * lookSpeed;

        // Clamp Pitch (so you can't look inside yourself)
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Update Camera
        camera.rotation.x = pitch;
        camera.rotation.y = yaw;

        // Reset start position for continuous drag
        touchStartX = touchX;
        touchStartY = touchY;
    });
}

function interactWithWorld(action) {
    // Raycast from center of screen
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        
        // Distance check (only interact if close enough)
        if (intersect.distance > 8) return;

        if (action === 'break') {
            // Don't delete floor at y=0 if you want to be safe, or allow it
            if(intersect.object.position.y !== -100) { // Just a safety check
                scene.remove(intersect.object);
                objects.splice(objects.indexOf(intersect.object), 1);
            }
        } else if (action === 'place') {
            const voxel = new THREE.Mesh(cubeGeo, placedMat);
            voxel.position.copy(intersect.point).add(intersect.face.normal);
            voxel.position.divideScalar(1).floor().multiplyScalar(1).addScalar(0.5);

            // Prevent placing block inside player
            const playerPos = camera.position.clone();
            const dist = voxel.position.distanceTo(playerPos);
            if (dist < 1.5) return; // Simple anti-clip

            scene.add(voxel);
            objects.push(voxel);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    // --- Movement Physics ---
    
    // Calculate forward/right vectors based on current Yaw
    // We only care about horizontal movement, so we use Sin/Cos of Yaw
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    const moveX = (Number(moveRight) - Number(moveLeft));
    const moveZ = (Number(moveForward) - Number(moveBackward));

    // Apply movement
    if (moveX !== 0 || moveZ !== 0) {
        camera.position.x += (forwardX * moveZ + rightX * moveX) * SPEED * delta;
        camera.position.z += (forwardZ * moveZ + rightZ * moveX) * SPEED * delta;
    }

    // Gravity & Jumping
    velocityY -= GRAVITY * delta;
    camera.position.y += velocityY * delta;

    // Floor Collision
    // Simple check: if y < 2 (player height), stop falling
    if (camera.position.y < 2) {
        velocityY = 0;
        camera.position.y = 2;
        canJump = true;
    }

    renderer.render(scene, camera);
}

