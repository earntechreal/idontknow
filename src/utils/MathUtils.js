export const MathUtils = {
    // Clamps a number between min and max
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),

    // Random integer between min and max
    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min),

    // Converts global coordinate to Chunk Coordinate
    toChunkCoords: (val, chunkSize) => Math.floor(val / chunkSize)
};

