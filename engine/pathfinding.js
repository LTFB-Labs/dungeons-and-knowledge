// @ts-check
// Finding the way: the cheapest path over the tiles, in eight directions.
// It does not cut a corner, it likes cheap ground (a road) better, and a straight line better than a zigzag.
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const TURN_COST = 0.35;

/**
 * @param {{ i: number, j: number }} from
 * @param {{ i: number, j: number }} to
 * @param {(i: number, j: number) => boolean} walkable
 * @param {(i: number, j: number) => number} [groundCost] how costly a tile is to step on: 1 for the easy way
 * @returns {{ i: number, j: number }[] | null} the tiles to step on, the last one `to`; null: no way
 */
export function findPath(from, to, walkable, groundCost = () => 1) {
  if (from.i === to.i && from.j === to.j) return [];
  if (!walkable(to.i, to.j)) return null;
  const startId = `${from.i},${from.j},8`;
  const best = new Map([[startId, 0]]);
  const cameFrom = new Map();
  const guess = (i, j) => { const dx = Math.abs(i - to.i), dz = Math.abs(j - to.j); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  // a small heap, cheapest first: [guess of the whole way, cost so far, i, j, direction walked]
  const heap = [[guess(from.i, from.j), 0, from.i, from.j, 8]];
  const push = (node) => {
    let k = heap.push(node) - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent][0] <= heap[k][0]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const a = k * 2 + 1, b = a + 1;
        let least = k;
        if (a < heap.length && heap[a][0] < heap[least][0]) least = a;
        if (b < heap.length && heap[b][0] < heap[least][0]) least = b;
        if (least === k) break;
        [heap[least], heap[k]] = [heap[k], heap[least]];
        k = least;
      }
    }
    return top;
  };
  while (heap.length) {
    const [, cost, i, j, facing] = pop();
    const id = `${i},${j},${facing}`;
    if (cost > best.get(id)) continue;
    if (i === to.i && j === to.j) {
      const path = [];
      for (let at = id; at !== startId; at = cameFrom.get(at)) { const [pi, pj] = at.split(',').map(Number); path.unshift({ i: pi, j: pj }); }
      return path;
    }
    for (let d = 0; d < 8; d++) {
      const [di, dj] = DIRECTIONS[d];
      const ni = i + di, nj = j + dj;
      if (!walkable(ni, nj)) continue;
      if (d > 3 && (!walkable(i + di, j) || !walkable(i, j + dj))) continue;            // no squeezing past a corner
      const next = cost + (d > 3 ? 1.414 : 1) * groundCost(ni, nj) + (facing !== 8 && facing !== d ? TURN_COST : 0);
      const nid = `${ni},${nj},${d}`;
      if (next >= (best.get(nid) ?? Infinity)) continue;
      best.set(nid, next);
      cameFrom.set(nid, id);
      push([next + guess(ni, nj), next, ni, nj, d]);
    }
  }
  return null;
}
