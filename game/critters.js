// @ts-check
// The small animals of the two maps, each built of a few boxes: below, rats that keep to the walls and a
// beetle; above, rabbits, birds that hop about and fly up when the hero comes, and butterflies near the
// flowers. How they wander is the engine's (engine/critters.js); here is only how they look and what they like.
import * as THREE from '../engine/three.js';
import { box, lit } from '../engine/boxes.js';

const FUR = { rat: lit(0x5b544c), ratDark: lit(0x3d3833), pink: lit(0xb98a84), shell: lit(0x23262e), rabbit: lit(0xa58a6c), white: lit(0xe9e4da), bird: lit(0x6f5a48), breast: lit(0xc8683c), beak: lit(0xe0a530) };
const WINGS = [lit(0xf2c81e), lit(0xf1eee6), lit(0xff8fb0), lit(0x7fb6ee)];

function made(build) {
  const g = new THREE.Group();
  build(g);
  g.traverse((node) => { node.castShadow = false; });            // too small for a shadow to be worth its cost
  return g;
}
const rat = () => made((g) => {
  box(g, 0.14, 0.12, 0.28, FUR.rat, 0, 0.07, 0);
  box(g, 0.1, 0.09, 0.12, FUR.ratDark, 0, 0.08, 0.19);
  box(g, 0.03, 0.03, 0.24, FUR.pink, 0, 0.04, -0.25);
});
const beetle = () => made((g) => {
  box(g, 0.1, 0.06, 0.13, FUR.shell, 0, 0.04, 0);
  box(g, 0.06, 0.04, 0.05, FUR.ratDark, 0, 0.03, 0.09);
});
const rabbit = () => made((g) => {
  box(g, 0.2, 0.18, 0.3, FUR.rabbit, 0, 0.11, 0);
  box(g, 0.15, 0.14, 0.15, FUR.rabbit, 0, 0.24, 0.17);
  [-0.045, 0.045].forEach((x) => box(g, 0.04, 0.17, 0.04, FUR.rabbit, x, 0.39, 0.14));
  box(g, 0.08, 0.08, 0.06, FUR.white, 0, 0.14, -0.17);
});
const bird = () => made((g) => {
  box(g, 0.12, 0.11, 0.18, FUR.bird, 0, 0.1, 0);
  box(g, 0.1, 0.06, 0.1, FUR.breast, 0, 0.07, 0.06);
  box(g, 0.09, 0.09, 0.09, FUR.bird, 0, 0.19, 0.09);
  box(g, 0.03, 0.03, 0.05, FUR.beak, 0, 0.18, 0.16);
  box(g, 0.08, 0.02, 0.1, FUR.bird, 0, 0.1, -0.13);
});
const butterfly = (k) => made((g) => {
  box(g, 0.02, 0.02, 0.1, FUR.shell);
  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    box(wing, 0.1, 0.01, 0.1, WINGS[k % WINGS.length], side * 0.05, 0, 0);
    g.add(wing);
    return wing;
  });
  g.userData.wings = wings;
});
const flap = (object, t) => {
  const beat = Math.sin(t * 22 + object.position.x * 7) * 0.9;
  object.userData.wings[0].rotation.z = -beat;
  object.userData.wings[1].rotation.z = beat;
  object.position.y += Math.sin(t * 3 + object.position.z * 5) * 0.004;
};

/**
 * Adds this map's animals to `critters`, mixed, so that any number of them is a bit of each kind.
 * @param {object} o
 * @param {any} o.critters from createCritters
 * @param {any} o.scene
 * @param {boolean} o.above the land above
 * @param {(i: number, j: number) => boolean} o.walkable
 * @param {Set<number>} o.flowers the tiles with flowers, each as x * 4096 + z
 */
export function addCritters({ critters, scene, above, walkable, flowers }) {
  // a rat likes a tile by a wall; a butterfly one with flowers
  const byWall = (i, j) => (walkable(i + 1, j) && walkable(i - 1, j) && walkable(i, j + 1) && walkable(i, j - 1) ? 0 : 1.5);
  const byFlowers = (i, j) => (flowers.has(i * 4096 + j) ? 2 : 0);
  const KINDS = above
    ? [
      () => ({ object: rabbit(), speed: 2.2, rests: [1, 5], shy: 3.5, hop: 0.16 }),
      () => ({ object: bird(), speed: 1.3, rests: [0.3, 2.5], shy: 3, hop: 0.07, flies: true }),
      (k) => ({ object: butterfly(k), speed: 0.9, rests: [0, 1.2], shy: 1.2, lift: 0.55, likes: byFlowers, pose: flap }),
    ]
    : [
      () => ({ object: rat(), speed: 2.6, rests: [0.6, 4], shy: 3, likes: byWall }),
      () => ({ object: rat(), speed: 2.6, rests: [0.6, 4], shy: 3, likes: byWall }),
      () => ({ object: beetle(), speed: 0.6, rests: [1, 6], shy: 1.2 }),
    ];
  for (let k = 0; k < (above ? 21 : 9); k++) {
    const animal = KINDS[k % KINDS.length](k);
    scene.add(animal.object);
    critters.add(animal);
  }
}
