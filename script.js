import * as THREE from 'https://unpkg.com/three@0.150.0/build/three.module.js';

// --- Global Variables ---
let camera, scene, renderer;
let playerGroup, cameraPivot;
let raycaster;
const worldObjects = []; // Collidable blocks
const interactables = []; // Blocks you can click (subset of worldObjects)
const npcs = []; 

// Inputs
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocityY = 0;

// Camera
let pitch = -0.2; 
let yaw = 0;
const LOOK_SPEED = 0.005;

// Physics
const GRAVITY = 30.0;
const SPEED = 7.0; 
const JUMP_FORCE = 10.0;

let prevTime = performance.now();
let isGameRunning = false;

// --- Materials ---
// Using simpler materials for leaves/water to save FPS on larger map
const matGrass = new THREE.MeshStandardMaterial({ color: 0x5fab46 });
const matDirt = new THREE.MeshStandardMaterial({ color: 0x6e4f38 });
const matStone = new THREE.MeshStandardMaterial({ color: 0x666666 });
const matSand = new THREE.MeshStandardMaterial({ color: 0xe6cc85 });
const matWater = new THREE.MeshStandardMaterial({ color: 0x3498db, transparent: true, opacity: 0.7 });
const matWood = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
const matLeaves = new THREE.MeshStandardMaterial({ color: 0x2d6e32 });
const matBrick = new THREE.MeshStandardMaterial({ color: 0xb5574c });
const matGlass = new THREE.MeshStandardMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.5 });
const matCloud = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const matFlower = new THREE.MeshBasicMaterial({ color: 0xff0000 });

// Geometry
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const smallGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2); // For flowers

init();
animate(); 

function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 90); // Increased fog distance for bigger map

    // 2. Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 120);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); // Antialias off for performance
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 4. Lights
    setupLights();

    // 5. Objects
    createPlayer();
    generateWorld();

    // 6. Tools
    raycaster = new THREE.Raycaster();

    // 7. Input Setup
    setupTouchControls();
    setupStartScreen();
    
    window.addEventListener('resize', onWindowResize);
}

function setupStartScreen() {
    const startBtn = document.getElementById('start-btn');
    if(!startBtn) return; // Safety check
    startBtn.addEventListener('click', () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();

        if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('ui-container').style.display = 'flex';
        document.getElementById('crosshair').style.display = 'block';

        isGameRunning = true;
        prevTime = performance.now();
    });
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    // Optimize Shadow Map
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);
}

// --- World Generation (Bigger & Detailed) ---
function generateWorld() {
    // Increased size from 16 to 40 (Huge expansion)
    const size = 40; 
    const waterLevel = -3;

    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            
            // Smoother, larger hills (creates the illusion of smaller blocks)
            const noise1 = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 6;
            const noise2 = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 1; // Detail noise
            const height = Math.floor(noise1 + noise2); 

            // Water Generation
            if (height <= waterLevel) {
                // Fill water up to level
                for (let y = height; y <= waterLevel; y++) {
                    createBlock(x, y, z, matWater, false); // Water not solid
                }
                // Sand bottom
                createBlock(x, height - 1, z, matSand);
            } 
            else {
                // Land Generation
                for (let y = -5; y <= height; y++) {
                    let mat = matDirt;
                    
                    // Surface Logic
                    if (y === height) {
                        if (y <= waterLevel + 1) mat = matSand; // Beach
                        else mat = matGrass;
                    } else if (y < -2) {
                        mat = matStone;
                    }

                    // Only render if visible (Top block or roughly exposed)
                    // This optimization is vital for mobile
                    if (y === height || x === -size || x === size || z === -size || z === size) {
                        createBlock(x, y, z, mat);
                    }
                }

                // Vegetation (Trees & Flowers)
                if (x > -35 && x < 35 && z > -35 && z < 35 && height > waterLevel + 1) {
                    const r = Math.random();
                    if (r > 0.985) buildTree(x, height + 1, z);
                    else if (r > 0.95 && r < 0.97) createFlower(x, height + 1, z);
                }
            }
        }
    }

    // Clouds
    for (let i = 0; i < 30; i++) {
        let cx = (Math.random() * 80) - 40;
        let cz = (Math.random() * 80) - 40;
        let cy = 18 + Math.random() * 5;
        buildCloud(Math.floor(cx), Math.floor(cy), Math.floor(cz));
    }

    // Structures
    buildHouse(8, getHeightAt(8, 8), 8);
    buildTower(-15, getHeightAt(-15, -15), -15); // New Tower

    // NPCs
    for (let i = 0; i < 8; i++) {
        const nx = Math.floor(Math.random() * 20 - 10);
        const nz = Math.floor(Math.random() * 20 - 10);
        const ny = getHeightAt(nx, nz) + 2;
        if(ny > waterLevel + 1) createNPC(nx, ny, nz);
    }
}

