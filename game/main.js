// @ts-check
// D&K: Dungeons and Knowledge. A dungeon and the land above it, made only of boxes, light and glow.
// Grown out of the look study in ideas/razseyaniyat-schetovoditel-looks/dungeon.html.
// This is the game itself: it picks one of the two maps (maps/), hands the engine (../engine/play.js) the data
// (blocks, kinds of things, items, texts, settings) and adds what is this game's own: the chest task, the
// guardian's questions and his door, how the place sounds and what lives in it.
import { createGame } from '../engine/play.js';
import { key } from '../engine/map.js';
import { ISO_TILT } from '../engine/camera.js';
import { createCritters } from '../engine/critters.js';
import { place } from '../engine/travel.js';
import { tear } from '../engine/paper.js';
import { TEXT, INVENTORY_TEXT, SHOOT_TEXT, SETTINGS_TEXT } from './texts.js';
import { KINDS as BLOCKS, WET_STONE, chosenStone } from './blocks.js';
import { createBackdrop } from './backdrop.js';
import { createSounds } from '../engine/defaults/sounds.js';
import { createMusic } from './music.js';
import { createSpecks } from './particles.js';
import { addCritters } from './critters.js';
import { createDetails } from './details.js';
import { ITEMS, EQUIP, PIXEL, ICON_ROWS, SHOOTERS, CARRIED_LIGHT, START } from './items.js';
import { HERO_LOOKS, HERO_FACES, HERO_SKIN } from './hero.js';
import { makeClothes, makeHoldings, makeArrow } from '../engine/defaults/wear.js';
import { KINDS } from './kinds/index.js';
import { PAINTS } from './paints.js';
import { makeProps } from './props.js';
import { M, PETALS } from './materials.js';
import { mountChestTask } from './chest-task-ui.js';
import { createGuardian } from './guardian.js';
import { DUNGEON } from './maps/dungeon.js';
import { SURFACE } from './maps/surface.js';

// One page, two maps: the dungeon, and above ground (#surface). The stairs and the cave door lead between them.
const PLACE = place();          // 'surface' above ground; 'from-surface' back down through the cave
const map = PLACE === 'surface' ? SURFACE : DUNGEON;
const above = map === SURFACE;
document.body.classList.toggle('is-surface', above);
const $ = (id) => document.getElementById(id);

// The small map: floor light, what cannot be walked on darker, water, road, green, rock.
const MAP_COLOUR = { floor: '#d8cba6', grass: '#a9c47c', wall: '#4d463c', water: '#3f86bd', road: '#8f6d47', green: '#3f7a35', rock: '#8d8c85' };
const GREEN = new Set(['leaves', 'log']);
const ROCK = new Set(['stone', 'cobble', 'deep', 'grass']);
const streamTiles = new Set(map.things.filter((thing) => thing.kind === 'stream').flatMap((thing) => thing.tiles.map(([i, j]) => key(i, j))));

