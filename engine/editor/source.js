// @ts-check
// A map file as text. The editor does not write a map file anew: it changes only what was edited in the text
// that is there (a row of a grid, a value of a thing, a thing added or taken out), so the header comment, the
// legend, the comments beside the things, the imports and the sums (`Math.PI / 2`, `TEXT.torchTitle`) stay as
// they were written. For a map that has no file yet, moduleSource() writes one in the same layout.
// Nothing here needs a browser or three.js.

const IDENT = /^[A-Za-z_$][\w$]*$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const pad = (n) => ' '.repeat(n);

/** Are two values of a map the same, all the way down? */
export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, k) => same(v, b[k]));
  const keys = Object.keys(a).filter((k) => a[k] !== undefined);
  return keys.length === Object.keys(b).filter((k) => b[k] !== undefined).length && keys.every((k) => same(a[k], b[k]));
}

// ---------- reading the text ----------
function skipString(text, i) {
  const quote = text[i];
  i++;
  while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
  return i + 1;
}
/** Past the blanks and the comments. */
function skipSpace(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text.startsWith('//', i)) { const n = text.indexOf('\n', i); i = n < 0 ? text.length : n; }
    else if (text.startsWith('/*', i)) { const n = text.indexOf('*/', i); i = n < 0 ? text.length : n + 2; }
    else return i;
  }
}
/** The end of the value that starts at i: just after its last character. */
function skipValue(text, i) {
  let depth = 0;
  let end = i;
  while (i < text.length) {
    const c = text[i];
    if (c === '\'' || c === '"' || c === '`') { i = skipString(text, i); end = i; continue; }
    if (text.startsWith('//', i) || text.startsWith('/*', i)) { i = skipSpace(text, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return end; depth--; }
    else if ((c === ',' || c === ';') && depth === 0) return end;
    i++;
    if (!/\s/.test(c)) end = i;
  }
  return end;
}
const unquote = (text) => text.slice(1, -1).replace(/\\(.)/g, '$1');

/** The properties of the object literal that starts at `start`: [{ key, start, valueStart, valueEnd }]. `key` is null for what is not `key: value`. */
export function readObject(text, start) {
  const props = [];
  let i = skipSpace(text, start + 1);
  while (i < text.length && text[i] !== '}') {
    const at = i;
    let key = null;
    if (text[i] === '\'' || text[i] === '"') { const end = skipString(text, i); key = unquote(text.slice(i, end)); i = end; }
    else { const name = /^[\w$]+/.exec(text.slice(i, i + 120)); if (name) { key = name[0]; i += key.length; } }
    let valueStart = at;
    const after = skipSpace(text, i);
    if (key !== null && text[after] === ':') valueStart = skipSpace(text, after + 1);
    else if (key === null || (text[after] !== ',' && text[after] !== '}')) key = null;      // a spread, a method: not ours to change
    const valueEnd = skipValue(text, valueStart);
    if (valueEnd <= at) throw new Error(`the map file cannot be read near: ${text.slice(at, at + 40)}`);
    props.push({ key, start: at, valueStart, valueEnd });
    i = skipSpace(text, valueEnd);
    if (text[i] === ',') i = skipSpace(text, i + 1);
  }
  return { start, end: i + 1, props };
}
/** The items of the array literal that starts at `start`: [{ start, end }]. */
export function readArray(text, start) {
  const items = [];
  let i = skipSpace(text, start + 1);
  while (i < text.length && text[i] !== ']') {
    const end = skipValue(text, i);
    if (end <= i) throw new Error(`the map file cannot be read near: ${text.slice(i, i + 40)}`);
    items.push({ start: i, end });
    i = skipSpace(text, end);
    if (text[i] === ',') i = skipSpace(text, i + 1);
  }
  return { start, end: i + 1, items };
}
/** Where the value of `const name = ` starts, or -1. */
export function findConst(text, name) {
  const found = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=\\s*`).exec(text);
  return found ? found.index + found[0].length : -1;
}
/** What the file imports by name: { NAME: './file.js' }. */
export function importsOf(text) {
  const out = {};
  for (const [, names, file] of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const name of names.split(',')) { const local = name.trim().split(/\s+as\s+/).pop(); if (local) out[local] = file; }
  }
  return out;
}
/** The header of a file: its first comment lines. */
export const headerOf = (text) => /^(?:[ \t]*\/\/.*\n)*/.exec(text)[0];

// ---------- writing a value ----------
const TURNS = [[Math.PI / 2, 'Math.PI / 2'], [Math.PI, 'Math.PI'], [-Math.PI / 2, '-Math.PI / 2'], [-Math.PI, '-Math.PI'], [Math.PI * 1.5, 'Math.PI * 1.5'],
  [Math.PI / 4, 'Math.PI / 4'], [-Math.PI / 4, '-Math.PI / 4'], [Math.PI * 0.75, 'Math.PI * 0.75'], [-Math.PI * 0.75, '-Math.PI * 0.75']];
const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n')}'`;
const keyText = (key) => (IDENT.test(key) ? key : quote(key));
/** A value as it is written in a map: on one line, `facing` as a part of a turn. */
export function js(value, key = '') {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (key === 'facing') for (const [turn, text] of TURNS) if (value === turn) return text;
    return String(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map((v) => js(v)).join(', ')}]`;
  if (isObject(value)) {
    const parts = Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${keyText(k)}: ${js(v, k)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  throw new Error(`a ${typeof value} cannot be written into a map (${key})`);
}
/** A grid: one row of text per line. */
export const grid = (rows, indent) => `[\n${rows.map((row) => `${pad(indent + 2)}${quote(row)},`).join('\n')}\n${pad(indent)}]`;
// The rows of a map (`rows`) and the rolls of a level (`'0.5': [...]`) are grids.
const isGrid = (key, value) => Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string') && (key === 'rows' || /^-?\d+(\.\d+)?$/.test(key));
const write = (value, key, indent) => (isGrid(key, value) ? grid(value, indent) : js(value, key));
const layerText = (layer, indent) => `{ level: ${js(layer.level)},\n${pad(indent + 2)}rows: ${grid(layer.rows, indent + 2)} }`;

// ---------- changing the text ----------
const lineStart = (text, i) => text.lastIndexOf('\n', i - 1) + 1;
const lineIndent = (text, i) => /^[ \t]*/.exec(text.slice(lineStart(text, i), i))[0].length;      // the indent of the line `i` is on

// What must change in the text between `start` and `end` for the value there to become `now`. Only what differs is touched.
function valueEdits(text, start, end, was, now, key, edits) {
  if (same(was, now)) return;
  const indent = lineIndent(text, start);
  if (isObject(was) && isObject(now) && text[start] === '{') {
    const { props } = readObject(text, start);
    const has = (name) => props.some((p) => p.key === name);
    const kept = props.filter((p) => now[p.key] !== undefined);
    if (kept.length && props.every((p) => p.key !== null) && Object.keys(was).every((name) => was[name] === undefined || has(name))) {
      props.forEach((p, n) => {
        if (now[p.key] === undefined) edits.push({ start: p.start, end: props[n + 1] ? props[n + 1].start : p.valueEnd, text: '' });
        else if (!same(was[p.key], now[p.key]) && p.valueStart === p.start) edits.push({ start: p.start, end: p.valueEnd, text: `${keyText(p.key)}: ${write(now[p.key], p.key, indent)}` });
        else valueEdits(text, p.valueStart, p.valueEnd, was[p.key], now[p.key], p.key, edits);
      });
      const last = kept[kept.length - 1];
      const after = props[props.indexOf(last) + 1];
      if (after) edits.push({ start: last.valueEnd, end: after.start, text: '' });      // the comma before what was taken off the end
      const added = Object.keys(now).filter((name) => now[name] !== undefined && !has(name));
      if (added.length) edits.push({ start: last.valueEnd, end: last.valueEnd, text: added.map((name) => `, ${keyText(name)}: ${write(now[name], name, indent)}`).join('') });
      return;
    }
  }
  edits.push({ start, end, text: write(now, key, indent) });
}

// A list whose items are known by an id (the things of a map, its levels): items are changed in place, taken out
// with their line, and new ones are put in after the one before them. `was` is in the order of the text.
function listEdits(text, start, end, was, now, key, fresh, edits) {
  if (was.length === now.length && was.every((item, k) => item.id === now[k].id && same(item.value, now[k].value))) return;
  const indent = lineIndent(text, start);
  const whole = () => edits.push({ start, end, text: `[\n${now.map((item) => `${pad(indent + 2)}${fresh(item.value, indent + 2)},`).join('\n')}\n${pad(indent)}]` });
  if (text[start] !== '[') return whole();
  const { items } = readArray(text, start);
  const place = new Map(was.map((item, k) => [item.id, k]));
  const kept = now.filter((item) => place.has(item.id)).map((item) => place.get(item.id));
  if (items.length !== was.length || !kept.length || kept.some((k, n) => n > 0 && k <= kept[n - 1])) return whole();

  const stays = new Set(kept);
  items.forEach((item, k) => {
    if (stays.has(k)) return;
    let from = item.start;
    let to = item.end;
    let q = to;
    while (text[q] === ' ' || text[q] === '\t') q++;
    if (text[q] === ',') to = q = q + 1;
    if (text.slice(lineStart(text, from), from).trim() === '') {                       // it has its line to itself: the line goes too
      while (text[q] === ' ' || text[q] === '\t') q++;
      if (text.startsWith('//', q)) q = text.indexOf('\n', q) < 0 ? text.length : text.indexOf('\n', q);
      if (text[q] === '\n') { from = lineStart(text, from); to = q + 1; }
    } else while (text[to] === ' ') to++;
    edits.push({ start: from, end: to, text: '' });
  });
  const itemIndent = text.slice(lineStart(text, items[0].start), items[0].start).trim() === '' ? lineIndent(text, items[0].start) : indent + 2;
  const added = new Map();             // the kept item before them (-1: none) -> the new items
  let before = -1;
  for (const item of now) {
    if (place.has(item.id)) {
      before = place.get(item.id);
      valueEdits(text, items[before].start, items[before].end, was[before].value, item.value, key, edits);
    } else added.set(before, [...(added.get(before) ?? []), item]);
  }
  for (const [k, list] of added) {
    const lines = list.map((item) => `\n${pad(itemIndent)}${fresh(item.value, itemIndent)},`).join('');
    if (k < 0) { edits.push({ start: start + 1, end: start + 1, text: lines }); continue; }
    let q = items[k].end;
    while (text[q] === ' ' || text[q] === '\t') q++;
    if (text[q] === ',') q++; else { edits.push({ start: items[k].end, end: items[k].end, text: ',' }); q = items[k].end; }
    let tail = q;
    while (text[tail] === ' ' || text[tail] === '\t') tail++;
    if (text.startsWith('//', tail)) q = text.indexOf('\n', tail) < 0 ? text.length : text.indexOf('\n', tail);      // after the comment beside it
    edits.push({ start: q, end: q, text: lines });
  }
}

function apply(text, edits) {
  const order = edits.map((edit, k) => ({ ...edit, k })).sort((a, b) => b.start - a.start || (b.end - b.start) - (a.end - a.start) || b.k - a.k);
  for (let k = 1; k < order.length; k++) if (order[k].end > order[k - 1].start) throw new Error('the changes to the map file overlap');
  for (const edit of order) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  return text;
}

/**
 * The text of a map file after the edits.
 * @param {string} text the file as it is
 * @param {string} name the name the map is exported by (`DUNGEON`)
 * @param {any} was what the editor read from the file (model.js: partsOf)
 * @param {any} now what it holds now
 * @returns {{ text: string, notes: string[] }} notes: what could not be written here (the rolls kept in another file)
 */
export function patchSource(text, name, was, now) {
  const at = findConst(text, name);
  if (at < 0 || text[at] !== '{') throw new Error(`no map named ${name} in the file`);
  const top = readObject(text, at);
  const edits = [];
  const notes = [];
  // where the value of a property of the map is written: in the map itself, or in a `const` of the same file it names
  function target(key) {
    const prop = top.props.find((p) => p.key === key);
    if (!prop) return null;
    const source = text.slice(prop.valueStart, prop.valueEnd);
    if (!IDENT.test(source)) return { start: prop.valueStart, end: prop.valueEnd };
    const start = findConst(text, source);
    return start < 0 ? { elsewhere: source } : { start, end: skipValue(text, start) };
  }
  const add = (key, value) => edits.push({ start: top.end - 1, end: top.end - 1, text: `  ${keyText(key)}: ${write(value, key, 2)},\n` });
  function plain(key, before, after) {
    if (same(before, after)) return;
    const t = target(key);
    if (!t) add(key, after);
    else if (t.elsewhere) notes.push(key);
    else valueEdits(text, t.start, t.end, before, after, key, edits);
  }
  function list(key, before, after, fresh) {
    const t = target(key);
    if (!t || t.elsewhere) return plain(key, before.map((item) => item.value), after.map((item) => item.value));
    return listEdits(text, t.start, t.end, before, after, key, fresh, edits);
  }
  plain('origin', was.origin, now.origin);
  if (now.shape === 'layers') {
    const layers = (parts) => parts.layers.map((layer) => ({ id: layer.level, value: { level: layer.level, rows: layer.rows } }));
    list('layers', layers(was), layers(now), layerText);
    plain('regions', was.regions, now.regions);
    plain('rolls', was.rolls, now.rolls);
  } else plain('rows', was.layers[0].rows, now.layers[0].rows);
  plain('start', was.start, now.start);
  plain('arrivals', was.arrivals, now.arrivals);
  const things = (parts) => parts.things.map((thing) => ({ id: thing.uid, value: thing.data }));
  list('things', things(was), things(now), (value) => js(value));
  return { text: apply(text, edits), notes };
}

/** Where the rolls of a map are kept when not in the map itself: { name, file } (an import), or null. */
export function rollsElsewhere(text, name) {
  const at = findConst(text, name);
  if (at < 0 || text[at] !== '{') return null;
  const prop = readObject(text, at).props.find((p) => p.key === 'rolls');
  const source = prop ? text.slice(prop.valueStart, prop.valueEnd) : '';
  const file = IDENT.test(source) && findConst(text, source) < 0 ? importsOf(text)[source] : null;
  return file ? { name: source, file } : null;
}
/** The text of the file of rolls after the edits: only the rows that changed are written anew. */
export function patchRolls(text, name, was, now) {
  const at = findConst(text, name);
  if (at < 0) throw new Error(`no rolls named ${name} in the file`);
  const edits = [];
  valueEdits(text, at, skipValue(text, at), was, now, 'rolls', edits);
  return apply(text, edits);
}

/** A whole map file, for a map that has none yet: the same layout as the maps written by hand. */
export function moduleSource(map, { name, header = '' }) {
  const lines = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    if (key === 'layers') lines.push(`  layers: [\n${value.map((layer) => `    ${layerText(layer, 4)},`).join('\n')}\n  ],`);
    else if (key === 'things') lines.push(`  things: [\n${value.map((thing) => `    ${js(thing)},`).join('\n')}\n  ],`);
    else if (key === 'legend') lines.push(`  legend: {\n${Object.entries(value).map(([ch, entry]) => `    ${keyText(ch)}: ${js(entry)},`).join('\n')}\n  },`);
    else if (key === 'regions') lines.push(`  regions: {\n    names: ${js(value.names)},\n    rows: ${grid(value.rows, 4)},\n  },`);
    else if (key === 'rolls') lines.push(`  rolls: {\n${Object.entries(value).map(([level, rows]) => `    ${quote(level)}: ${grid(rows, 4)},`).join('\n')}\n  },`);
    else lines.push(`  ${keyText(key)}: ${write(value, key, 2)},`);
  }
  return `${header}export const ${name} = {\n${lines.join('\n')}\n};\n`;
}

/** A file named from another: beside('game/maps/dungeon.js', './dungeon-rolls.js') is 'game/maps/dungeon-rolls.js'. */
export function beside(file, other) {
  const parts = file.split('/').slice(0, -1);
  for (const part of other.split('/')) { if (part === '..') parts.pop(); else if (part !== '.' && part !== '') parts.push(part); }
  return parts.join('/');
}

/**
 * What has to be written for the edits to be saved: the map file, and the file of its rolls when that changed.
 * @param {{ file: string, text: string, name: string, rolls?: { file: string, text: string, name: string } | null }} source
 *   the map file as it is (`name`: what the map is exported by), and the file its rolls are kept in, if another
 * @returns {{ files: { file: string, text: string }[], notes: string[], source: any }} files: only the ones that
 *   changed; notes: parts of the map that are kept where the editor cannot write them; source: as it is after saving
 */
export function savedFiles(source, was, now) {
  const map = patchSource(source.text, source.name, was, now);
  const files = [];
  const notes = map.notes.filter((key) => key !== 'rolls' || !source.rolls);
  let rolls = source.rolls ?? null;
  if (map.notes.includes('rolls') && rolls) {
    rolls = { ...rolls, text: patchRolls(rolls.text, rolls.name, was.rolls, now.rolls) };
    if (rolls.text !== source.rolls.text) files.push({ file: rolls.file, text: rolls.text });
  }
  if (map.text !== source.text) files.push({ file: source.file, text: map.text });
  return { files, notes, source: { ...source, text: map.text, rolls } };
}
