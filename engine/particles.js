// @ts-check
// Small square specks: one kind is one draw call (THREE.Points), whatever their number. Each speck has a place,
// a colour, an age and a lifetime; whoever makes a kind says where a speck is born and how it moves (the game).
import * as THREE from './three.js';

/**
 * @param {any} scene
 * @param {object} o
 * @param {number} o.max the most specks of this kind
 * @param {number} o.size in screen pixels
 * @param {boolean} [o.glow] adds its light to the picture (a speck fades by getting darker); else it is plain paint
 * @param {number} [o.opacity]
 */
export function createParticles(scene, { max, size, glow = true, opacity = 1 }) {
  const place = new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3);
  const colour = new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', place);
  geometry.setAttribute('color', colour);
  geometry.setDrawRange(0, 0);
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity, depthWrite: false,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  const kind = {
    max, shown: 0,
    place: place.array, colour: colour.array,
    age: new Float32Array(max), life: new Float32Array(max),
    /** How many of them are alive and drawn; 0: none, and nothing is drawn. */
    show(count) {
      kind.shown = Math.min(max, count);
      geometry.setDrawRange(0, kind.shown);
      points.visible = kind.shown > 0;
    },
    /** After the places and colours have been changed. */
    flush() { place.needsUpdate = true; colour.needsUpdate = true; },
  };
  return kind;
}
