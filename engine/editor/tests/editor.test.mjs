// The map editor without a browser: the map as data (model.js), the map file as text (source.js), the view's
// sums (camera.js), and the view itself built on the stubs of three.js and of the page that D&K's tests use.
// Run: node packages/blocks-engine/editor/tests/editor.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import '../../../../games/dungeons-and-knowledge/tests/stubs/hooks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const games = path.join(here, '../../../../games');
const DK = path.join(games, 'dungeons-and-knowledge/app');
const { createModel, partsOf, mapOf, seedFor, turned, anchorOf, usable } = await import('../model.js');
const { patchSource, patchRolls, savedFiles, rollsElsewhere, moduleSource, headerOf, beside, same, js, readObject, readArray, findConst } = await import('../source.js');
const { createEditorCamera } = await import('../camera.js');
const { createView, loadEngine } = await import('../view.js');
const { loadMap, key } = await import(path.join(DK, 'engine/map.js'));
const { DUNGEON } = await import(path.join(DK, 'game/maps/dungeon.js'));
const { SURFACE } = await import(path.join(DK, 'game/maps/surface.js'));
const { CAVE } = await import(path.join(games, 'secret-cave/app/game/maps/cave.js'));

const { mulberry32 } = await import(path.join(DK, 'engine/random.js'));
const { KINDS: BLOCKS } = await import(path.join(DK, 'game/blocks.js'));
const DICE = { random: mulberry32, twins: BLOCKS.twins };
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'blocks-editor-'));
let loads = 0;
/** Reads a map file's text as a module: its imports are pointed at the real files, so only the map itself is the new text. */
async function load(text, file, name, swap = {}) {
  const dir = path.dirname(file);
  const absolute = text.replace(/from '(\.[^']+)'/g, (_, spec) => `from '${swap[spec] ?? pathToFileURL(path.resolve(dir, spec)).href}'`);
  const out = path.join(scratch, `map-${loads++}.mjs`);
  fs.writeFileSync(out, absolute);
  return (await import(pathToFileURL(out).href))[name];
}
const blocksOf = (map) => loadMap(map).blocks.map((b) => [b.x, b.level, b.z, b.type, b.top, b.shade, b.twin, b.region].join()).sort();
function sameMap(a, b, what) {
  assert.deepEqual(blocksOf(a), blocksOf(b), `${what}: the same blocks`);
  assert.deepEqual(a.things, b.things, `${what}: the same things, in the same order`);
  assert.deepEqual([a.start, a.arrivals ?? {}, a.origin, a.regions, a.fog, a.view, a.camera, a.seeds, a.legend], [b.start, b.arrivals ?? {}, b.origin, b.regions, b.fog, b.view, b.camera, b.seeds, b.legend], `${what}: the rest`);
}

// ---------- the text of a map file is read as it is written ----------
{
  const text = "const A = { a: 1, 'b-c': [1, { x: '}' }], /* c: 0 */ d: Math.PI / 2, // e\n  f() { return 1; }, ...more, g };";
  const { props } = readObject(text, findConst(text, 'A'));
  assert.deepEqual(props.map((p) => p.key), ['a', 'b-c', 'd', null, null, 'g']);
  assert.equal(text.slice(props[2].valueStart, props[2].valueEnd), 'Math.PI / 2');
  assert.deepEqual(readArray('[1, [2, 3], "a,b", // x\n {y: 1},]', 0).items.length, 4);
  assert.equal(js({ kind: 'torch', at: [1, -0, 2.5], facing: -Math.PI / 2, 'a-b': "it's", on: true, none: undefined }), "{ kind: 'torch', at: [1, 0, 2.5], facing: -Math.PI / 2, 'a-b': 'it\\'s', on: true }");
  assert.equal(beside('game/maps/dungeon.js', './dungeon-rolls.js'), 'game/maps/dungeon-rolls.js');
  assert.ok(same({ a: [1, { b: 2 }], c: undefined }, { a: [1, { b: 2 }] }) && !same({ a: 1 }, { a: 2 }));
  console.log('the text of a map: objects, lists, values');
}

