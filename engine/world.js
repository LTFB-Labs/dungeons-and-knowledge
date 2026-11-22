// @ts-check
// The world of blocks. A block is { x, level, z, type, top, shade, region, tile, twin }: `level` is the height of
// the middle of its cell, `top` how much of the cell it fills (1 is a whole cube), `tile` the floor tile it is
// tapped as. The blocks become a few meshes, one per texture and region.
import * as THREE from './three.js';
import { key, HOME_REGION } from './map.js';

// Each corner of each face gets darker the more blocks crowd around it: the soft shadow where walls meet the floor.
const CORNER_LIGHT = [0.42, 0.63, 0.83, 1];
const crowd = (side1, side2, corner) => (side1 && side2 ? 0 : 3 - side1 - side2 - corner);

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {any[]} o.blocks
 * @param {{ textures: Record<string, any>, flat: Record<string, number>, sideOf: Record<string, string>, topOf: Record<string, string>, twins: Set<string> }} o.kinds
 *   the kinds of block: a texture and a flat colour for each; which wear another picture on the side or on top;
 *   which come in two pictures (`name` and `nameB`), so a wall is not the same block over and over
 * @param {Record<string, number>} o.light how lit each region is at the start
 * @param {string[]} [o.veiled] regions that fade to black with distance (see fog.js)
 * @param {() => number} o.rand the dice for the second picture of a block that has no `twin` of its own
 */
