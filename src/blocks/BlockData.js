import * as THREE from '../../libs/three.module.js';

export const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    WATER: 6,
    SAND: 7,
    GLASS: 8
};

const materials = {};

export function getMaterial(type) {
    if (materials[type]) return materials[type];

    let mat;
    switch (type) {
        case BLOCK.GRASS: mat = new THREE.MeshStandardMaterial({ color: 0x5fab46 }); break;
        case BLOCK.DIRT:  mat = new THREE.MeshStandardMaterial({ color: 0x6e4f38 }); break;
        case BLOCK.STONE: mat = new THREE.MeshStandardMaterial({ color: 0x7d7d7d }); break;
        case BLOCK.WOOD:  mat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); break;
        case BLOCK.LEAVES:mat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a }); break;
        case BLOCK.SAND:  mat = new THREE.MeshStandardMaterial({ color: 0xe6cc85 }); break;
        case BLOCK.WATER: mat = new THREE.MeshStandardMaterial({ color: 0x3498db, transparent: true, opacity: 0.6 }); break;
        case BLOCK.GLASS: mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }); break;
        default: mat = new THREE.MeshStandardMaterial({ color: 0xff00ff }); break;
    }
    materials[type] = mat;
    return mat;
}

export function isTransparent(type) {
    return type === BLOCK.AIR || type === BLOCK.WATER || type === BLOCK.GLASS || type === BLOCK.LEAVES;
}