// ---------- D&K's dungeon: loaded and saved without edits, it is the same file ----------
const dungeonFile = path.join(DK, 'game/maps/dungeon.js');
const dungeonText = fs.readFileSync(dungeonFile, 'utf8');
const rollsAt = rollsElsewhere(dungeonText, 'DUNGEON');
assert.deepEqual(rollsAt, { name: 'DUNGEON_ROLLS', file: './dungeon-rolls.js' });
const rollsFile = path.join(DK, 'game/maps', rollsAt.file);
const dungeonSource = { file: 'game/maps/dungeon.js', text: dungeonText, name: 'DUNGEON', rolls: { file: 'game/maps/dungeon-rolls.js', name: rollsAt.name, text: fs.readFileSync(rollsFile, 'utf8') } };
{
  const model = createModel(DUNGEON, DICE);
  sameMap(model.map(), DUNGEON, 'the map the editor holds');
  const out = savedFiles(dungeonSource, model.saved, model.parts);
  assert.deepEqual(out.files, [], 'nothing changed: nothing is written');
  assert.equal(patchSource(dungeonText, 'DUNGEON', model.saved, model.parts).text, dungeonText, 'the text stays as it is, to the letter');
  sameMap(await load(dungeonText, dungeonFile, 'DUNGEON'), DUNGEON, 'the file read again');
  // and written anew from its data alone (no text to keep): still the same map
  const anew = moduleSource({ ...DUNGEON }, { name: 'DUNGEON', header: headerOf(dungeonText) });
  assert.ok(anew.startsWith('// The dungeon, as a matrix.'), 'the header comment is kept');
  sameMap(await load(anew, dungeonFile, 'DUNGEON'), DUNGEON, 'the map written anew');
  console.log(`round trip: the dungeon (${DUNGEON.things.length} things, ${blocksOf(DUNGEON).length} blocks) saved without edits is the same file and the same map`);
}

