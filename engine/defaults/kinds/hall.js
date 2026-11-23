// @ts-check
// The things of the throne hall, as data (the format: ../../README.md, „Неща като данни“).
//   throne     { at: [x, y, z], facing, region, tile }            a king's chair of dark wood and gold
//   carpet     { from: [x, z], to: [x, z], width, region, tile }  a red carpet along x
//   shield     { at: [x, y, z], facing, colours, region, tile }   a shield on a wall, swords crossed behind it
//   armorStand { at: [x, y, z], facing, suit: 'iron' | 'rusty' | 'royal', region, tile }   a suit of armour on a stand
//   spear      { at: [x, y, z], facing, region, tile }            a spear standing on a small foot
//   banner     { at: [x, y, z] }                                  a red banner on a wall
// With an `id` and `take` in the map a shield, a suit or a spear can be taken; `take.hides` here says which part goes.
import { IRON } from '../hero.js';
import { GOLD, GOLD_LIGHT, GOLD_DARK } from '../paints.js';

const RED = '#9e1f24', RED_LIGHT = '#c8372d';
const BLADE = ['#7c838e', '#b6bcc5', '#e3e6ea'];
const M = 'floor(h / 2)';                  // the middle row of a face

export const HALL_KINDS = {
  // A king's throne: dark wood with gold, a red cushion, a tall back with a crown on top. Faces +z before it is turned.
  throne: {
    label: 'Трон',
    parts: [
      { size: [0.74, 0.36, 0.62], at: [0, 0.18, 0.02], paint: 'throneWood' },                                                      // the seat block
      { size: [0.62, 0.08, 0.52], at: [0, 0.4, 0.05], paint: [['fill', RED], ['speckle', RED_LIGHT, 0.15], ['row', 'h - 1', '#6e1418']] },      // the cushion
      { size: [0.74, 1.12, 0.14], at: [0, 0.92, -0.26],                                                                              // the tall back
        paint: { all: 'throneWood', front: [['use', 'throneWood'], ['rect', 2, 3, 'w - 4', 'h - 6', RED], ['speckle', RED_LIGHT, 0.06], ['rect', 'floor(w / 2) - 1', 6, 2, 2, GOLD_LIGHT]] } },
      { each: [-1, 1], as: 'side', many: [
        { size: [0.12, 0.24, 0.56], at: ['side * 0.37', 0.48, 0.04], paint: 'throneWood' },                                          // armrests
        { size: [0.15, 0.06, 0.15], at: ['side * 0.37', 0.62, 0.28], paint: 'gold' },                                                // their gold ends
      ] },
      { each: [[-0.27, 0.16], [0, 0.26], [0.27, 0.16]], as: ['dx', 'tall'], size: [0.12, 'tall', 0.12], at: ['dx', '1.48 + tall / 2', -0.26], paint: 'gold' },      // the crown on top
      { size: [0.08, 0.08, 0.04], at: [0, 1.56, -0.18],                                                                              // a red gem
        paint: ['each', 'j', 0, 'h', 1, [['each', 'i', 0, 'w', 1, [['shine', 'i', 'j', { of: ['#ff6a6a', '#c8372d'], at: 'min(j, 1)' }]]]]] },
    ],
  },

  // A red carpet with a gold border, flat on the floor, from one point to another (along x).
  carpet: {
    label: 'Килим',
    params: { width: 1.2 },
    at: ['(from.0 + to.0) / 2', 0, 'from.1'],
    parts: [
      { size: ['abs(to.0 - from.0)', 0.02, 'width'], at: [0, 0.012, 0], paint: {
        all: ['fill', '#8e1c22'],
        top: [
          ['fill', RED], ['speckle', '#b02a2e', 0.05],
          ['row', 1, GOLD], ['row', 'h - 2', GOLD],                                                                                  // the gold border
          ['each', 'i', 6, 'w - 6', 8, [['dots', [                                                                                   // a row of small diamonds
            ['i', `${M} - 2`], ['i - 1', `${M} - 1`], ['i + 1', `${M} - 1`], ['i - 2', M], ['i + 2', M], ['i - 1', `${M} + 1`], ['i + 1', `${M} + 1`], ['i', `${M} + 2`],
          ], '#c99a2a']]],
        ],
      } },
    ],
  },

  // A shield on a wall, two swords crossed behind it. `colours`: its two halves. Faces +z (out of the wall) before
  // it is turned. Taken, the plate goes and the swords stay.
  shield: {
    label: 'Щит с мечове',
    params: { colours: [RED, GOLD] },
    scale: 2,                              // a big shield, the same size as when it is carried
    take: { hides: 'plate' },
    parts: [
      { each: [-1, 1], as: 'side', turn: [0, 0, 'side * 0.75'], parts: [                                                             // the swords
        { size: [0.05, 0.72, 0.02], at: [0, 0.12, -0.035], paint: [['fill', BLADE[1]], ['column', 0, BLADE[2]], ['column', 'w - 1', BLADE[0]]] },
        { size: [0.18, 0.04, 0.03], at: [0, -0.26, -0.035], paint: [['fill', GOLD], ['row', 'h - 1', GOLD_DARK]] },
        { size: [0.04, 0.12, 0.03], at: [0, -0.34, -0.035], paint: ['fill', '#5c3a20'] },
      ] },
      // the shield: a plate that narrows to a point, split in two colours, with a gold rim and boss
      { each: [[0.5, 0.36, 0.08], [0.42, 0.1, -0.15], [0.3, 0.08, -0.24], [0.16, 0.07, -0.315]], as: ['wide', 'tall', 'dy'], many: [
        { name: 'plate', size: ['wide / 2', 'tall', 0.05], at: ['-wide / 4', 'dy', 0], paint: { all: ['fill', '$colours.0'], front: [['fill', '$colours.0'], ['column', 0, GOLD]] } },
        { name: 'plate', size: ['wide / 2', 'tall', 0.05], at: ['wide / 4', 'dy', 0], paint: { all: ['fill', '$colours.1'], front: [['fill', '$colours.1'], ['column', 'w - 1', GOLD]] } },
      ] },
      { name: 'plate', size: [0.52, 0.04, 0.06], at: [0, 0.27, 0], paint: [['fill', GOLD], ['row', 0, GOLD_LIGHT]] },                 // the gold rim on top
      { name: 'plate', size: [0.1, 0.1, 0.04], at: [0, 0.06, 0.04], paint: [['fill', GOLD], ['px', 1, 1, GOLD_LIGHT], ['row', 'h - 1', GOLD_DARK]] },      // the boss
    ],
  },

  // A spear standing upright on a small wooden foot, a red pennant under its head. Taken, the foot stays.
  spear: {
    label: 'Копие',
    take: { hides: 'spear' },
    parts: [
      { size: [0.3, 0.08, 0.3], at: [0, 0.04, 0], paint: [['fill', '#4a2c1a'], ['row', 0, '#6b3f24']] },
      { name: 'spear', parts: [
        { size: [0.05, 2.0, 0.05], at: [0, 1.06, 0], paint: [['fill', '#8a5a34'], ['column', 0, '#a8703f'], ['column', 'w - 1', '#5c3a20']] },
        { size: [0.1, 0.24, 0.04], at: [0, 2.18, 0], paint: [['use', 'ironPlate'], ['column', 0, IRON[4]]] },
        { size: [0.05, 0.1, 0.03], at: [0, 2.34, 0], paint: ['fill', IRON[4]] },
        { size: [0.14, 0.04, 0.06], at: [0, 2.05, 0], paint: ['fill', GOLD] },
        { size: [0.02, 0.18, 0.2], at: [0.035, 1.9, 0.11], paint: [['fill', '#b0242a'], ['row', 'h - 1', '#7a1418']] },             // the pennant
      ] },
    ],
  },

  // A suit of armour on a wooden stand. The suit can be taken off it; the stand stays. Faces +z before it is turned.
  armorStand: {
    label: 'Доспехи на стойка',
    params: { suit: 'iron' },
    take: { hides: 'suit' },
    parts: [
      { size: [0.5, 0.06, 0.4], at: [0, 0.03, 0], paint: 'standWood' },                     // the stand: a foot, a post, a bar
      { size: [0.06, 1.2, 0.06], at: [0, 0.63, -0.02], paint: 'standWood' },
      { size: [0.62, 0.05, 0.05], at: [0, 1.12, -0.02], paint: 'standWood' },
      { name: 'suit', parts: [
        { size: [0.44, 0.4, 0.42], at: [0, 1.4, 0], paint: { all: 'metal', front: [['use', 'metal'], ['row', 'h - 3', '#2f2a26']] } },      // the helmet, a slit for the eyes
        { only: { suit: 'royal' }, size: [0.08, 0.2, 0.32], at: [0, 1.68, -0.02], paint: [['fill', '#b0242a'], ['speckle', '#d83a3a', 0.2]] },      // the plume
        { size: [0.46, 0.38, 0.26], at: [0, 0.98, 0], paint: { all: 'metal', front: [
          ['use', 'metal'], ['when', { suit: 'royal' }, [['rect', 'floor(w / 2) - 1', 2, 2, 3, GOLD]], [['column', 'floor(w / 2)', IRON[1]]]],
        ] } },
        { size: [0.42, 0.1, 0.24], at: [0, 0.74, 0], paint: [['fill', '#3a3d45'], ['row', 0, '#4a4e58']] },      // the padding at the waist
        { each: [-1, 1], as: 'side', many: [
          { size: [0.2, 0.08, 0.22], at: ['side * 0.31', 1.13, 0], paint: 'metal' },                             // pauldrons
          { size: [0.13, 0.42, 0.14], at: ['side * 0.31', 0.88, 0], paint: { all: 'mail', top: 'metal' } },      // the arms, empty, hanging
          { size: [0.19, 0.42, 0.21], at: ['side * 0.1', 0.45, 0], paint: 'metal' },                             // the legs
          { size: [0.22, 0.15, 0.3], at: ['side * 0.1', 0.075, 0.04], paint: 'metal' },                          // the boots
        ] },
      ] },
    ],
  },

  banner: {
    label: 'Знаме',
    parts: [
      { size: [0.72, 1.2, 0.05], material: 'cloth' },
      { size: [0.26, 0.26, 0.06], material: 'gold', at: [0, 0.15, 0.02], turn: [0, 0, 'PI / 4'] },
      { size: [0.86, 0.08, 0.09], material: 'woodDark', at: [0, 0.63, 0.01] },
    ],
  },
};
