// @ts-check
// The map editor's page: it opens one map of one game (?game=dungeons-and-knowledge&map=dungeon), shows it with
// the engine (view.js), and lets the map be changed (model.js) with a few tools; Save writes the changes into the
// map's own file (source.js) through the local server (dev-server.py: POST /editor/save).
// What a game must give is one small module, <game>/app/game/editor.js (see README.md).
import { createModel, anchorOf, usable, turned } from './model.js';
import { savedFiles, rollsElsewhere, beside } from './source.js';
import { createView, loadEngine } from './view.js';

const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else node[name] = value;
  }
  node.append(...kids.filter((kid) => kid !== null && kid !== undefined && kid !== false));
  return node;
}
const TEXT = {
  tools: [
    { id: 'select', label: 'Избор', note: 'Цъкни нещо, за да го избереш, и го влачи, за да го преместиш. Влаченето по празно мести изгледа.' },
    { id: 'brush', label: 'Четка', note: 'Рисува избраното кубче (или район) на избраното ниво.' },
    { id: 'eraser', label: 'Гума', note: 'Маха кубчетата на избраното ниво (или връща основния район).' },
    { id: 'rect', label: 'Правоъгълник', note: 'Влачи от ъгъл до ъгъл: запълва с избраното кубче (или район).' },
    { id: 'place', label: 'Ново нещо', note: 'Избери вид отдолу и цъкни плочка.' },
    { id: 'spawn', label: 'Старт', note: 'Цъкни плочка: там застава героят. Коя точка местиш, избираш вдясно.' },
  ],
  saved: 'записано', changed: 'има незаписани промени', nothing: 'Няма какво да се запише.', saving: 'Записвам…',
  savedNow: (files) => `Записано: ${files.join(', ')}`, saveFailed: (why) => `Не се записа: ${why}`,
  elsewhere: (keys) => `Не е записано (държи се в друг файл): ${keys.join(', ')}`,
  viewIso: 'Изглед: като в играта', viewTop: 'Изглед: отгоре',
  noEditor: (game) => `Играта „${game}“ не може да се отвори: няма game/editor.js, нито карти в game/maps/.\nВ game/editor.js играта казва на редактора кои са картите ѝ и с какви кубчета и видове неща се рисуват (вж. README.md на редактора).`,
  noMap: (map, maps) => `Няма карта „${map}“. Картите на играта: ${maps.join(', ')}.`,
  empty: 'празно', home: 'основен', floor: 'под', code: 'от код', outside: 'извън картата',
  leave: 'Има незаписани промени.',
};
const REGION_COLOURS = [0x4aa3ff, 0xff8a3d, 0x9be15d, 0xd77bff, 0xffd84a, 0x4fe0c8, 0xff6f91];
const hex = (colour) => (typeof colour === 'number' ? `#${colour.toString(16).padStart(6, '0')}` : colour ?? '#888888');

function trouble(text) {
  $('trouble').textContent = text;
  $('trouble').hidden = false;
}

// A game with no game/editor.js of its own, made of the engine's defaults (engine/defaults/game.js) and its own
// kinds in data (game/kinds.js or game/kinds/index.js): its maps are the files of game/maps/.
async function plainGame(root, gameName, asked) {
  const defaults = await import(`${root}engine/defaults/game.js`).then((module) => module.defaults, () => null);
  if (!defaults) return null;
  const listing = await fetch(`${root}game/maps/`).then((r) => (r.ok ? r.text() : ''), () => '');
  const names = [...listing.matchAll(/href="([\w-]+)\.js"/g)].map((found) => found[1]).filter((name) => !name.endsWith('-rolls'));
  if (asked && !names.includes(asked)) names.push(asked);
  if (!names.length) return null;
  const own = [];
  for (const file of ['game/kinds.js', 'game/kinds/index.js']) {
    const kinds = await import(root + file).then((module) => module.KINDS, () => null);
    if (kinds) { own.push(kinds); break; }
  }
  return {
    title: gameName,
    maps: Object.fromEntries(names.map((name) => [name, { file: `game/maps/${name}.js`, play: '' }])),
    config() { const base = defaults(); return { ...base, kinds: [...base.kinds, ...own] }; },
  };
}

