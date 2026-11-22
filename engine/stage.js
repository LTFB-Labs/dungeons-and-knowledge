// @ts-check
// The renderer and the scene: soft shadows, filmic tones, a see-through background (the backdrop is another canvas).
import * as THREE from './three.js';

/** @param {HTMLCanvasElement} canvas */
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true });      // the stencil: for the hero's outline through walls
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));       // sharp enough for pixel art, and far less to draw
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  return { renderer, scene: new THREE.Scene() };
}
