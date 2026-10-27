import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { createHighlight } from '../../src/core/domain/attempts/highlights.js';

describe('integración del motor con el historial local', () => {
  let engine;
  let store;
  let data;
  let tracker;
  let repository;
  let recovery;
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
    recovery = await import('../../src/app/pending-run-composition.js');
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
    store?.switchAccount(null);
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

  it('mantiene las escrituras de A en A al cambiar a B mientras A sigue guardando', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    store.switchAccount('account-a');
    let releaseA;
    const pendingA = new Promise(resolve => { releaseA = resolve; });
    const createSession = repository.createSession.bind(repository);
    vi.spyOn(repository, 'createSession').mockImplementation(async (scope, ...args) => {
      if (scope === 'account-a') await pendingA;
      return createSession(scope, ...args);
    });

    const runA = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    engine.answerQuestion(runA, question, question.c, 0);
    await vi.waitFor(() => expect(repository.createSession).toHaveBeenCalledWith('account-a', expect.any(Object)));

    store.switchAccount('account-b');
    const runB = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    engine.answerQuestion(runB, question, question.c, 0);
    releaseA();
    await tracker.flush();

    expect(await repository.getSession('account-a', runA.attemptSessionId)).toMatchObject({ status: 'interrupted' });
    expect(await repository.getAttempt('account-a', runA.attemptIds[0])).toMatchObject({ state: 'answered', outcome: 'correct' });
    expect(await repository.getSession('account-b', runB.attemptSessionId)).toMatchObject({ status: 'active' });
    expect(await repository.getAttempt('account-b', runB.attemptIds[0])).toMatchObject({ state: 'answered', outcome: 'correct' });
    expect(await repository.getAttempt('account-b', runA.attemptIds[0])).toBeUndefined();
    expect(await repository.getAttempt('account-a', runB.attemptIds[0])).toBeUndefined();
  });

  it('reanuda un guardado antiguo sin metadatos de intento ni crear historial retroactivo', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const saved = {
      kind: 'sim', idx: 0, ids: [question.i], savedAt: Date.now(), ans: [],
    };
    localStorage.setItem(`tai.run:${store.accountId() || 'guest'}`, JSON.stringify(saved));
    const pending = await recovery.pendingRun(true);
    const resumed = engine.resumeRun(pending);
    expect(resumed.attemptSessionId).toBeUndefined();
    await tracker.flush();
    expect((await repository.getScopePage('guest')).attempts).toEqual([]);
    engine.clearActiveRun();
  });

  it('usa el puerto inyectado para consultar y actualizar el historial del invitado', async () => {
    const history = { readRecentQuestionIds: vi.fn(() => []), saveRecentQuestionIds: vi.fn() };
    const result = await engine.quickItems(false, history);

    expect(history.readRecentQuestionIds).toHaveBeenCalledOnce();
    expect(history.saveRecentQuestionIds).toHaveBeenCalledOnce();
    expect(history.saveRecentQuestionIds).toHaveBeenCalledWith(result.items.map(question => question.i));
  });

  it('deja No lo sé pendiente, permite contestar al volver y bloquea el primer resultado', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    engine.answerQuestion(run, question, -1, 0);
    expect(engine.getCurrentRun().ans[0]).toBeUndefined();
    expect(engine.getCurrentRun().studyStates[0]).toBe('pending');
    expect(store.rec(question.i)).toBeUndefined();

    engine.answerQuestion(run, question, question.c, 0);
    engine.answerQuestion(run, question, (question.c + 1) % question.a.length, 0);
    expect(engine.getCurrentRun().ans[0]).toBe(question.c);
    expect(engine.getCurrentRun().studyStates[0]).toBe('answered');
    expect(store.rec(question.i)[0]).toBe(1);
  });

  it('persiste la consulta como blanco bloqueado y reconoce respuestas antiguas -1 como consulta', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.answerQuestion(run, question, -1, 0);
    engine.saveRun();
    engine.clearActiveRun();
    const pending = await recovery.pendingRun(true);
    const resumed = engine.resumeRun(pending);
    expect(resumed.studyStates[0]).toBe('pending');

    expect(engine.revealCurrentSolution()).toBe(true);
    engine.saveRun();
    engine.clearActiveRun();
    const afterReveal = engine.resumeRun(await recovery.pendingRun(true));
    expect(engine.getCurrentRun().studyStates[0]).toBe('revealed');
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
    expect(engine.resumeRun(await recovery.pendingRun(true)).studyStates[0]).toBe('revealed');
    engine.clearActiveRun();
  });

  it('registra y conserva marcas, confianza y descartes por pregunta', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    const mark = createHighlight({
      id: 'highlight-1', field: 'statement', sourceText: question.q, start: 0, end: 8,
      category: 'key', contentRevision: 'test-revision', createdAt: Date.now(), timing: 'before-answer',
    });
    expect(mark.ok).toBe(true);
    expect(engine.setCurrentConfidence('guess')).toBe(true);
    expect(engine.toggleCurrentDiscardedOption(1)).toBe(true);
    expect(engine.addCurrentHighlight(mark.value)).toBe(true);
    await tracker.flush();
    const events = await repository.getEvents('guest', run.attemptIds[0]);
    expect(events.events.map(event => event.type)).toEqual(['open', 'set-confidence', 'discard-option', 'add-highlight']);

    engine.saveRun();
    engine.setAttemptTracker(null);
    engine.clearActiveRun();
    const resumed = engine.resumeRun(await recovery.pendingRun(true));
    expect(resumed.confidences[0]).toBe('guess');
    expect(resumed.discardedOptions[0]).toEqual([1]);
    expect(resumed.highlights[0]).toMatchObject([{ id: 'highlight-1', timing: 'before-answer' }]);
  });

  it('limita confianza y descartes al periodo previo a responder sin cambiar la edición del simulacro', async () => {
    const question = (await data.getTema('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'sim', feedback: false, items: [question] });
    expect(engine.revealCurrentSolution()).toBe(false);
    expect(engine.setCurrentConfidence('sure')).toBe(true);
    expect(engine.toggleCurrentDiscardedOption(0)).toBe(true);
    engine.answerCurrentDeferred(1);
    expect(engine.setCurrentConfidence('guess')).toBe(false);
    expect(engine.toggleCurrentDiscardedOption(0)).toBe(false);
    engine.answerCurrentDeferred(2); // La edición de respuestas del simulacro se conserva.
    expect(engine.getCurrentRun().ans[0]).toBe(2);
    const result = engine.finishRun(run);
    expect(result.confidences[0]).toBe('sure');
    expect(result.discardedOptions[0]).toEqual([0]);
  });
});
