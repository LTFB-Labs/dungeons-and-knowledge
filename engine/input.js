// @ts-check
// The pointer and the keys.
//   A short press is a tap: the walker goes there, or goes to the thing and uses it; a double tap hurries him.
//   A press that moves drags the map. The wheel (or + and -) zooms a little.
//   ↑ or W walks forward, the way he faces, for as long as it is held; ← → (A, D) turn him an eighth of a turn
//   on the spot, ↓ (S) turns him round; Shift hurries. E uses what he stands next to, the thing in front first.
//   Tab opens and shuts the inventory, Esc ends a close-up. Space (or the right button) shoots towards the pointer.
import { key } from './map.js';

const FORWARD = new Set(['ArrowUp', 'KeyW']);
const TURNS = { ArrowLeft: 1, KeyA: 1, ArrowRight: -1, KeyD: -1, ArrowDown: 4, KeyS: 4 };    // in eighths of a turn

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {any} o.cam from createCamera
 * @param {any} o.walker from createWalker
 * @param {any} o.ui from createInteraction
 * @param {(i: number, j: number) => boolean} o.walkable
 * @param {() => void} o.toggleInventory
 * @param {(angle: number) => void} o.shoot
 * @param {HTMLElement} o.toHero the button that brings a dragged view back to the walker
 */
export function createInput({ canvas, cam, walker, ui, walkable, toggleInventory, shoot, toHero }) {
  const hero = walker.rig.group;
  // One tap is enough: he goes there, or goes to the thing and uses it.
  let lastTap = null;
  function tap(clientX, clientY) {
    if (ui.closeUp) return;
    // The second click of a double click: he is already on his way there, so he hurries.
    const now = performance.now();
    const double = lastTap && now - lastTap.time < 350 && Math.hypot(clientX - lastTap.x, clientY - lastTap.y) < 14;
    lastTap = double ? null : { time: now, x: clientX, y: clientY };
    if (double && walker.walk) { walker.hurry(); return; }
    const hit = ui.pickAt(clientX, clientY);
    if (!hit) return;
    const start = walker.start();

    if (hit.thingId) {
      const thing = ui.things[hit.thingId];
      if (!walker.walk && ui.touches(walker.tile, thing)) { walker.clearSelection(); ui.arrive(hit.thingId); return; }
      const path = ui.touches(start, thing) ? [] : ui.approach(thing, start);
      if (!path) return;
      walker.select(hit.thingId, path, hit.thingId, start);
      walker.go();
      return;
    }

    const tile = hit.tile;
    if (!tile || !walkable(tile.i, tile.j) || (tile.i === start.i && tile.j === start.j)) return;
    const path = walker.findPath(start, tile);
    if (!path) return;
    walker.select(key(tile.i, tile.j), path, null, start);
    walker.go();
  }
  // A short press is a tap. A press that moves drags the map: the view slides, the camera never turns.
  let pressed = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;                                  // the right button shoots
    pressed = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pressed?.dragging) ui.updateHover(e.clientX, e.clientY);
    if (!pressed || ui.closeUp) return;
    if (!pressed.dragging && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) < 10) return;
    pressed.dragging = true;
    ui.unhighlight();
    canvas.classList.add('is-dragging');
    cam.drag(e.clientX - pressed.lastX, e.clientY - pressed.lastY, canvas.clientHeight);
    pressed.lastX = e.clientX;
    pressed.lastY = e.clientY;
    toHero.hidden = false;
  });
  const release = (e) => {
    if (pressed && !pressed.dragging && e.type === 'pointerup') tap(e.clientX, e.clientY);
    pressed = null;
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('wheel', (e) => {                    // the wheel, or a pinch on the trackpad
    e.preventDefault();
    if (!ui.closeUp) cam.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') cam.zoomBy(1.05, Boolean(ui.closeUp));
    if (e.key === '-' || e.key === '_') cam.zoomBy(1 / 1.05, Boolean(ui.closeUp));
  });
  canvas.addEventListener('pointerleave', () => ui.unhighlight());
  canvas.addEventListener('pointercancel', release);
  toHero.addEventListener('click', () => {
    cam.attach();
    toHero.hidden = true;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); toggleInventory(); }
    if (e.key === 'Escape' && ui.closeUp) ui.close();
  });

  let pointer = null;              // where the pointer last was, for Space
  window.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
  const angleTo = (clientX, clientY) => {
    const floor = ui.floorUnder(clientX, clientY);
    return Math.atan2(floor.x - hero.position.x, floor.z - hero.position.z);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || ui.closeUp) return;
    e.preventDefault();
    document.activeElement?.blur?.();                // so Space does not also press a button
    shoot(pointer ? angleTo(pointer.x, pointer.y) : walker.faceGoal ?? hero.rotation.y);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    shoot(angleTo(e.clientX, e.clientY));
  });

  const keysDown = new Set();
  const held = () => {
    walker.keys.forward = keysDown.has('ArrowUp') || keysDown.has('KeyW');
    walker.keys.hurry = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
  };
  window.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Arrow')) e.preventDefault();
    keysDown.add(e.code);
    held();
    if (ui.closeUp) return;
    if (FORWARD.has(e.code)) walker.takeOver();
    if (e.code in TURNS && !e.repeat) walker.turnBy(TURNS[e.code]);
    if (e.code === 'KeyE') ui.useInFront();
  });
  window.addEventListener('keyup', (e) => { keysDown.delete(e.code); held(); });
  window.addEventListener('blur', () => { keysDown.clear(); held(); });
}
