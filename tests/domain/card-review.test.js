import { expect, it } from 'vitest';
import { gradeCardReview } from '../../src/core/domain/card-review.js';

it('programa un primer repaso según la valoración y cuenta tarjetas conocidas', () => {
  expect(gradeCardReview(undefined, 2, 1_000)).toEqual({
    attempts: 1,
    known: 1,
    lastReviewedAt: 1_000,
    intervalStep: 0,
    dueAt: 1_000 + 2 * 86_400_000,
    lastGrade: 2,
  });
});

it('avanza el intervalo y conserva el orden al fusionar timestamps', () => {
  const review = gradeCardReview({
    attempts: 2,
    known: 1,
    lastReviewedAt: 5_000,
    intervalStep: 0,
    dueAt: 7_000,
    lastGrade: 1,
  }, 2, 5_000, 8_000);

  expect(review).toMatchObject({
    attempts: 3,
    known: 2,
    lastReviewedAt: 8_001,
    intervalStep: 1,
    dueAt: 5_000 + 5 * 86_400_000,
    lastGrade: 2,
  });
});

it('reinicia el calendario si la tarjeta se falla o se duda', () => {
  const review = gradeCardReview({ attempts: 4, known: 3, lastReviewedAt: 1, intervalStep: 3, dueAt: 2, lastGrade: 2 }, 1, 10);
  expect(review).toMatchObject({ attempts: 5, known: 3, intervalStep: 0, dueAt: 10 + 2 * 86_400_000, lastGrade: 1 });
});
