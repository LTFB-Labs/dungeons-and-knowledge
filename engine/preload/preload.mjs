// Writes into a game's index.html the list of every module the game will load, as <link rel="modulepreload">,
// so the browser asks for all of them at once instead of finding them one import at a time (four rounds deep).
// The list goes between <!-- preload:start --> and <!-- preload:end --> in <head>; run it after changing imports
// (publish.sh runs it). Files that may be missing on purpose (stone-sample.js) are left out.
// Usage: node preload.mjs <game app dir> [entry, default game.js]
import fs from 'node:fs';
import path from 'node:path';

const [, , appDir, entry = 'game.js'] = process.argv;
const root = path.resolve(appDir);
const SKIP = new Set(['stone-sample.js']);
const IMPORTS = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

const found = [];
const seen = new Set();
const external = new Set();
const queue = [entry];
while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const file = path.join(root, url);
  if (!fs.existsSync(file)) continue;
  found.push(url);
  for (const m of fs.readFileSync(file, 'utf8').matchAll(IMPORTS)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (/^https?:/.test(spec)) { external.add(spec); continue; }
    if (!spec.startsWith('.')) continue;
    const next = path.posix.normalize(path.posix.join(path.posix.dirname(url), spec));
    if (!SKIP.has(path.posix.basename(next))) queue.push(next);
  }
}

const links = [...external, ...found].map((href) => `  <link rel="modulepreload" href="${href}">`).join('\n');
const page = path.join(root, 'index.html');
let html = fs.readFileSync(page, 'utf8');
const block = `  <!-- preload:start: every module the game loads, fetched at once (packages/blocks-engine/preload/preload.mjs) -->\n${links}\n  <!-- preload:end -->`;
if (html.includes('<!-- preload:start')) html = html.replace(/ {2}<!-- preload:start[\s\S]*?<!-- preload:end -->/, block);
else html = html.replace('</head>', `${block}\n</head>`);
fs.writeFileSync(page, html);
console.log(`${path.basename(path.dirname(root))}: ${found.length} modules and ${external.size} from a CDN listed in index.html`);
