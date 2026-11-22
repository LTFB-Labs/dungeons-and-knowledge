// @ts-nocheck
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { SURFACE_MAP } from './surface-map.js';
// One page, two maps: the dungeon, and above ground (?map=surface). The stairs and the cave door lead between them.
const PLACE = location.hash.slice(1);         // '#surface' above ground; '#from-surface' back down through the cave
const MAP = PLACE === 'surface' ? 'surface' : 'dungeon';
const CAME_DOWN = PLACE === 'from-surface';     // came in through the cave, down the stairs
document.body.classList.toggle('is-surface', MAP === 'surface');
import { createGame, TASK, DIAL_SIZE, formatNumber, segmentShare, chipById } from './chest-task.js';
import { paintStone } from './own-stone.js';

// D&K: Dungeons and Knowledge. A dungeon and the land above it, made only of boxes, light and glow.
// Grown out of the look study in ideas/razseyaniyat-schetovoditel-looks/dungeon.html.

const TEXT = {
  hint: 'Щракни плочка (двоен клик: бързо). Или ↑ напред, ← → завой, ↓ кръгом (Shift: бързо, E: отвори). Колелцето приближава.',
  hintShoot: 'В ръката ти е нещо, което стреля: интервалът (или десен клик) стреля към показалеца.',
  styleFlat: 'Вид: гладки кубчета',
  styleTextured: 'Вид: с текстури',
  chestTitle: 'Сандъкът',
  chestText: 'Тук се отваря близкият екран със задачата: ключалка с колела.',
  doorTitle: 'Пазителят на вратата',
  doorText: 'Пазителят пита.',
  doorRight: 'Вярно! Пазителят се отмества.',
  doorWrong: 'Не е това. Пазителят пита друго.',
  chest2Title: 'Сандък',
  chest2Text: 'Какво има в сандъка.',
};

// What the guardian asks. One at random; only the right answer opens the door.
const QUESTIONS = [
  { ask: 'Живеем върху скала, която лети през космоса и се казва Земя. Коя поред е тя от Слънцето?', answers: ['Първа', 'Втора', 'Трета', 'Четвърта'], right: 2 },
  { ask: 'Земята се върти около себе си като пумпал. За колко часа прави едно пълно завъртане?', answers: ['12 часа', '24 часа', '60 часа', '100 часа'], right: 1 },
  { ask: 'Светлината е най-бързото нещо на света, а пак ѝ трябва време да стигне от Слънцето до нас. Колко?', answers: ['8 секунди', '8 минути', '8 часа', '8 дни'], right: 1 },
  { ask: 'Пчелите строят питите си от малки килийки с равни стени. Колко стени има една килийка?', answers: ['3', '4', '6', '8'], right: 2 },
  { ask: 'Октоподът има осем пипала и повече от едно сърце. Колко сърца има?', answers: ['1', '2', '3', '8'], right: 2 },
];

const W = 10;            // room size in tiles, along x
const D = 8;             // and along z
const STEP_SECONDS = 0.276;     // time to walk one tile: an easy walk
const HURRY = 1.5;              // a double click: half as fast again

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(11);
const pick = (list) => list[Math.floor(rand() * list.length)];

// ---------- renderer, camera ----------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));       // sharp enough for pixel art, and far less to draw
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();

// Fixed isometric view: no perspective, no rotation. Only zoom and slide.
const ISO_OFFSET = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(40);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const HOME = new THREE.Vector3((W - 1) / 2 - 0.9, 0.9, (D - 1) / 2 - 0.9);
const look = HOME.clone();
const lookGoal = HOME.clone();
let zoom = 1;
let zoomGoal = 1;

// Bright things bleed light into what is around them.

// The backdrop: a far cave wall in big dark pixels, with rock columns hanging from the roof and
// rising from below, and a faint haze in the middle. Painted once per screen size, from a fixed seed.
const backdrop = document.getElementById('backdrop');
function paintBackdrop() {
  const w = 200;
  const h = Math.max(80, Math.round((w * (window.innerHeight + 80)) / (window.innerWidth + 80)));
  backdrop.width = w;
  backdrop.height = h;
  const ctx = backdrop.getContext('2d');
  const r = mulberry32(77);
  if (MAP === 'surface') {                                                   // a blue sky in big pixels, with blocky clouds
    const SKY = ['#6fa8dc', '#7cb3e2', '#8bbde6', '#9cc7ea', '#aed2ee', '#c2dcf1'];
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = SKY[Math.min(5, Math.floor((y / h) * 6))]; ctx.fillRect(0, y, w, 2); }
    for (let c = 0; c < 10; c++) {
      const cx = Math.floor(r() * w), cy = 4 + Math.floor(r() * h * 0.7), cw = 14 + Math.floor(r() * 22);
      ctx.fillStyle = '#f4f8fb';
      ctx.fillRect(cx, cy, cw, 4); ctx.fillRect(cx + 3, cy - 3, cw - 8, 3); ctx.fillRect(cx + 6, cy - 5, Math.max(4, cw - 16), 2);
      ctx.fillStyle = '#d5e2ed';
      ctx.fillRect(cx, cy + 4, cw, 2);
    }
    return;
  }
  const SHADES = ['#0b0a09', '#100e0c', '#14120f', '#191613', '#1e1b17', '#24201b'];
  const cell = 6;                                                            // value noise on a coarse grid: the far rock
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => r());
  const at = (gx, gy) => grid[Math.min(gh - 1, gy) * gw + Math.min(gw - 1, gx)];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
    const mid = 1 - Math.abs(y / h - 0.52) * 1.6;                            // lighter towards the middle band
    const k = Math.max(0, Math.min(SHADES.length - 1, Math.round(v * 2.2 + mid * 2.4 - 0.6 + (r() - 0.5) * 0.5)));
    ctx.fillStyle = SHADES[k];
    ctx.fillRect(x, y, 2, 2);
  }
  const column = (x, width, length, fromTop, shade) => {
    for (let k = 0; k < length; k += 3) {
      const narrow = Math.floor((k / length) * width * 0.8);
      const left = x + Math.floor(narrow / 2) + (r() < 0.3 ? 1 : 0);
      const span = Math.max(2, width - narrow);
      ctx.fillStyle = shade;
      ctx.fillRect(left, fromTop ? k : h - k - 3, span, 3);
      ctx.fillStyle = '#211d19';                                             // a lit edge on one side
      ctx.fillRect(left, fromTop ? k : h - k - 3, 1, 3);
    }
  };
  for (let x = 4; x < w; x += 10 + Math.floor(r() * 18)) column(x, 4 + Math.floor(r() * 9), h * (0.12 + r() * 0.22), true, r() < 0.5 ? '#080706' : '#0a0908');
  for (let x = 2; x < w; x += 14 + Math.floor(r() * 22)) column(x, 6 + Math.floor(r() * 12), h * (0.1 + r() * 0.2), false, r() < 0.5 ? '#080706' : '#0a0908');
  const haze = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.55);
  haze.addColorStop(0, 'rgba(120, 96, 70, .10)');
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
}
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  paintBackdrop();
  const aspect = w / h;
  const halfH = Math.max(7.4, 8.4 / aspect);
  camera.left = -halfH * aspect; camera.right = halfH * aspect;
  camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- materials: flat colour, or the same with a 16px texture ----------

function pixelTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const r = mulberry32(draw.name.length * 97);
  const px = (x, y, v) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 1, 1); };
  draw(px, r);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
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

// Coloured 16x16 block textures, painted right here. They are our own,
// in the spirit of block-building games: several stones, grass, dirt.
function paint(seed, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const r = mulberry32(seed);
  const wrap = (n) => ((n % 16) + 16) % 16;
  const grid = Array.from({ length: 16 }, () => Array(16).fill('#000000'));
  const px = (x, y, colour) => { grid[wrap(y)][wrap(x)] = colour; };
  draw(px, r);
  grid.forEach((row, y) => row.forEach((colour, x) => { ctx.fillStyle = colour; ctx.fillRect(x, y, 1, 1); }));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// Palettes after a stone tileset the owner likes: few shades, olive-warm greys,
// shadows that lean brown, light that leans yellow. Dark to light.
const STONE = ['#4b4a3e', '#5d5c4d', '#70705d', '#86856f', '#9e9d85', '#b3b199'];
const BROWN = ['#3c2d24', '#4c3a2e', '#5e493a', '#715947', '#866b56', '#9b7f68'];
const PALE = ['#8a7f76', '#a0958b', '#b5aa9f', '#c9beb3', '#dbd1c6', '#e9e1d7'];
const GAP = new Map([[STONE, mute('#58574b', 0.45)], [BROWN, mute('#44342b', 0.35)], [PALE, mute('#958a81', 0.4)]]);   // the joint between stones
const DIRT = ['#4a3626', '#5a4330', '#6a503a', '#7a5d45', '#8a6b51'];
const GREEN = ['#3f5c26', '#4d6c2c', '#5c7d34', '#6d8e3e', '#80a04a'];
const MOSS = ['#4f5422', '#636829', '#787e33'];
// Pull every colour part of the way towards grey: the owner wanted the blocks less colourful.
function mute(hex, amount) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  return `#${[r, g, b].map((c) => Math.round(c + (grey - c) * amount).toString(16).padStart(2, '0')).join('')}`;
}
[[STONE, 0.45], [BROWN, 0.35], [PALE, 0.4], [DIRT, 0.3], [GREEN, 0.25], [MOSS, 0.3]]
  .forEach(([palette, amount]) => palette.forEach((colour, k) => { palette[k] = mute(colour, amount); }));
const shadeOf = (palette, k) => palette[Math.max(0, Math.min(palette.length - 1, Math.round(k)))];
const whole = (r, n) => Math.floor(r() * n);

