// @ts-check
// D&K: Dungeons and Knowledge. A dungeon and the land above it, made only of boxes, light and glow.
// Grown out of the look study in ideas/razseyaniyat-schetovoditel-looks/dungeon.html.
// This is the game itself: it takes one of the two maps (maps/), builds it with the engine (../engine/),
// and adds what is this game's own: the chest task, the guardian's questions, the light the hero carries.
import * as THREE from '../engine/three.js';
import { mulberry32 } from '../engine/random.js';
import { loadMap, key, HOME_REGION } from '../engine/map.js';
import { createStage } from '../engine/stage.js';
import { createWorld } from '../engine/world.js';
import { createFog } from '../engine/fog.js';
import { createCamera, ISO_TILT } from '../engine/camera.js';
import { createFocus, createLightPool } from '../engine/effects.js';
import { createShading } from '../engine/shading.js';
import { createSettings } from '../engine/settings.js';
import { createMinimap } from '../engine/minimap.js';
import { createFps } from '../engine/fps.js';
import { createAudio } from '../engine/audio.js';
import { createCritters } from '../engine/critters.js';
import { createPainter, loadSkin, createRig } from '../engine/characters.js';
import { createWalker } from '../engine/walking.js';
import { createInteraction } from '../engine/interaction.js';
import { createInventory, makeIcons } from '../engine/inventory.js';
import { createProjectiles } from '../engine/projectiles.js';
import { createInput } from '../engine/input.js';
import { createTravel, place } from '../engine/travel.js';
import { glow, textureBoxes } from '../engine/boxes.js';
import { TEXT, INVENTORY_TEXT, SHOOT_TEXT, SETTINGS_TEXT } from './texts.js';
import { KINDS, chosenStone } from './blocks.js';
import { createBackdrop } from './backdrop.js';
import { createSounds } from './sounds.js';
import { createMusic } from './music.js';
import { createSpecks } from './particles.js';
import { addCritters } from './critters.js';
import { createDetails } from './details.js';
import { ITEMS, EQUIP, PIXEL, ICON_ROWS, SHOOTERS, START } from './items.js';
import { HERO_LOOKS, HERO_FACES, HERO_SKIN } from './hero.js';
import { makeClothes, makeHoldings, makeArrow } from './wear.js';
import { makeProps } from './props.js';
import { goblinKinds } from './goblins.js';
import { M, PETALS } from './materials.js';
import { mountChestTask } from './chest-task-ui.js';
import { createGuardian } from './guardian.js';
import { DUNGEON } from './maps/dungeon.js';
import { SURFACE } from './maps/surface.js';

const STEP_SECONDS = 0.276;     // time to walk one tile: an easy walk
const HURRY = 1.5;              // a double click: half as fast again
const SAVE_KEY = 'levacademy-dungeon-study-3';

// One page, two maps: the dungeon, and above ground (#surface). The stairs and the cave door lead between them.
const PLACE = place();          // 'surface' above ground; 'from-surface' back down through the cave
const map = PLACE === 'surface' ? SURFACE : DUNGEON;
document.body.classList.toggle('is-surface', map === SURFACE);
const $ = (id) => document.getElementById(id);

// What has happened so far. The things of the map read it every frame (props.js).
const state = {
  doorOpen: false, chestOpen: false,
  chestShake: 0,                 // seconds left of the chest rattling after a wrong try
  chest2Seen: false, chest2Open: false,
  taken: {},                         // what has been taken off its stand or wall: id -> true
  caveDoorOpen: true,            // above ground the cave door starts open, the hero comes out, it shuts
  here: HOME_REGION,             // the part of the map the hero is in
  closeUp: () => ui.closeUp,
};

// ---------- the world ----------
const canvas = $('scene');
const { renderer, scene } = createStage(canvas);
const stone = await chosenStone();
const level = loadMap(map);
const tileY = (i, j) => level.heights.get(key(i, j)) ?? 0;
const walkable = (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)) && fog.canEnter(i, j);
const groundCost = map.offRoad ? (i, j) => (level.road.has(key(i, j)) ? 1 : map.offRoad) : undefined;
const shut = (tiles = []) => tiles.forEach(([i, j]) => level.blocked.add(key(i, j)));
const open = (tiles = []) => tiles.forEach(([i, j]) => level.blocked.delete(key(i, j)));

