// @ts-check
// Small things that stand about, as data (the format: ../../README.md, „Неща като данни“).
//   torch  { at: [x, y, z], lean: [x, z], power, onlyIn, seen }   a torch on a wall, leaning away from it
//   barrel { at: [x, z] }    crates { at: [x, z] }    coins { at: [x, y, z] }
// A torch with `onlyIn` (a region) and `seen` (a cell): its light is seen only from inside that region, once that
// cell has been seen. With an `id` and `take` in the map it can be taken off the wall: gone, and its light out.

export const STORE_KINDS = {
  torch: {
    label: 'Факла',
    params: { lean: [0, 1], power: 1 },
    parts: [
      { size: [0.09, 0.42, 0.09], material: 'woodDark', at: [0, -0.16, 0], turn: ['lean.1 * 0.5', 0, '-lean.0 * 0.5'] },
      { size: [0.2, 0.08, 0.2], material: 'iron', at: ['lean.0 * 0.08', 0.06, 'lean.1 * 0.08'] },
      { name: 'flame', at: ['lean.0 * 0.1', 0.22, 'lean.1 * 0.1'], parts: [
        { size: [0.2, 0.24, 0.2], material: 'flame' },
        { size: [0.11, 0.16, 0.11], material: 'flameCore', at: [0, 0.12, 0] },
      ] },
    ],
    // `flicker`: one of the map's torches: it flickers, the nearest ones cast shadows, sparks and sound follow it
    light: { colour: 0xffc089, power: '6.5 * power', reach: 9, at: ['lean.0 * 0.9', 0.35, 'lean.1 * 0.9'], flicker: true,
      halo: { colour: 0xff7a28, size: 1.8, opacity: 0.08, at: ['lean.0 * 0.2', 0.25, 'lean.1 * 0.2'] } },
    phase: 'rand() * 10',
    animate: [{ part: 'flame', do: 'flicker' }],
  },

  barrel: {
    label: 'Бъчва',
    parts: [
      { size: [0.58, 0.74, 0.58], material: 'wood', at: [0, 0.37, 0] },
      { size: [0.62, 0.08, 0.62], material: 'iron', at: [0, 0.18, 0] },
      { size: [0.62, 0.08, 0.62], material: 'iron', at: [0, 0.56, 0] },
    ],
  },

  crates: {
    label: 'Сандъчета',
    parts: [
      { size: [0.7, 0.7, 0.7], material: 'wood', at: [0, 0.35, 0] },
      { size: [0.46, 0.46, 0.46], material: 'woodDark', at: [-0.05, 0.93, 0.02], turn: [0, 0.4, 0] },
    ],
  },

  // Coins spilled by the chest.
  coins: {
    label: 'Жълтици',
    parts: [
      { repeat: 16, vars: { s: '0.1 + rand() * 0.06' }, size: ['s', 's * 0.6', 's'], material: 'gold',
        at: ['(rand() - 0.5) * 0.6', 's * 0.3 + (k % 3) * 0.06', '(rand() - 0.5) * 0.5'], turn: [0, 'rand() * 3', 0] },
      { glow: 0xffb62e, size: 1.3, opacity: 0.08, at: [0, 0.2, 0] },
    ],
  },
};
