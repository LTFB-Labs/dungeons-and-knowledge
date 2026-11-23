// @ts-check
// Walking in steps, tile by tile: along a path picked with a tap (footprints show it, and a faded copy of the
// walker shows where he will arrive), or with the keys, as if from inside him.
import * as THREE from './three.js';
import { findPath } from './pathfinding.js';

const EIGHTH = Math.PI / 4;
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {any} o.rig from createRig, with all his clothes already on him (the faded copy is made here)
 * @param {(i: number, j: number) => number} o.tileY how high the floor is at a tile
 * @param {(i: number, j: number) => boolean} o.walkable
 * @param {(i: number, j: number) => number} [o.groundCost]
 * @param {number} o.stepSeconds the time to walk one tile
 * @param {{ walk: () => number, hurry: () => number }} o.paces how fast he walks and hurries right now (1 is plain walking)
 * @param {() => boolean} o.busy a close-up is on: the keys do not move him
 * @param {(tile: { i: number, j: number }) => void} [o.onTile] he has stepped onto a tile
 * @param {(what: any) => void} [o.onArrive] he has reached what he was sent to
 * @param {() => void} [o.onGo] he has set off
 */
export function createWalker({ scene, rig, tileY, walkable, groundCost, stepSeconds, paces, busy, onTile, onArrive, onGo }) {
  const hero = rig.group;
  const tilePos = (t) => new THREE.Vector3(t.i, tileY(t.i, t.j), t.j);

  const printTexture = (() => {
    const rows = ['.###..', '#####.', '######', '######', '.#####', '.####.', '......', '.####.', '.####.', '..##..'];
    const c = document.createElement('canvas');
    c.width = 6; c.height = 10;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    rows.forEach((row, y) => [...row].forEach((dot, x) => { if (dot === '#') ctx.fillRect(x, y, 1, 1); }));
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  })();
  const printMaterial = new THREE.MeshBasicMaterial({
    map: printTexture, color: 0xffd35a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
  });
  const printShape = new THREE.PlaneGeometry(0.17, 0.28);
  const markers = Array.from({ length: 80 }, () => {            // two footprints for every step
    const mesh = new THREE.Mesh(printShape, printMaterial);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = -Math.PI / 2;                            // lies flat; then it is turned to face the way of walking
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  // Where he will arrive: he himself, with his own textures, but faint,
  // washed of colour, so he melts into what is behind him.
  const ghostMaterials = [];
  const fadedCopy = (material) => {
    const faded = material.clone();
    faded.transparent = true;
    faded.opacity = 0.4;
    if (!faded.emissiveMap) faded.emissive.set(0x23272c);      // a little flat grey takes the colour down
    ghostMaterials.push(faded);
    return faded;
  };
  const target = hero.clone(true);
  [...target.children].filter((node) => node.isSprite).forEach((node) => target.remove(node));
  target.traverse((node) => {
    if (!node.isMesh) return;
    node.material = Array.isArray(node.material) ? node.material.map(fadedCopy) : fadedCopy(node.material);
    node.castShadow = false;
    node.receiveShadow = false;
  });
  // Draw the nearest parts first, so the parts behind them are skipped and nothing shows through twice.
  const ghostSpot = new THREE.Vector3();
  function orderGhost() {
    target.updateMatrixWorld(true);
    target.traverse((node) => {
      if (!node.isMesh) return;
      node.getWorldPosition(ghostSpot);
      node.renderOrder = 100 - (ghostSpot.x + ghostSpot.y + ghostSpot.z) * 10;
    });
  }
  target.visible = false;
  scene.add(target);
  const ghostOutfit = [];
  target.traverse((node) => { if (node.userData.outfit) ghostOutfit.push(node); });
  rig.mirrors.push(...ghostOutfit);

  const w = {
    rig,
    tile: { i: 0, j: 0 },
    walk: null,                // { steps, from, to, t, open, pace, byKeys }
    selection: null,           // { id, path, open }
    faceGoal: null,            // the way he was asked to face
    keyHeading: null,          // the way the keys have turned him; null: the way he faces
    keys: { forward: false, hurry: false },       // what is held down right now (input.js keeps these)
    tilePos,
    /** Puts him on a tile, facing `facing`. */
    place(tile, facing) {
      w.tile = tile;
      hero.position.copy(tilePos(tile));
      if (facing !== undefined) hero.rotation.y = facing;
    },
    findPath: (from, to) => findPath(from, to, walkable, groundCost),
    /** Shows a path: footprints along it and the faded copy at its end. */
    select(id, path, open, start = w.tile) {
      w.selection = { id, path, open };
      markers.forEach((m) => { m.visible = false; });
      let from = start;
      path.forEach((step, k) => {
        const dx = step.i - from.i;
        const dz = step.j - from.j;
        [[0.3, 1], [0.8, -1]].forEach(([along, side], n) => {       // a left and a right foot between two tiles
          const m = markers[k * 2 + n];
          if (!m) return;
          const under = along < 0.5 ? from : step;
          m.position.set(from.i + dx * along + dz * side * 0.1, tileY(under.i, under.j) + 0.025, from.j + dz * along - dx * side * 0.1);
          m.rotation.y = Math.atan2(dx, dz) + Math.PI;
          m.scale.x = side;
          m.visible = true;
        });
        from = step;
      });
      const last = path[path.length - 1];
      target.visible = Boolean(last);
      if (last) {
        const before = path[path.length - 2] ?? start;
        target.position.set(last.i, tileY(last.i, last.j), last.j);
        target.rotation.y = Math.atan2(last.i - before.i, last.j - before.j);
        ghostMaterials.forEach((m) => m.color.set(0x9aa3ad));
        orderGhost();
      }
    },
    clearSelection() {
      w.selection = null;
      markers.forEach((m) => { m.visible = false; });
      target.visible = false;
    },
    // Sets off along the chosen path. If he is already walking he finishes the step he is on
    // and carries on along the new path: a new place can be picked at any moment.
    go() {
      const { path, open } = w.selection;
      if (w.walk) {
        w.walk.steps = [...path];
        w.walk.open = open;
        w.walk.passed = 0;
        w.walk.pace = paces.walk();
        w.keyHeading = null;
        w.walk.byKeys = false;
      } else if (path.length) {
        w.walk = { steps: [...path], from: tilePos(w.tile), to: null, t: 0, open, passed: 0, pace: paces.walk() };
      }
      onGo?.();
    },
    /** Walks these tiles from wherever he stands, with nothing shown (coming out of a door). */
    walkOut(steps) { w.walk = { steps, from: hero.position.clone(), to: null, t: 0, open: null }; },
    /** The tile the next path starts from: where he stands, or the tile he is stepping onto. */
    start: () => (w.walk?.to ? w.walk.next : w.tile),
    hurry() { w.walk.pace = paces.hurry(); },
    // ---- the keys: forward for as long as it is held, turns of an eighth on the spot ----
    turnBy(eighths) {
      w.keyHeading = heading() + eighths * EIGHTH;
      if (!w.walk) w.faceGoal = w.keyHeading;            // while walking he turns at the end of the step
    },
    /** The keys take over from a tap: he stops at the next tile. */
    takeOver() {
      if (!w.walk || w.walk.byKeys) return;
      w.walk.steps = [];
      w.walk.open = null;
      w.walk.byKeys = true;
      w.clearSelection();
    },
    /** Every frame: the keys, the step he is on, the turn he was asked for, his pose. */
    update(dt, t) {
      keyWalk();
      if (w.walk) { w.faceGoal = null; stepHero(dt); }
      if (w.faceGoal !== null) {
        const turn = Math.atan2(Math.sin(w.faceGoal - hero.rotation.y), Math.cos(w.faceGoal - hero.rotation.y));
        hero.rotation.y += turn * (1 - Math.exp(-dt * 14));
        if (Math.abs(turn) < 0.002) w.faceGoal = null;
      }
      rig.pose(dt, t, Boolean(w.walk), w.walk?.pace ?? 1);
      const ghostOpacity = 0.36 + 0.05 * Math.sin(t * 4);
      for (let k = 0; k < ghostMaterials.length; k++) ghostMaterials[k].opacity = ghostOpacity;
    },
  };

  const heading = () => w.keyHeading ?? Math.round((w.faceGoal ?? hero.rotation.y) / EIGHTH) * EIGHTH;
  // The tile in front of him, if he can step there; a slanting step does not cut a corner.
  function nextKeyStep(from) {
    if (!w.keys.forward) return null;
    const a = heading();
    const di = Math.round(Math.sin(a));
    const dj = Math.round(Math.cos(a));
    const to = { i: from.i + di, j: from.j + dj };
    const ok = walkable(to.i, to.j) && (!di || !dj || (walkable(from.i + di, from.j) && walkable(from.i, from.j + dj)));
    return ok ? to : null;
  }
  const keyPace = () => (w.keys.hurry ? paces.hurry() : paces.walk());
  function keyWalk() {
    if (!w.walk && w.faceGoal === null) w.keyHeading = null;      // settled: he faces where he faces (a tap or a shot may have turned him)
    if (busy() || w.walk) return;
    const next = nextKeyStep(w.tile);
    if (!next) return;
    w.clearSelection();
    w.walk = { steps: [next], from: tilePos(w.tile), to: null, t: 0, open: null, passed: 0, pace: keyPace(), byKeys: true };
  }
  function stepHero(dt) {
    const walk = w.walk;
    if (!walk.to) {
      const next = walk.steps.shift();
      walk.to = tilePos(next);
      walk.next = next;
      walk.t = 0;
      walk.heading = Math.atan2(walk.to.x - walk.from.x, walk.to.z - walk.from.z);
      walk.length = Math.hypot(walk.to.x - walk.from.x, walk.to.z - walk.from.z) || 1;      // a slanting step is longer
    }
    // Moves at an even pace and turns smoothly; the limbs are posed by the rig.
    walk.t = Math.min(1, walk.t + (dt * (walk.pace ?? 1)) / (stepSeconds * walk.length));
    hero.position.lerpVectors(walk.from, walk.to, walk.t);
    hero.position.y = walk.from.y + (walk.to.y - walk.from.y) * easeInOut(walk.t);     // a step up or down
    const turn = Math.atan2(Math.sin(walk.heading - hero.rotation.y), Math.cos(walk.heading - hero.rotation.y));
    hero.rotation.y += turn * (1 - Math.exp(-dt * 16));
    if (walk.t < 1) return;

    w.tile = walk.next;
    const passed = walk.passed ?? 0;                           // the footprints he has walked over
    if (markers[passed * 2]) {                                 // a path longer than the footprints there are has none further on
      markers[passed * 2].visible = false;
      markers[passed * 2 + 1].visible = false;
    }
    walk.passed = passed + 1;
    onTile?.(w.tile);
    walk.from = walk.to;
    walk.to = null;
    if (walk.byKeys && !walk.steps.length) {                 // still held: the next tile, with no stop in between
      const next = !busy() && nextKeyStep(w.tile);
      if (next) { walk.steps.push(next); walk.pace = keyPace(); walk.passed = 0; return; }
    }
    if (walk.steps.length) return;
    const open = walk.open;
    w.walk = null;
    w.clearSelection();
    if (open) onArrive?.(open);
  }
  return w;
}
