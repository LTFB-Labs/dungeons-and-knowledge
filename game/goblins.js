// @ts-check
// Goblins and what they gather round: a camp fire and a hoard of coins; and the throne hall's throne and carpet.
// Things of the map (see maps/dungeon.js):
//   campfire { at: [x, z], tile, region }                      stones, logs, flames, a warm flickering light
//   goblin   { at: [x, z], facing, pose: 'warm'|'poke'|'count', region, tile }   a small green figure, sitting
//   hoard    { at: [x, z], region, tile }                       a heap of gold coins
//   throne   { at: [x, y, z], facing, region, tile }            a king's chair of dark wood and gold
//   carpet   { from: [x, z], to: [x, z], width, region, tile }  a red carpet along x
//   shield   { at: [x, y, z], facing, colours, region, tile }   a shield on a wall, swords crossed behind it
//   armorStand { at: [x, y, z], facing, suit: 'iron'|'rusty'|'royal', id?, region, tile }   a suit of armour on a stand
//   spear    { at: [x, y, z], facing, id?, region, tile }        a spear standing on a small foot
// A thing with an `id` can be tapped once it has been seen; armour, shields and spears can be taken (take()).
// `region` and `tile`: in a veiled part of the map a thing shows once its tile has been seen, and is as dim as
// its part of the map while the hero is elsewhere.
import * as THREE from '../engine/three.js';
import { box, glow } from '../engine/boxes.js';
import { M } from './materials.js';
import { IRON, iron } from './hero.js';

const GREEN = '#6f9a3a', GREEN_LIGHT = '#86b04a', GREEN_DARK = '#55772b';
const RAG = '#6b4a2e', RAG_LIGHT = '#7f5a39', RAG_DARK = '#4e341f';
const PANTS = '#4a3a2a', PANTS_DARK = '#372a1e';
const ROPE = '#c2a878';
const STONE = ['#7d7a6e', '#8f8b7e', '#6b685d'];

/**
 * @param {any} g the stage the props get: scene, rand, paintedBox, state, world, fog
 * @param {(update: (t: number, dt: number) => void) => void} every called every frame
 */