const regions = Object.keys(map.fog);
const world = createWorld({
  scene, blocks: level.blocks, kinds: KINDS,
  light: Object.fromEntries(regions.map((name) => [name, map.fog[name].light])),
  veiled: regions.filter((name) => map.fog[name].veiled),
  rand: mulberry32(map.seeds.look ?? 1),
});
const viewBox = { ...map.view };
const fog = createFog({ world, blocks: level.blocks, regionAt: level.regionAt, regions: map.fog, viewBox });
const cam = createCamera({ rest: map.camera, viewBox });

// ---------- the look the settings tune (see the sliders further down) ----------
// Stone and water shine a little under the lights; big darker and lighter patches lie over all the blocks. Above ground the leaves, the grass and the flowers sway in the
// wind, and the shadows of clouds drift over everything that takes light.
const above = map === SURFACE;
const shading = createShading(map.seeds.shade ?? map.seeds.things);
const WATER_LOOK = { shine: 1.6, gloss: 40, glint: true, clouds: above };
const WATER_BLOCK = { ...WATER_LOOK, patches: true };
const WET_STONE = new Set(['stone', 'stoneB', 'cobble', 'cobbleB', 'bricks', 'bricksB', 'mossy', 'mossyB', 'cracked', 'tile', 'deep', 'dark', 'darkB', 'night', 'nightB']);
for (const { material, name } of world.materials) {
  if (name === 'water') shading.dress(material, WATER_BLOCK);
  else shading.dress(material, { shine: WET_STONE.has(name) ? 0.6 : 0, gloss: 22, sway: above && name === 'leaves' ? 'tree' : undefined, clouds: above, patches: true });
}
if (above) {
  for (const material of Object.values(M)) if (material.isMeshLambertMaterial) shading.dress(material, { sway: material === M.blade ? 'tip' : undefined, clouds: true });
  for (const material of PETALS) shading.dress(material, { sway: 'whole', clouds: true });
}
const focus = createFocus(renderer);
const pool = createLightPool(scene);

// ---------- the things of the map ----------
const stage = { scene, rand: mulberry32(map.seeds.things), paintedBox: createPainter(), level, world, fog, state, hero: null, onSeen: () => ui.show('chest2'), reveal: (id) => ui.show(id),
  wet: (material) => shading.dress(material, WATER_LOOK) };
const props = makeProps(stage);
Object.assign(props.build, goblinKinds(stage, (update) => props.updates.push(update)));     // goblins, a camp fire, a hoard
const made = {};                 // id -> what the builder of a thing gave back
for (const thing of map.things) {
  const built = props.build[thing.kind](thing);
  if (thing.id) made[thing.id] = built ?? {};
  shut(thing.blocks);
  shut(thing.gate);              // a gate in a wall stays shut until its thing opens it
}
for (const [kind, cells] of Object.entries(level.spots)) {     // what the map itself places: flowers, a well, lamps...
  if (props.fields[kind]) props.fields[kind](cells); else cells.forEach(([x, z]) => props.build[kind]({ x, z }));
}

