import { describe, expect, it } from 'vitest';
import { countReviewsByDay, failureStreak, hasPendingFailure, questionReviewDueAt, selectSpacedReviews } from '../../src/core/domain/spaced-repetition.js';

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

it('incluye en el calendario la comprobación diferida posterior al repaso del temario', () => {
  const now = new Date(2026, 9, 25, 12).getTime();
  const reviewedAt = new Date(2026, 9, 25, 13).getTime();
  expect(countReviewsByDay([{
    intervalStep: -1,
    dueAt: 0,
    lastSeenAt: now,
    lastResult: 1,
    syllabusReviewed: true,
    syllabusReviewedAt: reviewedAt,
  }], now, 4)).toEqual([0, 0, 1, 0]);
});

describe('questionReviewDueAt', () => {
  const day = 86_400_000;

  it('schedules a delayed retrieval two days after a recorded syllabus review', () => {
    expect(questionReviewDueAt({ syllabusReviewed: true, syllabusReviewedAt: 10_000, lastSeenAt: 1_000, lastResult: 1 }))
      .toBe(10_000 + 2 * day);
  });

  it('keeps an early blank from counting as the delayed retrieval', () => {
    expect(questionReviewDueAt({ syllabusReviewed: true, syllabusReviewedAt: 10_000, lastSeenAt: 20_000, lastResult: 2 }))
      .toBe(10_000 + 2 * day);
  });

  it('does not count an answer before the delayed due date as the delayed check', () => {
    const reviewedAt = 10_000;
    const dueAt = reviewedAt + 2 * day;
    expect(questionReviewDueAt({ syllabusReviewed: true, syllabusReviewedAt: reviewedAt, lastSeenAt: dueAt - 1, lastResult: 1 }))
      .toBe(dueAt);
  });

  it('closes the delayed check after a scored answer on or after its due date', () => {
    const reviewedAt = 10_000;
    const dueAt = reviewedAt + 2 * day;
    expect(questionReviewDueAt({ syllabusReviewed: true, syllabusReviewedAt: reviewedAt, lastSeenAt: dueAt, lastResult: 1 }))
      .toBeUndefined();
  });

  it('keeps an earlier scheduled review and ignores legacy marks without a review timestamp', () => {
    const reviewedAt = 10_000;
    expect(questionReviewDueAt({
      intervalStep: 1, dueAt: reviewedAt + day, lastSeenAt: 1, syllabusReviewed: true, syllabusReviewedAt: reviewedAt,
    })).toBe(reviewedAt + day);
    expect(questionReviewDueAt({ intervalStep: -1, dueAt: 0, syllabusReviewed: true, lastSeenAt: 1 }))
      .toBeUndefined();
  });

  it('does not postpone the delayed check behind an existing later interval', () => {
    const reviewedAt = 10_000;
    expect(questionReviewDueAt({
      intervalStep: 3, dueAt: reviewedAt + 30 * day, lastSeenAt: 1,
      syllabusReviewed: true, syllabusReviewedAt: reviewedAt,
    })).toBe(reviewedAt + 2 * day);
  });

  it('does not create a delayed review after the syllabus mark is cleared', () => {
    expect(questionReviewDueAt({ intervalStep: -1, dueAt: 0, syllabusReviewed: false, syllabusReviewedAt: 10_000 }))
      .toBeUndefined();
  });
});
