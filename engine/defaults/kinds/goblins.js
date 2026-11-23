// @ts-check
// Goblins and what they gather round, as data (the format: ../../README.md, „Неща като данни“).
//   goblin   { at: [x, z], facing, pose: 'warm' | 'poke' | 'count', region, tile }   a small green figure, sitting
//   campfire { at: [x, z], region, tile }                                            stones, logs, flames, a warm flickering light
//   hoard    { at: [x, z], region, tile }                                            a heap of gold coins
// `region` and `tile`: in a veiled part of the map a thing shows once its tile has been seen, and is as dim as
// its part of the map while the hero is elsewhere.
const GREEN_LIGHT = '#86b04a', GREEN_DARK = '#55772b';
const RAG_LIGHT = '#7f5a39', RAG_DARK = '#4e341f';
const STONE = ['#7d7a6e', '#8f8b7e', '#6b685d'];
const COUNT = { only: { pose: 'count' } }, POKE = { only: { pose: 'poke' } }, WARM = { only: { pose: 'warm' } };

export const GOBLIN_KINDS = {
  // A goblin, sitting on a stone: big head, long ears, thin arms. Faces +z before it is turned.
  goblin: {
    label: 'Гоблин',
    mark: '#8fd14f',
    params: { pose: 'warm' },
    talk: { title: 'Гоблин', text: 'Нямам какво да ти кажа в момента.' },      // unless the map gives him his own words
    parts: [
      { size: [0.32, 0.18, 0.26], at: [0, 0.09, -0.04], paint: ['use', 'stone', { base: STONE[0], light: STONE[1], dark: STONE[2] }] },      // the stone he sits on
      { name: 'body', parts: [
        { size: [0.3, 0.3, 0.18], at: [0, 0.45, 0], paint: { all: 'rag', front: [['use', 'rag'], ['rect', 2, 2, 2, 2, RAG_LIGHT], ['px', 2, 2, RAG_DARK]] } },      // with a patch
        { size: [0.32, 0.04, 0.2], at: [0, 0.34, 0], paint: ['fill', '#c2a878'] },      // a rope belt
        // legs: thighs forward along the stone, shins down
        { each: [-1, 1], as: 'side', at: ['side * 0.08', 0.3, 0.02], turn: [-1.45, 0, 0], parts: [
          { size: [0.1, 0.22, 0.1], at: [0, -0.11, 0], paint: 'goblinPants' },
          { at: [0, -0.22, 0], turn: [1.45, 0, 0], parts: [
            { size: [0.09, 0.22, 0.09], at: [0, -0.11, 0], paint: 'goblinSkin' },
            { size: [0.11, 0.05, 0.16], at: [0, -0.24, 0.03], paint: 'goblinSkin' },      // a bare foot
          ] },
        ] },
        // arms, held out to the fire (or to the coins)
        { each: [-1, 1], as: 'side', name: 'shoulder', at: ['side * 0.19', 0.57, 0], parts: [
          { size: [0.08, 0.17, 0.08], at: [0, -0.085, 0], paint: 'rag' },
          { name: 'elbow', at: [0, -0.17, 0], parts: [
            { size: [0.07, 0.16, 0.07], at: [0, -0.08, 0], paint: 'goblinSkin' },
            { size: [0.08, 0.06, 0.08], at: [0, -0.18, 0], paint: 'goblinSkin' },      // the hand
          ] },
        ] },
        // the head: big, with a long nose, yellow eyes and ears that stick out
        { name: 'head', at: [0, 0.62, 0], parts: [
          { size: [0.32, 0.28, 0.28], at: [0, 0.14, 0], paint: { all: 'goblinSkin', front: [
            ['use', 'goblinSkin'],
            ['rect', 1, 1, 2, 1, GREEN_DARK], ['rect', 4, 1, 2, 1, GREEN_DARK],                                        // brows
            ['shine', 1, 2, '#ffd23a'], ['px', 2, 2, '#2a1a0a'], ['px', 4, 2, '#2a1a0a'], ['shine', 5, 2, '#ffd23a'],
            ['rect', 2, 4, 3, 1, '#3a2614'], ['px', 2, 4, '#efe9d8'], ['px', 4, 4, '#efe9d8'],                          // a grin with two teeth
          ] } },
          { size: [0.06, 0.07, 0.1], at: [0, 0.12, 0.17], paint: [['fill', GREEN_LIGHT], ['row', 'h - 1', GREEN_DARK]] },      // nose
          { each: [-1, 1], as: 'side', size: [0.2, 0.08, 0.04], at: ['side * 0.24', 0.17, -0.02], turn: [0, 0, 'side * 0.35'],      // ears, tips up
            paint: [['use', 'goblinSkin'], ['when', { side: 1 }, [['column', 'w - 1', '#c97a6a']], [['column', 0, '#c97a6a']]]] },
          { size: [0.34, 0.06, 0.3], at: [0, 0.3, -0.01], paint: [['fill', '#3a2a1a'], ['speckle', '#4e3a26', 0.3]] },      // a scrap of hair
        ] },
      ] },
      // what he holds, in his right hand: a stick with its end in the fire, or a coin
      { ...POKE, name: 'held', on: ['elbow', 1], at: [0, -0.2, 0.02], parts: [
        { size: [0.03, 0.5, 0.03], at: [0, -0.06, 0.2], turn: [1.2, 0, 0], paint: [['fill', '#5c3a20'], ['row', 'h - 1', '#1c1410']] },
      ] },
      { ...COUNT, name: 'held', on: ['elbow', 1], at: [0, -0.22, 0.02], parts: [
        { size: [0.09, 0.03, 0.09], paint: [['fill', '#e3ac2a'], ['shine', 1, 1, '#ffd35a']] },
      ] },
    ],
    phase: 'rand() * 10',
    animate: [
      { part: 'body', do: 'breathe' },
      { part: 'head', do: 'lookAbout' },
      // counting: lifts a coin, looks at it, puts it down
      { ...COUNT, let: 'lift', to: 'max(0, sin(t * 1.6 + phase))' },
      { ...COUNT, part: 'shoulder', nth: 1, set: 'rotation.x', to: '-0.6 - 0.9 * lift' },
      { ...COUNT, part: 'elbow', nth: 1, set: 'rotation.x', to: '-0.9 + 0.5 * lift' },
      { ...COUNT, part: 'shoulder', nth: 0, set: 'rotation.x', to: -0.7 },
      { ...COUNT, part: 'elbow', nth: 0, set: 'rotation.x', to: -0.6 },
      { ...COUNT, part: 'held', do: 'spin', axis: 'z', speed: 6 },
      { ...COUNT, part: 'head', set: 'rotation.x', to: '-0.15 - 0.25 * lift' },
      // poking the fire now and then
      { ...POKE, let: 'poke', to: 'pow(max(0, sin(t * 0.9 + phase)), 3)' },
      { ...POKE, part: 'shoulder', nth: 1, set: 'rotation.x', to: '-0.9 - 0.35 * poke' },
      { ...POKE, part: 'elbow', nth: 1, set: 'rotation.x', to: '-0.4 + 0.3 * poke' },
      { ...POKE, part: 'shoulder', nth: 0, set: 'rotation.x', to: -1.0 },
      { ...POKE, part: 'elbow', nth: 0, set: 'rotation.x', to: '-0.5 + 0.08 * sin(t * 2.4 + phase)' },
      // hands held out to the warmth, rubbed now and then (n: 0 for the left arm, 1 for the right)
      { ...WARM, let: 'rub', to: 'sin(t * 7 + phase) * max(0, sin(t * 0.5 + phase))' },
      { ...WARM, part: 'shoulder', set: 'rotation.x', to: '-1.05 + 0.05 * rub * (n * 2 - 1)' },
      { ...WARM, part: 'shoulder', set: 'rotation.z', to: '(1 - n * 2) * (0.25 + 0.06 * rub)' },
      { ...WARM, part: 'elbow', set: 'rotation.x', to: -0.35 },
    ],
  },

  campfire: {
    label: 'Лагерен огън',
    parts: [
      { repeat: 9, vars: { a: '(k / 9) * PI * 2 + rand() * 0.2', s: '0.14 + rand() * 0.06' },                         // a ring of stones
        size: ['s', 's * 0.75', 's'], at: ['cos(a) * 0.42', 's * 0.37', 'sin(a) * 0.42'], turn: [0, 'rand() * 3', 0],
        paint: [['fill', { of: STONE, at: 'k % 3' }], ['speckle', { of: STONE, at: '(k + 1) % 3' }, 0.25], ['row', 0, STONE[1]]] },
      { repeat: 3, size: [0.07, 0.07, 0.56], at: [0, '0.06 + k * 0.03', 0], turn: [0, '(k / 3) * PI', 0],             // logs, crossed
        paint: { all: [['fill', '#5c3a20'], ['speckle', '#3a2414', 0.3], ['row', 0, '#7a4e2c']], front: [['fill', '#b58a5a'], ['px', 0, 0, '#8a6a42']], back: ['fill', '#b58a5a'] } },
      { repeat: 6, size: [0.05, 0.03, 0.05], material: 'flame', at: ['(rand() - 0.5) * 0.4', 0.05, '(rand() - 0.5) * 0.4'], turn: [0, 'rand() * 3', 0] },      // embers among the logs
      { each: [[0, 0.32, 0.26], [0.07, 0.24, 0.18], [-0.08, 0.22, 0.16]], as: ['dx', 'tall', 'wide'], name: 'flame', at: ['dx', 0.1, '(k - 1) * 0.05'], phase: 'rand() * 10', parts: [
        { size: ['wide', 'tall', 'wide'], material: 'flame', at: [0, 'tall / 2', 0] },
        { size: ['wide * 0.55', 'tall * 0.65', 'wide * 0.55'], material: 'flameCore', at: [0, 'tall * 0.4', 0] },
      ] },
    ],
    light: { colour: 0xff9a4a, power: 0, reach: 7, at: [0, 0.55, 0], halo: { colour: 0xff7a28, size: 2.4, opacity: 0.1, at: [0, 0.35, 0] } },
    animate: [                                                       // `lit`: how lit its part of the map is (0 while it is not seen)
      { always: true, let: 'burn', to: '0.82 + 0.12 * sin(t * 9.3) + 0.06 * sin(t * 23.1 + 1.7)' },
      { always: true, part: 'light', set: 'intensity', to: '9 * burn * lit' },
      { always: true, part: 'halo', set: 'opacity', to: '0.1 * burn * lit' },
      { always: true, part: 'flame', do: 'flicker', low: 0.85, swing: 0.3, speed: 12, turn: 1.9 },
    ],
  },

  // One heap: many coins in one draw, piled higher in the middle; a few that catch the light.
  hoard: {
    label: 'Купчина жълтици',
    parts: [
      { repeat: 140, instanced: true, size: [0.1, 0.03, 0.1], material: 'gold',
        vars: { r: 'sqrt(rand()) * 0.55', a: 'rand() * PI * 2', height: 'max(0, 0.42 * (1 - r / 0.55)) * (0.75 + 0.25 * rand())' },
        at: ['cos(a) * r', '0.02 + height * rand()', 'sin(a) * r * 0.85'], turn: ['(rand() - 0.5) * 0.9', 'rand() * 3', '(rand() - 0.5) * 0.9'] },
      { repeat: 6, size: [0.11, 0.03, 0.11], material: 'goldGlow', at: ['(rand() - 0.5) * 0.5', '0.18 + rand() * 0.22', '(rand() - 0.5) * 0.4'] },
      { name: 'glint', glow: 0xffcf5a, size: 1.4, opacity: 0.06, at: [0, 0.3, 0] },
    ],
    animate: [{ always: true, part: 'glint', set: 'opacity', to: '(0.05 + 0.03 * sin(t * 1.7)) * lit' }],
  },
};
