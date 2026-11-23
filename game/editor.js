// @ts-check
// What the map editor of the engine (engine/editor/) needs to show this game's maps as the game shows them:
// which maps there are, and the same blocks, materials, paints and kinds of things main.js hands to createGame.
// Open: http://127.0.0.1:8789/editor/?game=dungeons-and-knowledge&map=dungeon
import { KINDS as BLOCKS, WET_STONE, chosenStone } from './blocks.js';
import { KINDS } from './kinds/index.js';
import { PAINTS } from './paints.js';
import { makeProps } from './props.js';
import { M, PETALS } from './materials.js';

export const EDITOR = {
  title: 'D&K',
  // `file`: from app/; `play`: what is added to the game's address to open it on this map
  maps: {
    dungeon: { file: 'game/maps/dungeon.js', play: '' },
    surface: { file: 'game/maps/surface.js', play: '#surface' },
  },
  /** For one map: what createGame gets as blocks, stone, materials, paints, kinds, fields, state and dress. */
  async config(map) {
    const above = map.name === 'surface';
    let props = null;
    return {
      blocks: BLOCKS, stone: await chosenStone(),
      materials: M, paints: PAINTS,
      kinds: [KINDS, (stage) => (props = makeProps(stage, { above })).kinds],
      fields: () => props.fields,
      state: { doorOpen: false, chestOpen: false, chestShake: 0, chest2Seen: false, chest2Open: false, caveDoorOpen: !above },
      dress({ world, shading }) {
        for (const { material, name } of world.materials) {
          if (name === 'water') shading.dress(material, { shine: 1.6, gloss: 40, glint: true, clouds: above, patches: true });
          else shading.dress(material, { shine: WET_STONE.has(name) ? 0.6 : 0, gloss: 22, sway: above && name === 'leaves' ? 'tree' : undefined, clouds: above, patches: true });
        }
        if (!above) return;
        for (const material of Object.values(M)) if (material.isMeshLambertMaterial) shading.dress(material, { sway: material === M.blade ? 'tip' : undefined, clouds: true });
        for (const material of PETALS) shading.dress(material, { sway: 'whole', clouds: true });
      },
    };
  },
};
