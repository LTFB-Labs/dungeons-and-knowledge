// @ts-check
// A whole description of a game with everything left at its default: what createGame (../play.js) needs beside
// the map. A game made only of data spreads it and adds its map, its own kinds of things and what the hero has:
//   const game = await createGame({ ...defaults(), map: CAVE, save: { key: 'my-game' } });
//   game.start();
// Every part can be replaced by the game's own; the parts are in the files beside this one.
import { ISO_TILT } from '../camera.js';
import { KINDS as BLOCKS, WET_STONE, ownStone } from './blocks.js';
import { M } from './materials.js';
import { PAINTS } from './paints.js';
import { KINDS } from './kinds/index.js';
import { LIGHT_KINDS } from './lights.js';
import { HERO_LOOKS, HERO_FACES } from './hero.js';
import { makeClothes, makeHoldings, makeArrow } from './wear.js';
import { ITEMS, EQUIP, PIXEL, ICON_ROWS, SHOOTERS, CARRIED_LIGHT } from './items.js';
import { TEXT, SETTINGS_TEXT, INVENTORY_TEXT, SHOOT_TEXT } from './texts.js';
import { createSounds } from './sounds.js';

// The small map: floor light, what cannot be walked on dark, water blue.
const MAP_COLOUR = { floor: '#d8cba6', wall: '#4d463c', water: '#3f86bd' };

/** @returns {Record<string, any>} a new description every time, for createGame */
export function defaults() {
  return {
    blocks: BLOCKS, stone: ownStone(),
    materials: M, paints: PAINTS,
    kinds: [KINDS, LIGHT_KINDS],
    hero: { looks: HERO_LOOKS, faces: HERO_FACES, clothes: makeClothes, holdings: makeHoldings },
    carriedLight: CARRIED_LIGHT,
    inventory: { items: ITEMS, slots: EQUIP, iconRows: ICON_ROWS, palette: PIXEL, start: {}, text: INVENTORY_TEXT },
    shots: { shooters: SHOOTERS, looks: (paintedBox) => ({ arrow: makeArrow(paintedBox) }), text: SHOOT_TEXT },
    text: TEXT,
    sounds: ({ audio }) => createSounds({ audio, above: false }),
    minimap: { mark: MAP_COLOUR.floor, colour: ({ type, walk }) => (type === 'water' ? MAP_COLOUR.water : walk ? MAP_COLOUR.floor : MAP_COLOUR.wall) },
    // A slider each, for what the engine itself can tune. A choice is remembered in this browser, under `prefix`.
    settings: {
      prefix: 'game-', labels: SETTINGS_TEXT,
      list: [
        { id: 'fov', min: 0, max: 60, start: 60, unit: '°' },
        { id: 'tilt', min: ISO_TILT - 15, max: ISO_TILT + 40, start: ISO_TILT, unit: '°' },
        { id: 'focus', min: 0, max: 100, start: 0 },        // a second drawing of the scene each frame: off unless chosen
        { id: 'pool', min: 0, max: 100, start: 20 },
        { id: 'shine', min: 0, max: 100, start: 25 },
        { id: 'patches', min: 0, max: 100, start: 40 },
        { id: 'torchShadows', min: 0, max: 2, start: 2 },
        { id: 'shadowSize', min: 8, max: 10, start: 9, shown: (power) => String(2 ** power) },       // 256, 512 or 1024
        { id: 'map', toggle: true, start: 1, note: SETTINGS_TEXT.mapNote },
        { id: 'fps', toggle: true, start: 1 },
        { id: 'sound', min: 0, max: 100, start: 60 },
      ],
    },
    // Stone and water shine a little under the lights; big darker and lighter patches lie over all the blocks.
    dress({ world, shading }) {
      for (const { material, name } of world.materials) {
        if (name === 'water') shading.dress(material, { shine: 1.6, gloss: 40, glint: true, patches: true });
        else shading.dress(material, { shine: WET_STONE.has(name) ? 0.6 : 0, gloss: 22, patches: true });
      }
    },
  };
}
