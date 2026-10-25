import { expect, it } from 'vitest';
import { countReviewsByDay, failureStreak, hasPendingFailure, selectSpacedReviews } from '../../src/core/domain/spaced-repetition.js';

it('prioriza vencimientos antiguos sin repetir tema seguido si puede', () => {
  const items = [
    { id: 'a1', topicId: 'a', dueAt: 1 },
    { id: 'b1', topicId: 'b', dueAt: 2 },
    { id: 'a2', topicId: 'a', dueAt: 3 },
  ];
  expect(selectSpacedReviews(items, 3).map(item => item.id)).toEqual(['a1', 'b1', 'a2']);
});

it('calcula racha heredada y pendiente de fallo a partir de estadísticas tipadas', () => {
  expect(failureStreak()).toBe(-1);
  expect(failureStreak({ attempts: 2, lastResult: 0 })).toBe(0);
  expect(failureStreak({ attempts: 2, lastResult: 1 })).toBe(-1);
  expect(failureStreak({ attempts: 0, intervalStep: 0 })).toBe(0);
  expect(failureStreak({ attempts: 4, failureStreak: 2 })).toBe(2);
  expect(hasPendingFailure({ attempts: 4, failureStreak: 2 })).toBe(true);
  expect(hasPendingFailure({ attempts: 4, failureStreak: 3 })).toBe(false);
});

it('cuenta vencidas hoy junto a las próximas fechas naturales locales', () => {
  const now = new Date(2026, 9, 25, 12).getTime();
  const today = new Date(2026, 9, 25, 23).getTime();
  const tomorrow = new Date(2026, 9, 26, 9).getTime();
  expect(countReviewsByDay([{ intervalStep: 0, dueAt: today }, { intervalStep: 1, dueAt: tomorrow }], now, 3)).toEqual([1, 1, 0]);
});
