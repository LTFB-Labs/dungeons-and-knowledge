// @ts-check
// The backdrop behind the world, in big pixels: a far cave wall with rock columns hanging from the roof and
// rising from below, and a faint haze in the middle; or, above ground, a blue sky with blocky clouds.
// Painted once per screen size, from a fixed seed, in layers (the far wall, the columns, the haze; the sky, the
// clouds). The layers lie still on top of one another, and then the picture is the same as if it were painted in
// one go; shift() slides the nearer ones a little as the view moves, so the backdrop has some depth.
import { mulberry32 } from '../engine/random.js';

// Paints the layers (far to near) for a backdrop w by h pixels; each layer is a canvas of that size.
function paintLayers(layers, kind, w, h) {
  const [far, mid, near] = layers.map((layer) => {
    layer.width = w;
    layer.height = h;
    return layer.getContext('2d');
  });
  let ctx = far;
  const r = mulberry32(77);
  if (kind === 'sky') {                                                      // a blue sky in big pixels, with blocky clouds
    const SKY = ['#6fa8dc', '#7cb3e2', '#8bbde6', '#9cc7ea', '#aed2ee', '#c2dcf1'];
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = SKY[Math.min(5, Math.floor((y / h) * 6))]; ctx.fillRect(0, y, w, 2); }
    ctx = mid;
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
  ctx = mid;
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
  ctx = near;
  const haze = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.55);
  haze.addColorStop(0, 'rgba(120, 96, 70, .10)');
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
}

/**
 * @param {HTMLCanvasElement} backdrop
 * @param {'cave' | 'sky'} kind
 */
export function createBackdrop(backdrop, kind) {
  const layers = [0, 1, 2].map(() => document.createElement('canvas'));
  const ctx = backdrop.getContext('2d');
  let w = 0, h = 0;
  let midX = 0, midY = 0, nearX = 0;               // how far the nearer layers are slid, in backdrop pixels
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(layers[0], 0, 0);
    // a slid layer wraps round at the sides
    const mx = ((midX % w) + w) % w;
    ctx.drawImage(layers[1], mx, midY);
    if (mx) ctx.drawImage(layers[1], mx - w, midY);
    const nx = ((nearX % w) + w) % w;
    ctx.drawImage(layers[2], nx, 0);
    if (nx) ctx.drawImage(layers[2], nx - w, 0);
  }
  return {
    /** Paints it for the size of the window: at the start and whenever the window changes size. */
    paint() {
      w = 200;
      h = Math.max(80, Math.round((w * (window.innerHeight + 80)) / (window.innerWidth + 80)));
      backdrop.width = w;
      backdrop.height = h;
      paintLayers(layers, kind, w, h);
      draw();
    },
    /**
     * Every frame: slides the nearer layers against the view. `right` and `down`: where the view looks, in tiles
     * across and down the screen; `depth`: how much of it shows, 0 (nothing moves) to 1. It is drawn again only
     * when a layer has moved by a whole pixel.
     */
    shift(right, down, depth) {
      const mx = Math.round(-right * 0.5 * depth);
      const my = Math.max(-2, Math.min(2, Math.round(-down * 0.15 * depth)));
      const nx = Math.round(-right * 1.1 * depth);
      if (mx === midX && my === midY && nx === nearX) return;
      midX = mx; midY = my; nearX = nx;
      draw();
    },
  };
}
