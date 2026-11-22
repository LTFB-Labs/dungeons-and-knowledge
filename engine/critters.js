// @ts-check
// Small animals that wander: from tile to tile, with a rest now and then; they keep to where they may go, run
// from the walker when he comes close, and are no obstacle to him (nothing else knows they are there). They stay
// round the walker: one that is left far behind turns up again somewhere near, out of the way.

const AROUND = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * @param {object} o
 * @param {(i: number, j: number) => boolean} o.allowed may an animal be on this tile?
 * @param {(i: number, j: number) => number} o.tileY the height of the floor of a tile
 * @param {any} o.hero the walker's group
 */
export function createCritters({ allowed, tileY, hero }) {
  const all = [];
  let shown = 0;
  function settle(c, i, j) {
    c.i = c.toI = i; c.j = c.toJ = j;
    c.moving = false;
    c.rest = c.rests[0] + Math.random() * (c.rests[1] - c.rests[0]);
    c.y = c.toY = tileY(i, j);
    c.object.position.set(i, c.y + c.lift, j);
  }
  // Somewhere near the walker but not next to him; if no such tile is found, it waits out of sight and tries again.
  function arrive(c) {
    for (let tries = 0; tries < 10; tries++) {
      const turn = Math.random() * Math.PI * 2;
      const far = 6 + Math.random() * 7;
      const i = Math.round(hero.position.x + Math.cos(turn) * far);
      const j = Math.round(hero.position.z + Math.sin(turn) * far);
      if (allowed(i, j) && (!c.likes || c.likes(i, j) > 0 || tries > 6)) { settle(c, i, j); c.here = true; return; }
    }
    c.here = false;
    c.rest = 1.5;
  }
  // The next tile: any free one around, rather one it likes; scared, the one furthest from the walker.
  function choose(c, scared) {
    let best = -Infinity;
    const first = Math.floor(Math.random() * 8);
    for (let n = 0; n < 8; n++) {
      const i = c.i + AROUND[(first + n) % 8][0];
      const j = c.j + AROUND[(first + n) % 8][1];
      if (!allowed(i, j) || (Math.abs(i - hero.position.x) < 0.8 && Math.abs(j - hero.position.z) < 0.8)) continue;
      const score = Math.random() + (c.likes ? c.likes(i, j) : 0) + (scared ? 3 * Math.hypot(i - hero.position.x, j - hero.position.z) : 0);
      if (score > best) { best = score; c.toI = i; c.toJ = j; }
    }
    if (best === -Infinity) { c.rest = 0.5; return; }
    c.toY = tileY(c.toI, c.toJ);
    c.moving = true;
    c.t = 0;
    c.scared = scared;
  }
  return {
    /**
     * One animal. `object`: its group, looking along +z; `speed`: tiles a second; `rests`: [from, to] seconds
     * between moves; `shy`: how near the walker may come before it runs; `lift`: how high above the floor it
     * keeps (a butterfly); `hop`: how high it hops as it goes; `flies`: it takes to the air when it runs;
     * `likes(i, j)`: how much it likes a tile (walls for a rat, flowers for a butterfly);
     * `pose(object, t, moving)`: every frame, to move its parts.
     */
    add({ object, speed = 1.5, rests = [0.5, 3], shy = 2.5, lift = 0, hop = 0, flies = false, likes = null, pose = null }) {
      object.visible = false;
      all.push({ object, speed, rests, shy, lift, hop, flies, likes, pose, i: 0, j: 0, toI: 0, toJ: 0, y: 0, toY: 0, t: 0, rest: 0, moving: false, scared: false, here: false });
    },
    /** How many of them are about: the first `count`. */
    show(count) {
      shown = Math.min(all.length, count);
      for (let k = 0; k < all.length; k++) if (k >= shown) { all[k].object.visible = false; all[k].here = false; }
    },
    get shown() { return shown; },
    /** How many there are in all. */
    get count() { return all.length; },
    /** Every frame. */
    update(dt, t) {
      for (let k = 0; k < shown; k++) {
        const c = all[k];
        const at = c.object.position;
        const away = Math.hypot(at.x - hero.position.x, at.z - hero.position.z);
        if (!c.here || away > 18) {
          c.rest -= dt;
          if (c.here || c.rest <= 0) arrive(c);
          c.object.visible = c.here;
          if (!c.here) continue;
        }
        if (c.moving) {
          const length = Math.hypot(c.toI - c.i, c.toJ - c.j);
          c.t = Math.min(1, c.t + (dt * c.speed * (c.scared ? 2.6 : 1)) / length);
          const up = c.hop * Math.abs(Math.sin(c.t * Math.PI * 2)) + (c.flies && c.scared ? 1.1 * Math.sin(c.t * Math.PI) : 0);
          at.set(c.i + (c.toI - c.i) * c.t, c.y + (c.toY - c.y) * c.t + c.lift + up, c.j + (c.toJ - c.j) * c.t);
          c.object.rotation.y = Math.atan2(c.toI - c.i, c.toJ - c.j);
          if (c.t >= 1) {
            c.i = c.toI; c.j = c.toJ; c.y = c.toY;
            c.moving = false;
            c.rest = away < c.shy ? 0 : c.rests[0] + Math.random() * (c.rests[1] - c.rests[0]);
          }
        } else {
          c.rest -= dt;
          const scared = away < c.shy;
          // where it stands may be shut to it by now (the walker has gone on to another part): then it turns up near him
          if (scared || c.rest <= 0) { if (allowed(c.i, c.j)) choose(c, scared); else arrive(c); }
        }
        if (c.pose) c.pose(c.object, t, c.moving);
      }
    },
  };
}