// ---------- blocks: painted, erased, filled; the rolls follow; undo and redo ----------
{
  const model = createModel(DUNGEON, DICE);
  const floor = -0.5;
  assert.equal(model.charAt(floor, 8, 6), 'b');
  assert.ok(model.paint(floor, 8, 6, 'm') && !model.paint(floor, 8, 6, 'm'), 'painting the same again changes nothing');
  assert.ok(model.erase(floor, 9, 6));
  assert.ok(model.fill(0.5, [3, 3], [4, 5], 'B'));
  assert.ok(!model.paint(floor, 500, 500, 'b'), 'outside the map nothing is painted');
  assert.ok(model.commit() && !model.commit());
  const level = loadMap(model.map());
  const at = (x, y, z) => level.blocks.find((b) => b.x === x && b.level === y && b.z === z);
  assert.equal(at(8, floor, 6).type, 'mossy');
  assert.equal(at(9, floor, 6), undefined, 'the erased block is gone');
  assert.ok(!level.ground.has(key(9, 6)));
  for (let z = 3; z <= 5; z++) for (const x of [3, 4]) { assert.equal(at(x, 0.5, z).type, 'bricks'); assert.ok(level.blocked.has(key(x, z)), 'a block on the floor shuts the tile'); }
  // the rolls: a changed block has none (the map's own dice give it its brightness), every other keeps its own
  const roll = (parts, y, x, z) => parts.rolls[y][z - parts.origin.z].split(' ')[x - parts.origin.x];
  assert.notEqual(roll(model.saved, floor, 8, 6), '-');
  assert.notEqual(roll(model.parts, floor, 8, 6), roll(model.saved, floor, 8, 6), 'a painted block has a roll of its own');
  assert.equal(roll(model.parts, floor, 9, 6), '-', 'an erased one has none');
  assert.equal(roll(model.parts, floor, 7, 6), roll(model.saved, floor, 7, 6));
  for (const b of level.blocks) assert.notEqual(roll(model.parts, b.level, b.x, b.z), '-', 'every block has its roll: the dice are not asked again');
  const was = loadMap(DUNGEON);
  const twin = mulberry32(DUNGEON.seeds.look ?? 1);
  for (const b of was.blocks) b.twin ??= BLOCKS.twins.has(b.type) && twin() < 0.5;        // as the world rolls it
  const shades = (lvl) => new Map(lvl.blocks.map((b) => [`${b.x},${b.level},${b.z}`, `${b.shade} ${b.twin}`]));
  const before = shades(was), after = shades(level);
  let kept = 0;
  for (const [id, shade] of after) if (before.has(id) && !['8,-0.5,6'].includes(id)) { assert.equal(shade, before.get(id), `the block ${id} is as bright as before`); kept++; }
  assert.ok(kept > 1500);

  // saved: the two files change, and read again they give the edited map
  const out = savedFiles(dungeonSource, model.saved, model.parts);
  assert.deepEqual(out.files.map((f) => f.file), ['game/maps/dungeon-rolls.js', 'game/maps/dungeon.js']);
  const changedLines = (a, b) => a.split('\n').filter((line, k) => line !== b.split('\n')[k]).length;
  assert.equal(changedLines(dungeonText, out.files[1].text), 4, 'only the rows that were painted are written anew');
  const rollsOut = path.join(scratch, 'rolls-1.mjs');
  fs.writeFileSync(rollsOut, out.files[0].text);
  sameMap(await load(out.files[1].text, dungeonFile, 'DUNGEON', { './dungeon-rolls.js': pathToFileURL(rollsOut).href }), model.map(), 'the painted map, saved and read again');

  assert.ok(model.undo() && !model.canUndo && model.canRedo);
  sameMap(model.map(), DUNGEON, 'undone');
  assert.ok(!model.changed);
  assert.ok(model.redo() && model.changed);
  assert.equal(model.charAt(floor, 8, 6), 'm');
  model.paint(floor, 7, 6, 'c');
  model.revert();
  assert.equal(model.charAt(floor, 7, 6), 'b', 'a stroke that was dropped leaves nothing');
  console.log('blocks: paint, erase, fill; rolls; save and read again; undo, redo');
}

// ---------- regions, a new level, a bigger map ----------
{
  const model = createModel(DUNGEON, DICE);
  assert.equal(model.regionAt(8, 6), 'r');
  assert.ok(model.paintRegion(8, 6, 'w') && model.fillRegion([9, 6], [10, 7], 'n'));
  assert.ok(model.addLevel(4.5) && !model.addLevel(4.5));
  assert.deepEqual(model.levels.slice(0, 2), [4.5, 3.5]);
  model.paint(4.5, 8, 6, 'S');
  model.grow({ left: 2, top: 1, right: 1, bottom: 3 });
  assert.deepEqual([model.parts.origin, model.width, model.height], [{ x: -29, z: -26 }, 42, 40]);
  assert.equal(model.charAt(4.5, 8, 6), 'S', 'a tile keeps its place when the map grows');
  model.commit();
  const level = loadMap(model.map());
  assert.equal(level.regionAt.get(key(8, 6)), 'west');
  assert.equal(level.regionAt.get(key(10, 7)), 'north');
  assert.ok(level.blocks.some((b) => b.x === 8 && b.level === 4.5 && b.z === 6 && b.type === 'stone'));
  assert.equal(blocksOf(model.map()).length, blocksOf(DUNGEON).length + 1);
  const out = savedFiles(dungeonSource, model.saved, model.parts);
  const rollsOut = path.join(scratch, 'rolls-2.mjs');
  fs.writeFileSync(rollsOut, out.files[0].text);
  const text = out.files[1].text;
  assert.ok(text.includes('origin: { x: -29, z: -26 }') && text.includes('{ level: 4.5,\n      rows: [') && text.includes('// the tops of the tallest walls'), 'the new level is written like the others; the comments stay');
  sameMap(await load(text, dungeonFile, 'DUNGEON', { './dungeon-rolls.js': pathToFileURL(rollsOut).href }), model.map(), 'regions, a level and a bigger map, saved and read again');
  console.log('regions painted, a level added, the map grown: saved and read again');
}

