// @ts-check
// Small sums written as text, for things described in data: '0.1 + rand() * 0.06', 'lean.0 * 0.9', 'h - 1',
// '1 + 0.02 * sin(t * 2.1 + phase)'. A number stays a number. Names are looked up in `env` (a plain object);
// a dot goes into a list or an object: 'lean.0', 'colours.1'. No eval: the text is parsed here, once, into a
// function, so a sum that runs every frame makes nothing new.
//   + - * / %   ( )   unary -   == != < > <= >=  (1 or 0)
//   sin cos sqrt abs floor round min max pow, PI, rand() (the dice in env.rand)

const FUNCTIONS = { sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, round: Math.round, min: Math.min, max: Math.max, pow: Math.pow };
const compiled = new Map();

/**
 * @param {number | string} source a number, or a sum as text
 * @returns {(env: Record<string, any>) => any}
 */
export function compile(source) {
  if (typeof source === 'number') return () => source;
  let made = compiled.get(source);
  if (!made) compiled.set(source, made = parse(String(source)));
  return made;
}
/** The value of `source` in `env`, now. */
export const value = (source, env) => (typeof source === 'number' ? source : compile(source)(env));

function parse(text) {
  const tokens = text.match(/\d+\.?\d*(?:e-?\d+)?|\.\d+|[A-Za-z_$][\w$]*(?:\.[\w$]+)*|==|!=|<=|>=|[-+*/%()<>,]/g) ?? [];
  if (tokens.join('') !== text.replace(/\s+/g, '')) throw new Error(`cannot read the sum: ${text}`);
  let at = 0;
  const peek = () => tokens[at];
  const take = (token) => { if (tokens[at] !== token) throw new Error(`expected ${token} in: ${text}`); at++; };

  function primary() {
    const token = tokens[at++];
    if (token === undefined) throw new Error(`the sum stops early: ${text}`);
    if (token === '(') { const inner = compare(); take(')'); return inner; }
    if (/^[\d.]/.test(token)) { const n = Number(token); return () => n; }
    if (!/^[A-Za-z_$]/.test(token)) throw new Error(`unexpected ${token} in: ${text}`);
    if (peek() === '(') {
      at++;
      const args = [];
      if (peek() !== ')') { args.push(compare()); while (peek() === ',') { at++; args.push(compare()); } }
      take(')');
      if (token === 'rand') return (env) => env.rand();
      const fn = FUNCTIONS[token];
      if (!fn) throw new Error(`no function ${token} in: ${text}`);
      const [a, b] = args;
      return args.length === 1 ? (env) => fn(a(env)) : (env) => fn(a(env), b(env));
    }
    if (token === 'PI') return () => Math.PI;
    if (!token.includes('.')) return (env) => env[token];
    const path = token.split('.');
    return (env) => { let v = env; for (let k = 0; k < path.length; k++) v = v?.[path[k]]; return v; };
  }
  function unary() {
    if (peek() === '-') { at++; const inner = unary(); return (env) => -inner(env); }
    return primary();
  }
  function product() {
    let left = unary();
    for (let op = peek(); op === '*' || op === '/' || op === '%'; op = peek()) {
      at++;
      const a = left, b = unary();
      left = op === '*' ? (env) => a(env) * b(env) : op === '/' ? (env) => a(env) / b(env) : (env) => a(env) % b(env);
    }
    return left;
  }
  function sum() {
    let left = product();
    for (let op = peek(); op === '+' || op === '-'; op = peek()) {
      at++;
      const a = left, b = product();
      left = op === '+' ? (env) => a(env) + b(env) : (env) => a(env) - b(env);
    }
    return left;
  }
  function compare() {
    const a = sum();
    const op = peek();
    if (!['==', '!=', '<', '>', '<=', '>='].includes(op)) return a;
    at++;
    const b = sum();
    const test = { '==': (x, y) => x === y, '!=': (x, y) => x !== y, '<': (x, y) => x < y, '>': (x, y) => x > y, '<=': (x, y) => x <= y, '>=': (x, y) => x >= y }[op];
    return (env) => (test(a(env), b(env)) ? 1 : 0);
  }
  const whole = compare();
  if (at < tokens.length) throw new Error(`unexpected ${tokens[at]} in: ${text}`);
  return whole;
}