// ---------- sound and music: made in the browser, started by the first press or key ----------
const audio = createAudio();
const sounds = createSounds({ audio, above });
const music = createMusic({ audio, above });
// What is underfoot, for the steps; and the open water near the hero, for its sound and its sparkles.
const STEP_ON = { grass: 'grass', dirt: 'grass', sand: 'grass', crop: 'grass', planks: 'wood', log: 'wood' };
const groundKind = new Map(level.blocks.filter((b) => b.tile).map((b) => [key(b.x, b.z), b.type]));
const waterTiles = new Set(level.blocks.filter((b) => b.type === 'water').map((b) => b.x * 4096 + b.z));
for (const thing of map.things) if (thing.kind === 'stream') thing.tiles.forEach(([i, j]) => waterTiles.add(i * 4096 + j));
const waterNear = { list: new Int16Array(128), count: 0, near: 0 };       // `near`: 0 (none within reach) to 1 (beside it)
function lookForWater(i, j) {
  let nearest = 99;
  waterNear.count = 0;
  for (let di = -7; di <= 7; di++) for (let dj = -7; dj <= 7; dj++) {
    if (!waterTiles.has((i + di) * 4096 + j + dj)) continue;
    nearest = Math.min(nearest, Math.hypot(di, dj));
    if (waterNear.count < 64) { waterNear.list[waterNear.count * 2] = i + di; waterNear.list[waterNear.count * 2 + 1] = j + dj; waterNear.count++; }
  }
  waterNear.near = Math.max(0, Math.min(1, 1 - (nearest - 1) / 6));
}
function torchNear() {
  let nearest = 99;
  for (let k = 0; k < props.torches.length; k++) if (props.torches[k].base > 0) nearest = Math.min(nearest, props.torches[k].at.distanceTo(hero.position));
  return Math.max(0, 1 - nearest / 7);
}

// ---------- the hero ----------
// His body (not his clothes) is painted by the code. It can come from a skin sheet instead, when hero.js names one
// (HERO_SKIN). window.dkSkin.sheet() / .guide() / .layout() give the current look as such a sheet, to hand to an artist.
const heroPaint = createPainter({ seed: HERO_FACES });
const rig = createRig({ paintedBox: heroPaint, looks: HERO_LOOKS, skin: HERO_SKIN && await loadSkin(new URL(HERO_SKIN, import.meta.url)), stepSeconds: STEP_SECONDS });
window.dkSkin = rig.skinTools;
makeClothes(rig);
const hero = rig.group;
stage.hero = hero;
// The light around the hero. It shines only while he holds a torch, or wears the magic cloak.
const lantern = new THREE.PointLight(0xffc27a, 9, 5.5, 2);
// The light he carries (a torch in hand, or the magic cloak) throws shadows too, while it is lit: the columns he
// walks between throw theirs away from him. Turning it on or off rebuilds the materials once, when he changes what he carries.
lantern.shadow.mapSize.set(512, 512);
lantern.shadow.camera.near = 0.1;
lantern.shadow.camera.far = 6;
lantern.shadow.bias = -0.002;
lantern.shadow.normalBias = 0.04;
scene.add(lantern);
const lanternHalo = glow(hero, 0xffa040, 1.5, 0.35, 0.28, 0.24, 0.02);
scene.add(hero);

const arrival = map.arrivals?.[PLACE] ?? map.start;
hero.position.set(arrival.tile[0], tileY(...arrival.tile), arrival.tile[1]);
hero.rotation.y = arrival.facing;

lookForWater(arrival.tile[0], arrival.tile[1]);

// ---------- life and clutter: specks in the air, small animals, things strewn about ----------
const specks = createSpecks({ scene, hero, torches: props.torches, falls: props.falls, water: waterNear, above });
const critters = createCritters({
  allowed: (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)) && fog.canEnter(i, j) && fog.regionOf(i, j) === state.here,
  tileY, hero,
});
addCritters({
  critters, scene, above,
  walkable: (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)),
  flowers: new Set((level.spots.flowers ?? []).map(([x, z]) => x * 4096 + z)),
});
const details = createDetails({ scene, map, level, world, above, seen: (x, z) => fog.canEnter(x, z), dim: (x, z) => fog.regionOf(x, z) !== state.here });
const fps = createFps($('fps'));
let depth = 0;                   // how much the layers of the backdrop slide against the view: with the details
let seenStamp = NaN;             // changes when more has been seen, or the hero is in another part
let musicOn = true;
let musicVolume = 0;
const torchShadows = { count: 2, size: 512 };

const hint = $('hint');
const say = (text) => { hint.textContent = text; };
say(TEXT.hint);

