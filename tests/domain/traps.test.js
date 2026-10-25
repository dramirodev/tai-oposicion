import { expect, it } from 'vitest';
import { calculateTrapRates, selectTrapQuestions } from '../../src/core/domain/traps.js';

it('agrega tasa de error por trampa y descarta las de pocas respuestas', () => {
  const rates = calculateTrapRates(
    {
      q1: { attempts: 4, correct: 1 },
      q2: { attempts: 3, correct: 2 },
    },
    questionId => questionId === 'q1' ? ['1', 2] : ['1'],
    5,
  );
  expect(rates).toEqual([{ trapId: '1', responseCount: 7, errorCount: 4, errorRate: 4 / 7 }]);
});

it('prioriza fallos recientes, luego preguntas no vistas y permite azar inyectado', () => {
  const candidates = [
    { id: 'seen', trapIds: [1], source: 'seen' },
    { id: 'new', trapIds: [1, 2], source: 'new' },
    { id: 'failed', trapIds: [1], source: 'failed' },
  ];
  const stats = {
    seen: { lastResult: 1 },
    failed: { lastResult: 0 },
  };
  const selected = selectTrapQuestions(candidates, id => stats[id], [1, 2], 3, () => 0);
  expect(selected.map(question => question.source)).toEqual(['failed', 'new', 'seen']);
});
