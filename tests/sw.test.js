// @vitest-environment node
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker() {
  const listeners = {}, saved = new Map(); let network = async () => new Response('{"apiKey":"test"}');
  const key = request => typeof request === 'string' ? request : request.url;
  const cache = { match: async request => saved.get(key(request))?.clone(), put: async (request, response) => { saved.set(key(request), response.clone()); } };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (name, cb) => { listeners[name] = cb; } },
    location: { origin: 'https://tai.test' }, URL, Response, setTimeout, clearTimeout,
    fetch: (...args) => network(...args), caches: { open: async () => cache, match: cache.match },
  });
  return {
    saved, network: fn => { network = fn; },
    get: async pathname => {
      let result; const pending = [];
      listeners.fetch({ request: new Request('https://tai.test/' + pathname), respondWith: p => { result = p; }, waitUntil: p => pending.push(p) });
      const response = await result; await Promise.all(pending); return response;
    },
  };
}
it('guarda la configuración recibida para poder recuperarla sin red', async () => {
  const w = worker(); expect((await w.get('firebase-config.json')).status).toBe(200);
  w.network(async () => { throw new Error('offline'); });
  const response = await w.get('firebase-config.json');
  expect(response).toBeInstanceOf(Response);
  expect(await response.json()).toEqual({ apiKey: 'test' });
});
it('usa la copia de configuración ante un error del servidor y da una respuesta válida si no hay copia', async () => {
  const w = worker(); await w.get('firebase-config.json');
  w.network(async () => new Response('error', { status: 503 }));
  expect(await (await w.get('firebase-config.json')).json()).toEqual({ apiKey: 'test' });
  const empty = worker(); empty.network(async () => { throw new Error('offline'); });
  expect((await empty.get('firebase-config.json')).type).toBe('error');
});

it('recupera el shell cacheado cuando el servidor responde 503', async () => {
 const w=worker(); await w.get('app.js'); w.network(async()=>new Response('error',{status:503}));
 expect((await w.get('app.js')).status).toBe(200);
});