// Soft blotches, 0..1, that repeat cleanly at the edges of the 16x16 square.
function blotches(r) {
  const lattice = (n) => Array.from({ length: n * n }, () => r());
  const coarse = lattice(4);
  const fine = lattice(8);
  const sample = (grid, n, x, y) => {
    const fx = (x / 16) * n, fy = (y / 16) * n;
    const x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = grid[y0 * n + x0] * (1 - tx) + grid[y0 * n + x1] * tx;
    const b = grid[y1 * n + x0] * (1 - tx) + grid[y1 * n + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
  return (x, y) => sample(coarse, 4, x, y) * 0.6 + sample(fine, 8, x, y) * 0.4;
}

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

// One material per block texture. Textured: the picture. Flat: its average colour.
// The room mesh carries a brightness for every corner, so these use vertex colours.
const blockMaterials = [];                                   // { material, name, region, flat, map }
// Blocks that hide the hero are drawn as a thin scatter of pixels, so he is seen through them.
// The same happens around the pointer, so a tile behind a wall can be seen and tapped.
// A pixel of a block is thinned out when it is nearer to the camera than the point of interest
// and close to it on screen.
const NOWHERE = new THREE.Vector3(0, -999, 0);
const occlusion = {
  uHero: { value: new THREE.Vector3() }, uRadius: { value: 0 },
  uPointer: { value: NOWHERE.clone() }, uPointerRadius: { value: 1.5 },
};
// Behind the door the dungeon fades out with distance from the door: plain up to the inner
// radius, then over 5 more tiles down to black.
const doorFog = { uFogCenter: { value: new THREE.Vector2(4.5, -1) }, uFogInner: { value: 4.5 }, uFogOuter: { value: 9.5 } };
function seeThrough(material, fogged = false) {
  // three.js shares one compiled program per onBeforeCompile text; the fogged version must not reuse the plain one
  material.customProgramCacheKey = () => (fogged ? 'see-through-fogged' : 'see-through');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, occlusion, fogged ? doorFog : {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOccPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOccPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOccPos;
uniform vec3 uHero;
uniform float uRadius;
uniform vec3 uPointer;
uniform float uPointerRadius;
${fogged ? 'uniform vec2 uFogCenter;\nuniform float uFogInner;\nuniform float uFogOuter;' : ''}
const vec3 occView = vec3(-0.57735, -0.57735, -0.57735);        // the way the camera looks
float occPattern(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (m[x + y * 4] + 0.5) / 16.0;
}
// How much of this pixel to keep, for one point of interest: 1 keeps it all.
float occKeep(vec3 focus, float radius, float nearer, float above) {
  vec3 occ = vOccPos - focus;
  float along = dot(occ, occView);                              // negative: nearer to the camera than the point
  float aside = length(occ - occView * along);                  // how far from it on screen
  if (vOccPos.y > above && along < nearer && aside < radius) return 0.1 + 0.9 * smoothstep(radius * 0.6, radius, aside);
  return 1.0;
}`)
      .replace('void main() {', `void main() {
  // the hero: only what stands higher than his feet can hide him; the pointer: only what is higher than a step
  float occ = min(occKeep(uHero, uRadius, -0.45, uHero.y - 0.65), occKeep(uPointer, uPointerRadius, -0.2, 0.6));
  if (occ < 1.0 && occ < occPattern(floor(gl_FragCoord.xy / 2.0))) discard;`)
      .replace('#include <dithering_fragment>', fogged
        ? '#include <dithering_fragment>\ngl_FragColor.rgb *= 1.0 - smoothstep(uFogInner, uFogOuter, distance(vOccPos.xz, uFogCenter));'
        : '#include <dithering_fragment>');
  };
  return material;
}
const regionLight = { room: 1, west: 0.45, north: 0.3 };     // how lit each part of the dungeon is right now
function blockMaterial(name, region) {
  let entry = blockMaterials.find((e) => e.name === name && e.region === region);
  if (!entry) {
    const material = seeThrough(new THREE.MeshLambertMaterial({ vertexColors: true, shadowSide: THREE.DoubleSide }), region === 'north');
    entry = { material, name, region, flat: FLAT[name], map: BLOCK_TEXTURE[name] };
    blockMaterials.push(entry);
  }
  return entry.material;
}
const FLAT = {
  stone: 0x7b7a66, stoneB: 0x7b7a66, cobble: 0x6c6b59, cobbleB: 0x6c6b59, bricks: 0x73725f, bricksB: 0x73725f,
  mossy: 0x6d6f52, mossyB: 0x6d6f52, cracked: 0x6f6e5b, tile: 0xb9aea3, tileSide: 0xb5aa9f, deep: 0x554235, dirt: 0x6a503a,
  grassTop: 0x5c7d34, grassSide: 0x64563a, dark: 0x5e493a, darkB: 0x5e493a, night: 0x3c2d24, nightB: 0x3c2d24,
  logSide: 0x6b4a2e, logTop: 0xa58050, leaves: 0x4a7a2f, planks: 0x8d6942, roof: 0x9a472d, door: 0x5c3d2a, window: 0x8d6942,
  hay: 0xd8bb4a, water: 0x3a7299, cropTop: 0x5a4330, sand: 0xd0bb83,
};

// The owner's sample tiles, exactly as cut from his picture: three sets (grey, brown, pale),
// each with rough rubble, dressed bricks, carved tiles and long blocks.
const fromSample = (rows, seed) => paint(seed, (px) => rows.forEach((row, y) => row.forEach((colour, x) => px(x, y, colour))));
const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const hexOf = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
// The same tiles with less contrast: every colour pulled towards the average of its set,
// so joints get lighter and highlights dimmer. Moss keeps more of its colour.
function quieter(tiles, amount) {
  const isMoss = ([r, g, b]) => Math.min(r, g) - b > 40;
  const stone = Object.values(tiles).flat(2).map(rgbOf).filter((c) => !isMoss(c));
  const mean = [0, 1, 2].map((k) => stone.reduce((sum, c) => sum + c[k], 0) / stone.length);
  const calm = (hex) => {
    const c = rgbOf(hex);
    const pull = isMoss(c) ? amount * 0.5 : amount;
    return hexOf(c.map((v, k) => v + (mean[k] - v) * pull));
  };
  return Object.fromEntries(Object.entries(tiles).map(([name, rows]) => [name, rows.map((row) => row.map(calm))]));
}
const texturesOf = (source, seed) => Object.fromEntries(Object.entries(source).map(([set, tiles], s) => [
  set, Object.fromEntries(Object.entries(tiles).map(([name, rows], k) => [name, fromSample(rows, seed + s * 20 + k)])),
]));
// The same tiles, darker: a medium and a dark tone that match the light one because they are the same stone.
function toned(tiles, factor) {
  const isMoss = ([r, g, b]) => Math.min(r, g) - b > 40;
  const shade = (hex) => { const c = rgbOf(hex); const f = isMoss(c) ? (1 + factor) / 2 : factor; return hexOf(c.map((v) => v * f)); };
  return Object.fromEntries(Object.entries(tiles).map(([name, rows]) => [name, rows.map((row) => row.map(shade))]));
}
const family = (light, seed) => texturesOf({ light, mid: toned(light, 0.74), dark: toned(light, 0.52) }, seed);
// Which tile goes on which kind of block. Light is the mass of walls and floor; medium frames
// the door, the chest step and the pillar; the darkest sits low, under the floor and in the passage.
const stoneMap = ({ light, mid, dark, step = mid }) => ({
  bricks: light.bricks1, bricksB: light.bricks2, mossy: light.bricksMoss, mossyB: light.rubbleMoss, cracked: light.long,
  stone: light.long, stoneB: light.bricks2,
  cobble: mid.rubble1, cobbleB: mid.rubble2, dark: mid.bricks1, darkB: mid.bricks2,
  tile: step.carved2, tileSide: step.long,
  night: dark.bricks1, nightB: dark.bricks2, deep: dark.rubble3,
});
const STONE_KINDS = ['bricks', 'bricksB', 'mossy', 'mossyB', 'cracked', 'cobble', 'cobbleB', 'stone', 'stoneB',
  'dark', 'darkB', 'night', 'nightB', 'tile', 'tileSide', 'deep'];
// The stone: the owner's choice, light and quieter. It is cut from someone else's tileset (stone-sample.js), so it is
// used only where that file is (at home); publish.sh leaves it out until there is a licence, and the published game
// paints its own stone in the same spirit (own-stone.js).
const CHOSEN = await import('./stone-sample.js').then((module) => module.SAMPLE.pale, () => null);
const STONE_SETS = [
  { label: 'Камък', maps: stoneMap(family(quieter(CHOSEN ?? paintStone().pale, 0.5), CHOSEN ? 500 : 600)) },
];
let stoneSet = 0;
function setStone(index) {
  stoneSet = index;
  const maps = STONE_SETS[index].maps;
  for (const entry of blockMaterials) if (maps[entry.name]) entry.map = maps[entry.name];
  document.getElementById('stone').textContent = STONE_SETS[index].label;
  setTextured(textured);
}

const texturable = [];
function lit(color, textureKey) {
  const m = new THREE.MeshLambertMaterial({ color });
  if (textureKey) texturable.push([m, textureKey]);
  return m;
}
const glowing = (color) => new THREE.MeshBasicMaterial({ color });

const M = {
  stone: lit(0x7b7a66, 'stone'),
  stoneDark: lit(0x54533f, 'stone'),
  wood: lit(0x8a5a34, 'wood'),
  woodDark: lit(0x4c3122, 'wood'),
  iron: lit(0x2c2e3a),
  gold: lit(0xf2b01e, 'gold'),
  cloth: lit(0xa3262a),
  skin: lit(0xd9a074),
  hair: lit(0x5a3a22),
  tunic: lit(0x2f7fd9),
  trousers: lit(0x2a2f4a),
  pack: lit(0x8c4b2f),
  golem: lit(0x86856f, 'stone'),
  golemDark: lit(0x5d5c4d, 'stone'),
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

const PETALS = [0xf2c81e, 0xe0483e, 0xf1eee6, 0xff8fb0].map((colour) => lit(colour));

let textured = false;
function setTextured(on) {
  textured = on;
  for (const { material, map } of blockMaterials) {
    material.map = on ? map : null;
    material.needsUpdate = true;
  }
  lightRegions();
  for (const [material, key] of texturable) {
    material.map = on ? textures[key] : null;
    material.needsUpdate = true;
  }
  document.getElementById('style').textContent = on ? TEXT.styleTextured : TEXT.styleFlat;
}

// A box whose texture keeps 16 pixels per tile whatever its size.
function boxGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const k = f * 4 + v;
    uv.setXY(k, uv.getX(k) * faces[f][0], uv.getY(k) * faces[f][1]);
  }
  return g;
}
function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  const isLit = material.isMeshLambertMaterial;
  mesh.castShadow = isLit;
  mesh.receiveShadow = isLit;
  parent.add(mesh);
  return mesh;
}

// ---------- the room, as a grid ----------

const key = (i, j) => `${i},${j}`;
const isPlatform = (i, j) => i >= 0 && j >= 0 && i <= 2 && j <= 1;
const tileY = (i, j) => (MAP === 'dungeon' && isPlatform(i, j) ? 0.5 : 0);
const blocked = new Set();
const block = (...tiles) => tiles.forEach(([i, j]) => blocked.add(key(i, j)));
const inRoom = (i, j) => i >= 0 && i < W && j >= 0 && j < D;
// Fog of war. The hero has seen the room and the hall he came from. What is behind
// the closed door is not seen, and cannot be walked, until the door opens.
const explored = new Set(['room', 'west']);
let doorOpen = false;
let chestOpen = false;
let chestShake = 0;            // seconds left of the chest rattling after a wrong try
const gateOpen = (i, j) => (i === -1 && j === 5) || (doorOpen && j === -1 && (i === 4 || i === 5));
const surfaceGround = new Set();               // the tiles that can be walked above ground
const walkable = (i, j) => (MAP === 'surface' ? surfaceGround.has(key(i, j)) && !blocked.has(key(i, j)) : !blocked.has(key(i, j))
  && (inRoom(i, j) || gateOpen(i, j) || (beyond.has(key(i, j)) && explored.has(regionAt.get(key(i, j)))
    && (regionAt.get(key(i, j)) !== 'north' || seen.has(key(i, j))))));

// Every block of the room. `level` is the height of the middle of its cell;
// `top` is how much of the cell it fills (1 is a whole cube).
const blocks = [];
const grassTiles = [];
const WATER = [[1, 5], [1, 6], [2, 6], [2, 7]];      // a stream that runs off the edge
const isWater = (i, j) => WATER.some(([a, b]) => a === i && b === j);
WATER.forEach((tile) => block(tile));

// A corner where the cave has let the outside in.
const gardenDistance = (i, j) => Math.hypot(i - 0.4, j - 6.4);
function floorKind(i, j) {
  if (isWater(i, j)) return 'dirt';
  if (isPlatform(i, j)) return 'bricks';
  const g = gardenDistance(i, j);
  if (g < 2.4 || (g < 3.3 && rand() < 0.5)) return 'grass';
  if ((i === 3 && j <= 2) || (i <= 2 && j === 2)) return 'dark';      // a dark border round the chest step
  if (Math.hypot(i - 6, j - 3) < 1.6) return 'cobble';
  const roll = rand();
  if (roll < (g < 4.8 ? 0.38 : 0.1)) return 'mossy';
  if (roll > 0.975) return 'night';
  if (roll > 0.93) return 'dark';
  if (roll > 0.86) return 'cracked';
  return 'bricks';
}

for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
  const type = floorKind(i, j);
  const tile = { i, j };
  blocks.push({ x: i, level: -0.5, z: j, type, tile, shade: 0.94 + rand() * 0.12, top: isWater(i, j) ? 0.68 : 1 });
  if (type === 'grass') grassTiles.push(tile);
  if (isPlatform(i, j)) blocks.push({ x: i, level: 0.5, z: j, type: 'tile', tile, shade: 0.96 + rand() * 0.08, top: 0.5 });
  // The slab is thick and ragged at the two edges that face the camera, like a piece cut out of the ground.
  if (i === W - 1 || j === D - 1) {
    const soil = type === 'grass' || isWater(i, j);
    blocks.push({ x: i, level: -1.5, z: j, type: soil ? 'dirt' : rand() < 0.5 ? 'dark' : 'night', shade: 0.85 + rand() * 0.15 });
    if (rand() < 0.7) {
      blocks.push({ x: i, level: -2.5, z: j, type: rand() < 0.5 ? 'night' : 'deep', shade: 0.8 + rand() * 0.2 });
      if (rand() < 0.4) blocks.push({ x: i, level: -3.5, z: j, type: 'deep', shade: 0.8 + rand() * 0.2 });
    }
  }
}

function wallColumn(i, j, height, { gapTo = 0, dim = 1, base = 'bricks', cap = 'stone', region = 'room', gate = false } = {}) {
  blocks.push({ x: i, level: -0.5, z: j, type: 'deep', shade: dim, region, tile: gate ? { i, j } : undefined });   // a gate can be walked through
  for (let level = gapTo; level < height; level++) {
    const top = level === height - 1;
    const roll = rand();
    const type = top ? cap : base === 'dark' ? 'dark'
      : level === 0 && roll < 0.3 ? 'mossy' : level === 0 && roll < 0.45 ? 'dark' : roll > 0.86 ? 'cracked' : base;
    blocks.push({ x: i, level: 0.5 + level, z: j, type, shade: (top ? 1.06 : 0.92 + rand() * 0.14) * dim, region });
  }
}
// Left-back wall (along z) with the passage we came from at j = 5.
for (let j = -1; j < D; j++) {
  const height = j >= D - 1 ? 1 : j >= D - 2 ? 2 : 3 + (rand() < 0.25 ? 1 : 0);
  wallColumn(-1, j, height, { gapTo: j === 5 ? 2 : 0, gate: j === 5 });
}
// Right-back wall (along x) with the door at i = 4 and 5.
for (let i = 0; i < W; i++) {
  const height = i >= W - 1 ? 1 : i >= W - 2 ? 2 : 3 + (rand() < 0.25 ? 1 : 0);
  const isDoor = i === 4 || i === 5;
  const nearDoor = i >= 3 && i <= 6;                                  // the door gets a dark frame
  wallColumn(i, -1, isDoor ? 3 : height, { gapTo: isDoor ? 2 : 0, base: nearDoor ? 'dark' : 'bricks', cap: isDoor ? 'night' : 'stone', gate: isDoor });
}
// The rest of the dungeon. It goes on beyond this room, to the back and to the left,
// and gets darker the further it is. Each cell belongs to a part of the dungeon:
// 'west' is the hall we came from, 'north' is what lies behind the guarded door.
const inRoomArea = (x, z) => x >= -1 && x < W && z >= -1 && z < D;        // the room and its two walls
const beyond = new Set();                                                  // floor cells outside the room
const regionAt = new Map();
const lay = (region, x0, z0, x1, z1) => {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (inRoomArea(x, z)) continue;
    beyond.add(key(x, z));
    regionAt.set(key(x, z), region);
  }
};
lay('west', -4, 5, -2, 5);            // the passage west, where we came from
lay('west', -11, 2, -5, 8);           // the hall beyond it
lay('north', 4, -5, 5, -2);           // the corridor behind the guarded door
lay('north', 1, -11, 8, -6);          // the next chamber
lay('north', -4, -9, 0, -9);          // a passage leading on from it
const farness = (x, z) => Math.hypot(Math.max(0, -x, x - (W - 1)), Math.max(0, -z, z - (D - 1)));
const fade = (x, z) => Math.max(0.3, 1 - farness(x, z) / 15);
const cellOf = (id) => id.split(',').map(Number);

for (const id of beyond) {
  const [x, z] = cellOf(id);
  const dim = fade(x, z);
  const region = regionAt.get(id);
  const roll = rand();
  const type = roll > 0.95 ? 'night' : roll > 0.85 ? 'dark' : roll < 0.12 ? 'mossy' : roll < 0.2 ? 'cracked' : 'bricks';
  blocks.push({ x, level: -0.5, z, type, shade: (0.92 + rand() * 0.12) * dim, region, tile: { i: x, j: z } });
  // Where the floor ends towards the camera it is cut the same way as the room: thick and ragged.
  const open = (dx, dz) => !beyond.has(key(x + dx, z + dz)) && !inRoomArea(x + dx, z + dz);
  if (open(1, 0) || open(0, 1)) {
    blocks.push({ x, level: -1.5, z, type: rand() < 0.5 ? 'dark' : 'night', shade: 0.85 * dim, region });
    if (rand() < 0.6) blocks.push({ x, level: -2.5, z, type: 'deep', shade: 0.8 * dim, region });
  }
}
// Walls stand only on the far sides of each floor, as in the room, so we can see in.
const wallSpots = new Map();
for (const id of beyond) {
  const [x, z] = cellOf(id);
  for (const [dx, dz] of [[-1, 0], [0, -1], [-1, -1]]) {
    const spot = key(x + dx, z + dz);
    if (!beyond.has(spot) && !inRoomArea(x + dx, z + dz)) wallSpots.set(spot, [x + dx, z + dz, regionAt.get(id)]);
  }
}
for (const [x, z, region] of wallSpots.values()) wallColumn(x, z, 2 + (rand() < 0.6 ? 1 : 0), { dim: fade(x, z), region });
// A broken pillar in the middle, so paths have something to go around.
blocks.push({ x: 6, level: 0.5, z: 3, type: 'night', shade: 1 }, { x: 6, level: 1.5, z: 3, type: 'dark', shade: 1.04 });
block([6, 3]);

// ---- the stairs up, at the back of the hall to the west: they lead out, to the surface ----
const STAIRS = [[-8, 3, 0.5], [-8, 2, 1]];          // one tile wide: two steps up to the opening in the wall
if (MAP === 'dungeon') {
  for (let k = blocks.length - 1; k >= 0; k--) {                  // an opening in the wall where the stairs go out
    const b = blocks[k];
    if (b.x === -8 && b.z === 1 && b.level > 0 && b.level < 2) blocks.splice(k, 1);
  }
  STAIRS.forEach(([x, z, top]) => blocks.push({ x, level: 0.5, z, type: 'stone', shade: 1, top, region: 'west' }));
  blocks.push({ x: -8, level: 0.5, z: 1, type: 'stone', shade: 1, region: 'west' });                    // the landing
  STAIRS.forEach(([x, z]) => block([x, z]));
}

// ---- above ground: the world is read from a text matrix, one character per tile (surface-map.js) ----
const SURF = { x0: 0, x1: SURFACE_MAP[0].length - 1, z0: 0, z1: SURFACE_MAP.length - 1 };
const charAt = (x, z) => SURFACE_MAP[z]?.[x] ?? ' ';
const surfaceProps = [];                          // things that are not blocks: { kind, x, z }
const roadCells = new Set();                      // the dirt path: the easy way to walk
let CAVE = { x: 0, z: 0 };
if (MAP === 'surface') {
  blocks.length = 0;
  blocked.clear();
  const sr = mulberry32(23);
  const taken = new Set();
  const put = (x, level, z, type, more = {}) => {
    const id = `${x},${level},${z}`;
    if (taken.has(id)) return;
    taken.add(id);
    blocks.push({ x, level, z, type, shade: 0.93 + sr() * 0.12, ...more });
  };
  const tree = (x, z) => {
    const big = sr() < 0.25;                                                   // most trees are slim, some are broad
    const trunk = (big ? 3 : 2) + Math.floor(sr() * 2);
    for (let l = 0; l < trunk; l++) put(x, 0.5 + l, z, 'log');
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const corner = Math.abs(dx) + Math.abs(dz) === 2;
      if (corner && (!big || sr() < 0.35)) continue;                          // slim trees have a crown like a plus sign
      put(x + dx, 0.5 + trunk, z + dz, 'leaves');
    }
    put(x, 1.5 + trunk, z, 'leaves');
    if (big) [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dz]) => { if (sr() < 0.5) put(x + dx, 1.5 + trunk, z + dz, 'leaves'); });
  };
  // Every connected patch of the same sort of character is one building: its outline is found here.
  const patches = (chars) => {
    const done = new Set();
    const found = [];
    for (let z = SURF.z0; z <= SURF.z1; z++) for (let x = SURF.x0; x <= SURF.x1; x++) {
      if (!chars.includes(charAt(x, z)) || done.has(key(x, z))) continue;
      const box = { x0: x, x1: x, z0: z, z1: z };
      const queue = [[x, z]];
      done.add(key(x, z));
      while (queue.length) {
        const [cx, cz] = queue.pop();
        box.x0 = Math.min(box.x0, cx); box.x1 = Math.max(box.x1, cx);
        box.z0 = Math.min(box.z0, cz); box.z1 = Math.max(box.z1, cz);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, nz = cz + dz;
          if (chars.includes(charAt(nx, nz)) && !done.has(key(nx, nz))) { done.add(key(nx, nz)); queue.push([nx, nz]); }
        }
      }
      found.push(box);
    }
    return found;
  };
  const HOUSE = 'HLDO';
  const SHED = 'PSZ';
  const WALK = '.,pCcfSb';

  for (let z = SURF.z0; z <= SURF.z1; z++) for (let x = SURF.x0; x <= SURF.x1; x++) {
    const ch = charAt(x, z);
    const walk = WALK.includes(ch);
    const ground = ch === '~' ? 'water' : ch === 'b' ? 'sand' : ch === 'f' ? 'crop' : '#=^'.includes(ch) ? 'cobble'
      : 'pCcs'.includes(ch) || HOUSE.includes(ch) || SHED.includes(ch) ? 'dirt' : 'grass';
    put(x, -0.5, z, ground, { tile: walk ? { i: x, j: z } : undefined, top: ch === '~' ? 0.82 : 1 });
    if (walk) surfaceGround.add(key(x, z));
    if (ch === 'p' || ch === 'C') roadCells.add(key(x, z));
    if (ch === ',') surfaceProps.push({ kind: 'flowers', x, z });
    const rock = { '=': 2, '#': 3, '^': 4 }[ch];
    if (rock) {
      const height = rock + (ch === '^' ? Math.floor(sr() * 3) : 0);
      for (let l = 0; l < height; l++) put(x, 0.5 + l, z, l === height - 1 ? (ch === '^' ? 'stone' : 'grass') : sr() < 0.35 ? 'deep' : 'cobble');
    }
    if (ch === 'C' || ch === 'c') put(x, 2.5, z, 'grass');                    // the roof over the tunnel
    if (ch === 'C') CAVE = { x, z };
    if (ch === 'T') tree(x, z);
    if (ch === 't') put(x, 0.5, z, 'leaves', { top: 0.7 });
    if (ch === 'h') put(x, 0.5, z, 'leaves', { top: 0.6 });
    if (ch === 'w') { put(x, 0.5, z, 'well', { top: 0.7 }); surfaceProps.push({ kind: 'well', x, z }); }
    if (ch === 's') { put(x, 0.5, z, 'planks', { top: 0.6 }); surfaceProps.push({ kind: 'stall', x, z }); }
    if ('yYZ'.includes(ch)) { put(x, 0.5, z, 'hay'); if (ch === 'Y') put(x, 1.5, z, 'hay'); }
    if (ch === 'P') { put(x, 0.5, z, 'log'); put(x, 1.5, z, 'log'); }
    if (ch === 'k') { surfaceProps.push({ kind: 'sign', x, z }); block([x, z]); }
    if (ch === 'l') { surfaceProps.push({ kind: 'lamp', x, z }); block([x, z]); }
  }
  for (const h of patches(HOUSE)) {
    for (let z = h.z0; z <= h.z1; z++) for (let x = h.x0; x <= h.x1; x++) {
      if (x !== h.x0 && x !== h.x1 && z !== h.z0 && z !== h.z1) continue;      // walls stand on the outline only
      const ch = charAt(x, z);
      put(x, 0.5, z, ch === 'D' ? 'door' : ch === 'L' ? 'log' : 'planks');
      put(x, 1.5, z, ch === 'O' ? 'window' : ch === 'L' ? 'log' : 'planks');
    }
    const alongX = h.x1 - h.x0 >= h.z1 - h.z0;                                 // the ridge runs along the longer side
    for (let step = 0; step < 3; step++) {                                     // the roof rises in steps to the ridge
      const sx = alongX ? 1 : 1 - step;
      const sz = alongX ? 1 - step : 1;
      if (h.x0 - sx > h.x1 + sx || h.z0 - sz > h.z1 + sz) break;
      for (let z = h.z0 - sz; z <= h.z1 + sz; z++) for (let x = h.x0 - sx; x <= h.x1 + sx; x++) put(x, 2.5 + step, z, 'roof');
    }
  }
  for (const shed of patches(SHED)) {
    for (let z = shed.z0; z <= shed.z1; z++) for (let x = shed.x0; x <= shed.x1; x++) put(x, 2.5, z, 'roof', { top: 0.5 });
  }
}


// Build the room as a few meshes, one per texture. Only the three sides the
// camera can ever see are made. Each corner of each face gets darker the more
// blocks crowd around it: that is the soft shadow where walls meet the floor.
const cells = new Map();
const cellKey = (x, level, z) => `${x},${level},${z}`;
blocks.forEach((b) => { b.top ??= 1; cells.set(cellKey(b.x, b.level, b.z), b); });
const heightAt = (x, level, z) => cells.get(cellKey(x, level, z))?.top ?? 0;      // 0 means empty
const CORNER_LIGHT = [0.42, 0.63, 0.83, 1];
const crowd = (side1, side2, corner) => (side1 && side2 ? 0 : 3 - side1 - side2 - corner);

// Some kinds of block wear one picture on their sides and another on top.
const SIDE_OF = { grass: 'grassSide', tile: 'tileSide', log: 'logSide', well: 'cobble', crop: 'dirt' };
const TOP_OF = { grass: 'grassTop', log: 'logTop', well: 'water', crop: 'cropTop', door: 'planks', window: 'planks' };
const buckets = new Map();
function quad(region, texture, corners, normal, uvs, light, shade, tile, cell) {
  const id = `${region}|${texture}`;
  if (!buckets.has(id)) buckets.set(id, { region, texture, position: [], normal: [], uv: [], color: [], index: [], quads: [], cells: [] });
  const bucket = buckets.get(id);
  const first = bucket.position.length / 3;
  corners.forEach((corner, k) => {
    bucket.position.push(...corner);
    bucket.normal.push(...normal);
    bucket.uv.push(...uvs[k]);
    const v = shade * CORNER_LIGHT[light[k]];
    bucket.color.push(v, v, v);
  });
  // Split the square along the brighter diagonal, so a dark corner stays a soft blob.
  if (light[0] + light[2] > light[1] + light[3]) bucket.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  else bucket.index.push(first + 1, first + 2, first + 3, first + 1, first + 3, first);
  bucket.quads.push(tile ?? null);
  bucket.cells.push(cell);
}

for (const b of blocks) {
  const { x, level, z, top, shade, tile } = b;
  const region = b.region ?? 'room';
  const y0 = level - 0.5;
  const y1 = y0 + top;
  const look = HAS_TWIN.has(b.type) && rand() < 0.5 ? `${b.type}B` : b.type;
  const sideTexture = SIDE_OF[b.type] ?? look;
  const topTexture = TOP_OF[b.type] ?? look;
  const solid = (dx, dy, dz) => (heightAt(x + dx, level + dy, z + dz) > 0.6 ? 1 : 0);
  const sideUv = [[0, 1 - top], [1, 1 - top], [1, 1], [0, 1]];

  if (top < 1 || heightAt(x, level + 1, z) === 0) {                 // the top
    const up = top < 1 ? 0 : 1;                                     // a low block is crowded by its own level
    const over = (dx, dz) => (heightAt(x + dx, level + up, z + dz) > (up ? 0 : top) ? 1 : 0);
    const light = [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([sx, sz]) => crowd(over(sx, 0), over(0, sz), over(sx, sz)));
    quad(region, topTexture, [[x - 0.5, y1, z - 0.5], [x - 0.5, y1, z + 0.5], [x + 0.5, y1, z + 0.5], [x + 0.5, y1, z - 0.5]],
      [0, 1, 0], [[0, 1], [0, 0], [1, 0], [1, 1]], light, shade, tile, key(x, z));
  }
  if (heightAt(x + 1, level, z) < top) {                            // the side that faces +x
    const light = [[-1, 1], [-1, -1], [1, -1], [1, 1]].map(([sy, sz]) => crowd(solid(1, sy, 0), solid(1, 0, sz), solid(1, sy, sz)));
    quad(region, sideTexture, [[x + 0.5, y0, z + 0.5], [x + 0.5, y0, z - 0.5], [x + 0.5, y1, z - 0.5], [x + 0.5, y1, z + 0.5]],
      [1, 0, 0], sideUv, light, shade, tile, key(x, z));
  }
  if (heightAt(x, level, z + 1) < top) {                            // the side that faces +z
    const light = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => crowd(solid(sx, 0, 1), solid(0, sy, 1), solid(sx, sy, 1)));
    quad(region, sideTexture, [[x - 0.5, y0, z + 0.5], [x + 0.5, y0, z + 0.5], [x + 0.5, y1, z + 0.5], [x - 0.5, y1, z + 0.5]],
      [0, 0, 1], sideUv, light, shade, tile, key(x, z));
  }
}

const floorMeshes = [...buckets.values()].map((bucket) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.color, 3));
  geometry.setIndex(bucket.index);
  const mesh = new THREE.Mesh(geometry, blockMaterial(bucket.texture, bucket.region));
  mesh.userData.region = bucket.region;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.quads = bucket.quads;        // which tile each square belongs to, for tapping
  mesh.userData.all = { index: bucket.index, quads: bucket.quads, cells: bucket.cells };
  scene.add(mesh);
  return mesh;
});
// A part that is not seen is not drawn at all; a part that is only remembered is drawn dim.
function lightRegions() {
  for (const { material, flat, region } of blockMaterials) material.color.set(textured ? 0xffffff : flat).multiplyScalar(regionLight[region]);
  for (const mesh of floorMeshes) mesh.visible = regionLight[mesh.userData.region] > 0.01;
}

// Behind the door nothing is drawn until it opens. Then the whole room is shown: floor and
// walls only, dim and without its light, until the hero steps inside.
const seen = new Set();
const northCells = new Set(blocks.filter((b) => b.region === 'north').map((b) => key(b.x, b.z)));
function unveil() {
  for (const mesh of floorMeshes) {
    if (mesh.userData.region !== 'north') continue;
    const { index, quads, cells } = mesh.userData.all;
    const shownIndex = [];
    const shownQuads = [];
    cells.forEach((cell, q) => {
      if (!seen.has(cell)) return;
      shownIndex.push(...index.slice(q * 6, q * 6 + 6));
      shownQuads.push(quads[q]);
    });
    mesh.geometry.setIndex(shownIndex);
    mesh.userData.quads = shownQuads;
  }
}
// The part of the map that is drawn: the room, the hall to the west, and what has been seen behind the door.
const viewBox = { minX: -1, maxX: W - 1, minZ: -1, maxZ: D - 1 };
for (const id of beyond) if (regionAt.get(id) === 'west') {
  const [x, z] = cellOf(id);
  viewBox.minX = Math.min(viewBox.minX, x); viewBox.maxX = Math.max(viewBox.maxX, x);
  viewBox.minZ = Math.min(viewBox.minZ, z); viewBox.maxZ = Math.max(viewBox.maxZ, z);
}
function clampView(v) {
  v.x = Math.min(viewBox.maxX, Math.max(viewBox.minX, v.x));
  v.z = Math.min(viewBox.maxZ, Math.max(viewBox.minZ, v.z));
  return v;
}
function lookAround(cx, cz, radius = 4.5) {
  if (MAP === 'surface') return;
  let grew = false;
  for (const cell of northCells) {
    if (seen.has(cell)) continue;
    const [x, z] = cellOf(cell);
    if (Math.hypot(x - cx, z - cz) <= radius) {
      seen.add(cell);
      grew = true;
      viewBox.minX = Math.min(viewBox.minX, x); viewBox.maxX = Math.max(viewBox.maxX, x);
      viewBox.minZ = Math.min(viewBox.minZ, z); viewBox.maxZ = Math.max(viewBox.maxZ, z);
    }
  }
  if (grew) unveil();
}
unveil();
lookAround(4.5, -1, 9.5);                  // through the shut door: a dim glimpse of what is nearest, fading out over 5 more tiles

// Blades of grass and a few flowers on the grass.
grassTiles.forEach(({ i, j }) => {
  for (let k = 0, blades = whole(rand, 4); k < blades; k++) {
    const h = 0.1 + rand() * 0.14;
    box(scene, 0.05, h, 0.05, M.blade, i + (rand() - 0.5) * 0.8, h / 2, j + (rand() - 0.5) * 0.8).rotation.y = rand() * 1.5;
  }
  if (rand() < 0.4) {
    const x = i + (rand() - 0.5) * 0.6;
    const z = j + (rand() - 0.5) * 0.6;
    box(scene, 0.04, 0.2, 0.04, M.blade, x, 0.1, z);
    box(scene, 0.11, 0.09, 0.11, PETALS[whole(rand, PETALS.length)], x, 0.23, z).rotation.y = rand() * 1.5;
  }
});

// Rubble by the pillar.
[[6.62, 3.5, 0.2], [5.5, 3.42, 0.14], [6.4, 2.38, 0.16], [5.62, 2.7, 0.1]].forEach(([x, z, s]) => {
  box(scene, s, s, s, M.stone, x, s / 2, z).rotation.y = rand() * 1.5;
});

const propsFrom = scene.children.length;          // from here on: the dungeon's lights and things
// ---------- light ----------

scene.add(new THREE.HemisphereLight(0xd6dce6, 0x4a443a, 1.45));
const fill = new THREE.DirectionalLight(0xb4bfce, 0.65);   // lifts the faces that look left
fill.position.set(2, 6, D + 8);
scene.add(fill);
const moon = new THREE.DirectionalLight(0xe6ecf7, 1.25);
moon.position.set(W + 5, 11, D / 2 - 3);
moon.target.position.set(W / 2 - 1, 0, D / 2);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 });
moon.shadow.bias = -0.0006;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

// Soft round sprite: a cheap stand-in for bloom.
const glowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function glow(parent, color, size, opacity, x = 0, y = 0, z = 0) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.scale.setScalar(size);
  sprite.position.set(x, y, z);
  parent.add(sprite);
  return sprite;
}

const flickers = [];   // { light, base, halo, haloBase, flame, phase }
function torch(x, y, z, leanX, leanZ, power = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stick = box(g, 0.09, 0.42, 0.09, M.woodDark, 0, -0.16, 0);
  stick.rotation.set(leanZ * 0.5, 0, -leanX * 0.5);
  box(g, 0.2, 0.08, 0.2, M.iron, leanX * 0.08, 0.06, leanZ * 0.08);
  const flame = new THREE.Group();
  flame.position.set(leanX * 0.1, 0.22, leanZ * 0.1);
  box(flame, 0.2, 0.24, 0.2, M.flame);
  box(flame, 0.11, 0.16, 0.11, M.flameCore, 0, 0.12, 0);
  g.add(flame);
  const light = new THREE.PointLight(0xffc089, 6.5 * power, 9, 2);
  light.position.set(leanX * 0.9, 0.35, leanZ * 0.9);
  g.add(light);
  const halo = glow(g, 0xff7a28, 1.8, 0.08, leanX * 0.2, 0.25, leanZ * 0.2);
  scene.add(g);
  const flicker = { light, base: 6.5 * power, halo, haloBase: 0.08, flame, phase: rand() * 10, strength: 6.5 * power };
  flickers.push(flicker);
  g.userData.flicker = flicker;
  return g;
}
torch(-0.36, 1.8, 2, 1, 0);
torch(3, 1.8, -0.36, 0, 1);
torch(6, 1.8, -0.36, 0, 1);
torch(8, 1.35, -0.36, 0, 1);
torch(-7, 1.8, 1.64, 0, 1, 0.6);       // in the hall to the west
const northTorch = torch(0.64, 1.8, -8, 1, 0, 0.6);       // in the chamber behind the door

// ---------- water and daylight ----------

const WATER_BLUE = ['#2d5f86', '#3a7299', '#4b88ad', '#74aac8', '#b9d8e6'];
const waterTexture = paint(11, (px, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, WATER_BLUE[1 + (r() < 0.2 ? 1 : 0) - (r() < 0.12 ? 1 : 0)]);
  for (let k = 0; k < 9; k++) {
    const x = whole(r, 16), y = whole(r, 16), length = 3 + whole(r, 4);
    for (let n = 0; n < length; n++) px(x + n, y + (n > length / 2 ? 1 : 0), WATER_BLUE[3]);
  }
  for (let k = 0; k < 4; k++) px(whole(r, 16), whole(r, 16), WATER_BLUE[4]);
});
const fallTexture = paint(12, (px, r) => {
  for (let x = 0; x < 16; x++) {
    const column = 2 + (r() < 0.35 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
    for (let y = 0; y < 16; y++) px(x, y, WATER_BLUE[Math.min(4, column + (r() < 0.15 ? 1 : 0))]);
  }
});
[waterTexture, fallTexture].forEach((tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; });
fallTexture.repeat.set(1, 4);

const waterMaterial = new THREE.MeshLambertMaterial({
  map: waterTexture, transparent: true, opacity: 0.88, emissive: 0x245876, emissiveIntensity: 0.22,
});
WATER.forEach(([i, j]) => {
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waterMaterial);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(i, -0.2, j);
  surface.receiveShadow = true;
  scene.add(surface);
});
// The stream leaves the slab at tile (2, 7) and falls into the dark, fading out.
const fadeTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#cfcfcf'); g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();
const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 4.4), new THREE.MeshBasicMaterial({
  map: fallTexture, alphaMap: fadeTexture, transparent: true, depthWrite: false, color: 0xdcefff,
}));
waterfall.position.set(2, -2.4, D - 0.47);
scene.add(waterfall);
box(scene, 0.92, 0.12, 0.1, new THREE.MeshBasicMaterial({ color: 0xe6f4ff }), 2, -0.24, D - 0.46);
glow(scene, 0xbfe3ff, 2.0, 0.07, 2, -3.4, D - 0.3);

// Daylight comes down through a hole in the roof and lands on the garden.
const sunTarget = new THREE.Vector3(1.0, 0, 5.4);
const sunFrom = new THREE.Vector3(-2.6, 10, 8.8);
const sun = new THREE.SpotLight(0xfff0c4, 13, 26, 0.3, 0.85, 1.2);
sun.position.copy(sunFrom);
sun.target.position.copy(sunTarget);
scene.add(sun, sun.target);
const shaftTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const image = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const across = Math.sin((Math.PI * x) / 63) ** 2;
    const along = Math.min(1, y / 40) ** 1.5 * Math.min(1, (63 - y) / 8);   // fades away towards the top, and a little at the ground
    image.data.set([255, 255, 255, 255 * across * along], (y * 64 + x) * 4);
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(c);
})();
const shaftMaterial = new THREE.MeshBasicMaterial({
  map: shaftTexture, color: 0xfff2c8, transparent: true, opacity: 0.2, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const sunDirection = sunFrom.clone().sub(sunTarget).normalize();
const shaft = new THREE.Group();
shaft.position.copy(sunTarget).addScaledVector(sunDirection, 6.4);
shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDirection);
[0, Math.PI / 2].forEach((angle) => {
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 13), shaftMaterial);
  sheet.rotation.y = angle;
  shaft.add(sheet);
});
scene.add(shaft);

// ---------- things in the room ----------

// Characters are a few plain boxes with all the detail painted on as pixels,
// the block-game way. A painter gets a small grid for each face of a box.
const CHAR_PX = 20;                        // painted pixels per tile of box size
const FACES = ['right', 'left', 'top', 'bottom', 'front', 'back'];
let faceSeed = 500;
// `paint` maps a side name to a painter; `all` covers the sides it does not name.
// All six faces of a box are painted side by side on one small sheet, so the box is one drawing, not six.
function paintedBox(parent, w, h, d, x, y, z, paint) {
  const size = { right: [d, h], left: [d, h], top: [w, d], bottom: [w, d], front: [w, h], back: [w, h] };
  const px = FACES.map((side) => size[side].map((units) => Math.max(1, Math.round(units * CHAR_PX))));
  const cellW = Math.max(...px.map((f) => f[0])) + 2;            // a pixel of margin round every face
  const cellH = Math.max(...px.map((f) => f[1])) + 2;
  const sheet = () => { const c = document.createElement('canvas'); c.width = cellW * 6; c.height = cellH; return c; };
  const colour = sheet();
  const light = sheet();                                        // only the pixels that shine by themselves
  const ctx = colour.getContext('2d');
  const lit = light.getContext('2d');
  lit.fillStyle = '#000000';
  lit.fillRect(0, 0, light.width, light.height);
  let shines = false;
  FACES.forEach((side, f) => {
    const [fw, fh] = px[f];
    const ox = f * cellW + 1;
    const oy = 1;
    for (const c of [ctx, lit]) { c.save(); c.beginPath(); c.rect(ox, oy, fw, fh); c.clip(); }      // a painter cannot spill onto the next face
    const g = {
      w: fw, h: fh, r: mulberry32(faceSeed++),
      rect(gx, gy, rw, rh, c) { ctx.fillStyle = c; ctx.fillRect(ox + gx, oy + gy, rw, rh); },
      px(gx, gy, c) { g.rect(gx, gy, 1, 1, c); },
      row(gy, c) { g.rect(0, gy, fw, 1, c); },
      column(gx, c) { g.rect(gx, 0, 1, fh, c); },
      speckle(c, share) { for (let k = 0; k < fw * fh * share; k++) g.px(Math.floor(g.r() * fw), Math.floor(g.r() * fh), c); },
      shine(gx, gy, c) { g.px(gx, gy, c); lit.fillStyle = c; lit.fillRect(ox + gx, oy + gy, 1, 1); shines = true; },
    };
    (paint[side] ?? paint.all)(g);
    ctx.restore();
    lit.restore();
    for (const [c, canvas] of [[ctx, colour], [lit, light]]) {  // stretch the edge pixels into the margin
      c.drawImage(canvas, ox, oy, fw, 1, ox, oy - 1, fw, 1);
      c.drawImage(canvas, ox, oy + fh - 1, fw, 1, ox, oy + fh, fw, 1);
      c.drawImage(canvas, ox, oy - 1, 1, fh + 2, ox - 1, oy - 1, 1, fh + 2);
      c.drawImage(canvas, ox + fw - 1, oy - 1, 1, fh + 2, ox + fw, oy - 1, 1, fh + 2);
    }
  });
  const texture = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const material = new THREE.MeshLambertMaterial({ map: texture(colour) });
  if (shines) { material.emissiveMap = texture(light); material.emissive.set(0xffffff); material.emissiveIntensity = 0.85; }
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {     // point each face at its own part of the sheet
    const k = f * 4 + v;
    uv.setXY(k, (f * cellW + 1 + uv.getX(k) * px[f][0]) / (cellW * 6), 1 - (1 + (1 - uv.getY(k)) * px[f][1]) / cellH);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// The door, shut, with runes on the lintel.
const door = new THREE.Group();
door.position.set(4.5, 0, -0.8);
box(door, 1.98, 1.98, 0.16, M.woodDark, 0, 0.99, 0);
box(door, 2.0, 0.14, 0.2, M.iron, 0, 0.45, 0.02);
box(door, 2.0, 0.14, 0.2, M.iron, 0, 1.55, 0.02);
box(door, 0.05, 1.98, 0.2, M.dark, 0, 0.99, 0.01);
box(door, 0.34, 0.4, 0.12, M.gold, 0, 1.0, 0.12);
box(door, 0.08, 0.14, 0.14, M.dark, 0, 0.96, 0.13);
scene.add(door);
const runes = [-0.62, 0, 0.62].map((dx) => box(scene, 0.24, 0.24, 0.06, M.rune.clone(), 4.5 + dx, 2.5, -0.48));
const runeLight = new THREE.PointLight(0x9a6cff, 5, 4.5, 2);
runeLight.position.set(4.5, 2.1, 0.3);
scene.add(runeLight);
runeLight.visible = false;                  // the runes glow on their own; a light here cost more than it showed
const runeHalo = glow(scene, 0x8a55ff, 3.2, 0.3, 4.5, 2.5, -0.3);

// The guardian: a stone golem in front of the door. Mossy plates, a cracked chest,
// and eyes and a sign that shine by themselves.
const TEAL = '#8ff0e4';
function stonePlate(g, base) {
  g.rect(0, 0, g.w, g.h, STONE[base]);
  g.speckle(STONE[base - 1], 0.07);
  g.row(0, STONE[base + 2]); g.column(0, STONE[base + 1]);
  g.row(g.h - 1, STONE[base - 1]); g.column(g.w - 1, STONE[base - 1]);
}
function mossOn(g, rows) {
  for (let x = 0; x < g.w; x++) {
    const depth = Math.floor(g.r() * (rows + 1));
    for (let y = 0; y < depth; y++) g.px(x, y, MOSS[y === depth - 1 ? 0 : 1 + Math.floor(g.r() * 2)]);
  }
}
const golem = new THREE.Group();
golem.position.set(4.5, 0, 0.1);
golem.scale.setScalar(1.45);                // a big one: he fills the doorway
[-0.24, 0.24].forEach((x) => paintedBox(golem, 0.34, 0.4, 0.4, x, 0.2, 0, {
  all: (g) => { stonePlate(g, 1); g.row(g.h - 3, STONE[0]); },
}));
const golemTop = new THREE.Group();
golemTop.position.y = 0.4;
paintedBox(golemTop, 0.98, 0.74, 0.62, 0, 0.37, 0, {
  all: (g) => { stonePlate(g, 2); g.row(Math.floor(g.h * 0.7), STONE[1]); mossOn(g, 2); },
  top: (g) => { stonePlate(g, 2); g.speckle(MOSS[1], 0.35); g.speckle(MOSS[2], 0.15); },
  front: (g) => {
    stonePlate(g, 2);
    g.row(11, STONE[1]);
    [[15, 2], [16, 3], [16, 4], [15, 5], [15, 6], [14, 7], [3, 9], [4, 10], [4, 12]].forEach(([x, y]) => g.px(x, y, STONE[0]));   // cracks
    mossOn(g, 3);
    [[10, 4], [9, 5], [11, 5], [8, 6], [12, 6], [9, 7], [11, 7], [10, 8], [10, 6]].forEach(([x, y]) => g.shine(x, y, TEAL));        // the sign
  },
});
paintedBox(golemTop, 0.5, 0.42, 0.5, 0, 0.95, 0.02, {
  all: (g) => { stonePlate(g, 3); },
  top: (g) => { stonePlate(g, 3); g.speckle(MOSS[1], 0.5); g.speckle(MOSS[2], 0.2); },
  front: (g) => {
    stonePlate(g, 3);
    g.rect(0, 1, g.w, 2, STONE[1]);                                           // a heavy brow
    [[2, 3], [3, 3], [2, 4], [3, 4], [6, 3], [7, 3], [6, 4], [7, 4]].forEach(([x, y]) => g.shine(x, y, TEAL));
    g.rect(1, 6, g.w - 2, 1, STONE[0]);                                        // the jaw line
    [2, 4, 6].forEach((x) => g.px(x, 6, STONE[4]));
  },
});
const golemArms = [-1, 1].map((side) => {
  const arm = new THREE.Group();
  arm.position.set(side * 0.66, 0.66, 0);
  paintedBox(arm, 0.3, 0.78, 0.36, 0, -0.34, 0, {
    all: (g) => {
      stonePlate(g, 1);
      g.rect(0, 0, g.w, 4, STONE[3]); g.row(4, STONE[0]);                      // the shoulder block
      g.rect(0, g.h - 4, g.w, 4, STONE[3]); g.row(g.h - 5, STONE[0]);          // the fist
      for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, STONE[1]);
      mossOn(g, 2);
    },
    top: (g) => { stonePlate(g, 3); g.speckle(MOSS[1], 0.5); },
  });
  golemTop.add(arm);
  return arm;
});
golem.add(golemTop);
scene.add(golem);
glow(golem, 0x45f0dc, 1.2, 0.12, 0, 1.38, 0.4);
block([4, 0], [5, 0]);

// The chest on its step, glowing through the gap under the lid.
const chest = new THREE.Group();
chest.position.set(1, 0.5, 0);
box(chest, 0.84, 0.44, 0.56, M.wood, 0, 0.22, 0);
[-0.27, 0.27].forEach((dx) => box(chest, 0.1, 0.46, 0.6, M.gold, dx, 0.22, 0));
box(chest, 0.74, 0.05, 0.48, M.goldGlow, 0, 0.455, 0);
const lid = new THREE.Group();
lid.position.set(0, 0.47, -0.29);                 // hinge at the back edge
box(lid, 0.88, 0.22, 0.6, M.wood, 0, 0.11, 0.29);
[-0.27, 0.27].forEach((dx) => box(lid, 0.1, 0.24, 0.64, M.gold, dx, 0.11, 0.29));
box(lid, 0.16, 0.2, 0.08, M.gold, 0, 0.04, 0.61);
chest.add(lid);
scene.add(chest);
const chestLight = new THREE.PointLight(0xffc040, 4, 4.5, 2);
chestLight.position.set(1, 1.25, 0.5);
scene.add(chestLight);
const chestHalo = glow(scene, 0xffb62e, 2.4, 0.26, 1, 1.0, 0.15);
block([1, 0]);

// A second chest, in the middle of the chamber behind the guarded door. No lock and no task:
// it holds a wizard's clothes. Like everything in that chamber, it shows once the hero has been inside.
const CHEST2 = { i: 5, j: -8 };
let chest2Seen = false;
let chest2Open = false;
const chest2 = new THREE.Group();
chest2.position.set(CHEST2.i, 0, CHEST2.j);
const darkWood = (g) => {
  g.rect(0, 0, g.w, g.h, '#5c4030'); g.speckle('#6b4b38', 0.1);
  for (let y = 3; y < g.h; y += 4) g.row(y, '#46301f');                              // the gaps between the planks
  for (const x of [2, g.w - 4]) { g.column(x, '#9aa1ab'); g.column(x + 1, '#6f7680'); }   // iron bands
  g.row(0, '#7c838e'); g.row(g.h - 1, '#3a2719');
};
// Hollow: a bottom and four walls, dark inside, so an empty chest looks empty.
const chestInside = (g) => { g.rect(0, 0, g.w, g.h, '#2e2016'); for (let y = 2; y < g.h; y += 4) g.row(y, '#24180f'); g.speckle('#3a2a1d', 0.06); };
const WALL = 0.05;
paintedBox(chest2, 0.84, WALL, 0.56, 0, WALL / 2, 0, { all: darkWood, top: chestInside });
paintedBox(chest2, 0.84, 0.44, WALL, 0, 0.22, 0.28 - WALL / 2, {
  all: darkWood,
  back: chestInside,
  front: (g) => { darkWood(g); const m = Math.floor(g.w / 2); g.rect(m - 1, 0, 3, 3, '#e3ac2a'); g.px(m, 1, '#3a2719'); },
});
paintedBox(chest2, 0.84, 0.44, WALL, 0, 0.22, -0.28 + WALL / 2, { all: darkWood, front: chestInside });
[-1, 1].forEach((side) => paintedBox(chest2, WALL, 0.44, 0.56 - 2 * WALL, side * (0.42 - WALL / 2), 0.22, 0, {
  all: darkWood, [side < 0 ? 'right' : 'left']: chestInside,
}));
// What lies in it. Each thing shows only while it is still in the chest; anything else put back is a bundle.
const chestHolds = {};
const inChest = (id, build) => { const g = new THREE.Group(); build(g); chest2.add(g); chestHolds[id] = g; };
const purple = (g) => { g.rect(0, 0, g.w, g.h, '#6a3fa0'); g.row(g.h - 1, '#4c2b78'); g.column(0, '#8358bd'); };
inChest('wizardRobe', (g) => paintedBox(g, 0.4, 0.1, 0.3, -0.14, 0.1, -0.05, {
  all: purple,
  top: (p) => { p.rect(0, 0, p.w, p.h, '#6a3fa0'); p.speckle('#8358bd', 0.15); [[2, 1], [5, 4], [6, 2]].forEach(([x, y]) => p.px(x, y, '#ffd35a')); p.row(0, '#e3ac2a'); },
}));
inChest('wizardHat', (g) => {
  paintedBox(g, 0.26, 0.03, 0.26, 0.2, 0.065, -0.07, { all: (p) => p.rect(0, 0, p.w, p.h, '#4c2b78') });
  paintedBox(g, 0.16, 0.08, 0.16, 0.2, 0.12, -0.07, { all: (p) => { purple(p); p.row(p.h - 1, '#e3ac2a'); } });
  paintedBox(g, 0.1, 0.07, 0.1, 0.2, 0.195, -0.08, { all: purple });
  paintedBox(g, 0.05, 0.06, 0.05, 0.2, 0.255, -0.1, { all: purple });
});
inChest('wizardBoots', (g) => [0.17, 0.28].forEach((x) => paintedBox(g, 0.09, 0.08, 0.15, x, 0.09, 0.13, { all: (p) => { purple(p); p.row(0, '#e3ac2a'); } })));
inChest('wand', (g) => {
  paintedBox(g, 0.44, 0.03, 0.03, -0.13, 0.065, 0.17, { all: (p) => { p.rect(0, 0, p.w, p.h, '#5c3a20'); p.row(0, '#8a5a34'); } });
  paintedBox(g, 0.05, 0.05, 0.05, 0.1, 0.075, 0.17, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, '#ff9a3a'); } });
});
inChest('magicCloak', (g) => paintedBox(g, 0.4, 0.1, 0.3, -0.14, 0.1, -0.05, {
  all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, '#4f3282'); },
  top: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, (x * 3 + y) % 5 ? '#4f3282' : '#c9a8ff'); },
}));
inChest('other', (g) => paintedBox(g, 0.24, 0.1, 0.18, -0.14, 0.1, -0.05, {
  all: (p) => { p.rect(0, 0, p.w, p.h, '#6b5038'); p.speckle('#58422f', 0.1); p.row(0, '#86694c'); },
}));
function showChestContents() {
  const ids = new Set(inventory.box.filter(Boolean).map((it) => it.id));
  for (const [id, g] of Object.entries(chestHolds)) if (id !== 'other') g.visible = ids.has(id);
  chestHolds.other.visible = [...ids].some((id) => !chestHolds[id] || id === 'other');
  let y = 0;                                         // the folded things lie in one pile, each on the one below
  for (const id of ['magicCloak', 'wizardRobe', 'other']) { chestHolds[id].position.y = y; if (chestHolds[id].visible) y += 0.1; }
}
const lid2 = new THREE.Group();
lid2.position.set(0, 0.47, -0.29);                // hinge at the back edge
paintedBox(lid2, 0.88, 0.22, 0.6, 0, 0.11, 0.29, { all: darkWood });
paintedBox(lid2, 0.16, 0.2, 0.08, 0, 0.04, 0.61, { all: (g) => { g.rect(0, 0, g.w, g.h, '#e3ac2a'); g.row(0, '#ffd35a'); g.row(g.h - 1, '#a87a16'); } });
chest2.add(lid2);
chest2.visible = false;
scene.add(chest2);
const chest2Skins = [];
chest2.traverse((node) => { if (node.isMesh) chest2Skins.push(node.material); });
if (MAP === 'dungeon') block([CHEST2.i, CHEST2.j]);

// Coins beside it.
for (let k = 0; k < 16; k++) {
  const s = 0.1 + rand() * 0.06;
  const coin = box(scene, s, s * 0.6, s, M.gold, 2 + (rand() - 0.5) * 0.6, 0.5 + s * 0.3 + (k % 3) * 0.06, (rand() - 0.5) * 0.5);
  coin.rotation.y = rand() * 3;
}
glow(scene, 0xffb62e, 1.3, 0.08, 2, 0.7, 0);
block([2, 0]);

// Banner behind the chest.
box(scene, 0.72, 1.2, 0.05, M.cloth, 1, 2.05, -0.46);
box(scene, 0.26, 0.26, 0.06, M.gold, 1, 2.2, -0.44).rotation.z = Math.PI / 4;
box(scene, 0.86, 0.08, 0.09, M.woodDark, 1, 2.68, -0.45);

// Barrels and crates in the far corner.
function barrel(i, j) {
  const g = new THREE.Group();
  g.position.set(i, 0, j);
  box(g, 0.58, 0.74, 0.58, M.wood, 0, 0.37, 0);
  box(g, 0.62, 0.08, 0.62, M.iron, 0, 0.18, 0);
  box(g, 0.62, 0.08, 0.62, M.iron, 0, 0.56, 0);
  scene.add(g);
  block([i, j]);
}
barrel(8, 0);
barrel(9, 0);
box(scene, 0.7, 0.7, 0.7, M.wood, 9, 0.35, 1);
box(scene, 0.46, 0.46, 0.46, M.woodDark, 8.95, 0.93, 1.02).rotation.y = 0.4;
block([9, 1]);

// Crystals by the left wall.
const crystals = new THREE.Group();
[[0, 6.1, 0.9, 0.26], [0.32, 6.5, 0.55, 0.2], [-0.12, 6.75, 1.25, 0.3], [0.3, 7.05, 0.4, 0.18], [0.02, 5.72, 0.36, 0.16]]
  .forEach(([x, z, h, w]) => {
    const c = box(crystals, w, h, w, M.teal.clone(), x, h / 2, z);
    c.rotation.set((rand() - 0.5) * 0.3, rand() * 1.5, (rand() - 0.5) * 0.3);
  });
scene.add(crystals);
const crystalLight = new THREE.PointLight(0x7fd8cf, 3.0, 5, 2);
crystalLight.position.set(0.5, 0.9, 6.5);
scene.add(crystalLight);
crystalLight.visible = false;
const crystalHalo = glow(scene, 0x2fe0cc, 3.0, 0.3, 0.1, 0.7, 6.5);
block([0, 6], [0, 7]);

// Markers that say "this can be opened".
function beacon(material, x, y, z) {
  const m = box(scene, 0.2, 0.2, 0.2, material, x, y, z);
  m.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  return m;
}
const beacons = [
  { mesh: beacon(M.goldGlow, 1, 1.75, 0), y: 1.75 },
  { mesh: beacon(M.rune, 4.5, 2.05, 0.1), y: 2.05 },
];

const propsTo = scene.children.length;
// ---------- the hero ----------

const SKIN = '#d9a074', SKIN_DARK = '#bd8457', SKIN_LIGHT = '#e3b085';
const HAIR = '#5a3a22', HAIR_LIGHT = '#74492b', HAIR_DARK = '#402816';
const TEE = '#efebe1', TEE_DARK = '#cdc7b9';
const SHORTS = '#7b8aa1', SHORTS_DARK = '#5d6b81';
const TUNIC = '#2f6fbf', TUNIC_LIGHT = '#4d8ad6', TUNIC_DARK = '#22528c';
const SCARF = '#b8322c', SCARF_DARK = '#8a2420';
const LEATHER = '#4c3122', BUCKLE = '#e3ac2a';
const TROUSERS = '#2c3150', TROUSERS_LIGHT = '#3b4267';
const BOOT = '#4a3222', BOOT_LIGHT = '#66452f';
const PACK = '#8c4b2f', PACK_LIGHT = '#aa6541', PACK_DARK = '#693622';
const DRAB = '#735840', DRAB_LIGHT = '#86694c', DRAB_DARK = '#58422f';        // cheap undyed cloth
const PANTS = '#5c4836', PANTS_LIGHT = '#6e5843', PANTS_DARK = '#453527';
const CLOAK = '#5e4532', CLOAK_LIGHT = '#70553f', CLOAK_DARK = '#402e20';
const ROPE = '#c2a878', ROPE_DARK = '#9c8458';
const ROBE = '#6a3fa0', ROBE_LIGHT = '#8358bd', ROBE_DARK = '#4c2b78';
const IRON = ['#7c838e', '#9aa1ab', '#b6bcc5', '#d0d5db', '#e3e6ea'];

// The hero himself wears only a white shirt and shorts. Everything else is an item from the
// inventory: a set of slightly larger boxes over his parts, shown only while that item is worn.
let heroBoxes = 0;
const piece = (...args) => { heroBoxes++; return paintedBox(...args); };
const cloth = (base, light, dark) => (g) => { g.rect(0, 0, g.w, g.h, base); g.column(0, light); g.column(g.w - 1, dark); g.row(g.h - 1, dark); };
const flat = (base, light, dark) => (g) => { g.rect(0, 0, g.w, g.h, base); g.row(0, light); g.row(g.h - 1, dark); };
const skin = (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.column(0, SKIN_LIGHT); g.row(g.h - 1, SKIN_DARK); };
const tee = (g) => { g.rect(0, 0, g.w, g.h, TEE); g.column(g.w - 1, TEE_DARK); g.row(g.h - 1, TEE_DARK); };
const iron = (g) => {
  g.rect(0, 0, g.w, g.h, IRON[2]); g.speckle(IRON[1], 0.08);
  g.row(0, IRON[4]); g.column(0, IRON[3]); g.row(g.h - 1, IRON[0]); g.column(g.w - 1, IRON[1]);
  [[1, 1], [g.w - 2, 1], [1, g.h - 2], [g.w - 2, g.h - 2]].forEach(([x, y]) => g.px(x, y, IRON[0]));        // rivets
};

const hero = new THREE.Group();
const heroBody = new THREE.Group();
hero.add(heroBody);

const outfit = {};                        // item id -> the groups that are shown while it is worn
function worn(id, parent, build) {
  const group = new THREE.Group();
  group.userData.outfit = id;
  parent.add(group);
  build(group);
  (outfit[id] ??= []).push(group);
  return group;
}

// Legs: thigh, shin and foot. Each leg turns at the hip and bends at the knee.
const legs = [-1, 1].map((side) => {
  const hip = new THREE.Group();
  hip.position.set(side * 0.1, 0.52, 0);
  piece(hip, 0.15, 0.24, 0.17, 0, -0.12, 0, { all: (g) => { skin(g); g.rect(0, 0, g.w, 3, SHORTS); g.row(2, SHORTS_DARK); } });    // the legs of the shorts
  const knee = new THREE.Group();
  knee.position.y = -0.24;
  hip.add(knee);
  piece(knee, 0.13, 0.17, 0.15, 0, -0.085, 0, { all: skin });
  const ankle = new THREE.Group();                 // the foot turns here: toes up as it lands, down as it pushes off
  ankle.position.set(0, -0.15, 0);
  knee.add(ankle);
  piece(ankle, 0.12, 0.08, 0.13, 0, -0.03, 0, { all: skin });
  piece(ankle, 0.14, 0.07, 0.23, 0, -0.095, 0.03, {
    all: skin,
    front: (g) => { skin(g); for (let x = 0; x < g.w; x++) g.px(x, 0, SKIN_LIGHT); },
    top: (g) => { g.rect(0, 0, g.w, g.h, SKIN); for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, SKIN_DARK); },          // toes
  });
  heroBody.add(hip);
  return { hip, knee, ankle };
});

// Shorts, a white shirt, the neck.
piece(heroBody, 0.4, 0.1, 0.22, 0, 0.56, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SHORTS); g.row(0, TEE_DARK); g.row(g.h - 1, SHORTS_DARK); } });
piece(heroBody, 0.39, 0.37, 0.2, 0, 0.795, 0, {
  all: tee,
  front: (g) => { tee(g); g.rect(3, 0, 2, 1, SKIN); },                          // the neckline
});
piece(heroBody, 0.16, 0.08, 0.14, 0, 1.02, 0, { all: skin });

// Arms: a short sleeve, the forearm and the hand. Each arm turns at the shoulder and bends at the elbow.
const arms = [-1, 1].map((side) => {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.29, 0.94, 0);
  piece(shoulder, 0.13, 0.21, 0.15, 0, -0.135, 0, { all: (g) => { skin(g); g.rect(0, 0, g.w, 2, TEE); g.row(1, TEE_DARK); }, top: tee });
  const elbow = new THREE.Group();
  elbow.position.y = -0.23;
  shoulder.add(elbow);
  piece(elbow, 0.12, 0.17, 0.14, 0, -0.08, 0, { all: skin });
  piece(elbow, 0.13, 0.1, 0.14, 0, -0.21, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.row(g.h - 1, SKIN_DARK); } });
  heroBody.add(shoulder);
  return { shoulder, elbow };
});

// The head, with the hair as its own pieces: a cap, the back, and a fringe.
const head = new THREE.Group();
head.position.y = 1.05;
piece(head, 0.38, 0.36, 0.36, 0, 0.18, 0, {
  all: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.row(g.h - 1, SKIN_DARK); },
  front: (g) => {
    g.rect(0, 0, g.w, g.h, SKIN);
    g.rect(1, 2, 2, 1, HAIR_DARK); g.rect(5, 2, 2, 1, HAIR_DARK);              // eyebrows
    g.px(1, 3, '#ffffff'); g.px(2, 3, '#27365f'); g.px(5, 3, '#27365f'); g.px(6, 3, '#ffffff');
    g.rect(3, 4, 2, 1, SKIN_DARK);                                             // nose
    g.rect(2, 5, 4, 1, '#8f4a3a'); g.rect(3, 5, 2, 1, '#b05e4b');              // mouth
    g.row(g.h - 1, SKIN_DARK);
  },
  right: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.px(3, 3, SKIN_DARK); g.row(g.h - 1, SKIN_DARK); },    // an ear
  left: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.px(g.w - 4, 3, SKIN_DARK); g.row(g.h - 1, SKIN_DARK); },
});
const hairPiece = (g) => { g.rect(0, 0, g.w, g.h, HAIR); g.speckle(HAIR_LIGHT, 0.18); g.row(g.h - 1, HAIR_DARK); };
piece(head, 0.42, 0.12, 0.4, 0, 0.37, -0.01, { all: hairPiece, top: (g) => { g.rect(0, 0, g.w, g.h, HAIR); g.speckle(HAIR_LIGHT, 0.2); g.rect(2, 2, 1, 5, HAIR_DARK); } });
piece(head, 0.42, 0.26, 0.1, 0, 0.2, -0.17, { all: hairPiece });
piece(head, 0.26, 0.08, 0.05, -0.07, 0.28, 0.19, { all: hairPiece });
heroBody.add(head);

// ---------- what the hero can wear ----------

// The traveller's clothes he used to have on: a blue tunic with a scarf, dark trousers, leather boots, a pack.
const tunic = (g) => { cloth(TUNIC, TUNIC_LIGHT, TUNIC_DARK)(g); g.row(g.h - 2, TUNIC_DARK); };
const scarfTail = new THREE.Group();                                           // hangs from the knot, so it can swing
scarfTail.position.set(0.09, 0.985, 0.13);
piece(scarfTail, 0.11, 0.17, 0.04, 0, -0.085, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SCARF); g.row(g.h - 1, SCARF_DARK); g.column(0, '#cf4a42'); } });
worn('tunic', heroBody, (o) => {
  piece(o, 0.43, 0.1, 0.25, 0, 0.56, 0, {                                      // belt with a buckle
    all: (g) => { g.rect(0, 0, g.w, g.h, LEATHER); g.row(0, '#6a4630'); },
    front: (g) => { g.rect(0, 0, g.w, g.h, LEATHER); g.row(0, '#6a4630'); g.rect(3, 0, 3, 2, BUCKLE); g.px(4, 1, LEATHER); },
  });
  piece(o, 0.4, 0.38, 0.22, 0, 0.8, 0, {
    all: tunic,
    front: (g) => {
      tunic(g);
      for (let k = 0; k < 6; k++) g.px(1 + k, 1 + k, LEATHER);                 // a strap across the chest
      g.px(4, 2, TUNIC_LIGHT); g.px(4, 4, TUNIC_LIGHT);                        // two buttons
    },
  });
  piece(o, 0.44, 0.09, 0.27, 0, 1.01, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SCARF); g.row(g.h - 1, SCARF_DARK); } });
  o.add(scarfTail);
  [-1, 1].forEach((side) => piece(o, 0.18, 0.09, 0.21, side * 0.29, 0.97, 0, {   // leather pads on the shoulders
    all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(0, PACK_LIGHT); g.row(g.h - 1, PACK_DARK); },
    top: (g) => { g.rect(0, 0, g.w, g.h, PACK_LIGHT); g.px(1, 1, BUCKLE); g.px(g.w - 2, g.h - 2, BUCKLE); },
  }));
});
const pack = new THREE.Group();                                                // pack and bedroll bounce together
piece(pack, 0.3, 0.32, 0.14, 0, 0.76, -0.18, {
  all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(g.h - 1, PACK_DARK); g.column(0, PACK_LIGHT); },
  back: (g) => {
    g.rect(0, 0, g.w, g.h, PACK);
    g.rect(0, 0, g.w, 3, PACK_LIGHT); g.row(3, PACK_DARK);                     // the flap
    g.rect(2, 3, 2, 2, BUCKLE);
    g.row(g.h - 1, PACK_DARK);
  },
});
piece(pack, 0.38, 0.1, 0.12, 0, 0.98, -0.2, {
  all: (g) => { g.rect(0, 0, g.w, g.h, MOSS[1]); g.column(1, LEATHER); g.column(g.w - 2, LEATHER); g.row(0, MOSS[2]); },
});
worn('pack', heroBody, (o) => o.add(pack));

// The poor clothes he starts in: a patched shirt with a rope for a belt, short trousers, plain shoes, a cloak.
const drab = (g) => { cloth(DRAB, DRAB_LIGHT, DRAB_DARK)(g); g.speckle(DRAB_DARK, 0.07); };
const pants = (g) => { cloth(PANTS, PANTS_LIGHT, PANTS_DARK)(g); g.speckle(PANTS_DARK, 0.06); };
const cloakCloth = (g) => { cloth(CLOAK, CLOAK_LIGHT, CLOAK_DARK)(g); g.speckle(CLOAK_DARK, 0.08); };
worn('shirt', heroBody, (o) => {
  piece(o, 0.4, 0.38, 0.22, 0, 0.8, 0, {
    all: drab,
    front: (g) => {
      drab(g);
      g.rect(3, 0, 2, 2, SKIN); g.px(3, 2, DRAB_DARK); g.px(4, 2, DRAB_DARK);   // an open neck with a lace
      g.rect(5, 4, 2, 2, DRAB_LIGHT); g.px(5, 4, DRAB_DARK);                    // a patch
    },
  });
  piece(o, 0.425, 0.1, 0.245, 0, 0.56, 0, {                                      // the hem, uneven at the bottom
    all: (g) => { drab(g); for (let x = 0; x < g.w; x += 3) g.px(x, g.h - 1, DRAB_LIGHT); },
  });
  piece(o, 0.44, 0.05, 0.26, 0, 0.625, 0, {
    all: (g) => { g.rect(0, 0, g.w, g.h, ROPE); for (let x = 1; x < g.w; x += 2) g.px(x, 0, ROPE_DARK); },
  });
});
const cloak = new THREE.Group();                                               // hangs from the shoulders and swings behind him
cloak.position.set(0, 1.0, -0.13);
piece(cloak, 0.5, 0.66, 0.05, 0, -0.33, -0.03, {
  all: cloakCloth,
  back: (g) => {
    cloakCloth(g);
    for (const x of [2, 5, 8]) g.column(x, CLOAK_DARK);                         // folds
    for (let x = 0; x < g.w; x += 3) g.px(x, g.h - 1, CLOAK_LIGHT);             // a worn hem
    g.rect(6, 8, 2, 2, DRAB); g.px(6, 8, CLOAK_DARK);                           // a patch
  },
});
piece(cloak, 0.3, 0.12, 0.1, 0, -0.08, -0.08, { all: cloakCloth });             // the hood, lying on his back
worn('cloak', heroBody, (o) => {
  piece(o, 0.5, 0.08, 0.3, 0, 1.01, 0, {                                        // over the shoulders, held by a pin
    all: (g) => { g.rect(0, 0, g.w, g.h, CLOAK); g.row(0, CLOAK_LIGHT); g.row(g.h - 1, CLOAK_DARK); },
    front: (g) => { g.rect(0, 0, g.w, g.h, CLOAK); g.row(g.h - 1, CLOAK_DARK); g.px(Math.floor(g.w / 2), 0, BUCKLE); },
  });
  o.add(cloak);
});

// The magic cloak: its cloth shines by itself, a dim violet with bright threads, and it lights the way a little.
const MAGIC = '#4f3282', MAGIC_GLOW = '#c9a8ff';
const magicCloth = (g) => {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.shine(x, y, (x + y) % 7 === 0 ? '#6a48a8' : MAGIC);
  for (let x = 0; x < g.w; x++) g.shine(x, g.h - 1, MAGIC_GLOW);                  // a glowing hem
};
const magicCloak = new THREE.Group();
magicCloak.position.set(0, 1.0, -0.13);
piece(magicCloak, 0.52, 0.68, 0.05, 0, -0.34, -0.03, {
  all: magicCloth,
  back: (g) => { magicCloth(g); [[2, 3], [7, 5], [4, 9], [8, 10], [3, 12]].forEach(([x, y]) => g.shine(x, y, MAGIC_GLOW)); },
});
piece(magicCloak, 0.3, 0.12, 0.1, 0, -0.08, -0.08, { all: magicCloth });
worn('magicCloak', heroBody, (o) => {
  piece(o, 0.5, 0.08, 0.3, 0, 1.01, 0, { all: magicCloth, front: (g) => { magicCloth(g); g.shine(Math.floor(g.w / 2), 0, '#ffe08a'); } });
  o.add(magicCloak);
});

// The wizard's clothes from the chest in the far chamber: a pointed hat, a robe, shoes with curled toes.
const robe = cloth(ROBE, ROBE_LIGHT, ROBE_DARK);
const stars = (spots) => (g) => { robe(g); spots.forEach(([x, y]) => g.px(x, y, '#ffd35a')); };
worn('wizardHat', head, (o) => {
  piece(o, 0.62, 0.04, 0.6, 0, 0.42, -0.01, { all: (g) => g.rect(0, 0, g.w, g.h, ROBE_DARK), top: robe });      // the brim
  piece(o, 0.44, 0.13, 0.42, 0, 0.495, -0.01, {
    all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); },                           // a gold band
    front: (g) => { robe(g); g.row(g.h - 1, BUCKLE); g.rect(Math.floor(g.w / 2) - 1, g.h - 2, 2, 2, '#ffd35a'); },
  });
  piece(o, 0.32, 0.13, 0.3, 0, 0.62, -0.03, { all: stars([[1, 1], [4, 0]]) });
  piece(o, 0.2, 0.13, 0.2, 0, 0.74, -0.06, { all: stars([[2, 1]]) });
  piece(o, 0.11, 0.1, 0.11, 0, 0.84, -0.11, { all: robe });                     // the tip leans back
});
worn('wizardRobe', heroBody, (o) => {
  piece(o, 0.42, 0.39, 0.24, 0, 0.805, 0, {
    all: stars([[1, 2], [5, 5]]),
    front: (g) => { robe(g); g.column(3, BUCKLE); g.column(4, '#a87a16'); g.px(1, 2, '#ffd35a'); g.px(6, 4, '#ffd35a'); },
  });
  piece(o, 0.45, 0.1, 0.27, 0, 0.56, 0, {                                        // a gold sash
    all: flat(BUCKLE, '#ffd35a', '#a87a16'),
    front: (g) => { flat(BUCKLE, '#ffd35a', '#a87a16')(g); g.rect(Math.floor(g.w / 2) - 1, 0, 2, g.h, '#a87a16'); },
  });
  piece(o, 0.44, 0.07, 0.27, 0, 1.0, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, ROBE_DARK); g.row(0, BUCKLE); } });
});

// Iron: a helmet, a breastplate with mail sleeves, leg guards over padding, boots.
const mail = (g) => {
  g.rect(0, 0, g.w, g.h, IRON[1]);
  for (let y = 0; y < g.h; y++) for (let x = (y % 2); x < g.w; x += 2) g.px(x, y, IRON[0]);
};
const padding = cloth('#3a3d45', '#4a4e58', '#2a2c33');
worn('helmet', head, (o) => {
  piece(o, 0.46, 0.22, 0.44, 0, 0.345, 0, { all: iron, front: (g) => { iron(g); g.row(g.h - 2, IRON[0]); } });
  [-1, 1].forEach((side) => piece(o, 0.05, 0.22, 0.4, side * 0.215, 0.17, -0.01, { all: iron }));
  piece(o, 0.46, 0.22, 0.06, 0, 0.17, -0.215, { all: iron });
});
worn('chest', heroBody, (o) => piece(o, 0.46, 0.36, 0.26, 0, 0.81, 0, {
  all: iron,
  front: (g) => { iron(g); g.column(Math.floor(g.w / 2), IRON[1]); g.row(Math.floor(g.h / 2), IRON[1]); },
}));
worn('legs', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: padding }));
worn('trousers', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: cloth(TROUSERS, TROUSERS_LIGHT, '#22263f') }));
worn('pants', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: pants }));

arms.forEach((arm) => {
  worn('tunic', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: cloth(TUNIC, TUNIC_LIGHT, TUNIC_DARK) }));
  worn('tunic', arm.elbow, (o) => piece(o, 0.15, 0.17, 0.17, 0, -0.08, 0, {      // a leather bracer
    all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(0, PACK_LIGHT); g.row(g.h - 1, PACK_DARK); g.px(1, 1, BUCKLE); },
  }));
  worn('shirt', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: drab }));
  worn('shirt', arm.elbow, (o) => piece(o, 0.13, 0.11, 0.15, 0, -0.045, 0, {     // the sleeve stops short of the wrist
    all: (g) => { drab(g); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, DRAB_LIGHT); },
  }));
  worn('wizardRobe', arm.shoulder, (o) => piece(o, 0.15, 0.22, 0.17, 0, -0.13, 0, { all: robe }));
  worn('wizardRobe', arm.elbow, (o) => piece(o, 0.17, 0.16, 0.19, 0, -0.085, 0, { all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); } }));    // a wide sleeve with a gold cuff
  worn('chest', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: mail, top: iron }));
});
legs.forEach((leg, k) => {
  const side = k ? 1 : -1;
  worn('trousers', leg.hip, (o) => piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: cloth(TROUSERS, TROUSERS_LIGHT, '#22263f') }));
  worn('trousers', leg.knee, (o) => piece(o, 0.15, 0.18, 0.17, 0, -0.08, 0, {
    all: (g) => { cloth(TROUSERS, TROUSERS_LIGHT, '#22263f')(g); g.row(0, '#22263f'); g.row(2, LEATHER); },     // a strap under the knee
  }));
  worn('leatherBoots', leg.ankle, (o) => piece(o, 0.19, 0.14, 0.27, 0, -0.06, 0.03, {
    all: (g) => { g.rect(0, 0, g.w, g.h, BOOT); g.row(0, BOOT_LIGHT); g.row(g.h - 1, '#2f1f15'); },
    top: (g) => { g.rect(0, 0, g.w, g.h, BOOT); g.rect(0, g.h - 2, g.w, 2, BOOT_LIGHT); },                       // the toe cap
    front: (g) => { g.rect(0, 0, g.w, g.h, BOOT_LIGHT); g.row(g.h - 1, '#2f1f15'); },
  }));
  worn('pants', leg.hip, (o) => piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: pants }));
  worn('pants', leg.knee, (o) => piece(o, 0.15, 0.14, 0.17, 0, -0.06, 0, {       // short in the leg
    all: (g) => { pants(g); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, PANTS_LIGHT); },
    front: (g) => { pants(g); g.rect(0, 0, 2, 2, DRAB_LIGHT); g.px(1, 1, PANTS_DARK); },                         // a patch on the knee
  }));
  worn('shoes', leg.ankle, (o) => piece(o, 0.18, 0.11, 0.26, 0, -0.075, 0.03, {
    all: (g) => { g.rect(0, 0, g.w, g.h, CLOAK_DARK); g.row(g.h - 1, '#2f2118'); },
    top: (g) => { g.rect(0, 0, g.w, g.h, CLOAK_DARK); g.row(1, ROPE_DARK); },                                    // tied with a cord
  }));
  worn('wizardRobe', leg.hip, (o) => piece(o, 0.215, 0.36, 0.25, side * 0.008, -0.18, 0, {                        // the skirt of the robe, one half on each leg
    all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); },
  }));
  worn('wizardBoots', leg.ankle, (o) => {
    piece(o, 0.2, 0.15, 0.27, 0, -0.055, 0.03, { all: (g) => { robe(g); g.row(0, BUCKLE); } });
    piece(o, 0.1, 0.07, 0.08, 0, -0.095, 0.2, { all: robe });                   // the curled toe
    piece(o, 0.06, 0.07, 0.05, 0, -0.05, 0.235, { all: flat(BUCKLE, '#ffd35a', '#a87a16') });
  });
  worn('legs', leg.hip, (o) => {
    piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: padding });
    piece(o, 0.21, 0.2, 0.23, 0, -0.1, 0, { all: iron });
  });
  worn('legs', leg.knee, (o) => {
    piece(o, 0.15, 0.18, 0.17, 0, -0.08, 0, { all: padding });
    piece(o, 0.19, 0.13, 0.21, 0, -0.07, 0, { all: iron });
  });
  worn('boots', leg.ankle, (o) => piece(o, 0.23, 0.17, 0.31, 0, -0.055, 0.03, { all: iron, top: (g) => { iron(g); g.rect(0, g.h - 3, g.w, 3, IRON[3]); } }));
});
// The light around the hero. It shines only while he holds a torch (see the inventory).
const lantern = new THREE.PointLight(0xffc27a, 9, 5.5, 2);
scene.add(lantern);
const lanternHalo = glow(hero, 0xffa040, 1.5, 0.35, 0.28, 0.24, 0.02);
scene.add(hero);

let heroTile = { i: 7, j: 5 };
const tilePos = (t) => new THREE.Vector3(t.i, tileY(t.i, t.j), t.j);
hero.position.copy(tilePos(heroTile));
hero.rotation.y = Math.PI;                // faces the door at the start

// ---------- above ground: the surface's own light, the small things, and the cave door ----------
let caveDoor = null;
let caveDoorOpen = false;
let surfaceSun = null;
if (MAP === 'surface') {
  scene.children.slice(propsFrom, propsTo).forEach((child) => { child.visible = false; });
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b5a3a, 1.5));
  surfaceSun = new THREE.DirectionalLight(0xfff0d8, 2.3);
  surfaceSun.castShadow = true;
  surfaceSun.shadow.mapSize.set(2048, 2048);
  Object.assign(surfaceSun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  surfaceSun.shadow.bias = -0.0006;
  surfaceSun.shadow.normalBias = 0.03;
  scene.add(surfaceSun, surfaceSun.target);
  const skyFill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
  skyFill.position.set(-4, 8, 14);
  scene.add(skyFill);

  // Grass blades and flowers: thousands of tiny boxes, drawn as a few batches.
  const tr = mulberry32(31);
  const blades = [];
  const petals = PETALS.map(() => []);
  for (const { kind, x, z } of surfaceProps) {
    if (kind !== 'flowers') continue;
    for (let k = 0, n = 2 + Math.floor(tr() * 3); k < n; k++) blades.push([x + (tr() - 0.5) * 0.8, z + (tr() - 0.5) * 0.8, 0.05, 0.1 + tr() * 0.14]);
    if (tr() < 0.55) {
      const fx = x + (tr() - 0.5) * 0.6, fz = z + (tr() - 0.5) * 0.6;
      blades.push([fx, fz, 0.04, 0.2]);
      petals[Math.floor(tr() * PETALS.length)].push([fx, fz]);
    }
  }
  const batch = (material, items, place) => {
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    items.forEach((it, k) => {
      const { position, scale } = place(it);
      turn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tr() * 1.5);
      mesh.setMatrixAt(k, matrix.compose(position, turn, scale));
    });
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  batch(M.blade, blades, ([x, z, w, h]) => ({ position: new THREE.Vector3(x, h / 2, z), scale: new THREE.Vector3(w, h, w) }));
  PETALS.forEach((material, k) => batch(material, petals[k], ([x, z]) => ({ position: new THREE.Vector3(x, 0.23, z), scale: new THREE.Vector3(0.11, 0.09, 0.11) })));

  const stripes = (g) => { for (let x = 0; x < g.w; x++) g.column(x, Math.floor(x / 3) % 2 ? '#efe2c0' : '#c2302e'); g.row(g.h - 1, '#8a2420'); };
  for (const { kind, x, z } of surfaceProps) {
    if (kind === 'well') {                                    // two posts and a little roof over the well
      [-0.38, 0.38].forEach((dx) => box(scene, 0.1, 1.1, 0.1, M.woodDark, x + dx, 1.25, z));
      box(scene, 1.1, 0.12, 0.8, M.wood, x, 1.86, z);
      box(scene, 0.7, 0.1, 0.5, M.woodDark, x, 1.97, z);
      box(scene, 0.06, 0.5, 0.06, M.iron, x, 1.5, z);
    } else if (kind === 'stall') {                            // a striped awning over the counter
      [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]].forEach(([dx, dz]) => box(scene, 0.07, 1.5, 0.07, M.woodDark, x + dx, 0.85, z + dz));
      paintedBox(scene, 1.06, 0.14, 1.06, x, 1.66, z, { all: stripes });
      box(scene, 0.3, 0.16, 0.3, PETALS[1], x - 0.15, 0.68, z + 0.1);
      box(scene, 0.26, 0.14, 0.26, PETALS[0], x + 0.2, 0.67, z - 0.1);
    } else if (kind === 'sign') {
      box(scene, 0.1, 1.0, 0.1, M.woodDark, x, 0.5, z);
      box(scene, 0.7, 0.3, 0.06, M.wood, x, 0.95, z + 0.06);
      box(scene, 0.5, 0.04, 0.02, M.dark, x, 0.99, z + 0.1);
      box(scene, 0.34, 0.04, 0.02, M.dark, x - 0.08, 0.9, z + 0.1);
    } else if (kind === 'lamp') {
      box(scene, 0.1, 1.5, 0.1, M.woodDark, x, 0.75, z);
      box(scene, 0.3, 0.06, 0.3, M.iron, x, 1.52, z);
      box(scene, 0.2, 0.24, 0.2, M.flameCore, x, 1.68, z);
      box(scene, 0.3, 0.06, 0.3, M.iron, x, 1.83, z);
    }
  }
  // the cave door, made like the door in the dungeon; it starts open, the hero comes out, it shuts
  caveDoor = new THREE.Group();
  caveDoor.position.set(CAVE.x, -2.1, CAVE.z + 0.45);
  box(caveDoor, 0.96, 1.94, 0.12, M.woodDark, 0, 0.97, 0);
  box(caveDoor, 0.98, 0.12, 0.16, M.iron, 0, 0.45, 0.02);
  box(caveDoor, 0.98, 0.12, 0.16, M.iron, 0, 1.5, 0.02);
  box(caveDoor, 0.04, 1.94, 0.16, M.dark, 0, 0.97, 0.01);
  box(caveDoor, 0.22, 0.28, 0.1, M.gold, 0.25, 1.0, 0.09);
  scene.add(caveDoor);
  caveDoorOpen = true;
  torch(CAVE.x - 0.72, 1.5, CAVE.z + 0.55, 0, 1, 0.5);
  torch(CAVE.x + 0.72, 1.5, CAVE.z + 0.55, 0, 1, 0.5);
}

// ---------- the path and walking in steps ----------

const printTexture = (() => {
  const rows = ['.###..', '#####.', '######', '######', '.#####', '.####.', '......', '.####.', '.####.', '..##..'];
  const c = document.createElement('canvas');
  c.width = 6; c.height = 10;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  rows.forEach((row, y) => [...row].forEach((dot, x) => { if (dot === '#') ctx.fillRect(x, y, 1, 1); }));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
})();
const printMaterial = (color) => new THREE.MeshBasicMaterial({
  map: printTexture, color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
});
const PRINT = { near: printMaterial(0xffd35a) };
const printShape = new THREE.PlaneGeometry(0.17, 0.28);
const markers = Array.from({ length: 80 }, () => {            // two footprints for every step
  const mesh = new THREE.Mesh(printShape, PRINT.near);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.x = -Math.PI / 2;                            // lies flat; then it is turned to face the way of walking
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
});
// Where the hero will arrive: the hero himself, with his own textures, but faint,
// washed of colour, so he melts into what is behind him.
const ghostMaterials = [];
const fadedCopy = (material) => {
  const faded = material.clone();
  faded.transparent = true;
  faded.opacity = 0.4;
  if (!faded.emissiveMap) faded.emissive.set(0x23272c);      // a little flat grey takes the colour down
  ghostMaterials.push(faded);
  return faded;
};
const target = hero.clone(true);
[...target.children].filter((node) => node.isSprite).forEach((node) => target.remove(node));
target.traverse((node) => {
  if (!node.isMesh) return;
  node.material = Array.isArray(node.material) ? node.material.map(fadedCopy) : fadedCopy(node.material);
  node.castShadow = false;
  node.receiveShadow = false;
});
// Draw the nearest parts first, so the parts behind them are skipped and nothing shows through twice.
const ghostSpot = new THREE.Vector3();
function orderGhost() {
  target.updateMatrixWorld(true);
  target.traverse((node) => {
    if (!node.isMesh) return;
    node.getWorldPosition(ghostSpot);
    node.renderOrder = 100 - (ghostSpot.x + ghostSpot.y + ghostSpot.z) * 10;
  });
}
target.visible = false;
scene.add(target);
const ghostOutfit = [];
target.traverse((node) => { if (node.userData.outfit) ghostOutfit.push(node); });

// Finding the way: the cheapest path over the tiles, in eight directions.
// It does not cut a corner, it likes the road better than the grass, and a straight line better than a zigzag.
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const TURN_COST = 0.35;
const groundCost = (i, j) => (MAP === 'surface' && !roadCells.has(key(i, j)) ? 1.3 : 1);
function findPath(from, to) {
  if (from.i === to.i && from.j === to.j) return [];
  if (!walkable(to.i, to.j)) return null;
  const startId = `${from.i},${from.j},8`;
  const best = new Map([[startId, 0]]);
  const cameFrom = new Map();
  const guess = (i, j) => { const dx = Math.abs(i - to.i), dz = Math.abs(j - to.j); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  // a small heap, cheapest first: [guess of the whole way, cost so far, i, j, direction walked]
  const heap = [[guess(from.i, from.j), 0, from.i, from.j, 8]];
  const push = (node) => {
    let k = heap.push(node) - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent][0] <= heap[k][0]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const a = k * 2 + 1, b = a + 1;
        let least = k;
        if (a < heap.length && heap[a][0] < heap[least][0]) least = a;
        if (b < heap.length && heap[b][0] < heap[least][0]) least = b;
        if (least === k) break;
        [heap[least], heap[k]] = [heap[k], heap[least]];
        k = least;
      }
    }
    return top;
  };
  while (heap.length) {
    const [, cost, i, j, facing] = pop();
    const id = `${i},${j},${facing}`;
    if (cost > best.get(id)) continue;
    if (i === to.i && j === to.j) {
      const path = [];
      for (let at = id; at !== startId; at = cameFrom.get(at)) { const [pi, pj] = at.split(',').map(Number); path.unshift({ i: pi, j: pj }); }
      return path;
    }
    for (let d = 0; d < 8; d++) {
      const [di, dj] = DIRECTIONS[d];
      const ni = i + di, nj = j + dj;
      if (!walkable(ni, nj)) continue;
      if (d > 3 && (!walkable(i + di, j) || !walkable(i, j + dj))) continue;            // no squeezing past a corner
      const next = cost + (d > 3 ? 1.414 : 1) * groundCost(ni, nj) + (facing !== 8 && facing !== d ? TURN_COST : 0);
      const nid = `${ni},${nj},${d}`;
      if (next >= (best.get(nid) ?? Infinity)) continue;
      best.set(nid, next);
      cameFrom.set(nid, id);
      push([next + guess(ni, nj), next, ni, nj, d]);
    }
  }
  return null;
}

let selection = null;      // { id, path, open }
let walk = null;           // { steps, from, to, t, open }

const hint = document.getElementById('hint');
const say = (text) => { hint.textContent = text; };
say(TEXT.hint);


function select(id, path, open, start = heroTile) {
  selection = { id, path, open };
  markers.forEach((m) => { m.visible = false; });
  let from = start;
  path.forEach((step, k) => {
    const dx = step.i - from.i;
    const dz = step.j - from.j;
    [[0.3, 1], [0.8, -1]].forEach(([along, side], n) => {       // a left and a right foot between two tiles
      const m = markers[k * 2 + n];
      if (!m) return;
      const under = along < 0.5 ? from : step;
      m.position.set(from.i + dx * along + dz * side * 0.1, tileY(under.i, under.j) + 0.025, from.j + dz * along - dx * side * 0.1);
      m.rotation.y = Math.atan2(dx, dz) + Math.PI;
      m.scale.x = side;
      m.visible = true;
    });
    from = step;
  });
  const last = path[path.length - 1];
  target.visible = Boolean(last);
  if (last) {
    const before = path[path.length - 2] ?? start;
    target.position.set(last.i, tileY(last.i, last.j), last.j);
    target.rotation.y = Math.atan2(last.i - before.i, last.j - before.j);
    ghostMaterials.forEach((m) => m.color.set(0x9aa3ad));
    orderGhost();
  }
}
function clearSelection() {
  selection = null;
  markers.forEach((m) => { m.visible = false; });
  target.visible = false;
}

// Sets off along the chosen path. If the hero is already walking he finishes the step he is on
// and carries on along the new path: a new place can be picked at any moment.
function go() {
  const { path, open } = selection;
  if (walk) {
    walk.steps = [...path];
    walk.open = open;
    walk.passed = 0;
    walk.pace = walkPace();
    keyHeading = null;
    walk.byKeys = false;
  } else if (path.length) {
    walk = { steps: [...path], from: tilePos(heroTile), to: null, t: 0, open, passed: 0, pace: walkPace() };
  }
  unhighlight();
}
// The tile the next path starts from: where the hero stands, or the tile he is stepping onto.
const walkStart = () => (walk?.to ? walk.next : heroTile);

// What can be opened: where it is, where the hero stands, where the camera goes.
// The rule: the hero can use an item or character from any of the 8 tiles that touch it,
// and from no further. Tapping it from afar sends him to the tile in front of it.
const things = {
  chest: { tiles: [{ i: 1, j: 0 }], front: { i: 1, j: 1 }, focus: new THREE.Vector3(1, 0.95, 0.45), zoom: 2.3, title: TEXT.chestTitle, text: TEXT.chestText },
  door: { tiles: [{ i: 4, j: 0 }, { i: 5, j: 0 }], front: { i: 4, j: 1 }, focus: new THREE.Vector3(4.5, 1.25, 0.35), zoom: 2.2, title: TEXT.doorTitle, text: TEXT.doorText },
  chest2: { tiles: [CHEST2], front: { i: CHEST2.i, j: CHEST2.j + 1 }, focus: new THREE.Vector3(CHEST2.i, 0.55, CHEST2.j + 0.35), zoom: 2.3, title: TEXT.chest2Title, text: TEXT.chest2Text, object: () => chest2 },
};
const touches = (tile, thing) => thing.tiles.some((t) => Math.max(Math.abs(t.i - tile.i), Math.abs(t.j - tile.j)) <= 1);
// The way to it: to the tile in front if that can be reached, otherwise to the nearest tile that touches it.
function approach(thing, start = heroTile) {
  const toFront = walkable(thing.front.i, thing.front.j) ? findPath(start, thing.front) : null;
  if (toFront) return toFront;
  let best = null;
  for (const t of thing.tiles) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const spot = { i: t.i + di, j: t.j + dj };
    const path = walkable(spot.i, spot.j) ? findPath(start, spot) : null;
    if (path && (!best || path.length < best.length)) best = path;
  }
  return best;
}
function faceThing(thing) {
  hero.rotation.y = Math.atan2(thing.focus.x - hero.position.x, thing.focus.z - hero.position.z);
}
function hitBox(id, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  mesh.position.set(x, y, z);
  mesh.userData.thing = id;
  scene.add(mesh);
  return mesh;
}
const doorHit = hitBox('door', 2.2, 3.0, 1.4, 4.5, 1.5, -0.2);
const hitTargets = [hitBox('chest', 1.1, 1.5, 0.9, 1, 1.15, 0), doorHit, ...floorMeshes];
const chest2Hit = hitBox('chest2', 1.0, 1.0, 0.8, CHEST2.i, 0.5, CHEST2.j);          // joins the targets once the chest has been seen
const panelText = document.getElementById('panel-text');
const panelAnswers = document.getElementById('answers');

let closeUp = null;
const SCREEN_UP = new THREE.Vector3(-1, 2, -1).normalize();      // which way is up on the screen, in the world
function openCloseUp(id) {
  const thing = things[id];
  closeUp = id;
  lookGoal.copy(thing.focus);
  zoomGoal = thing.zoom;
  const isTask = id === 'chest';
  document.body.classList.toggle('is-task', isTask);
  if (isTask) lookGoal.addScaledVector(SCREEN_UP, -((camera.top * 2) / thing.zoom) * 0.3);      // leave room for the sheet
  document.getElementById('panel-title').textContent = thing.title;
  panelText.textContent = thing.text;
  panelAnswers.hidden = true;
  if (id === 'door' && !doorOpen) askGuardian();
  if (id === 'chest2') openBox();
  document.body.classList.add('is-closeup');
}
function closeCloseUp() {
  closeUp = null;
  lookGoal.copy(HOME);
  zoomGoal = userZoom;
  document.body.classList.remove('is-closeup', 'is-task', 'is-inv', 'is-box');
  if (typeof dropHeld === 'function') dropHeld();
  say(shooterHand() ? TEXT.hintShoot : TEXT.hint);
}
document.getElementById('back').addEventListener('click', closeCloseUp);

// The guardian's question was answered: the door slides down, the guardian
// steps aside, and the part of the dungeon behind it comes out of the dark.
function openDoor() {
  doorOpen = true;
  explored.add('north');
  doorFog.uFogInner.value = 30;
  doorFog.uFogOuter.value = 35;
  lookAround(4.5, -1, 35);                   // the door is open: everything within 30 tiles shows, then fades; still under fog
  blocked.delete(key(4, 0)); blocked.delete(key(5, 0));
  block([6, 0], [7, 0]);
  hitTargets.splice(hitTargets.indexOf(doorHit), 1);
  closeCloseUp();
}

// The guardian asks one question at random, never the same one twice in a row.
// A wrong answer costs nothing, but he asks something else.
let question = null;
function askGuardian() {
  const others = QUESTIONS.filter((q) => q !== question);
  question = others[Math.floor(Math.random() * others.length)];
  panelText.textContent = question.ask;
  panelAnswers.replaceChildren(...question.answers.map((label, k) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => answerGuardian(button, k));
    return button;
  }));
  panelAnswers.hidden = false;
}
function answerGuardian(button, k) {
  [...panelAnswers.children].forEach((b) => { b.disabled = true; });
  const right = k === question.right;
  button.classList.add(right ? 'is-right' : 'is-wrong');
  panelText.textContent = right ? TEXT.doorRight : TEXT.doorWrong;
  if (right) setTimeout(() => { if (!doorOpen) openDoor(); }, 900);
  else setTimeout(() => { if (closeUp === 'door' && !doorOpen) askGuardian(); }, 1300);
}

// The chest in the far chamber: the lid goes up and stays up, and a box like the bag shows what is in it.
// Things go between the two with a click, or straight across with a double click.
function openBox() {
  chest2Open = true;
  lookGoal.addScaledVector(SCREEN_UP, -((camera.top * 2) / zoomGoal) * 0.3);      // the chest above the sheet
  document.getElementById('inv-title').textContent = TEXT.chest2Title;
  document.body.classList.add('is-inv', 'is-box');
  renderInventory();
}

const raycaster = new THREE.Raycaster();
const VIEW = new THREE.Vector3(-1, -1, -1).normalize();
// The spot on the floor under the pointer (just above the floor, so the chest step counts as floor).
function floorUnder(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const point = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(point, camera);
  const { origin, direction } = raycaster.ray;
  return origin.clone().addScaledVector(direction, (0.55 - origin.y) / direction.y);
}
// The pointer makes blocks see-through only where they hide a floor tile that can be walked on.
function pointAt(clientX, clientY) {
  occlusion.uPointer.value.copy(NOWHERE);
  if (closeUp) return;
  const floor = floorUnder(clientX, clientY);              // also aims the raycaster
  const hits = raycaster.intersectObjects(floorMeshes, false);
  const inFront = (h) => h.point.clone().sub(floor).dot(VIEW) < -0.2;
  if (!hits.length || !inFront(hits[0])) return;           // nothing stands in the way here
  const behind = hits.find((h) => !inFront(h));
  const tile = behind?.object.userData.quads?.[Math.floor(behind.faceIndex / 2)];
  if (tile && walkable(tile.i, tile.j)) occlusion.uPointer.value.copy(floor);
}
// What is under the pointer: a thing that can be used, a floor tile, or nothing.
// What is drawn see-through around the pointer is skipped: the pick lands on what is behind it.
function pickAt(clientX, clientY) {
  const floor = floorUnder(clientX, clientY);              // also aims the raycaster
  const hit = raycaster.intersectObjects(hitTargets, false)
    .find((h) => h.object.userData.thing || h.point.clone().sub(floor).dot(VIEW) >= -0.2);
  if (!hit) return null;
  if (hit.object.userData.thing) return { thingId: hit.object.userData.thing };
  const tile = hit.object.userData.quads?.[Math.floor(hit.faceIndex / 2)];
  return tile ? { tile } : null;
}
const hoverFrame = new THREE.Group();
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
[[0, -0.46, 0.96, 0.06], [0, 0.46, 0.96, 0.06], [-0.46, 0, 0.06, 0.96], [0.46, 0, 0.06, 0.96]]
  .forEach(([x, z, w, d]) => box(hoverFrame, w, 0.03, d, hoverMaterial, x, 0, z));
hoverFrame.visible = false;
scene.add(hoverFrame);
// A cage of thin bars drawn round an item or character under the pointer: it can be used.
const cage = new THREE.Group();
const cageMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe6dc, depthTest: false, transparent: true, opacity: 0.95 });
const cageBars = Array.from({ length: 12 }, () => {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cageMaterial);
  bar.renderOrder = 200;
  cage.add(bar);
  return bar;
});
cage.visible = false;
scene.add(cage);
const cageBox = new THREE.Box3();
function showCage(thing) {
  if (thing.bounds) cageBox.copy(thing.bounds);
  else {
    cageBox.makeEmpty();
    thing.object().traverse((node) => { if (node.isMesh) cageBox.expandByObject(node); });
  }
  cageBox.expandByScalar(0.07);
  const { min, max } = cageBox;
  const size = max.clone().sub(min);
  const mid = min.clone().add(max).multiplyScalar(0.5);
  const T = 0.05;
  let k = 0;
  for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) { cageBars[k].position.set(mid.x, y, z); cageBars[k++].scale.set(size.x + T, T, T); }
  for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) { cageBars[k].position.set(x, mid.y, z); cageBars[k++].scale.set(T, size.y + T, T); }
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) { cageBars[k].position.set(x, y, mid.z); cageBars[k++].scale.set(T, T, size.z + T); }
  cage.visible = true;
}
// The border round an item or character: a slightly larger shell of each of its boxes, seen only
// from behind, so it shows as a line all the way round its outline and moves with it.
const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8, side: THREE.BackSide });
const outlines = new Map();
let outlined = null;
function outline(thing, on) {
  if (!thing.object) return false;
  if (!outlines.has(thing)) {
    const parts = [];
    thing.object().traverse((node) => { if (node.isMesh && node.geometry?.parameters?.width) parts.push(node); });
    outlines.set(thing, parts.map((node) => {
      const { width, height, depth } = node.geometry.parameters;
      const shell = new THREE.Mesh(node.geometry, outlineMaterial);
      const t = 0.045;
      shell.scale.set((width + 2 * t) / width, (height + 2 * t) / height, (depth + 2 * t) / depth);
      node.add(shell);
      return shell;
    }));
  }
  outlines.get(thing).forEach((shell) => { shell.visible = on; });
  return true;
}
function unhighlight() {
  if (outlined) outline(outlined, false);
  outlined = null;
  cage.visible = false;
  hoverFrame.visible = false;
}
// The pointer only frames a tile or outlines a thing; the footprints and the faded hero show after a tap.
function updateHover(clientX, clientY) {
  unhighlight();
  if (closeUp) return;
  const picked = pickAt(clientX, clientY);
  const walkTo = picked?.tile && walkable(picked.tile.i, picked.tile.j) ? key(picked.tile.i, picked.tile.j) : null;
  if (!picked) return;
  let spot = null;
  if (picked.thingId) {
    const thing = things[picked.thingId];                 // something to use: a border round the thing itself
    if (outline(thing, true)) outlined = thing; else showCage(thing);
  } else if (walkTo && !(picked.tile.i === heroTile.i && picked.tile.j === heroTile.j)) {
    spot = picked.tile;
    hoverMaterial.color.set(0xffe9a8);                    // a place to walk to
  }
  if (!spot) return;
  hoverFrame.position.set(spot.i, tileY(spot.i, spot.j) + 0.03, spot.j);
  hoverFrame.visible = true;
}
// One tap is enough: the hero goes there, or goes to the thing and uses it.
let lastTap = null;
function tap(clientX, clientY) {
  if (closeUp) return;
  // The second click of a double click: he is already on his way there, so he hurries.
  const now = performance.now();
  const double = lastTap && now - lastTap.time < 350 && Math.hypot(clientX - lastTap.x, clientY - lastTap.y) < 14;
  lastTap = double ? null : { time: now, x: clientX, y: clientY };
  if (double && walk) { walk.pace = hurryPace(); return; }
  const hit = pickAt(clientX, clientY);
  if (!hit) return;
  const start = walkStart();

  if (hit.thingId) {
    const thing = things[hit.thingId];
    if (!walk && touches(heroTile, thing)) { clearSelection(); arrive(hit.thingId); return; }
    const path = touches(start, thing) ? [] : approach(thing, start);
    if (!path) return;
    select(hit.thingId, path, hit.thingId, start);
    go();
    return;
  }

  const tile = hit.tile;
  if (!tile || !walkable(tile.i, tile.j) || (tile.i === start.i && tile.j === start.j)) return;
  const path = findPath(start, tile);
  if (!path) return;
  select(key(tile.i, tile.j), path, null, start);
  go();
}
// A short press is a tap. A press that moves drags the map: the view slides, the camera never turns.
const pan = new THREE.Vector3();                              // how far the player has dragged the view away
const GROUND_RIGHT = new THREE.Vector3(1, 0, -1).normalize();  // right on the screen, along the floor
const GROUND_UP = new THREE.Vector3(-1, 0, -1).normalize();    // up on the screen, along the floor
let pressed = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;                                  // the right button is for the wand
  pointAt(e.clientX, e.clientY);
  pressed = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  pointAt(e.clientX, e.clientY);
  if (!pressed?.dragging) updateHover(e.clientX, e.clientY);
  if (!pressed || closeUp) return;
  if (!pressed.dragging && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) < 10) return;
  pressed.dragging = true;
  unhighlight();
  canvas.classList.add('is-dragging');
  const unit = canvas.clientHeight / ((camera.top * 2) / zoom);        // screen pixels for one tile
  const move = new THREE.Vector3()
    .addScaledVector(GROUND_RIGHT, -(e.clientX - pressed.lastX) / unit)
    .addScaledVector(GROUND_UP, (e.clientY - pressed.lastY) / unit / 0.577);   // the floor is seen at a slant
  pan.add(move);
  clampView(look.add(move));                                           // follows the finger at once, but stays over the map
  pressed.lastX = e.clientX;
  pressed.lastY = e.clientY;
  document.getElementById('to-hero').hidden = false;
});
const release = (e) => {
  if (e.pointerType !== 'mouse') occlusion.uPointer.value.copy(NOWHERE);      // a finger leaves no pointer behind
  if (pressed && !pressed.dragging && e.type === 'pointerup') tap(e.clientX, e.clientY);
  pressed = null;
  canvas.classList.remove('is-dragging');
};
canvas.addEventListener('pointerup', release);
// The wheel (or a pinch on the trackpad) zooms a little: down to three quarters, up to 15% closer.
let userZoom = 1;
const zoomBy = (factor) => {
  userZoom = Math.min(1.15, Math.max(0.75, userZoom * factor));
  if (!closeUp) zoomGoal = userZoom;
};
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!closeUp) zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') zoomBy(1.05);
  if (e.key === '-' || e.key === '_') zoomBy(1 / 1.05);
});
canvas.addEventListener('pointerleave', () => { occlusion.uPointer.value.copy(NOWHERE); unhighlight(); });
canvas.addEventListener('pointercancel', release);
document.getElementById('to-hero').addEventListener('click', () => {
  pan.set(0, 0, 0);
  document.getElementById('to-hero').hidden = true;
});

document.getElementById('style').addEventListener('click', () => setTextured(!textured));
document.getElementById('stone').addEventListener('click', () => setStone((stoneSet + 1) % STONE_SETS.length));

// ---------- the close-up screen of the chest: the task itself ----------
// The treasurer left a note with the chest. The numbers in it are stone tablets;
// they go into the beam (the whole, and its parts), and the missing part opens the lock.
// The rules come from core.js, which was tested on its own.

const TASK_TEXT = {
  title: 'Сандъкът на ковчежника',
  ask: 'Ключалката се отваря с цената на въжетата.',
  total: 'цялото',
  stepPlace: 'Докосни число от бележката, после мястото му в гредата.',
  stepDial: 'Набери на ключалката колко струваха въжетата.',
  misplaced: 'Това число не е за тук.',
  wrong: 'Ключалката не поддава. Провери сметката.',
  won: 'Сандъкът се отвори! Въжетата струваха 631 жълтици.',
  check: 'Провери', back: 'Назад', again: 'Отначало',
};
const TASK_NOTE = [
  'В сандъка имаше ', { chip: 'c-total' }, ' жълтици. Дадохме ', { chip: 'c-computers' }, ' за мечове и ',
  { chip: 'c-desks' }, ' за щитове. Купихме и въжета, но мастилото се е разляло. В сандъка останаха ', { chip: 'c-left' }, '.',
];
const PART_LABEL = { computers: 'мечове', desks: 'щитове', mice: 'въжета', left: 'останали' };

const el = (id) => document.getElementById(id);
el('task-title').textContent = TASK_TEXT.title;
el('task-ask').textContent = TASK_TEXT.ask;
el('task-check').textContent = TASK_TEXT.check;
el('task-back').textContent = TASK_TEXT.back;
el('task-again').textContent = TASK_TEXT.again;

const chipButtons = new Map();
for (const part of TASK_NOTE) {
  if (typeof part === 'string') { el('task-note').append(part); continue; }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip';
  button.textContent = formatNumber(chipById(part.chip).value);
  button.addEventListener('click', () => chestGame.select(part.chip));
  chipButtons.set(part.chip, button);
  el('task-note').append(button);
}

const slotButtons = new Map([['total', el('task').querySelector('[data-slot="total"]')]]);
slotButtons.get('total').querySelector('.label').textContent = TASK_TEXT.total;
let unknownPart;
for (const segment of TASK.segments) {
  const known = segment.value !== null;
  const node = document.createElement(known ? 'button' : 'div');
  node.className = known ? 'slot' : 'unknown';
  node.style.flex = `${Math.max(0.17, segmentShare(segment.id))} 1 0`;      // as wide as its share of the whole
  node.innerHTML = '<b></b><span class="label"></span>';
  node.querySelector('.label').textContent = PART_LABEL[segment.id];
  if (known) { node.type = 'button'; slotButtons.set(segment.id, node); } else unknownPart = node;
  el('task-segments').append(node);
}
slotButtons.forEach((node, slot) => node.addEventListener('click', () => chestGame.place(slot)));

const wheels = Array.from({ length: DIAL_SIZE }, (_, k) => {
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  const turnButton = (label, delta) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => chestGame.turn(k, delta));
    return button;
  };
  const digit = document.createElement('b');
  const buttons = [turnButton('▲', 1), turnButton('▼', -1)];
  wheel.append(buttons[0], digit, buttons[1]);
  el('task-dial').append(wheel);
  return { digit, buttons };
});
el('task-check').addEventListener('click', () => chestGame.check());
el('task-back').addEventListener('click', closeCloseUp);
el('task-again').addEventListener('click', () => chestGame.reset());

function renderTask(state, event) {
  el('task').dataset.phase = state.phase;
  const used = new Set(Object.values(state.placed));
  chipButtons.forEach((button, id) => {
    button.classList.toggle('is-picked', state.selected === id);
    button.classList.toggle('is-used', used.has(id));
    button.disabled = used.has(id) || state.phase !== 'place';
  });
  slotButtons.forEach((node, slot) => {
    const chip = state.placed[slot];
    node.querySelector('b').textContent = chip ? formatNumber(chipById(chip).value) : '';
    node.classList.toggle('is-filled', Boolean(chip));
    node.disabled = Boolean(chip) || state.phase !== 'place';
  });
  unknownPart.querySelector('b').textContent = state.phase === 'won' ? formatNumber(TASK.answer) : '?';
  unknownPart.classList.toggle('is-solved', state.phase === 'won');
  wheels.forEach((wheel, k) => {
    wheel.digit.textContent = state.dial[k];
    wheel.buttons.forEach((button) => { button.disabled = state.phase !== 'dial'; });
  });
  el('task-check').disabled = state.phase !== 'dial';
  el('task-again').hidden = state.phase !== 'won';
  el('task-step').textContent = state.phase === 'place' ? TASK_TEXT.stepPlace : state.phase === 'dial' ? TASK_TEXT.stepDial : '';
  el('purse').textContent = state.wallet;

  const message = el('task-message');
  const failed = event.type === 'misplaced' || event.type === 'wrong';
  message.textContent = event.type === 'misplaced' ? TASK_TEXT.misplaced : event.type === 'wrong' ? TASK_TEXT.wrong
    : state.phase === 'won' ? TASK_TEXT.won : '';
  message.classList.toggle('is-good', state.phase === 'won');
  if (failed) {                                   // a wrong try costs nothing: the sheet and the chest just shake
    const grid = el('task-grid');
    grid.classList.remove('is-shaking');
    void grid.offsetWidth;
    grid.classList.add('is-shaking');
    chestShake = 0.35;
  }
  chestOpen = state.phase === 'won';
}
const chestGame = createGame(renderTask);
chestGame.start();

// ---------- the inventory: Tab opens it ----------
// Items are small pixel pictures drawn from letter grids. What is put on the hero shows on him:
// a helmet, a breastplate, knee guards, boots, and one thing in his free hand.

const PIXEL = {
  '#': '#2f2a26', l: '#e3e6ea', m: '#b6bcc5', d: '#7c838e', r: '#c8372d', R: '#8e2620', w: '#efe2c0',
  f: '#5a4630', y: '#ffd35a', b: '#d79a4a', B: '#a8682a', h: '#8a5a34', H: '#5c3a20', g: '#e3ac2a',
  p: '#d0549a', P: '#9c2f70', c: '#cfe7f0',
  u: '#2f6fbf', U: '#22528c', n: '#3b4267', N: '#2c3150', k: '#8a6a48', K: '#6b5038', o: '#6f5740', O: '#4a3524',
  v: '#7a4fb5', V: '#4c2b78', e: '#787e33', s: '#c2a878',
};
const ICON_ROWS = {
  helmet: ['............', '............', '...######...', '..#llllll#..', '.#llmmmmll#.', '.#mmmmmmmm#.', '.#mm####mm#.', '.#md#..#dm#.', '.#dd#..#dd#.', '..##....##..', '............', '............'],
  chest: ['............', '.###....###.', '.#m#....#m#.', '.#mm####mm#.', '.#mllllllm#.', '..#mllllm#..', '..#mmmmmm#..', '..#mmmmmm#..', '..#dmmmmd#..', '..#dddddd#..', '..########..', '............'],
  legs: ['............', '..########..', '..#llllll#..', '..#mmmmmm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#dd##dd#..', '..#dd##dd#..', '..###..###..', '............'],
  boots: ['............', '............', '..###...###.', '..#l#...#l#.', '..#m#...#m#.', '..#m#...#m#.', '.##m#..##m#.', '#mmm#.#mmm#.', '#ddd#.#ddd#.', '#####.#####.', '............', '............'],
  sword: ['..........##', '.........#l#', '........#l#.', '.......#l#..', '......#l#...', '.....#l#....', '.#..#l#.....', '..##l#......', '..#g#.......', '.#h##.......', '#h#..#......', '.#..........'],
  tnt: ['........y...', '.......y.y..', '......f.....', '.....f......', '..########..', '..#rRrRrR#..', '..#wwwwww#..', '..#rRrRrR#..', '..#rRrRrR#..', '..#wwwwww#..', '..#rRrRrR#..', '..########..'],
  bread: ['............', '............', '............', '...######...', '..#bbbbbb#..', '.#bwbwbwbb#.', '.#bbbbbbbb#.', '.#BBBBBBBB#.', '..########..', '............', '............', '............'],
  torch: ['.....yy.....', '....yyyy....', '....yrry....', '.....##.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....##.....', '............'],
  potion: ['....####....', '.....##.....', '.....cc.....', '....#cc#....', '...#cccc#...', '..#pppppp#..', '..#ppwppp#..', '..#pppppp#..', '..#PPPPPP#..', '...######...', '............', '............'],
  tunic: ['............', '..##.rr.##..', '.#uu#rr#uu#.', '#uuuuuuuuuu#', '#uu#uuuu#uu#', '.##UuuuuU##.', '...#uuuu#...', '...#uuuu#...', '...#hhhh#...', '...#uuuu#...', '...#UUUU#...', '...######...'],
  trousers: ['............', '..########..', '..#hhhhhh#..', '..#nnnnnn#..', '..#nn##nn#..', '..#nn##nn#..', '..#nn##nn#..', '..#nn##nn#..', '..#NN##NN#..', '..#NN##NN#..', '..###..###..', '............'],
  leatherBoots: ['............', '............', '..###...###.', '..#b#...#b#.', '..#h#...#h#.', '..#h#...#h#.', '.##h#..##h#.', '#hhh#.#hhh#.', '#HHH#.#HHH#.', '#####.#####.', '............', '............'],
  pack: ['............', '....####....', '...#eeee#...', '..########..', '..#bbbbbb#..', '..#bbbbbb#..', '..#BBBBBB#..', '..#hhgghh#..', '..#hhgghh#..', '..#hhhhhh#..', '..########..', '............'],
  shirt: ['............', '..##.KK.##..', '.#kk#KK#kk#.', '#kkkkkkkkkk#', '#kk#kkkk#kk#', '.##KkkkkK##.', '...#kkkk#...', '...#kkkk#...', '...#ssss#...', '...#kkkk#...', '...#KKKK#...', '...######...'],
  pants: ['............', '..########..', '..#ssssss#..', '..#oooooo#..', '..#oo##oo#..', '..#oo##oo#..', '..#ok##oo#..', '..#oo##oo#..', '..#OO##OO#..', '..#OO##OO#..', '..###..###..', '............'],
  shoes: ['............', '............', '............', '............', '............', '..###...###.', '..#o#...#o#.', '.##o#..##o#.', '#ooo#.#ooo#.', '#OOO#.#OOO#.', '#####.#####.', '............'],
  cloak: ['............', '....####....', '...#oggo#...', '..#oooooo#..', '..#oooooo#..', '.#oooooooo#.', '.#ooOooOoo#.', '.#ooOooOoo#.', '#oooOooOooo#', '#ooOooooOoo#', '#OOOOOOOOOO#', '############'],
  magicCloak: ['............', '....####....', '...#vyyv#...', '..#vvvvvv#..', '..#vvvvvv#..', '.#vvvvvvvv#.', '.#vvcvvVvv#.', '.#vvVvvVvv#.', '#vvvVvvVvvv#', '#vvVvvvcVvv#', '#VVVVVVVVVV#', '############'],
  wizardHat: ['............', '.....##.....', '....#vv#....', '....#vv#....', '...#vyvv#...', '...#vvvv#...', '..#vvvvyv#..', '..#vvvvvv#..', '..#gggggg#..', '.##########.', '#VVVVVVVVVV#', '.##########.'],
  wizardRobe: ['............', '..##.gg.##..', '.#vv#gg#vv#.', '#vvvvvvvvvv#', '#vv#vvvv#vv#', '.##VvvvvV##.', '...#gggg#...', '...#vvvv#...', '..#vvyvvv#..', '..#vvvvvv#..', '.#VVVVVVVV#.', '.##########.'],
  wizardBoots: ['............', '............', '..###...###.', '..#g#...#g#.', '..#v#...#v#.', '..#v#...#v#.', '.##v#..##v#.', '#gvv#.#gvv#.', '#VVV#.#VVV#.', '#####.#####.', '............', '............'],
  wand: ['.......y....', '...........y', '........yr..', '........ry..', '.......h....', '......hH....', '.....hH.....', '....gg......', '...hH.......', '..hH........', '.hH.........', '.H..........'],
  bow: ['....hhH.....', '...hH..w....', '..hH....w...', '..h.....w...', '.hH.....w...', '.gg.....w...', '.gg.....w...', '.hH.....w...', '..h.....w...', '..hH....w...', '...hH..w....', '....hhH.....'],
  firebolt: ['............', '.......yyy..', '......ywwwy.', '.....ywwwwy.', '....yrwwwry.', '...yrrwwrry.', '..yrrrrrry..', '.yrr.rrry...', '.yr..ryy....', 'yr..yy......', 'y...........', '............'],
  arrow: ['............', '........mmm.', '.........mm.', '........m.m.', '.......h....', '......h.....', '.....h......', '....h.......', '.w.h........', '.wh.........', 'www.........', '............'],
  key: ['............', '..###.......', '.#ggg#......', '.#g.g#......', '.#ggg#......', '..#g#.......', '..#g#.......', '..#g##......', '..#gg#......', '..#g#.......', '..#gg#......', '...##.......'],
};
const ICON = Object.fromEntries(Object.entries(ICON_ROWS).map(([id, rows]) => {
  const c = document.createElement('canvas');
  c.width = c.height = 12;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PIXEL[ch]) { ctx.fillStyle = PIXEL[ch]; ctx.fillRect(x, y, 1, 1); } }));
  return [id, c.toDataURL()];
}));
// What each thing is. `note` says what it is like; the rest does something:
// `walk` and `hurry` speed him up while it is worn, `light` makes a light round him, and SHOOTERS says what shoots.
const ITEMS = {
  helmet: { name: 'Железен шлем', slot: 'head', note: 'Желязо. Пази главата.' },
  chest: { name: 'Железна броня', slot: 'chest', note: 'Желязо, с ризница на ръцете.' },
  legs: { name: 'Железни наколенници', slot: 'legs', note: 'Желязо върху подплата.' },
  boots: { name: 'Железни ботуши', slot: 'feet', note: 'Желязо. Тежки, но здрави.' },
  sword: { name: 'Меч', slot: 'hand', note: 'Остър, с позлатена дръжка.' },
  tnt: { name: 'Динамит', slot: 'hand', stack: true, note: 'Червени пръчки с фитил.' },
  bread: { name: 'Хляб', slot: 'hand', stack: true, note: 'Храна за из път.' },
  torch: { name: 'Факла', slot: 'hand', stack: true, note: 'Гори, докато е в ръка.', light: 'топла светлина около героя' },
  potion: { name: 'Отвара', slot: 'hand', stack: true, note: 'Розова, в стъклено шише.' },
  key: { name: 'Ключ', slot: 'hand', note: 'Стар златен ключ.' },
  bow: { name: 'Лък', slot: 'hand', note: 'Дървен, с опъната тетива.' },
  magicCloak: { name: 'Магическо наметало', slot: 'back', note: 'Плат, който свети сам.', light: 'лилава светлина, малко по-силна от факла' },
  wand: { name: 'Магическа пръчка', slot: 'hand', note: 'С жарава на върха.' },
  tunic: { name: 'Синя туника с шал', slot: 'chest', note: 'С колан и кожени нараменници.' },
  trousers: { name: 'Тъмни панталони', slot: 'legs', note: 'Здрави, за път.' },
  leatherBoots: { name: 'Кожени ботуши', slot: 'feet', note: 'Удобни.' },
  pack: { name: 'Раница', slot: 'back', note: 'С постелка отгоре.' },
  shirt: { name: 'Кърпена риза', slot: 'chest', note: 'Евтина, с въже за колан.' },
  pants: { name: 'Къси панталони от зебло', slot: 'legs', note: 'Евтини, с кръпка на коляното.' },
  shoes: { name: 'Прости обувки', slot: 'feet', note: 'Евтини, вързани с връв.' },
  cloak: { name: 'Кафяво наметало', slot: 'back', note: 'Старо и кърпено.' },
  wizardHat: { name: 'Магьосническа шапка', slot: 'head', note: 'Островърха, със звезди.' },
  wizardRobe: { name: 'Магьосническа мантия', slot: 'chest', note: 'Със златен пояс.' },
  wizardBoots: { name: 'Магьоснически обувки', slot: 'feet', note: 'С извити носове.', walk: 1.075, hurry: 1.15 },
};
const EQUIP = [
  { key: 'head', label: 'глава', empty: 'helmet' },
  { key: 'back', label: 'гръб', empty: 'cloak' },
  { key: 'chest', label: 'тяло', empty: 'chest' },
  { key: 'legs', label: 'крака', empty: 'legs' },
  { key: 'feet', label: 'ходила', empty: 'boots' },
  { key: 'handR', label: 'дясна ръка', empty: 'torch' },
  { key: 'handL', label: 'лява ръка', empty: 'sword' },
];
const item = (id, count = 1) => ({ id, count });
const gearOn = () => Object.values(inventory.equip).filter(Boolean).map((it) => ITEMS[it.id]);
const walkPace = () => gearOn().reduce((pace, thing) => pace * (thing.walk ?? 1), 1);
const hurryPace = () => HURRY * gearOn().reduce((pace, thing) => pace * (thing.hurry ?? 1), 1);
const inventory = {
  equip: { head: null, back: null, chest: null, legs: null, feet: null, handR: null, handL: null },
  bag: Array(27).fill(null),
  box: Array(9).fill(null),            // the chest in the far chamber
};
[item('helmet'), item('chest'), item('legs'), item('boots'), item('sword'), item('tnt', 5)].forEach((it, k) => { inventory.bag[k] = it; });
[item('bread', 3), item('potion', 2), item('key'), item('bow')].forEach((it, k) => { inventory.bag[9 + k] = it; });
[item('tunic'), item('trousers'), item('leatherBoots'), item('pack')].forEach((it, k) => { inventory.bag[18 + k] = it; });
[item('wizardHat'), item('wizardRobe'), item('wizardBoots'), item('wand'), item('magicCloak')].forEach((it, k) => { inventory.box[k] = it; });
inventory.equip.handR = item('torch', 8);                     // he starts with torches in his right hand
Object.assign(inventory.equip, { back: item('cloak'), chest: item('shirt'), legs: item('pants'), feet: item('shoes') });      // and in poor brown clothes
let held = null;

// What he wears is built with the hero himself (see `worn`); here only what he holds.
// one thing in each hand
const inHand = { handR: {}, handL: {} };
const handHolders = {};
[['handR', arms[1].elbow], ['handL', arms[0].elbow]].forEach(([key, elbow]) => {
  const holder = new THREE.Group();
  holder.position.set(0, -0.27, 0.04);
  elbow.add(holder);
  handHolders[key] = holder;
});
const holding = (id, build, tilt = 0) => {
  for (const key of ['handR', 'handL']) {
    const g = new THREE.Group();
    g.rotation.x = tilt;
    build(g);
    g.visible = false;
    handHolders[key].add(g);
    inHand[key][id] = g;
  }
};
holding('sword', (g) => {
  paintedBox(g, 0.05, 0.46, 0.07, 0, 0.3, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[3]); p.column(0, IRON[4]); p.column(p.w - 1, IRON[1]); } });
  paintedBox(g, 0.18, 0.04, 0.08, 0, 0.06, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') });
  paintedBox(g, 0.04, 0.12, 0.04, 0, -0.02, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
}, -1.3);
holding('tnt', (g) => paintedBox(g, 0.2, 0.24, 0.2, 0, -0.12, 0, {
  all: (p) => { p.rect(0, 0, p.w, p.h, '#c8372d'); for (let x = 1; x < p.w; x += 2) p.column(x, '#8e2620'); p.rect(0, 1, p.w, 1, '#efe2c0'); p.rect(0, p.h - 2, p.w, 1, '#efe2c0'); },
  top: (p) => { p.rect(0, 0, p.w, p.h, '#8e2620'); p.px(2, 2, '#2f2a26'); },
}));
holding('torch', (g) => {
  paintedBox(g, 0.05, 0.3, 0.05, 0, 0.08, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
  paintedBox(g, 0.08, 0.08, 0.08, 0, 0.26, 0, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, y < 1 ? '#ffe08a' : '#ff9a3a'); } });
}, -0.5);
holding('bread', (g) => paintedBox(g, 0.22, 0.1, 0.12, 0, -0.06, 0, { all: flat('#d79a4a', '#efc07a', '#a8682a') }));
holding('potion', (g) => {
  paintedBox(g, 0.12, 0.14, 0.12, 0, -0.08, 0, { all: flat('#d0549a', '#e88ac0', '#9c2f70') });
  paintedBox(g, 0.05, 0.05, 0.05, 0, 0.02, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
});
holding('wand', (g) => {
  paintedBox(g, 0.035, 0.36, 0.035, 0, 0.12, 0, { all: flat('#5c3a20', '#8a5a34', '#3a2414') });
  paintedBox(g, 0.05, 0.04, 0.05, 0, 0.0, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') });
  paintedBox(g, 0.07, 0.07, 0.07, 0, 0.32, 0, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, y < 1 ? '#ffe08a' : '#ff7a2a'); } });
}, -0.9);
holding('bow', (g) => {
  const wood = flat('#8a5a34', '#a8703f', '#5c3a20');
  paintedBox(g, 0.05, 0.12, 0.05, 0, 0, 0.05, { all: flat('#4c3122', '#6a4630', '#2f1f15') });        // the grip
  [-1, 1].forEach((s) => {
    paintedBox(g, 0.045, 0.2, 0.045, 0, s * 0.15, 0.02, { all: wood }).rotation.x = -s * 0.3;      // the limbs bend back
    paintedBox(g, 0.04, 0.1, 0.04, 0, s * 0.28, -0.03, { all: wood }).rotation.x = -s * 0.7;
  });
  paintedBox(g, 0.012, 0.6, 0.012, 0, 0, -0.06, { all: (p) => p.rect(0, 0, p.w, p.h, '#efe2c0') });    // the string
}, -0.2);
holding('key', (g) => paintedBox(g, 0.04, 0.18, 0.03, 0, -0.04, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') }));

function dressHero() {
  const eq = inventory.equip;
  const on = new Set(['head', 'back', 'chest', 'legs', 'feet'].map((slot) => eq[slot]?.id));
  for (const group of [...Object.values(outfit).flat(), ...ghostOutfit]) group.visible = on.has(group.userData.outfit);
  for (const key of ['handR', 'handL']) Object.entries(inHand[key]).forEach(([id, g]) => { g.visible = eq[key]?.id === id; });
  renderActions();
}

// ---- the sheet ----
const invName = document.getElementById('inv-name');
const invProps = document.getElementById('inv-props');
const heldBox = document.getElementById('held');
const slotNodes = [];
function slotButton(where, key, extra = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `slot-i ${extra}`;
  node.innerHTML = '<img alt=""><span></span>';
  node.addEventListener('click', () => clickSlot(where, key));
  node.addEventListener('dblclick', () => quickMove(where, key));
  node.addEventListener('mouseenter', () => describe(where, key));
  node.addEventListener('mouseleave', () => { showItem(held); node.classList.remove('is-wrong'); });      // back to what is picked up, if anything
  slotNodes.push({ node, where, key });
  return node;
}
EQUIP.forEach(({ key }) => {
  const node = slotButton('equip', key, 'is-equip');
  node.style.gridArea = key;                                    // placed on the figure: head, body, legs, feet, hands
  document.getElementById('inv-equip').append(node);
});
inventory.bag.forEach((_, k) => document.getElementById('inv-bag').append(slotButton('bag', k)));
inventory.box.forEach((_, k) => document.getElementById('inv-box').append(slotButton('box', k)));

const getSlot = (where, key) => inventory[where][key];
const setSlot = (where, key, value) => { inventory[where][key] = value; };
const fits = (it, where, key) => where !== 'equip' || key.startsWith('hand') || ITEMS[it.id].slot === key;
const holdsTorch = () => inventory.equip.handR?.id === 'torch' || inventory.equip.handL?.id === 'torch';

// The name of a thing and its properties, listed under the bag: on hover, and while it is picked up.
const percent = (factor) => `${((factor - 1) * 100).toLocaleString('bg-BG', { maximumFractionDigits: 1 })}%`;
function showItem(it, spot = null) {
  if (!it) {
    invName.textContent = spot ? `Място за ${spot}` : '';
    invProps.replaceChildren();
    return;
  }
  const info = ITEMS[it.id];
  invName.textContent = info.name + (it.count > 1 ? ` × ${it.count}` : '');
  const lines = [info.slot === 'hand' ? 'Държи се в ръка' : `Носи се на: ${EQUIP.find((e) => e.key === info.slot).label}`];
  if (info.note) lines.push(info.note);
  if (info.walk) lines.push(`Ходене: с ${percent(info.walk)} по-бързо`);
  if (info.hurry) lines.push(`Бързане: с ${percent(info.hurry)} по-бързо`);
  if (info.light) lines.push(`Свети: ${info.light}`);
  const shooter = SHOOTERS[it.id];
  if (shooter) lines.push(`Стреля: ${shooter.name.toLowerCase()}, до ${shooter.range} плочки`);
  invProps.replaceChildren(...lines.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}
function describe(where, key) {
  showItem(getSlot(where, key), where === 'equip' ? EQUIP.find((e) => e.key === key).label : null);
}
function clickSlot(where, key) {
  const here = getSlot(where, key);
  const node = slotNodes.find((s) => s.where === where && s.key === key).node;
  if (!held) {
    if (!here) return;
    held = here;
    setSlot(where, key, null);
  } else if (!fits(held, where, key)) {
    node.classList.add('is-wrong');
    invName.textContent = 'Това не става тук.';
    return;
  } else if (here && here.id === held.id && ITEMS[here.id].stack) {
    here.count += held.count;
    held = null;
  } else {
    setSlot(where, key, held);
    held = here;
  }
  renderInventory();
  describe(where, key);
}
// A double click moves a thing straight to where it belongs, and back.
function quickMove(where, key) {
  if (held) { clickSlot(where, key); }
  const it = getSlot(where, key);
  if (!it) return;
  if (closeUp === 'chest2' && where !== 'equip') {          // with the chest open: across, between the chest and the bag
    const to = where === 'box' ? 'bag' : 'box';
    const free = inventory[to].indexOf(null);
    if (free < 0) return;
    inventory[to][free] = it;
    inventory[where][key] = null;
  } else if (where === 'equip') {
    const free = inventory.bag.indexOf(null);
    if (free < 0) return;
    inventory.bag[free] = it;
    inventory.equip[key] = null;
  } else {
    let target = ITEMS[it.id].slot;
    if (target === 'hand') target = !inventory.equip.handR ? 'handR' : !inventory.equip.handL ? 'handL' : 'handR';
    inventory.bag[key] = inventory.equip[target];
    inventory.equip[target] = it;
  }
  renderInventory();
}
function dropHeld() {
  if (!held) return;
  const free = inventory.bag.indexOf(null);
  if (free >= 0) inventory.bag[free] = held;
  held = null;
  renderInventory();
}
function renderInventory() {
  slotNodes.forEach(({ node, where, key }) => {
    const it = getSlot(where, key);
    const img = node.querySelector('img');
    const empty = where === 'equip' ? EQUIP.find((e) => e.key === key).empty : null;
    img.src = it ? ICON[it.id] : empty ? ICON[empty] : '';
    img.style.visibility = it || empty ? 'visible' : 'hidden';
    img.classList.toggle('is-empty', !it);
    node.querySelector('span').textContent = it && it.count > 1 ? it.count : '';
  });
  heldBox.hidden = !held;
  if (held) {
    heldBox.querySelector('img').src = ICON[held.id];
    heldBox.querySelector('span').textContent = held.count > 1 ? held.count : '';
  }
  dressHero();
  showChestContents();
}
document.addEventListener('pointermove', (e) => { heldBox.style.left = `${e.clientX}px`; heldBox.style.top = `${e.clientY}px`; });

function openInventory() {
  if (walk) return;
  clearSelection();
  closeUp = 'hero';
  zoomGoal = 2.7;
  lookGoal.set(hero.position.x, hero.position.y + 0.8, hero.position.z)
    .addScaledVector(SCREEN_UP, -((camera.top * 2) / zoomGoal) * 0.27);           // the hero above the sheet
  faceGoal = Math.PI / 4;                                                          // turns to face us
  document.getElementById('inv-title').textContent = 'Инвентар';
  document.body.classList.add('is-closeup', 'is-inv');
  renderInventory();
}
const toggleInventory = () => { if (closeUp === 'hero' || closeUp === 'chest2') closeCloseUp(); else if (!closeUp) openInventory(); };
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); toggleInventory(); }
  if (e.key === 'Escape' && closeUp) closeCloseUp();
});
document.getElementById('inv-open').addEventListener('click', toggleInventory);
document.getElementById('inv-close').addEventListener('click', closeCloseUp);

// ---------- shooting: the magic wand and the bow ----------
// Whatever in his hands can shoot gets a square at the bottom of the screen. Space shoots the chosen one
// towards the pointer (the right button does too); a click on a square chooses it when both hands can shoot.
// What is shot flies straight until it meets something that cannot be walked through.
const SHOOTERS = {
  wand: { name: 'Огнена стрела', icon: 'firebolt', look: 'fire', speed: 9, range: 8 },
  bow: { name: 'Стрела', icon: 'arrow', look: 'arrow', speed: 13, range: 10 },
};
const CAST = 0.4;               // seconds the arm is up
const bolt = { state: 'idle', look: 'fire', dir: new THREE.Vector3(), travelled: 0, t: 0, speed: 9, range: 8, group: new THREE.Group() };
const fireLook = new THREE.Group();
const boltCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
const boltShell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32),
  new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.55, depthWrite: false }));
fireLook.add(boltCore, boltShell);
const arrowLook = new THREE.Group();                        // points along +z, the way it flies
paintedBox(arrowLook, 0.03, 0.03, 0.5, 0, 0, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#8a5a34'); p.row(0, '#a8703f'); } });
paintedBox(arrowLook, 0.06, 0.06, 0.08, 0, 0, 0.27, { all: flat(IRON[2], IRON[4], IRON[0]) });
paintedBox(arrowLook, 0.1, 0.02, 0.1, 0, 0, -0.22, { all: (p) => p.rect(0, 0, p.w, p.h, '#efe2c0') });
bolt.group.add(fireLook, arrowLook);
bolt.group.visible = false;
scene.add(bolt.group);
const boltLight = new THREE.PointLight(0xff8a3a, 0, 4, 2);       // always there and dark until a firebolt flies: a light added later would rebuild every material
scene.add(boltLight);
let activeHand = null;           // which hand Space shoots with
const shooterHand = () => ['handR', 'handL'].find((k) => SHOOTERS[inventory.equip[k]?.id]);
function renderActions() {
  const bar = document.getElementById('actions');
  const hands = ['handR', 'handL'].filter((k) => SHOOTERS[inventory.equip[k]?.id]);
  if (!hands.includes(activeHand)) activeHand = hands[0] ?? null;
  bar.replaceChildren(...hands.map((k) => {
    const shooter = SHOOTERS[inventory.equip[k].id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action${k === activeHand ? ' is-on' : ''}`;
    button.title = shooter.name;
    button.innerHTML = `<img alt="" src="${ICON[shooter.icon]}"><b>${k === activeHand ? 'интервал' : shooter.name}</b>`;
    button.addEventListener('click', () => { activeHand = k; renderActions(); button.blur(); });
    return button;
  }));
}
function shoot(angle) {
  const shooter = SHOOTERS[inventory.equip[activeHand]?.id];
  if (!shooter || walk || closeUp || bolt.state !== 'idle') return;
  faceGoal = angle;
  castArm = activeHand === 'handR' ? 1 : 0;
  castTime = CAST;
  Object.assign(bolt, { look: shooter.look, speed: shooter.speed, range: shooter.range, travelled: 0, state: 'wait', t: 0 });
  bolt.dir.set(Math.sin(angle), 0, Math.cos(angle));
  bolt.group.rotation.set(0, angle, 0);
  bolt.group.position.set(hero.position.x, hero.position.y + 0.95, hero.position.z).addScaledVector(bolt.dir, 0.4);
  fireLook.visible = shooter.look === 'fire';
  arrowLook.visible = shooter.look === 'arrow';
}
function flyBolt(dt) {
  if (bolt.state === 'idle') return;
  bolt.t += dt;
  const fire = bolt.look === 'fire';
  if (bolt.state === 'wait') {                    // it leaves once the arm is up
    if (bolt.t < CAST * 0.45) return;
    bolt.state = 'fly';
    bolt.t = 0;
    bolt.group.visible = true;
    boltShell.scale.setScalar(1);
    boltShell.material.opacity = 0.55;
    boltCore.scale.setScalar(1);
  }
  if (bolt.state === 'fly') {
    bolt.group.position.addScaledVector(bolt.dir, dt * bolt.speed);
    bolt.travelled += dt * bolt.speed;
    boltCore.rotation.set(bolt.t * 9, bolt.t * 7, 0);
    boltShell.rotation.set(-bolt.t * 6, bolt.t * 8, 0);
    boltLight.intensity = fire ? 3.5 : 0;
    const p = bolt.group.position;
    const i = Math.round(p.x);
    const j = Math.round(p.z);
    const solid = !(i === heroTile.i && j === heroTile.j) && !walkable(i, j);
    if (solid || bolt.travelled > bolt.range) { bolt.state = 'stop'; bolt.t = 0; }
  } else if (fire) {
    const k = Math.min(1, bolt.t / 0.35);           // a firebolt flares, then nothing
    boltShell.scale.setScalar(1 + k * 4);
    boltShell.material.opacity = 0.55 * (1 - k);
    boltCore.scale.setScalar(Math.max(0.001, 1 - k));
    boltLight.intensity = 6 * (1 - k);
    if (k >= 1) { bolt.state = 'idle'; bolt.group.visible = false; boltLight.intensity = 0; }
  } else if (bolt.t > 0.6) {                        // an arrow sticks for a moment, then is gone
    bolt.state = 'idle';
    bolt.group.visible = false;
  }
  boltLight.position.copy(bolt.group.position);
}
let pointer = null;              // where the pointer last was, for Space
window.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
const angleTo = (clientX, clientY) => {
  const floor = floorUnder(clientX, clientY);
  return Math.atan2(floor.x - hero.position.x, floor.z - hero.position.z);
};
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || closeUp) return;
  e.preventDefault();
  document.activeElement?.blur?.();                // so Space does not also press a button
  shoot(pointer ? angleTo(pointer.x, pointer.y) : faceGoal ?? hero.rotation.y);
});
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  shoot(angleTo(e.clientX, e.clientY));
});

