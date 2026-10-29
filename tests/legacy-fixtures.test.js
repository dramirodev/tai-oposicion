import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const progressFixture = JSON.parse(readFileSync('tests/fixtures/legacy-progress.json', 'utf8'));
const runsFixture = JSON.parse(readFileSync('tests/fixtures/legacy-runs.json', 'utf8'));
let store;
let engine;
let data;
let recovery;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
  localStorage.clear();
  vi.stubGlobal('fetch', async url => ({
    ok: true,
    json: async () => JSON.parse(readFileSync(`public/${url}`, 'utf8')),
  }));
  store = await import('../src/adapters/local/legacy-store.js');
  engine = await import('../src/app/composition/study/study-engine-composition.js');
  data = await import('../src/adapters/http/study-question-catalog.js');
  recovery = await import('../src/app/composition/study/pending-run-composition.js');
  await data.getMetadata();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fixtures de compatibilidad anteriores al historial por intento', () => {
  it('importa y vuelve a exportar tai.v1 conservando estadísticas, sesiones, tarjetas y temas vistos', () => {
    store.importAll(JSON.stringify(progressFixture));

    expect(store.rec('TAI2024B-P1-01')).toEqual(progressFixture.stats['TAI2024B-P1-01']);
    expect(store.getSessions()).toHaveLength(1);
    expect(store.getCardsDoc()['FC-Q-TAI2024B-P1-01']).toEqual(progressFixture.cards['FC-Q-TAI2024B-P1-01']);
    expect(store.getSeen()).toEqual(['T1.01']);

    const exported = JSON.parse(store.exportAll());
    expect(exported.stats).toEqual(progressFixture.stats);
    expect(exported.sessions).toEqual(progressFixture.sessions);
    expect(exported.cards).toEqual(progressFixture.cards);
  });

  it.each([
    ['práctica contestada', 'practiceAnswered', 0, 'test'],
    ['práctica pendiente', 'practicePending', undefined, 'test'],
    ['simulacro en curso', 'simulationInProgress', undefined, 'sim'],
  ])('reanuda la %s con las respuestas y modalidad antiguas', async (_label, key, answer, kind) => {
    const saved = runsFixture[key];
    localStorage.setItem('tai.run:guest', JSON.stringify(saved));

    const pending = await recovery.pendingRun(true);
    expect(pending).not.toBeNull();
    const run = engine.resumeRun(pending);

    expect(run.kind).toBe(kind);
    expect(run.ans[0]).toBe(answer);
    expect(run.review).toEqual(saved.review);
  });
});
