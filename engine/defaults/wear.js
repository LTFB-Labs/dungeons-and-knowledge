// @ts-check
// How the default items (items.js) look on the hero. What is worn is a set of slightly larger boxes over his parts, shown only
// while that item is on (rig.worn); what is held is a small model in his hand.
import * as THREE from '../three.js';
import { MOSS } from './blocks.js';
import {
  SKIN, TUNIC, TUNIC_LIGHT, TUNIC_DARK, SCARF, SCARF_DARK, LEATHER, BUCKLE, TROUSERS, TROUSERS_LIGHT, BOOT, BOOT_LIGHT,
  PACK, PACK_LIGHT, PACK_DARK, DRAB, DRAB_LIGHT, DRAB_DARK, PANTS, PANTS_LIGHT, PANTS_DARK, CLOAK, CLOAK_LIGHT, CLOAK_DARK,
  ROPE, ROPE_DARK, ROBE, ROBE_LIGHT, ROBE_DARK, IRON, cloth, flat, iron,
} from './hero.js';

/** Builds every piece of clothing on the rig. They all start shown; rig.dress() shows the ones that are worn. */
export function makeClothes(rig) {
  const { body: heroBody, head, arms, legs, piece, worn } = rig;

  // The traveller's clothes he used to have on: a blue tunic with a scarf, dark trousers, leather boots, a pack.
  const tunic = (g) => { cloth(TUNIC, TUNIC_LIGHT, TUNIC_DARK)(g); g.row(g.h - 2, TUNIC_DARK); };
  const scarfTail = new THREE.Group();                                           // hangs from the knot, so it can swing
  scarfTail.position.set(0.09, 0.985, 0.13);
  piece(scarfTail, 0.11, 0.17, 0.04, 0, -0.085, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SCARF); g.row(g.h - 1, SCARF_DARK); g.column(0, '#cf4a42'); } });
  worn('tunic', heroBody, (o) => {
    piece(o, 0.43, 0.1, 0.25, 0, 0.56, 0, {                                      // belt with a buckle
      all: (g) => { g.rect(0, 0, g.w, g.h, LEATHER); g.row(0, '#6a4630'); },
      front: (g) => { g.rect(0, 0, g.w, g.h, LEATHER); g.row(0, '#6a4630'); g.rect(3, 0, 3, 2, BUCKLE); g.px(4, 1, LEATHER); },
    });
    piece(o, 0.4, 0.38, 0.22, 0, 0.8, 0, {
      all: tunic,
      front: (g) => {
        tunic(g);
        for (let k = 0; k < 6; k++) g.px(1 + k, 1 + k, LEATHER);                 // a strap across the chest
        g.px(4, 2, TUNIC_LIGHT); g.px(4, 4, TUNIC_LIGHT);                        // two buttons
      },
    });
    piece(o, 0.44, 0.09, 0.27, 0, 1.01, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, SCARF); g.row(g.h - 1, SCARF_DARK); } });
    o.add(scarfTail);
    [-1, 1].forEach((side) => piece(o, 0.18, 0.09, 0.21, side * 0.29, 0.97, 0, {   // leather pads on the shoulders
      all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(0, PACK_LIGHT); g.row(g.h - 1, PACK_DARK); },
      top: (g) => { g.rect(0, 0, g.w, g.h, PACK_LIGHT); g.px(1, 1, BUCKLE); g.px(g.w - 2, g.h - 2, BUCKLE); },
    }));
  });
  const pack = new THREE.Group();                                                // pack and bedroll bounce together
  piece(pack, 0.3, 0.32, 0.14, 0, 0.76, -0.18, {
    all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(g.h - 1, PACK_DARK); g.column(0, PACK_LIGHT); },
    back: (g) => {
      g.rect(0, 0, g.w, g.h, PACK);
      g.rect(0, 0, g.w, 3, PACK_LIGHT); g.row(3, PACK_DARK);                     // the flap
      g.rect(2, 3, 2, 2, BUCKLE);
      g.row(g.h - 1, PACK_DARK);
    },
  });
  piece(pack, 0.38, 0.1, 0.12, 0, 0.98, -0.2, {
    all: (g) => { g.rect(0, 0, g.w, g.h, MOSS[1]); g.column(1, LEATHER); g.column(g.w - 2, LEATHER); g.row(0, MOSS[2]); },
  });
  worn('pack', heroBody, (o) => o.add(pack));

  // The poor clothes he starts in: a patched shirt with a rope for a belt, short trousers, plain shoes, a cloak.
  const drab = (g) => { cloth(DRAB, DRAB_LIGHT, DRAB_DARK)(g); g.speckle(DRAB_DARK, 0.07); };
  const pants = (g) => { cloth(PANTS, PANTS_LIGHT, PANTS_DARK)(g); g.speckle(PANTS_DARK, 0.06); };
  const cloakCloth = (g) => { cloth(CLOAK, CLOAK_LIGHT, CLOAK_DARK)(g); g.speckle(CLOAK_DARK, 0.08); };
  worn('shirt', heroBody, (o) => {
    piece(o, 0.4, 0.38, 0.22, 0, 0.8, 0, {
      all: drab,
      front: (g) => {
        drab(g);
        g.rect(3, 0, 2, 2, SKIN); g.px(3, 2, DRAB_DARK); g.px(4, 2, DRAB_DARK);   // an open neck with a lace
        g.rect(5, 4, 2, 2, DRAB_LIGHT); g.px(5, 4, DRAB_DARK);                    // a patch
      },
    });
    piece(o, 0.425, 0.1, 0.245, 0, 0.56, 0, {                                      // the hem, uneven at the bottom
      all: (g) => { drab(g); for (let x = 0; x < g.w; x += 3) g.px(x, g.h - 1, DRAB_LIGHT); },
    });
    piece(o, 0.44, 0.05, 0.26, 0, 0.625, 0, {
      all: (g) => { g.rect(0, 0, g.w, g.h, ROPE); for (let x = 1; x < g.w; x += 2) g.px(x, 0, ROPE_DARK); },
    });
  });
  const cloak = new THREE.Group();                                               // hangs from the shoulders and swings behind him
  cloak.position.set(0, 1.0, -0.13);
  piece(cloak, 0.5, 0.66, 0.05, 0, -0.33, -0.03, {
    all: cloakCloth,
    back: (g) => {
      cloakCloth(g);
      for (const x of [2, 5, 8]) g.column(x, CLOAK_DARK);                         // folds
      for (let x = 0; x < g.w; x += 3) g.px(x, g.h - 1, CLOAK_LIGHT);             // a worn hem
      g.rect(6, 8, 2, 2, DRAB); g.px(6, 8, CLOAK_DARK);                           // a patch
    },
  });
  piece(cloak, 0.3, 0.12, 0.1, 0, -0.08, -0.08, { all: cloakCloth });             // the hood, lying on his back
  worn('cloak', heroBody, (o) => {
    piece(o, 0.5, 0.08, 0.3, 0, 1.01, 0, {                                        // over the shoulders, held by a pin
      all: (g) => { g.rect(0, 0, g.w, g.h, CLOAK); g.row(0, CLOAK_LIGHT); g.row(g.h - 1, CLOAK_DARK); },
      front: (g) => { g.rect(0, 0, g.w, g.h, CLOAK); g.row(g.h - 1, CLOAK_DARK); g.px(Math.floor(g.w / 2), 0, BUCKLE); },
    });
    o.add(cloak);
  });

  // The magic cloak: its cloth shines by itself, a dim violet with bright threads, and it lights the way a little.
  const MAGIC = '#4f3282', MAGIC_GLOW = '#c9a8ff';
  const magicCloth = (g) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.shine(x, y, (x + y) % 7 === 0 ? '#6a48a8' : MAGIC);
    for (let x = 0; x < g.w; x++) g.shine(x, g.h - 1, MAGIC_GLOW);                  // a glowing hem
  };
  const magicCloak = new THREE.Group();
  magicCloak.position.set(0, 1.0, -0.13);
  piece(magicCloak, 0.52, 0.68, 0.05, 0, -0.34, -0.03, {
    all: magicCloth,
    back: (g) => { magicCloth(g); [[2, 3], [7, 5], [4, 9], [8, 10], [3, 12]].forEach(([x, y]) => g.shine(x, y, MAGIC_GLOW)); },
  });
  piece(magicCloak, 0.3, 0.12, 0.1, 0, -0.08, -0.08, { all: magicCloth });
  worn('magicCloak', heroBody, (o) => {
    piece(o, 0.5, 0.08, 0.3, 0, 1.01, 0, { all: magicCloth, front: (g) => { magicCloth(g); g.shine(Math.floor(g.w / 2), 0, '#ffe08a'); } });
    o.add(magicCloak);
  });

  // The wizard's clothes from the chest in the far chamber: a pointed hat, a robe, shoes with curled toes.
  const robe = cloth(ROBE, ROBE_LIGHT, ROBE_DARK);
  const stars = (spots) => (g) => { robe(g); spots.forEach(([x, y]) => g.px(x, y, '#ffd35a')); };
  worn('wizardHat', head, (o) => {
    piece(o, 0.62, 0.04, 0.6, 0, 0.42, -0.01, { all: (g) => g.rect(0, 0, g.w, g.h, ROBE_DARK), top: robe });      // the brim
    piece(o, 0.44, 0.13, 0.42, 0, 0.495, -0.01, {
      all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); },                           // a gold band
      front: (g) => { robe(g); g.row(g.h - 1, BUCKLE); g.rect(Math.floor(g.w / 2) - 1, g.h - 2, 2, 2, '#ffd35a'); },
    });
    piece(o, 0.32, 0.13, 0.3, 0, 0.62, -0.03, { all: stars([[1, 1], [4, 0]]) });
    piece(o, 0.2, 0.13, 0.2, 0, 0.74, -0.06, { all: stars([[2, 1]]) });
    piece(o, 0.11, 0.1, 0.11, 0, 0.84, -0.11, { all: robe });                     // the tip leans back
  });
  worn('wizardRobe', heroBody, (o) => {
    piece(o, 0.42, 0.39, 0.24, 0, 0.805, 0, {
      all: stars([[1, 2], [5, 5]]),
      front: (g) => { robe(g); g.column(3, BUCKLE); g.column(4, '#a87a16'); g.px(1, 2, '#ffd35a'); g.px(6, 4, '#ffd35a'); },
    });
    piece(o, 0.45, 0.1, 0.27, 0, 0.56, 0, {                                        // a gold sash
      all: flat(BUCKLE, '#ffd35a', '#a87a16'),
      front: (g) => { flat(BUCKLE, '#ffd35a', '#a87a16')(g); g.rect(Math.floor(g.w / 2) - 1, 0, 2, g.h, '#a87a16'); },
    });
    piece(o, 0.44, 0.07, 0.27, 0, 1.0, 0, { all: (g) => { g.rect(0, 0, g.w, g.h, ROBE_DARK); g.row(0, BUCKLE); } });
  });

  // Iron: a helmet, a breastplate with mail sleeves, leg guards over padding, boots.
  const mail = (g) => {
    g.rect(0, 0, g.w, g.h, IRON[1]);
    for (let y = 0; y < g.h; y++) for (let x = (y % 2); x < g.w; x += 2) g.px(x, y, IRON[0]);
  };
  const padding = cloth('#3a3d45', '#4a4e58', '#2a2c33');
  worn('helmet', head, (o) => {
    piece(o, 0.46, 0.22, 0.44, 0, 0.345, 0, { all: iron, front: (g) => { iron(g); g.row(g.h - 2, IRON[0]); } });
    [-1, 1].forEach((side) => piece(o, 0.05, 0.22, 0.4, side * 0.215, 0.17, -0.01, { all: iron }));
    piece(o, 0.46, 0.22, 0.06, 0, 0.17, -0.215, { all: iron });
  });
  worn('chest', heroBody, (o) => piece(o, 0.46, 0.36, 0.26, 0, 0.81, 0, {
    all: iron,
    front: (g) => { iron(g); g.column(Math.floor(g.w / 2), IRON[1]); g.row(Math.floor(g.h / 2), IRON[1]); },
  }));
  worn('legs', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: padding }));
  worn('trousers', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: cloth(TROUSERS, TROUSERS_LIGHT, '#22263f') }));
  worn('pants', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: pants }));

  arms.forEach((arm) => {
    worn('tunic', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: cloth(TUNIC, TUNIC_LIGHT, TUNIC_DARK) }));
    worn('tunic', arm.elbow, (o) => piece(o, 0.15, 0.17, 0.17, 0, -0.08, 0, {      // a leather bracer
      all: (g) => { g.rect(0, 0, g.w, g.h, PACK); g.row(0, PACK_LIGHT); g.row(g.h - 1, PACK_DARK); g.px(1, 1, BUCKLE); },
    }));
    worn('shirt', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: drab }));
    worn('shirt', arm.elbow, (o) => piece(o, 0.13, 0.11, 0.15, 0, -0.045, 0, {     // the sleeve stops short of the wrist
      all: (g) => { drab(g); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, DRAB_LIGHT); },
    }));
    worn('wizardRobe', arm.shoulder, (o) => piece(o, 0.15, 0.22, 0.17, 0, -0.13, 0, { all: robe }));
    worn('wizardRobe', arm.elbow, (o) => piece(o, 0.17, 0.16, 0.19, 0, -0.085, 0, { all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); } }));    // a wide sleeve with a gold cuff
    worn('chest', arm.shoulder, (o) => piece(o, 0.14, 0.22, 0.16, 0, -0.13, 0, { all: mail, top: iron }));
  });
  legs.forEach((leg, k) => {
    const side = k ? 1 : -1;
    worn('trousers', leg.hip, (o) => piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: cloth(TROUSERS, TROUSERS_LIGHT, '#22263f') }));
    worn('trousers', leg.knee, (o) => piece(o, 0.15, 0.18, 0.17, 0, -0.08, 0, {
      all: (g) => { cloth(TROUSERS, TROUSERS_LIGHT, '#22263f')(g); g.row(0, '#22263f'); g.row(2, LEATHER); },     // a strap under the knee
    }));
    worn('leatherBoots', leg.ankle, (o) => piece(o, 0.19, 0.14, 0.27, 0, -0.06, 0.03, {
      all: (g) => { g.rect(0, 0, g.w, g.h, BOOT); g.row(0, BOOT_LIGHT); g.row(g.h - 1, '#2f1f15'); },
      top: (g) => { g.rect(0, 0, g.w, g.h, BOOT); g.rect(0, g.h - 2, g.w, 2, BOOT_LIGHT); },                       // the toe cap
      front: (g) => { g.rect(0, 0, g.w, g.h, BOOT_LIGHT); g.row(g.h - 1, '#2f1f15'); },
    }));
    worn('pants', leg.hip, (o) => piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: pants }));
    worn('pants', leg.knee, (o) => piece(o, 0.15, 0.14, 0.17, 0, -0.06, 0, {       // short in the leg
      all: (g) => { pants(g); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, PANTS_LIGHT); },
      front: (g) => { pants(g); g.rect(0, 0, 2, 2, DRAB_LIGHT); g.px(1, 1, PANTS_DARK); },                         // a patch on the knee
    }));
    worn('shoes', leg.ankle, (o) => piece(o, 0.18, 0.11, 0.26, 0, -0.075, 0.03, {
      all: (g) => { g.rect(0, 0, g.w, g.h, CLOAK_DARK); g.row(g.h - 1, '#2f2118'); },
      top: (g) => { g.rect(0, 0, g.w, g.h, CLOAK_DARK); g.row(1, ROPE_DARK); },                                    // tied with a cord
    }));
    worn('wizardRobe', leg.hip, (o) => piece(o, 0.215, 0.36, 0.25, side * 0.008, -0.18, 0, {                        // the skirt of the robe, one half on each leg
      all: (g) => { robe(g); g.row(g.h - 1, BUCKLE); },
    }));
    worn('wizardBoots', leg.ankle, (o) => {
      piece(o, 0.2, 0.15, 0.27, 0, -0.055, 0.03, { all: (g) => { robe(g); g.row(0, BUCKLE); } });
      piece(o, 0.1, 0.07, 0.08, 0, -0.095, 0.2, { all: robe });                   // the curled toe
      piece(o, 0.06, 0.07, 0.05, 0, -0.05, 0.235, { all: flat(BUCKLE, '#ffd35a', '#a87a16') });
    });
    worn('legs', leg.hip, (o) => {
      piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: padding });
      piece(o, 0.21, 0.2, 0.23, 0, -0.1, 0, { all: iron });
    });
    worn('legs', leg.knee, (o) => {
      piece(o, 0.15, 0.18, 0.17, 0, -0.08, 0, { all: padding });
      piece(o, 0.19, 0.13, 0.21, 0, -0.07, 0, { all: iron });
    });
    worn('boots', leg.ankle, (o) => piece(o, 0.23, 0.17, 0.31, 0, -0.055, 0.03, { all: iron, top: (g) => { iron(g); g.rect(0, g.h - 3, g.w, 3, IRON[3]); } }));
  });

  // Royal: the iron set trimmed with gold, a red plume on the helmet, a gold lion on the breastplate, pauldrons.
  const royal = (g) => { iron(g); g.row(0, '#ffd35a'); g.row(g.h - 1, '#a87a16'); g.column(0, '#e3ac2a'); g.column(g.w - 1, '#a87a16'); };
  const plume = (g) => { g.rect(0, 0, g.w, g.h, '#b0242a'); g.speckle('#d83a3a', 0.2); g.row(g.h - 1, '#7a1418'); };
  worn('royalHelmet', head, (o) => {
    piece(o, 0.48, 0.23, 0.46, 0, 0.35, 0, { all: royal, front: (g) => { royal(g); g.row(g.h - 3, '#2f2a26'); } });     // a slit for the eyes
    [-1, 1].forEach((side) => piece(o, 0.05, 0.22, 0.42, side * 0.225, 0.17, -0.01, { all: royal }));
    piece(o, 0.48, 0.22, 0.06, 0, 0.17, -0.225, { all: royal });
    piece(o, 0.08, 0.2, 0.34, 0, 0.55, -0.02, { all: plume });
  });
  worn('royalChest', heroBody, (o) => piece(o, 0.48, 0.37, 0.28, 0, 0.81, 0, {
    all: royal,
    front: (g) => { royal(g); const m = Math.floor(g.w / 2); g.rect(m - 1, 2, 2, 3, '#e3ac2a'); g.px(m - 2, 3, '#e3ac2a'); g.px(m + 1, 3, '#e3ac2a'); },
  }));
  worn('royalLegs', heroBody, (o) => piece(o, 0.415, 0.1, 0.235, 0, 0.56, 0, { all: padding }));
  arms.forEach((arm) => worn('royalChest', arm.shoulder, (o) => {
    piece(o, 0.15, 0.22, 0.17, 0, -0.13, 0, { all: mail, top: royal });
    piece(o, 0.2, 0.08, 0.22, 0, -0.01, 0, { all: royal });                                // a pauldron
  }));
  legs.forEach((leg) => {
    worn('royalLegs', leg.hip, (o) => { piece(o, 0.17, 0.24, 0.19, 0, -0.12, 0, { all: padding }); piece(o, 0.21, 0.2, 0.23, 0, -0.1, 0, { all: royal }); });
    worn('royalLegs', leg.knee, (o) => { piece(o, 0.15, 0.18, 0.17, 0, -0.08, 0, { all: padding }); piece(o, 0.19, 0.13, 0.21, 0, -0.07, 0, { all: royal }); });
    worn('royalBoots', leg.ankle, (o) => piece(o, 0.23, 0.17, 0.31, 0, -0.055, 0.03, { all: royal, top: (g) => { royal(g); g.rect(0, g.h - 3, g.w, 3, '#e3ac2a'); } }));
  });

  // Loose things follow a moment late.
  rig.loose.push((gait, s, stride) => {
    pack.position.y = 0.016 * Math.cos(stride * 2 - 1.0) * gait;
    pack.rotation.z = -0.03 * s * gait;
    cloak.rotation.x = (0.3 + 0.07 * Math.sin(stride * 2 - 0.8)) * gait;      // the cloak streams out behind as he walks
    cloak.rotation.z = -0.04 * s * gait;
    magicCloak.rotation.copy(cloak.rotation);
    scarfTail.rotation.x = (0.22 + 0.2 * Math.sin(stride * 2 - 0.6)) * gait;
    scarfTail.rotation.z = 0.12 * Math.sin(stride - 0.8) * gait;
  });
}

