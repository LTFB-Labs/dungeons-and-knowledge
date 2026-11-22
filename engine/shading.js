// @ts-check
// What can be added to a material that takes light (MeshLambertMaterial): a shine on what faces up (wet stone,
// glinting water), big darker and lighter patches that break up a repeating picture, a sway in the wind, and the
// shadows of clouds drifting over. dress() adds the chosen ones to
// the material's shader; a few shared numbers feed them all. At strength 0 the shader skips the work.
import * as THREE from './three.js';

// How far the wind pushes, at a place and a time: a steady lean with gusts, different from place to place.
const WIND = `
vec2 windPush(vec2 at) {
  float beat = uLookTime * 1.7 + at.x * 0.45 + at.y * 0.3;
  float gust = 0.55 + 0.45 * sin(uLookTime * 0.31 + at.x * 0.09 - at.y * 0.06);
  return vec2(0.6 + sin(beat) + 0.3 * sin(beat * 2.3 + 1.7), 0.5 * cos(beat * 0.8 + 0.6)) * gust;
}`;
// What bends, and how much: a tree by its height over the ground; a blade from its root to its tip; a flower
// head as far as the tip of its stalk.
const SWAY = {
  tree: 'lookPos.xz += windPush(lookPos.xz) * (uWind * (clamp(lookPos.y, 0.0, 1.0) * 0.3 + clamp((lookPos.y - 1.0) / 3.0, 0.0, 1.0) * 0.7));',
  tip: 'lookPos.xz += windPush(lookRoot.xz) * (uWind * 0.4 * (position.y + 0.5));',
  whole: 'lookPos.xz += windPush(lookRoot.xz) * (uWind * 0.4);',
};
// In place of three's own <project_vertex>: the same, by way of the place in the world, which the wind may push.
const project = (sway) => `
vec4 lookPos = vec4(transformed, 1.0);
vec4 lookRoot = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  lookPos = instanceMatrix * lookPos;
  lookRoot = instanceMatrix * lookRoot;
#endif
lookPos = modelMatrix * lookPos;
lookRoot = modelMatrix * lookRoot;
${sway ? `if (uWind > 0.0) { ${SWAY[sway]} }` : ''}
vLookPos = lookPos.xyz;
vec4 mvPosition = viewMatrix * lookPos;
gl_Position = projectionMatrix * mvPosition;`;

// Water does not lie still: its normal ripples, and here and there it glints. In steps of a texture pixel.
const RIPPLE = `
    vec2 shineAt = floor(vLookPos.xz * 16.0) / 16.0;
    vec3 shineWave = vec3(sin(shineAt.x * 5.1 + uLookTime * 1.3) + sin(shineAt.y * 7.3 - uLookTime * 1.1), 0.0,
      sin(shineAt.y * 6.1 + uLookTime * 1.6) + sin(shineAt.x * 8.3 + uLookTime * 0.9)) * 0.06;
    shineNormal = normalize(shineNormal + (viewMatrix * vec4(shineWave, 0.0)).xyz);
    shineGlint = 0.35 * pow(saturate(0.5 * (sin(shineAt.x * 3.7 + uLookTime * 0.9) * sin(shineAt.y * 4.9 - uLookTime * 0.7)
      + sin((shineAt.x + shineAt.y) * 2.3 + uLookTime * 0.5))), 5.0);`;
// A highlight from every point light and every sun or moon, only on what faces up, stronger on the light parts
// of the picture. Added to the light the material already gives back.
const shine = (strength, gloss, glint) => `
if (uShine > 0.0) {
  vec3 shineNormal = normal;
  float shineGlint = 0.0;
  if (dot(shineNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)) > 0.7) {${glint ? RIPPLE : ''}
    vec3 shineEye = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
    vec3 shineLight = vec3(0.0);
    #if NUM_POINT_LIGHTS > 0
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
      vec3 shineTo = pointLights[i].position + vViewPosition;
      float shineFar = max(length(shineTo), 0.001);
      float shineReach = pointLights[i].distance;
      float shineFade = shineReach > 0.0 ? pow2(saturate(1.0 - pow4(shineFar / shineReach))) : 1.0;
      shineLight += pointLights[i].color * (shineFade / max(shineFar * shineFar, 0.5))
        * pow(saturate(dot(shineNormal, normalize(shineTo / shineFar + shineEye))), ${gloss.toFixed(1)});
    }
    #endif
    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      shineLight += directionalLights[i].color
        * (pow(saturate(dot(shineNormal, normalize(directionalLights[i].direction + shineEye))), ${gloss.toFixed(1)}) + shineGlint);
    }
    #endif
    outgoingLight += shineLight * (RECIPROCAL_PI * uShine * ${strength.toFixed(2)} * (0.35 + dot(diffuseColor.rgb, vec3(0.6))));
  }
}`;
// Big patches that stay where they are: damp ones darker and a touch cooler, worn ones lighter and a touch
// warmer. Full strength on what faces up, three quarters on the sides.
const PATCHES = `
if (uPatch > 0.0) {
  vec2 patchAt = vLookPos.xz * 0.028 + uPatchSeed;
  float blotch = texture2D(uNoiseMap, patchAt).r * 0.65 + texture2D(uNoiseMap, patchAt * 2.1 + 0.31).r * 0.35 - 0.5;   // not "patch": a reserved word in GLSL ES 3.0
  float patchUp = step(0.7, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
  float patchBy = uPatch * (0.75 + 0.25 * patchUp) * clamp(blotch * 2.4, -1.0, 1.0);
  outgoingLight *= (1.0 + patchBy) * mix(vec3(1.0), patchBy < 0.0 ? vec3(0.94, 1.0, 0.97) : vec3(1.04, 1.0, 0.94), min(1.0, abs(patchBy) * 4.0));
}`;
const CLOUDS = `
if (uCloud > 0.0) {
  vec2 cloudAt = vLookPos.xz * 0.021 + uLookTime * vec2(0.011, 0.006);
  float cloud = texture2D(uNoiseMap, cloudAt).r * 0.65 + texture2D(uNoiseMap, cloudAt * 2.3 + 0.37).r * 0.35;
  outgoingLight *= 1.0 - uCloud * smoothstep(0.42, 0.68, cloud);
}`;

