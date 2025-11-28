import * as THREE from 'https://unpkg.com/three@0.150.0/build/three.module.js';

// --- Global Variables ---
let camera, scene, renderer;
let playerGroup, cameraPivot;
let raycaster;
const worldObjects = []; 
const npcs = []; 

// Inputs
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocityY = 0;

// Camera Angles
let pitch = -0.3; 
let yaw = 0;
const LOOK_SPEED = 0.006;

// Physics Settings
const GRAVITY = 30.0;
const SPEED = 6.0;        // Slightly slower for better control
const JUMP_FORCE = 11.0;
const PLAYER_HEIGHT = 1.8; 
const PLAYER_RADIUS = 0.4;

let prevTime = performance.now();

// --- Materials ---
const matGrass = new THREE.MeshStandardMaterial({ color: 0x61993b });
const matDirt = new THREE.MeshStandardMaterial({ color: 0x754e32 });
const matStone = new THREE.MeshStandardMaterial({ color: 0x7d7d7d });
const matWood = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
const matLeaves = new THREE.MeshStandardMaterial({ color: 0x3a7a3a });
const matBrick = new THREE.MeshStandardMaterial({ color: 0xb5574c });
const matGlass = new THREE.MeshStandardMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 });
const matLamp = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111 });

// Geometry
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

init();
animate();

function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 4. Lights
    setupLights();

    // 5. Objects
    createPlayer();
    generateWorld();

    // 6. Raycaster
    raycaster = new THREE.Raycaster();

    // 7. Controls
    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);
}

// --- World ---

function generateWorld() {
    const size = 16; 

    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            // Smooth Terrain
            const yNoise = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4;
            const height = Math.floor(Math.max(0, yNoise)); 

            for (let y = -2; y <= height; y++) {
                let mat = matDirt;
                if (y === height) mat = matGrass;
                if (y < -1) mat = matStone;
                
                // Only create visible blocks to save performance
                createBlock(x, y, z, mat);
            }

            // Trees
            if (x > -14 && x < 14 && z > -14 && z < 14) {
                if (Math.random() > 0.96) {
                    buildTree(x, height + 1, z);
                }
            }
        }
    }

    // Structures
    buildHouse(5, getHeightAt(5, 5), 5);
    buildStreetLamp(2, getHeightAt(2, 8), 8);

    // NPCs
    for (let i = 0; i < 4; i++) {
        const nx = Math.floor(Math.random() * 10 - 5);
        const nz = Math.floor(Math.random() * 10 - 5);
        const ny = getHeightAt(nx, nz) + 2;
        createNPC(nx, ny, nz);
    }
}

function getHeightAt(x, z) {
    const yNoise = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4;
    return Math.floor(Math.max(0, yNoise));
}

function createBlock(x, y, z, mat, collidable = true) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collidable) worldObjects.push(mesh);
    return mesh;
}

function buildTree(x, y, z) {
    for (let i = 0; i < 4; i++) createBlock(x, y + i, z, matWood);
    for (let lx = -2; lx <= 2; lx++) {
        for (let ly = 0; ly <= 2; ly++) {
            for (let lz = -2; lz <= 2; lz++) {
                if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                createBlock(x + lx, y + 3 + ly, z + lz, matLeaves);
            }
        }
    }
}

function buildHouse(x, y, z) {
    for(let i=0; i<5; i++) {
        for(let j=0; j<5; j++) createBlock(x+i, y, z+j, matStone);
    }
    for(let h=1; h<4; h++) {
        for(let i=0; i<5; i++) {
            for(let j=0; j<5; j++) {
                if(i===0 || i===4 || j===0 || j===4) {
                    if(i===2 && j===4 && h<3) continue;
                    if((i===0 || i===4) && j===2 && h===2) {
                        createBlock(x+i, y+h, z+j, matGlass);
                    } else {
                        createBlock(x+i, y+h, z+j, matBrick);
                    }
                }
            }
        }
    }
    for(let layer=0; layer<3; layer++) {
        for(let i=0+layer; i<5-layer; i++) {
            for(let j=0+layer; j<5-layer; j++) {
                createBlock(x+i, y+4+layer, z+j, matWood);
            }
        }
    }
}

