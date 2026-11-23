// @ts-check
// The editor's view: flat (no perspective), from straight above or from the side the game looks from (isometric).
// It slides and zooms freely. It is plain sums, so the same code says where a tile is on the screen (project)
// and which tile is under the pointer (cellAt); place() puts a three.js camera where the sums say.

const TILT = Math.atan(Math.SQRT1_2);          // how steeply the isometric view looks down, as in the game
const HALF = 12;                               // from the middle of the screen to its top, in tiles, before zooming
const AXES = {
  // right and up on the screen, and the way from the point looked at towards the camera
  top: { right: [1, 0, 0], up: [0, 0, -1], back: [0, 1, 0] },
  iso: {
    right: [Math.SQRT1_2, 0, -Math.SQRT1_2],
    up: [-Math.sin(TILT) * Math.SQRT1_2, Math.cos(TILT), -Math.sin(TILT) * Math.SQRT1_2],
    back: [Math.cos(TILT) * Math.SQRT1_2, Math.sin(TILT), Math.cos(TILT) * Math.SQRT1_2],
  },
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function createEditorCamera() {
  const cam = {
    /** 'top': from straight above, the rows of the map run across the screen; 'iso': as the game looks at it. */
    mode: 'iso',
    look: [0, 0, 0],
    zoom: 1,
    width: 1, height: 1,                        // of the screen, in pixels
    /** Screen pixels for one tile. */
    get unit() { return (cam.height * cam.zoom) / (HALF * 2); },
    /** Where a point of the world is on the screen: [x, y] in pixels. */
    project(point) {
      const { right, up } = AXES[cam.mode];
      const d = [point[0] - cam.look[0], point[1] - cam.look[1], point[2] - cam.look[2]];
      return [cam.width / 2 + dot(d, right) * cam.unit, cam.height / 2 - dot(d, up) * cam.unit];
    },
    /** The point of the world under a pixel, at the height `y`. */
    pointAt(sx, sy, y = 0) {
      const { right, up, back } = AXES[cam.mode];
      const a = (sx - cam.width / 2) / cam.unit, b = (cam.height / 2 - sy) / cam.unit;
      const from = [0, 1, 2].map((k) => cam.look[k] + right[k] * a + up[k] * b);
      const t = (from[1] - y) / back[1];
      return [from[0] - back[0] * t, y, from[2] - back[2] * t];
    },
    /** The tile under a pixel, at the height `y`: [x, z]. */
    cellAt(sx, sy, y = 0) {
      const [x, , z] = cam.pointAt(sx, sy, y);
      return [Math.round(x), Math.round(z)];
    },
    /** Slides the view by a drag of dx, dy pixels: what was under the pointer stays under it. */
    pan(dx, dy) {
      const a = cam.pointAt(0, 0, cam.look[1]), b = cam.pointAt(dx, dy, cam.look[1]);
      cam.look = [cam.look[0] - (b[0] - a[0]), cam.look[1], cam.look[2] - (b[2] - a[2])];
    },
    /** Zooms by a factor; the point under the pixel stays where it is. */
    zoomAt(factor, sx = cam.width / 2, sy = cam.height / 2) {
      const before = cam.pointAt(sx, sy, cam.look[1]);
      cam.zoom = Math.min(8, Math.max(0.12, cam.zoom * factor));
      const after = cam.pointAt(sx, sy, cam.look[1]);
      cam.look = [cam.look[0] + before[0] - after[0], cam.look[1], cam.look[2] + before[2] - after[2]];
    },
    /** Shows the whole of a rectangle of tiles. */
    frame(x0, z0, x1, z1) {
      cam.look = [(x0 + x1) / 2, 0, (z0 + z1) / 2];
      cam.zoom = 1;
      const corners = [[x0, 0, z0], [x1, 0, z0], [x0, 0, z1], [x1, 0, z1]].map(cam.project);
      const wide = Math.max(...corners.map(([x]) => Math.abs(x - cam.width / 2))) * 2 + cam.unit * 2;
      const tall = Math.max(...corners.map(([, y]) => Math.abs(y - cam.height / 2))) * 2 + cam.unit * 2;
      cam.zoom = Math.min(8, Math.max(0.12, Math.min(cam.width / wide, cam.height / tall)));
    },
    /** Puts a flat three.js camera (OrthographicCamera) where the view is. */
    place(camera) {
      const { up, back } = AXES[cam.mode];
      const half = HALF / cam.zoom;
      const aspect = cam.width / cam.height;
      Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half, near: 0.1, far: 400 });
      camera.position.set(cam.look[0] + back[0] * 120, cam.look[1] + back[1] * 120, cam.look[2] + back[2] * 120);
      camera.up?.set(up[0], up[1], up[2]);
      camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
      camera.updateProjectionMatrix();
    },
  };
  return cam;
}