renderInventory();

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
[['.panel', 41], ['#task', 73], ['#inv', 97]].forEach(([selector, seed]) => {
  const sheet = document.querySelector(selector);
  sheet.style.setProperty('--torn-front', tornEdge(seed, 5));
  sheet.style.setProperty('--torn-back', tornEdge(seed + 7, 7));
});

// ---------- walking with the keyboard ----------
// As if from inside the hero, whichever way he faces: ↑ (or W) walks forward for as long as it is held,
// ← and → (A, D) turn him an eighth of a turn on the spot, ↓ (S) turns him round. Shift hurries.
// E uses what he stands next to, the thing in front of him first.
const FORWARD = new Set(['ArrowUp', 'KeyW']);
const TURNS = { ArrowLeft: 1, KeyA: 1, ArrowRight: -1, KeyD: -1, ArrowDown: 4, KeyS: 4 };    // in eighths of a turn
const EIGHTH = Math.PI / 4;
const keysDown = new Set();
let keyHeading = null;           // the way the keys have turned him; null: the way he faces
const hurrying = () => keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
const heading = () => keyHeading ?? Math.round((faceGoal ?? hero.rotation.y) / EIGHTH) * EIGHTH;
function turnBy(eighths) {
  keyHeading = heading() + eighths * EIGHTH;
  if (!walk) faceGoal = keyHeading;            // while walking he turns at the end of the step
}
// The tile in front of him, if he can step there; a slanting step does not cut a corner.
function nextKeyStep(from) {
  if (![...FORWARD].some((code) => keysDown.has(code))) return null;
  const a = heading();
  const di = Math.round(Math.sin(a));
  const dj = Math.round(Math.cos(a));
  const to = { i: from.i + di, j: from.j + dj };
  const ok = walkable(to.i, to.j) && (!di || !dj || (walkable(from.i + di, from.j) && walkable(from.i, from.j + dj)));
  return ok ? to : null;
}
function keyWalk() {
  if (!walk && faceGoal === null) keyHeading = null;      // settled: he faces where he faces (a click or a shot may have turned him)
  if (closeUp || walk) return;
  const next = nextKeyStep(heroTile);
  if (!next) return;
  clearSelection();
  walk = { steps: [next], from: tilePos(heroTile), to: null, t: 0, open: null, passed: 0, pace: hurrying() ? hurryPace() : walkPace(), byKeys: true };
}
// What he can use from where he stands: the thing on the tile he faces, or else any thing that touches him.
function useInFront() {
  if (closeUp || walk) return;
  const ahead = { i: heroTile.i + Math.round(Math.sin(hero.rotation.y)), j: heroTile.j + Math.round(Math.cos(hero.rotation.y)) };
  const active = (id) => hitTargets.some((m) => m.userData.thing === id);
  const near = Object.keys(things).filter((id) => active(id) && touches(heroTile, things[id]));
  const id = near.find((n) => things[n].tiles.some((t) => t.i === ahead.i && t.j === ahead.j)) ?? near[0];
  if (id) arrive(id);
}
window.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Arrow')) e.preventDefault();
  keysDown.add(e.code);
  if (closeUp) return;
  if (FORWARD.has(e.code) && walk && !walk.byKeys) {     // the keys take over from a click: he stops at the next tile
    walk.steps = [];
    walk.open = null;
    walk.byKeys = true;
    clearSelection();
  }
  if (e.code in TURNS && !e.repeat) turnBy(TURNS[e.code]);
  if (e.code === 'KeyE') useInFront();
});
window.addEventListener('keyup', (e) => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());

