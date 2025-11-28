import * as THREE from 'https://unpkg.com/three@0.150.0/build/three.module.js';

// --- Global Variables ---
let camera, scene, renderer;
let playerGroup, cameraPivot;
let raycaster;
const worldObjects = []; // Collidable blocks
const npcs = []; // Array to store NPC data

// Movement Flags
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocityY = 0;
let canJump = false;

// Camera / Look Variables
let pitch = 0; 
let yaw = 0;   
const lookSpeed = 0.005;

// Physics Constants
const GRAVITY = 30.0;
const SPEED = 8.0;
const JUMP_FORCE = 12.0;

let prevTime = performance.now();

// --- Materials ---
const matGrass = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
const matDirt = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
const matStone = new THREE.MeshLambertMaterial({ color: 0x888888 });
const matWood = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
const matLeaves = new THREE.MeshLambertMaterial({ color: 0x228b22 });
const matGlass = new THREE.MeshLambertMaterial({ color: 0xffffaa, transparent: true, opacity: 0.8 });
const matBrick = new THREE.MeshLambertMaterial({ color: 0xcc5555 });
const matBlack = new THREE.MeshLambertMaterial({ color: 0x111111 });

// Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

init();
animate();

function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    // Fog helps hide the edge of the world
    scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // 3. Player
    createPlayer();

    // 4. Lights
    // Ambient light (soft general light)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6); 
    scene.add(ambientLight);

    // Sun light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. Generate World
    generateWorld();

    // 6. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 7. Raycaster
    raycaster = new THREE.Raycaster();

    // 8. Controls
    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
}

// --- World Generation ---

function generateWorld() {
    const size = 20; // World radius

    // 1. Terrain
    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            // Simple math for terrain height (hills)
            const height = Math.floor(Math.sin(x * 0.2) * 2 + Math.cos(z * 0.2) * 2);
            
            // Fill blocks from bottom up to height
            for (let y = -3; y <= height; y++) {
                let mat = matDirt;
                if (y === height) mat = matGrass; // Top layer is grass
                if (y < -1) mat = matStone;       // Deep layer is stone
                
                createVoxel(x, y, z, mat);
            }

            // 2. Trees (Random chance on grass)
            if (Math.random() > 0.95 && x > -10 && x < 10) {
                buildTree(x, height + 1, z);
            }
        }
    }

    // 3. Buildings
    buildHouse(12, 0, 5);
    buildHouse(-12, 1, -8);

    // 4. Street Lights
    buildStreetLight(8, 0, 8);
    buildStreetLight(-8, 1, -5);

    // 5. NPCs
    for (let i = 0; i < 5; i++) {
        // Random position
        const rx = Math.floor((Math.random() * 20) - 10);
        const rz = Math.floor((Math.random() * 20) - 10);
        createNPC(rx, 5, rz); // Spawn high, let them fall
    }
}

function createVoxel(x, y, z, mat, collidable = true) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    if (collidable) worldObjects.push(mesh);
    return mesh;
}

function buildTree(x, y, z) {
    // Trunk
    for (let i = 0; i < 4; i++) createVoxel(x, y + i, z, matWood);
    // Leaves
    for (let lx = -1; lx <= 1; lx++) {
        for (let ly = 0; ly <= 1; ly++) {
            for (let lz = -1; lz <= 1; lz++) {
                if (lx === 0 && lz === 0 && ly === 0) continue; // Don't replace trunk top
                createVoxel(x + lx, y + 3 + ly, z + lz, matLeaves);
            }
        }
    }
    createVoxel(x, y + 5, z, matLeaves); // Top tip
}

function buildHouse(x, y, z) {
    // Floor
    for(let i=-2; i<=2; i++) {
        for(let j=-2; j<=2; j++) createVoxel(x+i, y, z+j, matStone);
    }
    // Walls
    for(let h=1; h<=3; h++) {
        for(let i=-2; i<=2; i++) {
            for(let j=-2; j<=2; j++) {
                // Only edges
                if(i===-2 || i===2 || j===-2 || j===2) {
                    // Door gap
                    if (h < 3 && i === 0 && j === 2) continue;
                    // Windows
                    if (h === 2 && (i === -2 || i === 2) && j === 0) {
                        createVoxel(x+i, y+h, z+j, matGlass);
                    } else {
                        createVoxel(x+i, y+h, z+j, matBrick);
                    }
                }
            }
        }
    }
    // Roof
    for(let i=-2; i<=2; i++) {
        for(let j=-2; j<=2; j++) createVoxel(x+i, y+4, z+j, matWood);
    }
    for(let i=-1; i<=1; i++) {
        for(let j=-1; j<=1; j++) createVoxel(x+i, y+5, z+j, matWood);
    }
}

