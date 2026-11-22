// @ts-check
// Characters are a few plain boxes with all the detail painted on as pixels, the block-game way.
// Here: the painter of such boxes, skins for them, and the rig of a person who walks.
import * as THREE from './three.js';
import { mulberry32 } from './random.js';

export const FACES = ['right', 'left', 'top', 'bottom', 'front', 'back'];
// Where each face of a box W x H x D (in pixels) lies on a skin sheet, unfolded as in a Minecraft skin.
const UNFOLD = (W, H, D) => ({ top: [D, 0], bottom: [D + W, 0], right: [0, D], front: [D, D], left: [D + W, D], back: [2 * D + W, D] });

/**
 * Makes `paintedBox(parent, w, h, d, x, y, z, paint)`: a box with a small painted grid on each face.
 * `paint` maps a side name to a painter; `all` covers the sides it does not name. A painter gets `g`:
 * g.w, g.h, g.r (its own dice), rect, px, row, column, speckle, and shine (a pixel that glows by itself).
 * All six faces are painted side by side on one small sheet, so the box is one drawing, not six.
 * `paint.skin` ({ image, x, y, scale }) takes the faces from a skin sheet instead: the box unfolded, its
 * top-left corner at x, y, `scale` sheet pixels for every box pixel.
 * @param {{ pixels?: number, seed?: number }} [o] pixels: painted pixels per tile of box size; seed: of the first face
 */
