// @ts-check
// The map being edited, as plain data, and everything that can be done to it: blocks painted and erased on a
// level, regions painted, things put, moved, turned, changed and taken out, the start and the arrivals set,
// the map grown at an edge, a level added; and undo and redo over all of it.
// Nothing here needs a browser or three.js: the view (view.js) draws what map() gives.
import { same } from './source.js';

const copy = (value) => { try { return structuredClone(value); } catch { return value; } };
const QUARTER = Math.PI / 2;

/**
 * The parts of a map the editor changes, as data that can be copied. The rest of the map (legend, fog, view,
 * camera, seeds, what builds its houses) stays as the file has it.
 * A map seen from above (`rows`) is one level here.
 */
export function partsOf(map) {
  return {
    shape: map.layers ? 'layers' : 'rows',
    origin: { x: map.origin?.x ?? 0, z: map.origin?.z ?? 0 },
    layers: map.layers ? map.layers.map((layer) => ({ level: layer.level, rows: [...layer.rows] })) : [{ level: -0.5, rows: [...map.rows] }],
    regions: map.regions ? { names: { ...map.regions.names }, rows: [...map.regions.rows] } : null,
    rolls: map.rolls ? Object.fromEntries(Object.entries(map.rolls).map(([level, rows]) => [level, [...rows]])) : null,
    things: (map.things ?? []).map((data, k) => ({ uid: k + 1, data: copy(data) })),
    start: copy(map.start ?? { tile: [0, 0], facing: 0 }),
    arrivals: copy(map.arrivals ?? {}),
  };
}

/** The map the engine reads, with the edited parts in it. */
export function mapOf(base, parts) {
  const map = { ...base, things: parts.things.map((thing) => thing.data), start: parts.start, arrivals: parts.arrivals };
  if (base.origin || parts.origin.x || parts.origin.z) map.origin = parts.origin;
  if (parts.shape === 'rows') return { ...map, rows: parts.layers[0].rows };
  return { ...map, layers: parts.layers.map(({ level, rows }) => ({ level, rows })), regions: parts.regions ?? undefined, rolls: parts.rolls ?? undefined };
}