const walker = createWalker({
  scene, rig, tileY, walkable, groundCost, stepSeconds: STEP_SECONDS,
  paces: { walk: () => inv.walkPace(), hurry: () => inv.hurryPace() },
  busy: () => Boolean(ui.closeUp),
  onTile: (tile) => {
    fog.lookAround(tile.i, tile.j);                       // walking further in shows more
    lookForWater(tile.i, tile.j);
    const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => waterTiles.has((tile.i + di) * 4096 + tile.j + dj));
    sounds.step(wet ? 'water' : STEP_ON[groundKind.get(key(tile.i, tile.j))] ?? 'stone', (walker.walk?.pace ?? 1) > inv.walkPace());
  },
  onArrive: (id) => ui.arrive(id),
  onGo: () => ui.unhighlight(),
});
walker.place({ i: arrival.tile[0], j: arrival.tile[1] }, arrival.facing);

// Where a wall or block hides the hero, his outline glows through it, so he is never lost (the blocks no longer
// thin out). Each of his boxes gets a twin drawn only where something nearer covers it; the stencil keeps the
// twins off the parts of him that are in plain view, so his own arm behind his body does not glow.
const SILHOUETTE = new THREE.MeshBasicMaterial({
  color: 0xffe2a0, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth,
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

const travel = createTravel({ saveKey: SAVE_KEY, curtain: $('night') });
// What this map does not have is carried over as it was, so the dungeon keeps its open door and its seen chest after a trip up.
const kept = (has, now, key) => (has ? now : Boolean(travel.saved?.[key]));
const leave = (to) => { audio.fade(0, 0.4); go(to); };
const go = (to) => travel.go(to, {
  inventory: inv.model,
  doorOpen: kept(made.door, state.doorOpen, 'doorOpen'),
  chest2Seen: kept(made.chest2, state.chest2Seen, 'chest2Seen'),
  chest2Open: kept(made.chest2, state.chest2Open, 'chest2Open'),
  taken: { ...travel.saved?.taken, ...state.taken },
});

// The guardian's question was answered: the door slides down, the guardian
// steps aside, and the part of the dungeon behind it comes out of the dark.
function openDoor() {
  const door = map.things.find((thing) => thing.id === 'door');
  state.doorOpen = true;
  sounds.door();
  fog.open(door.opens);
  open(door.blocks);
  open(door.gate);
  shut(door.asideBlocks);
  ui.hide('door');
  ui.close();
}
const guardian = createGuardian({ panel, asking: () => ui.closeUp === 'door' && !state.doorOpen, onRight: () => { if (!state.doorOpen) openDoor(); },
  onAnswer: (right) => (right ? sounds.right() : sounds.wrong()) });

// What is this game's own about each thing; the rest (where it is, where the camera goes) is in the map.
const USES = {
  chest: { title: TEXT.chestTitle, text: TEXT.chestText, sheet: 'is-task', lift: 0.3 },      // the sheet of the task takes the lower part of the screen
  door: { title: TEXT.doorTitle, text: TEXT.doorText, onOpen: () => { if (!state.doorOpen) guardian.ask(); } },
  // The chest in the far chamber: the lid goes up and stays up, and a box like the bag shows what is in it.
  // It joins what can be tapped once it has been seen.
  chest2: { title: TEXT.chest2Title, text: TEXT.chest2Text, lift: 0.3, hidden: true, onOpen: () => { state.chest2Open = true; sounds.chest(); inv.show(TEXT.chest2Title, true); } },
};
// Things that can be taken: the royal armour off its stand, a shield off the wall, a spear by the throne. Each one's
// close-up has a button that puts it in the bag; then its place stays empty, also after a trip up and back.
const TAKE = {
  armor: { items: ['royalHelmet', 'royalChest', 'royalLegs', 'royalBoots'], title: TEXT.armorTitle, text: TEXT.armorText, button: TEXT.armorTake, done: TEXT.armorTaken, empty: TEXT.armorEmpty },
  shield: { items: ['shield'], title: TEXT.shieldTitle, text: TEXT.shieldText, button: TEXT.shieldTake, done: TEXT.takenToBag, empty: TEXT.shieldEmpty },
  spear: { items: ['spear'], title: TEXT.spearTitle, text: TEXT.spearText, button: TEXT.spearTake, done: TEXT.takenToBag, empty: TEXT.spearEmpty },
  torch: { items: ['torch'], title: TEXT.torchTitle, text: TEXT.torchText, button: TEXT.torchTake, done: TEXT.takenToBag, empty: TEXT.torchEmpty, inSight: true },
};
for (const [id, take] of Object.entries(TAKE)) {
  USES[id] = {
    title: take.title, text: take.text, hidden: !take.inSight,      // behind the door: tappable once seen
    onOpen() {
      if (state.taken[id]) { panel.text.textContent = take.empty; return; }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = take.button;
      button.addEventListener('click', () => {
        const free = inv.model.bag.map((it, k) => (it ? -1 : k)).filter((k) => k >= 0);
        if (free.length < take.items.length) { panel.text.textContent = TEXT.bagFull; return; }
        take.items.forEach((item, k) => { inv.model.bag[free[k]] = inv.item(item); });
        state.taken[id] = true;
        made[id].take();
        sounds.equip();
        inv.render();
        panel.text.textContent = take.done;
        panel.answers.hidden = true;
      });
      panel.answers.replaceChildren(button);
      panel.answers.hidden = false;
    },
  };
}
// A goblin has nothing to say yet. One behind the guardian's door can be tapped once he has been seen.
for (const thing of map.things) if (thing.kind === 'goblin' && thing.id) USES[thing.id] = { title: TEXT.goblinTitle, text: TEXT.goblinText, hidden: thing.region === 'north' };
const tile = ([i, j]) => ({ i, j });
for (const thing of map.things) {
  if (!thing.id) continue;
  const { object } = made[thing.id];
  ui.add(thing.id, {
    tiles: thing.tiles.map(tile), front: tile(thing.front), focus: new THREE.Vector3(...thing.focus), zoom: thing.zoom, hit: thing.hit,
    bounds: thing.bounds && new THREE.Box3(new THREE.Vector3(...thing.bounds[0]), new THREE.Vector3(...thing.bounds[1])),
    object: object && (() => object),
    use: thing.travel && (() => leave(thing.travel)),
    ...USES[thing.id],
  });
}

mountChestTask({
  onBack: ui.close,
  onFail: () => { state.chestShake = 0.35; sounds.rattle(); },
  onOpen: (isOpen) => { state.chestOpen = isOpen; if (isOpen) { sounds.chest(); sounds.coins(); } },
});

// ---------- the inventory: Tab opens it ----------
// What is put on the hero shows on him, and one thing in each hand.
const ICON = makeIcons(ICON_ROWS, PIXEL);
const inv = createInventory({
  items: ITEMS, slots: EQUIP, icons: ICON, hurry: HURRY, text: INVENTORY_TEXT,
  els: { equip: $('inv-equip'), bag: $('inv-bag'), box: $('inv-box'), name: $('inv-name'), props: $('inv-props'), held: $('held'), title: $('inv-title') },
  more: (id) => shots.describe(id),
});
for (const [where, slots] of Object.entries(START)) for (const [k, [id, count]] of Object.entries(slots)) inv.model[where][k] = inv.item(id, count);
inv.attach({ ui, cam, walker });
ui.closing.push(() => say(shots.shooterHand() ? TEXT.hintShoot : TEXT.hint));
$('inv-open').addEventListener('click', () => inv.toggle());
$('inv-close').addEventListener('click', ui.close);

const showHands = makeHoldings(rig, heroPaint);
const wornSlots = EQUIP.map((slot) => slot.key).filter((slot) => !slot.startsWith('hand'));
inv.changed.push(() => {
  const eq = inv.model.equip;
  rig.dress(new Set(wornSlots.map((slot) => eq[slot]?.id)));
  showHands(eq);
  shots.renderActions();
});
// What lies in the far chest shows only while it is still in it.
inv.changed.push(() => made.chest2?.contents(new Set(inv.model.box.filter(Boolean).map((it) => it.id))));

// ---------- shooting: the magic wand and the bow ----------
// Space shoots the chosen one towards the pointer (the right button does too).
const shots = createProjectiles({
  scene, shooters: SHOOTERS, looks: { arrow: makeArrow(heroPaint) }, inv, walker, busy: () => Boolean(ui.closeUp), walkable,
  icons: ICON, bar: $('actions'), text: SHOOT_TEXT,
  onShot: (look) => sounds.shot(look), onHit: (look) => sounds.hit(look),
});
// A click on a slot of the inventory: a thing put on or taken off sounds one way, a thing only moved another.
const wornNow = () => EQUIP.map((slot) => inv.model.equip[slot.key]?.id ?? '').join();
let worn = wornNow();
for (const id of ['inv-equip', 'inv-bag', 'inv-box']) {
  for (const press of ['click', 'dblclick']) $(id).addEventListener(press, () => { const now = wornNow(); if (now === worn) sounds.pick(); else sounds.equip(); worn = now; });
}
document.addEventListener('click', (e) => { if (e.target?.closest?.('button') && !e.target.closest('.slot-i')) sounds.click(); });
inv.render();

createInput({ canvas, cam, walker, ui, walkable, toggleInventory: () => inv.toggle(), shoot: shots.shoot, toHero: $('to-hero') });

// Torn paper: each sheet gets its own ragged outline, a little different every time it is made.
function tornEdge(seed, depth) {
  const r = mulberry32(seed);
  const tear = () => (r() < 0.16 ? r() * depth * 2 : r() * depth).toFixed(1);          // now and then a deeper tear
  const points = [];
  for (let k = 0; k <= 36; k++) points.push(`${((k / 36) * 100).toFixed(1)}% ${tear()}px`);                    // top
  for (let k = 1; k <= 16; k++) points.push(`calc(100% - ${tear()}px) ${((k / 16) * 100).toFixed(1)}%`);       // right
  for (let k = 35; k >= 0; k--) points.push(`${((k / 36) * 100).toFixed(1)}% calc(100% - ${tear()}px)`);      // bottom
  for (let k = 15; k >= 1; k--) points.push(`${tear()}px ${((k / 16) * 100).toFixed(1)}%`);                    // left
  return `polygon(${points.join(', ')})`;
}
[['.panel', 41], ['#task', 73], ['#inv', 97], ['#settings', 131]].forEach(([selector, seed]) => {
  const sheet = document.querySelector(selector);
  sheet.style.setProperty('--torn-front', tornEdge(seed, 5));
  sheet.style.setProperty('--torn-back', tornEdge(seed + 7, 7));
});

// ---------- the look: stone and textures ----------
function setTextured(on) {
  world.setTextured(on);
  textureBoxes(on);
  $('style').textContent = on ? TEXT.styleTextured : TEXT.styleFlat;
}
$('style').addEventListener('click', () => setTextured(!world.textured));
$('stone').textContent = TEXT.stone;
world.setMaps(stone);
setTextured(true);

const backdrop = createBackdrop($('backdrop'), map.backdrop);
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  backdrop.paint();
  cam.resize(w, h);
}
window.addEventListener('resize', resize);

// ---------- the small map in the corner ----------
// Drawn from the map's data: floor light, what cannot be walked on darker, water, road, green, rock. Only what the
// hero may walk into has been seen (so nothing behind the guardian's door until it opens); the part he is not in
// is dimmer. The things that can be used are small marks.
const MAP_COLOUR = { floor: '#d8cba6', grass: '#a9c47c', wall: '#4d463c', water: '#3f86bd', road: '#8f6d47', green: '#3f7a35', rock: '#8d8c85' };
const MARK_COLOUR = { chest: '#ffc94a', chest2: '#ffc94a', door: '#b07cff', stairs: '#e6f4ff', cave: '#e6f4ff' };
const GREEN = new Set(['leaves', 'log']);
const ROCK = new Set(['stone', 'cobble', 'deep', 'grass']);
const streamTiles = new Set(map.things.filter((thing) => thing.kind === 'stream').flatMap((thing) => thing.tiles.map(([i, j]) => key(i, j))));
const minimap = createMinimap({
  canvas: $('minimap'), level,
  colour: ({ x, z, type, height, walk, road }) => (type === 'water' || streamTiles.has(key(x, z)) ? MAP_COLOUR.water
    : road ? MAP_COLOUR.road
      : walk ? (type === 'grass' ? MAP_COLOUR.grass : MAP_COLOUR.floor)
        : GREEN.has(type) ? MAP_COLOUR.green
          : above && height >= 2 && ROCK.has(type) ? MAP_COLOUR.rock : MAP_COLOUR.wall),
  seen: (x, z) => fog.canEnter(x, z),
  dim: (x, z) => fog.regionOf(x, z) !== state.here,
  marks: map.things.filter((thing) => thing.id).map((thing) => ({
    x: thing.tiles[0][0], z: thing.tiles[0][1], colour: MARK_COLOUR[thing.id] ?? (thing.kind === 'goblin' ? '#8fd14f' : MAP_COLOUR.floor),
    shown: thing.id === 'chest2' ? () => state.chest2Seen : thing.region === 'north' ? () => fog.canEnter(...thing.tiles[0]) : undefined,
  })),
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !ui.closeUp) settings.choose('map', minimap.on ? 0 : 1);
});