async function start() {
  const query = new URLSearchParams(location.search);
  const gameName = query.get('game') ?? 'dungeons-and-knowledge';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(gameName)) throw new Error(TEXT.noEditor(gameName));
  const root = `/${gameName}/`;
  const described = await import(`${root}game/editor.js`).then((module) => module.EDITOR, () => null) ?? await plainGame(root, gameName, query.get('map'));
  if (!described) throw new Error(TEXT.noEditor(gameName));
  const mapName = query.get('map') ?? Object.keys(described.maps)[0];
  const entry = described.maps[mapName];
  if (!entry) throw new Error(TEXT.noMap(mapName, Object.keys(described.maps)));

  // the map: as the game reads it (the module), and as it is written (its text)
  const [module, text] = await Promise.all([import(root + entry.file), fetch(root + entry.file).then((r) => r.text())]);
  const [exportName, base] = Object.entries(module).find(([, value]) => value && typeof value === 'object' && value.legend) ?? [];
  if (!base) throw new Error(TEXT.noMap(mapName, Object.keys(described.maps)));
  let source = { file: entry.file, text, name: exportName, rolls: null };
  const rollsAt = rollsElsewhere(text, exportName);
  if (rollsAt) {
    const file = beside(entry.file, rollsAt.file);
    source.rolls = { file, name: rollsAt.name, text: await fetch(root + file).then((r) => r.text()) };
  }

  const engine = await loadEngine((name) => import(`${root}engine/${name}.js`));
  const game = await described.config(base);
  const model = createModel(base, { random: engine.random.mulberry32, twins: game.blocks.twins });
  const canvas = /** @type {HTMLCanvasElement} */ ($('scene'));
  const view = createView({ engine, game, canvas });
  const layered = model.parts.shape === 'layers';
  const legend = base.legend;

  const state = {
    tool: 'select',
    target: 'blocks',                  // what the brush paints: 'blocks' or 'regions'
    level: model.levels.includes(-0.5) ? -0.5 : model.levels[0],
    upTo: false, fade: true,
    char: Object.keys(legend)[0],
    regionChar: Object.keys(model.parts.regions?.names ?? {})[0] ?? '.',
    kind: null,
    selected: null,                    // the uid of the chosen thing
    spawn: 'start',                    // 'start', or the name of an arrival
    showTiles: true,
  };
  const show = () => ({ upTo: state.upTo && layered ? state.level : undefined, fade: state.fade });
  const indexOf = (uid) => model.parts.things.findIndex((thing) => thing.uid === uid);
  const painting = () => state.tool === 'brush' || state.tool === 'eraser' || state.tool === 'rect';
  const planeY = () => (painting() && state.target === 'blocks' ? state.level + 0.5 : 0);     // the top of the level painted on
  let status = '';
  let marksStamp = '';

  // ---------- what is drawn over the world ----------
  function staticMarks() {
    const { parts } = model;
    const list = [];
    const floor = (x, z) => view.tileY(x, z);
    if (state.target === 'regions' && parts.regions && painting()) {
      const names = Object.keys(parts.regions.names);
      const cells = names.map(() => []);
      parts.regions.rows.forEach((row, r) => [...row].forEach((ch, c) => { const k = names.indexOf(ch); if (k >= 0) cells[k].push([parts.origin.x + c, parts.origin.z + r]); }));
      names.forEach((name, k) => list.push({ cells: cells[k], y: floor, colour: REGION_COLOURS[k % REGION_COLOURS.length], opacity: 0.38, inset: 0 }));
    }
    if (state.showTiles) {
      const shut = parts.things.flatMap((thing) => [...(thing.data.blocks ?? []), ...(thing.data.gate ?? [])]).filter((cell) => Array.isArray(cell));
      list.push({ cells: shut, y: floor, colour: 0xff5a4a, opacity: 0.3 });
    }
    const chosen = parts.things[indexOf(state.selected)]?.data;
    if (chosen) {
      const cells = (value) => (Array.isArray(value) ? value.filter((cell) => Array.isArray(cell) && cell.length === 2) : []);
      list.push({ cells: cells(chosen.tiles), y: floor, colour: 0xffd84a, opacity: 0.5 });
      list.push({ cells: [...cells(chosen.blocks), ...cells(chosen.gate)], y: floor, colour: 0xff5a4a, opacity: 0.55 });
      list.push({ cells: cells([chosen.front]), y: floor, colour: 0x6be06b, opacity: 0.7, inset: 0.18 });
    }
    list.push({ cells: [parts.start.tile, ...Object.values(parts.arrivals).map((arrival) => arrival.tile)].filter(Boolean), y: floor, colour: 0x6fc3ff, opacity: 0.5, inset: 0.12 });
    view.mark('static', list);
  }
  const pointerMarks = (cells, strong = false) => view.mark('pointer', [
    { cells, y: planeY(), colour: 0xffffff, opacity: strong ? 0.6 : 0.4 },
    ...(painting() && state.target === 'blocks' ? [{ cells, y: planeY() - 1, colour: 0xffffff, opacity: 0.15 }] : []),
  ]);

  // ---------- the marks of the things: one small button over each ----------
  function renderMarks() {
    const quiet = state.tool !== 'select';
    const marks = model.parts.things.map((thing, k) => {
      const at = anchorOf(thing.data);
      if (!at) return null;
      const failed = view.placed[k]?.error;
      const label = (view.things.data(thing.data.kind)?.label ?? thing.data.kind).slice(0, 2);
      const mark = el('button', { type: 'button', class: `mark${thing.uid === state.selected ? ' is-on' : ''}${failed ? ' is-bad' : ''}${quiet ? ' is-quiet' : ''}`,
        title: `${k + 1}. ${thing.data.kind}${thing.data.id ? ` #${thing.data.id}` : ''}${failed ? `: ${failed}` : ''}`, textContent: label });
      mark.dataset.uid = String(thing.uid);
      mark.dataset.at = at.join(',');
      mark.addEventListener('pointerdown', (e) => grabMark(e, mark, thing.uid));
      return mark;
    });
    const spawns = [['start', model.parts.start], ...Object.entries(model.parts.arrivals)].filter(([, spawn]) => spawn?.tile).map(([name, spawn]) => {
      const mark = el('span', { class: `mark is-spawn is-quiet${state.tool === 'spawn' && state.spawn === name ? ' is-on' : ''}`, title: name, textContent: '▲' });
      mark.dataset.at = [spawn.tile[0], view.tileY(...spawn.tile), spawn.tile[1]].join(',');
      mark.dataset.turn = String(spawn.facing ?? 0);
      return mark;
    });
    $('marks').replaceChildren(...marks.filter(Boolean), ...spawns);
    marksStamp = '';
  }
  function placeMarks() {
    const { cam } = view;
    const stamp = [cam.mode, cam.zoom, cam.width, cam.height, ...cam.look].join();
    if (stamp === marksStamp) return;
    marksStamp = stamp;
    for (const mark of $('marks').children) {
      const [x, y] = cam.project(mark.dataset.at.split(',').map(Number));
      // a spawn's arrow points where the hero faces: facing 0 is towards +z
      const turn = mark.dataset.turn === undefined ? '' : ` rotate(${(cam.mode === 'iso' ? 135 : 180) - (Number(mark.dataset.turn) * 180) / Math.PI}deg)`;
      mark.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${turn}`;
    }
  }
  // A thing is dragged by its mark, by whole tiles.
  let moving = null;
  function grabMark(e, mark, uid) {
    if (e.button !== 0) return;
    e.preventDefault();
    select(uid, false);
    const data = model.parts.things[indexOf(uid)].data;
    if (!Array.isArray(data.at) || data.at.some((n) => typeof n !== 'number')) return;         // only what says where it stands can be dragged
    mark.setPointerCapture(e.pointerId);
    moving = { uid, mark, from: view.cam.cellAt(...point(e), 0), at: mark.dataset.at.split(',').map(Number), delta: [0, 0] };
    mark.addEventListener('pointermove', dragMark);
    mark.addEventListener('pointerup', dropMark, { once: true });
    mark.addEventListener('pointercancel', dropMark, { once: true });
  }
  function dragMark(e) {
    const [x, z] = view.cam.cellAt(...point(e), 0);
    moving.delta = [x - moving.from[0], z - moving.from[1]];
    const [sx, sy] = view.cam.project([moving.at[0] + moving.delta[0], moving.at[1], moving.at[2] + moving.delta[1]]);
    moving.mark.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    pointerMarks([[Math.round(moving.at[0]) + moving.delta[0], Math.round(moving.at[2]) + moving.delta[1]]], true);
    say(`${x}, ${z}`);
  }
  function dropMark() {
    if (!moving) return;
    const { uid, mark, delta } = moving;
    mark.removeEventListener('pointermove', dragMark);
    moving = null;
    pointerMarks([]);
    if (!delta[0] && !delta[1]) return;
    model.moveThing(indexOf(uid), delta[0], delta[1]);
    if (model.commit()) thingsChanged();
  }

  // ---------- the left sheet ----------
  function renderTools() {
    $('tools').replaceChildren(...TEXT.tools.map((tool) => el('button', { type: 'button', class: tool.id === state.tool ? 'is-on' : '', textContent: tool.label, onclick: () => setTool(tool.id) })));
    $('tool-note').textContent = TEXT.tools.find((tool) => tool.id === state.tool).note;
    $('blocks-box').hidden = !painting();
    $('kinds-box').hidden = state.tool !== 'place';
    $('spawn-box').hidden = state.tool !== 'spawn';
    canvas.classList.toggle('is-pan', state.tool === 'select');
  }
  function renderLevels() {
    $('levels-box').hidden = !layered || state.target !== 'blocks';
    $('levels').replaceChildren(...model.levels.map((level) => el('button', { type: 'button', class: level === state.level ? 'is-on' : '', textContent: String(level),
      onclick: () => { state.level = level; renderLevels(); if (state.upTo) rebuild(); } })));
    $('size').textContent = `${model.width} × ${model.height} плочки, от x = ${model.parts.origin.x}, z = ${model.parts.origin.z}`;
  }
  function renderPalette() {
    const regions = state.target === 'regions';
    $('palette-title').textContent = regions ? 'Райони' : 'Кубчета';
    const names = model.parts.regions?.names ?? {};
    const slots = regions
      ? [{ ch: '.', label: TEXT.home, colour: '#555555' }, ...Object.entries(names).map(([ch, name], k) => ({ ch, label: name, colour: hex(REGION_COLOURS[k % REGION_COLOURS.length]) }))]
      : [...(layered ? [{ ch: model.empty, label: TEXT.empty, colour: 'transparent' }] : []), ...Object.entries(legend).map(([ch, block]) => ({
        ch, low: (block.top ?? 1) < 1,
        label: layered ? `${block.type}${block.walk ? ` · ${TEXT.floor}` : ''}` : (block.thing ?? block.grow ?? block.ground ?? base.ground),
        colour: hex(game.blocks.flat?.[block.type ?? block.ground ?? base.ground]),
      }))];
    const chosen = regions ? state.regionChar : state.char;
    $('palette').replaceChildren(...slots.map((slot) => el('button', { type: 'button', class: slot.ch === chosen ? 'is-on' : '', title: slot.label,
      onclick: () => { if (regions) state.regionChar = slot.ch; else state.char = slot.ch; if (state.tool === 'eraser') setTool('brush'); else renderPalette(); } },
    el('span', { class: `swatch${slot.low ? ' is-low' : ''}`, textContent: slot.ch === ' ' ? '␣' : slot.ch, style: `background:${slot.colour}` }), el('small', { textContent: slot.label }))));
  }
  function renderKinds() {
    const kinds = view.kinds.sort((a, b) => Number(!a.data) - Number(!b.data) || a.label.localeCompare(b.label, 'bg'));
    state.kind ??= kinds[0]?.name ?? null;
    $('kinds').replaceChildren(...kinds.map((kind) => el('button', { type: 'button', class: kind.name === state.kind ? 'is-on' : '',
      onclick: () => { state.kind = kind.name; renderKinds(); } }, el('span', { textContent: kind.label }), el('small', { textContent: kind.data ? kind.name : `${kind.name} · ${TEXT.code}` }))));
  }

  // ---------- the right sheet ----------
  function renderThings() {
    $('things').replaceChildren(...model.parts.things.map((thing, k) => {
      const failed = view.placed[k]?.error;
      return el('li', {}, el('button', { type: 'button', class: `${thing.uid === state.selected ? 'is-on' : ''}${failed ? ' is-bad' : ''}`, title: failed ?? '',
        onclick: () => select(thing.uid, true) },
      el('span', { class: 'n', textContent: String(k + 1) }), el('span', { textContent: view.things.data(thing.data.kind)?.label ?? thing.data.kind }),
      el('small', { textContent: thing.data.id ? `#${thing.data.id}` : thing.data.kind })));
    }));
  }
  const field = (label, control, wide = false) => el('label', { class: `field${wide ? ' is-wide' : ''}` }, el('span', { textContent: label }), control);
  // One value as text: a number, a word, or (for a list or a group of values) as it is written in JSON.
  function valueInput(value, fallback, onValue) {
    const sample = value ?? fallback;
    if (typeof sample === 'boolean') return el('input', { type: 'checkbox', checked: Boolean(value ?? fallback), onchange: (e) => onValue(e.target.checked) });
    const plain = typeof sample === 'number' || typeof sample === 'string';
    const input = el('input', { type: typeof sample === 'number' ? 'number' : 'text', step: 'any', value: value === undefined ? '' : plain ? String(value) : JSON.stringify(value),
      placeholder: fallback === undefined ? '' : plain ? String(fallback) : JSON.stringify(fallback) });
    input.addEventListener('change', () => {
      const typed = input.value.trim();
      input.classList.remove('is-bad');
      if (typed === '') return onValue(undefined);
      if (typeof sample === 'string') return onValue(input.value);
      try { return onValue(JSON.parse(typed)); } catch { input.classList.add('is-bad'); return undefined; }
    });
    return input;
  }
  function renderThingForm() {
    const index = indexOf(state.selected);
    $('thing-box').hidden = index < 0;
    if (index < 0) return;
    const data = model.parts.things[index].data;
    const kind = view.things.data(data.kind);
    const failed = view.placed[index]?.error;
    const set = (patch) => {
      const next = { ...model.parts.things[indexOf(state.selected)].data, ...patch };
      for (const name of Object.keys(next)) if (next[name] === undefined) delete next[name];
      model.setThing(indexOf(state.selected), next);
      if (model.commit()) thingsChanged();
    };
    const at = anchorOf(data);
    const tile = at ? [Math.round(at[0]), Math.round(at[2])] : null;
    const group = (name, keys, texts) => {
      const now = data[name] ?? {};
      const put = (key, value) => { const next = { ...now, [key]: value }; for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k]; set({ [name]: Object.keys(next).length ? next : undefined }); };
      return keys.map((key, k) => field(texts[k], key === 'items'
        ? valueInput(now.items, [], (value) => put('items', value))
        : el('textarea', { class: 'is-text', rows: key === 'text' ? 3 : 1, value: now[key] ?? '', onchange: (e) => put(key, e.target.value) })));
    };
    const params = Object.entries(kind?.params ?? {});
    const handled = new Set(['kind', 'id', 'at', 'facing', 'region', 'blocks', 'talk', 'take', 'travel', ...params.map(([name]) => name)]);
    const rest = Object.fromEntries(Object.entries(data).filter(([name]) => !handled.has(name)));
    const other = el('textarea', { rows: Math.min(12, Object.keys(rest).length + 2), value: `{\n${Object.entries(rest).map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(',\n')}\n}` });
    other.addEventListener('change', () => {
      let typed = null;
      try { typed = JSON.parse(other.value); } catch { typed = null; }
      other.classList.toggle('is-bad', !typed || typeof typed !== 'object' || Array.isArray(typed));
      if (other.classList.contains('is-bad')) return;
      set({ ...Object.fromEntries(Object.keys(rest).map((name) => [name, undefined])), ...typed });
    });
    const regions = Object.values(model.parts.regions?.names ?? {});

    $('thing-title').textContent = `${index + 1}. ${kind?.label ?? data.kind}`;
    $('thing-form').replaceChildren(
      el('p', { class: 'note', textContent: `${data.kind}${kind ? '' : ` · ${TEXT.code}`}` }),
      failed && el('p', { class: 'trouble-line', textContent: failed }),
      el('div', { class: 'row' },
        el('button', { type: 'button', textContent: '⟲ Завърти', title: 'Shift+R', onclick: () => turn(-1) }),
        el('button', { type: 'button', textContent: 'Завърти ⟳', title: 'R', onclick: () => turn(1) }),
        el('button', { type: 'button', class: 'is-main', textContent: 'Изтрий', title: 'Delete', onclick: removeSelected })),
      field('Име (id)', valueInput(data.id, '', (id) => set(id ? usable({ ...data, id: id.trim() }) : { id: undefined }))),
      Array.isArray(data.at) && field(data.at.length === 2 ? 'Място (x, z)' : 'Място (x, y, z)', el('span', { class: 'cells' }, ...data.at.map((n, k) => valueInput(n, 0, (value) => {
        if (typeof value === 'number') set({ at: data.at.map((was, j) => (j === k ? value : was)) });
      })))),
      field('Посока (°)', valueInput(Math.round(((data.facing ?? 0) * 180) / Math.PI * 100) / 100, 0, (degrees) => set({ facing: typeof degrees === 'number' && degrees ? turned((degrees * Math.PI) / 180, 0) : undefined }))),
      tile && field('Затваря плочката си', el('input', { type: 'checkbox', checked: Boolean(data.blocks?.length), onchange: (e) => set({ blocks: e.target.checked ? [tile] : undefined }) })),
      regions.length > 0 && field('Район', el('select', { onchange: (e) => set({ region: e.target.value || undefined, tile: e.target.value ? data.tile ?? tile ?? undefined : data.tile }) },
        el('option', { value: '', textContent: '—' }), ...regions.map((name) => el('option', { value: name, textContent: name, selected: data.region === name })))),
      ...params.map(([name, fallback]) => field(name, valueInput(data[name], fallback, (value) => set({ [name]: value })))),
      el('details', { open: Boolean(data.talk) }, el('summary', { textContent: 'Говори (talk)' }), ...group('talk', ['title', 'text'], ['Заглавие', 'Текст'])),
      el('details', { open: Boolean(data.take) }, el('summary', { textContent: 'Взима се (take)' }),
        ...group('take', ['items', 'title', 'text', 'button', 'done', 'empty'], ['Предмети', 'Заглавие', 'Текст', 'Бутон', 'Взето', 'Празно'])),
      field('Води към (travel)', valueInput(data.travel, '', (place) => set({ travel: place || undefined }))),
      field('Други стойности', other, true),
    );
  }
  function renderSpawns() {
    const { parts } = model;
    const rows = [['start', parts.start], ...Object.entries(parts.arrivals)].map(([name, spawn]) => el('div', { class: 'row' },
      el('label', { class: 'check' }, el('input', { type: 'radio', name: 'spawn', checked: state.spawn === name, onchange: () => { state.spawn = name; renderMarks(); } }),
        el('span', { textContent: `${name === 'start' ? 'начало' : name}: ${spawn.tile?.join(', ') ?? '—'} · ${Math.round(((spawn.facing ?? 0) * 180) / Math.PI)}°` })),
      el('button', { type: 'button', class: 'is-plain', textContent: '⟳', title: 'Завърти', onclick: () => {
        if (name === 'start') model.setStart({ facing: turned(spawn.facing, 1) }); else model.setArrival(name, { facing: turned(spawn.facing, 1) });
        if (model.commit()) changed();
      } }),
      name !== 'start' && el('button', { type: 'button', class: 'is-plain', textContent: '✕', title: 'Махни', onclick: () => {
        model.setArrival(name, null);
        if (state.spawn === name) state.spawn = 'start';
        if (model.commit()) changed();
      } })));
    const name = el('input', { type: 'text', placeholder: 'име на място (откъде идва)' });
    $('spawns').replaceChildren(...rows, el('div', { class: 'row' }, name, el('button', { type: 'button', textContent: 'Нова точка', onclick: () => {
      const place = name.value.trim();
      if (!place || place === 'start' || parts.arrivals[place]) return;
      model.setArrival(place, { tile: [...(parts.start.tile ?? [0, 0])], facing: 0 });
      state.spawn = place;
      if (model.commit()) changed();
    } })));
  }
  function renderStatus() {
    $('status').textContent = status || `${described.title ?? gameName} · ${mapName} · ${model.changed ? TEXT.changed : TEXT.saved}`;
    $('undo').disabled = !model.canUndo;
    $('redo').disabled = !model.canRedo;
    $('save').disabled = !model.changed;
  }
  const say = (words) => { $('hint').textContent = words; };
  function tell(words, bad = false) {
    status = words;
    $('status').classList.toggle('is-bad', bad);
    renderStatus();
  }

  // ---------- after a change ----------
  /** The model changed (not its blocks, not its things): the sheets and the marks follow. */
  function changed() {
    status = '';
    if (state.selected !== null && indexOf(state.selected) < 0) state.selected = null;
    if (!layerExists()) state.level = model.levels[0];
    renderLevels(); renderThings(); renderThingForm(); renderSpawns(); renderStatus(); renderMarks(); staticMarks();
  }
  const layerExists = () => model.levels.includes(state.level);
  function thingsChanged() { view.rebuildThings(model.map()); changed(); }
  function rebuild() { view.build(model.map(), show()); changed(); }
  function select(uid, lookAtIt) {
    state.selected = uid;
    for (const mark of $('marks').children) mark.classList.toggle('is-on', mark.dataset.uid === String(uid));
    renderThings(); renderThingForm(); staticMarks();
    const at = lookAtIt && uid !== null && anchorOf(model.parts.things[indexOf(uid)].data);
    if (at) { const [sx, sy] = view.cam.project(at); if (sx < 0 || sy < 0 || sx > view.cam.width || sy > view.cam.height) view.cam.look = [at[0], 0, at[2]]; }
  }
  function setTool(tool) {
    state.tool = tool;
    pointerMarks([]);
    renderTools(); renderLevels(); renderPalette(); renderMarks(); staticMarks();
  }
  function turn(quarters) {
    const index = indexOf(state.selected);
    if (index < 0) return;
    model.turnThing(index, quarters);
    if (model.commit()) thingsChanged();
  }
  function removeSelected() {
    const index = indexOf(state.selected);
    if (index < 0) return;
    model.removeThing(index);
    state.selected = null;
    if (model.commit()) thingsChanged();
  }
  function stepBack(forward) {
    const blocksBefore = JSON.stringify([model.parts.layers, model.parts.origin]);
    if (!(forward ? model.redo() : model.undo())) return;
    if (JSON.stringify([model.parts.layers, model.parts.origin]) === blocksBefore) thingsChanged(); else rebuild();
  }

  // ---------- the pointer on the map ----------
  const point = (e) => { const box = canvas.getBoundingClientRect(); return [e.clientX - box.left, e.clientY - box.top]; };
  const cellUnder = (e) => view.cam.cellAt(...point(e), planeY());
  const keys = { space: false };
  let drag = null;
  function paintCell([x, z]) {
    const erase = state.tool === 'eraser';
    const done = state.target === 'blocks' ? model.paint(state.level, x, z, erase ? model.empty : state.char) : model.paintRegion(x, z, erase ? '.' : state.regionChar);
    if (done) drag.cells.set(`${x},${z}`, [x, z]);
  }
  function strokeTo(cell) {
    const [x0, z0] = drag.last ?? cell;
    const steps = Math.max(Math.abs(cell[0] - x0), Math.abs(cell[1] - z0), 1);
    for (let k = 0; k <= steps; k++) paintCell([Math.round(x0 + ((cell[0] - x0) * k) / steps), Math.round(z0 + ((cell[1] - z0) * k) / steps)]);
    drag.last = cell;
    pointerMarks([...drag.cells.values()], true);
  }
  const rectCells = (a, b) => { const cells = []; for (let z = Math.min(a[1], b[1]); z <= Math.max(a[1], b[1]); z++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) cells.push([x, z]); return cells; };
  function describe(cell) {
    const [x, z] = cell;
    if (!model.inside(x, z)) return `${x}, ${z} · ${TEXT.outside}`;
    const ch = model.charAt(state.level, x, z);
    const what = layered ? (legend[ch]?.type ?? TEXT.empty) : (legend[ch]?.thing ?? legend[ch]?.grow ?? legend[ch]?.ground ?? base.ground);
    const region = model.parts.regions ? ` · ${model.parts.regions.names[model.regionAt(x, z)] ?? TEXT.home}` : '';
    return `${x}, ${z}${layered ? ` · ниво ${state.level}` : ''} · ${what}${region}`;
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    const pan = e.button !== 0 || keys.space || state.tool === 'select';
    drag = { pan, x, y, moved: 0, from: cellUnder(e), last: null, cells: new Map() };
    canvas.classList.toggle('is-dragging', pan);
    if (!pan && (state.tool === 'brush' || state.tool === 'eraser')) strokeTo(drag.from);
  });
  canvas.addEventListener('pointermove', (e) => {
    const cell = cellUnder(e);
    say(describe(cell));
    if (!drag) { if (state.tool !== 'select') pointerMarks([cell]); return; }
    const [x, y] = point(e);
    drag.moved += Math.abs(x - drag.x) + Math.abs(y - drag.y);
    if (drag.pan) view.cam.pan(x - drag.x, y - drag.y);
    else if (state.tool === 'brush' || state.tool === 'eraser') strokeTo(cell);
    else if (state.tool === 'rect') pointerMarks(rectCells(drag.from, cell), true);
    drag.x = x; drag.y = y;
  });
  function release(e) {
    if (!drag) return;
    const { pan, moved, from } = drag;
    const cell = cellUnder(e);
    drag = null;
    canvas.classList.remove('is-dragging');
    pointerMarks([]);
    if (pan) { if (moved < 4 && e.button === 0 && state.tool === 'select') select(null, false); return; }
    if (state.tool === 'rect') { if (state.target === 'blocks') model.fill(state.level, from, cell, state.char); else model.fillRegion(from, cell, state.regionChar); }
    if (state.tool === 'place' && state.kind) {
      const y = view.tileY(cell[0], cell[1]);
      const index = model.addThing({ kind: state.kind, at: y ? [cell[0], y, cell[1]] : [cell[0], cell[1]] });
      state.selected = model.parts.things[index].uid;
      if (model.commit()) thingsChanged();
      return;
    }
    if (state.tool === 'spawn') { if (state.spawn === 'start') model.setStart({ tile: cell }); else model.setArrival(state.spawn, { tile: cell }); }
    if (!model.commit()) return;
    if (painting() && state.target === 'blocks') rebuild(); else changed();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { if (drag && !drag.pan) model.revert(); drag = null; pointerMarks([]); canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('pointerleave', () => { if (!drag) pointerMarks([]); });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.cam.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, ...point(e)); }, { passive: false });

  // ---------- the board across the top ----------
  function fit() {
    const { origin } = model.parts;
    view.cam.frame(origin.x, origin.z, origin.x + model.width - 1, origin.z + model.height - 1);
  }
  function setMode(mode) {
    view.cam.mode = mode;
    $('view-mode').textContent = mode === 'iso' ? TEXT.viewIso : TEXT.viewTop;
  }
  async function save() {
    let out = null;
    try { out = savedFiles(source, model.saved, model.parts); } catch (error) { tell(TEXT.saveFailed(error.message), true); return false; }
    if (!out.files.length) { tell(out.notes.length ? TEXT.elsewhere(out.notes) : TEXT.nothing, out.notes.length > 0); return !out.notes.length; }
    tell(TEXT.saving);
    try {
      for (const file of out.files) {
        const answer = await fetch('/editor/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: gameName, file: file.file, text: file.text }) });
        if (!answer.ok) throw new Error((await answer.json().catch(() => ({}))).error ?? `${answer.status}`);
      }
    } catch (error) { tell(TEXT.saveFailed(error.message), true); return false; }
    source = out.source;
    model.markSaved();
    tell(out.notes.length ? TEXT.elsewhere(out.notes) : TEXT.savedNow(out.files.map((file) => file.file.split('/').pop())), out.notes.length > 0);
    return true;
  }
  function download() {
    let out = null;
    try { out = savedFiles(source, model.saved, model.parts); } catch (error) { tell(TEXT.saveFailed(error.message), true); return; }
    const files = out.files.length ? out.files : [{ file: source.file, text: source.text }];
    for (const file of files) {
      const link = el('a', { href: URL.createObjectURL(new Blob([file.text], { type: 'text/javascript' })), download: file.file.split('/').pop() });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
  }
  async function play() {
    if (model.changed && !(await save())) return;
    window.open(root + (entry.play ?? ''), '_blank');
  }
  $('undo').addEventListener('click', () => stepBack(false));
  $('redo').addEventListener('click', () => stepBack(true));
  $('view-mode').addEventListener('click', () => setMode(view.cam.mode === 'iso' ? 'top' : 'iso'));
  $('fit').addEventListener('click', fit);
  $('save').addEventListener('click', save);
  $('download').addEventListener('click', download);
  $('play').addEventListener('click', play);
  $('map-pick').replaceChildren(...Object.keys(described.maps).map((name) => el('option', { value: name, textContent: name, selected: name === mapName })));
  $('map-pick').addEventListener('change', (e) => { location.search = `?game=${gameName}&map=${e.target.value}`; });
  for (const radio of document.querySelectorAll('input[name="target"]')) {
    radio.disabled = radio.value === 'regions' && !model.parts.regions;
    radio.addEventListener('change', () => { state.target = radio.value; renderLevels(); renderPalette(); staticMarks(); });
  }
  $('up-to').addEventListener('change', (e) => { state.upTo = e.target.checked; rebuild(); });
  $('fade').addEventListener('change', (e) => { state.fade = e.target.checked; if (state.upTo) rebuild(); });
  $('level-above').addEventListener('click', () => { const level = Math.max(...model.levels) + 1; if (model.addLevel(level) && model.commit()) { state.level = level; changed(); } });
  $('level-below').addEventListener('click', () => { const level = Math.min(...model.levels) - 1; if (model.addLevel(level) && model.commit()) { state.level = level; changed(); } });
  for (const button of $('grow').children) button.addEventListener('click', () => { model.grow({ [button.dataset.side]: 2 }); if (model.commit()) rebuild(); });
  $('show-tiles').addEventListener('change', (e) => { state.showTiles = e.target.checked; staticMarks(); });
  $('lamp').addEventListener('change', (e) => view.setLamp(e.target.checked));
  $('textured').addEventListener('change', (e) => view.setTextured(e.target.checked));

  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyS') { e.preventDefault(); save(); return; }
    if (typing) return;
    if (mod && e.code === 'KeyZ') { e.preventDefault(); stepBack(e.shiftKey); }
    else if (mod && e.code === 'KeyY') { e.preventDefault(); stepBack(true); }
    else if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
    else if (e.code === 'Delete' || e.code === 'Backspace') removeSelected();
    else if (e.code === 'KeyR') turn(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyV') setMode(view.cam.mode === 'iso' ? 'top' : 'iso');
    else if (e.code === 'KeyF') fit();
    else if (e.code === 'Escape') { if (state.tool === 'select') select(null, false); else setTool('select'); }
    else if (/^Digit[1-6]$/.test(e.code) && !mod) setTool(TEXT.tools[Number(e.code.slice(5)) - 1].id);
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') keys.space = false; });
  window.addEventListener('beforeunload', (e) => { if (model.changed) { e.preventDefault(); e.returnValue = TEXT.leave; } });

  // ---------- the first picture, and every frame ----------
  const stage = $('stage');
  const resize = () => { view.resize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)); marksStamp = ''; };
  resize();
  new ResizeObserver(resize).observe(stage);
  view.build(model.map(), show());
  setMode('iso');
  const box = base.view;
  if (box) view.cam.frame(box.minX - 2, box.minZ - 2, box.maxX + 2, box.maxZ + 2); else fit();
  renderTools(); renderPalette(); renderKinds(); changed();
  document.title = `${mapName} · ${described.title ?? gameName} · Редактор на карти`;
  window.blocksEditor = { model, view, state, save };      // for a look from the console

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    view.frame(now / 1000, dt);
    placeMarks();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start().catch((error) => { console.error(error); trouble(String(error?.message ?? error)); });
