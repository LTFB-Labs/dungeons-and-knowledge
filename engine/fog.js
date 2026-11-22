// @ts-check
// Fog of war. The world is split into regions (map.js gives every block one). A region the hero is in is fully
// lit; one he has explored is remembered, dim; one he has not is dark. A veiled region is not seen at all until
// it is looked into: only its cells within reach show, fading to black with distance (one veiled region per map).
import { key, HOME_REGION } from './map.js';

/**
 * @param {object} o
 * @param {any} o.world from createWorld
 * @param {any[]} o.blocks
 * @param {Map<string, string>} o.regionAt
 * @param {Record<string, { light: number, explored?: boolean, veiled?: boolean, from?: number[], peek?: number, open?: number, fade?: number }>} o.regions
 *   light: how lit at the start; veiled: `from` is the point it is looked into from (a door), `peek` how many
 *   tiles show plainly before it is opened, `open` how many after, `fade` over how many more it goes black
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} o.viewBox grows as more is seen
 */
export function createFog({ world, blocks, regionAt, regions, viewBox }) {
  const explored = new Set(Object.keys(regions).filter((name) => regions[name].explored));
  const veiled = Object.keys(regions).filter((name) => regions[name].veiled);
  const seen = new Set();
  const veiledCells = new Set(blocks.filter((b) => veiled.includes(b.region)).map((b) => key(b.x, b.z)));
  const cellOf = (id) => id.split(',').map(Number);

  // Of a veiled region only the cells that have been seen are drawn (and can be tapped).
  function unveil() {
    for (const mesh of world.meshes) {
      if (!veiled.includes(mesh.userData.region)) continue;
      const { index, quads, cells } = mesh.userData.all;
      const shownIndex = [];
      const shownQuads = [];
      cells.forEach((cell, q) => {
        if (!seen.has(cell)) return;
        shownIndex.push(...index.slice(q * 6, q * 6 + 6));
        shownQuads.push(quads[q]);
      });
      mesh.geometry.setIndex(shownIndex);
      mesh.userData.quads = shownQuads;
    }
  }
  /** Everything veiled within `radius` of a point has now been seen. */
  function lookAround(cx, cz, radius = 4.5) {
    let grew = false;
    for (const cell of veiledCells) {
      if (seen.has(cell)) continue;
      const [x, z] = cellOf(cell);
      if (Math.hypot(x - cx, z - cz) <= radius) {
        seen.add(cell);
        grew = true;
        viewBox.minX = Math.min(viewBox.minX, x); viewBox.maxX = Math.max(viewBox.maxX, x);
        viewBox.minZ = Math.min(viewBox.minZ, z); viewBox.maxZ = Math.max(viewBox.maxZ, z);
      }
    }
    if (grew) unveil();
  }
  const reach = (region, clear) => {
    const { from, fade } = regions[region];
    world.fog.uFogCenter.value.set(from[0], from[1]);
    world.fog.uFogInner.value = clear;
    world.fog.uFogOuter.value = clear + fade;
    lookAround(from[0], from[1], clear + fade);
  };
  unveil();
  for (const region of veiled) reach(region, regions[region].peek);     // a dim glimpse of what is nearest

  const regionOf = (i, j) => regionAt.get(key(i, j)) ?? HOME_REGION;
  /** May the hero step here? Not into a region he has not explored, nor onto a veiled tile he has not seen. */
  function canEnter(i, j) {
    const region = regionOf(i, j);
    return explored.has(region) && (!regions[region]?.veiled || seen.has(key(i, j)));
  }
  /** A veiled region is opened (its door): it counts as explored and shows much further. */
  function open(region) {
    explored.add(region);
    reach(region, regions[region].open);
  }
  /** Every frame: each region eases towards how lit it should be, given where the hero is. */
  function update(dt, here) {
    const light = world.regionLight;
    let relit = false;
    for (const region of Object.keys(light)) {
      const goal = region === here ? 1 : explored.has(region) ? 0.45 : regions[region].veiled ? 0.3 : 0;
      const next = light[region] + (goal - light[region]) * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(next - light[region]) > 0.0005) { light[region] = next; relit = true; }
    }
    if (relit) world.lightRegions();
  }
  return { explored, seen, regionOf, canEnter, lookAround, open, update };
}
