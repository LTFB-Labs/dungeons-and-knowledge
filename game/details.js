// @ts-check
// Small things strewn about, only to be looked at: below, pebbles, bones, cracks and puddles on the floor,
// cobwebs in the corners and moss hanging from the tops of walls; above, small stones, mushrooms, more grass
// and flowers. They are placed by dice with a fixed start, so they lie the same every visit; never on a tile
// that matters (a thing's tiles, where one stands to use it, a gate, steps, the road, where the hero starts),
// and they block nothing. One draw call a kind; how many of each are drawn is the density.
import * as THREE from '../engine/three.js';
import { mulberry32 } from '../engine/random.js';
import { lit } from '../engine/boxes.js';
import { key } from '../engine/map.js';
import { M, PETALS } from './materials.js';

const LOOK = {
  bone: lit(0xd9d2bd), cap: lit(0xb8322c), stalk: lit(0xe6dcc6),
  crack: new THREE.MeshBasicMaterial({ color: 0x0c0b0a, transparent: true, opacity: 0.4, depthWrite: false }),
  puddle: new THREE.MeshBasicMaterial({ color: 0x16242c, transparent: true, opacity: 0.45, depthWrite: false }),
  web: new THREE.MeshBasicMaterial({ color: 0xd9dde2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
};
const UP = new THREE.Vector3(0, 1, 0);
const GONE = new THREE.Matrix4().makeScale(0, 0, 0);
const LIT = new THREE.Color(0xffffff);
const DIM = new THREE.Color(0x737373);

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {any} o.map the map itself (its things, where the hero starts)
 * @param {any} o.level from loadMap
 * @param {any} o.world from createWorld
 * @param {boolean} o.above the land above
 * @param {(x: number, z: number) => boolean} o.seen has this tile been seen?
 * @param {(x: number, z: number) => boolean} o.dim is it only remembered (drawn dimmer)?
 */
export function createDetails({ scene, map, level, world, above, seen, dim }) {
  const rand = mulberry32(above ? 9071 : 4513);
  const taken = new Set([...level.road, ...Object.values(level.spots).flat().map(([x, z]) => key(x, z))]);
  const take = (tiles = []) => tiles.forEach(([i, j]) => taken.add(key(i, j)));
  for (const thing of map.things) { take(thing.tiles); take(thing.blocks); take(thing.gate); take(thing.asideBlocks); if (thing.front) take([thing.front]); }
  for (const place of [map.start, ...Object.values(map.arrivals ?? {})]) { take([place.tile]); take(place.walkOut); }
  const floor = [...level.ground].sort().map((id) => id.split(',').map(Number))
    .filter(([i, j]) => !level.blocked.has(key(i, j)) && !taken.has(key(i, j)) && (level.heights.get(key(i, j)) ?? 0) === 0);
  const groundOf = new Map(level.blocks.filter((b) => b.tile).map((b) => [key(b.x, b.z), b.type]));
  const wall = (i, j) => world.heightAt(i, 0.5, j) > 0.6;
  const wallTop = (i, j) => { let top = 1; while (world.heightAt(i, top + 0.5, j) > 0.6) top++; return top; };

  // One kind: unit boxes, each stretched, turned and put in its place.
  const kinds = [];
  function kind(material, items) {
    if (!items.length) return;
    for (let k = items.length - 1; k > 0; k--) { const n = Math.floor(rand() * (k + 1)); [items[k], items[n]] = [items[n], items[k]]; }      // mixed, so that any number of them is spread evenly
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
    mesh.receiveShadow = Boolean(material.isMeshLambertMaterial);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    kinds.push({ mesh, items });
  }
  const turn = new THREE.Quaternion();
  const item = (i, j, x, y, z, w, h, d, angle = rand() * Math.PI) =>
    ({ i, j, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), turn.setFromAxisAngle(UP, angle), new THREE.Vector3(w, h, d)) });
  const within = (span = 0.8) => (rand() - 0.5) * span;

  if (above) {
    const stones = [], stalks = [], caps = [], blades = [], heads = PETALS.map(() => []);
    for (const [i, j] of floor) {
      if (rand() < 0.07) { const s = 0.08 + rand() * 0.12; stones.push(item(i, j, i + within(), s * 0.35, j + within(), s, s * 0.7, s)); }
      if (groundOf.get(key(i, j)) !== 'grass') continue;                 // the rest grows only on grass
      if (rand() < 0.03) {
        const x = i + within(0.6), z = j + within(0.6), h = 0.08 + rand() * 0.07;
        stalks.push(item(i, j, x, h / 2, z, 0.05, h, 0.05));
        caps.push(item(i, j, x, h + 0.03, z, 0.14, 0.06, 0.14));
      }
      for (let n = rand() < 0.5 ? 1 + Math.floor(rand() * 3) : 0; n > 0; n--) { const h = 0.1 + rand() * 0.16; blades.push(item(i, j, i + within(0.9), h / 2, j + within(0.9), 0.05, h, 0.05)); }
      if (rand() < 0.06) {
        const x = i + within(0.6), z = j + within(0.6);
        blades.push(item(i, j, x, 0.1, z, 0.04, 0.2, 0.04));
        heads[Math.floor(rand() * PETALS.length)].push(item(i, j, x, 0.23, z, 0.11, 0.09, 0.11));
      }
    }
    kind(M.stone, stones); kind(LOOK.stalk, stalks); kind(LOOK.cap, caps); kind(M.blade, blades);
    PETALS.forEach((material, k) => kind(material, heads[k]));
  } else {
    const pebbles = [], bones = [], cracks = [], puddles = [], webs = [], moss = [];
    for (const [i, j] of floor) {
      for (let n = rand() < 0.3 ? 1 + Math.floor(rand() * 3) : 0; n > 0; n--) { const s = 0.05 + rand() * 0.09; pebbles.push(item(i, j, i + within(), s * 0.35, j + within(), s, s * 0.7, s)); }
      if (rand() < 0.04) {
        const x = i + within(0.5), z = j + within(0.5), angle = rand() * Math.PI;
        bones.push(item(i, j, x, 0.025, z, 0.26, 0.04, 0.05, angle));
        if (rand() < 0.5) bones.push(item(i, j, x + 0.05, 0.035, z + 0.04, 0.2, 0.04, 0.05, angle + 1.2));
      }
      if (rand() < 0.1) {
        const x = i + within(0.5), z = j + within(0.5), angle = rand() * Math.PI;
        cracks.push(item(i, j, x, 0.006, z, 0.5 + rand() * 0.3, 0.004, 0.03, angle));
        cracks.push(item(i, j, x + Math.sin(angle) * 0.12, 0.006, z + Math.cos(angle) * 0.12, 0.28, 0.004, 0.025, angle + 0.9));
      }
      if (rand() < 0.045) puddles.push(item(i, j, i + within(0.3), 0.005, j + within(0.3), 0.4 + rand() * 0.3, 0.004, 0.3 + rand() * 0.25));
      // a cobweb where two walls meet, up under their tops; moss hanging down the face of a wall
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (!wall(i + sx, j) || !wall(i, j + sz) || rand() > 0.6) continue;
        const top = Math.min(wallTop(i + sx, j), wallTop(i, j + sz));
        webs.push(item(i, j, i + sx * 0.36, top - 0.2, j + sz * 0.36, 0.38, 0.38, 0.01, Math.atan2(sx, sz)));
      }
      for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (!wall(i + sx, j + sz)) continue;
        for (let n = rand() < 0.3 ? 1 + Math.floor(rand() * 2) : 0; n > 0; n--) {
          const hang = 0.25 + rand() * 0.55, along = within(0.8);
          moss.push(item(i, j, i + sx * 0.47 + (sz ? along : 0), wallTop(i + sx, j + sz) - hang / 2, j + sz * 0.47 + (sx ? along : 0), 0.1, hang, 0.04, sx ? Math.PI / 2 : 0));
        }
      }
    }
    kind(M.stone, pebbles); kind(LOOK.bone, bones); kind(LOOK.crack, cracks); kind(LOOK.puddle, puddles); kind(LOOK.web, webs); kind(M.moss, moss);
  }

  let density = 0;
  const details = {
    /** 0: none are drawn. Up to 1: all of them. */
    setDensity(amount) {
      density = amount;
      for (const k of kinds) {
        k.mesh.count = Math.round(k.items.length * amount);
        k.mesh.visible = k.mesh.count > 0;
      }
    },
    /** When what is seen has changed: only what has been seen shows, and what is only remembered is dimmer. */
    relight() {
      if (!density) return;
      for (const { mesh, items } of kinds) {
        for (let n = 0; n < mesh.count; n++) {
          const it = items[n];
          mesh.setMatrixAt(n, seen(it.i, it.j) ? it.matrix : GONE);
          mesh.setColorAt(n, dim(it.i, it.j) ? DIM : LIT);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
  return details;
}