function buildStreetLight(x, y, z) {
    // Determine ground height at this location roughly
    // We just stack up from the given Y
    for(let h=0; h<4; h++) createVoxel(x, y+h, z, matBlack);
    
    // Lamp part
    const lamp = createVoxel(x, y+4, z, matGlass);
    
    // Real Light Source
    const pointLight = new THREE.PointLight(0xffaa00, 1, 15);
    pointLight.position.set(x, y+4, z);
    scene.add(pointLight);
}

// --- Player & NPC Logic ---

function createPlayer() {
    playerGroup = new THREE.Group();
    playerGroup.position.set(0, 10, 0); 
    scene.add(playerGroup);

    // Simple Steve Mesh
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFCCAA });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00AAAA });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3333AA });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.75;
    playerGroup.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), shirtMat);
    body.position.y = 1.125;
    playerGroup.add(body);

    // Arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), skinMat);
    armL.position.set(-0.35, 1.125, 0);
    playerGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), skinMat);
    armR.position.set(0.35, 1.125, 0);
    playerGroup.add(armR);

    // Legs
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
    legL.position.set(-0.15, 0.375, 0);
    playerGroup.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
    legR.position.set(0.15, 0.375, 0);
    playerGroup.add(legR);

    // Camera Boom
    cameraPivot = new THREE.Object3D();
    cameraPivot.position.y = 1.5;
    playerGroup.add(cameraPivot);

    camera.position.set(0.8, 0.5, 4);
    cameraPivot.add(camera);
}

function createNPC(x, y, z) {
    // Clone logic for simple NPC
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);

    // Different shirt color for NPCs
    const randColor = Math.random() * 0xffffff;
    const shirtMat = new THREE.MeshLambertMaterial({ color: randColor });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFCCAA });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    // Simplified Body
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.75;
    group.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), shirtMat);
    body.position.y = 1.125;
    group.add(body);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
    legL.position.set(-0.15, 0.375, 0);
    group.add(legL);
    
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
    legR.position.set(0.15, 0.375, 0);
    group.add(legR);

    // Add to array for updates
    npcs.push({
        mesh: group,
        velocity: new THREE.Vector3(0, 0, 0),
        moveTimer: 0,
        direction: new THREE.Vector3(0, 0, 0)
    });
}

// --- Interaction & Controls ---

function setupTouchControls() {
    const btnFwd = document.getElementById('btn-fwd');
    const btnBack = document.getElementById('btn-back');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');
    const btnPlace = document.getElementById('btn-place');
    const btnBreak = document.getElementById('btn-break');

    const bindBtn = (elem, actionStart, actionEnd) => {
        elem.addEventListener('touchstart', (e) => { e.preventDefault(); actionStart(); }, {passive: false});
        elem.addEventListener('touchend', (e) => { e.preventDefault(); actionEnd(); }, {passive: false});
        elem.addEventListener('mousedown', (e) => { actionStart(); });
        elem.addEventListener('mouseup', (e) => { actionEnd(); });
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

    btnPlace.addEventListener('touchstart', (e) => { e.preventDefault(); interactWithWorld('place'); });
    btnBreak.addEventListener('touchstart', (e) => { e.preventDefault(); interactWithWorld('break'); });
    btnPlace.addEventListener('mousedown', (e) => { e.preventDefault(); interactWithWorld('place'); });
    btnBreak.addEventListener('mousedown', (e) => { e.preventDefault(); interactWithWorld('break'); });

    // Touch Look
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
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

        yaw -= deltaX * lookSpeed;
        playerGroup.rotation.y = yaw;

        pitch -= deltaY * lookSpeed;
        pitch = Math.max(-1.0, Math.min(1.0, pitch));
        cameraPivot.rotation.x = pitch;

        touchStartX = touchX;
        touchStartY = touchY;
    });
}

