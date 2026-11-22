// @ts-check
// The specks of the two maps: dust in the light of the torches, embers rising from them, mist at the foot of
// the waterfall; above ground a few falling leaves and sparkles on the water near the hero. Few of each, and
// one draw call a kind (engine/particles.js).
import { createParticles } from '../engine/particles.js';

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {any} o.hero the hero's group
 * @param {{ at: { x: number, y: number, z: number }, base: number }[]} o.torches every torch: where its light is, and how strong it burns (0: out)
 * @param {number[][]} o.falls where water falls: [x, y, z] of the foot
 * @param {{ list: Int16Array, count: number }} o.water the water tiles near the hero, as pairs x, z (main.js keeps it)
 * @param {boolean} o.above the land above
 */
export function createSpecks({ scene, hero, torches, falls, water, above }) {
  const rand = Math.random;
  const kinds = [];
  // A kind: its specks, how fast each moves, and what happens to one when it is born and as it lives.
  function kind(max, size, glow, born, lives) {
    const k = { specks: createParticles(scene, { max, size, glow }), speed: new Float32Array(max * 3), tone: new Float32Array(max * 3), born, lives };
    kinds.push(k);
    return k;
  }
  const put = (k, n, x, y, z, vx, vy, vz, life) => {
    const place = k.specks.place;
    place[n * 3] = x; place[n * 3 + 1] = y; place[n * 3 + 2] = z;
    k.speed[n * 3] = vx; k.speed[n * 3 + 1] = vy; k.speed[n * 3 + 2] = vz;
    k.specks.life[n] = life;
  };
  const hide = (k, n) => put(k, n, 0, -999, 0, 0, 0, 0, 1 + rand());
  const tint = (k, n, r, g, b) => { k.tone[n * 3] = r; k.tone[n * 3 + 1] = g; k.tone[n * 3 + 2] = b; };
  // A burning torch near the hero, picked by chance; none: null.
  function torchNear() {
    for (let tries = 0; tries < 5; tries++) {
      const torch = torches[Math.floor(rand() * torches.length)];
      if (torch && torch.base > 0 && Math.abs(torch.at.x - hero.position.x) + Math.abs(torch.at.z - hero.position.z) < 14) return torch;
    }
    return null;
  }
  const glowing = (k, n, part) => {                 // comes up out of the dark and goes back into it
    const light = Math.sin(Math.PI * part);
    for (let c = 0; c < 3; c++) k.specks.colour[n * 3 + c] = k.tone[n * 3 + c] * light;
  };

  kind(60, 3, true, (k, n) => {                     // dust in the torch light
    const torch = torchNear();
    if (!torch) return hide(k, n);
    put(k, n, torch.at.x + (rand() - 0.5) * 3.4, torch.at.y + (rand() - 0.6) * 1.6, torch.at.z + (rand() - 0.5) * 3.4, (rand() - 0.5) * 0.12, (rand() - 0.4) * 0.08, (rand() - 0.5) * 0.12, 4 + rand() * 5);
    tint(k, n, 0.5, 0.38, 0.22);
  }, glowing);
  kind(24, 4, true, (k, n) => {                     // embers
    const torch = torchNear();
    if (!torch) return hide(k, n);
    put(k, n, torch.at.x + (rand() - 0.5) * 0.14, torch.at.y + 0.05, torch.at.z + (rand() - 0.5) * 0.14, (rand() - 0.5) * 0.25, 0.5 + rand() * 0.5, (rand() - 0.5) * 0.25, 0.9 + rand() * 0.9);
    tint(k, n, 1, 0.5 + rand() * 0.2, 0.15);
  }, glowing);
  if (falls.length) kind(30, 9, true, (k, n) => {   // mist where the water lands
    const foot = falls[Math.floor(rand() * falls.length)];
    put(k, n, foot[0] + (rand() - 0.5) * 1.1, foot[1] + rand() * 0.5, foot[2] + (rand() - 0.3) * 0.7, (rand() - 0.5) * 0.25, 0.1 + rand() * 0.25, rand() * 0.2, 2.5 + rand() * 2);
    tint(k, n, 0.12, 0.15, 0.18);
  }, glowing);
  if (above) {
    const LEAF = [[0.42, 0.62, 0.22], [0.62, 0.6, 0.2], [0.72, 0.45, 0.16]];
    kind(16, 5, false, (k, n) => {                  // falling leaves
      const height = 3.5 + rand() * 2.5;
      put(k, n, hero.position.x + (rand() - 0.5) * 20, height, hero.position.z + (rand() - 0.5) * 20, 0.25 + rand() * 0.3, -0.55 - rand() * 0.25, (rand() - 0.5) * 0.3, height / 0.55);
      const leaf = LEAF[Math.floor(rand() * LEAF.length)];
      for (let c = 0; c < 3; c++) k.specks.colour[n * 3 + c] = leaf[c];
    }, (k, n, part, t) => {
      k.specks.place[n * 3] += Math.sin(t * 2.1 + n) * 0.004;                // it rocks as it falls
      if (k.specks.place[n * 3 + 1] < 0.05) k.specks.age[n] = k.specks.life[n];
    });
    kind(24, 3, true, (k, n) => {                   // sparkles on the water
      if (!water.count) return hide(k, n);
      const tile = Math.floor(rand() * water.count) * 2;
      put(k, n, water.list[tile] + (rand() - 0.5) * 0.9, -0.16, water.list[tile + 1] + (rand() - 0.5) * 0.9, 0, 0, 0, 0.4 + rand() * 0.6);
      tint(k, n, 0.75, 0.9, 1);
    }, glowing);
  }

  return {
    /** 0: none at all. Up to 1: all of them. */
    setAmount(amount) {
      for (const k of kinds) {
        const before = k.specks.shown;
        k.specks.show(Math.round(k.specks.max * amount));
        for (let n = before; n < k.specks.shown; n++) { k.specks.age[n] = 0; k.born(k, n); k.specks.age[n] = rand() * k.specks.life[n]; }
      }
    },
    /** Every frame. */
    update(dt, t) {
      for (let q = 0; q < kinds.length; q++) {
        const k = kinds[q];
        const s = k.specks;
        if (!s.shown) continue;
        for (let n = 0; n < s.shown; n++) {
          s.age[n] += dt;
          if (s.age[n] >= s.life[n]) { s.age[n] = 0; k.born(k, n); }
          for (let c = 0; c < 3; c++) s.place[n * 3 + c] += k.speed[n * 3 + c] * dt;
          k.lives(k, n, s.age[n] / s.life[n], t);
        }
        s.flush();
      }
    },
  };
}
