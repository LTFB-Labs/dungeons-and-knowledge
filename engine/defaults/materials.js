// @ts-check
// The default materials of everything that is not a block (a part's `material`, by name): flat colour, or the same with a grey 16px texture.
import { pixelTexture } from '../textures.js';
import { lit, glowing } from '../boxes.js';

function drawStone(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 214 + Math.floor(r() * 3) * 10;
    if (r() < 0.035) v -= 40;                // pits
    if (x === 0 || y === 0) v = 246;          // lit edge
    if (x === 15 || y === 15) v = 165;        // shadow edge
    px(x, y, v);
  }
}
function drawWood(px, r) {
  for (let y = 0; y < 16; y++) {
    const row = 200 + Math.floor(r() * 3) * 14;
    for (let x = 0; x < 16; x++) {
      let v = row + (r() < 0.15 ? -30 : 0);
      if (y % 4 === 3) v = 125;               // gap between planks
      if (x === (y < 8 ? 5 : 11) && y % 4 !== 3) v -= 45;
      px(x, y, Math.max(90, v));
    }
  }
}
function drawGold(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 205 + ((x + y) % 5 === 0 ? 50 : 0) + Math.floor(r() * 2) * 10;
    if (x === 15 || y === 15) v = 150;
    px(x, y, Math.min(255, v));
  }
}
const textures = { stone: pixelTexture(drawStone), wood: pixelTexture(drawWood), gold: pixelTexture(drawGold) };

export const M = {
  stone: lit(0x7b7a66, textures.stone),
  stoneDark: lit(0x54533f, textures.stone),
  wood: lit(0x8a5a34, textures.wood),
  woodDark: lit(0x4c3122, textures.wood),
  iron: lit(0x2c2e3a),
  gold: lit(0xf2b01e, textures.gold),
  cloth: lit(0xa3262a),
  skin: lit(0xd9a074),
  hair: lit(0x5a3a22),
  tunic: lit(0x2f7fd9),
  trousers: lit(0x2a2f4a),
  pack: lit(0x8c4b2f),
  golem: lit(0x86856f, textures.stone),
  golemDark: lit(0x5d5c4d, textures.stone),
  moss: lit(0x636829),
  blade: lit(0x5c7d34),
  dark: lit(0x14141c),
  flame: glowing(0xff8a2a),
  flameCore: glowing(0xffe08a),
  goldGlow: glowing(0xffd35a),
  teal: glowing(0x8fe6dc),
  rune: glowing(0xb07cff),
  marker: glowing(0xffd35a),
  markerFar: glowing(0xff5a4d),
};
// Brighter than white, so the bloom picks them up.
[[M.flame, 1.0], [M.flameCore, 1.1], [M.goldGlow, 0.95], [M.teal, 0.85], [M.rune, 1.0], [M.marker, 1.0]]
  .forEach(([material, boost]) => material.color.multiplyScalar(boost));

export const PETALS = [0xf2c81e, 0xe0483e, 0xf1eee6, 0xff8fb0].map((colour) => lit(colour));
