import { it, expect } from 'vitest';
import { previewCardDueAt, CARD_REVIEW_INTERVALS_DAYS, CALENDAR_DAY_MILLISECONDS } from '../../src/core/domain/spaced-repetition.ts';

const now = 1_800_000_000_000;

it('schedules a new or failed card at the first interval', () => {
  expect(previewCardDueAt(undefined, 3, now)).toBe(now + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS);
  expect(previewCardDueAt({ attempts: 1, intervalStep: 2 }, 1, now)).toBe(now + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS);
});

it('advances a known card or returns zero after the final interval', () => {
  expect(previewCardDueAt({ attempts: 1, intervalStep: 1 }, 3, now)).toBe(now + CARD_REVIEW_INTERVALS_DAYS[2] * CALENDAR_DAY_MILLISECONDS);
  expect(previewCardDueAt({ attempts: 1, intervalStep: 4 }, 3, now)).toBe(0);
});
