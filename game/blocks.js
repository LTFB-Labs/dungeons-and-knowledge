// @ts-check
// The kinds of block of this game: the engine's default ones (several stones, grass, dirt, wood, a roof), and the
// stone the owner chose.
import { ownStone } from '../engine/defaults/blocks.js';

export { KINDS, WET_STONE, STONE, BROWN, PALE, GAP, DIRT, GREEN, MOSS } from '../engine/defaults/blocks.js';

// The stone: the owner's choice, light and quieter. It is cut from someone else's tileset (stone-sample.js), so it is
// used only where that file is (at home); publish.sh leaves it out until there is a licence, and the published game
// paints its own stone in the same spirit (engine/defaults/own-stone.js).
/** The textures of the stone blocks, by kind. */
export async function chosenStone() {
  return ownStone(await import('../stone-sample.js').then((module) => module.SAMPLE.pale, () => null));
}
