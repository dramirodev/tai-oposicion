import type { AnswerResult, QuestionStats } from './entities.js';
import {
  CALENDAR_DAY_MILLISECONDS,
  CARD_REVIEW_INTERVALS_DAYS,
  failureStreak,
} from './spaced-repetition.js';

const LUCKY_REVIEW_DAYS = 1;

/** Applies one study answer to a question's progress without performing persistence. */
export function recordQuestionAnswer(
  current: QuestionStats | undefined,
  result: AnswerResult,
  timestamp: number,
  seconds?: number,
): QuestionStats {
  const statistics: QuestionStats = current
    ? { ...current }
    : {
        attempts: 0,
        correct: 0,
        lastSeenAt: 0,
        intervalStep: -1,
        dueAt: 0,
        lastResult: 0,
        doubtful: false,
        secondsStudied: 0,
        timedAnswers: 0,
        errorReason: 0,
        syllabusReviewed: false,
      };
  const streak = failureStreak(statistics);
  statistics.failureStreak = result === 0
    ? 0
    : result === 1 && streak >= 0
      ? Math.min(3, streak + 1)
      : streak;

  if (typeof seconds === 'number' && seconds > 0 && result !== 2) {
    statistics.secondsStudied = (statistics.secondsStudied ?? 0) + Math.min(120, seconds);
    statistics.timedAnswers = (statistics.timedAnswers ?? 0) + 1;
  }

  statistics.attempts += 1;
  if (result === 1) statistics.correct += 1;
  statistics.syllabusReviewed ??= false;
  statistics.lastSeenAt = timestamp;
  statistics.lastResult = result;

  const luck = statistics.errorReason ?? 0;
  statistics.errorReason = 0;
  if (luck && result === 2) statistics.errorReason = luck;
  if (result === 0) {
    statistics.intervalStep = 0;
    statistics.dueAt = timestamp + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS;
  } else if (result === 1 && luck === 6) {
    statistics.errorReason = 8;
    statistics.intervalStep = 0;
    statistics.dueAt = timestamp + LUCKY_REVIEW_DAYS * CALENDAR_DAY_MILLISECONDS;
  } else if (result === 1 && (statistics.intervalStep ?? -1) >= 0) {
    const nextStep = statistics.intervalStep! + 1;
    if (nextStep >= CARD_REVIEW_INTERVALS_DAYS.length) {
      statistics.intervalStep = -1;
      statistics.dueAt = 0;
    } else {
      statistics.intervalStep = nextStep;
      statistics.dueAt = timestamp + CARD_REVIEW_INTERVALS_DAYS[nextStep] * CALENDAR_DAY_MILLISECONDS;
    }
  }
  return statistics;
}

/** Schedules an already answered question for its first repetition interval. */
export function scheduleDoubtfulQuestion(current: QuestionStats | undefined, timestamp: number): QuestionStats | undefined {
  if (!current) return undefined;
  return {
    ...current,
    intervalStep: 0,
    dueAt: timestamp + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS,
  };
}

/** Marks a correct answer as lucky so it is checked again the next day. */
export function markLuckyQuestion(current: QuestionStats | undefined, timestamp: number): QuestionStats | undefined {
  if (!current || current.lastResult !== 1) return undefined;
  return {
    ...current,
    errorReason: 6,
    intervalStep: 0,
    dueAt: timestamp + LUCKY_REVIEW_DAYS * CALENDAR_DAY_MILLISECONDS,
    lastSeenAt: timestamp,
  };
}

/** Changes the syllabus review mark independently from the answer timestamp. */
export function markQuestionSyllabusReviewed(
  current: QuestionStats | undefined,
  reviewed: boolean,
  timestamp: number,
): QuestionStats | undefined {
  if (!current || typeof reviewed !== 'boolean') return undefined;
  const streak = failureStreak(current);
  const reviewClock = current.syllabusReviewedAt ?? (current.syllabusReviewed ? current.lastSeenAt : 0);
  return {
    ...current,
    failureStreak: streak,
    syllabusReviewed: reviewed,
    syllabusReviewedAt: Math.max(timestamp, reviewClock + 1),
  };
}

/** Records why the last answer was wrong, including the legacy "careless mistake" reset. */
export function recordQuestionFailureReason(
  current: QuestionStats | undefined,
  reason: number,
  timestamp: number,
): QuestionStats | undefined {
  if (!current || current.lastResult !== 0 || !(reason >= 1 && reason <= 5 || reason === 7)) return undefined;
  return {
    ...current,
    errorReason: reason,
    lastSeenAt: timestamp,
    ...(reason === 4 ? { intervalStep: -1, dueAt: 0 } : {}),
  };
}
