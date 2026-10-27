import 'fake-indexeddb/auto';
import { beforeEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
let store, engine;
beforeEach(async () => {
  localStorage.clear(); vi.resetModules();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(readFileSync('public/' + url, 'utf8')) }));
  store = await import('../src/adapters/local/legacy-store.js'); engine = await import('../src/app/study-engine-composition.js');
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
  const off = engine.subscribe(() => seen.push(JSON.stringify(engine.getSnapshot())));
  const run = engine.createRun({ kind: 'test', feedback: false, items: qs });
  expect(seen.length).toBeGreaterThan(0);
  for (const change of [
    () => engine.answerCurrentDeferred(1), () => engine.tickCurrentRun(1000),
    () => engine.tickCurrentRun(3000), () => engine.setQuestionIndex(1),
    () => engine.toggleReviewQuestion(), () => engine.setQuestionIndex(0),
    () => engine.setRunPaused(true), () => engine.setRunPaused(false),
    () => engine.finishCurrentRun(),
  ]) {
    const before = seen.length; change(); expect(seen.length).toBeGreaterThan(before);
  }
  expect(engine.getSnapshot().last.ses.n).toBe(2);
  off(); const before = seen.length; engine.clearLastResult();
  expect(seen).toHaveLength(before);
});
it('cada actualización conserva el snapshot anterior de la sesión', () => {
  const qs = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8')).slice(0, 1);
  engine.createRun({ kind: 'sim', feedback: false, items: qs });
  const previous = engine.getSnapshot(), previousRun = previous.run, previousAnswers = previousRun.ans;

  engine.answerCurrentDeferred(qs[0].c);

  expect(previous.run).toBe(previousRun);
  expect(previousAnswers[0]).toBeUndefined();
  expect(engine.getSnapshot()).not.toBe(previous);
  expect(engine.getCurrentRun().ans[0]).toBe(qs[0].c);
  engine.clearActiveRun();
});
it('engine avisa del cambio de cuenta y mantiene la identidad de la sesión', () => {
  const qs = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8')).slice(0, 1);
  const run = engine.createRun({ kind: 'test', feedback: true, items: qs });
  expect(engine.getSnapshot().run).toBe(run);
  const fn = vi.fn(); const off = engine.subscribe(fn);
  store.switchAccount('another');
  expect(engine.getSnapshot().run).toBeNull(); expect(fn).toHaveBeenCalled(); off();
});
