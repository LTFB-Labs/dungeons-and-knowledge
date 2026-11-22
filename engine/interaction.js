// @ts-check
// What can be used: things. A thing says where it is (`tiles`), where the walker best stands (`front`), and
// where the camera goes for its close-up (`focus`, `zoom`). The rule: a thing can be used from any of the
// 8 tiles that touch it, and from no further. Tapping it from afar sends the walker to the tile in front of it.
// Under the pointer a tile that can be walked to gets a frame, and a thing gets a border round its outline.
import * as THREE from './three.js';
import { box } from './boxes.js';
import { key } from './map.js';

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {HTMLCanvasElement} o.canvas
 * @param {any} o.cam from createCamera
 * @param {any} o.world from createWorld
 * @param {any} o.walker from createWalker
 * @param {(i: number, j: number) => boolean} o.walkable
 * @param {(i: number, j: number) => number} o.tileY
 * @param {{ title: HTMLElement, text: HTMLElement, answers: HTMLElement }} o.panel the paper panel of a close-up
 * @param {HTMLElement} [o.root] gets the class `is-closeup` (and a thing's own `sheet` class) while a close-up is on
 */
export function createInteraction({ scene, canvas, cam, world, walker, walkable, tileY, panel, root = document.body }) {
  const things = {};
  const hitTargets = [...world.meshes];        // what a tap can land on: the floor, and the hit boxes of the things that are there
  const hitBoxes = {};
  const sheets = new Set(['is-closeup']);      // classes to take off the root when a close-up ends
  const closing = [];                          // () => {}: called when a close-up ends

  const ui = {
    things, closeUp: null, closing, sheets,
    /**
     * Adds a thing: { tiles: [{ i, j }], front: { i, j }, focus: Vector3, zoom, title, text,
     *   object: () => its group (for the border), bounds: Box3 (a cage instead, when it has no group),
     *   hit: [w, h, d, x, y, z] the box a tap lands on, hidden: it cannot be tapped yet (see `show`),
     *   use: () => {} instead of a close-up, onOpen: () => {} when its close-up opens,
     *   sheet: a class for the root while its close-up is on, lift: how much of the screen its sheet takes }
     */
    add(id, thing) {
      things[id] = thing;
      if (thing.sheet) sheets.add(thing.sheet);
      if (thing.hit) {
        const [w, h, d, x, y, z] = thing.hit;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, y, z);
        mesh.userData.thing = id;
        scene.add(mesh);
        hitBoxes[id] = mesh;
        if (!thing.hidden) hitTargets.push(mesh);
      }
      return thing;
    },
    /** A thing can be tapped from now on. */
    show(id) { if (!hitTargets.includes(hitBoxes[id])) hitTargets.push(hitBoxes[id]); },
    /** A thing can no longer be tapped. */
    hide(id) { const k = hitTargets.indexOf(hitBoxes[id]); if (k >= 0) hitTargets.splice(k, 1); },
    touches: (tile, thing) => thing.tiles.some((t) => Math.max(Math.abs(t.i - tile.i), Math.abs(t.j - tile.j)) <= 1),
    // The way to it: to the tile in front if that can be reached, otherwise to the nearest tile that touches it.
    approach(thing, start = walker.tile) {
      const toFront = walkable(thing.front.i, thing.front.j) ? walker.findPath(start, thing.front) : null;
      if (toFront) return toFront;
      let best = null;
      for (const t of thing.tiles) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const spot = { i: t.i + di, j: t.j + dj };
        const path = walkable(spot.i, spot.j) ? walker.findPath(start, spot) : null;
        if (path && (!best || path.length < best.length)) best = path;
      }
      return best;
    },
    /** The walker stands next to the thing: he turns to it and uses it. */
    arrive(id) {
      const thing = things[id];
      const at = walker.rig.group;
      at.rotation.y = Math.atan2(thing.focus.x - at.position.x, thing.focus.z - at.position.z);
      if (thing.use) thing.use(); else ui.open(id);
    },
    /** The close-up of a thing: the camera goes to it and the paper panel says what it is. */
    open(id) {
      const thing = things[id];
      ui.closeUp = id;
      cam.focus(thing.focus, thing.zoom, thing.lift);
      if (thing.sheet) root.classList.add(thing.sheet);
      panel.title.textContent = thing.title;
      panel.text.textContent = thing.text;
      panel.answers.hidden = true;
      thing.onOpen?.();
      root.classList.add('is-closeup');
    },
    /** A close-up that is not of a thing (the walker himself, for his inventory). */
    enter(id) { ui.closeUp = id; root.classList.add('is-closeup'); },
    close() {
      ui.closeUp = null;
      cam.release();
      root.classList.remove(...sheets);
      closing.forEach((done) => done());
    },
    // What he can use from where he stands: the thing on the tile he faces, or else any thing that touches him.
    useInFront() {
      if (ui.closeUp || walker.walk) return;
      const at = walker.rig.group;
      const ahead = { i: walker.tile.i + Math.round(Math.sin(at.rotation.y)), j: walker.tile.j + Math.round(Math.cos(at.rotation.y)) };
      const active = (id) => hitTargets.some((m) => m.userData.thing === id);
      const near = Object.keys(things).filter((id) => active(id) && ui.touches(walker.tile, things[id]));
      const id = near.find((n) => things[n].tiles.some((t) => t.i === ahead.i && t.j === ahead.j)) ?? near[0];
      if (id) ui.arrive(id);
    },
    floorUnder, pickAt, updateHover, unhighlight,
  };

  const raycaster = new THREE.Raycaster();
  // The spot on the floor under the pointer (just above the floor, so a low step counts as floor).
  function floorUnder(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const point = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(point, cam.camera);
    const { origin, direction } = raycaster.ray;
    // a ray that never comes down to the floor (a low camera, the top of the screen) points far away instead
    return origin.clone().addScaledVector(direction, direction.y < -0.01 ? (0.55 - origin.y) / direction.y : 200);
  }
  // What is under the pointer: a thing that can be used, a floor tile, or nothing.
  function pickAt(clientX, clientY) {
    floorUnder(clientX, clientY);                            // aims the raycaster
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    if (!hit) return null;
    if (hit.object.userData.thing) return { thingId: hit.object.userData.thing };
    const tile = hit.object.userData.quads?.[Math.floor(hit.faceIndex / 2)];
    return tile ? { tile } : null;
  }
  const hoverFrame = new THREE.Group();
  const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
  [[0, -0.46, 0.96, 0.06], [0, 0.46, 0.96, 0.06], [-0.46, 0, 0.06, 0.96], [0.46, 0, 0.06, 0.96]]
    .forEach(([x, z, w, d]) => box(hoverFrame, w, 0.03, d, hoverMaterial, x, 0, z));
  hoverFrame.visible = false;
  scene.add(hoverFrame);
  // A cage of thin bars drawn round an item or character under the pointer: it can be used.
  const cage = new THREE.Group();
  const cageMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe6dc, depthTest: false, transparent: true, opacity: 0.95 });
  const cageBars = Array.from({ length: 12 }, () => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cageMaterial);
    bar.renderOrder = 200;
    cage.add(bar);
    return bar;
  });
  cage.visible = false;
  scene.add(cage);
  const cageBox = new THREE.Box3();
  function showCage(thing) {
    if (thing.bounds) cageBox.copy(thing.bounds);
    else {
      cageBox.makeEmpty();
      thing.object().traverse((node) => { if (node.isMesh) cageBox.expandByObject(node); });
    }
    cageBox.expandByScalar(0.07);
    const { min, max } = cageBox;
    const size = max.clone().sub(min);
    const mid = min.clone().add(max).multiplyScalar(0.5);
    const T = 0.05;
    let k = 0;
    for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) { cageBars[k].position.set(mid.x, y, z); cageBars[k++].scale.set(size.x + T, T, T); }
    for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) { cageBars[k].position.set(x, mid.y, z); cageBars[k++].scale.set(T, size.y + T, T); }
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) { cageBars[k].position.set(x, y, mid.z); cageBars[k++].scale.set(T, T, size.z + T); }
    cage.visible = true;
  }
  // The border round an item or character: a slightly larger shell of each of its boxes, seen only
  // from behind, so it shows as a line all the way round its outline and moves with it.
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8, side: THREE.BackSide });
  const outlines = new Map();
  let outlined = null;
  function outline(thing, on) {
    if (!thing.object) return false;
    if (!outlines.has(thing)) {
      const parts = [];
      thing.object().traverse((node) => { if (node.isMesh && node.geometry?.parameters?.width) parts.push(node); });
      outlines.set(thing, parts.map((node) => {
        const { width, height, depth } = node.geometry.parameters;
        const shell = new THREE.Mesh(node.geometry, outlineMaterial);
        const t = 0.045;
        shell.scale.set((width + 2 * t) / width, (height + 2 * t) / height, (depth + 2 * t) / depth);
        node.add(shell);
        return shell;
      }));
    }
    outlines.get(thing).forEach((shell) => { shell.visible = on; });
    return true;
  }
  function unhighlight() {
    if (outlined) outline(outlined, false);
    outlined = null;
    cage.visible = false;
    hoverFrame.visible = false;
  }
  // The pointer only frames a tile or outlines a thing; the footprints and the faded copy show after a tap.
  function updateHover(clientX, clientY) {
    unhighlight();
    if (ui.closeUp) return;
    const picked = pickAt(clientX, clientY);
    const walkTo = picked?.tile && walkable(picked.tile.i, picked.tile.j) ? key(picked.tile.i, picked.tile.j) : null;
    if (!picked) return;
    let spot = null;
    if (picked.thingId) {
      const thing = things[picked.thingId];                 // something to use: a border round the thing itself
      if (outline(thing, true)) outlined = thing; else showCage(thing);
    } else if (walkTo && !(picked.tile.i === walker.tile.i && picked.tile.j === walker.tile.j)) {
      spot = picked.tile;
      hoverMaterial.color.set(0xffe9a8);                    // a place to walk to
    }
    if (!spot) return;
    hoverFrame.position.set(spot.i, tileY(spot.i, spot.j) + 0.03, spot.j);
    hoverFrame.visible = true;
  }
  return ui;
}
