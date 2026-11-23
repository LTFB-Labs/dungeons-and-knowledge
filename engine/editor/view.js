// @ts-check
// What the editor shows: the map built by the engine's own modules, with the game's own blocks, materials and
// kinds of things, so a block or a thing looks here as it will in the game. There is no fog and no hero: every
// part of the map is lit, and every thing is shown as if the hero stood in its part.
// The engine's modules are handed in (loadEngine), not imported: the page takes them from the game's own
// `engine/` link, so the game's kinds and the editor share one copy of each module.
import { createEditorCamera } from './camera.js';
import { anchorOf } from './model.js';

const ENGINE = ['three', 'map', 'world', 'things', 'characters', 'shading', 'boxes', 'random', 'stage'];
const FADED = 0.4;                             // how dim the levels below the chosen one are drawn

/** The engine's modules, by name. `load(name)` imports one: `(name) => import(`/${game}/engine/${name}.js`)`. */
export async function loadEngine(load) {
  const modules = await Promise.all(ENGINE.map(load));
  return Object.fromEntries(ENGINE.map((name, k) => [name, modules[k]]));
}

/**
 * @param {object} o
 * @param {any} o.engine from loadEngine
 * @param {any} o.game what the game hands to createGame for this map: { blocks, stone, materials, paints, kinds, fields, state, dress }
 * @param {HTMLCanvasElement} o.canvas
 */
