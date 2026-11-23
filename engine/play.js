// @ts-check
// A whole game from its description: createGame(config) builds one map with the other modules and keeps the
// rules every such game has: walking and using things, things that talk, can be taken, hold a box or lead to
// another map, the light the hero carries, the inventory, shooting, the small map, the settings, and what is
// carried along when he travels. The game gives the data (map, kinds of blocks and things, items, texts) and
// adds its own rules through `uses` (what a thing does when used), `on` (what happens when...) and `effects`.
// README.md („Игра от описание“) lists everything `config` may hold and the page elements it needs.
import * as THREE from './three.js';
import { mulberry32 } from './random.js';
import { loadMap, key, HOME_REGION } from './map.js';
import { createStage } from './stage.js';
import { createWorld } from './world.js';
import { createFog } from './fog.js';
import { createCamera } from './camera.js';
import { createFocus, createLightPool } from './effects.js';
import { createShading } from './shading.js';
import { createSettings } from './settings.js';
import { createMinimap } from './minimap.js';
import { createFps } from './fps.js';
import { createAudio } from './audio.js';
import { createPainter, loadSkin, createRig } from './characters.js';
import { createWalker } from './walking.js';
import { createInteraction } from './interaction.js';
import { createInventory, makeIcons } from './inventory.js';
import { createProjectiles } from './projectiles.js';
import { createInput } from './input.js';
import { createTravel } from './travel.js';
import { createThings } from './things.js';
import { glow, textureBoxes } from './boxes.js';
import { tear } from './paper.js';

/**
 * @param {object} config
 * @param {any} config.map the map to open (see README.md: „Карта“)
 * @param {string} [config.place] where the page was opened at (travel.js: place()): picks the arrival of the map
 * @param {Record<string, any>} config.blocks the kinds of blocks (world.js)
 * @param {any} [config.stone] the pictures of the stone blocks (world.setMaps)
 * @param {Record<string, any>} [config.materials] shared materials by name, for the parts of things
 * @param {Record<string, any>} [config.paints] paint recipes by name (paints.js)
 * @param {(Record<string, any> | ((stage: any) => Record<string, any>))[]} config.kinds the kinds of things: data, or builders in code
 * @param {(stage: any) => Record<string, Function>} [config.fields] kinds the map places many of
 * @param {Record<string, any>} [config.state] the game's own flags (what has happened so far)
 * @param {{ key: string, flags?: Record<string, string> }} config.save `key` marks the saved text; `flags`: which
 *   flags of the state are carried between maps, each with the id of the thing it belongs to
 * @param {any} config.hero { looks, faces, skin, clothes(rig), holdings(rig, paintedBox), stepSeconds, hurry, silhouette }
 * @param {any} [config.carriedLight] the light that goes with the hero while he carries what gives it
 * @param {any} config.inventory { items, slots, iconRows, palette, start, text }
 * @param {any} config.shots { shooters, looks(paintedBox), text }
 * @param {Record<string, any>} config.text hint, hintShoot, bagFull, styleTextured, styleFlat
 * @param {Record<string, any>} [config.uses] by the id of a thing: what is this game's own about using it
 * @param {any} config.minimap { colour({ x, z, type, height, walk, road }), mark }
 * @param {{ list: any[], labels: Record<string, string>, prefix: string }} config.settings
 * @param {(o: { world: any, shading: any }) => void} [config.dress] gives the materials their look (shading.js)
 * @param {Record<string, Function>} [config.on] what the game does when something happens (see README.md)
 * @param {(o: { audio: any }) => any} [config.sounds] how it sounds (defaults/sounds.js: createSounds): then each thing
 *   that happens has its sound, unless the game says in `on` what happens then
 */