export function createWorld({ scene, blocks, kinds, light, veiled = [], rand }) {
  const regionLight = { ...light };
  // One material per block texture and region. Textured: the picture. Flat: its average colour.
  // The meshes carry a brightness for every corner, so these use vertex colours.
  const blockMaterials = [];                                   // { material, name, region, flat, map }
  // A veiled region fades out with distance from a point: plain up to the inner radius, then down to black.
  const fogUniforms = { uFogCenter: { value: new THREE.Vector2() }, uFogInner: { value: 1e6 }, uFogOuter: { value: 2e6 } };
  function fogged(material) {
    material.customProgramCacheKey = () => 'fogged';         // three.js shares one compiled program per onBeforeCompile text
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, fogUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFogPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFogPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFogPos;\nuniform vec2 uFogCenter;\nuniform float uFogInner;\nuniform float uFogOuter;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= 1.0 - smoothstep(uFogInner, uFogOuter, distance(vFogPos.xz, uFogCenter));');
    };
    return material;
  }
  function blockMaterial(name, region) {
    let entry = blockMaterials.find((e) => e.name === name && e.region === region);
    if (!entry) {
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, shadowSide: THREE.DoubleSide });
      if (veiled.includes(region)) fogged(material);
      entry = { material, name, region, flat: kinds.flat[name], map: kinds.textures[name] };
      blockMaterials.push(entry);
    }
    return entry.material;
  }

  // Build the blocks as a few meshes. Every side that is not against another block is made: the flat view sees only
  // the top and the sides that face +x and +z, but with perspective a block past the camera shows its other side.
  // An underside is made only for a block that hangs at least a block above the floor (a tree's crown, a roof's
  // edge); the camera never gets lower than that.
  const cells = new Map();
  const cellKey = (x, level, z) => `${x},${level},${z}`;
  blocks.forEach((b) => { b.top ??= 1; cells.set(cellKey(b.x, b.level, b.z), b); });
  const heightAt = (x, level, z) => cells.get(cellKey(x, level, z))?.top ?? 0;      // 0 means empty
  const buckets = new Map();
  function quad(region, texture, corners, normal, uvs, light, shade, tile, cell) {
    const id = `${region}|${texture}`;
    if (!buckets.has(id)) buckets.set(id, { region, texture, position: [], normal: [], uv: [], color: [], index: [], quads: [], cells: [] });
    const bucket = buckets.get(id);
    const first = bucket.position.length / 3;
    corners.forEach((corner, k) => {
      bucket.position.push(...corner);
      bucket.normal.push(...normal);
      bucket.uv.push(...uvs[k]);
      const v = shade * CORNER_LIGHT[light[k]];
      bucket.color.push(v, v, v);
    });
    // Split the square along the brighter diagonal, so a dark corner stays a soft blob.
    if (light[0] + light[2] > light[1] + light[3]) bucket.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    else bucket.index.push(first + 1, first + 2, first + 3, first + 1, first + 3, first);
    bucket.quads.push(tile ?? null);
    bucket.cells.push(cell);
  }

  for (const b of blocks) {
    const { x, level, z, top, shade, tile } = b;
    const region = b.region ?? HOME_REGION;
    const y0 = level - 0.5;
    const y1 = y0 + top;
    const look = (b.twin ?? (kinds.twins.has(b.type) && rand() < 0.5)) ? `${b.type}B` : b.type;
    const sideTexture = kinds.sideOf[b.type] ?? look;
    const topTexture = kinds.topOf[b.type] ?? look;
    const solid = (dx, dy, dz) => (heightAt(x + dx, level + dy, z + dz) > 0.6 ? 1 : 0);
    const sideUv = [[0, 1 - top], [1, 1 - top], [1, 1], [0, 1]];

    if (top < 1 || heightAt(x, level + 1, z) === 0) {                 // the top
      const up = top < 1 ? 0 : 1;                                     // a low block is crowded by its own level
      const over = (dx, dz) => (heightAt(x + dx, level + up, z + dz) > (up ? 0 : top) ? 1 : 0);
      const light = [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([sx, sz]) => crowd(over(sx, 0), over(0, sz), over(sx, sz)));
      quad(region, topTexture, [[x - 0.5, y1, z - 0.5], [x - 0.5, y1, z + 0.5], [x + 0.5, y1, z + 0.5], [x + 0.5, y1, z - 0.5]],
        [0, 1, 0], [[0, 1], [0, 0], [1, 0], [1, 1]], light, shade, tile, key(x, z));
    }
    if (heightAt(x + 1, level, z) < top) {                            // the side that faces +x
      const light = [[-1, 1], [-1, -1], [1, -1], [1, 1]].map(([sy, sz]) => crowd(solid(1, sy, 0), solid(1, 0, sz), solid(1, sy, sz)));
      quad(region, sideTexture, [[x + 0.5, y0, z + 0.5], [x + 0.5, y0, z - 0.5], [x + 0.5, y1, z - 0.5], [x + 0.5, y1, z + 0.5]],
        [1, 0, 0], sideUv, light, shade, tile, key(x, z));
    }
    if (heightAt(x - 1, level, z) < top) {                            // the side that faces -x
      const light = [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([sy, sz]) => crowd(solid(-1, sy, 0), solid(-1, 0, sz), solid(-1, sy, sz)));
      quad(region, sideTexture, [[x - 0.5, y0, z - 0.5], [x - 0.5, y0, z + 0.5], [x - 0.5, y1, z + 0.5], [x - 0.5, y1, z - 0.5]],
        [-1, 0, 0], sideUv, light, shade, tile, key(x, z));
    }
    if (heightAt(x, level, z - 1) < top) {                            // the side that faces -z
      const light = [[1, -1], [-1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => crowd(solid(sx, 0, -1), solid(0, sy, -1), solid(sx, sy, -1)));
      quad(region, sideTexture, [[x + 0.5, y0, z - 0.5], [x - 0.5, y0, z - 0.5], [x - 0.5, y1, z - 0.5], [x + 0.5, y1, z - 0.5]],
        [0, 0, -1], sideUv, light, shade, tile, key(x, z));
    }
    if (level >= 1.5 && heightAt(x, level - 1, z) < 1) {              // the underside
      quad(region, sideTexture, [[x - 0.5, y0, z - 0.5], [x + 0.5, y0, z - 0.5], [x + 0.5, y0, z + 0.5], [x - 0.5, y0, z + 0.5]],
        [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [2, 2, 2, 2], shade, tile, key(x, z));
    }
    if (heightAt(x, level, z + 1) < top) {                            // the side that faces +z
      const light = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => crowd(solid(sx, 0, 1), solid(0, sy, 1), solid(sx, sy, 1)));
      quad(region, sideTexture, [[x - 0.5, y0, z + 0.5], [x + 0.5, y0, z + 0.5], [x + 0.5, y1, z + 0.5], [x - 0.5, y1, z + 0.5]],
        [0, 0, 1], sideUv, light, shade, tile, key(x, z));
    }
  }

  const meshes = [...buckets.values()].map((bucket) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.color, 3));
    geometry.setIndex(bucket.index);
    const mesh = new THREE.Mesh(geometry, blockMaterial(bucket.texture, bucket.region));
    mesh.userData.region = bucket.region;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.quads = bucket.quads;        // which tile each square belongs to, for tapping
    mesh.userData.all = { index: bucket.index, quads: bucket.quads, cells: bucket.cells };
    scene.add(mesh);
    return mesh;
  });

  let textured = false;
  // A part that is not seen is not drawn at all; a part that is only remembered is drawn dim.
  function lightRegions() {
    for (const { material, flat, region } of blockMaterials) material.color.set(textured ? 0xffffff : flat).multiplyScalar(regionLight[region]);
    for (const mesh of meshes) mesh.visible = regionLight[mesh.userData.region] > 0.01;
  }
  function setTextured(on) {
    textured = on;
    for (const { material, map } of blockMaterials) {
      material.map = on ? map : null;
      material.needsUpdate = true;
    }
    lightRegions();
  }
  /** Other pictures for some kinds of block: { kind: texture }. Shown at the next setTextured. */
  function setMaps(maps) {
    for (const entry of blockMaterials) if (maps[entry.name]) entry.map = maps[entry.name];
  }

  return { meshes, materials: blockMaterials, regionLight, fog: fogUniforms, heightAt, lightRegions, setTextured, setMaps,
    get textured() { return textured; } };
}
