import { createEmptyCard, forgetting_curve, FSRS6_DEFAULT_DECAY, fsrs, Rating, type Card } from 'ts-fsrs';
import type { CardReview, FsrsCardState } from '../../core/domain/entities.js';

const scheduler = fsrs();
type FsrsGrade = typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good;
const ratingForGrade: Record<0 | 1 | 2, FsrsGrade> = {
  0: Rating.Again,
  1: Rating.Hard,
  2: Rating.Good,
};

function toFsrsCard(state: FsrsCardState, dueAt: number): Card {
  return {
    due: new Date(dueAt),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    ...(state.lastReviewAt === null ? {} : { last_review: new Date(state.lastReviewAt) }),
  };
}

function fromFsrsCard(card: Card): FsrsCardState {
  return {
    schemaVersion: 1,
    algorithmVersion: 6,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReviewAt: card.last_review?.getTime() ?? null,
  };
}

function effectiveReviewDate(current: CardReview | undefined, timestamp: number): Date {
  const lastReviewAt = current?.fsrs?.lastReviewAt;
  return new Date(lastReviewAt !== null && lastReviewAt !== undefined
    ? Math.max(timestamp, lastReviewAt)
    : timestamp);
}

/**
 * Advances a card with an explicit learner rating. Old cards start a fresh FSRS
 * history at this review; previous timestamps and counts remain only as history,
 * and are not fabricated into scheduler repetitions.
 */
export function scheduleCardWithFsrs(
  current: CardReview | undefined,
  grade: 0 | 1 | 2,
  timestamp: number,
  previousStoredAt = 0,
): CardReview {
  const initial = current?.fsrs
    ? toFsrsCard(current.fsrs, current.dueAt)
    : createEmptyCard(new Date(timestamp));
  const reviewDate = effectiveReviewDate(current, timestamp);
  const card = scheduler.next(initial, reviewDate, ratingForGrade[grade]).card;
  const previousReviewAt = Math.max(previousStoredAt, current?.lastReviewedAt ?? 0);
  return {
    attempts: (current?.attempts ?? 0) + 1,
    known: (current?.known ?? 0) + (grade === 2 ? 1 : 0),
    lastReviewedAt: Math.max(timestamp, previousReviewAt + 1),
    intervalStep: 0,
    dueAt: card.due.getTime(),
    lastGrade: grade,
    fsrs: fromFsrsCard(card),
  };
}

export function previewCardWithFsrs(current: CardReview | undefined, grade: 0 | 1 | 2, timestamp: number): number {
  const initial = current?.fsrs
    ? toFsrsCard(current.fsrs, current.dueAt)
    : createEmptyCard(new Date(timestamp));
  return scheduler.repeat(initial, effectiveReviewDate(current, timestamp))[ratingForGrade[grade]].card.due.getTime();
}

export interface FsrsRetentionForecast {
  reviewedCards: number;
  points: readonly { days: 7 | 14 | 30; recallProbability: number }[];
}

/** Model-only recall forecast for cards with an actual FSRS review state. */
export function forecastCardRetention(reviews: readonly CardReview[], timestamp: number): FsrsRetentionForecast | null {
  const cards = reviews.flatMap(review => {
    const state = review.fsrs;
    return state?.lastReviewAt !== null && state?.lastReviewAt !== undefined
      && Number.isFinite(state.lastReviewAt) && Number.isFinite(state.stability) && state.stability > 0
      ? [{ lastReviewAt: state.lastReviewAt, stability: state.stability }]
      : [];
  });
  if (!cards.length) return null;
  const days = [7, 14, 30] as const;
  return {
    reviewedCards: cards.length,
    points: days.map(day => ({
      days: day,
      recallProbability: cards.reduce((sum, card) => {
        const elapsedDays = Math.max(0, (timestamp + day * 86_400_000 - card.lastReviewAt) / 86_400_000);
        return sum + forgetting_curve(FSRS6_DEFAULT_DECAY, elapsedDays, card.stability);
      }, 0) / cards.length,
    })),
  };
}
