// @ts-check
// The things of a map, by kind. A map lists its things ({ kind, at, ... }); a kind says how such a thing is made.
// A kind is either data (a thing of boxes: `parts`, a light, idle animations, what it does when used) or, when
// it truly needs code, a builder: defineKind('guardian', (thing, stage) => ({ object, ... })).
// The data format is described in README.md („Неща като данни“).
// What moves is moved by one update per thing, called every frame in the order the things were made.
// A thing can be taken away again (remove): for an editor, which builds a thing anew when it is moved or changed.
import * as THREE from './three.js';
import { box, glow } from './boxes.js';
import { key } from './map.js';
import { mulberry32 } from './random.js';
import { compile, value } from './expressions.js';
import { painter, matches } from './paints.js';

const SHADOW_TORCHES = 2;

// Where a moving value goes: { part, set: 'rotation.y', to: sum }.
const SETTERS = {
  intensity: (node, v) => { node.intensity = v; },
  opacity: (node, v) => { node.material.opacity = v; },
  scale: (node, v) => { node.scale.set(v, v, v); },
};
for (const what of ['position', 'rotation', 'scale']) for (const axis of ['x', 'y', 'z']) SETTERS[`${what}.${axis}`] = (node, v) => { node[what][axis] = v; };

// Idle animations by name: { part, do: 'breathe', ...its numbers }. `e` holds t (seconds) and phase (the part's own, or the thing's).
const IDLE = {
  breathe: ({ amount = 0.02, speed = 2.1 }) => [['scale.y', (e) => 1 + amount * Math.sin(e.t * speed + e.phase)]],
  bob: ({ amount = 0.09, speed = 2.4, base = 0 }) => [['position.y', (e) => base + Math.sin(e.t * speed + e.phase) * amount]],
  sway: ({ amount = 0.05, speed = 1.6, axis = 'z' }) => [[`rotation.${axis}`, (e) => amount * Math.sin(e.t * speed + e.phase)]],
  spin: ({ speed = 1.5, axis = 'y', phased = false }) => [[`rotation.${axis}`, phased ? (e) => e.t * speed + e.phase : (e) => e.t * speed]],
  // a head that looks about: slowly from side to side, with a small quicker turn and a nod
  lookAbout: ({ turn = 0.35, speed = 0.37, twitch = 0.12, twitchSpeed = 1.3, nod = 0.06, nodSpeed = 0.8 }) => [
    ['rotation.y', (e) => turn * Math.sin(e.t * speed + e.phase) + twitch * Math.sin(e.t * twitchSpeed + e.phase)],
    ['rotation.x', (e) => nod * Math.sin(e.t * nodSpeed + e.phase)],
  ],
  // a flame: it stretches and turns
  flicker: ({ low = 0.9, swing = 0.25, speed = 13, turn = 1.7 }) => [
    ['scale.y', (e) => low + swing * Math.sin(e.t * speed + e.phase)],
    ['rotation.y', (e) => e.t * turn + e.phase],
  ],
};

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {() => number} o.rand the dice of the things: rolled in the order the things are made. A thing with a
 *   `seed` of its own rolls its own dice instead, so it looks the same wherever it stands in the list
 * @param {Function} o.paintedBox from createPainter
 * @param {Record<string, any>} [o.materials] the game's shared materials, by name (a part's `material`)
 * @param {Record<string, any>} [o.paints] the game's paint recipes, by name (see paints.js)
 * @param {any} o.level from loadMap
 * @param {any} o.world
 * @param {any} o.fog
 * @param {any} o.state what has happened so far; `here` (the part of the map the hero is in) is read every frame
 */
