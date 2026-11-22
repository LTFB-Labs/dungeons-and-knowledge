// @ts-check
// Small pictures painted by code: 16 x 16 block textures, and the pipeline that turns a set of stone tiles
// into a family of matching stones (light, medium, dark).
import * as THREE from './three.js';
import { mulberry32 } from './random.js';

/** A grey 16 x 16 picture for a tinted material. `draw(px, r)` paints it: px(x, y, value 0-255). */
export function pixelTexture(draw) {
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

/** A coloured 16 x 16 block texture. `draw(px, r)` paints it: px(x, y, '#rrggbb'); it wraps at the edges. */
export function paint(seed, draw) {
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

/** Pulls a colour part of the way towards grey. */
export function mute(hex, amount) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  return `#${[r, g, b].map((c) => Math.round(c + (grey - c) * amount).toString(16).padStart(2, '0')).join('')}`;
}
/** The shade of a palette (dark to light) nearest to k. */
export const shadeOf = (palette, k) => palette[Math.max(0, Math.min(palette.length - 1, Math.round(k)))];

// Soft blotches, 0..1, that repeat cleanly at the edges of the 16x16 square.
export function blotches(r) {
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

// ---- stone: from a set of tiles ({ name: rows of '#rrggbb' }) to the textures of every kind of stone block ----

/** A texture straight from rows of colours. */
export const fromSample = (rows, seed) => paint(seed, (px) => rows.forEach((row, y) => row.forEach((colour, x) => px(x, y, colour))));
export const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
export const hexOf = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
// The same tiles with less contrast: every colour pulled towards the average of its set,
// so joints get lighter and highlights dimmer. Moss keeps more of its colour.
export function quieter(tiles, amount) {
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
export const texturesOf = (source, seed) => Object.fromEntries(Object.entries(source).map(([set, tiles], s) => [
  set, Object.fromEntries(Object.entries(tiles).map(([name, rows], k) => [name, fromSample(rows, seed + s * 20 + k)])),
]));
// The same tiles, darker: a medium and a dark tone that match the light one because they are the same stone.
export function toned(tiles, factor) {
  const isMoss = ([r, g, b]) => Math.min(r, g) - b > 40;
  const shade = (hex) => { const c = rgbOf(hex); const f = isMoss(c) ? (1 + factor) / 2 : factor; return hexOf(c.map((v) => v * f)); };
  return Object.fromEntries(Object.entries(tiles).map(([name, rows]) => [name, rows.map((row) => row.map(shade))]));
}
export const family = (light, seed) => texturesOf({ light, mid: toned(light, 0.74), dark: toned(light, 0.52) }, seed);
// Which tile goes on which kind of block. Light is the mass of walls and floor; medium frames
// the door, the chest step and the pillar; the darkest sits low, under the floor and in the passage.
export const stoneMap = ({ light, mid, dark, step = mid }) => ({
  bricks: light.bricks1, bricksB: light.bricks2, mossy: light.bricksMoss, mossyB: light.rubbleMoss, cracked: light.long,
  stone: light.long, stoneB: light.bricks2,
  cobble: mid.rubble1, cobbleB: mid.rubble2, dark: mid.bricks1, darkB: mid.bricks2,
  tile: step.carved2, tileSide: step.long,
  night: dark.bricks1, nightB: dark.bricks2, deep: dark.rubble3,
});

/** A soft round dot: a sprite with it is a cheap stand-in for bloom. */
export function softDot() {
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
}