export async function createGame(config) {
  const { map, text } = config;
  const $ = (id) => document.getElementById(id);
  const on = { ...config.on };
  const stepSeconds = config.hero.stepSeconds ?? 0.276;

  // What has happened so far. The things of the map read it every frame.
  const state = {
    ...config.state,
    taken: {},                         // what has been taken off its stand or wall: id -> true
    opened: {},                        // the ways that have been opened (things with `way`): id -> true
    here: HOME_REGION,                 // the part of the map the hero is in
    closeUp: () => ui.closeUp,
  };

  // ---------- the world ----------
  const canvas = $('scene');
  const { renderer, scene } = createStage(canvas);
  const level = loadMap(map);
  const tileY = (i, j) => level.heights.get(key(i, j)) ?? 0;
  const walkable = (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)) && fog.canEnter(i, j);
  const groundCost = map.offRoad ? (i, j) => (level.road.has(key(i, j)) ? 1 : map.offRoad) : undefined;
  const shut = (tiles = []) => tiles.forEach(([i, j]) => level.blocked.add(key(i, j)));
  const open = (tiles = []) => tiles.forEach(([i, j]) => level.blocked.delete(key(i, j)));

  const regions = Object.keys(map.fog);
  const world = createWorld({
    scene, blocks: level.blocks, kinds: config.blocks,
    light: Object.fromEntries(regions.map((name) => [name, map.fog[name].light])),
    veiled: regions.filter((name) => map.fog[name].veiled),
    rand: mulberry32(map.seeds.look ?? 1),
  });
  const viewBox = { ...map.view };
  const fog = createFog({ world, blocks: level.blocks, regionAt: level.regionAt, regions: map.fog, viewBox });
  const cam = createCamera({ rest: map.camera, viewBox });

  const shading = createShading(map.seeds.shade ?? map.seeds.things);
  config.dress?.({ world, shading });
  const focus = createFocus(renderer);
  const pool = createLightPool(scene);

  // ---------- the things of the map ----------
  const things = createThings({ scene, rand: mulberry32(map.seeds.things), paintedBox: createPainter(), materials: config.materials, paints: config.paints, level, world, fog, state });
  const stage = things.stage;
  stage.shading = shading;
  stage.reveal = (id) => ui.show(id);
  for (const kinds of config.kinds) things.defineKinds(typeof kinds === 'function' ? kinds(stage) : kinds);
  for (const [name, build] of Object.entries(config.fields?.(stage) ?? {})) things.defineField(name, build);
  for (const thing of map.things) things.add(thing);
  things.addSpots(level.spots);            // what the map itself places: flowers, a well, lamps...
  const made = things.made;

  const audio = createAudio();
  // How it sounds, when the game gives its sounds: one for each thing that happens, unless the game says in `on`
  // what happens then; the torches crackle by how near the nearest one is.
  const sounds = config.sounds?.({ audio });
  if (sounds) {
    const heard = {
      tile: (tile, hurried) => sounds.step('stone', hurried),
      take: sounds.equip, box: sounds.chest, way: sounds.door, shot: sounds.shot, hit: sounds.hit, equip: sounds.equip, pick: sounds.pick, click: sounds.click,
    };
    for (const [event, play] of Object.entries(heard)) on[event] ??= play;
  }
  function torchNear() {
    let nearest = 99;
    for (let k = 0; k < things.torches.length; k++) if (things.torches[k].base > 0) nearest = Math.min(nearest, things.torches[k].at.distanceTo(hero.position));
    return Math.max(0, 1 - nearest / 7);
  }

  // ---------- the hero ----------
  const heroPaint = createPainter({ seed: config.hero.faces });
  const rig = createRig({ paintedBox: heroPaint, looks: config.hero.looks, skin: config.hero.skin && await loadSkin(config.hero.skin), stepSeconds });
  config.hero.clothes?.(rig);
  const hero = rig.group;
  stage.hero = hero;
  // The light around the hero. It shines only while he carries one of its sources (a torch in hand, a cloak that
  // glows). It throws shadows too, while it is lit; turning that on or off rebuilds the materials once.
  const carried = config.carriedLight;
  let lantern = null, lanternHalo = null;
  if (carried) {
    lantern = new THREE.PointLight(carried.colour, 0, carried.reach, 2);
    lantern.shadow.mapSize.set(512, 512);
    lantern.shadow.camera.near = 0.1;
    lantern.shadow.camera.far = 6;
    lantern.shadow.bias = -0.002;
    lantern.shadow.normalBias = 0.04;
    scene.add(lantern);
    lanternHalo = glow(hero, carried.halo.colour, carried.halo.size, 0, ...carried.halo.at);
  }
  scene.add(hero);

  const arrival = map.arrivals?.[config.place] ?? map.start;
  hero.position.set(arrival.tile[0], tileY(...arrival.tile), arrival.tile[1]);
  hero.rotation.y = arrival.facing;

  const fps = createFps($('fps'));
  let seenStamp = NaN;             // changes when more has been seen, or the hero is in another part
  let musicOn = true;
  let musicVolume = 0;
  const torchShadows = { count: 2, size: 512 };

  const hint = $('hint');
  const say = (words) => { hint.textContent = words; };
  say(text.hint);

  const walker = createWalker({
    scene, rig, tileY, walkable, groundCost, stepSeconds,
    paces: { walk: () => inv.walkPace(), hurry: () => inv.hurryPace() },
    busy: () => Boolean(ui.closeUp),
    onTile: (tile) => {
      fog.lookAround(tile.i, tile.j);                       // walking further in shows more
      on.tile?.(tile, (walker.walk?.pace ?? 1) > inv.walkPace());
    },
    onArrive: (id) => ui.arrive(id),
    onGo: () => ui.unhighlight(),
  });
  walker.place({ i: arrival.tile[0], j: arrival.tile[1] }, arrival.facing);

  // Where a wall or block hides the hero, his outline glows through it, so he is never lost. Each of his boxes
  // gets a twin drawn only where something nearer covers it; the stencil keeps the twins off the parts of him
  // that are in plain view, so his own arm behind his body does not glow.
  const SILHOUETTE = new THREE.MeshBasicMaterial({
    color: config.hero.silhouette ?? 0xffe2a0, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
  });
  hero.traverse((node) => {
    if (!node.isMesh || node.userData.silhouette) return;
    Object.assign(node.material, { stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp });
    const twin = new THREE.Mesh(node.geometry, SILHOUETTE);
    Object.assign(twin, { renderOrder: 50, castShadow: false, receiveShadow: false });
    twin.userData.silhouette = true;
    node.add(twin);
  });

  // ---------- what can be used ----------
  const panel = { title: $('panel-title'), text: $('panel-text'), answers: $('answers') };
  const ui = createInteraction({ scene, canvas, cam, world, walker, walkable, tileY, panel });
  $('back').addEventListener('click', ui.close);

  const travel = createTravel({ saveKey: config.save.key, curtain: $('night') });
  // What is carried to the next map: the inventory, the game's flags, what has been taken. A flag whose thing
  // this map does not have is carried over as it was, so one map keeps what was opened in it after a trip to another.
  const flags = Object.entries(config.save.flags ?? {});
  function carriedAlong() {
    const out = { inventory: inv.model };
    for (const [flag, owner] of flags) out[flag] = made[owner] ? state[flag] : Boolean(travel.saved?.[flag]);
    out.taken = { ...travel.saved?.taken, ...state.taken };
    return out;
  }
  const leave = (to) => { audio.fade(0, 0.4); travel.go(to, carriedAlong()); };

  // What a thing does when used, from its data (its own entry in the map first, then its kind).
  const veiled = (thing) => Boolean(thing.hidden ?? (thing.region && map.fog[thing.region]?.veiled));
  function behaviour(thing) {
    const kind = things.data(thing.kind) ?? {};
    const id = thing.id;
    const take = thing.take || kind.take?.items ? { ...kind.take, ...thing.take } : null;
    const box = thing.box ?? kind.box;
    const talk = thing.talk ?? kind.talk;
    const way = thing.way ?? kind.way;
    if (way) {
      // It bars the way (a boulder, a gate): its close-up has a button that takes it away. Then its tiles are free,
      // and the veiled part of the map behind it (`opens`) comes out of the dark.
      return {
        title: way.title, text: way.text, hidden: veiled(thing),
        onOpen() {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = way.button;
          button.addEventListener('click', () => {
            state.opened[id] = true;
            if (thing.opens) fog.open(thing.opens);
            open(thing.blocks);
            open(thing.gate);
            made[id].take?.();
            ui.hide(id);
            on.way?.(id);
            panel.text.textContent = way.done;
            panel.answers.hidden = true;
          });
          panel.answers.replaceChildren(button);
          panel.answers.hidden = false;
        },
      };
    }
    if (take) {
      // Its close-up has a button that puts it in the bag; then its place stays empty, also after a trip away and back.
      return {
        title: take.title, text: take.text, hidden: veiled(thing),
        onOpen() {
          if (state.taken[id]) { panel.text.textContent = take.empty; return; }
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = take.button;
          button.addEventListener('click', () => {
            const free = inv.model.bag.map((it, k) => (it ? -1 : k)).filter((k) => k >= 0);
            if (free.length < take.items.length) { panel.text.textContent = text.bagFull; return; }
            take.items.forEach((item, k) => { inv.model.bag[free[k]] = inv.item(item); });
            state.taken[id] = true;
            made[id].take();
            on.take?.(id);
            inv.render();
            panel.text.textContent = take.done;
            panel.answers.hidden = true;
          });
          panel.answers.replaceChildren(button);
          panel.answers.hidden = false;
        },
      };
    }
    // A box like the bag shows what is in it.
    if (box) return { title: box.title, text: box.text, lift: box.lift, hidden: veiled(thing), onOpen: () => { made[id].open?.(); on.box?.(id); inv.show(box.title, true); } };
    if (talk) return { title: talk.title, text: talk.text, hidden: veiled(thing) };
    return {};
  }
  const tile = ([i, j]) => ({ i, j });
  const usable = map.things.filter((thing) => thing.id);
  for (const thing of usable) {
    const { object } = made[thing.id];
    ui.add(thing.id, {
      tiles: thing.tiles.map(tile), front: tile(thing.front), focus: new THREE.Vector3(...thing.focus), zoom: thing.zoom, hit: thing.hit,
      bounds: thing.bounds && new THREE.Box3(new THREE.Vector3(...thing.bounds[0]), new THREE.Vector3(...thing.bounds[1])),
      object: object && (() => object),
      use: thing.travel && (() => leave(thing.travel)),
      ...behaviour(thing),
      ...config.uses?.[thing.id],
    });
  }

  // ---------- the inventory: Tab opens it ----------
  // What is put on the hero shows on him, and one thing in each hand.
  const { items: ITEMS, slots: EQUIP } = config.inventory;
  const icons = makeIcons(config.inventory.iconRows, config.inventory.palette);
  const inv = createInventory({
    items: ITEMS, slots: EQUIP, icons, hurry: config.hero.hurry ?? 1.5, text: config.inventory.text,
    els: { equip: $('inv-equip'), bag: $('inv-bag'), box: $('inv-box'), name: $('inv-name'), props: $('inv-props'), held: $('held'), title: $('inv-title') },
    more: (id) => shots.describe(id),
  });
  for (const [where, slots] of Object.entries(config.inventory.start ?? {})) for (const [k, [id, count]] of Object.entries(slots)) inv.model[where][k] = inv.item(id, count);
  inv.attach({ ui, cam, walker });
  ui.closing.push(() => say(shots.shooterHand() ? text.hintShoot : text.hint));
  $('inv-open').addEventListener('click', () => inv.toggle());
  $('inv-close').addEventListener('click', ui.close);

  const showHands = config.hero.holdings?.(rig, heroPaint);
  const wornSlots = EQUIP.map((slot) => slot.key).filter((slot) => !slot.startsWith('hand'));
  inv.changed.push(() => {
    const eq = inv.model.equip;
    rig.dress(new Set(wornSlots.map((slot) => eq[slot]?.id)));
    showHands?.(eq);
    shots.renderActions();
  });
  // What lies in a box shows on its thing only while it is still in it.
  const boxes = usable.filter((thing) => made[thing.id].contents).map((thing) => made[thing.id]);
  if (boxes.length) inv.changed.push(() => { const ids = new Set(inv.model.box.filter(Boolean).map((it) => it.id)); for (const box of boxes) box.contents(ids); });

  // ---------- shooting ----------
  // Space shoots the chosen one towards the pointer (the right button does too).
  const shots = createProjectiles({
    scene, shooters: config.shots.shooters, looks: config.shots.looks?.(heroPaint) ?? {}, inv, walker, busy: () => Boolean(ui.closeUp), walkable,
    icons, bar: $('actions'), text: config.shots.text,
    onShot: (look) => on.shot?.(look), onHit: (look) => on.hit?.(look),
  });
  // A click on a slot of the inventory: a thing put on or taken off (on.equip), or a thing only moved (on.pick).
  const wornNow = () => EQUIP.map((slot) => inv.model.equip[slot.key]?.id ?? '').join();
  let worn = wornNow();
  for (const id of ['inv-equip', 'inv-bag', 'inv-box']) {
    for (const press of ['click', 'dblclick']) $(id).addEventListener(press, () => { const now = wornNow(); if (now === worn) on.pick?.(); else on.equip?.(); worn = now; });
  }
  document.addEventListener('click', (e) => { if (e.target?.closest?.('button') && !e.target.closest('.slot-i')) on.click?.(); });
  inv.render();

  createInput({ canvas, cam, walker, ui, walkable, toggleInventory: () => inv.toggle(), shoot: shots.shoot, toHero: $('to-hero') });

  [['.panel', 41], ['#inv', 97], ['#settings', 131]].forEach(([selector, seed]) => tear(selector, seed));

  // ---------- the look: stone and textures ----------
  function setTextured(isOn) {
    world.setTextured(isOn);
    textureBoxes(isOn);
    $('style').textContent = isOn ? text.styleTextured : text.styleFlat;
  }
  $('style').addEventListener('click', () => setTextured(!world.textured));
  if (config.stone) world.setMaps(config.stone);
  setTextured(true);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    on.resize?.(w, h);
    cam.resize(w, h);
  }
  window.addEventListener('resize', resize);

  // ---------- the small map in the corner ----------
  // Drawn from the map's data. Only what the hero may walk into has been seen; the part he is not in is dimmer.
  // The things that can be used are small marks: a thing in a veiled part shows once its tile has been seen.
  const minimap = createMinimap({
    canvas: $('minimap'), level,
    colour: config.minimap.colour,
    seen: (x, z) => fog.canEnter(x, z),
    dim: (x, z) => fog.regionOf(x, z) !== state.here,
    marks: usable.map((thing) => {
      const [x, z] = thing.tiles[0];
      const inVeil = Boolean(thing.region && map.fog[thing.region]?.veiled);
      return {
        x, z, colour: thing.mark ?? things.data(thing.kind)?.mark ?? config.minimap.mark,
        shown: made[thing.id].marked ?? (inVeil ? () => fog.canEnter(x, z) : undefined),
      };
    }),
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !ui.closeUp) settings.choose('map', minimap.on ? 0 : 1);
  });

  // ---------- the settings ----------
  // What each setting does, by its id. The game adds its own (game.effects.specks = ...) before start().
  const effects = {
    fov: (degrees) => cam.setFov(degrees),
    tilt: (degrees) => cam.setTilt(degrees),
    focus: (percent) => focus.set(percent / 100),
    pool: (percent) => pool.set(percent / 100),
    shine: (percent) => shading.setShine(percent / 100),
    patches: (percent) => shading.setPatches(percent / 100),
    wind: (percent) => shading.setWind(percent / 100),
    torchShadows: (count) => { torchShadows.count = count; things.torchShadows(torchShadows.count, torchShadows.size); },
    shadowSize: (power) => {
      torchShadows.size = 2 ** power;
      things.torchShadows(torchShadows.count, torchShadows.size);
      if (!lantern) return;
      lantern.shadow.mapSize.set(torchShadows.size, torchShadows.size);       // the light he carries, the same size
      lantern.shadow.map?.dispose();
      lantern.shadow.map = null;
    },
    fps: (isOn) => fps.set(isOn > 0),
    sound: (percent) => audio.setVolume('sound', percent / 100),
    music: (isOn) => { musicOn = isOn > 0; audio.setVolume('music', musicOn ? musicVolume : 0); },
    musicVolume: (percent) => { musicVolume = percent / 100; audio.setVolume('music', musicOn ? musicVolume : 0); },
    map: (isOn) => minimap.set(isOn > 0),
  };
  let settings = null;

  // The light he carries: the first of its sources that he has on him.
  const sources = (carried?.sources ?? []).map((source) => ({ ...source, slot: source.wears && Object.keys(source.wears)[0] }));
  function carryLight(t) {
    lantern.position.set(hero.position.x + carried.at[0], hero.position.y + carried.at[1], hero.position.z + carried.at[2]);
    let lit = null;
    for (let k = 0; k < sources.length && !lit; k++) {
      const source = sources[k];
      if (source.holds ? inv.holds(source.holds) : inv.model.equip[source.slot]?.id === source.wears[source.slot]) lit = source;
    }
    const pulse = lit ? lit.pulse[0] + lit.pulse[1] * Math.sin(t * lit.pulse[2]) : 0;
    lantern.color.set(lit?.colour ?? carried.colour);
    lantern.intensity = lit ? lit.power * pulse : 0;
    lanternHalo.material.color.set(lit?.halo.colour ?? carried.halo.colour);
    lanternHalo.material.opacity = lit ? (lit.halo.pulses ? lit.halo.opacity * pulse : lit.halo.opacity) : 0;
    const casts = Boolean(lit) && torchShadows.count > 0;       // the torch shadows at 0 turn this off too
    if (lantern.castShadow !== casts) lantern.castShadow = casts;
  }

  // ---------- every frame ----------
  let clock = null;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    fps.tick();

    walker.update(dt, t);
    shots.update(dt);
    if (lantern) carryLight(t);

    state.here = fog.regionOf(walker.tile.i, walker.tile.j);
    fog.update(dt, state.here);
    things.update(t, dt);

    // what is seen changes with the cells seen behind a door, the parts explored, and the part he is in
    const stamp = fog.seen.size * 100 + fog.explored.size * 10 + regions.indexOf(state.here);
    minimap.update(hero.position, hero.rotation.y, stamp);
    if (stamp !== seenStamp) { seenStamp = stamp; on.seen?.(); }
    sounds?.update(dt, t, torchNear(), 0);
    on.frame?.(dt, t);
    cam.update(dt, hero.position, !ui.closeUp);
    shading.update(t);
    pool.at.copy(hero.position);
    renderer.render(scene, cam.camera);
    // sharp at the distance of the point the camera looks at; a screenful of depth is about 1.4 times its height
    if (focus.strength) focus.render(scene, cam.camera, cam.camera.position.distanceTo(cam.look), cam.span * 1.4);
    requestAnimationFrame(frame);
  }

  const game = {
    map, level, state, on, effects, text,
    renderer, scene, canvas, world, fog, cam, shading, focus, pool,
    things, stage, made, audio, rig, hero, walker, ui, panel, travel, inv, shots, minimap, fps,
    arrival, regions, tileY, walkable, shut, open, say, leave, setTextured,
    get settings() { return settings; },
    /** The game has added its own: the settings are made (and applied), what was carried here is put back, the frames start. */
    start() {
      settings = createSettings({
        list: config.settings.list.map((setting) => ({ ...setting, label: config.settings.labels[setting.id] })),
        els: { list: $('settings-list'), open: $('settings-open'), close: $('settings-close') },
        prefix: config.settings.prefix,
        apply: (id, v) => effects[id](v),
      });
      clock = new THREE.Clock();

      // between maps
      const saved = travel.saved;
      if (saved?.inventory) inv.restore(saved.inventory);
      on.restore?.(saved);
      for (const id of Object.keys(saved?.taken ?? {})) if (made[id]?.take) { state.taken[id] = true; made[id].take(); }
      if (arrival.walkOut) {
        // he comes out of a doorway: from inside it, a few steps out
        hero.position.set(...arrival.at);
        walker.walkOut(arrival.walkOut.map(tile));
        cam.look.set(...arrival.look);
        cam.lookGoal.copy(cam.look);
      }
      on.arrive?.(arrival);
      travel.arrive();

      resize();
      requestAnimationFrame(frame);
    },
  };
  return game;
}
