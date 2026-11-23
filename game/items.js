// @ts-check
// The things the hero can have: the engine's default ones (what each is called and does, where it is worn, its
// picture, what shoots), and what he starts with here.
export { ITEMS, EQUIP, PIXEL, ICON_ROWS, SHOOTERS, CARRIED_LIGHT } from '../engine/defaults/items.js';

// What he has at the very start: [item, count] in each place.
export const START = {
  // he starts with torches in his right hand, and in poor brown clothes
  equip: { back: ['cloak'], chest: ['shirt'], legs: ['pants'], feet: ['shoes'] },       // no torch: he takes one off the wall by the guardian
  bag: {
    0: ['helmet'], 1: ['chest'], 2: ['legs'], 3: ['boots'], 4: ['sword'], 5: ['tnt', 5],
    9: ['bread', 3], 10: ['potion', 2], 11: ['key'], 12: ['bow'],
    18: ['tunic'], 19: ['trousers'], 20: ['leatherBoots'], 21: ['pack'],
  },
  box: { 0: ['wizardHat'], 1: ['wizardRobe'], 2: ['wizardBoots'], 3: ['wand'], 4: ['magicCloak'] },      // the chest in the far chamber
};