// Is the hero hidden? Walk from three points on him towards the camera, through the grid of
// blocks, and see whether any block stands in the way. Cheap: a few dozen look-ups, no ray casting.
const SEE_THROUGH_RADIUS = 2.1;
function heroIsCovered() {
  for (const up of [0.35, 0.8, 1.3]) {
    for (let t = 0.6; t < 14; t += 0.3) {
      const x = hero.position.x + t * 0.57735;
      const y = hero.position.y + up + t * 0.57735;
      const z = hero.position.z + t * 0.57735;
      const level = Math.floor(y) + 0.5;
      const filled = heightAt(Math.round(x), level, Math.round(z));
      if (filled && y - (level - 0.5) <= filled) return true;
    }
  }
  return false;
}

// ---------- every frame ----------

const clock = new THREE.Clock();
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

let stride = 0;                 // where the legs are in their swing
let gait = 0;                   // 0 standing, 1 walking; eases between the two so nothing snaps
let faceGoal = null;            // the way the arrows asked the hero to face
let castTime = 0;               // seconds left of raising the wand
let castArm = 1;                // which arm holds it

// The whole pose of the hero, every frame: a walk blended with standing still.
function poseHero(dt, t) {
  gait += ((walk ? 1 : 0) - gait) * (1 - Math.exp(-dt * 10));
  if (walk) stride += dt * Math.PI * 2 * (0.933 / STEP_SECONDS) * (walk.pace ?? 1);         // about two steps for every tile
  const s = Math.sin(stride);
  const c = Math.cos(stride);
  const rest = 1 - gait;
  const breath = Math.sin(t * 2.2);

  legs.forEach((leg, k) => {
    const swing = k === 0 ? s : -s;                    // the two legs are half a stride apart
    const lifting = Math.max(0, k === 0 ? c : -c);     // this leg is in the air, coming forward
    const landing = Math.max(0, swing) ** 2 * (1 - lifting);       // it has just come down in front
    leg.hip.rotation.x = -(0.5 * swing + 0.08) * gait;             // reaches a little further forward than back
    leg.knee.rotation.x = (0.06 + 0.95 * lifting ** 1.2 + 0.16 * landing) * gait;    // bends in the air, gives a little on landing
    // The foot: toes up as the heel comes down, toes down as it pushes off, hanging loose in the air.
    leg.ankle.rotation.x = (-0.32 * Math.max(0, swing) + 0.42 * Math.max(0, -swing) + 0.25 * lifting) * gait;
  });
  // Arms swing against the legs. The elbow bends more as the arm comes forward, and the arm rolls out a little going back.
  arms[0].shoulder.rotation.x = 0.44 * s * gait + breath * 0.04 * rest;
  arms[0].shoulder.rotation.z = -0.07 * Math.max(0, s) * gait;
  arms[0].elbow.rotation.x = -(0.16 + 0.36 * Math.max(0, -s)) * gait - 0.06 * rest;
  // The right arm is held forward and steady, with only a small swing, ready to carry a torch.
  arms[1].shoulder.rotation.x = (-0.3 - 0.12 * s) * gait + (-0.22 + breath * 0.03) * rest;
  arms[1].elbow.rotation.x = -0.38 * gait - 0.22 * rest;
  // Casting: the wand arm comes up and points ahead, then drops back.
  castTime = Math.max(0, castTime - dt);
  if (castTime > 0) {
    const k = Math.sin((1 - castTime / CAST) * Math.PI);
    const arm = arms[castArm];
    arm.shoulder.rotation.x += (-1.45 - arm.shoulder.rotation.x) * k;
    arm.elbow.rotation.x *= 1 - k;
  }

  // The body rises over each planted foot, leans into the walk, shifts its weight from side to side,
  // and turns a little with each step: the hips lead, the head stays looking ahead.
  const twist = 0.09 * s * gait;
  heroBody.position.y = (0.024 * Math.cos(stride * 2) - 0.014) * gait;
  heroBody.rotation.set(0.075 * gait, twist, 0.04 * s * gait);
  heroBody.scale.set(1, 1 + breath * 0.012 * rest, 1);
  head.rotation.x = (-0.055 - 0.03 * Math.cos(stride * 2)) * gait;
  head.rotation.y = -twist + Math.sin(t * 0.7) * 0.35 * rest;
  head.rotation.z = -0.04 * s * gait;
  // Loose things follow a moment late.
  pack.position.y = 0.016 * Math.cos(stride * 2 - 1.0) * gait;
  pack.rotation.z = -0.03 * s * gait;
  cloak.rotation.x = (0.3 + 0.07 * Math.sin(stride * 2 - 0.8)) * gait;      // the cloak streams out behind as he walks
  cloak.rotation.z = -0.04 * s * gait;
  magicCloak.rotation.copy(cloak.rotation);
  scarfTail.rotation.x = (0.22 + 0.2 * Math.sin(stride * 2 - 0.6)) * gait;
  scarfTail.rotation.z = 0.12 * Math.sin(stride - 0.8) * gait;
}

