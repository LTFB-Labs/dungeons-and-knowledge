// @ts-check
// The default kinds of block: a 16 x 16 texture for each, painted right here, and a flat colour.
// They are our own, in the spirit of block-building games: several stones, grass, dirt, wood, a roof.
// A game hands KINDS to createGame as `blocks` and ownStone() as `stone`, or gives its own.
import { paint, mute, shadeOf, blotches, quieter, family, stoneMap } from '../textures.js';
import { whole } from '../random.js';
import { paintStone } from './own-stone.js';

// Palettes after a stone tileset the owner likes: few shades, olive-warm greys,
// shadows that lean brown, light that leans yellow. Dark to light.
export const STONE = ['#4b4a3e', '#5d5c4d', '#70705d', '#86856f', '#9e9d85', '#b3b199'];
export const BROWN = ['#3c2d24', '#4c3a2e', '#5e493a', '#715947', '#866b56', '#9b7f68'];
export const PALE = ['#8a7f76', '#a0958b', '#b5aa9f', '#c9beb3', '#dbd1c6', '#e9e1d7'];
export const GAP = new Map([[STONE, mute('#58574b', 0.45)], [BROWN, mute('#44342b', 0.35)], [PALE, mute('#958a81', 0.4)]]);   // the joint between stones
export const DIRT = ['#4a3626', '#5a4330', '#6a503a', '#7a5d45', '#8a6b51'];
export const GREEN = ['#3f5c26', '#4d6c2c', '#5c7d34', '#6d8e3e', '#80a04a'];
export const MOSS = ['#4f5422', '#636829', '#787e33'];
[[STONE, 0.45], [BROWN, 0.35], [PALE, 0.4], [DIRT, 0.3], [GREEN, 0.25], [MOSS, 0.3]]
  .forEach(([palette, amount]) => palette.forEach((colour, k) => { palette[k] = mute(colour, amount); }));

// Rough wall of small flat stones: four courses, each stone lit on top and shaded below.
function paintRubble(px, r, palette) {
  const gap = GAP.get(palette);
  for (let course = 0; course < 4; course++) {
    const y0 = course * 4;
    let x = whole(r, 4);
    const end = x + 16;
    while (x < end) {
      let width = 3 + whole(r, 4);
      if (end - x - width - 1 < 3) width = end - x - 1;             // the last stone takes what is left
      const tone = 1.7 + r() * 1.9;
      for (let k = 0; k < width; k++) {
        px(x + k, y0, shadeOf(palette, tone + 1));
        px(x + k, y0 + 1, shadeOf(palette, tone + (r() < 0.25 ? (r() < 0.5 ? -0.8 : 0.8) : 0)));
        px(x + k, y0 + 2, shadeOf(palette, tone - 0.7));
      }
      for (let k = 0; k < 3; k++) px(x + width, y0 + k, gap);
      x += width + 1;
    }
    for (let k = 0; k < 16; k++) px(k, y0 + 3, r() < 0.2 ? palette[1] : gap);   // an uneven joint under the course
  }
}

