import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';

describe('integración del motor con el historial local', () => {
  let engine;
  let store;
  let data;
  let tracker;
  let repository;
  let serial;

  beforeEach(async () => {
    vi.stubGlobal('fetch', async url => ({
      ok: true,
      json: async () => JSON.parse(readFileSync(`public/${url}`, 'utf8')),
    }));
    localStorage.clear();
    engine = await import('../../src/core/application/legacy-engine.js');
    store = await import('../../src/adapters/local/legacy-store.js');
    data = await import('../../src/adapters/http/legacy-data.js');
    await data.getMeta();
    serial = 0;
    repository = createLocalAttemptRepository(`attempt-engine-${Date.now()}-${Math.random()}`);
    tracker = createAttemptTracker({
      repository,
      createId: kind => `${kind}-${++serial}`,
      now: () => Date.now(),
      monotonicNow: () => performance.now(),
    });
    engine.setAttemptTracker(tracker);
    store.resetAll();
  });

  afterEach(() => {
    engine?.setAttemptTracker(null);
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('registra un intento nuevo y cada respuesta exactamente una vez, sin inventar eventos antiguos', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    engine.answerQuestion(run, question, question.c, 0);
    engine.finishRun(run);
    await tracker.flush();

    const session = await repository.getSession('guest', run.attemptSessionId);
    const attempt = await repository.getAttempt('guest', run.attemptIds[0]);
    const events = await repository.getEvents('guest', run.attemptIds[0]);
    expect(session.status).toBe('completed');
    expect(attempt).toMatchObject({ state: 'answered', response: question.c, outcome: 'correct' });
    expect(events.events.map(event => event.type)).toEqual(['open', 'answer', 'close']);
    expect(store.rec(question.i)[0]).toBe(1);
  });

  it('reanuda un guardado antiguo sin metadatos de intento ni crear historial retroactivo', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const saved = {
      kind: 'sim', idx: 0, ids: [question.i], savedAt: Date.now(), ans: [],
    };
    localStorage.setItem(`tai.run:${store.accountId() || 'guest'}`, JSON.stringify(saved));
    const pending = await engine.pendingRun(true);
    const resumed = engine.resumeRun(pending);
    expect(resumed.attemptSessionId).toBeUndefined();
    await tracker.flush();
    expect((await repository.getScopePage('guest')).attempts).toEqual([]);
    engine.clearActiveRun();
  });

  it('deja No lo sé pendiente, permite contestar al volver y bloquea el primer resultado', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    engine.answerQuestion(run, question, -1, 0);
    expect(run.ans[0]).toBeUndefined();
    expect(run.studyStates[0]).toBe('pending');
    expect(store.rec(question.i)).toBeUndefined();

    engine.answerQuestion(run, question, question.c, 0);
    engine.answerQuestion(run, question, (question.c + 1) % question.a.length, 0);
    expect(run.ans[0]).toBe(question.c);
    expect(run.studyStates[0]).toBe('answered');
    expect(store.rec(question.i)[0]).toBe(1);
  });

  it('persiste la consulta como blanco bloqueado y reconoce respuestas antiguas -1 como consulta', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.answerQuestion(run, question, -1, 0);
    engine.saveRun();
    engine.clearActiveRun();
    const pending = await engine.pendingRun(true);
    const resumed = engine.resumeRun(pending);
    expect(resumed.studyStates[0]).toBe('pending');

    expect(engine.revealCurrentSolution()).toBe(true);
    engine.saveRun();
    engine.clearActiveRun();
    const afterReveal = engine.resumeRun(await engine.pendingRun(true));
    expect(afterReveal.studyStates[0]).toBe('revealed');
    expect(afterReveal.ans[0]).toBeUndefined();
    engine.answerQuestion(afterReveal, question, question.c, 0);
    expect(afterReveal.studyStates[0]).toBe('revealed');
    expect(store.rec(question.i)).toBeUndefined();
    const result = engine.finishRun(afterReveal);
    expect(result.ses.b).toBe(1);
    expect(result.studyStates[0]).toBe('revealed');
    localStorage.setItem(`tai.run:${store.accountId() || 'guest'}`, JSON.stringify({
      kind: 'test', feedback: true, idx: 0, ids: [question.i], savedAt: Date.now(), ans: [-1],
    }));
    expect(engine.resumeRun(await engine.pendingRun(true)).studyStates[0]).toBe('revealed');
    engine.clearActiveRun();
  });
});
