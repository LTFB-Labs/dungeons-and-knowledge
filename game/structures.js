// @ts-check
// What one character of a map cannot say by itself: a rock of uneven height, a tree, a house, a shed.
// The map reader (engine/map.js) calls these with `put` (lays one block, once per cell), the map's dice `rand`,
// and `charAt` (the character at a tile).

/** A rock: `height` blocks (and up to `extra` more), with `cap` on top. */
export function rock({ put, rand }, x, z, entry) {
  const height = entry.height + (entry.extra ? Math.floor(rand() * entry.extra) : 0);
  for (let l = 0; l < height; l++) put(x, 0.5 + l, z, l === height - 1 ? entry.cap : rand() < 0.35 ? 'deep' : 'cobble');
}

export function tree({ put, rand }, x, z) {
  const big = rand() < 0.25;                                                   // most trees are slim, some are broad
  const trunk = (big ? 3 : 2) + Math.floor(rand() * 2);
  for (let l = 0; l < trunk; l++) put(x, 0.5 + l, z, 'log');
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const corner = Math.abs(dx) + Math.abs(dz) === 2;
    if (corner && (!big || rand() < 0.35)) continue;                          // slim trees have a crown like a plus sign
    put(x + dx, 0.5 + trunk, z + dz, 'leaves');
  }
  put(x, 1.5 + trunk, z, 'leaves');
  if (big) [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dz]) => { if (rand() < 0.5) put(x + dx, 1.5 + trunk, z + dz, 'leaves'); });
}

/** A house over one patch of H, L (corner post), D (door), O (window): walls on the outline, a stepped roof. */
export function house({ put, charAt }, h) {
  for (let z = h.z0; z <= h.z1; z++) for (let x = h.x0; x <= h.x1; x++) {
    if (x !== h.x0 && x !== h.x1 && z !== h.z0 && z !== h.z1) continue;      // walls stand on the outline only
    const ch = charAt(x, z);
    put(x, 0.5, z, ch === 'D' ? 'door' : ch === 'L' ? 'log' : 'planks');
    put(x, 1.5, z, ch === 'O' ? 'window' : ch === 'L' ? 'log' : 'planks');
  }
  const alongX = h.x1 - h.x0 >= h.z1 - h.z0;                                 // the ridge runs along the longer side
  for (let step = 0; step < 3; step++) {                                     // the roof rises in steps to the ridge
    const sx = alongX ? 1 : 1 - step;
    const sz = alongX ? 1 - step : 1;
    if (h.x0 - sx > h.x1 + sx || h.z0 - sz > h.z1 + sz) break;
    for (let z = h.z0 - sz; z <= h.z1 + sz; z++) for (let x = h.x0 - sx; x <= h.x1 + sx; x++) put(x, 2.5 + step, z, 'roof');
  }
}

/** A shed over one patch of P (post), S (open floor), Z (hay): only a low roof. */
export function shed({ put }, patch) {
  for (let z = patch.z0; z <= patch.z1; z++) for (let x = patch.x0; x <= patch.x1; x++) put(x, 2.5, z, 'roof', { top: 0.5 });
}
