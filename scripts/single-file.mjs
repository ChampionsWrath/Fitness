// Builds the app into ONE self-contained HTML file (all JS/CSS inlined).
// Useful for hosting where only a single page can be served, e.g. a Claude Artifact.
// Usage: node scripts/single-file.mjs [outFile] [--fragment]
//   --fragment  omit <html>/<head>/<body> wrappers (for hosts that add their own)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist-single/transformation.html');

execSync('npx vite build --outDir dist-single-build --base ./', { stdio: 'inherit', env: { ...process.env, VITE_SINGLE_FILE: '1' } });

let html = readFileSync('dist-single-build/index.html', 'utf8');
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"><\/script>/g, (_, src) => `<script type="module">${escapeScript(readFileSync(`dist-single-build/${src}`, 'utf8'))}</script>`);
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)">/g, (_, href) => `<style>${readFileSync(`dist-single-build/${href}`, 'utf8')}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>/g, '');
html = html.replace(/<link rel="manifest"[^>]*>/g, '');
html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '');

if (fragment) {
  const title = html.match(/<title>[^<]*<\/title>/)?.[0] ?? '';
  const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
  const metas = [...html.matchAll(/<meta name="(apple-mobile-web-app-[^"]+|mobile-web-app-capable|theme-color)"[^>]*>/g)].map((m) => m[0]).join('\n');
  const body = (html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '').replace(/<script[\s\S]*?<\/script>/g, '');
  const scripts = [...html.matchAll(/<script type="module">[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
  html = `${title}\n${metas}\n${styles}\n${body}\n${scripts}`;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