function buildStreetLamp(x, y, z) {
    for(let h=0; h<4; h++) createBlock(x, y+h, z, matBlack);
    createBlock(x+1, y+3, z, matBlack);
    createBlock(x+1, y+2, z, matLamp, false);
    const pointLight = new THREE.PointLight(0xffaa00, 1, 10);
    pointLight.position.set(x+1, y+1.5, z);
    scene.add(pointLight);
}

// --- Player & NPC ---

function createPlayer() {
    playerGroup = new THREE.Group();
    playerGroup.position.set(0, 10, 0); 
    scene.add(playerGroup);

    const matSkin = new THREE.MeshStandardMaterial({color: 0xffccaa});
    const matShirt = new THREE.MeshStandardMaterial({color: 0x3498db});
    const matPants = new THREE.MeshStandardMaterial({color: 0x2c3e50});

    // Body parts adjusted to sit exactly on y=0 of the group
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSkin);
    head.position.y = 1.75;
    head.castShadow = true;
    playerGroup.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), matShirt);
    body.position.y = 1.125;
    body.castShadow = true;
    playerGroup.add(body);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), matPants);
    legL.position.set(-0.15, 0.375, 0);
    legL.castShadow = true;
    playerGroup.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), matPants);
    legR.position.set(0.15, 0.375, 0);
    legR.castShadow = true;
    playerGroup.add(legR);

    // Camera Boom
    cameraPivot = new THREE.Object3D();
    cameraPivot.position.y = 1.5;
    playerGroup.add(cameraPivot);
    camera.position.set(0, 0.5, 4); 
    cameraPivot.add(camera);
}

function createNPC(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);

    const color = Math.random() * 0xffffff;
    const matShirt = new THREE.MeshStandardMaterial({color: color});
    const matSkin = new THREE.MeshStandardMaterial({color: 0xffccaa});

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), matSkin);
    head.position.y = 1.6;
    head.castShadow = true;
    group.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25), matShirt);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    npcs.push({
        mesh: group,
        velocity: new THREE.Vector3(),
        timer: 0,
        dir: new THREE.Vector3(1,0,0)
    });
}

// --- Controls ---

