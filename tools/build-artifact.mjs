// Baut aus den Quelldateien eine einzelne HTML-Datei für die Claude-Artifact-Vorschau.
// Die normale Webversion (index.html) braucht diesen Schritt NICHT.
// Unterschiede: Three.js kommt vom CDN (jsDelivr), Schriften von Google Fonts, Rest ist eingebettet.
//   node tools/build-artifact.mjs  →  dist/artifact.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const order = ['util', 'settings', 'map', 'textures', 'world', 'face', 'ghost', 'player', 'scares', 'audio', 'input', 'ui', 'main'];
let js = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';\n";
for (const name of order) {
  let src = read(`js/${name}.js`);
  src = src.replace(/^import .* from '(\.\/|\.\.\/vendor\/).*';\s*$/gm, '');
  src = src.replace(/^export (const|let|function|class|async function) /gm, '$1 ');
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`Nicht unterstützte import/export-Syntax in ${name}.js`);
  js += `\n// ---- ${name}.js ----\n${src}`;
}

let css = read('css/style.css').replace(/\/\*FONTS-START\*\/[\s\S]*?\/\*FONTS-END\*\//, '');
const html = read('index.html');
const body = html.slice(html.indexOf('<!--GAME-START-->') + 17, html.indexOf('<!--GAME-END-->'));

const out = `<title>Die fünf Schlüssel</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap">
<style>
${css}
</style>
${body}
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), out);
writeFileSync(join(root, 'dist/bundle-check.mjs'), js.replace(/^import \* as THREE.*$/m, 'const THREE = {};'));
console.log(`dist/artifact.html geschrieben (${(out.length / 1024).toFixed(0)} KB)`);