/** A seed for the dice of a thing made in the editor: from its kind and where it was first put. */
export function seedFor(kind, at, n = 0) {
  let h = 2166136261;
  for (const ch of `${kind}|${at.join(',')}|${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 1) || 1;
}

/** A turn brought back between -half and half a turn; the four sides come out exact. */
export function turned(facing, quarters) {
  let q = Math.round((facing ?? 0) / QUARTER);
  const rest = (facing ?? 0) - q * QUARTER;
  q = (((q + quarters) % 4) + 4) % 4;
  return [0, QUARTER, Math.PI, -QUARTER][q] + (Math.abs(rest) < 1e-9 ? 0 : rest);
}

// The values of a thing that say where it is: all of them move with it.
const shift = {
  at: (v, dx, dz) => (v.length === 2 ? [v[0] + dx, v[1] + dz] : [v[0] + dx, v[1], v[2] + dz]),
  tile: (v, dx, dz) => [v[0] + dx, v[1] + dz],
  front: (v, dx, dz) => [v[0] + dx, v[1] + dz],
  seen: (v, dx, dz) => [v[0] + dx, v[1] + dz],
  tiles: (v, dx, dz) => v.map(([i, j]) => [i + dx, j + dz]),
  blocks: (v, dx, dz) => v.map(([i, j]) => [i + dx, j + dz]),
  gate: (v, dx, dz) => v.map(([i, j]) => [i + dx, j + dz]),
  focus: (v, dx, dz) => [v[0] + dx, v[1], v[2] + dz],
  hit: (v, dx, dz) => [v[0], v[1], v[2], v[3] + dx, v[4], v[5] + dz],
  bounds: (v, dx, dz) => v.map(([x, y, z]) => [x + dx, y, z + dz]),
};
const numbers = (v) => (Array.isArray(v) ? v.every(numbers) : typeof v === 'number');

/** Where a thing is, for its mark on the map: [x, y, z], or null when its entry does not say. */
export function anchorOf(data) {
  const at = numbers(data.at) && data.at?.length >= 2 ? data.at : null;
  if (at) return at.length === 2 ? [at[0], 0, at[1]] : [at[0], at[1], at[2]];
  for (const key of ['tile', 'front', 'from']) if (numbers(data[key]) && data[key]?.length === 2) return [data[key][0], 0, data[key][1]];
  const first = data.tiles?.[0];
  if (numbers(first) && first?.length === 2) return [first[0], 0, first[1]];
  if (numbers(data.from) && data.from?.length === 3) return [...data.from];
  return null;
}
/** What a thing that can be used must have, for one that stands on a tile. */
export function usable(data) {
  const at = anchorOf(data);
  if (!at) return data;
  const [x, y, z] = at;
  const i = Math.round(x), j = Math.round(z);
  return { tiles: [[i, j]], front: [i, j + 1], focus: [x, y + 0.6, z], zoom: 2.6, hit: [0.7, 1, 0.7, x, y + 0.5, z], ...data };
}

/**
 * @param {any} base the map as its file gives it
 * @param {{ limit?: number, random?: (seed: number) => () => number, twins?: Set<string> }} [o] limit: how many steps
 *   back are kept; random: the engine's dice (random.js: mulberry32) and twins: the kinds of block that come in two
 *   pictures (the game's blocks): with them a map that keeps rolls keeps the look of every block that is not painted
 */
export function createModel(base, { limit = 200, random = null, twins = new Set() } = {}) {
  let parts = partsOf(base);
  let saved = copy(parts);                 // as the file has it
  let history = [copy(parts)];
  let step = 0;
  let nextUid = parts.things.length + 1;
  const empty = ['.', ' ', '-'].find((ch) => !base.legend?.[ch]) ?? '.';      // a character that is no block

  const width = () => Math.max(0, ...parts.layers.flatMap((layer) => layer.rows.map((row) => row.length)), ...(parts.regions?.rows ?? []).map((row) => row.length));
  const height = () => Math.max(0, ...parts.layers.map((layer) => layer.rows.length), parts.regions?.rows.length ?? 0);
  const inside = (x, z) => x >= parts.origin.x && z >= parts.origin.z && x < parts.origin.x + width() && z < parts.origin.z + height();
  const put = (row, c, ch, blank) => { const full = row.length > c ? row : row + blank.repeat(c - row.length + 1); return full.slice(0, c) + ch + full.slice(c + 1); };
  function setCell(rows, x, z, ch, blank) {
    const c = x - parts.origin.x, r = z - parts.origin.z;
    if (!inside(x, z) || (rows[r]?.[c] ?? blank) === ch) return false;
    while (rows.length <= r) rows.push(blank.repeat(width()));
    rows[r] = put(rows[r], c, ch, blank);
    return true;
  }
  // The rolls of a map (how bright each block is, which of its two pictures it wears) are kept beside its blocks.
  // A block with no roll is rolled by the map's dice in the order of the map, so one block more or less would
  // change every such block after it. Before the first block is painted, every block is therefore given the roll
  // the dice give it now; from then on the dice are not asked.
  let settled = false;
  function settleRolls() {
    if (settled || !parts.rolls || !random) return;
    settled = true;
    const shade = random(base.seeds?.shade ?? 1), look = random(base.seeds?.look ?? 1);
    for (const layer of parts.layers) {
      const rolls = Array.from({ length: layer.rows.length }, (_, r) => (parts.rolls[layer.level]?.[r] ?? '').trim().split(/\s+/).filter(Boolean));
      layer.rows.forEach((row, r) => [...row].forEach((ch, c) => {
        const block = base.legend[ch];
        while (rolls[r].length < row.length) rolls[r].push('-');
        if (block && rolls[r][c] === '-') rolls[r][c] = `${0.93 + shade() * 0.12}${twins.has(block.type) && look() < 0.5 ? 'b' : ''}`;
      }));
      parts.rolls[layer.level] = rolls.map((row) => row.join(' '));
    }
  }
  // A block that was painted gets a roll of its own, from where it is; one that was erased has none.
  function roll(level, x, z, ch) {
    const rows = parts.rolls?.[level];
    const r = z - parts.origin.z, c = x - parts.origin.x;
    if (!rows?.[r]) return;
    const rolls = rows[r].trim().split(/\s+/);
    while (rolls.length <= c) rolls.push('-');
    const block = base.legend[ch];
    const dice = block && random ? random(seedFor(ch, [x, level, z])) : null;
    rolls[c] = dice ? `${0.93 + dice() * 0.12}${twins.has(block.type) && dice() < 0.5 ? 'b' : ''}` : '-';
    rows[r] = rolls.join(' ');
  }
  const layerAt = (level) => parts.layers.find((layer) => layer.level === level);
  const rect = (a, b, each) => {
    let changed = false;
    for (let z = Math.min(a[1], b[1]); z <= Math.max(a[1], b[1]); z++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) changed = each(x, z) || changed;
    return changed;
  };
  const thing = (index, data) => { parts.things[index] = { uid: parts.things[index].uid, data }; };

  const model = {
    base, empty,
    /** What is edited: { shape, origin, layers, regions, rolls, things: [{ uid, data }], start, arrivals }. Read it; change it through the model. */
    get parts() { return parts; },
    /** As the file has it (or as it was last saved). */
    get saved() { return saved; },
    map: () => mapOf(base, parts),
    get levels() { return parts.layers.map((layer) => layer.level); },
    get width() { return width(); },
    get height() { return height(); },
    inside,

    // ---------- blocks ----------
    charAt(level, x, z) { return layerAt(level)?.rows[z - parts.origin.z]?.[x - parts.origin.x] ?? empty; },
    /** One block: `ch` is a character of the legend; the empty character takes the block out. */
    paint(level, x, z, ch) {
      const layer = layerAt(level);
      if (!layer || !inside(x, z) || model.charAt(level, x, z) === ch) return false;
      settleRolls();
      setCell(layer.rows, x, z, ch, empty);
      roll(level, x, z, ch);
      return true;
    },
    erase: (level, x, z) => model.paint(level, x, z, empty),
    /** Every block of a rectangle of tiles, from corner [x, z] to corner [x, z]. */
    fill: (level, a, b, ch) => rect(a, b, (x, z) => model.paint(level, x, z, ch)),

    // ---------- regions ----------
    regionAt(x, z) { return parts.regions?.rows[z - parts.origin.z]?.[x - parts.origin.x] ?? '.'; },
    /** The region of a column: `ch` is a character of regions.names; any other character is the home region. */
    paintRegion: (x, z, ch) => Boolean(parts.regions) && setCell(parts.regions.rows, x, z, ch, '.'),
    fillRegion: (a, b, ch) => rect(a, b, (x, z) => model.paintRegion(x, z, ch)),

    // ---------- the size of the map ----------
    /** More tiles at the edges: { left, right, top, bottom }. The first tile of the first row moves with it (origin). */
    grow({ left = 0, right = 0, top = 0, bottom = 0 }) {
      const w = width();
      const wider = (rows, blank, joint = '') => {
        const line = (n) => Array(n).fill(blank).join(joint);
        const out = rows.map((row) => {
          const cells = joint ? row.trim().split(/\s+/) : [...row];
          while (cells.length < w) cells.push(blank);
          return [...Array(left).fill(blank), ...cells, ...Array(right).fill(blank)].join(joint);
        });
        return [...Array(top).fill(line(left + w + right)), ...out, ...Array(bottom).fill(line(left + w + right))];
      };
      for (const layer of parts.layers) layer.rows = wider(layer.rows, parts.shape === 'rows' ? ' ' : empty);
      if (parts.regions) parts.regions.rows = wider(parts.regions.rows, '.');
      for (const level of Object.keys(parts.rolls ?? {})) parts.rolls[level] = wider(parts.rolls[level], '-', ' ');
      parts.origin = { x: parts.origin.x - left, z: parts.origin.z - top };
    },
    /** A new, empty level of blocks. */
    addLevel(level) {
      if (parts.shape !== 'layers' || layerAt(level)) return false;
      parts.layers.push({ level, rows: Array.from({ length: height() }, () => empty.repeat(width())) });
      parts.layers.sort((a, b) => b.level - a.level);            // the highest first, as in the file
      return true;
    },

    // ---------- things ----------
    /** A new thing, after the others. One of a kind in data gets its own dice (`seed`), so it looks the same wherever it is in the list. */
    addThing(data, { seeded = true } = {}) {
      const at = anchorOf(data) ?? [0, 0, 0];
      parts.things.push({ uid: nextUid++, data: seeded && data.seed === undefined ? { ...data, seed: seedFor(data.kind, at, parts.things.length) } : data });
      return parts.things.length - 1;
    },
    setThing: thing,
    /** By whole tiles: everything that says where it is moves with it. */
    moveThing(index, dx, dz) {
      const data = { ...parts.things[index].data };
      for (const [key, moved] of Object.entries(shift)) if (data[key] !== undefined && numbers(data[key])) data[key] = moved(data[key], dx, dz);
      thing(index, data);
    },
    /** A quarter turn (or several; negative: the other way). */
    turnThing(index, quarters = 1) { thing(index, { ...parts.things[index].data, facing: turned(parts.things[index].data.facing, quarters) }); },
    removeThing(index) { parts.things.splice(index, 1); },

    // ---------- where the hero stands ----------
    setStart(patch) { parts.start = { ...parts.start, ...patch }; },
    /** An arrival by the name of the place the hero comes from; null takes it out. */
    setArrival(name, patch) {
      const arrivals = { ...parts.arrivals };
      if (patch === null) delete arrivals[name]; else arrivals[name] = { facing: 0, ...arrivals[name], ...patch };
      parts.arrivals = arrivals;
    },

    // ---------- undo and redo ----------
    /** The edits since the last commit become one step. False when nothing changed. */
    commit() {
      if (same(parts, history[step])) return false;
      history = history.slice(Math.max(0, step + 2 - limit), step + 1);
      history.push(copy(parts));
      step = history.length - 1;
      return true;
    },
    /** Drops the edits since the last commit. */
    revert() { parts = copy(history[step]); settled = false; },
    get canUndo() { return step > 0; },
    get canRedo() { return step < history.length - 1; },
    undo() { if (step === 0) return false; parts = copy(history[--step]); settled = false; return true; },
    redo() { if (step >= history.length - 1) return false; parts = copy(history[++step]); settled = false; return true; },
    /** Is it other than the file? */
    get changed() { return !same(parts, saved); },
    /** The file now holds this. */
    markSaved() { saved = copy(parts); },
  };
  return model;
}
