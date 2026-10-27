import type { CardReview } from './entities.js';
import { CALENDAR_DAY_MILLISECONDS, CARD_REVIEW_INTERVALS_DAYS } from './spaced-repetition.js';

/** Applies a flashcard grade and computes its next review date without persistence. */
export function gradeCardReview(
  current: CardReview | undefined,
  grade: 0 | 1 | 2,
  timestamp: number,
  previousStoredAt = 0,
): CardReview {
  const review: CardReview = current
    ? { ...current }
    : { attempts: 0, known: 0, lastReviewedAt: timestamp, intervalStep: -1, dueAt: 0 };
  const firstReview = review.attempts === 0;
  review.attempts += 1;
  review.lastReviewedAt = Math.max(timestamp, previousStoredAt + 1);
  review.lastGrade = grade;

  if (grade < 2) {
    review.intervalStep = 0;
    review.dueAt = timestamp + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS;
  } else {
    review.known += 1;
    if (firstReview || review.intervalStep < 0) {
      review.intervalStep = 0;
      review.dueAt = timestamp + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS;
    } else if (review.intervalStep + 1 >= CARD_REVIEW_INTERVALS_DAYS.length) {
      review.intervalStep = -1;
      review.dueAt = 0;
    } else {
      review.intervalStep += 1;
      review.dueAt = timestamp + CARD_REVIEW_INTERVALS_DAYS[review.intervalStep] * CALENDAR_DAY_MILLISECONDS;
    }
  }

  return review;
}