export function createThings({ scene, rand, paintedBox, materials = {}, paints = {}, level, world, fog, state }) {
  const updates = [];                 // (t, dt) => {}: called every frame, in this order
  const every = (update) => updates.push(update);
  const kinds = {};                   // name -> data, or a builder (thing, stage) => { object, ... }
  const fields = {};                  // name -> (cells) => {}: a kind the map places many of, built all at once
  const made = {};                    // id -> what the kind gave back
  const owned = new Map();            // what a kind gave back -> what the thing put in: { objects, updates, torches, shut }
  const shutBy = new Map();           // tile -> how many things shut it
  let dice = rand;                    // the dice in hand: the map's, or the own dice of the thing being made
  const roll = () => dice();

  // ---------- lights that flicker (torches) ----------
  // Each has its own phase. The ones nearest the hero cast real shadows. A light with shadows draws the whole
  // scene from six sides every frame, so there are only SHADOW_TORCHES of them: they go to the nearest lit torches
  // and shine in place of those torches' own lights. Their number never changes, because a change in the number
  // of lights would rebuild every material; how many of them cast shadows changes only with the setting
  // (torchShadows), and that rebuilds the materials once. A torch keeps its caster until another is clearly
  // nearer, so shadows do not jump about.
  const flickers = [];   // { light, base, halo, haloBase, phase, strength, at, dist, casting }
  every((t) => {
    for (const f of flickers) {
      const n = 0.86 + 0.09 * Math.sin(t * 11 + f.phase) + 0.05 * Math.sin(t * 23.7 + f.phase * 2);
      f.light.intensity = f.base * n;
      if (f.halo) f.halo.material.opacity = f.haloBase * n;
    }
  });
  const casters = Array.from({ length: SHADOW_TORCHES }, () => {
    const light = new THREE.PointLight(0xffc089, 0, 9, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 9;
    light.shadow.bias = -0.002;
    light.shadow.normalBias = 0.04;
    scene.add(light);
    return { light, torch: null };
  });
  /** How many of the nearest torches cast shadows (0 to 2), and how big their shadow maps are. */
  function torchShadows(count, size) {
    casters.forEach((c, k) => {
      c.light.castShadow = k < count;
      if (c.light.shadow.mapSize.x !== size) {
        c.light.shadow.mapSize.set(size, size);
        c.light.shadow.map?.dispose();                 // made again at the new size
        c.light.shadow.map = null;
      }
    });
  }
  every(() => {
    const here = stage.hero?.position;
    if (!here) return;
    for (const f of flickers) f.dist = f.base > 0 ? f.at.distanceTo(here) - (f.casting ? 1 : 0) : Infinity;
    for (const c of casters) { if (c.torch) c.torch.casting = false; c.torch = null; }
    for (const c of casters) {
      let best = null;
      for (const f of flickers) if (!f.casting && f.dist < 9 && (!best || f.dist < best.dist)) best = f;
      if (best) { best.casting = true; c.torch = best; }
    }
    for (const c of casters) {
      if (!c.torch) { c.light.intensity = 0; continue; }
      c.light.position.copy(c.torch.at);
      c.light.intensity = c.torch.light.intensity;
      c.light.distance = c.torch.light.distance;
      c.torch.light.intensity = 0;
    }
  });

  // How a thing in a veiled part shows: hidden until its tile is seen, then as dim as its part of the map.
  // Gives back a function to call every frame: it says how lit the thing is (0: hidden).
  function inFog(group, { region, tile }) {
    // Its own copies of the materials it is dimmed through: a shared one (the gold of the coins, say) would dim every
    // gold thing on the map with it.
    const tinted = [];
    group.traverse((node) => {
      if (!node.isMesh || !node.material.color || node.material.isMeshBasicMaterial) return;
      node.material = node.material.clone();
      tinted.push(node.material);
    });
    return () => {
      const shown = !tile || fog.canEnter(tile[0], tile[1]);           // behind a shut door, or not yet seen: hidden
      group.visible = shown;
      const light = region ? world.regionLight[region] ?? 1 : 1;
      for (const material of tinted) material.color.setScalar(light);
      return shown ? light : 0;
    };
  }

  // ---------- a thing from data ----------
  function buildData(kind, thing) {
    const env = { ...kind.params, ...thing, rand: roll };
    const n = (sum) => value(sum, env);
    const names = new Map();           // name -> the nodes that carry it
    const phases = new Map();          // node -> its own phase
    const named = (name, node) => { if (!names.has(name)) names.set(name, []); names.get(name).push(node); };

    const root = new THREE.Group();
    const at = kind.at ?? thing.at ?? [thing.x ?? 0, thing.z ?? 0];
    if (at.length === 2) root.position.set(n(at[0]), 0, n(at[1])); else root.position.set(n(at[0]), n(at[1]), n(at[2]));
    root.rotation.y = thing.facing ?? 0;
    if (kind.scale) root.scale.setScalar(kind.scale);

    function one(parent, part, outer) {
      let e = outer;
      if (part.vars) { e = { ...outer }; for (const [name, sum] of Object.entries(part.vars)) e[name] = value(sum, e); }
      const v = (sum) => value(sum, e);
      if (part.on) parent = Array.isArray(part.on) ? names.get(part.on[0])[part.on[1]] : names.get(part.on)[0];
      let node;
      let pivot = false;               // a group: its own parts hang on it
      if (part.glow !== undefined) {
        const [x, y, z] = (part.at ?? [0, 0, 0]).map(v);
        node = glow(parent, part.glow, v(part.size), v(part.opacity), x, y, z);
      } else if (part.size) {
        const [w, h, d] = part.size.map(v);
        const [x, y, z] = (part.at ?? [0, 0, 0]).map(v);
        if (part.material) {
          if (!materials[part.material]) throw new Error(`no material "${part.material}"`);
          node = box(parent, w, h, d, materials[part.material], x, y, z);
        } else node = paintedBox(parent, w, h, d, x, y, z, painter(part.paint, e, paints));
      } else {
        node = new THREE.Group();
        pivot = true;
        if (part.at) node.position.set(v(part.at[0]), v(part.at[1]), v(part.at[2]));
      }
      if (part.turn) node.rotation.set(v(part.turn[0]), v(part.turn[1]), v(part.turn[2]));
      if (part.scale) { if (Array.isArray(part.scale)) node.scale.set(v(part.scale[0]), v(part.scale[1]), v(part.scale[2])); else node.scale.setScalar(v(part.scale)); }
      if (pivot) { many(node, part.parts ?? [], e); parent.add(node); }
      if (part.phase !== undefined) phases.set(node, v(part.phase));
      if (part.name) named(part.name, node);
    }
    // Many of one box, drawn at once (a heap of coins).
    function instanced(parent, part, rows, outer) {
      const size = part.size.map((sum) => value(sum, outer));
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size[0], size[1], size[2]), materials[part.material], rows.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
      rows.forEach((row, k) => {
        const e = looped(part, row, k, outer);
        for (const [name, sum] of Object.entries(part.vars ?? {})) e[name] = value(sum, e);
        const [x, y, z] = part.at ?? [0, 0, 0];
        p.set(value(x, e), value(y, e), value(z, e));
        const [tx, ty, tz] = part.turn ?? [0, 0, 0];
        turn.set(value(tx, e), value(ty, e), value(tz, e));
        mesh.setMatrixAt(k, m.compose(p, q.setFromEuler(turn), s));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      if (part.name) named(part.name, mesh);
    }
    const looped = (part, row, k, outer) => {
      const e = { ...outer, k };
      if (Array.isArray(part.as)) part.as.forEach((name, j) => { e[name] = row[j]; }); else if (part.as) e[part.as] = row;
      return e;
    };
    function many(parent, parts, outer) {
      for (const part of parts) {
        if (part.only && !matches(part.only, outer)) continue;
        if (part.repeat === undefined && part.each === undefined) { one(parent, part, outer); continue; }
        const rows = part.each === undefined ? Array.from({ length: value(part.repeat, outer) }, (_, k) => k)
          : typeof part.each === 'string' ? value(part.each.replace(/^\$/, ''), outer) : part.each;
        if (part.instanced) instanced(parent, part, rows, outer);
        else if (part.many) rows.forEach((row, k) => many(parent, part.many, looped(part, row, k, outer)));      // several parts each time round, with no group of their own
        else rows.forEach((row, k) => one(parent, part, looped(part, row, k, outer)));
      }
    }
    many(root, kind.parts ?? [], env);

    // its light: a point light, a soft halo; `flicker`: one of the torches (above)
    let flicker = null;
    if (kind.light) {
      const L = kind.light;
      const power = n(L.power ?? 1);
      const light = new THREE.PointLight(L.colour, power, n(L.reach ?? 9), 2);
      const [lx, ly, lz] = (L.at ?? [0, 0, 0]).map(n);
      light.position.set(lx, ly, lz);
      root.add(light);
      named('light', light);
      let halo = null;
      if (L.halo) {
        const [hx, hy, hz] = (L.halo.at ?? [0, 0, 0]).map(n);
        halo = glow(root, L.halo.colour, n(L.halo.size), n(L.halo.opacity), hx, hy, hz);
        named('halo', halo);
      }
      if (L.flicker) {
        flicker = { light, base: power, halo, haloBase: halo ? n(L.halo.opacity) : 0, phase: 0, strength: power,
          at: new THREE.Vector3(root.position.x + lx, root.position.y + ly, root.position.z + lz), dist: Infinity, casting: false };      // `at`: where its light is
        flickers.push(flicker);
      }
    }
    scene.add(root);
    const show = thing.region || thing.tile ? inFog(root, thing) : null;
    const phase = kind.phase === undefined ? 0 : n(kind.phase);
    if (flicker) flicker.phase = phase;

    // what moves: sums worked out every frame, each put into one value of a part
    const moving = { ...env, t: 0, dt: 0, lit: 1, phase, n: 0 };
    const steps = [];
    for (const a of kind.animate ?? []) {
      if (a.only && !matches(a.only, env)) continue;
      const always = Boolean(a.always);
      if (a.let) { moving[a.let] = 0; steps.push({ let: a.let, sum: compile(a.to), always }); continue; }
      const all = a.part ? names.get(a.part) : [root];
      if (!all) throw new Error(`${thing.kind}: no part "${a.part}" to animate`);
      const index = a.nth === undefined ? all.map((_, k) => k) : [a.nth];
      const nodes = index.map((k) => all[k]);
      for (const [set, sum] of a.do ? IDLE[a.do](a) : [[a.set, compile(a.to)]]) {
        steps.push({ nodes, index, phases: nodes.map((node) => phases.get(node) ?? phase), put: SETTERS[set], sum, always });
      }
    }

    const seenKey = thing.onlyIn ? key(thing.seen[0], thing.seen[1]) : null;
    let gone = false;                  // taken: all of it
    let met = false;
    if (seenKey || show || steps.length) {
      every((t, dt) => {
        if (seenKey) {                 // its light is seen only from inside that region, once that cell has been seen
          const litNow = !gone && state.here === thing.onlyIn && fog.seen.has(seenKey);
          for (let k = 0; k < root.children.length; k++) if (!root.children[k].isLight) root.children[k].visible = litNow;
          if (flicker) flicker.base = litNow ? flicker.strength : 0;
        }
        let lit = 1;
        if (show) {
          lit = show();
          if (gone) root.visible = false;
          if (lit && !met && thing.id) { met = true; stage.reveal?.(thing.id); }      // seen: from now on it can be tapped
        }
        moving.t = t; moving.dt = dt; moving.lit = lit;
        for (let k = 0; k < steps.length; k++) {
          const step = steps[k];
          if (!lit && !step.always) continue;
          if (step.let) { moving.phase = phase; moving[step.let] = step.sum(moving); continue; }
          for (let j = 0; j < step.nodes.length; j++) {
            moving.n = step.index[j];
            moving.phase = step.phases[j];
            step.put(step.nodes[j], step.sum(moving));
          }
        }
      });
    }
    const hides = kind.take?.hides;
    return {
      object: root, names, flicker,
      /** It is taken: the part the kind names (`take.hides`) goes, or all of it (and its light goes out). */
      take() {
        if (hides) { for (const name of [].concat(hides)) for (const node of names.get(name) ?? []) node.visible = false; return; }
        gone = true;
        root.visible = false;
        if (flicker) flicker.base = 0;
      },
    };
  }

  /** What a builder in code gets. `hero` is set before the first frame; `reveal(id)` makes a hidden thing tappable. */
  const stage = { scene, rand: roll, paintedBox, materials, level, world, fog, state, hero: null, every, inFog, reveal: null,
    build: (thing) => things.build(thing) };

  const things = {
    kinds, fields, made, updates, every, stage,
    /** Every light that flickers: `at` (where it is), `base` (how strong it burns; 0 when out). */
    torches: flickers,
    torchShadows,
    /** A kind: data ({ parts, light, animate, talk, take, ... }) or a builder in code. */
    defineKind(name, kind) { kinds[name] = kind; },
    defineKinds(list) { Object.assign(kinds, list); },
    /** A kind the map places many of (a character with `thing` in its legend), built all at once from its cells. */
    defineField(name, build) { fields[name] = build; },
    /** The data of a kind, or null when it is made by code. */
    data: (name) => (typeof kinds[name] === 'function' ? null : kinds[name] ?? null),
    /** Makes one thing of the map. */
    build(thing) {
      const kind = kinds[thing.kind];
      if (!kind) throw new Error(`no kind "${thing.kind}"`);
      const first = { object: scene.children.length, update: updates.length, torch: flickers.length };
      const mapDice = dice;
      if (thing.seed !== undefined) dice = mulberry32(thing.seed);
      let built;
      try { built = (typeof kind === 'function' ? kind(thing, stage) : buildData(kind, thing)) ?? {}; } finally { dice = mapDice; }
      owned.set(built, { objects: scene.children.slice(first.object), updates: updates.slice(first.update), torches: flickers.slice(first.torch), shut: [] });
      if (thing.id) made[thing.id] = built;
      return built;
    },
    /** Makes a thing and shuts the tiles it stands on (`blocks`) and the gate it keeps (`gate`). */
    add(thing) {
      const built = things.build(thing);
      const { shut } = owned.get(built);
      for (const [i, j] of [...(thing.blocks ?? []), ...(thing.gate ?? [])]) {
        const id = key(i, j);
        if (shutBy.has(id) || !level.blocked.has(id)) { shutBy.set(id, (shutBy.get(id) ?? 0) + 1); shut.push(id); }      // a tile the map itself shuts stays shut
        level.blocked.add(id);
      }
      return built;
    },
    /** What a thing put in when it was made: { objects (in the scene), updates (every frame), torches, shut (tiles) }. */
    owned: (built) => owned.get(built),
    /**
     * Takes away a thing made by build() or add(): what it put in the scene, what it moved every frame, its
     * flickering light, the tiles it shut. What a builder in code changed elsewhere (the state, the world) stays.
     */
    remove(built) {
      const own = owned.get(built);
      if (!own) return false;
      for (const object of own.objects) {
        object.parent?.remove(object);
        object.traverse((node) => node.geometry?.dispose?.());
      }
      for (const update of own.updates) { const k = updates.indexOf(update); if (k >= 0) updates.splice(k, 1); }
      for (const torch of own.torches) { const k = flickers.indexOf(torch); if (k >= 0) flickers.splice(k, 1); }
      for (const c of casters) if (c.torch && own.torches.includes(c.torch)) { c.torch = null; c.light.intensity = 0; }
      for (const id of own.shut) {
        const left = shutBy.get(id) - 1;
        if (left > 0) shutBy.set(id, left); else { shutBy.delete(id); level.blocked.delete(id); }
      }
      for (const id of Object.keys(made)) if (made[id] === built) delete made[id];
      owned.delete(built);
      return true;
    },
    /** What the map itself places: { kind: [[x, z], ...] } from loadMap. */
    addSpots(spots) {
      for (const [kind, cells] of Object.entries(spots)) {
        if (fields[kind]) fields[kind](cells); else cells.forEach(([x, z]) => things.build({ kind, x, z }));
      }
    },
    update(t, dt) { for (let k = 0; k < updates.length; k++) updates[k](t, dt); },
  };
  return things;
}
