import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { gradingRevision } from '../../src/core/domain/pending-run.js';
import { officialExamQuestionIds } from '../../src/core/domain/simulation-scenarios.js';
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
    engine = await import('../../src/app/composition/study/study-engine-composition.js');
    store = await import('../../src/adapters/local/local-progress-store.js');
    data = await import('../../src/adapters/http/study-question-catalog.js');
    recovery = await import('../../src/app/composition/study/pending-run-composition.js');
    await data.getMetadata();
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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

  it('suspende el repaso privado del UID sin nota ni cierre, incluso ante callbacks antiguos', async () => {
    store.switchAccount('student');
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'rev', feedback: true, items: [question] });
    engine.startCurrentQuestion();
    expect(engine.suspendPrivateRun()).toBe(true);
    engine.answerQuestion(run, question, question.c, 0);
    engine.answerDeferred(run, question.c);
    expect(engine.finishRun(run)).toBeNull();
    expect(store.getSessions()).toHaveLength(0);
    expect(store.rec(question.i)).toBeUndefined();
    await tracker.flush();
    expect((await repository.getSession('student', run.attemptSessionId)).status).toBe('active');
    expect((await repository.getEvents('student', run.attemptIds[0])).events.map(event => event.type)).toEqual(['open', 'pause']);
    const privateCheckpoint = localStorage.getItem('tai.run:student');
    expect(await recovery.pendingRun(false)).toBeNull();
    const sample = engine.createRun({ kind: 'rev', feedback: true, publicSample: true, items: [question] });
    expect(engine.suspendPrivateRun()).toBe(false);
    engine.saveRun();
    expect(JSON.parse(localStorage.getItem('tai.sample-run:student')).publicSample).toBe(true);
    engine.finishRun(sample, 'interrupted');
    expect(localStorage.getItem('tai.run:student')).toBe(privateCheckpoint);
    const resumed = engine.resumeRun(await recovery.pendingRun(true));
    expect(resumed.attemptIds).toEqual(run.attemptIds);
    expect(resumed.attemptSessionId).toBe(run.attemptSessionId);
    expect(engine.finishRun(run)).toBeNull();
    engine.finishRun(resumed, 'interrupted');
  });

  it('mantiene las consultas no puntuables fuera de progreso, historial y denominador tras reanudar', async () => {
    const [original, scored] = (await data.getTopicQuestions('T1.01')).slice(0, 2);
    const consultation = { ...original, np: 1 };
    const run = engine.createRun({ kind: 'test', feedback: true, items: [consultation, scored] });
    engine.startCurrentQuestion();
    engine.answerQuestion(run, consultation, consultation.c, 0);
    engine.setQuestionIndex(1);
    engine.startCurrentQuestion();
    engine.answerCurrentQuestion(scored.c, 0);
    expect(engine.saveRun()).toBe(true);
    engine.clearActiveRun();
    const saved = JSON.parse(localStorage.getItem('tai.run:guest'));
    expect(engine.resumeRun({ saved, items: [original, scored], account: null })).toBeNull();
    const resumed = engine.resumeRun({ saved, items: [consultation, scored], account: null });
    const result = engine.finishRun(resumed);
    await tracker.flush();
    expect(result.ses).toMatchObject({ n: 1, a: 1, f: 0, b: 0, nota: 100, fails: [] });
    expect(result.items).toHaveLength(2);
    expect(store.rec(consultation.i)).toBeUndefined();
    expect((await repository.getScopePage('guest')).attempts.map(attempt => attempt.questionId)).toEqual([scored.i]);
    expect(await repository.getAttempt('guest', resumed.attemptIds[1])).toMatchObject({ outcome: 'correct' });
  });

  it('termina una sesión de consulta sin escribir una nota ni un intento', async () => {
    const [original] = await data.getTopicQuestions('T1.01');
    const item = { ...original, np: 1 };
    const run = engine.createRun({ kind: 'test', feedback: true, items: [item] });
    engine.answerCurrentQuestion(-1, 0);
    expect(engine.finishRun(run).ses).toMatchObject({ n: 0, a: 0, f: 0, b: 0, temas: {} });
    expect(store.getSessions()).toHaveLength(0);
    expect((await repository.getScopePage('guest')).attempts).toEqual([]);
  });

  it('impide puntuar una figura ausente desde catálogo, constructor directo y checkpoint previo a la cuarentena', async () => {
    const id = 'AS09-P1-48';
    const raw = JSON.parse(readFileSync('public/data/T3.05.json', 'utf8')).find(q => q.i === id);
    const [fromCatalog] = await data.getQuestions([id]);
    expect(fromCatalog.np).toBe(1);
    expect(engine.createRun({ kind: 'sim', feedback: false, items: [raw] })).toBeNull();
    const saved = { kind: 'sim', feedback: false, ids: [id], idx: 0, ans: [0], gradingRevisions: [gradingRevision(raw)], savedAt: Date.now() };
    localStorage.setItem('tai.run:guest', JSON.stringify(saved));
    expect(await recovery.pendingRun(true)).toBeNull();
    expect(engine.resumeRun({ saved, items: [raw], account: null })).toBeNull();
    const consultation = engine.createRun({ kind: 'test', feedback: true, items: [raw] });
    engine.answerCurrentQuestion(raw.c, 0);
    expect(engine.finishRun(consultation).ses.n).toBe(0);
    expect(store.rec(id)).toBeUndefined();
  });

  it('reanuda el caso histórico con el contexto recuperado del catálogo y sin copiar su texto al checkpoint', async () => {
    store.switchAccount('student');
    const raw = await data.getScenarios();
    const entry = raw['TAI2024B-S1'];
    const questions = entry.q.slice(0, 2).map(question => ({ ...question, supTexto: entry.texto }));
    const run = engine.createRun({ kind: 'sim', feedback: false, items: questions });
    engine.answerDeferred(run, 0);
    expect(engine.suspendPrivateRun()).toBe(true);
    const checkpoint = JSON.parse(localStorage.getItem('tai.run:student'));
    expect(checkpoint.ids).toEqual(questions.map(q => q.i));
    expect(JSON.stringify(checkpoint)).not.toContain(entry.texto.slice(0, 40));
    const pending = await recovery.pendingRun(true);
    const restored = engine.resumeRun(pending);
    expect(restored.items[0].supTexto).toBe(entry.texto);
    expect(restored.attemptIds).toEqual(run.attemptIds);
    expect(restored.ans[0]).toBe(0);
    engine.finishRun(restored, 'interrupted');
  });

  it('rehidrata la convocatoria íntegra con el supuesto real y conserva su vencimiento aunque la app esté cerrada', async () => {
    const start = Date.now();
    let time = start;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
    try {
      const officialExam = { profile: 'tai-li-2025', scenarioId: 'L2025A-S1', quota: 'general', deadlineAt: start + 120 * 60000 };
      const ids = officialExamQuestionIds(officialExam.scenarioId);
      const items = await data.getQuestions(ids);
      expect(items).toHaveLength(100);
      expect(items[80].supTexto).toBeTruthy();
      const config = { kind: 'sim', feedback: false, limit: 120, officialExam, items };
      expect(engine.createRun({ ...config, items: [...items].reverse() })).toBeNull();
      const run = engine.createRun(config);
      expect(engine.setRunPaused(true)).toBe(false);
      engine.answerDeferred(run, items[0].c);
      expect(engine.saveRun()).toBe(true);
      engine.clearActiveRun();
      time += 119 * 60000;
      const pending = await recovery.pendingRun(true);
      expect(pending.saved.officialExam).toEqual(officialExam);
      const resumed = engine.resumeRun(pending);
      expect(engine.currentSecondsRemaining()).toBe(60);
      expect(resumed.items[80].supTexto).toBe(items[80].supTexto);
      time += 60000;
      engine.answerDeferred(resumed, (items[0].c + 1) % 4);
      expect(engine.getCurrentRun().ans[0]).toBe(items[0].c);
      expect(engine.toggleDeferredBlank()).toBe(false);
      const result = engine.finishCurrentRun('timeout');
      expect(result.officialExam).toEqual(officialExam);
      expect(result.ses).toMatchObject({ n: 100, a: 1, b: 99, secs: 7200, scorePending: true });
    } finally {
      clock.mockRestore();
      engine.clearActiveRun();
    }
  });

  it('mantiene las escrituras de A en A al cambiar a B mientras A sigue guardando', async () => {
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
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

  it('mantiene los descartes ordenados y los bloquea tras responder una pregunta de práctica', async () => {
    const question = (await data.getTopicQuestions('T1.01')).find(item => !item.np);
    const run = engine.createRun({ kind: 'test', feedback: true, items: [question] });

    expect(engine.toggleCurrentDiscardedOption(-1)).toBe(false);
    expect(engine.toggleCurrentDiscardedOption(question.a.length)).toBe(false);
    expect(engine.toggleCurrentDiscardedOption(2)).toBe(true);
    expect(engine.toggleCurrentDiscardedOption(1)).toBe(true);
    expect(engine.getCurrentRun().discardedOptions[0]).toEqual([1, 2]);
    expect(engine.toggleCurrentDiscardedOption(2)).toBe(true);
    expect(engine.getCurrentRun().discardedOptions[0]).toEqual([1]);

    engine.answerQuestion(run, question, question.c, 0);
    expect(engine.toggleCurrentDiscardedOption(0)).toBe(false);
    expect(engine.getCurrentRun().discardedOptions[0]).toEqual([1]);
  });
});
