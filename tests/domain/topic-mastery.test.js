import { expect, it } from 'vitest';
import { analyzeTopicMastery, filterTopicMasteryToSeen } from '../../src/core/domain/topic-mastery.js';

const now = 2_000_000_000;

it('calcula cobertura, aciertos recientes y vencidos con estadísticas de dominio', () => {
  const result = analyzeTopicMastery(
    [{ id: 'T1', questionCount: 10, label: 'Tema' }],
    () => ['q1', 'q2', 'q3'],
    id => ({
      q1: { attempts: 2, correct: 1, lastSeenAt: now - 20 * 86400000, intervalStep: 2, dueAt: now - 1, lastResult: 1 },
      q2: { attempts: 3, correct: 1, lastSeenAt: now - 5 * 86400000, intervalStep: 1, dueAt: now + 86400000, lastResult: 0 },
    })[id],
    now,
  )[0];

  expect(result).toEqual({
    topic: { id: 'T1', questionCount: 10, label: 'Tema' }, seen: 2, precision: 50, coverage: 33,
    score: 44, daysSinceLastSeen: 5, due: 1, status: 'red', reason: 'low-coverage',
  });
});

it('distingue el estado nuevo, sin datos suficientes y el estado reciente', () => {
  const topics = [{ id: 'new', questionCount: 8 }, { id: 'green', questionCount: 1 }];
  const results = analyzeTopicMastery(topics, id => id === 'new' ? [] : ['q'], () => ({
    attempts: 8, correct: 8, lastSeenAt: now, intervalStep: -1, lastResult: 1,
  }), now);
  expect(results.map(result => [result.status, result.reason])).toEqual([['new', 'not-started'], ['green', 'recent']]);
});

it('calcula las recomendaciones solo sobre temas marcados como vistos', () => {
  const topics = [
    { id: 'T1.01', score: 35 },
    { id: 'T2.01', score: 10 },
    { id: 'T3.01', score: 90 },
  ];

  expect(filterTopicMasteryToSeen(topics, ['T1.01', 'T3.01'])).toEqual([topics[0], topics[2]]);
});