let props = null;                // the kinds made by code (props.js); `falls`: where water falls
const game = await createGame({
  map, place: PLACE,
  blocks: BLOCKS, stone: await chosenStone(),
  materials: M, paints: PAINTS,
  kinds: [KINDS, (stage) => (props = makeProps(stage, { above })).kinds],
  fields: () => props.fields,
  // What has happened so far, beside what the engine keeps (taken, here). The things of the map read it every frame (props.js).
  state: {
    doorOpen: false, chestOpen: false,
    chestShake: 0,                 // seconds left of the chest rattling after a wrong try
    chest2Seen: false, chest2Open: false,
    caveDoorOpen: true,            // above ground the cave door starts open, the hero comes out, it shuts
  },
  // Carried between the maps, each with the thing it belongs to: the dungeon keeps its open door and its seen chest after a trip up.
  save: { key: 'levacademy-dungeon-study-3', flags: { doorOpen: 'door', chest2Seen: 'chest2', chest2Open: 'chest2' } },
  // His body (not his clothes) is painted by the code. It can come from a skin sheet instead, when hero.js names one (HERO_SKIN).
  hero: {
    looks: HERO_LOOKS, faces: HERO_FACES, skin: HERO_SKIN && new URL(HERO_SKIN, import.meta.url),
    clothes: makeClothes, holdings: makeHoldings,
    stepSeconds: 0.276,            // time to walk one tile: an easy walk
    hurry: 1.5,                    // a double click: half as fast again
  },
  carriedLight: CARRIED_LIGHT,       // a torch in hand, or the magic cloak
  inventory: { items: ITEMS, slots: EQUIP, iconRows: ICON_ROWS, palette: PIXEL, start: START, text: INVENTORY_TEXT },
  // The magic wand and the bow.
  shots: { shooters: SHOOTERS, looks: (paintedBox) => ({ arrow: makeArrow(paintedBox) }), text: SHOOT_TEXT },
  text: TEXT,
  // What is this game's own about using a thing; the rest (where it is, what it says, what can be taken) is in the map.
  uses: {
    chest: { title: TEXT.chestTitle, text: TEXT.chestText, sheet: 'is-task', lift: 0.3 },      // the sheet of the task takes the lower part of the screen
    door: { title: TEXT.doorTitle, text: TEXT.doorText, onOpen: () => { if (!game.state.doorOpen) guardian.ask(); } },
  },
  minimap: {
    mark: MAP_COLOUR.floor,
    colour: ({ x, z, type, height, walk, road }) => (type === 'water' || streamTiles.has(key(x, z)) ? MAP_COLOUR.water
      : road ? MAP_COLOUR.road
        : walk ? (type === 'grass' ? MAP_COLOUR.grass : MAP_COLOUR.floor)
          : GREEN.has(type) ? MAP_COLOUR.green
            : above && height >= 2 && ROCK.has(type) ? MAP_COLOUR.rock : MAP_COLOUR.wall),
  },
  // A slider each. Perspective: 0 is the flat view. Tilt starts as the isometric view, and its steps are whole
  // degrees away from it. The effects go from 0 (off) to 100 and start low. A choice is remembered in this browser.
  settings: {
    prefix: 'dk-', labels: SETTINGS_TEXT,
    list: [
      { id: 'fov', min: 0, max: 60, start: 60, unit: '°' },
      { id: 'tilt', min: ISO_TILT - 15, max: ISO_TILT + 40, start: ISO_TILT, unit: '°' },
      { id: 'focus', min: 0, max: 100, start: 0 },        // a second drawing of the scene each frame: off unless chosen
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
    ],
  },
  // The look the settings tune: stone and water shine a little under the lights; big darker and lighter patches lie
  // over all the blocks. Above ground the leaves, the grass and the flowers sway in the wind, and the shadows of
  // clouds drift over everything that takes light.
  dress({ world, shading }) {
    for (const { material, name } of world.materials) {
      if (name === 'water') shading.dress(material, { shine: 1.6, gloss: 40, glint: true, clouds: above, patches: true });
      else shading.dress(material, { shine: WET_STONE.has(name) ? 0.6 : 0, gloss: 22, sway: above && name === 'leaves' ? 'tree' : undefined, clouds: above, patches: true });
    }
    if (!above) return;
    for (const material of Object.values(M)) if (material.isMeshLambertMaterial) shading.dress(material, { sway: material === M.blade ? 'tip' : undefined, clouds: true });
    for (const material of PETALS) shading.dress(material, { sway: 'whole', clouds: true });
  },
});
const { scene, level, fog, state, ui, inv, hero, walker, audio, things, cam } = game;
window.dkSkin = game.rig.skinTools;        // .sheet() / .guide() / .layout() give the hero's look as a skin sheet, to hand to an artist

// ---------- sound and music: made in the browser, started by the first press or key ----------
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
  for (let k = 0; k < things.torches.length; k++) if (things.torches[k].base > 0) nearest = Math.min(nearest, things.torches[k].at.distanceTo(hero.position));
  return Math.max(0, 1 - nearest / 7);
}
lookForWater(game.arrival.tile[0], game.arrival.tile[1]);

