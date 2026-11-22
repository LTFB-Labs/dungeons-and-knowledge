// Our own stone, painted by code in the spirit of the pixel stone the owner liked (stone-sample.js, which is
// someone else's art and stays private): a few warm grey shades, rough rubble next to dressed blocks of mixed
// sizes, a light top edge and a dark bottom edge on every stone, chisel strokes, carved slabs, and moss hanging
// from the joints. Every tile is 16 × 16 and repeats without a seam. Same shape as SAMPLE: { pale: { name: rows } }.

const N = 16;
// 0 is the joint, 1 the dark under-edge, 2–4 the faces, 5–6 the lit top edge.
const SHADES = ['#857876', '#8d7f7f', '#9a8b86', '#a5948f', '#b0a5a0', '#c4bbb2', '#d6cfc6'];
const MOSS = ['#555721', '#5b522c', '#67603a', '#756e40'];

function random(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wrap = (v) => ((v % N) + N) % N;

// A layout is a 16 × 16 grid of stone ids; -1 is a joint.
// Dressed courses: rows of `heights`; in each row the joints stand at `cuts[row]`.
function courses(heights, cuts) {
  const grid = [];
  let y = 0;
  heights.forEach((h, row) => {
    for (let k = 0; k < h; k++, y++) {
      grid.push(Array.from({ length: N }, (_, x) => {
        if (k === h - 1) return -1;                          // the joint under the course
        const c = cuts[row];
        if (c.includes(x)) return -1;
        const segment = c.filter((cut) => cut < x).length;
        return row * 10 + (segment === c.length ? 0 : segment);   // past the last cut it is the first stone again
      }));
    }
  });
  return grid;
}
// Rubble: stones grown round a few points (wrapping round the tile), wider than tall.
function rubble(count, seed) {
  const r = random(seed);
  const points = Array.from({ length: count }, () => [r() * N, r() * N]);
  const grid = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => {
    let best = 0;
    let bestD = Infinity;
    points.forEach(([px, py], k) => {
      const dx = Math.min(Math.abs(x - px), N - Math.abs(x - px)) * 0.75;
      const dy = Math.min(Math.abs(y - py), N - Math.abs(y - py));
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }));
  // A joint wherever the stone to the right or below is another one: lines one pixel wide.
  return grid.map((row, y) => row.map((id, x) => (id !== grid[y][wrap(x + 1)] || id !== grid[wrap(y + 1)][x] ? -1 : id)));
}

// Paints a layout: each stone its own face tone, lit along its top, dark along its bottom, with speckles
// and now and then a chisel stroke; joints in the joint colour; moss (if any) on the joints and hanging below them.
function paint(grid, seed, { moss = 0, carve = null } = {}) {
  const r = random(seed);
  const tone = new Map();
  const at = (x, y) => grid[wrap(y)][wrap(x)];
  const rows = grid.map((row, y) => row.map((id, x) => {
    if (id < 0) return SHADES[0];
    if (!tone.has(id)) tone.set(id, 2 + Math.floor(r() * 3));     // 2, 3 or 4
    let shade = tone.get(id);
    if (at(x, y - 1) !== id) shade = 5 + (r() < 0.3 ? 1 : 0);     // lit top edge
    else if (at(x, y + 1) !== id) shade = 1;                        // dark under-edge
    else if (at(x - 1, y) !== id) shade = Math.min(5, shade + 1);
    else if (at(x + 1, y) !== id) shade = Math.max(1, shade - 1);
    else if (r() < 0.1) shade += r() < 0.5 ? -1 : 1;                // speckles
    return SHADES[Math.max(1, Math.min(6, shade))];
  }));
  // chisel strokes: short slanting lines a shade darker, inside a few stones
  for (let k = 0; k < 4; k++) {
    const x0 = Math.floor(r() * N);
    const y0 = Math.floor(r() * N);
    const id = at(x0, y0);
    if (id < 0) continue;
    for (let s = 0; s < 3; s++) {
      const x = wrap(x0 + s);
      const y = wrap(y0 + (s >> 1));
      if (at(x, y) === id && at(x, y - 1) === id && at(x, y + 1) === id) rows[y][x] = SHADES[Math.max(1, tone.get(id) - 1)];
    }
  }
  if (carve) carve(rows);
  // moss: on a joint, hanging one to three pixels down the stone below
  for (let k = 0; k < moss; k++) {
    const x = Math.floor(r() * N);
    const y = Math.floor(r() * N);
    if (grid[y][x] >= 0 || grid[y][wrap(x + 1)] < 0 && grid[y][wrap(x - 1)] < 0 && grid[wrap(y + 1)][x] < 0) continue;
    rows[y][x] = MOSS[Math.floor(r() * MOSS.length)];
    const drop = 1 + Math.floor(r() * 3);
    for (let d = 1; d <= drop; d++) {
      const yy = wrap(y + d);
      if (grid[yy][x] < 0) break;
      rows[yy][x] = MOSS[Math.min(MOSS.length - 1, Math.floor(r() * MOSS.length) + (d > 1 ? 1 : 0))];
    }
  }
  return rows;
}

// A big dressed slab with a carved frame and a mark in the middle.
function carved(mark) {
  const grid = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x === N - 1 || y === N - 1 ? -1 : 0)));
  return paint(grid, 77 + mark.length, {
    carve(rows) {
      for (let k = 3; k <= 11; k++) {
        rows[3][k] = SHADES[1]; rows[k][3] = SHADES[1];        // the cut catches shadow at the top and left
        rows[11][k] = SHADES[5]; rows[k][11] = SHADES[5];      // and light at the bottom and right
      }
      mark.forEach(([x, y]) => { rows[y][x] = SHADES[1]; rows[y + 1][x] = SHADES[5]; });
    },
  });
}

export function paintStone() {
  // big blocks of mixed sizes, not small even bricks
  const bond = courses([5, 5, 6], [[9], [3, 12], [7]]);
  const mixed = courses([4, 6, 6], [[5, 11], [2, 10], [6, 14]]);
  const long = courses([6, 5, 5], [[10], [4], [13]]);
  const pale = {
    bricks1: paint(bond, 11),
    bricks2: paint(mixed, 12),
    bricksMoss: paint(bond, 13, { moss: 16 }),
    long: paint(long, 14),
    rubble1: paint(rubble(7, 21), 15),
    rubble2: paint(rubble(9, 22), 16),
    rubble3: paint(rubble(6, 23), 17),
    rubble4: paint(rubble(8, 24), 18),
    rubble5: paint(rubble(10, 25), 19),
    rubbleMoss: paint(rubble(7, 26), 20, { moss: 16 }),
    carved1: carved([[7, 6], [6, 7], [8, 7], [7, 8]]),
    carved2: carved([[5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [7, 5], [7, 6], [7, 8]]),
  };
  return { pale };
}