// ---------- things: put, moved, turned, changed, taken out ----------
{
  const model = createModel(DUNGEON, DICE);
  const count = DUNGEON.things.length;
  const index = model.addThing({ kind: 'barrel', at: [9, 4] });
  assert.equal(index, count);
  assert.equal(model.parts.things[index].data.seed, seedFor('barrel', [9, 0, 4], count), 'a thing put in the editor has its own dice');
  model.commit();
  model.moveThing(index, 1, -2);
  assert.deepEqual(model.parts.things[index].data.at, [10, 2]);
  const goblin = DUNGEON.things.findIndex((thing) => thing.id === 'goblin1');
  model.moveThing(goblin, 2, 1);
  const moved = model.parts.things[goblin].data;
  assert.deepEqual([moved.at, moved.tiles, moved.front, moved.focus, moved.hit, moved.tile, moved.blocks], [[7, -17], [[7, -17]], [7, -16], [7, 0.6, -17], [0.7, 1.0, 0.7, 7, 0.5, -17], [7, -17], [[7, -17]]], 'all that says where it is moves with it');
  model.turnThing(goblin);
  assert.equal(model.parts.things[goblin].data.facing, Math.PI);
  assert.deepEqual([turned(0, 1), turned(Math.PI, 1), turned(-Math.PI / 2, 1), turned(0, -1), turned(undefined, 2)], [Math.PI / 2, -Math.PI / 2, 0, -Math.PI / 2, Math.PI]);
  const torch = DUNGEON.things.findIndex((thing) => thing.id === 'torch');
  model.setThing(torch, { ...model.parts.things[torch].data, take: { ...model.parts.things[torch].data.take, title: 'Нова факла' } });
  const banner = DUNGEON.things.findIndex((thing) => thing.kind === 'banner');
  model.removeThing(banner);
  model.setStart({ tile: [7, 6] });
  model.setArrival('from-attic', { tile: [3, 3] });
  model.commit();
  assert.equal(model.parts.things.length, count);
  assert.deepEqual(anchorOf({ at: [1, 2] }), [1, 0, 2]);
  assert.deepEqual(usable({ kind: 'x', id: 'a', at: [2, 0.5, 3] }).front, [2, 4]);

  const out = savedFiles(dungeonSource, model.saved, model.parts);
  assert.deepEqual(out.files.map((f) => f.file), ['game/maps/dungeon.js'], 'the rolls are untouched');
  const text = out.files[0].text;
  assert.ok(text.includes("title: 'Нова факла', text: TEXT.torchText"), 'only the changed value is written; the others stay as the file has them');
  assert.ok(text.includes('facing: Math.PI, pose: \'warm\'') && text.includes("{ kind: 'barrel', at: [10, 2], seed: "));
  assert.ok(!text.includes("kind: 'banner'") && text.includes('// by the pillar') && text.includes("arrivals: { 'from-surface': { tile: [-9, 5], facing: 0 }, 'from-attic': { facing: 0, tile: [3, 3] } }"));
  assert.equal(text.split('\n').length, dungeonText.split('\n').length, 'one line out, one line in');
  const read = await load(text, dungeonFile, 'DUNGEON');
  sameMap(read, model.map(), 'things changed, saved and read again');
  assert.equal(read.things.at(-1).kind, 'barrel');
  // the saved file is the new ground: saved again without edits, it stays; one more edit touches one line
  const next = createModel(read);
  assert.equal(patchSource(text, 'DUNGEON', next.saved, next.parts).text, text);

  for (let k = 0; k < 2; k++) model.undo();
  sameMap(model.map(), DUNGEON, 'undone');
  model.redo(); model.redo();
  assert.deepEqual(model.map().things, read.things, 'redone');
  console.log('things: put, moved, turned, changed, taken out; start and arrivals; saved and read again; undo, redo');
}