// ---------- life and clutter: specks in the air, small animals, things strewn about; the backdrop ----------
const specks = createSpecks({ scene, hero, torches: things.torches, falls: props.falls, water: waterNear, above });
const critters = createCritters({
  allowed: (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)) && fog.canEnter(i, j) && fog.regionOf(i, j) === state.here,
  tileY: game.tileY, hero,
});
addCritters({
  critters, scene, above,
  walkable: (i, j) => level.ground.has(key(i, j)) && !level.blocked.has(key(i, j)),
  flowers: new Set((level.spots.flowers ?? []).map(([x, z]) => x * 4096 + z)),
});
const details = createDetails({ scene, map, level, world: game.world, above, seen: (x, z) => fog.canEnter(x, z), dim: (x, z) => fog.regionOf(x, z) !== state.here });
const backdrop = createBackdrop($('backdrop'), map.backdrop);
let depth = 0;                   // how much the layers of the backdrop slide against the view: with the details
Object.assign(game.effects, {
  specks: (percent) => specks.setAmount(percent / 100),
  critters: (percent) => critters.show(Math.round((critters.count * percent) / 100)),
  details: (percent) => { depth = percent / 100; details.setDensity(depth); details.relight(); },
});

// ---------- the guardian and his door ----------
// The guardian's question was answered: the door slides down, the guardian steps aside, and the part of the
// dungeon behind it comes out of the dark.
function openDoor() {
  const door = map.things.find((thing) => thing.id === 'door');
  state.doorOpen = true;
  sounds.door();
  fog.open(door.opens);
  game.open(door.blocks);
  game.open(door.gate);
  game.shut(door.asideBlocks);
  ui.hide('door');
  ui.close();
}
const guardian = createGuardian({ panel: game.panel, asking: () => ui.closeUp === 'door' && !state.doorOpen, onRight: () => { if (!state.doorOpen) openDoor(); },
  onAnswer: (right) => (right ? sounds.right() : sounds.wrong()) });

// ---------- the bookkeeper's chest ----------
mountChestTask({
  onBack: ui.close,
  onFail: () => { state.chestShake = 0.35; sounds.rattle(); },
  onOpen: (isOpen) => { state.chestOpen = isOpen; if (isOpen) { sounds.chest(); sounds.coins(); } },
});
tear('#task', 73);
$('stone').textContent = TEXT.stone;

// ---------- what the game does when something happens ----------
Object.assign(game.on, {
  tile(tile, hurried) {            // he stepped onto a tile
    lookForWater(tile.i, tile.j);
    const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => waterTiles.has((tile.i + di) * 4096 + tile.j + dj));
    sounds.step(wet ? 'water' : STEP_ON[groundKind.get(key(tile.i, tile.j))] ?? 'stone', hurried);
  },
  take: () => sounds.equip(),
  box: () => sounds.chest(),
  shot: (look) => sounds.shot(look),
  hit: (look) => sounds.hit(look),
  equip: () => sounds.equip(),
  pick: () => sounds.pick(),
  click: () => sounds.click(),
  resize: () => backdrop.paint(),
  seen: () => details.relight(),   // more has been seen, or the hero is in another part
  frame(dt, t) {
    specks.update(dt, t);
    critters.update(dt, t);
    sounds.update(dt, t, torchNear(), waterNear.near);
    music.update(dt, (ui.closeUp === 'door' && !state.doorOpen) || Boolean(inv.boxOpen));
    backdrop.shift((cam.look.x - cam.look.z) * Math.SQRT1_2, (cam.look.x + cam.look.z) * Math.SQRT1_2, depth);
  },
  // Between the two maps: what was opened below is as it was left.
  restore(saved) {
    if (game.made.door && saved?.doorOpen) openDoor();
    if (game.made.chest2 && saved?.chest2Seen) { state.chest2Seen = true; ui.show('chest2'); }
    if (game.made.chest2 && saved?.chest2Open) state.chest2Open = true;
  },
  // He comes out of the cave: two steps out, then the door shuts behind him.
  arrive(arrival) { if (arrival.walkOut) setTimeout(() => { state.caveDoorOpen = false; }, 1500); },
});

game.start();
