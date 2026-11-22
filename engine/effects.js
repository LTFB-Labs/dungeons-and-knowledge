// @ts-check
// What is done to the whole picture: a depth of field (sharp at the distance the camera looks at, blurred nearer
// and farther, bright things glowing a little) and a pool of light round one point of the floor.
// Both are off at strength 0, and then cost nothing: the focus makes no passes and keeps no textures, the pool
// is not drawn.
import * as THREE from './three.js';

const WHOLE_SCREEN = 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n  gl_Position = vec4(position.xy, 0.0, 1.0);\n}';
const pass = (uniforms, fragmentShader) => new THREE.ShaderMaterial({
  uniforms, vertexShader: WHOLE_SCREEN, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending,
});

/**
 * The depth of field. The scene is drawn to the screen as always; then the finished picture is copied, the scene
 * is drawn once more at half the size only for its depth, a small blurred copy and a small copy of only the
 * bright parts are made of the picture (five passes at a quarter of the size), and one pass over the screen mixes
 * them back in: the further a pixel's depth is from the distance in focus, the more of the blurred copy it gets.
 * The picture keeps its see-through parts (where there is nothing, it stays as it is), so whatever lies behind
 * the canvas still shows.
 * @param {any} renderer
 */
export function createFocus(renderer) {
  const size = new THREE.Vector2();
  const corner = new THREE.Vector2(0, 0);
  const eye = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), undefined);
  sheet.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(sheet);

  let picture = null;              // the finished picture, at full size
  let small = null;                // three targets at a quarter of the size
  let depth = null;                // the scene's depth, at half the size
  const shrink = pass({ uMap: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
    uniform sampler2D uMap;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      gl_FragColor = 0.25 * (texture2D(uMap, vUv + uTexel * vec2(-1.0, -1.0)) + texture2D(uMap, vUv + uTexel * vec2(1.0, -1.0))
        + texture2D(uMap, vUv + uTexel * vec2(-1.0, 1.0)) + texture2D(uMap, vUv + uTexel * vec2(1.0, 1.0)));
    }`);
  // One direction of a soft blur. With uCut it keeps only what is brighter than that: the part that glows.
  const blur = pass({ uMap: { value: null }, uStep: { value: new THREE.Vector2() }, uCut: { value: 0 } }, `
    uniform sampler2D uMap;
    uniform vec2 uStep;
    uniform float uCut;
    varying vec2 vUv;
    vec4 tap(vec2 at) {
      vec4 c = texture2D(uMap, at);
      if (uCut > 0.0) c.rgb *= smoothstep(uCut, 1.0, 0.5 * max(c.r, max(c.g, c.b)) + 0.5 * dot(c.rgb, vec3(0.3, 0.5, 0.2)));
      return c;
    }
    void main() {
      gl_FragColor = tap(vUv) * 0.227027
        + (tap(vUv + uStep * 1.384615) + tap(vUv - uStep * 1.384615)) * 0.316216
        + (tap(vUv + uStep * 3.230769) + tap(vUv - uStep * 3.230769)) * 0.070270;
    }`);
  const mix = pass({
    uSharp: { value: null }, uSoft: { value: null }, uGlow: { value: null },
    uDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, uFlat: { value: 1 },
    uFocus: { value: 10 }, uSpan: { value: 10 }, uMix: { value: 0 }, uGlowMix: { value: 0 },
  }, `
    uniform sampler2D uDepth;
    uniform float uNear;
    uniform float uFar;
    uniform float uFlat;
    uniform float uFocus;
    uniform float uSpan;
    uniform sampler2D uSharp;
    uniform sampler2D uSoft;
    uniform sampler2D uGlow;
    uniform float uMix;
    uniform float uGlowMix;
    varying vec2 vUv;
    void main() {
      float d = texture2D(uDepth, vUv).x;
      float away = uFlat > 0.5 ? uNear + d * (uFar - uNear) : uNear * uFar / (uFar - d * (uFar - uNear));     // how far from the camera
      float off = (away - uFocus) / uSpan;                     // past the distance in focus (or, below 0, short of it)
      float soft = off > 0.0 ? smoothstep(0.25, 0.9, off) : smoothstep(0.25, 0.7, -off);
      if (d > 0.99999) soft = 0.0;                             // nothing there: the canvas is see-through
      vec4 c = mix(texture2D(uSharp, vUv), texture2D(uSoft, vUv), soft * uMix);
      vec3 glow = texture2D(uGlow, vUv).rgb * uGlowMix;
      c.rgb += glow;
      c.a = min(1.0, c.a + max(glow.r, max(glow.g, glow.b)));
      gl_FragColor = c;
    }`);

  function release() {
    picture?.dispose();
    small?.forEach((target) => target.dispose());
    depth?.depthTexture.dispose();
    depth?.dispose();
    picture = small = depth = null;
  }
  // The copies are as big as the canvas; made when first needed, and again when the canvas changes size.
  function fit() {
    renderer.getDrawingBufferSize(size);
    if (picture && picture.image.width === size.x && picture.image.height === size.y) return;
    release();
    picture = new THREE.FramebufferTexture(size.x, size.y);
    picture.minFilter = picture.magFilter = THREE.LinearFilter;
    const w = Math.ceil(size.x / 4);
    const h = Math.ceil(size.y / 4);
    small = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }));
    depth = new THREE.WebGLRenderTarget(Math.ceil(size.x / 2), Math.ceil(size.y / 2), { depthTexture: new THREE.DepthTexture(Math.ceil(size.x / 2), Math.ceil(size.y / 2)) });
    shrink.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
  }
  function draw(material, from, to) {
    material.uniforms.uMap.value = from;
    sheet.material = material;
    renderer.setRenderTarget(to);
    renderer.render(stage, eye);
  }

  const focus = {
    strength: 0,
    /** 0: off. Up to 1: a wider and fuller blur, a little more glow. */
    set(strength) {
      focus.strength = Math.max(0, Math.min(1, strength));
      if (!focus.strength) release();
    },
    /**
     * After the scene has been drawn to the screen with `camera`. `distance`: how far from the camera it is sharp
     * (the point the camera looks at); `span`: how many tiles nearer or farther than that count as a screenful:
     * a quarter of it stays sharp, and by 0.7 of it nearer or 0.9 farther the blur is full.
     */
    render(scene, camera, distance, span) {
      const s = focus.strength;
      if (!s) return;
      fit();
      const a = small[0], b = small[1], c = small[2];
      renderer.copyFramebufferToTexture(corner, picture);
      const shadows = renderer.shadowMap.autoUpdate;         // the shadows were drawn for this frame already
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(depth);
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = shadows;
      draw(shrink, picture, a);
      const reach = 0.6 + 1.2 * s;
      blur.uniforms.uCut.value = 0;
      blur.uniforms.uStep.value.set(reach / a.width, 0);
      draw(blur, a.texture, b);
      blur.uniforms.uStep.value.set(0, reach / a.height);
      draw(blur, b.texture, c);                              // c: the blurred picture
      blur.uniforms.uCut.value = 0.75;
      blur.uniforms.uStep.value.set(1.6 / a.width, 0);
      draw(blur, a.texture, b);
      blur.uniforms.uCut.value = 0;
      blur.uniforms.uStep.value.set(0, 1.6 / a.height);
      draw(blur, b.texture, a);                              // a: the glow of the bright parts
      mix.uniforms.uSharp.value = picture;
      mix.uniforms.uSoft.value = c.texture;
      mix.uniforms.uGlow.value = a.texture;
      mix.uniforms.uDepth.value = depth.depthTexture;
      mix.uniforms.uNear.value = camera.near;
      mix.uniforms.uFar.value = camera.far;
      mix.uniforms.uFlat.value = camera.isOrthographicCamera ? 1 : 0;
      mix.uniforms.uFocus.value = distance;
      mix.uniforms.uSpan.value = span;
      mix.uniforms.uMix.value = Math.min(1, s * 2.5);
      mix.uniforms.uGlowMix.value = 0.5 * s;
      sheet.material = mix;
      renderer.setRenderTarget(null);
      renderer.autoClear = false;                            // over the picture that is already there
      renderer.render(stage, eye);
      renderer.autoClear = true;
    },
  };
  return focus;
}

/**
 * The pool of light: one sheet over the whole screen, drawn last with the scene, that darkens every pixel by how
 * far from `at` its spot on the floor is. No extra pass; while the strength is 0 it is not drawn.
 * @param {any} scene
 */
export function createLightPool(scene) {
  const uniforms = { uAt: { value: new THREE.Vector3() }, uDark: { value: 0 }, uInner: { value: 7 }, uOuter: { value: 13 } };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    // the picture is multiplied by what the sheet says, and where it is see-through it gets as much less so
    blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `
      varying vec3 vNear;
      varying vec3 vFar;
      void main() {
        mat4 toWorld = inverse(projectionMatrix * viewMatrix);
        vec4 front = toWorld * vec4(position.xy, -1.0, 1.0);
        vec4 rear = toWorld * vec4(position.xy, 1.0, 1.0);
        vNear = front.xyz / front.w;
        vFar = rear.xyz / rear.w;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uAt;
      uniform float uDark;
      uniform float uInner;
      uniform float uOuter;
      varying vec3 vNear;
      varying vec3 vFar;
      void main() {
        vec3 ray = vFar - vNear;
        float away = uOuter;                                   // a ray that never comes down to the floor is far away
        if (ray.y < -0.0001) away = distance((vNear + ray * ((uAt.y - vNear.y) / ray.y)).xz, uAt.xz);
        float keep = 1.0 - uDark * smoothstep(uInner, uOuter, away);
        gl_FragColor = vec4(vec3(keep), 1.0 - keep);
      }`,
  }));
  sheet.frustumCulled = false;
  sheet.renderOrder = 900;                                     // after everything else in the scene
  sheet.visible = false;
  scene.add(sheet);
  return {
    /** Where the middle of the pool is: a point on the floor. */
    at: uniforms.uAt.value,
    /** 0: off. Up to 1: darker outside, and a tighter pool. */
    set(strength) {
      const s = Math.max(0, Math.min(1, strength));
      sheet.visible = s > 0;
      uniforms.uDark.value = 0.85 * s;
      uniforms.uInner.value = 7 - 4 * s;
      uniforms.uOuter.value = 13 - 6 * s;
    },
  };
}
