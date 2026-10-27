import type { QuestionStats } from './entities.js';
import { failureStreak } from './spaced-repetition.js';

/** The review mark has its own clock; old records fall back to the answer clock. */
export function syllabusReviewClock(statistics?: QuestionStats): number {
  return statistics?.syllabusReviewedAt ?? (statistics?.syllabusReviewed ? statistics.lastSeenAt : 0);
}

/** Compares independently updated answer and syllabus-review data before syncing. */
export function questionProgressNeedsSync(local: QuestionStats, remote?: QuestionStats): boolean {
  return !remote
    || local.lastSeenAt > remote.lastSeenAt
    || syllabusReviewClock(local) > syllabusReviewClock(remote);
}

/** Merges the latest answer and syllabus mark without mutating either record. */
export function mergeQuestionProgress(local: QuestionStats, remote: QuestionStats): QuestionStats {
  const latestAnswer = remote.lastSeenAt > local.lastSeenAt ? remote : local;
  const latestReview = syllabusReviewClock(remote) > syllabusReviewClock(local) ? remote : local;
  const hasExtendedProgress = [local, remote].some(statistics => statistics.failureStreak !== undefined
    || statistics.syllabusReviewed !== undefined
    || statistics.syllabusReviewedAt !== undefined);
  if (!hasExtendedProgress) return { ...latestAnswer };

  const merged: QuestionStats = {
    ...latestAnswer,
    failureStreak: failureStreak(latestAnswer),
    syllabusReviewed: latestReview.syllabusReviewed === true,
  };
  const reviewedAt = syllabusReviewClock(latestReview);
  if (reviewedAt) merged.syllabusReviewedAt = reviewedAt;
  else delete merged.syllabusReviewedAt;
  return merged;
}
