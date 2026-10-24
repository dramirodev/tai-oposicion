import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
let sha = 'dev';
try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(); } catch {}
const buildId = `${version}+${sha}`;
export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'tai-shell',
    closeBundle() {
      // public/ también puede contener salidas antiguas de esbuild en una copia local.
      rmSync('dist/app.js', { force: true });
      rmSync('dist/chunks', { recursive: true, force: true });
      const assets = readdirSync('dist/assets').map(f => `assets/${f}`);
      const source = readFileSync('public/sw.js', 'utf8');
      const shell = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/icon-180.png', ...assets];
      writeFileSync('dist/sw.js', source.replace(/const SHELL = .*;/, `const SHELL = ${JSON.stringify(shell)};`));
      writeFileSync('dist/version.json', JSON.stringify({ version, build: buildId, date: new Date().toISOString() }) + '\n');
    },
  }],
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(buildId) },
  build: { target: 'safari15', outDir: 'dist', emptyOutDir: true },
});