// ---------- the other maps: the cave of the second game, the land above (one grid, kept in a const) ----------
{
  const caveFile = path.join(games, 'secret-cave/app/game/maps/cave.js');
  const caveText = fs.readFileSync(caveFile, 'utf8');
  const model = createModel(CAVE);
  assert.equal(patchSource(caveText, 'CAVE', model.saved, model.parts).text, caveText);
  model.paint(-0.5, 6, 13, 'm');
  model.removeThing(1);
  model.addThing({ kind: 'mushrooms', at: [5, 12] });
  model.moveThing(model.parts.things.findIndex((thing) => thing.data.id === 'guard'), 1, 0);
  const out = patchSource(caveText, 'CAVE', model.saved, model.parts);
  assert.deepEqual(out.notes, []);
  sameMap(await load(out.text, caveFile, 'CAVE'), model.map(), 'the cave, edited, saved and read again');

  const surfaceFile = path.join(DK, 'game/maps/surface.js');
  const surfaceText = fs.readFileSync(surfaceFile, 'utf8');
  const land = createModel(SURFACE);
  assert.equal(land.parts.shape, 'rows');
  assert.equal(patchSource(surfaceText, 'SURFACE', land.saved, land.parts).text, surfaceText);
  const [x, z] = SURFACE.start.tile;
  land.paint(-0.5, x + 3, z + 3, '~');
  land.moveThing(0, 0, 0);
  const saved = patchSource(surfaceText, 'SURFACE', land.saved, land.parts);
  assert.ok(saved.text.includes('rows: ROWS,'), 'the grid stays in its const');
  const read = await load(saved.text, surfaceFile, 'SURFACE');
  assert.equal(read.rows[z + 3][x + 3], '~');
  assert.deepEqual(read.rows, land.map().rows);
  console.log('the cave of the second game and the land above: edited, saved and read again');
}

// ---------- a map with no file yet ----------
{
  const map = { name: 'tiny', origin: { x: -1, z: 0 }, legend: { b: { type: 'bricks', walk: true }, '~': { type: 'dirt', top: 0.68, walk: true }, B: { type: 'bricks' } },
    layers: [{ level: 0.5, rows: ['B..', '...'] }, { level: -0.5, rows: ['bbb', 'b~b'] }], regions: { names: { w: 'west' }, rows: ['w..', 'w..'] },
    rolls: { '-0.5': ['0.95 0.97b -', '- - 1'] }, seeds: { things: 5 }, fog: { room: { light: 1, explored: true }, west: { light: 0.4 } },
    view: { minX: -1, maxX: 1, minZ: 0, maxZ: 1 }, camera: { follow: true }, start: { tile: [0, 1], facing: Math.PI },
    things: [{ kind: 'torch', at: [0, 1.8, -0.36], lean: [0, 1] }, { kind: 'barrel', at: [1, 0], facing: -Math.PI / 2, blocks: [[1, 0]], talk: { title: 'Бъчва', text: 'Пълна е.\nС "мед".' } }] };
  const text = moduleSource(map, { name: 'TINY', header: '// A tiny map.\n' });
  const read = await load(text, path.join(scratch, 'tiny.js'), 'TINY');
  assert.deepEqual(read, map, 'written and read again: the same map');
  const model = createModel(read);
  model.paint(0.5, 0, 0, 'B');
  model.removeThing(0);
  model.removeThing(0);
  model.addThing({ kind: 'crates', at: [0, 0] }, { seeded: false });
  model.setArrival('door', { tile: [1, 1] });
  const out = patchSource(text, 'TINY', model.saved, model.parts);
  assert.deepEqual(await load(out.text, path.join(scratch, 'tiny.js'), 'TINY'), model.map());
  console.log('a map with no file: written in the layout of the others, read again, edited');
}

