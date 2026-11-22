// @ts-check
// Everything that is not a block of the world is made of plain boxes: one material each, lit or glowing.
import * as THREE from './three.js';
import { softDot } from './textures.js';

const texturable = [];          // [material, texture]: lit materials that can wear a grey 16px texture
/** A material that takes light. With `texture` it wears it whenever textures are on (see textureBoxes). */
export function lit(color, texture) {
  const m = new THREE.MeshLambertMaterial({ color });
  if (texture) texturable.push([m, texture]);
  return m;
}
/** A material that shines by itself. */
export const glowing = (color) => new THREE.MeshBasicMaterial({ color });
/** Puts the textures of all lit materials on, or takes them off (flat colour). */
export function textureBoxes(on) {
  for (const [material, texture] of texturable) {
    material.map = on ? texture : null;
    material.needsUpdate = true;
  }
}

// A box whose texture keeps 16 pixels per tile whatever its size.
export function boxGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const k = f * 4 + v;
    uv.setXY(k, uv.getX(k) * faces[f][0], uv.getY(k) * faces[f][1]);
  }
  return g;
}
export function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  const isLit = material.isMeshLambertMaterial;
  mesh.castShadow = isLit;
  mesh.receiveShadow = isLit;
  parent.add(mesh);
  return mesh;
}

let dot = null;
/** A soft glow that always faces the camera. */
export function glow(parent, color, size, opacity, x = 0, y = 0, z = 0) {
  dot ??= softDot();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dot, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.scale.setScalar(size);
  sprite.position.set(x, y, z);
  parent.add(sprite);
  return sprite;
}
