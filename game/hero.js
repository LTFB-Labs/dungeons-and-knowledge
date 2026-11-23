// @ts-check
// The hero himself: the engine's default boy in a white T-shirt and shorts (a skin sheet can paint him instead, see
// HERO_SKIN below). Everything else he has on is an item (engine/defaults/wear.js).
export * from '../engine/defaults/hero.js';

// His body can come from a skin sheet instead (skins/README.md). Off by default: the code paints him.
// To turn a skin on, name its layout here: '../skins/hero.json' (the shipped one is kept as hero.json.off).
export const HERO_SKIN = null;
