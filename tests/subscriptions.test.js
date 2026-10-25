import 'fake-indexeddb/auto';
import { beforeEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
let store, engine;
beforeEach(async () => {
  localStorage.clear(); vi.resetModules();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(readFileSync('public/' + url, 'utf8')) }));
  store = await import('../src/adapters/local/legacy-store.js'); engine = await import('../src/core/application/legacy-engine.js');
  await (await import('../src/adapters/http/legacy-data.js')).getMeta();
});
it('store avisa después de persistir y permite cancelar la suscripción', () => {
  const snapshots = [];
  const off = store.subscribe(() => snapshots.push(JSON.parse(localStorage.getItem('tai.v1:guest'))));
  store.record('Q1', 'T1.01', 0, 1000);
  store.setCfg('ui', { theme: 'dark', size: 1 });
  expect(snapshots).toHaveLength(2);
  expect(snapshots[0].stats.Q1[0]).toBe(1);
  expect(snapshots[1].cfg.ui.theme).toBe('dark');
  off(); store.resetAll(); expect(snapshots).toHaveLength(2);
});
it('engine notifica creación, respuestas, reloj, navegación, revisión, pausa y cierre', () => {
  const qs = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8')).slice(0, 2);
  const seen = [];
  const off = engine.subscribe(() => seen.push(JSON.stringify(engine.state)));
  const run = engine.createRun({ kind: 'test', feedback: false, items: qs });
  expect(seen.length).toBeGreaterThan(0);
  for (const change of [
    () => engine.answerDeferred(run, 1), () => engine.tickRun(run, 1000),
    () => engine.tickRun(run, 3000), () => { run.idx = 1; },
    () => { run.review = [1]; }, () => { run.review.push(0); },
    () => { run.paused = true; }, () => { run.paused = false; },
    () => engine.finishRun(run),
  ]) {
    const before = seen.length; change(); expect(seen.length).toBeGreaterThan(before);
  }
  expect(engine.state.last.ses.n).toBe(2);
  off(); const before = seen.length; engine.state.last = null;
  expect(seen).toHaveLength(before);
});
it('engine avisa del cambio de cuenta y mantiene la identidad de la sesión', () => {
  const qs = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8')).slice(0, 1);
  const run = engine.createRun({ kind: 'test', feedback: true, items: qs });
  expect(engine.state.run).toBe(run);
  const fn = vi.fn(); const off = engine.subscribe(fn);
  store.switchAccount('another');
  expect(engine.state.run).toBeNull(); expect(fn).toHaveBeenCalled(); off();
});
