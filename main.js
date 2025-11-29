import * as THREE from './libs/three.module.js';
import { WorldManager } from './src/world/WorldManager.js';
import { Player } from './src/entities/Player.js';
import { Zombie } from './src/entities/Zombie.js';
import { InputManager } from './src/systems/Input.js';
import { Sky } from './src/systems/Sky.js';

let scene, camera, renderer;
let world, player, input, sky;
let zombies = [];
let clock = new THREE.Clock();

init();
animate();

function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Systems
    input = new InputManager();
    world = new WorldManager(scene);
    sky = new Sky(scene);

    // Entities
    player = new Player(scene, camera);
    zombies.push(new Zombie(scene, 5, 20, 5));

    // UI Start Listener
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('ui-container').style.display = 'flex';
        // Request Fullscreen logic here...
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    // Logic Updates
    player.update(delta, input, world);
    world.update(player.position); // Generate chunks around player
    sky.update(delta, player.position);
    zombies.forEach(z => z.update(delta, player.position));

    // Reset input flags (like single click breaks)
    input.resetFrame();

    renderer.render(scene, camera);
}

