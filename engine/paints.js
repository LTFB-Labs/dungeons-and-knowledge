// @ts-check
// Paint as data. A painted box (characters.js: createPainter) is painted by a function; here the same is said
// with a list of steps, so a thing can be described without code:
//   ['fill', colour]                         the whole face
//   ['rect', x, y, w, h, colour]   ['px', x, y, colour]   ['row', y, colour]   ['column', x, colour]
//   ['dots', [[x, y], ...], colour]          several pixels
//   ['speckle', colour, share]               scattered pixels: `share` of the face
//   ['shine', x, y, colour]   ['shines', [[x, y], ...], colour]      pixels that glow by themselves
//   ['each', 'x', from, to, step, [steps]]   for (x = from; x < to; x += step)
//   ['when', { param: value }, [steps], [steps otherwise]]
//   ['use', 'recipe', { ...its colours }]    a named recipe (below, or the game's own)
// A number may be a sum as text (expressions.js) with `w` and `h` (the face in pixels), the names of the loops
// round it and the thing's own values: 'h - 1', 'floor(w / 2) - 1'. A colour is '#rrggbb', '$name' (a value of
// the thing or of the recipe: '$colours.0', '$base'), or { of: [colours], at: sum } (one of a list).
// A face is a list of steps, one step, or the name of a recipe; a paint is { all, front, back, left, right, top, bottom }
// (or just what `all` would be).
import { value } from './expressions.js';

/** Recipes every game has. `$base`, `$light`, `$dark`... are given by whoever uses them. */
export const RECIPES = {
  flat: [['fill', '$base']],
  // a flat colour with a lit edge on top and a shaded one below
  edged: [['fill', '$base'], ['row', 0, '$light'], ['row', 'h - 1', '$dark']],
  // cloth: lit on the left, shaded on the right and below
  cloth: [['fill', '$base'], ['column', 0, '$light'], ['column', 'w - 1', '$dark'], ['row', 'h - 1', '$dark']],
  speckled: [['fill', '$base'], ['speckle', '$fleck', '$share']],
  stone: [['fill', '$base'], ['speckle', '$light', 0.2], ['speckle', '$dark', 0.15], ['row', 0, '$light']],
  wood: [['fill', '$base'], ['speckle', '$light', 0.15], ['row', 0, '$light']],
  planks: [['fill', '$base'], ['speckle', '$light', 0.1], ['each', 'y', 3, 'h', 4, [['row', 'y', '$dark']]]],
  // an iron plate: lit above and on the left, shaded below and on the right, a rivet in each corner
  iron: [['fill', '$base'], ['speckle', '$fleck', 0.08], ['row', 0, '$light'], ['column', 0, '$lit'], ['row', 'h - 1', '$dark'], ['column', 'w - 1', '$fleck'],
    ['dots', [[1, 1], ['w - 2', 1], [1, 'h - 2'], ['w - 2', 'h - 2']], '$dark']],
  // anything with a trim of another colour all round: `use` it after the base
  trim: [['row', 0, '$light'], ['row', 'h - 1', '$dark'], ['column', 0, '$light'], ['column', 'w - 1', '$dark']],
  // every pixel glows by itself
  glowing: [['each', 'y', 0, 'h', 1, [['each', 'x', 0, 'w', 1, [['shine', 'x', 'y', '$base']]]]]],
};

const isStep = (face) => Array.isArray(face) && typeof face[0] === 'string';

/**
 * Turns a paint in data into what `paintedBox` takes: { all: (g) => {}, front: ... }.
 * @param {any} paint
 * @param {Record<string, any>} env the values of the thing (and of the loops the part is in)
 * @param {Record<string, any>} [recipes] the game's own recipes, by name
 */
export function painter(paint, env, recipes = {}) {
  const faces = Array.isArray(paint) || typeof paint === 'string' ? { all: paint } : paint;
  const out = {};
  for (const [side, face] of Object.entries(faces)) out[side] = (g) => run(face, g, { ...env, w: g.w, h: g.h }, recipes);
  return out;
}

function colour(c, env) {
  if (typeof c === 'string') return c.startsWith('$') ? value(c.slice(1), env) : c;
  return colour(c.of[value(c.at, env)], env);
}
function run(face, g, env, recipes) {
  if (typeof face === 'string') return run(['use', face], g, env, recipes);
  const steps = isStep(face) ? [face] : face;
  const n = (v) => value(v, env);
  for (const step of steps) {
    const [what, a, b, c, d, e] = step;
    if (what === 'fill') g.rect(0, 0, g.w, g.h, colour(a, env));
    else if (what === 'rect') g.rect(n(a), n(b), n(c), n(d), colour(e, env));
    else if (what === 'px') g.px(n(a), n(b), colour(c, env));
    else if (what === 'row') g.row(n(a), colour(b, env));
    else if (what === 'column') g.column(n(a), colour(b, env));
    else if (what === 'dots') for (const [x, y] of a) g.px(n(x), n(y), colour(b, env));
    else if (what === 'speckle') g.speckle(colour(a, env), typeof b === 'string' && b.startsWith('$') ? value(b.slice(1), env) : n(b));
    else if (what === 'shine') g.shine(n(a), n(b), colour(c, env));
    else if (what === 'shines') for (const [x, y] of a) g.shine(n(x), n(y), colour(b, env));
    else if (what === 'each') { const inner = { ...env }; for (inner[a] = n(b); inner[a] < n(c); inner[a] += n(d)) run(e, g, inner, recipes); }
    else if (what === 'when') { const steps2 = matches(a, env) ? b : c; if (steps2) run(steps2, g, env, recipes); }
    else if (what === 'use') {
      const recipe = recipes[a] ?? RECIPES[a];
      if (!recipe) throw new Error(`no paint recipe "${a}"`);
      const given = {};
      for (const [name, v] of Object.entries(b ?? {})) given[name] = typeof v === 'number' ? v : colour(v, env);      // its colours, worked out here
      run(recipe, g, { ...env, ...given }, recipes);
    } else throw new Error(`no paint step "${what}"`);
  }
}

/** Does `env` have these values? { suit: 'royal' }, { pose: ['poke', 'count'] }. */
export function matches(wanted, env) {
  for (const [name, want] of Object.entries(wanted)) {
    const have = name.includes('.') ? value(name, env) : env[name];
    if (Array.isArray(want) ? !want.includes(have) : have !== want) return false;
  }
  return true;
}
