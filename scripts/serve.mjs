// Servidor local de desarrollo: sirve dist/ (sin dependencias). Uso: npm start  [PORT=4173 HOST=127.0.0.1]
// Reproduce las cabeceras globales de Firebase, incluida la CSP, también en e2e.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const headers = Object.fromEntries(JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8')).hosting.headers.find(headerConfig => headerConfig.source === '**').headers.map(header => [header.key, header.value]));
// The emulator-only test server may frame and call the local Auth/Firestore emulators.
// Never add these loopback origins to Firebase Hosting's production CSP.
if (process.env.TAI_FIREBASE_EMULATORS === '1') {
  const policy = headers['Content-Security-Policy'];
  headers['Content-Security-Policy'] = policy
    .replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080 https://apis.google.com")
    .replace('frame-src ', 'frame-src http://127.0.0.1:9099 ');
}
const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT) || 4173, host = process.env.HOST || '127.0.0.1';
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};
createServer(async (req, res) => {
  try {
    let requestPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (requestPath.endsWith('/')) requestPath += 'index.html';
    const file = normalize(join(root, requestPath));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('Prohibido'); return; }
    if (!(await stat(file)).isFile()) throw new Error('no es fichero');
    res.writeHead(200, { ...headers, 'Content-Type': TIPOS[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); }
}).listen(port, host, () => console.log(`Servidor local: http://${host}:${port}`));
