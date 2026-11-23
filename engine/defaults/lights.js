// @ts-check
// The light of a whole map, as kinds a map lists among its things ({ kind: 'caveLight' }). They need code (lights
// that are not at one point, shadows that follow the hero), so they are builders: a game hands LIGHT_KINDS to
// createGame in `kinds`.
import * as THREE from '../three.js';

/** @param {any} stage what a builder in code gets (../things.js) */
export const LIGHT_KINDS = (stage) => ({
  // Under ground: a cold light from above, as of a moon through cracks, so torches and fires stand out warm.
  caveLight() {
    const { scene, every } = stage;
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
      const at = stage.hero?.position;
      if (!at) return;
      const x = Math.round(at.x * 2) / 2;
      const z = Math.round(at.z * 2) / 2;
      moon.position.set(x + 11, 11, z - 3);
      moon.target.position.set(x, 0, z);
    });
  },
});