/**
 * Builds what can be held, once for each hand, all hidden. Gives show(equip): shows what is in each hand.
 * @param {any} rig @param {Function} paintedBox
 */
export function makeHoldings(rig, paintedBox) {
  const { arms } = rig;
  // one thing in each hand
  const inHand = { handR: {}, handL: {} };
  const handHolders = {};
  [['handR', arms[1].elbow], ['handL', arms[0].elbow]].forEach(([key, elbow]) => {
    const holder = new THREE.Group();
    holder.position.set(0, -0.27, 0.04);
    elbow.add(holder);
    handHolders[key] = holder;
  });
  // `tilt`: how far it is turned from the line of the forearm. FORWARD: at right angles to it, sticking out in front.
  const FORWARD = Math.PI / 2;
  const holding = (id, build, tilt = 0) => {
    for (const key of ['handR', 'handL']) {
      const g = new THREE.Group();
      g.rotation.x = tilt;
      build(g);
      g.visible = false;
      handHolders[key].add(g);
      inHand[key][id] = g;
    }
  };
  holding('sword', (g) => {
    paintedBox(g, 0.05, 0.46, 0.07, 0, 0.3, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[3]); p.column(0, IRON[4]); p.column(p.w - 1, IRON[1]); } });
    paintedBox(g, 0.18, 0.04, 0.08, 0, 0.06, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') });
    paintedBox(g, 0.04, 0.12, 0.04, 0, -0.02, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
  }, FORWARD);
  holding('tnt', (g) => paintedBox(g, 0.2, 0.24, 0.2, 0, -0.12, 0, {
    all: (p) => { p.rect(0, 0, p.w, p.h, '#c8372d'); for (let x = 1; x < p.w; x += 2) p.column(x, '#8e2620'); p.rect(0, 1, p.w, 1, '#efe2c0'); p.rect(0, p.h - 2, p.w, 1, '#efe2c0'); },
    top: (p) => { p.rect(0, 0, p.w, p.h, '#8e2620'); p.px(2, 2, '#2f2a26'); },
  }));
  holding('torch', (g) => {
    paintedBox(g, 0.05, 0.3, 0.05, 0, 0.08, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
    paintedBox(g, 0.08, 0.08, 0.08, 0, 0.26, 0, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, y < 1 ? '#ffe08a' : '#ff9a3a'); } });
  }, FORWARD);
  holding('bread', (g) => paintedBox(g, 0.22, 0.1, 0.12, 0, -0.06, 0, { all: flat('#d79a4a', '#efc07a', '#a8682a') }));
  holding('potion', (g) => {
    paintedBox(g, 0.12, 0.14, 0.12, 0, -0.08, 0, { all: flat('#d0549a', '#e88ac0', '#9c2f70') });
    paintedBox(g, 0.05, 0.05, 0.05, 0, 0.02, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
  });
  holding('wand', (g) => {
    paintedBox(g, 0.035, 0.36, 0.035, 0, 0.12, 0, { all: flat('#5c3a20', '#8a5a34', '#3a2414') });
    paintedBox(g, 0.05, 0.04, 0.05, 0, 0.0, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') });
    paintedBox(g, 0.07, 0.07, 0.07, 0, 0.32, 0, { all: (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.shine(x, y, y < 1 ? '#ffe08a' : '#ff7a2a'); } });
  }, FORWARD);
  holding('spear', (g) => {                                                      // held like a lance, gripped a third up the shaft, so the butt sticks out behind the hand
    paintedBox(g, 0.04, 1.3, 0.04, 0, 0.1, 0, { all: flat('#8a5a34', '#a8703f', '#5c3a20') });
    paintedBox(g, 0.07, 0.16, 0.03, 0, 0.81, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[3]); p.column(0, IRON[4]); p.row(p.h - 1, IRON[1]); } });
    paintedBox(g, 0.04, 0.08, 0.02, 0, 0.92, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, IRON[4]); } });
  }, FORWARD);
  holding('shield', (g) => {                                                     // as big as it hung on the wall: twice the size of this model
    const big = new THREE.Group();
    big.scale.setScalar(2);
    big.position.y = 0.3;                                                       // its middle on the forearm, not below the hand
    g.add(big);
    const half = (colour, edge) => (p) => { p.rect(0, 0, p.w, p.h, colour); p.column(edge, '#e3ac2a'); };
    [[0.36, 0.26, 0.02], [0.28, 0.08, -0.15], [0.16, 0.07, -0.22]].forEach(([w, h, y]) => {
      paintedBox(big, w / 2, h, 0.04, -w / 4, y, 0.06, { all: half('#2c4f8f', 0) });
      paintedBox(big, w / 2, h, 0.04, w / 4, y, 0.06, { all: (p) => { p.rect(0, 0, p.w, p.h, '#c9ced6'); p.column(p.w - 1, '#e3ac2a'); } });
    });
    paintedBox(big, 0.08, 0.08, 0.04, 0, 0.04, 0.09, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') });
  });
  // A shield is strapped to the forearm, its face turned out to the side, away from the body.
  inHand.handR.shield.rotation.set(0, Math.PI / 2, 0);
  inHand.handL.shield.rotation.set(0, -Math.PI / 2, 0);
  holding('bow', (g) => {
    const wood = flat('#8a5a34', '#a8703f', '#5c3a20');
    paintedBox(g, 0.05, 0.12, 0.05, 0, 0, 0.05, { all: flat('#4c3122', '#6a4630', '#2f1f15') });        // the grip
    [-1, 1].forEach((s) => {
      paintedBox(g, 0.045, 0.2, 0.045, 0, s * 0.15, 0.02, { all: wood }).rotation.x = -s * 0.3;      // the limbs bend back
      paintedBox(g, 0.04, 0.1, 0.04, 0, s * 0.28, -0.03, { all: wood }).rotation.x = -s * 0.7;
    });
    paintedBox(g, 0.012, 0.6, 0.012, 0, 0, -0.06, { all: (p) => p.rect(0, 0, p.w, p.h, '#efe2c0') });    // the string
  }, -0.2);
  holding('key', (g) => paintedBox(g, 0.04, 0.18, 0.03, 0, -0.04, 0, { all: flat('#e3ac2a', '#ffd35a', '#a87a16') }));
  return (equip) => {
    for (const key of ['handR', 'handL']) for (const id of Object.keys(inHand[key])) inHand[key][id].visible = equip[key]?.id === id;
  };
}

/** The arrow the bow shoots: points along +z, the way it flies. */
export function makeArrow(paintedBox) {
  const arrowLook = new THREE.Group();
  paintedBox(arrowLook, 0.03, 0.03, 0.5, 0, 0, 0, { all: (p) => { p.rect(0, 0, p.w, p.h, '#8a5a34'); p.row(0, '#a8703f'); } });
  paintedBox(arrowLook, 0.06, 0.06, 0.08, 0, 0, 0.27, { all: flat(IRON[2], IRON[4], IRON[0]) });
  paintedBox(arrowLook, 0.1, 0.02, 0.1, 0, 0, -0.22, { all: (p) => p.rect(0, 0, p.w, p.h, '#efe2c0') });
  return arrowLook;
}