export function createView({ engine, game, canvas }) {
  const THREE = engine.three;
  const { loadMap, key, HOME_REGION } = engine.map;
  const { mulberry32 } = engine.random;
  const { renderer, scene } = engine.stage.createStage(canvas);
  const overlay = new THREE.Scene();           // marks drawn over the world: tiles, the pointer
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const cam = createEditorCamera();
  let shading = null;
  let level = null, world = null, things = null, state = null;
  let placed = [];                             // one per thing of the map: { entry, built, error }
  let hereOf = new Map();                      // an update of a thing -> the part of the map it is shown from
  let dice = null, painter = null;             // the dice and the painter of the things: begun anew each time the things are made
  let lamp = null, lampOn = false;
  let textured = true;
  let shown = {};

  const free = (node) => node.traverse((n) => {
    n.geometry?.dispose?.();
    for (const material of [].concat(n.material ?? [])) { material.map?.dispose?.(); material.dispose?.(); }
  });
  function clear(from) {
    for (const child of [...from.children]) { from.remove(child); free(child); }
  }
  // The part of the map a thing is shown from: its own, so a light seen only from inside its room is lit.
  function hereFor(entry) {
    const at = anchorOf(entry);
    return entry.onlyIn ?? entry.shownIn ?? entry.region ?? (at && level.regionAt.get(key(Math.round(at[0]), Math.round(at[2])))) ?? HOME_REGION;
  }
  function putThings(map) {
    engine.boxes.textureBoxes(false);          // as in the game: the things are made before the textures are put on
    placed = (map.things ?? []).map((entry) => {
      const first = { object: scene.children.length, update: things.updates.length };
      try {
        const built = things.add(entry);
        for (const update of things.owned(built).updates) hereOf.set(update, hereFor(entry));
        return { entry, built, error: null };
      } catch (error) {
        // what it had put in before it failed is taken out again
        for (const child of scene.children.slice(first.object)) { scene.remove(child); free(child); }
        things.updates.length = first.update;
        return { entry, built: null, error: String(error?.message ?? error) };
      }
    });
    light();
  }
  // A map whose things give no light is lit by the editor's own lamp; the lamp can also be turned on by hand.
  function light() {
    if (lamp) { scene.remove(lamp); lamp = null; }
    let lit = false;
    scene.traverse((node) => { if (node.isLight && node.intensity > 0) lit = true; });
    if (lit && !lampOn) return;
    lamp = new THREE.HemisphereLight(0xffffff, 0x8a8478, lit ? 1.1 : 1.9);
    scene.add(lamp);
  }
  function makeThings(map) {
    state = { ...game.state, taken: {}, here: HOME_REGION, closeUp: () => null };
    const fog = { explored: new Set(), seen: { has: () => true, size: 0 }, regionOf: (i, j) => level.regionAt.get(key(i, j)) ?? HOME_REGION,
      canEnter: () => true, lookAround() {}, open() {}, update() {} };
    dice = mulberry32(map.seeds?.things);
    painter = engine.characters.createPainter();
    hereOf = new Map();
    things = engine.things.createThings({ scene, rand: () => dice(), paintedBox: (...box) => painter(...box),
      materials: game.materials, paints: game.paints, level, world, fog, state });
    things.stage.shading = shading;
    things.stage.reveal = () => {};
    for (const kinds of game.kinds ?? []) things.defineKinds(typeof kinds === 'function' ? kinds(things.stage) : kinds);
    for (const [name, make] of Object.entries(game.fields?.(things.stage) ?? {})) things.defineField(name, make);
    putThings(map);
    things.addSpots(level.spots);
  }

  const view = {
    cam, renderer, scene, overlay,
    get level() { return level; },
    get world() { return world; },
    get things() { return things; },
    /** One per thing of the map, in its order: { entry, built, error }. `error`: why it could not be made. */
    get placed() { return placed; },
    /** The kinds a thing can be of: [{ name, label, data }]. `data` is null for a kind made by code. */
    get kinds() { return Object.keys(things.kinds).map((name) => ({ name, label: things.data(name)?.label ?? name, data: things.data(name) })); },
    tileY: (i, j) => level.heights.get(key(i, j)) ?? 0,
    /**
     * Builds the whole map anew. `show.upTo`: only the levels up to this one are drawn; `show.fade`: the ones
     * below it are drawn dim.
     */
    build(map, show = shown) {
      shown = show;
      clear(scene);
      lamp = null;
      shading ??= engine.shading.createShading(map.seeds?.shade ?? map.seeds?.things);
      level = loadMap(map);
      // which of its two pictures a block wears is rolled here, in the order of the map, so a level that is hidden does not change the others
      const look = mulberry32(map.seeds?.look ?? 1);
      for (const block of level.blocks) block.twin ??= Boolean(game.blocks.twins.has(block.type) && look() < 0.5);
      let blocks = level.blocks;
      if (typeof show.upTo === 'number') {
        blocks = blocks.filter((block) => block.level <= show.upTo)
          .map((block) => (show.fade && block.level < show.upTo ? { ...block, shade: block.shade * FADED } : block));
      }
      const regions = new Set([HOME_REGION, ...Object.keys(map.fog ?? {}), ...Object.values(map.regions?.names ?? {})]);
      world = engine.world.createWorld({ scene, blocks, kinds: game.blocks, light: Object.fromEntries([...regions].map((name) => [name, 1])), veiled: [], rand: look });
      if (game.stone) world.setMaps(game.stone);
      game.dress?.({ world, shading });
      makeThings(map);
      view.setTextured(textured);
    },
    /**
     * Makes only the things anew, after one was put, moved, changed or taken out: all of them are taken away
     * (things.remove) and made again in the order of the map with the dice begun anew, as the game will make them.
     */
    rebuildThings(map) {
      if (Object.keys(level.spots).length) return view.build(map);        // what the map itself places is rolled after the things: all of it anew
      for (const { built } of [...placed].reverse()) if (built) things.remove(built);
      dice = mulberry32(map.seeds?.things);
      painter = engine.characters.createPainter();
      hereOf = new Map();
      putThings(map);
      engine.boxes.textureBoxes(textured);
      return undefined;
    },
    setTextured(on) {
      textured = on;
      world.setTextured(on);
      engine.boxes.textureBoxes(on);
    },
    /** The editor's own lamp, for a map too dark to work on. */
    setLamp(on) { lampOn = on; light(); },
    /**
     * Marks over the world, by name: [{ cells: [[x, z], ...], y: number | ((x, z) => number), colour, opacity }].
     * A new list under a name takes the place of the old one.
     */
    mark(name, list) {
      for (const child of overlay.children.filter((node) => node.userData.mark === name)) { overlay.remove(child); free(child); }
      for (const { cells, y = 0, colour, opacity = 0.4, inset = 0.04 } of list) {
        if (!cells.length) continue;
        const position = [], index = [];
        cells.forEach(([x, z], k) => {
          const h = (typeof y === 'function' ? y(x, z) : y) + 0.02;
          const r = 0.5 - inset;
          position.push(x - r, h, z - r, x - r, h, z + r, x + r, h, z + r, x + r, h, z - r);
          index.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
        geometry.setIndex(index);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colour, opacity, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        mesh.userData.mark = name;
        overlay.add(mesh);
      }
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      cam.width = width;
      cam.height = height;
    },
    /** One frame: what moves, moves (each thing as seen from its own part of the map), and the picture is drawn. */
    frame(t, dt) {
      view.update(t, dt);
      view.draw();
    },
    update(t, dt) {
      for (const update of things.updates) { state.here = hereOf.get(update) ?? HOME_REGION; update(t, dt); }
      shading.update(t);
    },
    draw() {
      cam.place(camera);
      renderer.render(scene, camera);
      renderer.autoClear = false;              // the marks go over the picture
      renderer.render(overlay, camera);
      renderer.autoClear = true;
    },
  };
  return view;
}
