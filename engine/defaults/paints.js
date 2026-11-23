// @ts-check
// Paint recipes by name, for the default kinds of things (kinds/): what several of them share (see ../paints.js for the steps).
import { IRON } from './hero.js';

const GREEN = '#6f9a3a', GREEN_LIGHT = '#86b04a', GREEN_DARK = '#55772b';
const RAG = '#6b4a2e', RAG_LIGHT = '#7f5a39', RAG_DARK = '#4e341f';
const WOOD = '#4a2c1a', WOOD_LIGHT = '#6b3f24';
export const GOLD = '#e3ac2a', GOLD_LIGHT = '#ffd35a', GOLD_DARK = '#a87a16';

/** A game hands these to createGame as `paints`, with its own beside them. */
export const PAINTS = {
  // goblins
  goblinSkin: [['fill', GREEN], ['speckle', GREEN_LIGHT, 0.1], ['speckle', GREEN_DARK, 0.08], ['row', 'h - 1', GREEN_DARK]],
  rag: [['fill', RAG], ['speckle', RAG_LIGHT, 0.12], ['each', 'x', 0, 'w', 2, [['px', 'x', 'h - 1', RAG_DARK]]], ['column', 'w - 1', RAG_DARK]],      // with a torn hem
  goblinPants: [['fill', '#4a3a2a'], ['row', 'h - 1', '#372a1e']],
  // armour: `metal` is the plate of the thing's `suit` ('iron', 'rusty' or 'royal')
  ironPlate: ['use', 'iron', { base: IRON[2], fleck: IRON[1], light: IRON[4], lit: IRON[3], dark: IRON[0] }],
  rustyPlate: [['use', 'ironPlate'], ['speckle', '#8a5a34', 0.12], ['speckle', '#6b4a2e', 0.06]],
  royalPlate: [['use', 'ironPlate'], ['row', 0, GOLD_LIGHT], ['row', 'h - 1', GOLD_DARK], ['column', 0, GOLD], ['column', 'w - 1', GOLD_DARK]],      // a gilded edge
  metal: ['when', { suit: 'royal' }, 'royalPlate', ['when', { suit: 'rusty' }, 'rustyPlate', 'ironPlate']],
  mail: [['fill', IRON[1]], ['each', 'j', 0, 'h', 1, [['each', 'i', 'j % 2', 'w', 2, [['px', 'i', 'j', IRON[0]]]]]]],
  // dark wood: plain for stands, with a gold trim for the throne
  standWood: ['use', 'wood', { base: WOOD, light: WOOD_LIGHT }],
  throneWood: [['fill', WOOD], ['speckle', WOOD_LIGHT, 0.12], ['use', 'trim', { light: GOLD, dark: GOLD_DARK }]],
  gold: ['use', 'edged', { base: GOLD, light: GOLD_LIGHT, dark: GOLD_DARK }],
};