// ---------- the settings: a slider each ----------
// Perspective: 0 is the flat view; more degrees, more depth. Tilt: how steeply the camera looks down; it starts as
// the isometric view, and its steps are whole degrees away from it. The four effects go from 0 (off) to 100 and
// start low. A choice is remembered in this browser.
const EFFECTS = {
  fov: (degrees) => cam.setFov(degrees),
  tilt: (degrees) => cam.setTilt(degrees),
  focus: (percent) => focus.set(percent / 100),
  pool: (percent) => pool.set(percent / 100),
  shine: (percent) => shading.setShine(percent / 100),
  patches: (percent) => shading.setPatches(percent / 100),
  torchShadows: (count) => { torchShadows.count = count; props.torchShadows(torchShadows.count, torchShadows.size); },
  shadowSize: (power) => {
    torchShadows.size = 2 ** power;
    props.torchShadows(torchShadows.count, torchShadows.size);
    lantern.shadow.mapSize.set(torchShadows.size, torchShadows.size);       // the light he carries, the same size
    lantern.shadow.map?.dispose();
    lantern.shadow.map = null;
  },
  fps: (on) => fps.set(on > 0),
  sound: (percent) => audio.setVolume('sound', percent / 100),
  music: (on) => { musicOn = on > 0; audio.setVolume('music', musicOn ? musicVolume : 0); },
  musicVolume: (percent) => { musicVolume = percent / 100; audio.setVolume('music', musicOn ? musicVolume : 0); },
  specks: (percent) => specks.setAmount(percent / 100),
  critters: (percent) => critters.show(Math.round((critters.count * percent) / 100)),
  details: (percent) => { depth = percent / 100; details.setDensity(depth); details.relight(); },
  wind: (percent) => shading.setWind(percent / 100),
  map: (on) => minimap.set(on > 0),
};
const settings = createSettings({
  list: [
    { id: 'fov', min: 0, max: 60, start: 60, unit: '°' },
    { id: 'tilt', min: ISO_TILT - 15, max: ISO_TILT + 40, start: ISO_TILT, unit: '°' },
    { id: 'focus', min: 0, max: 100, start: 25 },
    { id: 'pool', min: 0, max: 100, start: 20 },
    { id: 'shine', min: 0, max: 100, start: 25 },
    { id: 'patches', min: 0, max: 100, start: 40 },
    { id: 'wind', min: 0, max: 100, start: 30, note: SETTINGS_TEXT.windNote },
    { id: 'torchShadows', min: 0, max: 2, start: 2 },
    { id: 'shadowSize', min: 8, max: 10, start: 9, shown: (power) => String(2 ** power) },       // 256, 512 or 1024
    { id: 'map', toggle: true, start: 1, note: SETTINGS_TEXT.mapNote },
    { id: 'fps', toggle: true, start: 1 },
    { id: 'sound', min: 0, max: 100, start: 60 },
    { id: 'music', toggle: true, start: 1 },
    { id: 'musicVolume', min: 0, max: 100, start: 40 },
    { id: 'specks', min: 0, max: 100, start: 30 },
    { id: 'critters', min: 0, max: 100, start: 30 },
    { id: 'details', min: 0, max: 100, start: 40 },
  ].map((setting) => ({ ...setting, label: SETTINGS_TEXT[setting.id] })),
  els: { list: $('settings-list'), open: $('settings-open'), close: $('settings-close') },
  prefix: 'dk-',
  apply: (id, value) => EFFECTS[id](value),
});

