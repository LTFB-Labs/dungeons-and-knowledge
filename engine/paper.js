// @ts-check
// Torn paper: each sheet gets its own ragged outline, a little different for every seed.
import { mulberry32 } from './random.js';

/** A ragged outline as a CSS polygon. */
export function tornEdge(seed, depth) {
  const r = mulberry32(seed);
  const tear = () => (r() < 0.16 ? r() * depth * 2 : r() * depth).toFixed(1);          // now and then a deeper tear
  const points = [];
  for (let k = 0; k <= 36; k++) points.push(`${((k / 36) * 100).toFixed(1)}% ${tear()}px`);                    // top
  for (let k = 1; k <= 16; k++) points.push(`calc(100% - ${tear()}px) ${((k / 16) * 100).toFixed(1)}%`);       // right
  for (let k = 35; k >= 0; k--) points.push(`${((k / 36) * 100).toFixed(1)}% calc(100% - ${tear()}px)`);      // bottom
  for (let k = 15; k >= 1; k--) points.push(`${tear()}px ${((k / 16) * 100).toFixed(1)}%`);                    // left
  return `polygon(${points.join(', ')})`;
}

/** Tears the sheet found by `selector`: sets --torn-front and --torn-back on it (the CSS clips with them). */
export function tear(selector, seed) {
  const sheet = document.querySelector(selector);
  sheet.style.setProperty('--torn-front', tornEdge(seed, 5));
  sheet.style.setProperty('--torn-back', tornEdge(seed + 7, 7));
}
