// @ts-check
// A view from one fixed side: it never turns. It only slides (after the hero, or under a finger) and zooms
// (a little by the wheel, a lot for a close-up). Flat by default (no perspective); setFov() gives it a little
// perspective instead: a camera far back with a narrow field of view, framed so the middle of the screen
// shows the same as the flat view. setTilt() says how steeply it looks down; it starts as the isometric view.
import * as THREE from './three.js';

export const ISO_TILT = (Math.atan(Math.SQRT1_2) * 180) / Math.PI;      // how steeply the isometric view looks down: 35.26 degrees
const FLAT_DISTANCE = 40;                                               // how far back the flat camera stands
const GROUND_RIGHT = new THREE.Vector3(1, 0, -1).normalize();           // right on the screen, along the floor
const GROUND_UP = new THREE.Vector3(-1, 0, -1).normalize();             // up on the screen, along the floor

/**
 * @param {object} o
 * @param {{ follow?: boolean, home?: number[], room?: { x0: number, x1: number, z0: number, z1: number } }} o.rest
 *   follow: the view goes where the hero goes. Otherwise it rests on `home` and leans after the hero once he
 *   leaves `room`.
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} o.viewBox the part of the map the view may slide over
 */
export function createCamera({ rest, viewBox }) {
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const deep = new THREE.PerspectiveCamera(20, 1, 0.1, 400);
  let camera = flat;
  let halfH = 7.4;                             // half the screen's height, in tiles at the point looked at, before zooming
  const home = new THREE.Vector3(...(rest.home ?? [0, 0.9, 0]));
  const back = new THREE.Vector3();            // from the point looked at towards the camera
  const screenUp = new THREE.Vector3();        // which way is up on the screen, in the world
  let slant = 1;                               // how much shorter a step up the floor looks on the screen
  const cam = {
    get camera() { return camera; },
    viewBox,
    fov: 0,                                    // 0: flat; otherwise the perspective camera's field of view, in degrees
    setFov(degrees) {
      cam.fov = Math.max(0, Math.min(60, degrees));
      camera = cam.fov > 0 ? deep : flat;
      deep.fov = cam.fov || 20;
      deep.updateProjectionMatrix();
    },
    tilt: ISO_TILT,                            // how steeply the camera looks down, in degrees
    /** Looks down more or less steeply, from the same side: 20 is low over the floor, 75 almost from above. */
    setTilt(degrees) {
      cam.tilt = Math.max(15, Math.min(80, degrees));
      const up = THREE.MathUtils.degToRad(cam.tilt);
      const along = Math.cos(up) * Math.SQRT1_2;
      const rise = Math.sin(up) * Math.SQRT1_2;
      back.set(along, Math.sin(up), along);
      screenUp.set(-rise, Math.cos(up), -rise);
      slant = Math.sin(up);
    },
    /** How many tiles it is from the middle of the screen to its top, at the point looked at. */
    get span() { return halfH / cam.zoom; },
    look: home.clone(), lookGoal: home.clone(),
    zoom: 1, zoomGoal: 1,
    userZoom: 1,                               // what the player chose with the wheel
    held: null,                                // where a view dragged by hand stays; null: it follows the hero
    resize(w, h) {
      const aspect = w / h;
      halfH = Math.max(7.4, 8.4 / aspect);
      flat.left = -halfH * aspect; flat.right = halfH * aspect;
      flat.top = halfH; flat.bottom = -halfH;
      flat.updateProjectionMatrix();
      deep.aspect = aspect;
      deep.updateProjectionMatrix();
    },
    clampView(v) {
      v.x = Math.min(viewBox.maxX, Math.max(viewBox.minX, v.x));
      v.z = Math.min(viewBox.maxZ, Math.max(viewBox.minZ, v.z));
      return v;
    },
    /** The wheel zooms a little: down to three quarters, up to 15% closer. */
    zoomBy(factor, held = false) {
      cam.userZoom = Math.min(1.15, Math.max(0.75, cam.userZoom * factor));
      if (!held) cam.zoomGoal = cam.userZoom;
    },
    /** Slides the view by a drag of dx, dy screen pixels; it follows the finger at once, but stays over the map. */
    drag(dx, dy, screenHeight) {
      const unit = screenHeight / ((halfH * 2) / cam.zoom);        // screen pixels for one tile
      move.set(0, 0, 0).addScaledVector(GROUND_RIGHT, -dx / unit).addScaledVector(GROUND_UP, dy / unit / slant);   // the floor is seen at a slant
      cam.clampView(cam.look.add(move));
      cam.held = (cam.held ?? new THREE.Vector3()).copy(cam.look);           // dragged by hand: the view stays here, even when he walks
    },
    /** Back on the hero: the view follows him again. */
    attach() { cam.held = null; },
    /** A close-up: look at `point`, `zoom` times closer; `lift` raises it that share of the screen, to leave room for a sheet below. */
    focus(point, zoom, lift = 0) {
      cam.lookGoal.copy(point);
      cam.zoomGoal = zoom;
      if (lift) cam.lookGoal.addScaledVector(screenUp, -((halfH * 2) / zoom) * lift);
    },
    /** Back from a close-up. */
    release() { cam.zoomGoal = cam.userZoom; },
    /** Every frame. `free`: no close-up is on, so the view goes after the hero. */
    update(dt, hero, free) {
      const { look, lookGoal } = cam;
      if (free && cam.held) lookGoal.copy(cam.held);                           // dragged away: it stays where it was put
      else if (free) {
        if (rest.follow) lookGoal.set(hero.x, 0.9, hero.z);                    // a big world scrolls with the hero
        else {
          const out = Math.min(1, farness(hero.x, hero.z) / 3) * 0.8;
          lookGoal.set(home.x + (hero.x - home.x) * out, home.y, home.z + (hero.z - home.z) * out);
        }
        cam.clampView(lookGoal);
      }
      const ease = 1 - Math.exp(-dt * 4.5);
      look.lerp(lookGoal, ease);
      cam.zoom += (cam.zoomGoal - cam.zoom) * ease;
      if (camera === flat) {
        flat.zoom = cam.zoom;
        flat.position.copy(look).addScaledVector(back, FLAT_DISTANCE);
        flat.updateProjectionMatrix();
      } else {
        // as far back as it takes for the point looked at to fill the screen as in the flat view
        const away = (halfH / cam.zoom) / Math.tan(THREE.MathUtils.degToRad(deep.fov / 2));
        deep.position.copy(look).addScaledVector(back, away);
        deep.near = Math.max(0.1, away - 60);
        deep.far = away + 120;
        deep.updateProjectionMatrix();
      }
      camera.lookAt(look);
    },
  };
  const move = new THREE.Vector3();
  const kept = new THREE.Vector3();
  const room = rest.room;
  const farness = (x, z) => Math.hypot(Math.max(0, room.x0 - x, x - room.x1), Math.max(0, room.z0 - z, z - room.z1));
  cam.setTilt(ISO_TILT);
  return cam;
}