function setupTouchControls() {
    const bind = (id, start, end) => {
        const el = document.getElementById(id);
        
        // Prevent default to stop scrolling/zooming
        const handleStart = (e) => { e.preventDefault(); start(); };
        const handleEnd = (e) => { e.preventDefault(); end(); };

        el.addEventListener('touchstart', handleStart, {passive: false});
        el.addEventListener('touchend', handleEnd, {passive: false});
        // IMPORTANT: Handle 'touchcancel' if finger slides off screen
        el.addEventListener('touchcancel', handleEnd, {passive: false});
        
        el.addEventListener('mousedown', handleStart);
        el.addEventListener('mouseup', handleEnd);
        el.addEventListener('mouseleave', handleEnd);
    };

    bind('btn-fwd', () => moveForward = true, () => moveForward = false);
    bind('btn-back', () => moveBackward = true, () => moveBackward = false);
    bind('btn-left', () => moveLeft = true, () => moveLeft = false);
    bind('btn-right', () => moveRight = true, () => moveRight = false);
    
    bind('btn-jump', () => { if(canJump) { velocityY = JUMP_FORCE; canJump=false; } }, () => {});
    
    bind('btn-place', interact.bind(null, 'place'), () => {});
    bind('btn-break', interact.bind(null, 'break'), () => {});

    // Camera Touch Look
    let startX = 0, startY = 0;
    document.addEventListener('touchstart', (e) => {
        if(e.target.tagName !== 'BUTTON') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    });

    document.addEventListener('touchmove', (e) => {
        if(e.target.tagName === 'BUTTON') return;
        
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        yaw -= deltaX * LOOK_SPEED;
        pitch -= deltaY * LOOK_SPEED;
        pitch = Math.max(-1.2, Math.min(0.5, pitch)); 

        playerGroup.rotation.y = yaw;
        cameraPivot.rotation.x = pitch;

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
}

function interact(type) {
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(worldObjects, false);

    if(intersects.length > 0) {
        const hit = intersects[0];
        if(hit.distance > 8) return;

        if(type === 'break') {
            scene.remove(hit.object);
            const idx = worldObjects.indexOf(hit.object);
            if(idx > -1) worldObjects.splice(idx, 1);
        } 
        else if(type === 'place') {
            const pos = hit.point.clone().add(hit.face.normal).floor().addScalar(0.5);
            if(pos.distanceTo(playerGroup.position) < 1.5) return;
            createBlock(pos.x, pos.y, pos.z, matWood);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Main Loop (FIXED PHYSICS) ---

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.05); // Cap delta hard to prevent physics explosion
    prevTime = time;

    // 1. Move Player
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);

    if(moveForward) dir.add(fwd);
    if(moveBackward) dir.sub(fwd);
    if(moveRight) dir.add(right);
    if(moveLeft) dir.sub(right);

    if(dir.lengthSq() > 0) dir.normalize();

    // Horizontal Movement
    playerGroup.position.addScaledVector(dir, SPEED * delta);

    // 2. Gravity & Improved Collision
    velocityY -= GRAVITY * delta;
    playerGroup.position.y += velocityY * delta;

    // Raycast Origin: Start from center of body, not feet
    const rayOrigin = playerGroup.position.clone();
    rayOrigin.y += 1.0; 
    
    // Cast Down
    const downRay = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 10);
    const hits = downRay.intersectObjects(worldObjects);

    if (hits.length > 0) {
        const hit = hits[0];
        // Calculate the ground level (top of the block hit)
        // Since blocks are 1x1x1 and positions are centers, top is y + 0.5
        const groundY = hit.object.position.y + 0.5;
        
        // Distance from player center (y=1.0 relative to feet) to ground
        const distToGround = (playerGroup.position.y) - groundY;

        // Collision Check
        // If feet are below ground OR slightly above (snap distance)
        // AND we are falling
        if (velocityY <= 0 && distToGround < 0.1) {
            playerGroup.position.y = groundY;
            velocityY = 0;
            canJump = true;
        }
    }
    
    // Safety floor
    if(playerGroup.position.y < -20) {
        playerGroup.position.set(0, 10, 0);
        velocityY = 0;
    }

    // 3. NPC Logic (Simple)
    npcs.forEach(npc => {
        npc.timer -= delta;
        if(npc.timer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            npc.dir.set(Math.sin(angle), 0, Math.cos(angle));
            npc.timer = 2 + Math.random() * 3;
        }
        npc.mesh.position.addScaledVector(npc.dir, 2.0 * delta);
        npc.mesh.lookAt(npc.mesh.position.clone().add(npc.dir));

        // NPC Gravity (Raycast style simplified)
        // Start ray slightly up
        const npcRayOrigin = npc.mesh.position.clone();
        npcRayOrigin.y += 1.0;
        downRay.set(npcRayOrigin, new THREE.Vector3(0, -1, 0));
        const npcHits = downRay.intersectObjects(worldObjects);
        
        if(npcHits.length > 0) {
            const groundY = npcHits[0].object.position.y + 0.5;
            if(npc.mesh.position.y < groundY) {
                npc.mesh.position.y = groundY;
            } else if (npc.mesh.position.y > groundY + 0.1) {
                npc.mesh.position.y -= GRAVITY * delta; // Fall
            }
        } else {
             npc.mesh.position.y -= GRAVITY * delta; // Fall into void
        }
    });

    renderer.render(scene, camera);
}

