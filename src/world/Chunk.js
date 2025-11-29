import * as THREE from '../../libs/three.module.js';
import { BLOCK, getMaterial, isTransparent } from '../blocks/BlockData.js';

const SIZE = 16;
const HEIGHT = 64; // Limit height for performance
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export class Chunk {
    constructor(cx, cz, scene) {
        this.cx = cx;
        this.cz = cz;
        this.scene = scene;
        this.blocks = new Uint8Array(SIZE * HEIGHT * SIZE); // Efficient storage
        this.meshGroup = new THREE.Group();
        this.meshGroup.position.set(cx * SIZE, 0, cz * SIZE);
        this.scene.add(this.meshGroup);
        this.generated = false;
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= SIZE || y < 0 || y >= HEIGHT || z < 0 || z >= SIZE) return BLOCK.AIR;
        return this.blocks[x + z * SIZE + y * SIZE * SIZE];
    }

    setBlock(x, y, z, type) {
        if (x < 0 || x >= SIZE || y < 0 || y >= HEIGHT || z < 0 || z >= SIZE) return;
        this.blocks[x + z * SIZE + y * SIZE * SIZE] = type;
    }

    generateData() {
        for (let x = 0; x < SIZE; x++) {
            for (let z = 0; z < SIZE; z++) {
                // Global X/Z for noise
                const gx = this.cx * SIZE + x;
                const gz = this.cz * SIZE + z;
                
                // Simple terrain noise
                const h = Math.floor(Math.sin(gx * 0.1) * Math.cos(gz * 0.1) * 5 + 10);
                
                for (let y = 0; y <= h; y++) {
                    let type = BLOCK.STONE;
                    if (y === h) type = BLOCK.GRASS;
                    else if (y > h - 3) type = BLOCK.DIRT;
                    this.setBlock(x, y, z, type);
                }
                // Water level
                for (let y = h + 1; y <= 4; y++) {
                    this.setBlock(x, y, z, BLOCK.WATER);
                }
            }
        }
        this.generated = true;
    }

    buildMesh() {
        this.meshGroup.clear(); // Clear old mesh

        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                for (let z = 0; z < SIZE; z++) {
                    const type = this.getBlock(x, y, z);
                    if (type === BLOCK.AIR) continue;

                    // Face Culling Optimization
                    // Check neighbors. If neighbor is solid, don't draw this block.
                    // (Simplified: Checks local chunk neighbors only)
                    const visible = 
                        isTransparent(this.getBlock(x+1, y, z)) ||
                        isTransparent(this.getBlock(x-1, y, z)) ||
                        isTransparent(this.getBlock(x, y+1, z)) ||
                        isTransparent(this.getBlock(x, y-1, z)) ||
                        isTransparent(this.getBlock(x, y, z+1)) ||
                        isTransparent(this.getBlock(x, y, z-1));

                    if (visible) {
                        const mesh = new THREE.Mesh(boxGeo, getMaterial(type));
                        mesh.position.set(x, y, z);
                        // Shadows expensive on mobile, use carefully
                        if(type !== BLOCK.WATER) {
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                        }
                        this.meshGroup.add(mesh);
                    }
                }
            }
        }
    }
}