// ---------- the view's sums ----------
{
  const cam = createEditorCamera();
  Object.assign(cam, { width: 1200, height: 700 });
  for (const mode of ['top', 'iso']) {
    cam.mode = mode;
    cam.frame(-27, -25, 11, 10);
    for (const [x, z] of [[-27, -25], [11, 10]]) { const [sx, sy] = cam.project([x, 0, z]); assert.ok(sx >= 0 && sx <= 1200 && sy >= 0 && sy <= 700, `${mode}: the whole map is on the screen`); }
    for (const [x, y, z] of [[3, 0, 4], [-12, 0.5, 7], [0, 3.5, -20]]) assert.deepEqual(cam.cellAt(...cam.project([x, y, z]), y), [x, z], `${mode}: the tile under a pixel is the tile drawn there`);
    const under = cam.pointAt(400, 300);
    cam.pan(50, -30);
    assert.ok(Math.hypot(...cam.pointAt(450, 270).map((n, k) => n - under[k])) < 1e-9, 'what was under the pointer stays under it');
    cam.zoomAt(1.5, 200, 100);
    assert.ok(Math.hypot(...cam.pointAt(450 + (450 - 200) * 0.5, 270 + (270 - 100) * 0.5).map((n, k) => n - under[k])) < 1e-9);
  }
  cam.mode = 'top';
  const [ax, ay] = cam.project([0, 0, 0]), [bx, by] = cam.project([1, 0, 1]);
  assert.ok(bx > ax && by > ay, 'from above the rows of the map run across the screen, the first one on top');
  console.log('the view: where a tile is on the screen, which tile is under the pointer, sliding and zooming');
}