function getHeightAt(x, z) {
    const noise1 = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 6;
    const noise2 = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 1;
    return Math.floor(noise1 + noise2);
}

function createBlock(x, y, z, mat, collidable = true) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, y, z);
    
    // Performance: Only shadows for land, not water
    if (mat !== matWater && mat !== matGlass) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    scene.add(mesh);
    if (collidable) worldObjects.push(mesh);
    // Add to interactables only if near center to save raycast calc
    if (Math.abs(x) < 40 && Math.abs(z) < 40) interactables.push(mesh);
    return mesh;
}

function createFlower(x, y, z) {
    const mesh = new THREE.Mesh(smallGeo, matFlower);
    mesh.position.set(x, y - 0.25, z); // Sink into ground slightly
    mesh.castShadow = false;
    scene.add(mesh);
}

function buildCloud(x, y, z) {
    // Random puffy cloud
    for(let i=0; i<3; i++) {
        for(let j=0; j<3; j++) {
            if(Math.random() > 0.3) {
                const cloud = new THREE.Mesh(boxGeo, matCloud);
                cloud.position.set(x+i, y, z+j);
                scene.add(cloud);
            }
        }
    }
}

function buildTree(x, y, z) {
    // Taller trees look better
    const height = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < height; i++) createBlock(x, y + i, z, matWood);
    
    for (let lx = -2; lx <= 2; lx++) {
        for (let ly = 0; ly <= 2; ly++) {
            for (let lz = -2; lz <= 2; lz++) {
                if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                createBlock(x + lx, y + height - 1 + ly, z + lz, matLeaves);
            }
        }
    }
}

function buildHouse(x, y, z) {
    // Base
    for(let i=0; i<5; i++) for(let j=0; j<6; j++) createBlock(x+i, y, z+j, matStone);
    // Walls
    for(let h=1; h<5; h++) {
        for(let i=0; i<5; i++) {
            for(let j=0; j<6; j++) {
                if(i===0 || i===4 || j===0 || j===5) {
                    if(i===2 && j===5 && h<3) continue; // Door
                    if((i===0 || i===4) && j===3 && h===3) createBlock(x+i, y+h, z+j, matGlass); // Window
                    else createBlock(x+i, y+h, z+j, matBrick);
                }
            }
        }
    }
    // Roof
    for(let i=-1; i<6; i++) for(let j=-1; j<7; j++) createBlock(x+i, y+5, z+j, matWood);
}

function buildTower(x, y, z) {
    for(let h=0; h<12; h++) {
        createBlock(x, y+h, z, matStone);
        createBlock(x+1, y+h, z, matStone);
        createBlock(x, y+h, z+1, matStone);
        createBlock(x+1, y+h, z+1, matStone);
    }
    // Turret top
    for(let i=-1; i<=2; i++) {
        for(let j=-1; j<=2; j++) {
            createBlock(x+i, y+12, z+j, matBrick);
        }
    }
}

// --- Player ---
function createPlayer() {
    playerGroup = new THREE.Group();
    playerGroup.position.set(0, 15, 0); // Start high
    scene.add(playerGroup);

    const matSkin = new THREE.MeshStandardMaterial({color: 0xffccaa});
    const matShirt = new THREE.MeshStandardMaterial({color: 0x3498db});
    const matPants = new THREE.MeshStandardMaterial({color: 0x2c3e50});

    // Made player slightly simpler mesh for style
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSkin);
    head.position.y = 1.75; head.castShadow = true; playerGroup.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), matShirt);
    body.position.y = 1.125; body.castShadow = true; playerGroup.add(body);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), matPants);
    legL.position.set(-0.15, 0.375, 0); legL.castShadow = true; playerGroup.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), matPants);
    legR.position.set(0.15, 0.375, 0); legR.castShadow = true; playerGroup.add(legR);

    cameraPivot = new THREE.Object3D();
    cameraPivot.position.y = 1.5;
    playerGroup.add(cameraPivot);
    // Camera moved further back to create "smaller blocks" feel (FOV effect)
    camera.position.set(0, 1.0, 6); 
    cameraPivot.add(camera);
}

function createNPC(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);
    const matShirt = new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff});
    const matSkin = new THREE.MeshStandardMaterial({color: 0xffccaa});
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), matSkin);
    head.position.y = 1.6; head.castShadow = true; group.add(head);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25), matShirt);
    body.position.y = 1.1; body.castShadow = true; group.add(body);
    npcs.push({ mesh: group, timer: 0, dir: new THREE.Vector3(1,0,0) });
}

