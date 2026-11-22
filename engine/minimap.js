// @ts-check
// A small map in a corner, drawn from the map's data (not from the 3D scene) on a 2D canvas. It is turned like the
// view (up on it is up on the screen), centred on the walker and moves with him. Only what has been seen is on
// it. The tiles are painted on a hidden sheet, again only when what is seen changes; the canvas itself is redrawn
// (the sheet, the marks, the arrow) only when the walker has moved or turned.

const CELL = 4;                      // pixels of the hidden sheet for one tile
const HALF = Math.SQRT1_2;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {any} o.level from loadMap
 * @param {(column: { x: number, z: number, type: string, height: number, walk: boolean, road: boolean }) => string} o.colour
 *   the colour of a tile, from the block on top of its column: its kind, how high its top is, whether it is walked on
 * @param {(x: number, z: number) => boolean} o.seen has this tile been seen?
 * @param {(x: number, z: number) => boolean} o.dim is it only remembered (drawn dimmer)?
 * @param {{ x: number, z: number, colour: string, shown?: () => boolean }[]} [o.marks] small squares for the things that can be used
 * @param {number} [o.size] the side of the canvas on the page, in CSS pixels
 * @param {number} [o.tile] the size of one tile on it, in CSS pixels
 */
export function createMinimap({ canvas, level, colour, seen, dim, marks = [], size = 180, tile = 5 }) {
  const tops = new Map();            // "x,z" -> the highest block of the column
  for (const b of level.blocks) {
    const id = `${b.x},${b.z}`;
    if (!tops.has(id) || tops.get(id).level < b.level) tops.set(id, b);
  }
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const tiles = [...tops.entries()].map(([id, b]) => {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x); minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z);
    return { x: b.x, z: b.z, colour: colour({ x: b.x, z: b.z, type: b.type, height: b.level - 0.5 + (b.top ?? 1), walk: level.ground.has(id), road: level.road.has(id) }) };
  });
  const sheet = document.createElement('canvas');
  sheet.width = (maxX - minX + 1) * CELL;
  sheet.height = (maxZ - minZ + 1) * CELL;
  const tilesCtx = sheet.getContext('2d');
  function paintTiles() {
    tilesCtx.clearRect(0, 0, sheet.width, sheet.height);
    for (const t of tiles) {
      if (!seen(t.x, t.z)) continue;
      tilesCtx.globalAlpha = dim(t.x, t.z) ? 0.45 : 1;
      tilesCtx.fillStyle = t.colour;
      tilesCtx.fillRect((t.x - minX) * CELL, (t.z - minZ) * CELL, CELL, CELL);
    }
  }

  const SHARP = 2;                   // canvas pixels for one CSS pixel
  canvas.width = canvas.height = size * SHARP;
  const ctx = canvas.getContext('2d');
  const mid = (size * SHARP) / 2;
  const k = (tile * SHARP * HALF) / CELL;        // the sheet is drawn turned an eighth of a turn, as the view is
  const step = tile * SHARP * HALF;              // canvas pixels for one tile along x or z
  const last = { x: NaN, z: NaN, facing: NaN, stamp: NaN };

  const map = {
    get on() { return !canvas.hidden; },
    set(on) {
      canvas.hidden = !on;
      last.stamp = NaN;                           // drawn afresh when it is next shown
    },
    /**
     * Every frame. `at`: where the walker is; `facing`: his rotation about the vertical; `stamp`: a number that
     * changes whenever what is seen (or what is dim) changes.
     */
    update(at, facing, stamp) {
      if (canvas.hidden) return;
      if (stamp === last.stamp && Math.abs(at.x - last.x) < 0.02 && Math.abs(at.z - last.z) < 0.02 && Math.abs(facing - last.facing) < 0.01) return;
      if (stamp !== last.stamp) paintTiles();
      last.x = at.x; last.z = at.z; last.facing = facing; last.stamp = stamp;
      const u = (at.x - minX + 0.5) * CELL;
      const v = (at.z - minZ + 0.5) * CELL;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, k, -k, k, mid - k * (u - v), mid - k * (u + v));
      ctx.drawImage(sheet, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let n = 0; n < marks.length; n++) {
        const m = marks[n];
        if (!seen(m.x, m.z) || (m.shown && !m.shown())) continue;
        const x = mid + step * ((m.x - at.x) - (m.z - at.z));
        const y = mid + step * ((m.x - at.x) + (m.z - at.z));
        ctx.fillStyle = '#1b1510';
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = m.colour;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
      // the walker: an arrow in the middle, pointing the way he faces
      const fx = Math.sin(facing), fz = Math.cos(facing);
      ctx.translate(mid, mid);
      ctx.rotate(Math.atan2(fx + fz, fx - fz));
      ctx.beginPath();
      ctx.moveTo(11, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fillStyle = '#fff6dc';
      ctx.strokeStyle = '#1b1510';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fill();
    },
  };
  return map;
}
