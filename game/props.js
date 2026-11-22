// @ts-check
// The things of the two maps, by kind: lights, torches, the stream, the guardian and his door, the chests,
// barrels, crystals, the cave door... A map lists its things (maps/*.js); each kind is built here from boxes.
// A builder gets the thing's entry from the map and may give back { object, bounds, ... } for main.js;
// what moves every frame is pushed into `updates`.
import * as THREE from '../engine/three.js';
import { box, glow } from '../engine/boxes.js';
import { paint } from '../engine/textures.js';
import { mulberry32, whole } from '../engine/random.js';
import { key } from '../engine/map.js';
import { M, PETALS } from './materials.js';
import { STONE, MOSS } from './blocks.js';

/**
 * @param {object} g
 * @param {any} g.scene
 * @param {() => number} g.rand the dice of the things
 * @param {Function} g.paintedBox
 * @param {any} g.level from loadMap
 * @param {any} g.world
 * @param {any} g.fog
 * @param {any} g.state what has happened so far: doorOpen, chestOpen, chestShake, chest2Seen, chest2Open, caveDoorOpen, here, closeUp
 * @param {any} g.hero the hero's group (set before the first frame)
 * @param {(material: any) => void} [g.wet] called with the material of open water, so the game can make it shine
 * @returns {{ build: Record<string, Function>, fields: Record<string, Function>, updates: Function[], torches: any[], falls: number[][] }}
 *   torches: every torch (`at`: where its light is; `base`: how strong it burns, 0 when out); falls: the foot of each waterfall
 */
