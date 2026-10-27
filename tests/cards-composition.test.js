import { expect, it, vi } from 'vitest';
import { createCardsComposition } from '../src/app/composition/cards/cards-composition.js';

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
