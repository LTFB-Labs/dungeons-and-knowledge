// @ts-check
// The hero himself: a boy in a white T-shirt and shorts. How each box of his body is painted (a skin sheet can
// paint it instead, see HERO_SKIN below). Everything else he has on is an item (wear.js).

export const SKIN = '#d9a074', SKIN_DARK = '#bd8457', SKIN_LIGHT = '#e3b085';
export const HAIR = '#5a3a22', HAIR_LIGHT = '#74492b', HAIR_DARK = '#402816';
export const TEE = '#efebe1', TEE_DARK = '#cdc7b9';
export const SHORTS = '#7b8aa1', SHORTS_DARK = '#5d6b81';
export const TUNIC = '#2f6fbf', TUNIC_LIGHT = '#4d8ad6', TUNIC_DARK = '#22528c';
export const SCARF = '#b8322c', SCARF_DARK = '#8a2420';
export const LEATHER = '#4c3122', BUCKLE = '#e3ac2a';
export const TROUSERS = '#2c3150', TROUSERS_LIGHT = '#3b4267';
export const BOOT = '#4a3222', BOOT_LIGHT = '#66452f';
export const PACK = '#8c4b2f', PACK_LIGHT = '#aa6541', PACK_DARK = '#693622';
export const DRAB = '#735840', DRAB_LIGHT = '#86694c', DRAB_DARK = '#58422f';        // cheap undyed cloth
export const PANTS = '#5c4836', PANTS_LIGHT = '#6e5843', PANTS_DARK = '#453527';
export const CLOAK = '#5e4532', CLOAK_LIGHT = '#70553f', CLOAK_DARK = '#402e20';
export const ROPE = '#c2a878', ROPE_DARK = '#9c8458';
export const ROBE = '#6a3fa0', ROBE_LIGHT = '#8358bd', ROBE_DARK = '#4c2b78';
export const IRON = ['#7c838e', '#9aa1ab', '#b6bcc5', '#d0d5db', '#e3e6ea'];

// Painters that many things share: cloth with a lit and a shaded edge, a flat band, skin, the T-shirt, iron plate.
export const cloth = (base, light, dark) => (g) => { g.rect(0, 0, g.w, g.h, base); g.column(0, light); g.column(g.w - 1, dark); g.row(g.h - 1, dark); };
export const flat = (base, light, dark) => (g) => { g.rect(0, 0, g.w, g.h, base); g.row(0, light); g.row(g.h - 1, dark); };
export const skin = (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.column(0, SKIN_LIGHT); g.row(g.h - 1, SKIN_DARK); };
export const tee = (g) => { g.rect(0, 0, g.w, g.h, TEE); g.column(g.w - 1, TEE_DARK); g.row(g.h - 1, TEE_DARK); };
export const iron = (g) => {
  g.rect(0, 0, g.w, g.h, IRON[2]); g.speckle(IRON[1], 0.08);
  g.row(0, IRON[4]); g.column(0, IRON[3]); g.row(g.h - 1, IRON[0]); g.column(g.w - 1, IRON[1]);
  [[1, 1], [g.w - 2, 1], [1, g.h - 2], [g.w - 2, g.h - 2]].forEach(([x, y]) => g.px(x, y, IRON[0]));        // rivets
};
const hairPiece = (g) => { g.rect(0, 0, g.w, g.h, HAIR); g.speckle(HAIR_LIGHT, 0.18); g.row(g.h - 1, HAIR_DARK); };

/** How the boxes of the rig are painted (engine/characters.js names them). */
export const HERO_LOOKS = {
  thigh: { all: (g) => { skin(g); g.rect(0, 0, g.w, 3, SHORTS); g.row(2, SHORTS_DARK); } },    // the legs of the shorts
  shin: { all: skin },
  ankle: { all: skin },
  foot: {
    all: skin,
    front: (g) => { skin(g); for (let x = 0; x < g.w; x++) g.px(x, 0, SKIN_LIGHT); },
    top: (g) => { g.rect(0, 0, g.w, g.h, SKIN); for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, SKIN_DARK); },          // toes
  },
  shorts: { all: (g) => { g.rect(0, 0, g.w, g.h, SHORTS); g.row(0, TEE_DARK); g.row(g.h - 1, SHORTS_DARK); } },
  torso: {
    all: tee,
    front: (g) => { tee(g); g.rect(3, 0, 2, 1, SKIN); },                          // the neckline
  },
  neck: { all: skin },
  upper: { all: (g) => { skin(g); g.rect(0, 0, g.w, 2, TEE); g.row(1, TEE_DARK); }, top: tee },      // a short sleeve
  fore: { all: skin },
  hand: { all: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.row(g.h - 1, SKIN_DARK); } },
  head: {
  all: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.row(g.h - 1, SKIN_DARK); },
  front: (g) => {
    g.rect(0, 0, g.w, g.h, SKIN);
    g.rect(1, 2, 2, 1, HAIR_DARK); g.rect(5, 2, 2, 1, HAIR_DARK);              // eyebrows
    g.px(1, 3, '#ffffff'); g.px(2, 3, '#27365f'); g.px(5, 3, '#27365f'); g.px(6, 3, '#ffffff');
    g.rect(3, 4, 2, 1, SKIN_DARK);                                             // nose
    g.rect(2, 5, 4, 1, '#8f4a3a'); g.rect(3, 5, 2, 1, '#b05e4b');              // mouth
    g.row(g.h - 1, SKIN_DARK);
  },
  right: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.px(3, 3, SKIN_DARK); g.row(g.h - 1, SKIN_DARK); },    // an ear
  left: (g) => { g.rect(0, 0, g.w, g.h, SKIN); g.px(g.w - 4, 3, SKIN_DARK); g.row(g.h - 1, SKIN_DARK); },
  },
  hairTop: { all: hairPiece, top: (g) => { g.rect(0, 0, g.w, g.h, HAIR); g.speckle(HAIR_LIGHT, 0.2); g.rect(2, 2, 1, 5, HAIR_DARK); } },
  hairBack: { all: hairPiece },
  hairFringe: { all: hairPiece },
};
// His body can come from a skin sheet instead (skins/README.md). Off by default: the code paints him.
// To turn a skin on, name its layout here: '../skins/hero.json' (the shipped one is kept as hero.json.off).
export const HERO_SKIN = null;
// The first face seed of his boxes: the dice of his painted faces start here on every map, so he looks the same on all.
export const HERO_FACES = 644;