function interactWithWorld(action) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    // Ignore player and NPCs, only hit worldObjects
    const intersects = raycaster.intersectObjects(worldObjects, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (intersect.distance > 8) return;

        if (action === 'break') {
            scene.remove(intersect.object);
            worldObjects.splice(worldObjects.indexOf(intersect.object), 1);
        } else if (action === 'place') {
            const voxel = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
            voxel.position.copy(intersect.point).add(intersect.face.normal);
            voxel.position.divideScalar(1).floor().multiplyScalar(1).addScalar(0.5);
            
            // Check collision with player
            if (voxel.position.distanceTo(playerGroup.position) < 1.0) return;

            scene.add(voxel);
            worldObjects.push(voxel);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Main Loop ---

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    // 1. Player Physics
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    const moveX = (Number(moveRight) - Number(moveLeft));
    const moveZ = (Number(moveForward) - Number(moveBackward));

    if (moveX !== 0 || moveZ !== 0) {
        playerGroup.position.x += (forwardX * moveZ + rightX * moveX) * SPEED * delta;
        playerGroup.position.z += (forwardZ * moveZ + rightZ * moveX) * SPEED * delta;
    }

    // Player Gravity / Collision
    velocityY -= GRAVITY * delta;
    playerGroup.position.y += velocityY * delta;

    // Check collision with voxels (Simple Floor Check)
    // We scan worldObjects to see if feet are inside one
    let onGround = false;
    // Optimization: Only check blocks somewhat near the player
    // For this simple version, we will just check against a hard floor logic + simple box check
    // If y < terrain height at this X/Z.
    
    // Very simple terrain collision:
    // If feet go below -3 (bedrock), stop falling
    if (playerGroup.position.y < -2) {
        playerGroup.position.y = -2;
        velocityY = 0;
        canJump = true;
        onGround = true;
    } else {
        // Iterate nearest blocks for top-collision
        for(let obj of worldObjects) {
             // Check X/Z alignment
            if (Math.abs(obj.position.x - playerGroup.position.x) < 0.8 &&
                Math.abs(obj.position.z - playerGroup.position.z) < 0.8) {
                
                // If player is falling onto the block
                if (playerGroup.position.y >= obj.position.y + 1 && 
                    playerGroup.position.y <= obj.position.y + 1.5 && velocityY <= 0) {
                    playerGroup.position.y = obj.position.y + 1;
                    velocityY = 0;
                    canJump = true;
                    onGround = true;
                    break;
                }
            }
        }
    }

    // 2. NPC AI Update
    updateNPCs(delta);

    renderer.render(scene, camera);
}

function updateNPCs(delta) {
    npcs.forEach(npc => {
        // AI Logic: Random movement
        npc.moveTimer -= delta;
        
        if (npc.moveTimer <= 0) {
            // Pick new direction
            const rAngle = Math.random() * Math.PI * 2;
            npc.direction.set(Math.sin(rAngle), 0, Math.cos(rAngle));
            npc.moveTimer = 2 + Math.random() * 3; // Move for 2-5 seconds
        }

        // Apply movement
        const npcSpeed = 2.0;
        npc.mesh.position.addScaledVector(npc.direction, npcSpeed * delta);
        
        // Rotate NPC to face direction
        const angle = Math.atan2(npc.direction.x, npc.direction.z);
        npc.mesh.rotation.y = angle;

        // NPC Gravity (Simple)
        npc.velocity.y -= GRAVITY * delta;
        npc.mesh.position.y += npc.velocity.y * delta;

        // NPC Collision (Simple Floor)
        let npcGrounded = false;
        // Check world bounds check
        if (npc.mesh.position.y < -2) {
             npc.mesh.position.y = -2;
             npc.velocity.y = 0;
             npcGrounded = true;
        } else {
            // Check block collision
            for(let obj of worldObjects) {
                if (Math.abs(obj.position.x - npc.mesh.position.x) < 0.8 &&
                    Math.abs(obj.position.z - npc.mesh.position.z) < 0.8) {
                    
                    if (npc.mesh.position.y >= obj.position.y + 1 && 
                        npc.mesh.position.y <= obj.position.y + 2 && npc.velocity.y <= 0) {
                        npc.mesh.position.y = obj.position.y + 1;
                        npc.velocity.y = 0;
                        npcGrounded = true;
                        break;
                    }
                }
            }
        }
        
        // Jump if stuck (simple)
        if (npcGrounded && Math.random() < 0.01) {
            npc.velocity.y = 8;
        }
    });
}

