// Service worker: shell + datos, "stale-while-revalidate" para todo lo del mismo origen.
const V = 'tai-v72', DATA = 'tai-data'; // el banco descargado vive en su propia caché: un despliegue no lo borra
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => caches.open(DATA)).then(c => c.addAll(['data/index.json', 'data/meta.json'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/__/')) return; // Firebase/Google: red directa
  if (u.pathname.endsWith('/version.json')) { e.respondWith(fetch(r, { cache: 'no-store' })); return; } // para saber si hay versión nueva: nunca de caché
  if (u.pathname.endsWith('/firebase-config.json')) { // la configuración siempre de red; caché solo sin conexión
    e.respondWith((async () => {
      try {
        const res = await fetch(r, { cache: 'no-store' });
        if (!res.ok) throw new Error('configuración no disponible');
        const c = await caches.open(V);
        e.waitUntil(c.put(r, res.clone()).catch(() => {}));
        return res;
      } catch (err) {
        return (await caches.match(r, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }
  // shell (HTML/JS/CSS): red primero con límite de 3 s para no mezclar versiones; el resto, stale-while-revalidate
  if (r.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(u.pathname) && !u.pathname.endsWith('/sw.js')) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        // cache:'no-cache' obliga a revalidar: sin ello el HTML podía salir de la caché HTTP (1 h) y no casar con el JS nuevo
        const net = r.mode === 'navigate' ? fetch(u.href, { cache: 'no-cache' }) : fetch(r, { cache: 'no-cache' });
        // el límite de 3 s solo si hay copia en caché a la que recurrir; sin copia se espera a la red
        const hay = await c.match(r, { ignoreSearch: true });
        const res = hay ? await Promise.race([net, new Promise((_, no) => setTimeout(no, 3000))]) : await net;
        if (!res || !res.ok) throw new Error('shell no disponible');
        e.waitUntil(c.put(r, res.clone()).catch(() => {}));
        return res;
      } catch (err) {
        return (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' && await c.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(/\/(data|cards)\//.test(u.pathname) ? DATA : V);
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  })());
});