export function goblinKinds(g, every) {
  const { scene, rand, paintedBox } = g;

  const skin = (p) => { p.rect(0, 0, p.w, p.h, GREEN); p.speckle(GREEN_LIGHT, 0.1); p.speckle(GREEN_DARK, 0.08); p.row(p.h - 1, GREEN_DARK); };
  const rag = (p) => {
    p.rect(0, 0, p.w, p.h, RAG); p.speckle(RAG_LIGHT, 0.12);
    for (let x = 0; x < p.w; x += 2) p.px(x, p.h - 1, RAG_DARK);          // a torn hem
    p.column(p.w - 1, RAG_DARK);
  };
  const pants = (p) => { p.rect(0, 0, p.w, p.h, PANTS); p.row(p.h - 1, PANTS_DARK); };

  // How a thing in a veiled part shows: hidden until its tile is seen, then as dim as its part of the map.
  function inFog(group, { region, tile }) {
    const materials = [];
    group.traverse((node) => { if (node.isMesh && node.material.color && !node.material.isMeshBasicMaterial) materials.push(node.material); });
    return () => {
      const shown = !tile || g.fog.canEnter(tile[0], tile[1]);           // behind a shut door, or not yet seen: hidden
      group.visible = shown;
      const light = region ? g.world.regionLight[region] ?? 1 : 1;
      for (const material of materials) material.color.setScalar(light);
      return shown ? light : 0;
    };
  }

  // A goblin, sitting on a stone: big head, long ears, thin arms. Facing +z before it is turned.
  function goblinFigure(pose) {
    const root = new THREE.Group();
    paintedBox(root, 0.32, 0.18, 0.26, 0, 0.09, -0.04, {                 // the stone he sits on
      all: (p) => { p.rect(0, 0, p.w, p.h, STONE[0]); p.speckle(STONE[1], 0.2); p.speckle(STONE[2], 0.15); p.row(0, STONE[1]); },
    });
    const body = new THREE.Group();
    root.add(body);
    paintedBox(body, 0.3, 0.3, 0.18, 0, 0.45, 0, {
      all: rag,
      front: (p) => { rag(p); p.rect(2, 2, 2, 2, RAG_LIGHT); p.px(2, 2, RAG_DARK); },               // a patch
    });
    paintedBox(body, 0.32, 0.04, 0.2, 0, 0.34, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, ROPE); } });     // a rope belt
    // legs: thighs forward along the stone, shins down
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.08, 0.3, 0.02);
      hip.rotation.x = -1.45;
      paintedBox(hip, 0.1, 0.22, 0.1, 0, -0.11, 0, { all: pants });
      const knee = new THREE.Group();
      knee.position.y = -0.22;
      knee.rotation.x = 1.45;
      hip.add(knee);
      paintedBox(knee, 0.09, 0.22, 0.09, 0, -0.11, 0, { all: skin });
      paintedBox(knee, 0.11, 0.05, 0.16, 0, -0.24, 0.03, { all: skin });                                  // a bare foot
      body.add(hip);
      return hip;
    });
    // arms, held out to the fire (or to the coins)
    const arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.19, 0.57, 0);
      paintedBox(shoulder, 0.08, 0.17, 0.08, 0, -0.085, 0, { all: rag });
      const elbow = new THREE.Group();
      elbow.position.y = -0.17;
      shoulder.add(elbow);
      paintedBox(elbow, 0.07, 0.16, 0.07, 0, -0.08, 0, { all: skin });
      paintedBox(elbow, 0.08, 0.06, 0.08, 0, -0.18, 0, { all: skin });                                   // the hand
      body.add(shoulder);
      return { shoulder, elbow };
    });
    // the head: big, with a long nose, yellow eyes and ears that stick out
    const head = new THREE.Group();
    head.position.y = 0.62;
    body.add(head);
    paintedBox(head, 0.32, 0.28, 0.28, 0, 0.14, 0, {
      all: skin,
      front: (p) => {
        skin(p);
        p.rect(1, 1, 2, 1, GREEN_DARK); p.rect(4, 1, 2, 1, GREEN_DARK);                   // brows
        p.shine(1, 2, '#ffd23a'); p.px(2, 2, '#2a1a0a'); p.px(4, 2, '#2a1a0a'); p.shine(5, 2, '#ffd23a');
        p.rect(2, 4, 3, 1, '#3a2614'); p.px(2, 4, '#efe9d8'); p.px(4, 4, '#efe9d8');          // a grin with two teeth
      },
    });
    paintedBox(head, 0.06, 0.07, 0.1, 0, 0.12, 0.17, { all: (p) => { p.rect(0, 0, p.w, p.h, GREEN_LIGHT); p.row(p.h - 1, GREEN_DARK); } });     // nose
    [-1, 1].forEach((side) => {
      const ear = paintedBox(head, 0.2, 0.08, 0.04, side * 0.24, 0.17, -0.02, { all: (p) => { skin(p); p.column(side > 0 ? p.w - 1 : 0, '#c97a6a'); } });
      ear.rotation.z = side * 0.35;                                                         // tips up
    });
    paintedBox(head, 0.34, 0.06, 0.3, 0, 0.3, -0.01, { all: (p) => { p.rect(0, 0, p.w, p.h, '#3a2a1a'); p.speckle('#4e3a26', 0.3); } });     // a scrap of hair
    // what he holds
    let held = null;
    if (pose === 'poke') {
      held = new THREE.Group();
      held.position.set(0, -0.2, 0.02);
      arms[1].elbow.add(held);
      paintedBox(held, 0.03, 0.5, 0.03, 0, -0.06, 0.2, { all: (p) => { p.rect(0, 0, p.w, p.h, '#5c3a20'); p.row(p.h - 1, '#1c1410'); } }).rotation.x = 1.2;     // a stick, its end in the fire
    }
    if (pose === 'count') {
      held = new THREE.Group();
      held.position.set(0, -0.22, 0.02);
      arms[1].elbow.add(held);
      paintedBox(held, 0.09, 0.03, 0.09, 0, 0, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#e3ac2a'); p.shine(1, 1, '#ffd35a'); } });             // a coin
    }
    return { root, body, head, arms, legs, held };
  }

  return {
    campfire(thing) {
      const [x, z] = thing.at;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      for (let k = 0; k < 9; k++) {                                         // a ring of stones
        const a = (k / 9) * Math.PI * 2 + rand() * 0.2;
        const s = 0.14 + rand() * 0.06;
        const stone = paintedBox(group, s, s * 0.75, s, Math.cos(a) * 0.42, s * 0.37, Math.sin(a) * 0.42, {
          all: (p) => { p.rect(0, 0, p.w, p.h, STONE[k % 3]); p.speckle(STONE[(k + 1) % 3], 0.25); p.row(0, STONE[1]); },
        });
        stone.rotation.y = rand() * 3;
      }
      for (let k = 0; k < 3; k++) {                                         // logs, crossed
        const log = paintedBox(group, 0.07, 0.07, 0.56, 0, 0.06 + k * 0.03, 0, {
          all: (p) => { p.rect(0, 0, p.w, p.h, '#5c3a20'); p.speckle('#3a2414', 0.3); p.row(0, '#7a4e2c'); },
          front: (p) => { p.rect(0, 0, p.w, p.h, '#b58a5a'); p.px(0, 0, '#8a6a42'); },
          back: (p) => { p.rect(0, 0, p.w, p.h, '#b58a5a'); },
        });
        log.rotation.y = (k / 3) * Math.PI;
      }
      for (let k = 0; k < 6; k++) {                                         // embers among the logs
        const ember = box(group, 0.05, 0.03, 0.05, M.flame, (rand() - 0.5) * 0.4, 0.05, (rand() - 0.5) * 0.4);
        ember.rotation.y = rand() * 3;
      }
      const flames = [];
      [[0, 0.32, 0.26], [0.07, 0.24, 0.18], [-0.08, 0.22, 0.16]].forEach(([dx, h, w], k) => {
        const flame = new THREE.Group();
        flame.position.set(dx, 0.1, (k - 1) * 0.05);
        box(flame, w, h, w, M.flame, 0, h / 2, 0);
        box(flame, w * 0.55, h * 0.65, w * 0.55, M.flameCore, 0, h * 0.4, 0);
        group.add(flame);
        flames.push({ flame, phase: rand() * 10 });
      });
      const light = new THREE.PointLight(0xff9a4a, 0, 7, 2);
      light.position.set(0, 0.55, 0);
      group.add(light);
      const halo = glow(group, 0xff7a28, 2.4, 0.1, 0, 0.35, 0);
      scene.add(group);
      const show = inFog(group, thing);
      every((t) => {
        const lit = show();
        const n = 0.82 + 0.12 * Math.sin(t * 9.3) + 0.06 * Math.sin(t * 23.1 + 1.7);
        light.intensity = 9 * n * lit;
        halo.material.opacity = 0.1 * n * lit;
        for (const { flame, phase } of flames) {
          flame.scale.set(1, 0.85 + 0.3 * Math.sin(t * 12 + phase), 1);
          flame.rotation.y = t * 1.9 + phase;
        }
      });
      return { object: group };
    },
    goblin(thing) {
      const [x, z] = thing.at;
      const figure = goblinFigure(thing.pose ?? 'warm');
      figure.root.position.set(x, 0, z);
      figure.root.rotation.y = thing.facing ?? 0;
      scene.add(figure.root);
      const show = inFog(figure.root, thing);
      const phase = rand() * 10;
      const { body, head, arms, held } = figure;
      let met = false;
      every((t) => {
        if (!show()) return;
        if (!met && thing.id) { met = true; g.reveal?.(thing.id); }          // seen: from now on he can be tapped
        body.scale.y = 1 + 0.02 * Math.sin(t * 2.1 + phase);                 // breathing
        head.rotation.y = 0.35 * Math.sin(t * 0.37 + phase) + 0.12 * Math.sin(t * 1.3 + phase);   // looks about
        head.rotation.x = 0.06 * Math.sin(t * 0.8 + phase);
        if (thing.pose === 'count') {                                          // lifts a coin, looks at it, puts it down
          const lift = Math.max(0, Math.sin(t * 1.6 + phase));
          arms[1].shoulder.rotation.x = -0.6 - 0.9 * lift;
          arms[1].elbow.rotation.x = -0.9 + 0.5 * lift;
          arms[0].shoulder.rotation.x = -0.7;
          arms[0].elbow.rotation.x = -0.6;
          if (held) held.rotation.z = t * 6;
          head.rotation.x = -0.15 - 0.25 * lift;
        } else if (thing.pose === 'poke') {                                    // pokes the fire now and then
          const poke = Math.max(0, Math.sin(t * 0.9 + phase)) ** 3;
          arms[1].shoulder.rotation.x = -0.9 - 0.35 * poke;
          arms[1].elbow.rotation.x = -0.4 + 0.3 * poke;
          arms[0].shoulder.rotation.x = -1.0;
          arms[0].elbow.rotation.x = -0.5 + 0.08 * Math.sin(t * 2.4 + phase);
        } else {                                                               // hands held out to the warmth, rubbed now and then
          const rub = Math.sin(t * 7 + phase) * Math.max(0, Math.sin(t * 0.5 + phase));
          arms.forEach((arm, k) => {
            arm.shoulder.rotation.x = -1.05 + 0.05 * rub * (k ? 1 : -1);
            arm.shoulder.rotation.z = (k ? -1 : 1) * (0.25 + 0.06 * rub);
            arm.elbow.rotation.x = -0.35;
          });
        }
      });
      return { object: figure.root };
    },
    // A king's throne: dark wood with gold, a red cushion, a tall back with a crown on top. Faces +z before it is turned.
    throne(thing) {
      const [x, y, z] = thing.at;
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = thing.facing ?? 0;
      const WOOD = '#4a2c1a', WOOD_LIGHT = '#6b3f24', GOLD = '#e3ac2a', GOLD_LIGHT = '#ffd35a', GOLD_DARK = '#a87a16';
      const RED = '#9e1f24', RED_LIGHT = '#c8372d';
      const wood = (p) => { p.rect(0, 0, p.w, p.h, WOOD); p.speckle(WOOD_LIGHT, 0.12); p.row(0, GOLD); p.row(p.h - 1, GOLD_DARK); p.column(0, GOLD); p.column(p.w - 1, GOLD_DARK); };
      const gold = (p) => { p.rect(0, 0, p.w, p.h, GOLD); p.row(0, GOLD_LIGHT); p.row(p.h - 1, GOLD_DARK); };
      paintedBox(group, 0.74, 0.36, 0.62, 0, 0.18, 0.02, { all: wood });                                       // the seat block
      paintedBox(group, 0.62, 0.08, 0.52, 0, 0.4, 0.05, { all: (p) => { p.rect(0, 0, p.w, p.h, RED); p.speckle(RED_LIGHT, 0.15); p.row(p.h - 1, '#6e1418'); } });   // the cushion
      paintedBox(group, 0.74, 1.12, 0.14, 0, 0.92, -0.26, {                                                      // the tall back
        all: wood,
        front: (p) => { wood(p); p.rect(2, 3, p.w - 4, p.h - 6, RED); p.speckle(RED_LIGHT, 0.06); p.rect(Math.floor(p.w / 2) - 1, 6, 2, 2, GOLD_LIGHT); },
      });
      [-1, 1].forEach((side) => {
        paintedBox(group, 0.12, 0.24, 0.56, side * 0.37, 0.48, 0.04, { all: wood });                             // armrests
        paintedBox(group, 0.15, 0.06, 0.15, side * 0.37, 0.62, 0.28, { all: gold });                             // their gold ends
      });
      [[-0.27, 0.16], [0, 0.26], [0.27, 0.16]].forEach(([dx, h]) => {                                             // the crown on top
        paintedBox(group, 0.12, h, 0.12, dx, 1.48 + h / 2, -0.26, { all: gold });
      });
      paintedBox(group, 0.08, 0.08, 0.04, 0, 1.56, -0.18, { all: (p) => { for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) p.shine(i, j, j ? '#c8372d' : '#ff6a6a'); } });    // a red gem
      scene.add(group);
      const show = inFog(group, thing);
      every(() => { show(); });
      return { object: group };
    },
    // A shield on a wall, two swords crossed behind it. `colours`: its two halves. Faces +z (out of the wall) before it is turned.
    shield(thing) {
      const [x, y, z] = thing.at;
      const [a, b] = thing.colours ?? ['#9e1f24', '#e3ac2a'];
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = thing.facing ?? 0;
      group.scale.setScalar(2);                                                // a big shield, the same size as when it is carried
      const IRON = ['#7c838e', '#b6bcc5', '#e3e6ea'];
      [-1, 1].forEach((side) => {                                               // the swords, crossed behind it
        const sword = new THREE.Group();
        sword.rotation.z = side * 0.75;
        group.add(sword);
        paintedBox(sword, 0.05, 0.72, 0.02, 0, 0.12, -0.035, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[1]); p.column(0, IRON[2]); p.column(p.w - 1, IRON[0]); } });
        paintedBox(sword, 0.18, 0.04, 0.03, 0, -0.26, -0.035, { all: (p) => { p.rect(0, 0, p.w, p.h, '#e3ac2a'); p.row(p.h - 1, '#a87a16'); } });
        paintedBox(sword, 0.04, 0.12, 0.03, 0, -0.34, -0.035, { all: (p) => { p.rect(0, 0, p.w, p.h, '#5c3a20'); } });
      });
      // the shield: a plate that narrows to a point, split in two colours, with a gold rim and boss
      const half = (p, left) => { p.rect(0, 0, p.w, p.h, left ? a : b); };
      [[0.5, 0.36, 0.08], [0.42, 0.1, -0.15], [0.3, 0.08, -0.24], [0.16, 0.07, -0.315]].forEach(([w, h, dy]) => {
        paintedBox(group, w / 2, h, 0.05, -w / 4, dy, 0, { all: (p) => half(p, true), front: (p) => { half(p, true); p.column(0, '#e3ac2a'); } });
        paintedBox(group, w / 2, h, 0.05, w / 4, dy, 0, { all: (p) => half(p, false), front: (p) => { half(p, false); p.column(p.w - 1, '#e3ac2a'); } });
      });
      paintedBox(group, 0.52, 0.04, 0.06, 0, 0.27, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#e3ac2a'); p.row(0, '#ffd35a'); } });      // the gold rim on top
      paintedBox(group, 0.1, 0.1, 0.04, 0, 0.06, 0.04, { all: (p) => { p.rect(0, 0, p.w, p.h, '#e3ac2a'); p.px(1, 1, '#ffd35a'); p.row(p.h - 1, '#a87a16'); } });   // the boss
      scene.add(group);
      const show = inFog(group, thing);
      const plate = group.children.slice(2);                                  // everything but the two swords
      let met = false;
      every(() => { if (show() && !met && thing.id) { met = true; g.reveal?.(thing.id); } });     // seen: from now on it can be tapped
      return { object: group, take() { plate.forEach((part) => { part.visible = false; }); } };
    },
    // A spear standing upright on a small wooden foot, a red pennant under its head.
    spear(thing) {
      const [x, y, z] = thing.at;
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = thing.facing ?? 0;
      const foot = paintedBox(group, 0.3, 0.08, 0.3, 0, 0.04, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#4a2c1a'); p.row(0, '#6b3f24'); } });
      const spear = new THREE.Group();
      group.add(spear);
      paintedBox(spear, 0.05, 2.0, 0.05, 0, 1.06, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#8a5a34'); p.column(0, '#a8703f'); p.column(p.w - 1, '#5c3a20'); } });
      paintedBox(spear, 0.1, 0.24, 0.04, 0, 2.18, 0, { all: (p) => { iron(p); p.column(0, IRON[4]); } });
      paintedBox(spear, 0.05, 0.1, 0.03, 0, 2.34, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[4]); } });
      paintedBox(spear, 0.14, 0.04, 0.06, 0, 2.05, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#e3ac2a'); } });
      paintedBox(spear, 0.02, 0.18, 0.2, 0.035, 1.9, 0.11, { all: (p) => { p.rect(0, 0, p.w, p.h, '#b0242a'); p.row(p.h - 1, '#7a1418'); } });   // the pennant
      scene.add(group);
      const show = inFog(group, thing);
      let met = false;
      every(() => { if (show() && !met && thing.id) { met = true; g.reveal?.(thing.id); } });
      void foot;
      return { object: group, take() { spear.visible = false; } };
    },
    // A suit of armour on a wooden stand. `suit`: 'iron', 'rusty' or 'royal'. The suit can be taken off it
    // (take()); the stand stays. Faces +z before it is turned.
    armorStand(thing) {
      const [x, y, z] = thing.at;
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = thing.facing ?? 0;
      const wood = (p) => { p.rect(0, 0, p.w, p.h, '#4a2c1a'); p.speckle('#6b3f24', 0.15); p.row(0, '#6b3f24'); };
      paintedBox(group, 0.5, 0.06, 0.4, 0, 0.03, 0, { all: wood });                      // the stand: a foot, a post, a bar
      paintedBox(group, 0.06, 1.2, 0.06, 0, 0.63, -0.02, { all: wood });
      paintedBox(group, 0.62, 0.05, 0.05, 0, 1.12, -0.02, { all: wood });
      const rusty = (p) => { iron(p); p.speckle('#8a5a34', 0.12); p.speckle('#6b4a2e', 0.06); };
      const royal = (p) => { iron(p); p.row(0, '#ffd35a'); p.row(p.h - 1, '#a87a16'); p.column(0, '#e3ac2a'); p.column(p.w - 1, '#a87a16'); };
      const metal = thing.suit === 'royal' ? royal : thing.suit === 'rusty' ? rusty : iron;
      const mail = (p) => { p.rect(0, 0, p.w, p.h, IRON[1]); for (let j = 0; j < p.h; j++) for (let i = j % 2; i < p.w; i += 2) p.px(i, j, IRON[0]); };
      const suit = new THREE.Group();
      group.add(suit);
      paintedBox(suit, 0.44, 0.4, 0.42, 0, 1.4, 0, { all: metal, front: (p) => { metal(p); p.row(p.h - 3, '#2f2a26'); } });    // the helmet, a slit for the eyes
      if (thing.suit === 'royal') paintedBox(suit, 0.08, 0.2, 0.32, 0, 1.68, -0.02, { all: (p) => { p.rect(0, 0, p.w, p.h, '#b0242a'); p.speckle('#d83a3a', 0.2); } });   // the plume
      paintedBox(suit, 0.46, 0.38, 0.26, 0, 0.98, 0, {
        all: metal,
        front: (p) => { metal(p); if (thing.suit === 'royal') { const m = Math.floor(p.w / 2); p.rect(m - 1, 2, 2, 3, '#e3ac2a'); } else p.column(Math.floor(p.w / 2), IRON[1]); },
      });
      paintedBox(suit, 0.42, 0.1, 0.24, 0, 0.74, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#3a3d45'); p.row(0, '#4a4e58'); } });      // the padding at the waist
      [-1, 1].forEach((side) => {
        paintedBox(suit, 0.2, 0.08, 0.22, side * 0.31, 1.13, 0, { all: metal });                      // pauldrons
        paintedBox(suit, 0.13, 0.42, 0.14, side * 0.31, 0.88, 0, { all: mail, top: metal });          // the arms, empty, hanging
        paintedBox(suit, 0.19, 0.42, 0.21, side * 0.1, 0.45, 0, { all: metal });                      // the legs
        paintedBox(suit, 0.22, 0.15, 0.3, side * 0.1, 0.075, 0.04, { all: metal });                   // the boots
      });
      scene.add(group);
      const show = inFog(group, thing);
      let met = false;
      every(() => { if (show() && !met && thing.id) { met = true; g.reveal?.(thing.id); } });     // seen: from now on it can be tapped
      return { object: group, take() { suit.visible = false; } };
    },
    // A red carpet with a gold border, flat on the floor, from one point to another (along x).
    carpet(thing) {
      const [x0, z] = thing.from;
      const [x1] = thing.to;
      const width = thing.width ?? 1.2;
      const length = Math.abs(x1 - x0);
      const group = new THREE.Group();
      group.position.set((x0 + x1) / 2, 0, z);
      paintedBox(group, length, 0.02, width, 0, 0.012, 0, {
        all: (p) => { p.rect(0, 0, p.w, p.h, '#8e1c22'); },
        top: (p) => {
          p.rect(0, 0, p.w, p.h, '#9e1f24'); p.speckle('#b02a2e', 0.05);
          p.row(1, '#e3ac2a'); p.row(p.h - 2, '#e3ac2a');                                       // the gold border
          for (let i = 6; i < p.w - 6; i += 8) {                                              // a row of small diamonds
            const m = Math.floor(p.h / 2);
            p.px(i, m - 2, '#c99a2a'); p.px(i - 1, m - 1, '#c99a2a'); p.px(i + 1, m - 1, '#c99a2a'); p.px(i - 2, m, '#c99a2a');
            p.px(i + 2, m, '#c99a2a'); p.px(i - 1, m + 1, '#c99a2a'); p.px(i + 1, m + 1, '#c99a2a'); p.px(i, m + 2, '#c99a2a');
          }
        },
      });
      scene.add(group);
      const show = inFog(group, thing);
      every(() => { show(); });
      return { object: group };
    },
    hoard(thing) {
      const [x, z] = thing.at;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      // one heap: many coins in a few instanced draws, piled higher in the middle
      const COINS = 140;
      const coin = new THREE.BoxGeometry(0.1, 0.03, 0.1);
      const pile = new THREE.InstancedMesh(coin, M.gold, COINS);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const p = new THREE.Vector3();
      const s = new THREE.Vector3(1, 1, 1);
      for (let k = 0; k < COINS; k++) {
        const r = Math.sqrt(rand()) * 0.55;
        const a = rand() * Math.PI * 2;
        const height = Math.max(0, 0.42 * (1 - r / 0.55)) * (0.75 + 0.25 * rand());
        p.set(Math.cos(a) * r, 0.02 + height * rand(), Math.sin(a) * r * 0.85);
        e.set((rand() - 0.5) * 0.9, rand() * 3, (rand() - 0.5) * 0.9);
        q.setFromEuler(e);
        pile.setMatrixAt(k, m.compose(p, q, s));
      }
      pile.castShadow = true;
      pile.receiveShadow = true;
      group.add(pile);
      for (let k = 0; k < 6; k++) box(group, 0.11, 0.03, 0.11, M.goldGlow, (rand() - 0.5) * 0.5, 0.18 + rand() * 0.22, (rand() - 0.5) * 0.4);   // a few that catch the light
      const glint = glow(group, 0xffcf5a, 1.4, 0.06, 0, 0.3, 0);
      scene.add(group);
      const show = inFog(group, thing);
      every((t) => {
        const lit = show();
        glint.material.opacity = (0.05 + 0.03 * Math.sin(t * 1.7)) * lit;
      });
      return { object: group };
    },
  };
}
