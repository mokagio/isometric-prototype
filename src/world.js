// Plain lush grass dominates; the striped/worn variants show up rarely so the
// field reads as meadow rather than patchwork.
const GRASS_PLAIN = [1, 1];
const GRASS_VARIANTS = [
    [1, 2],
    [1, 5],
    [1, 7],
];
const FLOWERS = [
    [1, 8],
    [2, 2],
];
const WATER = [7, 1];
// Deterministic hash → [0, 1); keeps the world stable across resizes/redraws.
function noise(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function generateWorld(cols, rows, seed = 1337) {
    // A soft blobby pond sunk into the field, off-centre for interest.
    const pondX = cols * 0.62;
    const pondY = rows * 0.42;
    const pondR = Math.min(cols, rows) * 0.16;
    const at = (col, row) => {
        const dx = col - pondX;
        const dy = row - pondY;
        const wobble = pondR * (0.75 + 0.5 * noise(col, row, seed + 9));
        if (dx * dx + dy * dy < wobble * wobble)
            return WATER;
        const r = noise(col, row, seed);
        if (r > 0.97) {
            return FLOWERS[Math.floor(noise(col, row, seed + 5) * FLOWERS.length)];
        }
        if (r > 0.82) {
            return GRASS_VARIANTS[Math.floor(noise(col, row, seed + 1) * GRASS_VARIANTS.length)];
        }
        return GRASS_PLAIN;
    };
    return { cols, rows, at };
}