export function makeProps(g) {
  const { scene, rand, paintedBox, state } = g;
  const updates = [];                 // (t, dt) => {}: called every frame, in this order
  const every = (update) => updates.push(update);

  // Torches flicker, each with its own phase.
  const flickers = [];   // { light, base, halo, haloBase, flame, phase }
  const falls = [];      // [x, y, z]: the foot of each waterfall
  every((t) => {
    for (const f of flickers) {
      const n = 0.86 + 0.09 * Math.sin(t * 11 + f.phase) + 0.05 * Math.sin(t * 23.7 + f.phase * 2);
      f.light.intensity = f.base * n;
      f.halo.material.opacity = f.haloBase * n;
      f.flame.scale.set(1, 0.9 + 0.25 * Math.sin(t * 13 + f.phase), 1);
      f.flame.rotation.y = t * 1.7 + f.phase;
    }
  });
  // The torches nearest the hero cast real shadows. A light with shadows draws the whole scene from six sides
  // every frame, so there are only SHADOW_TORCHES of them: they go to the nearest lit torches and shine in place
  // of those torches' own lights. Their number never changes, because a change in the number of lights would
  // rebuild every material; how many of them cast shadows changes only with the setting (torchShadows), and that
  // rebuilds the materials once. A torch keeps its caster until another is clearly nearer, so shadows do not jump about.
  const SHADOW_TORCHES = 2;
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
  /** How many of the nearest torches cast shadows (0 to SHADOW_TORCHES), and how big their shadow maps are. */
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
    const here = g.hero?.position;
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
  function torch(x, y, z, leanX, leanZ, power = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const stick = box(g, 0.09, 0.42, 0.09, M.woodDark, 0, -0.16, 0);
    stick.rotation.set(leanZ * 0.5, 0, -leanX * 0.5);
    box(g, 0.2, 0.08, 0.2, M.iron, leanX * 0.08, 0.06, leanZ * 0.08);
    const flame = new THREE.Group();
    flame.position.set(leanX * 0.1, 0.22, leanZ * 0.1);
    box(flame, 0.2, 0.24, 0.2, M.flame);
    box(flame, 0.11, 0.16, 0.11, M.flameCore, 0, 0.12, 0);
    g.add(flame);
    const light = new THREE.PointLight(0xffc089, 6.5 * power, 9, 2);
    light.position.set(leanX * 0.9, 0.35, leanZ * 0.9);
    g.add(light);
    const halo = glow(g, 0xff7a28, 1.8, 0.08, leanX * 0.2, 0.25, leanZ * 0.2);
    scene.add(g);
    const flicker = { light, base: 6.5 * power, halo, haloBase: 0.08, flame, phase: rand() * 10, strength: 6.5 * power,
      at: new THREE.Vector3(x + leanX * 0.9, y + 0.35, z + leanZ * 0.9), dist: Infinity, casting: false };      // `at`: where its light is
    flickers.push(flicker);
    g.userData.flicker = flicker;
    return g;
  }

  // Markers that say "this can be opened": they bob and turn (each with its own phase k), and hide during a close-up.
  function beacon(material, x, y, z, k, gone = () => false) {
    const m = box(scene, 0.2, 0.2, 0.2, material, x, y, z);
    m.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    every((t) => {
      m.position.y = y + Math.sin(t * 2.4 + k * 2) * 0.09;
      m.rotation.y = t * 1.5;
      m.visible = !state.closeUp() && !gone();
    });
  }

  const build = {
    // ---------- light ----------
    caveLight() {
      scene.add(new THREE.HemisphereLight(0xd6dce6, 0x4a443a, 1.45));
      const fill = new THREE.DirectionalLight(0xb4bfce, 0.65);   // lifts the faces that look left
      fill.position.set(2, 6, 16);
      scene.add(fill);
      const moon = new THREE.DirectionalLight(0xe6ecf7, 1.25);
      moon.position.set(15, 11, 1);
      moon.target.position.set(4, 0, 4);
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      Object.assign(moon.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
      moon.shadow.bias = -0.0006;
      moon.shadow.normalBias = 0.03;
      scene.add(moon, moon.target);
      // Its shadows cover 13 tiles round the hero, wherever he goes (not only the first room). The point it looks at
      // moves in half-tile steps, so the shadow edges do not crawl while he walks.
      every(() => {
        const at = g.hero?.position;
        if (!at) return;
        const x = Math.round(at.x * 2) / 2;
        const z = Math.round(at.z * 2) / 2;
        moon.position.set(x + 11, 11, z - 3);
        moon.target.position.set(x, 0, z);
      });
    },
    dayLight() {
      scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b5a3a, 1.5));
      const surfaceSun = new THREE.DirectionalLight(0xfff0d8, 2.3);
      surfaceSun.castShadow = true;
      surfaceSun.shadow.mapSize.set(2048, 2048);
      Object.assign(surfaceSun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
      surfaceSun.shadow.bias = -0.0006;
      surfaceSun.shadow.normalBias = 0.03;
      scene.add(surfaceSun, surfaceSun.target);
      const skyFill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
      skyFill.position.set(-4, 8, 14);
      scene.add(skyFill);
      every(() => {                                           // the sun and its shadows go where the hero goes
        const at = g.hero.position;
        surfaceSun.position.set(at.x + 12, 18, at.z + 3);
        surfaceSun.target.position.set(at.x, 0, at.z);
      });
    },
    // A torch on a wall. onlyIn: its light is seen only from inside that region, once the cell `seen` has been seen.
    // take(): it is taken off the wall (gone, and its light out).
    torch({ at: [x, y, z], lean: [leanX, leanZ], power = 1, onlyIn, seen }) {
      const group = torch(x, y, z, leanX, leanZ, power);
      const flicker = group.userData.flicker;
      let taken = false;
      if (onlyIn) {
        every(() => {
          const litNow = !taken && state.here === onlyIn && g.fog.seen.has(key(seen[0], seen[1]));
          group.children.forEach((child) => { if (!child.isLight) child.visible = litNow; });
          flicker.base = litNow ? flicker.strength : 0;
        });
      }
      return { object: group, take() { taken = true; group.visible = false; flicker.base = 0; } };
    },
    // Daylight comes down through a hole in the roof and lands on the garden.
    sunShaft({ from, to }) {
      const sunTarget = new THREE.Vector3(...to);
      const sunFrom = new THREE.Vector3(...from);
      const sun = new THREE.SpotLight(0xfff0c4, 13, 26, 0.3, 0.85, 1.2);
      sun.position.copy(sunFrom);
      sun.target.position.copy(sunTarget);
      scene.add(sun, sun.target);
      const shaftTexture = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const image = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          const across = Math.sin((Math.PI * x) / 63) ** 2;
          const along = Math.min(1, y / 40) ** 1.5 * Math.min(1, (63 - y) / 8);   // fades away towards the top, and a little at the ground
          image.data.set([255, 255, 255, 255 * across * along], (y * 64 + x) * 4);
        }
        ctx.putImageData(image, 0, 0);
        return new THREE.CanvasTexture(c);
      })();
      const shaftMaterial = new THREE.MeshBasicMaterial({
        map: shaftTexture, color: 0xfff2c8, transparent: true, opacity: 0.2, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const sunDirection = sunFrom.clone().sub(sunTarget).normalize();
      const shaft = new THREE.Group();
      shaft.position.copy(sunTarget).addScaledVector(sunDirection, 6.4);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDirection);
      [0, Math.PI / 2].forEach((angle) => {
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 13), shaftMaterial);
        sheet.rotation.y = angle;
        shaft.add(sheet);
      });
      scene.add(shaft);
      every((t) => { shaftMaterial.opacity = 0.04 + 0.01 * Math.sin(t * 0.8); });
    },

    // ---------- the dungeon ----------
    // Blades of grass and a few flowers on the grass.
    tufts() {
      const grassTiles = g.level.blocks.filter((b) => b.type === 'grass' && b.tile).sort((a, b) => a.x - b.x || a.z - b.z).map((b) => b.tile);
      grassTiles.forEach(({ i, j }) => {
        for (let k = 0, blades = whole(rand, 4); k < blades; k++) {
          const h = 0.1 + rand() * 0.14;
          box(scene, 0.05, h, 0.05, M.blade, i + (rand() - 0.5) * 0.8, h / 2, j + (rand() - 0.5) * 0.8).rotation.y = rand() * 1.5;
        }
        if (rand() < 0.4) {
          const x = i + (rand() - 0.5) * 0.6;
          const z = j + (rand() - 0.5) * 0.6;
          box(scene, 0.04, 0.2, 0.04, M.blade, x, 0.1, z);
          box(scene, 0.11, 0.09, 0.11, PETALS[whole(rand, PETALS.length)], x, 0.23, z).rotation.y = rand() * 1.5;
        }
      });
    },
    rubble({ stones }) {
      stones.forEach(([x, z, s]) => {
        box(scene, s, s, s, M.stone, x, s / 2, z).rotation.y = rand() * 1.5;
      });
    },
    // Water in the bed of the stream, and where it leaves the slab (`falls`) it drops into the dark, fading out.
    stream({ tiles: WATER, falls: [fx, fz] }) {
      const D = fz + 1;
      const WATER_BLUE = ['#2d5f86', '#3a7299', '#4b88ad', '#74aac8', '#b9d8e6'];
      const waterTexture = paint(11, (px, r) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, WATER_BLUE[1 + (r() < 0.2 ? 1 : 0) - (r() < 0.12 ? 1 : 0)]);
        for (let k = 0; k < 9; k++) {
          const x = whole(r, 16), y = whole(r, 16), length = 3 + whole(r, 4);
          for (let n = 0; n < length; n++) px(x + n, y + (n > length / 2 ? 1 : 0), WATER_BLUE[3]);
        }
        for (let k = 0; k < 4; k++) px(whole(r, 16), whole(r, 16), WATER_BLUE[4]);
      });
      const fallTexture = paint(12, (px, r) => {
        for (let x = 0; x < 16; x++) {
          const column = 2 + (r() < 0.35 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
          for (let y = 0; y < 16; y++) px(x, y, WATER_BLUE[Math.min(4, column + (r() < 0.15 ? 1 : 0))]);
        }
      });
      [waterTexture, fallTexture].forEach((tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; });
      fallTexture.repeat.set(1, 4);

      const waterMaterial = new THREE.MeshLambertMaterial({
        map: waterTexture, transparent: true, opacity: 0.88, emissive: 0x245876, emissiveIntensity: 0.22,
      });
      g.wet?.(waterMaterial);
      WATER.forEach(([i, j]) => {
        const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waterMaterial);
        surface.rotation.x = -Math.PI / 2;
        surface.position.set(i, -0.2, j);
        surface.receiveShadow = true;
        scene.add(surface);
      });
      const fadeTexture = (() => {
        const c = document.createElement('canvas');
        c.width = 4; c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#cfcfcf'); g.addColorStop(1, '#000000');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 64);
        return new THREE.CanvasTexture(c);
      })();
      const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 4.4), new THREE.MeshBasicMaterial({
        map: fallTexture, alphaMap: fadeTexture, transparent: true, depthWrite: false, color: 0xdcefff,
      }));
      waterfall.position.set(fx, -2.4, D - 0.47);
      scene.add(waterfall);
      box(scene, 0.92, 0.12, 0.1, new THREE.MeshBasicMaterial({ color: 0xe6f4ff }), fx, -0.24, D - 0.46);
      glow(scene, 0xbfe3ff, 2.0, 0.07, fx, -3.4, D - 0.3);
      falls.push([fx, -3.6, D - 0.3]);
      every((t) => {
        waterTexture.offset.set(t * 0.05, Math.sin(t * 0.6) * 0.04);
        fallTexture.offset.y = t * 1.1;
      });
    },
    // The guardian: a stone golem in front of a shut door with runes on the lintel. Mossy plates, a cracked
    // chest, and eyes and a sign that shine by themselves. When the door opens it slides down and he steps aside.
    guardian({ at: [gx, gz], door: [dx0, dz0], aside }) {
      const door = new THREE.Group();
      door.position.set(dx0, 0, dz0);
      box(door, 1.98, 1.98, 0.16, M.woodDark, 0, 0.99, 0);
      box(door, 2.0, 0.14, 0.2, M.iron, 0, 0.45, 0.02);
      box(door, 2.0, 0.14, 0.2, M.iron, 0, 1.55, 0.02);
      box(door, 0.05, 1.98, 0.2, M.dark, 0, 0.99, 0.01);
      box(door, 0.34, 0.4, 0.12, M.gold, 0, 1.0, 0.12);
      box(door, 0.08, 0.14, 0.14, M.dark, 0, 0.96, 0.13);
      scene.add(door);
      const runes = [-0.62, 0, 0.62].map((dx) => box(scene, 0.24, 0.24, 0.06, M.rune.clone(), dx0 + dx, 2.5, dz0 + 0.32));
      const runeLight = new THREE.PointLight(0x9a6cff, 5, 4.5, 2);
      runeLight.position.set(dx0, 2.1, dz0 + 1.1);
      scene.add(runeLight);
      runeLight.visible = false;                  // the runes glow on their own; a light here cost more than it showed
      const runeHalo = glow(scene, 0x8a55ff, 3.2, 0.3, dx0, 2.5, dz0 + 0.5);

      const TEAL = '#8ff0e4';
      function stonePlate(g, base) {
        g.rect(0, 0, g.w, g.h, STONE[base]);
        g.speckle(STONE[base - 1], 0.07);
        g.row(0, STONE[base + 2]); g.column(0, STONE[base + 1]);
        g.row(g.h - 1, STONE[base - 1]); g.column(g.w - 1, STONE[base - 1]);
      }
      function mossOn(g, rows) {
        for (let x = 0; x < g.w; x++) {
          const depth = Math.floor(g.r() * (rows + 1));
          for (let y = 0; y < depth; y++) g.px(x, y, MOSS[y === depth - 1 ? 0 : 1 + Math.floor(g.r() * 2)]);
        }
      }
      const golem = new THREE.Group();
      golem.position.set(gx, 0, gz);
      golem.scale.set(1.45 * 0.78, 1.45, 1.45 * 0.78);     // a big one, as tall as before but slimmer, so he looks taller
      [-0.24, 0.24].forEach((x) => paintedBox(golem, 0.34, 0.4, 0.4, x, 0.2, 0, {
        all: (g) => { stonePlate(g, 1); g.row(g.h - 3, STONE[0]); },
      }));
      const golemTop = new THREE.Group();
      golemTop.position.y = 0.4;
      paintedBox(golemTop, 0.98, 0.74, 0.62, 0, 0.37, 0, {
        all: (g) => { stonePlate(g, 2); g.row(Math.floor(g.h * 0.7), STONE[1]); mossOn(g, 2); },
        top: (g) => { stonePlate(g, 2); g.speckle(MOSS[1], 0.35); g.speckle(MOSS[2], 0.15); },
        front: (g) => {
          stonePlate(g, 2);
          g.row(11, STONE[1]);
          [[15, 2], [16, 3], [16, 4], [15, 5], [15, 6], [14, 7], [3, 9], [4, 10], [4, 12]].forEach(([x, y]) => g.px(x, y, STONE[0]));   // cracks
          mossOn(g, 3);
          [[10, 4], [9, 5], [11, 5], [8, 6], [12, 6], [9, 7], [11, 7], [10, 8], [10, 6]].forEach(([x, y]) => g.shine(x, y, TEAL));        // the sign
        },
      });
      paintedBox(golemTop, 0.5, 0.42, 0.5, 0, 0.95, 0.02, {
        all: (g) => { stonePlate(g, 3); },
        top: (g) => { stonePlate(g, 3); g.speckle(MOSS[1], 0.5); g.speckle(MOSS[2], 0.2); },
        front: (g) => {
          stonePlate(g, 3);
          g.rect(0, 1, g.w, 2, STONE[1]);                                           // a heavy brow
          [[2, 3], [3, 3], [2, 4], [3, 4], [6, 3], [7, 3], [6, 4], [7, 4]].forEach(([x, y]) => g.shine(x, y, TEAL));
          g.rect(1, 6, g.w - 2, 1, STONE[0]);                                        // the jaw line
          [2, 4, 6].forEach((x) => g.px(x, 6, STONE[4]));
        },
      });
      const golemArms = [-1, 1].map((side) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.66, 0.66, 0);
        paintedBox(arm, 0.3, 0.78, 0.36, 0, -0.34, 0, {
          all: (g) => {
            stonePlate(g, 1);
            g.rect(0, 0, g.w, 4, STONE[3]); g.row(4, STONE[0]);                      // the shoulder block
            g.rect(0, g.h - 4, g.w, 4, STONE[3]); g.row(g.h - 5, STONE[0]);          // the fist
            for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, STONE[1]);
            mossOn(g, 2);
          },
          top: (g) => { stonePlate(g, 3); g.speckle(MOSS[1], 0.5); },
        });
        golemTop.add(arm);
        return arm;
      });
      golem.add(golemTop);
      scene.add(golem);
      glow(golem, 0x45f0dc, 1.2, 0.12, 0, 1.38, 0.4);
      beacon(M.rune, gx, 2.05, gz, 1);
      every((t, dt) => {                          // he breathes; the runes pulse
        golemTop.scale.y = 1 + Math.sin(t * 1.6) * 0.018;
        golemTop.rotation.y = Math.sin(t * 0.5) * 0.07;
        golemArms.forEach((arm, k) => { arm.rotation.x = Math.sin(t * 1.6 + k) * 0.05; });
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
        runes.forEach((rune, k) => rune.material.color.setHSL(0.74, 0.9, 0.5 + 0.25 * Math.sin(t * 1.8 - k * 0.9)));
        runeLight.intensity = 1 + 0.8 * pulse;
        runeHalo.material.opacity = 0.06 + 0.07 * pulse;
        const slide = 1 - Math.exp(-dt * 3);
        door.position.y += ((state.doorOpen ? -2.3 : 0) - door.position.y) * slide;
        golem.position.x += ((state.doorOpen ? aside : gx) - golem.position.x) * slide;
      });
      return { object: golem };
    },
    // The bookkeeper's chest on its step, glowing through the gap under the lid. It rattles now and then.
    taskChest({ at: [x, y, z] }) {
      const chest = new THREE.Group();
      chest.position.set(x, y, z);
      box(chest, 0.84, 0.44, 0.56, M.wood, 0, 0.22, 0);
      [-0.27, 0.27].forEach((dx) => box(chest, 0.1, 0.46, 0.6, M.gold, dx, 0.22, 0));
      box(chest, 0.74, 0.05, 0.48, M.goldGlow, 0, 0.455, 0);
      const lid = new THREE.Group();
      lid.position.set(0, 0.47, -0.29);                 // hinge at the back edge
      box(lid, 0.88, 0.22, 0.6, M.wood, 0, 0.11, 0.29);
      [-0.27, 0.27].forEach((dx) => box(lid, 0.1, 0.24, 0.64, M.gold, dx, 0.11, 0.29));
      box(lid, 0.16, 0.2, 0.08, M.gold, 0, 0.04, 0.61);
      chest.add(lid);
      scene.add(chest);
      const chestLight = new THREE.PointLight(0xffc040, 4, 4.5, 2);
      chestLight.position.set(x, y + 0.75, z + 0.5);
      scene.add(chestLight);
      const chestHalo = glow(scene, 0xffb62e, 2.4, 0.26, x, y + 0.5, z + 0.15);
      beacon(M.goldGlow, x, y + 1.25, z, 0, () => state.chestOpen);
      every((t, dt) => {                          // its glow breathes
        const chestOpen = state.chestOpen;
        const rattle = chestOpen ? 0 : Math.max(0, Math.sin(t * 1.3)) ** 12;
        if (chestOpen) lid.rotation.x += (-1.9 - lid.rotation.x) * (1 - Math.exp(-dt * 5));        // the lid swings open and stays
        else lid.rotation.x = -rattle * 0.16 * (0.6 + 0.4 * Math.sin(t * 40));
        state.chestShake = Math.max(0, state.chestShake - dt);
        chest.rotation.z = Math.sin(t * 55) * 0.06 * (state.chestShake / 0.35);
        chest.position.y = y + rattle * 0.02 * Math.abs(Math.sin(t * 36));
        chestLight.intensity = 2 + 0.7 * Math.sin(t * 2.4) + rattle * 1.5 + (chestOpen ? 2.5 : 0);
        chestHalo.material.opacity = 0.1 + 0.03 * Math.sin(t * 2.4) + rattle * 0.08;
      });
      return { object: chest };
    },
    // A plain chest with no lock and no task: hollow, so what lies in it is seen. `shownIn`: it shows once the
    // hero has been in that region. It gives contents(ids): shows the things that are still in it.
    chest({ at: [x, y, z], shownIn }) {
      const chest2 = new THREE.Group();
      chest2.position.set(x, y, z);
      const darkWood = (g) => {
        g.rect(0, 0, g.w, g.h, '#5c4030'); g.speckle('#6b4b38', 0.1);
        for (let y = 3; y < g.h; y += 4) g.row(y, '#46301f');                              // the gaps between the planks
        for (const x of [2, g.w - 4]) { g.column(x, '#9aa1ab'); g.column(x + 1, '#6f7680'); }   // iron bands
        g.row(0, '#7c838e'); g.row(g.h - 1, '#3a2719');
      };
      // Hollow: a bottom and four walls, dark inside, so an empty chest looks empty.
      const chestInside = (g) => { g.rect(0, 0, g.w, g.h, '#2e2016'); for (let y = 2; y < g.h; y += 4) g.row(y, '#24180f'); g.speckle('#3a2a1d', 0.06); };
      const WALL = 0.05;
      paintedBox(chest2, 0.84, WALL, 0.56, 0, WALL / 2, 0, { all: darkWood, top: chestInside });
      paintedBox(chest2, 0.84, 0.44, WALL, 0, 0.22, 0.28 - WALL / 2, {
        all: darkWood,
        back: chestInside,
        front: (g) => { darkWood(g); const m = Math.floor(g.w / 2); g.rect(m - 1, 0, 3, 3, '#e3ac2a'); g.px(m, 1, '#3a2719'); },
      });
      paintedBox(chest2, 0.84, 0.44, WALL, 0, 0.22, -0.28 + WALL / 2, { all: darkWood, front: chestInside });
      [-1, 1].forEach((side) => paintedBox(chest2, WALL, 0.44, 0.56 - 2 * WALL, side * (0.42 - WALL / 2), 0.22, 0, {
        all: darkWood, [side < 0 ? 'right' : 'left']: chestInside,
      }));
      // What lies in it. Each thing shows only while it is still in the chest; anything else put back is a bundle.
      const chestHolds = {};
      const inChest = (id, build) => { const g = new THREE.Group(); build(g); chest2.add(g); chestHolds[id] = g; };
      const purple = (g) => { g.rect(0, 0, g.w, g.h, '#6a3fa0'); g.row(g.h - 1, '#4c2b78'); g.column(0, '#8358bd'); };
      inChest('wizardRobe', (g) => paintedBox(g, 0.4, 0.1, 0.3, -0.14, 0.1, -0.05, {
        all: purple,
        top: (p) => { p.rect(0, 0, p.w, p.h, '#6a3fa0'); p.speckle('#8358bd', 0.15); [[2, 1], [5, 4], [6, 2]].forEach(([x, y]) => p.px(x, y, '#ffd35a')); p.row(0, '#e3ac2a'); },
      }));
      inChest('wizardHat', (g) => {
        paintedBox(g, 0.26, 0.03, 0.26, 0.2, 0.065, -0.07, { all: (p) => p.rect(0, 0, p.w, p.h, '#4c2b78') });
        paintedBox(g, 0.16, 0.08, 0.16, 0.2, 0.12, -0.07, { all: (p) => { purple(p); p.row(p.h - 1, '#e3ac2a'); } });
        paintedBox(g, 0.1, 0.07, 0.1, 0.2, 0.195, -0.08, { all: purple });
        paintedBox(g, 0.05, 0.06, 0.05, 0.2, 0.255, -0.1, { all: purple });
      });
      inChest('wizardBoots', (g) => [0.17, 0.28].forEach((x) => paintedBox(g, 0.09, 0.08, 0.15, x, 0.09, 0.13, { all: (p) => { purple(p); p.row(0, '#e3ac2a'); } })));
      inChest('wand', (g) => {
        paintedBox(g, 0.44, 0.03, 0.03, -0.13, 0.065, 0.17, { all: (p) => { p.rect(0, 0, p.w, p.h, '#5c3a20'); p.row(0, '#8a5a34'); } });
        paintedBox(g, 0.05, 0.05, 0.05, 0.1, 0.075, 0.17, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, '#ff9a3a'); } });
      });
      inChest('magicCloak', (g) => paintedBox(g, 0.4, 0.1, 0.3, -0.14, 0.1, -0.05, {
        all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, '#4f3282'); },
        top: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, (x * 3 + y) % 5 ? '#4f3282' : '#c9a8ff'); },
      }));
      inChest('other', (g) => paintedBox(g, 0.24, 0.1, 0.18, -0.14, 0.1, -0.05, {
        all: (p) => { p.rect(0, 0, p.w, p.h, '#6b5038'); p.speckle('#58422f', 0.1); p.row(0, '#86694c'); },
      }));
      function showChestContents(ids) {
        for (const [id, g] of Object.entries(chestHolds)) if (id !== 'other') g.visible = ids.has(id);
        chestHolds.other.visible = [...ids].some((id) => !chestHolds[id] || id === 'other');
        let y = 0;                                         // the folded things lie in one pile, each on the one below
        for (const id of ['magicCloak', 'wizardRobe', 'other']) { chestHolds[id].position.y = y; if (chestHolds[id].visible) y += 0.1; }
      }
      const lid2 = new THREE.Group();
      lid2.position.set(0, 0.47, -0.29);                // hinge at the back edge
      paintedBox(lid2, 0.88, 0.22, 0.6, 0, 0.11, 0.29, { all: darkWood });
      paintedBox(lid2, 0.16, 0.2, 0.08, 0, 0.04, 0.61, { all: (g) => { g.rect(0, 0, g.w, g.h, '#e3ac2a'); g.row(0, '#ffd35a'); g.row(g.h - 1, '#a87a16'); } });
      chest2.add(lid2);
      chest2.visible = false;
      scene.add(chest2);
      const chest2Skins = [];
      chest2.traverse((node) => { if (node.isMesh) chest2Skins.push(node.material); });
      every((t, dt) => {
        if (state.here === shownIn && !state.chest2Seen) { state.chest2Seen = true; g.onSeen?.(); }
        chest2.visible = state.chest2Seen;
        const lightNow = g.world.regionLight[shownIn];           // as dim as the chamber it stands in
        chest2Skins.forEach((material) => material.color.setScalar(lightNow));
        lid2.rotation.x += ((state.chest2Open ? -1.9 : 0) - lid2.rotation.x) * (1 - Math.exp(-dt * 5));
      });
      return { object: chest2, contents: showChestContents };
    },
    coins({ at: [x, y, z] }) {
      for (let k = 0; k < 16; k++) {
        const s = 0.1 + rand() * 0.06;
        const coin = box(scene, s, s * 0.6, s, M.gold, x + (rand() - 0.5) * 0.6, y + s * 0.3 + (k % 3) * 0.06, z + (rand() - 0.5) * 0.5);
        coin.rotation.y = rand() * 3;
      }
      glow(scene, 0xffb62e, 1.3, 0.08, x, y + 0.2, z);
    },
    banner({ at: [x, y, z] }) {
      box(scene, 0.72, 1.2, 0.05, M.cloth, x, y, z);
      box(scene, 0.26, 0.26, 0.06, M.gold, x, y + 0.15, z + 0.02).rotation.z = Math.PI / 4;
      box(scene, 0.86, 0.08, 0.09, M.woodDark, x, y + 0.63, z + 0.01);
    },
    barrel({ at: [i, j] }) {
      const group = new THREE.Group();
      group.position.set(i, 0, j);
      box(group, 0.58, 0.74, 0.58, M.wood, 0, 0.37, 0);
      box(group, 0.62, 0.08, 0.62, M.iron, 0, 0.18, 0);
      box(group, 0.62, 0.08, 0.62, M.iron, 0, 0.56, 0);
      scene.add(group);
    },
    crates({ at: [i, j] }) {
      box(scene, 0.7, 0.7, 0.7, M.wood, i, 0.35, j);
      box(scene, 0.46, 0.46, 0.46, M.woodDark, i - 0.05, 0.93, j + 0.02).rotation.y = 0.4;
    },
    // Glowing crystals: spikes are [x, z, height, width].
    crystals({ spikes, light, halo }) {
      const crystals = new THREE.Group();
      spikes.forEach(([x, z, h, w]) => {
        const c = box(crystals, w, h, w, M.teal.clone(), x, h / 2, z);
        c.rotation.set((rand() - 0.5) * 0.3, rand() * 1.5, (rand() - 0.5) * 0.3);
      });
      scene.add(crystals);
      const crystalLight = new THREE.PointLight(0x7fd8cf, 3.0, 5, 2);
      crystalLight.position.set(...light);
      scene.add(crystalLight);
      crystalLight.visible = false;
      const crystalHalo = glow(scene, 0x2fe0cc, 3.0, 0.3, ...halo);
      every((t) => {
        crystalLight.intensity = 1.8 + 0.6 * Math.sin(t * 1.1);
        crystalHalo.material.opacity = 0.07 + 0.02 * Math.sin(t * 1.1);
      });
    },
    // The stairs themselves are blocks of the map; here only the daylight that comes down them.
    stairs({ glow: [x, y, z] }) {
      glow(scene, 0xcfe6ff, 2.2, 0.16, x, y, z);
    },

    // ---------- above ground ----------
    well({ x, z }) {                                          // two posts and a little roof over the well
      [-0.38, 0.38].forEach((dx) => box(scene, 0.1, 1.1, 0.1, M.woodDark, x + dx, 1.25, z));
      box(scene, 1.1, 0.12, 0.8, M.wood, x, 1.86, z);
      box(scene, 0.7, 0.1, 0.5, M.woodDark, x, 1.97, z);
      box(scene, 0.06, 0.5, 0.06, M.iron, x, 1.5, z);
    },
    stall({ x, z }) {                                         // a striped awning over the counter
      const stripes = (p) => { for (let k = 0; k < p.w; k++) p.column(k, Math.floor(k / 3) % 2 ? '#efe2c0' : '#c2302e'); p.row(p.h - 1, '#8a2420'); };
      [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]].forEach(([dx, dz]) => box(scene, 0.07, 1.5, 0.07, M.woodDark, x + dx, 0.85, z + dz));
      paintedBox(scene, 1.06, 0.14, 1.06, x, 1.66, z, { all: stripes });
      box(scene, 0.3, 0.16, 0.3, PETALS[1], x - 0.15, 0.68, z + 0.1);
      box(scene, 0.26, 0.14, 0.26, PETALS[0], x + 0.2, 0.67, z - 0.1);
    },
    sign({ x, z }) {
      box(scene, 0.1, 1.0, 0.1, M.woodDark, x, 0.5, z);
      box(scene, 0.7, 0.3, 0.06, M.wood, x, 0.95, z + 0.06);
      box(scene, 0.5, 0.04, 0.02, M.dark, x, 0.99, z + 0.1);
      box(scene, 0.34, 0.04, 0.02, M.dark, x - 0.08, 0.9, z + 0.1);
    },
    lamp({ x, z }) {
      box(scene, 0.1, 1.5, 0.1, M.woodDark, x, 0.75, z);
      box(scene, 0.3, 0.06, 0.3, M.iron, x, 1.52, z);
      box(scene, 0.2, 0.24, 0.2, M.flameCore, x, 1.68, z);
      box(scene, 0.3, 0.06, 0.3, M.iron, x, 1.83, z);
    },
    // The cave door, made like the door in the dungeon, with a torch on each side. It starts open, the hero
    // comes out, it shuts.
    caveDoor({ x, z }) {
      const caveDoor = new THREE.Group();
      caveDoor.position.set(x, -2.1, z + 0.45);
        box(caveDoor, 0.96, 1.94, 0.12, M.woodDark, 0, 0.97, 0);
        box(caveDoor, 0.98, 0.12, 0.16, M.iron, 0, 0.45, 0.02);
        box(caveDoor, 0.98, 0.12, 0.16, M.iron, 0, 1.5, 0.02);
        box(caveDoor, 0.04, 1.94, 0.16, M.dark, 0, 0.97, 0.01);
        box(caveDoor, 0.22, 0.28, 0.1, M.gold, 0.25, 1.0, 0.09);
        scene.add(caveDoor);
      torch(x - 0.72, 1.5, z + 0.55, 0, 1, 0.5);
      torch(x + 0.72, 1.5, z + 0.55, 0, 1, 0.5);
      every((t, dt) => { caveDoor.position.y += ((state.caveDoorOpen ? -2.1 : 0) - caveDoor.position.y) * (1 - Math.exp(-dt * 3)); });
      return { object: caveDoor };
    },
  };

  // Kinds the map places many of, built all at once.
  const fields = {
    // Grass blades and flowers: thousands of tiny boxes, drawn as a few batches. `cells` are the tiles with flowers.
    flowers(cells) {
      const tr = mulberry32(31);
      const blades = [];
      const petals = PETALS.map(() => []);
      for (const [x, z] of cells) {
        for (let k = 0, n = 2 + Math.floor(tr() * 3); k < n; k++) blades.push([x + (tr() - 0.5) * 0.8, z + (tr() - 0.5) * 0.8, 0.05, 0.1 + tr() * 0.14]);
        if (tr() < 0.55) {
          const fx = x + (tr() - 0.5) * 0.6, fz = z + (tr() - 0.5) * 0.6;
          blades.push([fx, fz, 0.04, 0.2]);
          petals[Math.floor(tr() * PETALS.length)].push([fx, fz]);
        }
      }
      const batch = (material, items, place) => {
        if (!items.length) return;
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
        const matrix = new THREE.Matrix4();
        const turn = new THREE.Quaternion();
        items.forEach((it, k) => {
          const { position, scale } = place(it);
          turn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tr() * 1.5);
          mesh.setMatrixAt(k, matrix.compose(position, turn, scale));
        });
        mesh.receiveShadow = true;
        scene.add(mesh);
      };
      batch(M.blade, blades, ([x, z, w, h]) => ({ position: new THREE.Vector3(x, h / 2, z), scale: new THREE.Vector3(w, h, w) }));
      PETALS.forEach((material, k) => batch(material, petals[k], ([x, z]) => ({ position: new THREE.Vector3(x, 0.23, z), scale: new THREE.Vector3(0.11, 0.09, 0.11) })));
    },
  };
  return { build, fields, updates, torches: flickers, falls, torchShadows };
}