// --- Controls ---
function setupTouchControls() {
    const bind = (id, start, end) => {
        const el = document.getElementById(id);
        const handleStart = (e) => { e.preventDefault(); start(); };
        const handleEnd = (e) => { e.preventDefault(); end(); };
        el.addEventListener('touchstart', handleStart, {passive: false});
        el.addEventListener('touchend', handleEnd, {passive: false});
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

    let startX = 0, startY = 0;
    document.addEventListener('touchstart', (e) => {
        if(e.target.tagName !== 'BUTTON' && isGameRunning) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    });
    document.addEventListener('touchmove', (e) => {
        if(e.target.tagName === 'BUTTON' || !isGameRunning) return;
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
    if(!isGameRunning) return;
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    // Optimized: Check collision against interactables, not all world objects
    // However, for correctness, we check nearby objects manually:
    // Filter objects within 8 units
    const nearby = worldObjects.filter(obj => obj.position.distanceTo(playerGroup.position) < 8);
    
    const intersects = raycaster.intersectObjects(nearby, false);
    if(intersects.length > 0) {
        const hit = intersects[0];
        if(hit.distance > 8) return;
        if(type === 'break') {
            // Prevent breaking water or bedrock
            if (hit.object.material === matWater || hit.object.position.y < -4) return;
            scene.remove(hit.object);
            const idx = worldObjects.indexOf(hit.object);
            if(idx > -1) worldObjects.splice(idx, 1);
        } else if(type === 'place') {
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

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);
    if(!isGameRunning) { renderer.render(scene, camera); return; }

    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.05); 
    prevTime = time;

    // Move
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    if(moveForward) dir.add(fwd);
    if(moveBackward) dir.sub(fwd);
    if(moveRight) dir.add(right);
    if(moveLeft) dir.sub(right);
    if(dir.lengthSq() > 0) dir.normalize();
    playerGroup.position.addScaledVector(dir, SPEED * delta);

    // Gravity
    velocityY -= GRAVITY * delta;
    playerGroup.position.y += velocityY * delta;

    // Optimized Collision (Only check downward against nearby blocks)
    // Checking all 5000+ blocks is too slow on mobile
    const playerPos = playerGroup.position;
    // Simple Box Collision Approximation for terrain
    // Check floor height at current X, Z
    const groundH = getHeightAt(Math.floor(playerPos.x), Math.floor(playerPos.z));
    
    // Check for created blocks (houses etc)
    let blockHeight = -100;
    // Iterate only a subset of worldObjects for collision? 
    // For this demo, simple distance filter is safest fallback without Spatial Hash
    for(let i=0; i<worldObjects.length; i++) {
        const obj = worldObjects[i];
        // Only check objects very close in X/Z
        if(Math.abs(obj.position.x - playerPos.x) < 0.8 && Math.abs(obj.position.z - playerPos.z) < 0.8) {
             // If this block is under the player
             if(obj.position.y < playerPos.y + 1 && obj.position.y > blockHeight) {
                 // Ignore water for standing
                 if (obj.material !== matWater) blockHeight = obj.position.y;
             }
        }
    }

    // Determine actual floor (Terrain vs Built block)
    // Terrain height math vs placed block height
    // Since terrain blocks are also in worldObjects, the loop above handles both mostly,
    // but the math `getHeightAt` is smoother.
    const collisionY = blockHeight + 0.5;

    if (playerPos.y < collisionY) {
        playerPos.y = collisionY;
        velocityY = 0;
        canJump = true;
    }

    if(playerPos.y < -20) { playerPos.set(0, 20, 0); velocityY = 0; }

    // NPCs
    npcs.forEach(npc => {
        npc.timer -= delta;
        if(npc.timer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            npc.dir.set(Math.sin(angle), 0, Math.cos(angle));
            npc.timer = 2 + Math.random() * 3;
        }
        npc.mesh.position.addScaledVector(npc.dir, 2.0 * delta);
        npc.mesh.lookAt(npc.mesh.position.clone().add(npc.dir));
        
        // Simple NPC floor snap
        const nH = getHeightAt(Math.floor(npc.mesh.position.x), Math.floor(npc.mesh.position.z));
        // Simple logic: NPCs walk on terrain, ignore houses for performance
        if(npc.mesh.position.y < nH + 0.5) npc.mesh.position.y = nH + 0.5;
        else npc.mesh.position.y -= GRAVITY * delta;
        
        // Keep NPC out of water
        if(npc.mesh.position.y < -1.5) npc.mesh.position.y = -1.5;
    });

    renderer.render(scene, camera);
}