// Dressed blocks of mixed sizes. Each row lists [x, width]; one joint pixel follows every block.
const BRICK_LAYOUTS = [
  [[[0, 10], [11, 4]], [[0, 5], [6, 9]]],
  [[[0, 6], [7, 8]], [[0, 15]]],
  [[[0, 15]], [[0, 7], [8, 7]]],
];
function paintBricks(px, r, palette, layout, { moss = false, crack = false } = {}) {
  const gap = GAP.get(palette);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, gap);
  layout.forEach((row, k) => row.forEach(([x0, width]) => {
    const y0 = k * 8;
    const tone = 2.3 + (r() - 0.5) * 1.1;
    for (let y = 0; y < 7; y++) for (let x = 0; x < width; x++) {
      let shade = tone;
      if (y === 0) shade += 1.5; else if (x === 0) shade += 0.7;           // light catches the top and left edge
      if (y === 6) shade -= 0.8; else if (x === width - 1) shade -= 0.4;   // shadow under and to the right
      px(x0 + x, y0 + y, shadeOf(palette, shade));
    }
    // Short level strokes on the face, the way a chisel leaves them.
    for (let n = 0, strokes = 1 + whole(r, 2) + (width > 8 ? 1 : 0); n < strokes; n++) {
      const length = 2 + whole(r, 3);
      const sx = 1 + whole(r, Math.max(1, width - length - 1));
      const sy = 2 + whole(r, 3);
      for (let m = 0; m < length; m++) px(x0 + sx + m, y0 + sy, shadeOf(palette, tone + (sy < 4 ? 0.9 : -0.9)));
    }
  }));
  if (moss) {                                          // moss hangs from the joints in small drips
    for (const y0 of [7, 15]) for (let n = 0, drips = 1 + whole(r, 3); n < drips; n++) {
      let x = whole(r, 16);
      let width = 3 + whole(r, 3);
      for (let k = -1; k <= width; k++) px(x + k, y0, MOSS[1]);
      for (let depth = 1; width > 0 && depth < 5; depth++) {
        for (let k = 0; k < width; k++) px(x + k, y0 + depth, MOSS[depth === 1 ? 2 : k === 0 ? 0 : 1]);
        x += 1;
        width -= 1 + whole(r, 2);
      }
    }
  }
  if (crack) {                                         // one crack with a short branch
    let x = 4 + whole(r, 8);
    for (let y = 1; y < 13; y++) {
      px(x, y, gap);
      if (y === 6) { px(x + 1, y, gap); px(x + 2, y + 1, gap); px(x + 3, y + 1, gap); }
      if (r() < 0.55) x += r() < 0.5 ? -1 : 1;
    }
  }
}
// One big dressed block: for wall tops and the edges of the slab.
function paintSlab(px, r, palette) {
  const n = blotches(r);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let shade = 2.5 + (n(x, y) - 0.5) * 1.6;
    if (y === 0 || x === 0) shade = 4.4; else if (y === 1 || x === 1) shade += 0.6;
    if (y === 15 || x === 15) shade = 1.3; else if (y === 14 || x === 14) shade -= 0.5;
    px(x, y, shadeOf(palette, shade));
  }
  for (let k = 0; k < 4; k++) {
    const length = 2 + whole(r, 4), sx = 3 + whole(r, 8), sy = 3 + whole(r, 10);
    for (let m = 0; m < length; m++) px(sx + m, sy, shadeOf(palette, sy < 8 ? 3.6 : 1.6));
  }
}
// A carved floor tile: a frame cut into the stone, with a small square sign in the middle.
function paintCarved(px, r, palette) {
  const light = (x, y) => px(x, y, palette[4]);
  const cut = (x, y) => px(x, y, palette[1]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let shade = 2.7 + (r() - 0.5) * 0.7;
    if (y === 0 || x === 0) shade = 4.6;
    if (y === 15 || x === 15) shade = 1.5;
    px(x, y, shadeOf(palette, shade));
  }
  // Each groove is a dark line with a lit line just below and right of it.
  const frame = (from, to, paintAt, shift) => {
    for (let k = from; k <= to; k++) {
      paintAt(k + shift, from + shift); paintAt(k + shift, to + shift);
      paintAt(from + shift, k + shift); paintAt(to + shift, k + shift);
    }
  };
  frame(3, 12, light, 1); frame(3, 12, cut, 0);
  frame(6, 9, light, 1); frame(6, 9, cut, 0);
  px(7, 7, palette[3]); px(8, 7, palette[3]); px(7, 8, palette[3]); px(8, 8, palette[2]);
}
function paintDirt(px, r) {
  const n = blotches(r);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    px(x, y, shadeOf(DIRT, 2 + (n(x, y) - 0.5) * 4.5 + (r() - 0.5) * 1.3));
  }
  for (let k = 0; k < 3; k++) px(whole(r, 16), 5 + whole(r, 10), '#8b877f');           // pebbles
}
function paintGrassTop(px, r) {
  const n = blotches(r);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    px(x, y, shadeOf(GREEN, 2 + (n(x, y) - 0.5) * 4 + (r() - 0.5) * 1.8));
  }
  for (let k = 0; k < 4; k++) px(whole(r, 16), whole(r, 16), '#93b35a');
}
function paintGrassSide(px, r) {
  paintDirt(px, r);
  for (let x = 0; x < 16; x++) {                       // grass hangs over the edge, uneven
    const depth = 2 + whole(r, 3);
    for (let y = 0; y < depth; y++) px(x, y, y === 0 ? GREEN[3 + whole(r, 2)] : y === depth - 1 ? GREEN[0] : GREEN[1 + whole(r, 2)]);
  }
}
const BARK = ['#4a3320', '#5b3f27', '#6b4a2e', '#7d5a3a'];
const LEAF = ['#2f5220', '#3c6627', '#4a7a2f', '#5a8f38', '#6ea545'];
const PLANK = ['#6b4d2f', '#7c5b38', '#8d6942', '#9e784c', '#ae8656'];
const SHINGLE = ['#6f3122', '#843b27', '#9a472d', '#ad5435', '#bf6340'];
const STRAW = ['#a9892a', '#c2a238', '#d8bb4a', '#ead162'];
const POND = ['#2d5f86', '#3a7299', '#4b88ad', '#74aac8'];
function paintBark(px, r) {
  for (let x = 0; x < 16; x++) {
    const base = 1 + whole(r, 2);
    for (let y = 0; y < 16; y++) px(x, y, shadeOf(BARK, base + (r() < 0.2 ? 1 : 0) - (r() < 0.15 ? 1 : 0)));
  }
  for (let k = 0; k < 4; k++) { const x = whole(r, 16), y = whole(r, 10); for (let n = 0; n < 5; n++) px(x, y + n, BARK[0]); }
}
function paintRings(px) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    px(x, y, ring > 7 ? BARK[1] : Math.floor(ring) % 2 ? '#b08a5a' : '#9a7648');
  }
}
function paintLeaves(px, r) {
  const n = blotches(r);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shadeOf(LEAF, 2 + (n(x, y) - 0.5) * 5 + (r() - 0.5) * 1.6));
  for (let k = 0; k < 9; k++) px(whole(r, 16), whole(r, 16), LEAF[0]);
}
function paintPlanks(px, r) {
  for (let y = 0; y < 16; y++) {
    const plank = Math.floor(y / 4);
    for (let x = 0; x < 16; x++) {
      let shade = 2 + (plank % 2 ? 0.6 : 0) + (r() < 0.18 ? -1 : 0);
      if (y % 4 === 3 || x === (plank * 5 + 3) % 16) shade = 0;
      else if (y % 4 === 0) shade += 1;
      px(x, y, shadeOf(PLANK, shade));
    }
  }
}
function paintRoof(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const course = Math.floor(y / 4);
    const gap = (x + course * 2) % 4 === 3;
    let shade = 2 + (r() < 0.2 ? 1 : 0);
    if (y % 4 === 0) shade += 1;
    if (y % 4 === 3 || gap) shade = 0;
    px(x, y, shadeOf(SHINGLE, shade));
  }
}
function paintDoor(px, r) {
  paintPlanks(px, r);
  for (let y = 0; y < 16; y++) for (let x = 3; x < 13; x++) px(x, y, x === 3 || x === 12 || y === 0 ? '#3a2618' : (x + 1) % 3 === 0 ? '#4c3122' : '#5c3d2a');
  px(10, 9, '#e3ac2a'); px(10, 10, '#a87a16');
}
function paintWindow(px, r) {
  paintPlanks(px, r);
  for (let y = 4; y < 13; y++) for (let x = 4; x < 12; x++) {
    const frame = y === 4 || y === 12 || x === 4 || x === 11 || x === 8 || y === 8;
    px(x, y, frame ? '#3a2618' : y < 7 && x < 7 ? '#cfe7f0' : '#8fbcd2');
  }
}
function paintHay(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shadeOf(STRAW, 1.5 + (r() - 0.5) * 2.6));
  for (let k = 0; k < 14; k++) { const x = whole(r, 16), y = whole(r, 16); for (let n = 0; n < 4; n++) px(x + n, y, STRAW[0]); }
  for (const x of [4, 11]) for (let y = 0; y < 16; y++) px(x, y, '#7a5a2a');
}
function paintPond(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, POND[1 + (r() < 0.2 ? 1 : 0) - (r() < 0.12 ? 1 : 0)]);
  for (let k = 0; k < 8; k++) { const x = whole(r, 16), y = whole(r, 16); for (let n = 0; n < 3 + whole(r, 3); n++) px(x + n, y, POND[3]); }
}
function paintSand(px, r) {
  const n = blotches(r);
  const SAND = ['#b9a06a', '#c9b27a', '#d7c28b', '#e3d19c'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shadeOf(SAND, 1.5 + (n(x, y) - 0.5) * 3 + (r() - 0.5) * 1.2));
}
function paintCrops(px, r) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ridge = y % 4 < 2;
    px(x, y, ridge ? (x % 3 === 1 && r() < 0.8 ? LEAF[3 + whole(r, 2)] : DIRT[1]) : DIRT[0]);
  }
}
// Stones come in two pictures each, so a wall is not the same block over and over.
const HAS_TWIN = new Set(['stone', 'cobble', 'bricks', 'mossy', 'dark', 'night']);
const BLOCK_TEXTURE = {
  stone: paint(1, (px, r) => paintSlab(px, r, STONE)), stoneB: paint(21, (px, r) => paintSlab(px, r, STONE)),
  cobble: paint(2, (px, r) => paintRubble(px, r, STONE)), cobbleB: paint(22, (px, r) => paintRubble(px, r, STONE)),
  bricks: paint(3, (px, r) => paintBricks(px, r, STONE, BRICK_LAYOUTS[0])),
  bricksB: paint(23, (px, r) => paintBricks(px, r, STONE, BRICK_LAYOUTS[1])),
  mossy: paint(4, (px, r) => paintBricks(px, r, STONE, BRICK_LAYOUTS[0], { moss: true })),
  mossyB: paint(24, (px, r) => paintBricks(px, r, STONE, BRICK_LAYOUTS[2], { moss: true })),
  cracked: paint(5, (px, r) => paintBricks(px, r, STONE, BRICK_LAYOUTS[2], { crack: true })),
  tile: paint(6, (px, r) => paintCarved(px, r, PALE)), tileSide: paint(26, (px, r) => paintSlab(px, r, PALE)),
  deep: paint(7, (px, r) => paintRubble(px, r, BROWN)), dirt: paint(8, paintDirt),
  dark: paint(31, (px, r) => paintBricks(px, r, BROWN, BRICK_LAYOUTS[0])), darkB: paint(32, (px, r) => paintBricks(px, r, BROWN, BRICK_LAYOUTS[1])),
  night: paint(33, (px, r) => paintRubble(px, r, BROWN)), nightB: paint(34, (px, r) => paintRubble(px, r, BROWN)),
  grassTop: paint(9, paintGrassTop), grassSide: paint(10, paintGrassSide),
  logSide: paint(41, paintBark), logTop: paint(42, paintRings), leaves: paint(43, paintLeaves), planks: paint(44, paintPlanks),
  roof: paint(45, paintRoof), door: paint(46, paintDoor), window: paint(47, paintWindow), hay: paint(48, paintHay),
  water: paint(49, paintPond), cropTop: paint(50, paintCrops), sand: paint(51, paintSand),
};
// The flat colour of each: its average.
const FLAT = {
  stone: 0x7b7a66, stoneB: 0x7b7a66, cobble: 0x6c6b59, cobbleB: 0x6c6b59, bricks: 0x73725f, bricksB: 0x73725f,
  mossy: 0x6d6f52, mossyB: 0x6d6f52, cracked: 0x6f6e5b, tile: 0xb9aea3, tileSide: 0xb5aa9f, deep: 0x554235, dirt: 0x6a503a,
  grassTop: 0x5c7d34, grassSide: 0x64563a, dark: 0x5e493a, darkB: 0x5e493a, night: 0x3c2d24, nightB: 0x3c2d24,
  logSide: 0x6b4a2e, logTop: 0xa58050, leaves: 0x4a7a2f, planks: 0x8d6942, roof: 0x9a472d, door: 0x5c3d2a, window: 0x8d6942,
  hay: 0xd8bb4a, water: 0x3a7299, cropTop: 0x5a4330, sand: 0xd0bb83,
};
// Some kinds of block wear one picture on their sides and another on top.
const SIDE_OF = { grass: 'grassSide', tile: 'tileSide', log: 'logSide', well: 'cobble', crop: 'dirt' };
const TOP_OF = { grass: 'grassTop', log: 'logTop', well: 'water', crop: 'cropTop', door: 'planks', window: 'planks' };

/** What the engine's world needs to know about the blocks. */
export const KINDS = { textures: BLOCK_TEXTURE, flat: FLAT, sideOf: SIDE_OF, topOf: TOP_OF, twins: HAS_TWIN };

// Stone blocks that take stone and shine a little under the lights (a game's `dress` may use it).
export const WET_STONE = new Set(['stone', 'stoneB', 'cobble', 'cobbleB', 'bricks', 'bricksB', 'mossy', 'mossyB', 'cracked', 'tile', 'deep', 'dark', 'darkB', 'night', 'nightB']);

/** The textures of the stone blocks, by kind: `sample` ({ name: rows }, a stone of the game's own), or our own stone (own-stone.js), light and quieter. */
export function ownStone(sample = null) {
  return stoneMap(family(quieter(sample ?? paintStone().pale, 0.5), sample ? 500 : 600));
}