// ---------- the view: the map built by the engine with the game's own kinds; things made, taken away, made again ----------
{
  const THREE = await import('../../../../games/dungeons-and-knowledge/tests/stubs/three-stub.mjs');
  const engine = await loadEngine((name) => import(path.join(DK, `engine/${name}.js`)));
  const { EDITOR } = await import(path.join(DK, 'game/editor.js'));
  assert.deepEqual(Object.keys(EDITOR.maps), ['dungeon', 'surface']);
  assert.ok(fs.existsSync(path.join(DK, EDITOR.maps.dungeon.file)));
  const game = await EDITOR.config(DUNGEON);
  const model = createModel(DUNGEON, DICE);
  const view = createView({ engine, game, canvas: document.getElementById('scene') });
  view.resize(1200, 700);
  view.build(model.map());
  assert.deepEqual(view.placed.filter((p) => p.error).map((p) => `${p.entry.kind}: ${p.error}`), [], 'every thing of the dungeon is made');
  assert.equal(view.placed.length, DUNGEON.things.length);
  const kinds = view.kinds;
  assert.equal(kinds.find((kind) => kind.name === 'torch').label, 'Факла');
  assert.equal(kinds.find((kind) => kind.name === 'guardian').data, null, 'a kind made by code is listed by its name');
  const describe = () => { const out = []; view.scene.traverse((n) => out.push(`${n.type ?? n.constructor.name} ${n.position.x.toFixed(4)} ${n.position.y.toFixed(4)} ${n.position.z.toFixed(4)} ${n.rotation.y.toFixed(4)} ${n.geometry?.parameters ? Object.values(n.geometry.parameters).join('x') : ''} ${n.material?.map?.image?.hash ?? ''}`)); return out.sort(); };
  const first = describe();
  const blocked = [...view.level.blocked].sort();
  const quads = () => view.world.meshes.reduce((sum, mesh) => sum + mesh.userData.all.quads.length, 0);
  const allQuads = quads();
  view.update(1, 1 / 60);
  // made again in the order of the map with the dice begun anew: the very same scene
  view.rebuildThings(model.map());
  assert.deepEqual(describe(), first, 'the things taken away and made again are the same things');
  assert.deepEqual([...view.level.blocked].sort(), blocked);
  assert.ok(view.things.torches.length > 10 && view.things.torches.length === view.placed.filter((p) => view.things.owned(p.built).torches.length).length);
  // every light that is seen only from its own part is lit: each thing is shown from where it stands
  view.update(2, 1 / 60);
  assert.ok(view.things.torches.every((torch) => torch.base > 0), 'no torch is out');
  assert.equal(view.things.made.chest2.object?.visible ?? true, true);

  // a thing put, moved and taken out
  const before = view.scene.children.length;
  const index = model.addThing({ kind: 'barrel', at: [9, 4], blocks: [[9, 4]] });
  model.commit();
  view.rebuildThings(model.map());
  assert.equal(view.scene.children.length, before + 1);
  assert.ok(view.level.blocked.has(key(9, 4)));
  const barrel = view.placed[index].built.object;
  assert.deepEqual([barrel.position.x, barrel.position.z], [9, 4]);
  const look = (object) => { const out = []; object.traverse((n) => out.push(`${n.rotation.y} ${n.material?.map?.image?.hash ?? ''}`)); return out.join('|'); };
  model.moveThing(index, 1, 0);
  model.turnThing(index);
  model.commit();
  view.rebuildThings(model.map());
  const again = view.placed[index].built.object;
  assert.deepEqual([again.position.x, again.position.z, again.rotation.y], [10, 4, Math.PI / 2]);
  assert.ok(!view.level.blocked.has(key(9, 4)) && view.level.blocked.has(key(10, 4)), 'the tile it shut is free again; the new one is shut');
  assert.equal(view.scene.children.length, before + 1);
  model.removeThing(index);
  model.commit();
  view.rebuildThings(model.map());
  assert.equal(view.scene.children.length, before);
  assert.deepEqual(describe(), first, 'with the new thing gone the scene is as it was');
  // a thing that cannot be made is told, and the others are still there
  model.addThing({ kind: 'no-such-kind', at: [9, 4] });
  view.rebuildThings(model.map());
  assert.match(view.placed.at(-1).error, /no kind "no-such-kind"/);
  assert.equal(view.scene.children.length, before);
  model.revert();

  // blocks: the level painted on, the ones below it dim, the ones above it not drawn
  model.paint(-0.5, 8, 6, 'm');
  model.commit();
  view.build(model.map(), { upTo: -0.5, fade: true });
  assert.ok(quads() < allQuads, 'the levels above are not drawn');
  assert.deepEqual(view.placed.filter((p) => p.error), []);
  view.build(model.map(), {});
  assert.equal(view.scene.children.length, before);
  view.mark('static', [{ cells: [[1, 2], [3, 4]], y: 0, colour: 0xff0000 }, { cells: [], colour: 0 }]);
  view.mark('static', [{ cells: [[1, 2]], y: (x, z) => view.tileY(x, z), colour: 0x00ff00 }]);
  assert.equal(view.overlay.children.length, 1);
  assert.equal(view.overlay.children[0].geometry.index.length, 6);

  // the land above (what the map itself places is made anew with the things), and the second game from the engine's defaults
  const land = createView({ engine, game: await EDITOR.config(SURFACE), canvas: document.getElementById('scene') });
  land.build(createModel(SURFACE).map());
  assert.deepEqual(land.placed.filter((p) => p.error).map((p) => p.error), []);
  const landCount = land.scene.children.length;
  land.rebuildThings(createModel(SURFACE).map());
  assert.equal(land.scene.children.length, landCount);
  const { defaults } = await import(path.join(games, 'secret-cave/app/engine/defaults/game.js'));
  const { KINDS } = await import(path.join(games, 'secret-cave/app/game/kinds.js'));
  const base = defaults();
  const cave = createView({ engine, game: { ...base, kinds: [...base.kinds, KINDS] }, canvas: document.getElementById('scene') });
  cave.build(createModel(CAVE).map());
  assert.deepEqual(cave.placed.filter((p) => p.error).map((p) => `${p.entry.kind}: ${p.error}`), [], 'every thing of the cave is made');
  cave.update(1, 1 / 60);
  assert.ok(cave.kinds.some((kind) => kind.name === 'boulder' && kind.label === 'Голям камък'));
  console.log(`the view: the dungeon (${view.placed.length} things), the land above and the cave built by the engine; things put, moved, turned, taken out and made again; levels shown and dimmed`);

  // ---------- the engine: a thing taken away again (things.remove), a thing with its own dice (seed) ----------
  const { createThings } = engine.things;
  const { mulberry32 } = engine.random;
  const scene = new THREE.Scene();
  const level = { blocked: new Set([key(0, 0)]) };
  const things = createThings({ scene, rand: mulberry32(7), paintedBox: engine.characters.createPainter(), materials: base.materials, paints: base.paints, level,
    world: { regionLight: { room: 1 } }, fog: { canEnter: () => true, seen: new Set() }, state: { here: 'room' } });
  const empty = { objects: scene.children.length, updates: things.updates.length };
  things.defineKinds({
    lamp: { parts: [{ name: 'post', size: [0.1, 1, 0.1], material: 'woodDark' }], light: { colour: 0xffc089, power: 2, flicker: true }, animate: [{ part: 'post', do: 'sway' }] },
    pebbles: { parts: [{ repeat: 3, size: [0.1, 0.1, 0.1], at: ['rand() - 0.5', 0.05, 'rand() - 0.5'], material: 'stone' }] },
  });
  things.defineKind('pair', (thing, stage) => { stage.build({ kind: 'lamp', at: thing.at }); const extra = new THREE.Group(); stage.scene.add(extra); stage.every(() => {}); return { object: extra }; });
  const a = things.add({ kind: 'lamp', id: 'a', at: [1, 1], blocks: [[1, 1], [0, 0]] });
  const b = things.add({ kind: 'lamp', at: [1, 2], blocks: [[1, 1]] });
  const pair = things.add({ kind: 'pair', at: [3, 3] });
  assert.deepEqual([things.torches.length, things.owned(a).objects.length, things.owned(a).updates.length, things.owned(pair).objects.length, things.owned(pair).updates.length], [3, 1, 1, 2, 2]);
  things.update(1, 0.016);
  assert.ok(things.remove(a) && !things.remove(a));
  assert.ok(!things.made.a && things.torches.length === 2 && level.blocked.has(key(1, 1)) && level.blocked.has(key(0, 0)), 'a tile another thing shuts, or the map itself, stays shut');
  things.remove(b);
  assert.ok(!level.blocked.has(key(1, 1)) && level.blocked.has(key(0, 0)));
  things.remove(pair);
  assert.deepEqual([scene.children.length, things.updates.length, things.torches.length], [empty.objects, empty.updates, 0], 'nothing of them is left');
  things.update(2, 0.016);
  const spots = (built) => built.object.children.map((n) => [n.position.x, n.position.z].join()).join(' ');
  const one = spots(things.build({ kind: 'pebbles', at: [0, 0], seed: 42 }));
  const loose = spots(things.build({ kind: 'pebbles', at: [0, 0] }));
  assert.equal(spots(things.build({ kind: 'pebbles', at: [0, 0], seed: 42 })), one, 'a thing with its own dice looks the same wherever it is in the list');
  assert.notEqual(spots(things.build({ kind: 'pebbles', at: [0, 0] })), loose);
  const plain = createThings({ scene: new THREE.Scene(), rand: mulberry32(7), paintedBox: engine.characters.createPainter(), materials: base.materials, paints: base.paints, level: { blocked: new Set() },
    world: { regionLight: { room: 1 } }, fog: { canEnter: () => true, seen: new Set() }, state: { here: 'room' } });
  plain.defineKinds({ pebbles: things.kinds.pebbles });
  assert.equal(spots(plain.build({ kind: 'pebbles', at: [0, 0] })), loose, 'and the map\'s own dice roll on as if it were not there');
  console.log('the engine: things.remove takes a thing away whole; a thing with a seed rolls its own dice');
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log('the map editor: all as it should be');
