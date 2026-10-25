import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
let sha = 'dev';
try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(); } catch {}
const buildId = `${version}+${sha}`;
export default defineConfig({
  resolve: { alias: {
    '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    '@adapters': fileURLToPath(new URL('./src/adapters', import.meta.url)),
    '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
    '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
  } },
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