function stepHero(dt) {
  if (!walk.to) {
    const next = walk.steps.shift();
    walk.to = tilePos(next);
    walk.next = next;
    walk.t = 0;
    walk.heading = Math.atan2(walk.to.x - walk.from.x, walk.to.z - walk.from.z);
    walk.length = Math.hypot(walk.to.x - walk.from.x, walk.to.z - walk.from.z) || 1;      // a slanting step is longer
  }
  // Moves at an even pace and turns smoothly; the limbs are posed in poseHero.
  walk.t = Math.min(1, walk.t + (dt * (walk.pace ?? 1)) / (STEP_SECONDS * walk.length));
  hero.position.lerpVectors(walk.from, walk.to, walk.t);
  hero.position.y = walk.from.y + (walk.to.y - walk.from.y) * easeInOut(walk.t);     // a step up or down
  const turn = Math.atan2(Math.sin(walk.heading - hero.rotation.y), Math.cos(walk.heading - hero.rotation.y));
  hero.rotation.y += turn * (1 - Math.exp(-dt * 16));
  if (walk.t < 1) return;

  heroTile = walk.next;
  const passed = walk.passed ?? 0;                           // the footprints he has walked over
  markers[passed * 2].visible = false;
  markers[passed * 2 + 1].visible = false;
  walk.passed = passed + 1;
  lookAround(heroTile.i, heroTile.j);       // walking further in shows more
  walk.from = walk.to;
  walk.to = null;
  if (walk.byKeys && !walk.steps.length) {                 // still held: the next tile, with no stop in between
    const next = !closeUp && nextKeyStep(heroTile);
    if (next) { walk.steps.push(next); walk.pace = hurrying() ? hurryPace() : walkPace(); walk.passed = 0; return; }
  }
  if (walk.steps.length) return;
  const open = walk.open;
  walk = null;
  clearSelection();
  if (open) {
    arrive(open);
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  keyWalk();
  if (walk) { faceGoal = null; stepHero(dt); }
  if (faceGoal !== null) {
    const turn = Math.atan2(Math.sin(faceGoal - hero.rotation.y), Math.cos(faceGoal - hero.rotation.y));
    hero.rotation.y += turn * (1 - Math.exp(-dt * 14));
    if (Math.abs(turn) < 0.002) faceGoal = null;
  }
  poseHero(dt, t);
  flyBolt(dt);

  for (const f of flickers) {
    const n = 0.86 + 0.09 * Math.sin(t * 11 + f.phase) + 0.05 * Math.sin(t * 23.7 + f.phase * 2);
    f.light.intensity = f.base * n;
    f.halo.material.opacity = f.haloBase * n;
    f.flame.scale.set(1, 0.9 + 0.25 * Math.sin(t * 13 + f.phase), 1);
    f.flame.rotation.y = t * 1.7 + f.phase;
  }
  lantern.position.set(hero.position.x + 0.55, hero.position.y + 1.0, hero.position.z + 0.55);
  const torchLit = typeof holdsTorch === 'function' && holdsTorch() ? 1 : 0;
  // The magic cloak shines violet, a little brighter than a torch, so with both it is the cloak's light.
  const cloakLit = inventory.equip.back?.id === 'magicCloak';
  const flick = 0.9 + 0.1 * Math.sin(t * 9);
  lantern.color.set(cloakLit ? 0xb58cff : 0xffc27a);
  lantern.intensity = cloakLit ? 5.2 * (0.94 + 0.06 * Math.sin(t * 2)) : 4.5 * torchLit * flick;
  lanternHalo.material.color.set(cloakLit ? 0x9a6cff : 0xffa040);
  lanternHalo.material.opacity = cloakLit ? 0.16 : 0.14 * torchLit * flick;

  // The chest rattles now and then; its glow breathes.
  const rattle = chestOpen ? 0 : Math.max(0, Math.sin(t * 1.3)) ** 12;
  if (chestOpen) lid.rotation.x += (-1.9 - lid.rotation.x) * (1 - Math.exp(-dt * 5));        // the lid swings open and stays
  else lid.rotation.x = -rattle * 0.16 * (0.6 + 0.4 * Math.sin(t * 40));
  chestShake = Math.max(0, chestShake - dt);
  chest.rotation.z = Math.sin(t * 55) * 0.06 * (chestShake / 0.35);
  chest.position.y = 0.5 + rattle * 0.02 * Math.abs(Math.sin(t * 36));
  chestLight.intensity = 2 + 0.7 * Math.sin(t * 2.4) + rattle * 1.5 + (chestOpen ? 2.5 : 0);
  chestHalo.material.opacity = 0.1 + 0.03 * Math.sin(t * 2.4) + rattle * 0.08;

  // The guardian breathes; the runes and crystals pulse.
  golemTop.scale.y = 1 + Math.sin(t * 1.6) * 0.018;
  golemTop.rotation.y = Math.sin(t * 0.5) * 0.07;
  golemArms.forEach((arm, k) => { arm.rotation.x = Math.sin(t * 1.6 + k) * 0.05; });
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
  runes.forEach((rune, k) => rune.material.color.setHSL(0.74, 0.9, 0.5 + 0.25 * Math.sin(t * 1.8 - k * 0.9)));
  runeLight.intensity = 1 + 0.8 * pulse;
  runeHalo.material.opacity = 0.06 + 0.07 * pulse;
  crystalLight.intensity = 1.8 + 0.6 * Math.sin(t * 1.1);
  crystalHalo.material.opacity = 0.07 + 0.02 * Math.sin(t * 1.1);

  beacons.forEach((b, k) => {
    b.mesh.position.y = b.y + Math.sin(t * 2.4 + k * 2) * 0.09;
    b.mesh.rotation.y = t * 1.5;
    b.mesh.visible = !closeUp && !(k === 0 && chestOpen);
  });
  const ghostOpacity = 0.36 + 0.05 * Math.sin(t * 4);
  ghostMaterials.forEach((m) => { m.opacity = ghostOpacity; });

  waterTexture.offset.set(t * 0.05, Math.sin(t * 0.6) * 0.04);
  fallTexture.offset.y = t * 1.1;
  shaftMaterial.opacity = 0.04 + 0.01 * Math.sin(t * 0.8);

  occlusion.uHero.value.set(hero.position.x, hero.position.y + 0.75, hero.position.z);
  const wanted = heroIsCovered() ? SEE_THROUGH_RADIUS : 0;
  occlusion.uRadius.value += (wanted - occlusion.uRadius.value) * (1 - Math.exp(-dt * 9));
  if (surfaceSun) {                                        // the sun and its shadows go where the hero goes
    surfaceSun.position.set(hero.position.x + 12, 18, hero.position.z + 3);
    surfaceSun.target.position.set(hero.position.x, 0, hero.position.z);
  }
  const here = MAP === 'surface' ? 'room' : regionAt.get(key(heroTile.i, heroTile.j)) ?? 'room';
  const northLit = MAP === 'dungeon' && here === 'north' && seen.has(key(0, -8));      // its light is seen only from inside
  northTorch.children.forEach((child) => { if (!child.isLight) child.visible = northLit; });
  northTorch.userData.flicker.base = northLit ? northTorch.userData.flicker.strength : 0;
  let relit = false;
  for (const region of Object.keys(regionLight)) {
    const goal = region === here ? 1 : explored.has(region) ? 0.45 : region === 'north' ? 0.3 : 0;
    const next = regionLight[region] + (goal - regionLight[region]) * (1 - Math.exp(-dt * 2.2));
    if (Math.abs(next - regionLight[region]) > 0.0005) { regionLight[region] = next; relit = true; }
  }
  if (relit) lightRegions();
  if (MAP === 'dungeon') {                                 // the chest in the far chamber
    if (here === 'north' && !chest2Seen) { chest2Seen = true; hitTargets.push(chest2Hit); }
    chest2.visible = chest2Seen;
    chest2Skins.forEach((material) => material.color.setScalar(regionLight.north));
    lid2.rotation.x += ((chest2Open ? -1.9 : 0) - lid2.rotation.x) * (1 - Math.exp(-dt * 5));
  }
  const slide = 1 - Math.exp(-dt * 3);
  door.position.y += ((doorOpen ? -2.3 : 0) - door.position.y) * slide;
  if (caveDoor) caveDoor.position.y += ((caveDoorOpen ? -2.1 : 0) - caveDoor.position.y) * slide;
  golem.position.x += ((doorOpen ? 6.5 : 4.5) - golem.position.x) * slide;

  // The camera only slides and zooms, for the close-up.
  const ease = 1 - Math.exp(-dt * 4.5);
  if (!closeUp) {
    const out = Math.min(1, farness(hero.position.x, hero.position.z) / 3) * 0.8;
    if (MAP === 'surface') lookGoal.set(hero.position.x, 0.9, hero.position.z).add(pan);          // the big world scrolls with the hero
    else lookGoal.set(HOME.x + (hero.position.x - HOME.x) * out, HOME.y, HOME.z + (hero.position.z - HOME.z) * out).add(pan);
    const kept = clampView(lookGoal.clone());
    pan.add(kept.clone().sub(lookGoal));                                // what is past the edge is dropped
    lookGoal.copy(kept);
  }
  look.lerp(lookGoal, ease);
  zoom += (zoomGoal - zoom) * ease;
  camera.zoom = zoom;
  camera.position.copy(look).add(ISO_OFFSET);
  camera.lookAt(look);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

setStone(0);
setTextured(true);
// ---------- between the two maps ----------
things.chest.object = () => chest;
things.door.object = () => golem;
things.stairs = { tiles: STAIRS.map(([i, j]) => ({ i, j })), front: { i: -8, j: 4 }, focus: new THREE.Vector3(-8, 1, 2), travel: 'surface',
  bounds: new THREE.Box3(new THREE.Vector3(-8.5, 0, 0.5), new THREE.Vector3(-7.5, 2, 3.5)) };
things.cave = { tiles: [{ i: CAVE.x, j: CAVE.z }], front: { i: CAVE.x, j: CAVE.z + 1 }, focus: new THREE.Vector3(CAVE.x, 1, CAVE.z + 0.4),
  travel: 'from-surface', object: () => caveDoor };
function arrive(id) {
  const thing = things[id];
  faceThing(thing);
  if (thing.travel) travel(thing.travel); else openCloseUp(id);
}
const SAVE_KEY = 'levacademy-dungeon-study-3';
function travel(to) {
  window.name = `${SAVE_KEY}:${JSON.stringify({ inventory, doorOpen, chest2Seen, chest2Open })}`;
  document.getElementById('night').classList.add('is-on');
  setTimeout(() => { location.hash = to; location.reload(); }, 420);
}
let saved = null;
if (window.name.startsWith(`${SAVE_KEY}:`)) {
  try { saved = JSON.parse(window.name.slice(SAVE_KEY.length + 1)); } catch { saved = null; }
  window.name = '';
}
if (saved?.inventory) {
  Object.assign(inventory.equip, saved.inventory.equip);
  saved.inventory.bag.forEach((it, k) => { inventory.bag[k] = it; });
  saved.inventory.box?.forEach((it, k) => { inventory.box[k] = it; });
  renderInventory();
}
if (MAP === 'surface') {
  hitTargets.length = 0;
  hitTargets.push(hitBox('cave', 1.1, 2.0, 0.8, CAVE.x, 1.0, CAVE.z + 0.2), ...floorMeshes);
  // The land is ringed by 20 tiles of mountains and water, so the view can follow the hero anywhere
  // on it and still never reach the end of the map.
  Object.assign(viewBox, { minX: SURF.x0 + 20, maxX: SURF.x1 - 20, minZ: SURF.z0 + 20, maxZ: SURF.z1 - 20 });
  // he comes out of the cave: from inside the mouth, two steps out, then the door shuts behind him
  heroTile = { i: CAVE.x, j: CAVE.z };
  hero.position.set(CAVE.x, 0, CAVE.z - 0.3);
  hero.rotation.y = 0;
  walk = { steps: [{ i: CAVE.x, j: CAVE.z + 1 }, { i: CAVE.x, j: CAVE.z + 2 }], from: hero.position.clone(), to: null, t: 0, open: null };
  look.set(CAVE.x, 0.9, CAVE.z + 1);
  lookGoal.copy(look);
  setTimeout(() => { caveDoorOpen = false; }, 1500);
} else {
  hitTargets.push(hitBox('stairs', 1.0, 1.9, 2.9, -8, 0.95, 2.05));
  glow(scene, 0xcfe6ff, 2.2, 0.16, -8, 1.5, 1.2);                   // daylight coming down the stairs
  if (saved?.doorOpen) openDoor();
  if (saved?.chest2Seen) { chest2Seen = true; hitTargets.push(chest2Hit); }
  if (saved?.chest2Open) chest2Open = true;
  if (CAME_DOWN) {
    heroTile = { i: -8, j: 4 };
    hero.position.copy(tilePos(heroTile));
    hero.rotation.y = 0;
  }
}
setTimeout(() => document.getElementById('night').classList.remove('is-on'), 60);

resize();
requestAnimationFrame(frame);