// Soft blotches that repeat cleanly at the edges: where the clouds are, and the patches.
function noiseMap() {
  const SIZE = 64;
  const CELLS = 6;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  let seed = 20231;
  const dice = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const grid = Array.from({ length: CELLS * CELLS }, dice);
  const ease = (t) => t * t * (3 - 2 * t);
  const image = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const fx = (x / SIZE) * CELLS, fy = (y / SIZE) * CELLS;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % CELLS, y1 = (y0 + 1) % CELLS;
    const tx = ease(fx - x0), ty = ease(fy - y0);
    const v = (grid[y0 * CELLS + x0] * (1 - tx) + grid[y0 * CELLS + x1] * tx) * (1 - ty) + (grid[y1 * CELLS + x0] * (1 - tx) + grid[y1 * CELLS + x1] * tx) * ty;
    image.data.set([255 * v, 255 * v, 255 * v, 255], (y * SIZE + x) * 4);
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  return map;
}

/** @param {number} [seed] where the patches lie: the same number, the same patches */
export function createShading(seed = 1) {
  const uniforms = {
    uLookTime: { value: 0 },
    uShine: { value: 0 },
    uWind: { value: 0 },                 // how far a tree top is pushed, in tiles
    uCloud: { value: 0 },                // how much darker it is under a cloud
    uPatch: { value: 0 },                // how much darker or lighter a patch is, at most
    uPatchSeed: { value: new THREE.Vector2(((seed >>> 0) % 977) / 977, ((seed >>> 0) % 613) / 613) },
    uNoiseMap: { value: null },
  };
  /**
   * Adds to a material's shader, after whatever was added to it before.
   * @param {any} material a MeshLambertMaterial
   * @param {object} o
   * @param {number} [o.shine] how strongly what faces up shines (0: not at all)
   * @param {number} [o.gloss] how tight the highlight is
   * @param {boolean} [o.glint] rippling and glinting, as water
   * @param {'tree' | 'tip' | 'whole'} [o.sway] how it bends in the wind (see SWAY); `tip` and `whole` are for unit boxes
   * @param {boolean} [o.clouds] cloud shadows pass over it
   * @param {boolean} [o.patches] it has the big darker and lighter patches
   */
  function dress(material, { shine: strength = 0, gloss = 20, glint = false, sway, clouds = false, patches = false }) {
    if (!strength && !sway && !clouds && !patches) return;
    if (clouds || patches) uniforms.uNoiseMap.value ??= noiseMap();
    const placed = Boolean(sway || clouds || glint || patches);   // the shader needs the place in the world
    const before = material.onBeforeCompile;
    const beforeKey = material.customProgramCacheKey;
    // three.js shares one compiled program per text of onBeforeCompile; each choice here must get its own
    material.customProgramCacheKey = () => `${beforeKey ? beforeKey.call(material) : ''}|dressed ${strength} ${gloss} ${glint} ${sway} ${clouds} ${patches}`;
    material.onBeforeCompile = (shader, renderer) => {
      before?.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      const shared = `${placed ? 'varying vec3 vLookPos;\n' : ''}uniform float uLookTime;`;
      if (placed) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${shared}\nuniform float uWind;${sway ? WIND : ''}`)
          .replace('#include <project_vertex>', project(sway));
      }
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${shared}\nuniform float uShine;\nuniform float uCloud;\nuniform float uPatch;\nuniform vec2 uPatchSeed;\nuniform sampler2D uNoiseMap;`)
        .replace('#include <opaque_fragment>', `${patches ? PATCHES : ''}${strength ? shine(strength, gloss, glint) : ''}${clouds ? CLOUDS : ''}\n#include <opaque_fragment>`);
    };
    material.needsUpdate = true;
  }
  return {
    dress,
    /** Every frame: the time, in seconds. */
    update(t) { uniforms.uLookTime.value = t; },
    /** 0: off; up to 1. */
    setShine(strength) { uniforms.uShine.value = strength; },
    /** 0: off; up to 1: patches up to 60% darker or lighter (at the default 40: about 24%). */
    setPatches(strength) { uniforms.uPatch.value = 0.6 * strength; },
    /** 0: still air and a clear sky; up to 1: trees sway a fifth of a tile, clouds darken the land by almost half. */
    setWind(strength) {
      uniforms.uWind.value = 0.1 * strength;
      uniforms.uCloud.value = 0.45 * strength;
    },
  };
}
