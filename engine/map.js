// @ts-check
// A map is text: one character is one tile, and a legend says what each character is.
// Two shapes of map are read here (see README.md):
//   layers: a grid for every height level, each character one block (the dungeon);
//   rows:   one grid seen from above, each character a tile and what stands on it (the land above).
// What comes out is the same for both: the blocks, where one can walk, and the spots of the things.
import { mulberry32 } from './random.js';

export const key = (i, j) => `${i},${j}`;
export const HOME_REGION = 'room';           // a block with no region belongs here

/**
 * @param {any} map
 * @returns {{ blocks: any[], ground: Set<string>, blocked: Set<string>, road: Set<string>, heights: Map<string, number>,
 *   regionAt: Map<string, string>, spots: Record<string, number[][]> }}
 */
export function loadMap(map) {
  const level = { blocks: [], ground: new Set(), blocked: new Set(), road: new Set(), heights: new Map(), regionAt: new Map(), spots: {} };
  if (map.layers) readLayers(map, level); else readPlan(map, level);
  return level;
}

// One grid per height level. A legend entry is one block: { type, top, walk }.
// A tile can be walked on when its column has a `walk` block; a plain block standing right on that block shuts it.
function readLayers(map, level) {
  const { x: x0, z: z0 } = map.origin ?? { x: 0, z: 0 };
  const roll = mulberry32(map.seeds?.shade ?? 1);
  const cells = new Map();
  for (const layer of map.layers) {
    const rolls = map.rolls?.[layer.level]?.map((row) => row.trim().split(/\s+/));
    layer.rows.forEach((row, r) => [...row].forEach((ch, c) => {
      const entry = map.legend[ch];
      if (!entry) return;
      const x = x0 + c, z = z0 + r;
      const rolled = rolls?.[r]?.[c];                               // what the dice gave this block when the map was first made
      const known = rolled && rolled !== '-';
      const region = map.regions?.names[map.regions.rows[r]?.[c]];
      const block = {
        x, level: layer.level, z, type: entry.type, top: entry.top ?? 1,
        shade: known ? parseFloat(rolled) : 0.93 + roll() * 0.12,
        twin: known ? rolled.endsWith('b') : undefined,
        region, tile: entry.walk ? { i: x, j: z } : undefined,
      };
      level.blocks.push(block);
      cells.set(`${x},${layer.level},${z}`, block);
      if (region) level.regionAt.set(key(x, z), region);
    }));
  }
  for (const block of level.blocks) {
    if (!block.tile) continue;
    const id = key(block.x, block.z);
    const y = block.level - 0.5 + block.top;
    if (y < (level.heights.get(id) ?? -Infinity)) continue;
    level.ground.add(id);
    level.heights.set(id, y);
    const above = cells.get(`${block.x},${block.level + 1},${block.z}`);
    if (above && !above.tile) level.blocked.add(id); else level.blocked.delete(id);
  }
}

// One grid seen from above. A legend entry is a tile: its ground block and what stands on it:
// { ground, top, walk, road, blocked, thing, stack: [[level, type, top]], grow: name of a grower }.
// `map.growers` are small builders for what one character cannot say (a tree, a rock of uneven height);
// `map.structures` build over every connected patch of some characters (a house, a shed).
function readPlan(map, level) {
  const rows = map.rows;
  const { x: x0, z: z0 } = map.origin ?? { x: 0, z: 0 };
  const rand = mulberry32(map.seeds?.shade ?? 1);
  const charAt = (x, z) => rows[z - z0]?.[x - x0] ?? ' ';
  const taken = new Set();
  const put = (x, y, z, type, more = {}) => {
    const id = `${x},${y},${z}`;
    if (taken.has(id)) return;
    taken.add(id);
    level.blocks.push({ x, level: y, z, type, shade: 0.93 + rand() * 0.12, ...more });
  };
  const ctx = { put, rand, charAt };
  const x1 = x0 + rows[0].length - 1, z1 = z0 + rows.length - 1;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const entry = map.legend[charAt(x, z)] ?? { ground: map.ground };
    put(x, -0.5, z, entry.ground, { tile: entry.walk ? { i: x, j: z } : undefined, top: entry.top ?? 1 });
    if (entry.walk) level.ground.add(key(x, z));
    if (entry.road) level.road.add(key(x, z));
    if (entry.blocked) level.blocked.add(key(x, z));
    if (entry.thing) (level.spots[entry.thing] ??= []).push([x, z]);
    if (entry.grow) map.growers[entry.grow](ctx, x, z, entry);
    for (const [y, type, top] of entry.stack ?? []) put(x, y, z, type, top ? { top } : {});
  }
  // Every connected patch of the same sort of character is one building: its outline is found here.
  const patches = (chars) => {
    const done = new Set();
    const found = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!chars.includes(charAt(x, z)) || done.has(key(x, z))) continue;
      const box = { x0: x, x1: x, z0: z, z1: z };
      const queue = [[x, z]];
      done.add(key(x, z));
      while (queue.length) {
        const [cx, cz] = queue.pop();
        box.x0 = Math.min(box.x0, cx); box.x1 = Math.max(box.x1, cx);
        box.z0 = Math.min(box.z0, cz); box.z1 = Math.max(box.z1, cz);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, nz = cz + dz;
          if (chars.includes(charAt(nx, nz)) && !done.has(key(nx, nz))) { done.add(key(nx, nz)); queue.push([nx, nz]); }
        }
      }
      found.push(box);
    }
    return found;
  };
  for (const { chars, build } of map.structures ?? []) for (const box of patches(chars)) map.growers[build](ctx, box);
}