export function createPainter({ pixels = 20, seed = 500 } = {}) {
  const CHAR_PX = pixels;
  let faceSeed = seed;
  function paintedBox(parent, w, h, d, x, y, z, paint) {
    const size = { right: [d, h], left: [d, h], top: [w, d], bottom: [w, d], front: [w, h], back: [w, h] };
    const skinned = paint.skin;
    const perUnit = CHAR_PX * (skinned?.scale ?? 1);
    const px = FACES.map((side) => size[side].map((units) => Math.max(1, Math.round(units * perUnit))));
    const unfold = UNFOLD(px[4][0], px[4][1], px[0][0]);
    const cellW = Math.max(...px.map((f) => f[0])) + 2;            // a pixel of margin round every face
    const cellH = Math.max(...px.map((f) => f[1])) + 2;
    const sheet = () => { const c = document.createElement('canvas'); c.width = cellW * 6; c.height = cellH; return c; };
    const colour = sheet();
    const light = sheet();                                        // only the pixels that shine by themselves
    const ctx = colour.getContext('2d');
    const lit = light.getContext('2d');
    lit.fillStyle = '#000000';
    lit.fillRect(0, 0, light.width, light.height);
    let shines = false;
    FACES.forEach((side, f) => {
      const [fw, fh] = px[f];
      const ox = f * cellW + 1;
      const oy = 1;
      for (const c of [ctx, lit]) { c.save(); c.beginPath(); c.rect(ox, oy, fw, fh); c.clip(); }      // a painter cannot spill onto the next face
      const g = {
        w: fw, h: fh, r: mulberry32(faceSeed++),
        rect(gx, gy, rw, rh, c) { ctx.fillStyle = c; ctx.fillRect(ox + gx, oy + gy, rw, rh); },
        px(gx, gy, c) { g.rect(gx, gy, 1, 1, c); },
        row(gy, c) { g.rect(0, gy, fw, 1, c); },
        column(gx, c) { g.rect(gx, 0, 1, fh, c); },
        speckle(c, share) { for (let k = 0; k < fw * fh * share; k++) g.px(Math.floor(g.r() * fw), Math.floor(g.r() * fh), c); },
        shine(gx, gy, c) { g.px(gx, gy, c); lit.fillStyle = c; lit.fillRect(ox + gx, oy + gy, 1, 1); shines = true; },
      };
      if (skinned) ctx.drawImage(skinned.image, skinned.x * skinned.scale + unfold[side][0], skinned.y * skinned.scale + unfold[side][1], fw, fh, ox, oy, fw, fh);
      else (paint[side] ?? paint.all)(g);
      ctx.restore();
      lit.restore();
      for (const [c, canvas] of [[ctx, colour], [lit, light]]) {  // stretch the edge pixels into the margin
        c.drawImage(canvas, ox, oy, fw, 1, ox, oy - 1, fw, 1);
        c.drawImage(canvas, ox, oy + fh - 1, fw, 1, ox, oy + fh, fw, 1);
        c.drawImage(canvas, ox, oy - 1, 1, fh + 2, ox - 1, oy - 1, 1, fh + 2);
        c.drawImage(canvas, ox + fw - 1, oy - 1, 1, fh + 2, ox + fw, oy - 1, 1, fh + 2);
      }
    });
    const texture = (canvas) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const material = new THREE.MeshLambertMaterial({ map: texture(colour) });
    if (shines) { material.emissiveMap = texture(light); material.emissive.set(0xffffff); material.emissiveIntensity = 0.85; }
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {     // point each face at its own part of the sheet
      const k = f * 4 + v;
      uv.setXY(k, (f * cellW + 1 + uv.getX(k) * px[f][0]) / (cellW * 6), 1 - (1 + (1 - uv.getY(k)) * px[f][1]) / cellH);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.sheet = { canvas: colour, cellW, px, unfold };      // for exporting a skin
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  return paintedBox;
}

/** A skin: `url` is its layout ({ image, scale, parts: { name: [x, y] } }), the sheet lies next to it. Null if it is not there. */
export async function loadSkin(url) {
  try {
    const layout = await (await fetch(url)).json();
    const image = new Image();
    image.src = new URL(layout.image, url).href;
    await image.decode();
    return { layout, image };
  } catch { return null; }
}

/**
 * A person of 21 boxes: legs that turn at the hip and bend at the knee and the ankle, arms that turn at the
 * shoulder and bend at the elbow, a head with hair. Clothes are not part of him: `worn(id, joint, build)` adds
 * boxes over a joint that show only while the item `id` is worn (see `dress`).
 * @param {object} o
 * @param {Function} o.paintedBox from createPainter
 * @param {Record<string, any>} o.looks how each box is painted: thigh, shin, ankle, foot, shorts, torso, neck,
 *   upper, fore, hand, head, hairTop, hairBack, hairFringe
 * @param {any} [o.skin] from loadSkin: the named boxes take their faces from it instead
 * @param {number} o.stepSeconds the time to walk one tile
 */
export function createRig({ paintedBox, looks, skin = null, stepSeconds }) {
  const skinParts = [];            // the named boxes, in the order they are made
  // One box of the person. With a `name` and a skin that has it, the skin paints it.
  const piece = (parent, w, h, d, x, y, z, paint) => {
    const at = paint.name && skin?.layout.parts[paint.name];
    const mesh = paintedBox(parent, w, h, d, x, y, z, at ? { skin: { image: skin.image, x: at[0], y: at[1], scale: skin.layout.scale ?? 1 } } : paint);
    if (paint.name) skinParts.push({ name: paint.name, mesh, size: [w, h, d] });
    return mesh;
  };
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const outfit = {};                        // item id -> the groups that are shown while it is worn
  const mirrors = [];                       // the same groups on copies of him (the faded one that shows where he will arrive)
  function worn(id, parent, build) {
    const g = new THREE.Group();
    g.userData.outfit = id;
    parent.add(g);
    build(g);
    (outfit[id] ??= []).push(g);
    return g;
  }
  /** Shows the clothes whose ids are in `on`, hides the rest. */
  function dress(on) {
    for (const list of Object.values(outfit)) for (const g of list) g.visible = on.has(g.userData.outfit);
    for (const g of mirrors) g.visible = on.has(g.userData.outfit);
  }

  // Legs: thigh, shin and foot.
  const legs = [-1, 1].map((side) => {
    const S = side > 0 ? 'R' : 'L';
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.52, 0);
    piece(hip, 0.15, 0.24, 0.17, 0, -0.12, 0, { name: `leg${S}.thigh`, ...looks.thigh });
    const knee = new THREE.Group();
    knee.position.y = -0.24;
    hip.add(knee);
    piece(knee, 0.13, 0.17, 0.15, 0, -0.085, 0, { name: `leg${S}.shin`, ...looks.shin });
    const ankle = new THREE.Group();                 // the foot turns here: toes up as it lands, down as it pushes off
    ankle.position.set(0, -0.15, 0);
    knee.add(ankle);
    piece(ankle, 0.12, 0.08, 0.13, 0, -0.03, 0, { name: `leg${S}.ankle`, ...looks.ankle });
    piece(ankle, 0.14, 0.07, 0.23, 0, -0.095, 0.03, { name: `leg${S}.foot`, ...looks.foot });
    body.add(hip);
    return { hip, knee, ankle };
  });
  piece(body, 0.4, 0.1, 0.22, 0, 0.56, 0, { name: 'shorts', ...looks.shorts });
  piece(body, 0.39, 0.37, 0.2, 0, 0.795, 0, { name: 'torso', ...looks.torso });
  piece(body, 0.16, 0.08, 0.14, 0, 1.02, 0, { name: 'neck', ...looks.neck });
  // Arms: the upper arm, the forearm and the hand. arms[1] is the right one.
  const arms = [-1, 1].map((side) => {
    const S = side > 0 ? 'R' : 'L';
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 0.94, 0);
    piece(shoulder, 0.13, 0.21, 0.15, 0, -0.135, 0, { name: `arm${S}.upper`, ...looks.upper });
    const elbow = new THREE.Group();
    elbow.position.y = -0.23;
    shoulder.add(elbow);
    piece(elbow, 0.12, 0.17, 0.14, 0, -0.08, 0, { name: `arm${S}.fore`, ...looks.fore });
    piece(elbow, 0.13, 0.1, 0.14, 0, -0.21, 0, { name: `arm${S}.hand`, ...looks.hand });
    body.add(shoulder);
    return { shoulder, elbow };
  });
  // The head, with the hair as its own pieces: a cap, the back, and a fringe.
  const head = new THREE.Group();
  head.position.y = 1.05;
  piece(head, 0.38, 0.36, 0.36, 0, 0.18, 0, { name: 'head', ...looks.head });
  piece(head, 0.42, 0.12, 0.4, 0, 0.37, -0.01, { name: 'hair.top', ...looks.hairTop });
  piece(head, 0.42, 0.26, 0.1, 0, 0.2, -0.17, { name: 'hair.back', ...looks.hairBack });
  piece(head, 0.26, 0.08, 0.05, -0.07, 0.28, 0.19, { name: 'hair.fringe', ...looks.hairFringe });
  body.add(head);

  let stride = 0;                 // where the legs are in their swing
  let gait = 0;                   // 0 standing, 1 walking; eases between the two so nothing snaps
  let castTime = 0;               // seconds left of raising an arm to shoot
  let castFull = 1;
  let castArm = 1;                // which arm
  const loose = [];               // (gait, s, stride) => {}: loose things that follow a moment late (a cloak, a pack)

  /** Raises an arm (0 left, 1 right) to point ahead for `seconds`. */
  function cast(arm, seconds) { castArm = arm; castTime = seconds; castFull = seconds; }

  // The whole pose, every frame: a walk blended with standing still.
  function pose(dt, t, walking, pace = 1) {
    gait += ((walking ? 1 : 0) - gait) * (1 - Math.exp(-dt * 10));
    if (walking) stride += dt * Math.PI * 2 * (0.933 / stepSeconds) * pace;         // about two steps for every tile
    const s = Math.sin(stride);
    const c = Math.cos(stride);
    const rest = 1 - gait;
    const breath = Math.sin(t * 2.2);

    legs.forEach((leg, k) => {
      const swing = k === 0 ? s : -s;                    // the two legs are half a stride apart
      const lifting = Math.max(0, k === 0 ? c : -c);     // this leg is in the air, coming forward
      const landing = Math.max(0, swing) ** 2 * (1 - lifting);       // it has just come down in front
      leg.hip.rotation.x = -(0.5 * swing + 0.08) * gait;             // reaches a little further forward than back
      leg.knee.rotation.x = (0.06 + 0.95 * lifting ** 1.2 + 0.16 * landing) * gait;    // bends in the air, gives a little on landing
      // The foot: toes up as the heel comes down, toes down as it pushes off, hanging loose in the air.
      leg.ankle.rotation.x = (-0.32 * Math.max(0, swing) + 0.42 * Math.max(0, -swing) + 0.25 * lifting) * gait;
    });
    // Arms swing against the legs. The elbow bends more as the arm comes forward, and the arm rolls out a little going back.
    arms[0].shoulder.rotation.x = 0.44 * s * gait + breath * 0.04 * rest;
    arms[0].shoulder.rotation.z = -0.07 * Math.max(0, s) * gait;
    arms[0].elbow.rotation.x = -(0.16 + 0.36 * Math.max(0, -s)) * gait - 0.06 * rest;
    // The right arm is held forward and steady, with only a small swing, ready to carry a torch.
    arms[1].shoulder.rotation.x = (-0.3 - 0.12 * s) * gait + (-0.22 + breath * 0.03) * rest;
    arms[1].elbow.rotation.x = -0.38 * gait - 0.22 * rest;
    // Casting: the arm comes up and points ahead, then drops back.
    castTime = Math.max(0, castTime - dt);
    if (castTime > 0) {
      const k = Math.sin((1 - castTime / castFull) * Math.PI);
      const arm = arms[castArm];
      arm.shoulder.rotation.x += (-1.45 - arm.shoulder.rotation.x) * k;
      arm.elbow.rotation.x *= 1 - k;
    }

    // The body rises over each planted foot, leans into the walk, shifts its weight from side to side,
    // and turns a little with each step: the hips lead, the head stays looking ahead.
    const twist = 0.09 * s * gait;
    body.position.y = (0.024 * Math.cos(stride * 2) - 0.014) * gait;
    body.rotation.set(0.075 * gait, twist, 0.04 * s * gait);
    body.scale.set(1, 1 + breath * 0.012 * rest, 1);
    head.rotation.x = (-0.055 - 0.03 * Math.cos(stride * 2)) * gait;
    head.rotation.y = -twist + Math.sin(t * 0.7) * 0.35 * rest;
    head.rotation.z = -0.04 * s * gait;
    for (let k = 0; k < loose.length; k++) loose[k](gait, s, stride);
  }

  // Lays the named boxes out on one sheet, row after row.
  function skinLayout() {
    const WIDTH = 64;
    const parts = {};
    let x = 0, y = 0, rowH = 0;
    for (const part of skinParts) {
      const [W, H] = part.mesh.userData.sheet.px[4];
      const D = part.mesh.userData.sheet.px[0][0];
      const bw = 2 * D + 2 * W, bh = D + H;
      if (x + bw > WIDTH) { x = 0; y += rowH + 1; rowH = 0; }
      parts[part.name] = [x, y, bw, bh];
      x += bw + 1;
      rowH = Math.max(rowH, bh);
    }
    return { width: WIDTH, height: y + rowH, parts };
  }
  /** The current look as a skin, to hand to an artist: layout() for the json, sheet() and guide() as PNG data URLs. */
  const skinTools = {
    layout() {
      const { width, height, parts } = skinLayout();
      return { image: 'hero.png', scale: 1, size: [width, height], parts: Object.fromEntries(Object.entries(parts).map(([n, [x, y]]) => [n, [x, y]])) };
    },
    sheet(zoom = 1, guide = false) {
      const { width, height, parts } = skinLayout();
      const canvas = document.createElement('canvas');
      canvas.width = width * zoom;
      canvas.height = height * zoom;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (const part of skinParts) {
        const { canvas: src, cellW, px, unfold } = part.mesh.userData.sheet;
        const [ox, oy] = parts[part.name];
        FACES.forEach((side, f) => {
          const [fw, fh] = px[f];
          ctx.drawImage(src, f * cellW + 1, 1, fw, fh, (ox + unfold[side][0]) * zoom, (oy + unfold[side][1]) * zoom, fw * zoom, fh * zoom);
          if (!guide) return;
          ctx.strokeStyle = 'rgba(255, 0, 140, .9)';
          ctx.lineWidth = 1;
          ctx.strokeRect((ox + unfold[side][0]) * zoom + 0.5, (oy + unfold[side][1]) * zoom + 0.5, fw * zoom - 1, fh * zoom - 1);
          ctx.fillStyle = '#000';
          ctx.font = `${Math.max(9, zoom * 1.4)}px sans-serif`;
          ctx.fillText(side[0].toUpperCase() + side.slice(1, 2), (ox + unfold[side][0]) * zoom + 2, (oy + unfold[side][1]) * zoom + Math.max(10, zoom * 1.6));
        });
        if (guide) {
          ctx.fillStyle = '#0b3d91';
          ctx.font = `bold ${Math.max(10, zoom * 1.6)}px sans-serif`;
          ctx.fillText(part.name, ox * zoom + 2, (oy + parts[part.name][3]) * zoom - 3);
        }
      }
      return canvas.toDataURL('image/png');
    },
    guide(zoom = 12) { return skinTools.sheet(zoom, true); },
  };
  return { group, body, head, legs, arms, piece, worn, dress, outfit, mirrors, loose, pose, cast, skinParts, skinTools };
}
