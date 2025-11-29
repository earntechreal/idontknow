import { Chunk } from './Chunk.js';
import { MathUtils } from '../utils/MathUtils.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // Stores 'x,z' -> Chunk
        this.chunkSize = 16;
    }

    update(playerPos) {
        // Simple logic: Load 3x3 chunks around player
        const cx = MathUtils.toChunkCoords(playerPos.x, this.chunkSize);
        const cz = MathUtils.toChunkCoords(playerPos.z, this.chunkSize);

        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let z = cz - 1; z <= cz + 1; z++) {
                const key = `${x},${z}`;
                if (!this.chunks.has(key)) {
                    const chunk = new Chunk(x, z, this.scene);
                    chunk.generateData(); // Generate math data
                    chunk.buildMesh();    // Create 3D mesh
                    this.chunks.set(key, chunk);
                }
            }
        }
    }

    getBlock(x, y, z) {
        // Find which chunk this block belongs to
        const cx = MathUtils.toChunkCoords(x, this.chunkSize);
        const cz = MathUtils.toChunkCoords(z, this.chunkSize);
        const key = `${cx},${cz}`;

        const chunk = this.chunks.get(key);
        if (!chunk) return 0; // Return AIR if chunk not loaded

        // Convert global coord to local chunk coord
        // Use modulus to wrap around: 17 becomes 1
        let lx = x % this.chunkSize;
        let lz = z % this.chunkSize;
        if(lx < 0) lx += this.chunkSize;
        if(lz < 0) lz += this.chunkSize;

        return chunk.getBlock(lx, Math.floor(y), lz);
    }

    // Helper to get ALL meshes for collision raycasting
    getMeshes() {
        const meshes = [];
        this.chunks.forEach(chunk => {
            if(chunk.meshGroup.children.length > 0) {
                meshes.push(...chunk.meshGroup.children);
            }
        });
        return meshes;
    }
}