// ---------- every frame ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  fps.tick();

  walker.update(dt, t);
  shots.update(dt);

  lantern.position.set(hero.position.x + 0.55, hero.position.y + 1.0, hero.position.z + 0.55);
  const torchLit = inv.holds('torch') ? 1 : 0;
  // The magic cloak shines violet, a little brighter than a torch, so with both it is the cloak's light.
  const cloakLit = inv.model.equip.back?.id === 'magicCloak';
  const flick = 0.9 + 0.1 * Math.sin(t * 9);
  lantern.color.set(cloakLit ? 0xb58cff : 0xffc27a);
  lantern.intensity = cloakLit ? 5.2 * (0.94 + 0.06 * Math.sin(t * 2)) : 4.5 * torchLit * flick;
  lanternHalo.material.color.set(cloakLit ? 0x9a6cff : 0xffa040);
  lanternHalo.material.opacity = cloakLit ? 0.16 : 0.14 * torchLit * flick;
  const carriesLight = Boolean(cloakLit || torchLit) && torchShadows.count > 0;      // „Сенки от факли“ at 0 turns this off too
  if (lantern.castShadow !== carriesLight) lantern.castShadow = carriesLight;

  state.here = fog.regionOf(walker.tile.i, walker.tile.j);
  fog.update(dt, state.here);
  for (let k = 0; k < props.updates.length; k++) props.updates[k](t, dt);

  // what is seen changes with the cells seen behind the door, the parts explored, and the part he is in
  const stamp = fog.seen.size * 100 + fog.explored.size * 10 + regions.indexOf(state.here);
  minimap.update(hero.position, hero.rotation.y, stamp);
  if (stamp !== seenStamp) { seenStamp = stamp; details.relight(); }
  specks.update(dt, t);
  critters.update(dt, t);
  sounds.update(dt, t, torchNear(), waterNear.near);
  music.update(dt, (ui.closeUp === 'door' && !state.doorOpen) || Boolean(inv.boxOpen));
  backdrop.shift((cam.look.x - cam.look.z) * Math.SQRT1_2, (cam.look.x + cam.look.z) * Math.SQRT1_2, depth);
  cam.update(dt, hero.position, !ui.closeUp);
  shading.update(t);
  pool.at.copy(hero.position);
  renderer.render(scene, cam.camera);
  // sharp at the distance of the point the camera looks at; a screenful of depth is about 1.4 times its height
  if (focus.strength) focus.render(scene, cam.camera, cam.camera.position.distanceTo(cam.look), cam.span * 1.4);
  requestAnimationFrame(frame);
}

// ---------- between the two maps ----------
const saved = travel.saved;
if (saved?.inventory) inv.restore(saved.inventory);
if (made.door && saved?.doorOpen) openDoor();
if (made.chest2 && saved?.chest2Seen) { state.chest2Seen = true; ui.show('chest2'); }
if (made.chest2 && saved?.chest2Open) state.chest2Open = true;
for (const id of Object.keys(saved?.taken ?? {})) if (made[id]?.take) { state.taken[id] = true; made[id].take(); }
if (arrival.walkOut) {
  // he comes out of the cave: from inside the mouth, two steps out, then the door shuts behind him
  hero.position.set(...arrival.at);
  walker.walkOut(arrival.walkOut.map(tile));
  cam.look.set(...arrival.look);
  cam.lookGoal.copy(cam.look);
  setTimeout(() => { state.caveDoorOpen = false; }, 1500);
}
travel.arrive();

resize();
requestAnimationFrame(frame);
