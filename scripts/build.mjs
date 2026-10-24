// Compila la app e inyecta la versión: la de package.json + el commit (si hay git).
// También escribe public/version.json, que la app consulta para saber si hay una versión nueva.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
let sha = 'dev';
try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch (e) {}
const buildId = `${version}+${sha}`;

rmSync('public/app.js', { force: true });
rmSync('public/chunks', { recursive: true, force: true });
await build({
  entryPoints: ['src/main.ts'], bundle: true, splitting: true, minify: true, format: 'esm', target: 'safari15',
  outdir: 'public', entryNames: 'app', chunkNames: 'chunks/[name]-[hash]',
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(buildId) },
});
writeFileSync('public/version.json', JSON.stringify({ version, build: buildId, date: new Date().toISOString() }) + '\n');
console.log(`versión ${buildId}`);
