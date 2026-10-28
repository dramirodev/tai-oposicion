import { afterEach, expect, it, vi } from 'vitest';
import { createCardsComposition } from '../src/app/composition/cards/cards-composition.js';
import { saveCardsSession } from '../src/adapters/local/cards-session.js';

afterEach(() => localStorage.clear());

it('combina tarjetas curatoriales válidas y tarjetas de preguntas falladas con caché por tema', async () => {
  const loadQuestionMetadata = vi.fn(async () => {});
  const loadJson = vi.fn(async url => url === 'cards/index.json'
    ? { temas: { 'T01': true } }
    : [
      { id: 'curated-1', q: 'Pregunta', a: 'Respuesta' },
      { id: 'missing-answer', q: 'Sin respuesta' },
      { id: 'editorial-review', q: 'Pendiente', a: 'Respuesta', revisar: true },
    ]);
  const dependencies = {
    loadQuestionMetadata,
    failedCardQuestionIds: () => ['q1'],
    loadQuestionsById: vi.fn(async () => [{ i: 'q1', t: 'T01', o: 'O', q: '¿Cuál?', a: ['A', 'B'], c: 1, np: 42 }]),
    loadJson,
    verifiedSources: { q1: { url: 'https://example.test/q1', verified: true } },
    readPreferences: () => ({}), savePreferences: vi.fn(), accountId: () => 'account-1',
    getCards: () => ({}), getSeen: () => [], getRecord: () => undefined, now: () => 1000, day: 86_400_000,
    topicName: id => id, grade: vi.fn(), remove: vi.fn(), getReport: () => undefined, saveReport: vi.fn(),
  };
  const composition = createCardsComposition(dependencies);

  const cards = await composition.loadAllCards();
  await composition.loadAllCards();

  expect(cards.map(card => card.id)).toEqual(['curated-1', 'FC-Q-q1']);
  expect(cards[0].t).toBe('T01');
  expect(cards[1]).toMatchObject({ q: '¿Cuál?', a: 'B', np: 42, source: { verified: true } });
  expect(loadQuestionMetadata).toHaveBeenCalledTimes(2);
  expect(loadJson).toHaveBeenCalledTimes(2);
});

it('reanuda en la misma cuenta después de recrear el controlador y descarta el checkpoint en otra cuenta', async () => {
  let accountId = 'account-resume';
  const dependencies = {
    loadQuestionMetadata: async () => {}, failedCardQuestionIds: () => [], loadQuestionsById: async () => [],
    loadJson: async url => url === 'cards/index.json' ? { temas: { T01: true } } : [{ id:'resume-card', q:'Pregunta', a:'Respuesta' }],
    verifiedSources: {}, readPreferences: () => ({}), savePreferences: vi.fn(), accountId: () => accountId,
    getCards: () => ({}), getSeen: () => [], getRecord: () => undefined, now: () => Date.now(), day: 86_400_000,
    topicName: id => id, grade: vi.fn(), remove: vi.fn(), getReport: () => undefined, saveReport: vi.fn(),
  };
  const firstController = createCardsComposition(dependencies).services;
  const firstPlan = await firstController.loadPlan(firstController.getPreferences());
  firstController.startSession(firstPlan.cards, ['resume-card']);
  firstController.reveal();
  const revealed = createCardsComposition(dependencies).services;
  await revealed.loadPlan(revealed.getPreferences());
  expect(revealed.getSession()).toMatchObject({ index:0, revealed:true, results:[0,0,0], items:[{ id:'resume-card' }] });
  revealed.grade(2);

  const restored = createCardsComposition(dependencies).services;
  await restored.loadPlan(restored.getPreferences());
  expect(restored.getSession()).toMatchObject({ index:1, revealed:false, results:[0,0,1], items:[{ id:'resume-card' }] });

  accountId = 'another-account';
  const otherAccount = createCardsComposition(dependencies).services;
  await otherAccount.loadPlan(otherAccount.getPreferences());
  expect(otherAccount.getSession()).toBeNull();

  restored.clearSession();
  expect(localStorage.getItem('tai.cards-session.v1.account-resume')).toBeNull();
});

it('no restaura la sesión de una cuenta si cambia durante la carga de tarjetas', async () => {
  let accountId = 'account-before';
  let resolveMetadata;
  const metadataPending = new Promise(resolve => { resolveMetadata = resolve; });
  const dependencies = {
    loadQuestionMetadata: () => metadataPending, failedCardQuestionIds: () => [], loadQuestionsById: async () => [],
    loadJson: async url => url === 'cards/index.json' ? { temas: { T01: true } } : [{ id:'saved-card', q:'Pregunta', a:'Respuesta' }],
    verifiedSources: {}, readPreferences: () => ({}), savePreferences: vi.fn(), accountId: () => accountId,
    getCards: () => ({}), getSeen: () => [], getRecord: () => undefined, now: () => Date.now(), day: 86_400_000,
    topicName: id => id, grade: vi.fn(), remove: vi.fn(), getReport: () => undefined, saveReport: vi.fn(),
  };
  saveCardsSession('account-before', { ids:['saved-card'], index:0, revealed:false, results:[0,0,0] });
  const services = createCardsComposition(dependencies).services;
  const pendingPlan = services.loadPlan(services.getPreferences());
  accountId = 'account-after';
  resolveMetadata();
  await expect(pendingPlan).rejects.toThrow('La cuenta cambió mientras se cargaban las tarjetas.');
  expect(services.getSession()).toBeNull();
  expect(localStorage.getItem('tai.cards-session.v1.account-before')).not.toBeNull();
});

it('limita el plan de Active Recall a los temas recibidos aunque las preferencias digan todos', async () => {
  const dependencies = {
    loadQuestionMetadata: async () => {}, failedCardQuestionIds: () => [], loadQuestionsById: async () => [],
    loadJson: async url => url === 'cards/index.json'
      ? { temas: { 'T1.01': true, 'T3.02': true } }
      : url.endsWith('T1.01.json') ? [{ id:'card-seen', q:'Tema visto', a:'Respuesta' }]
        : [{ id:'card-unseen', q:'Tema no visto', a:'Respuesta' }],
    verifiedSources: {}, readPreferences: () => ({ scope:'todos', n:10 }), savePreferences: vi.fn(), accountId: () => 'scope-test',
    getCards: () => ({}), getSeen: () => ['T1.01'], getRecord: () => undefined, now: () => Date.now(), day: 86_400_000,
    topicName: id => id, grade: vi.fn(), remove: vi.fn(), getReport: () => undefined, saveReport: vi.fn(),
  };
  const services = createCardsComposition(dependencies).services;
  const plan = await services.loadPlan(services.getPreferences(), ['T1.01']);
  expect(plan.cards.map(card => card.id)).toEqual(['card-seen']);
  expect(plan.ids).toEqual(['card-seen']);
});
