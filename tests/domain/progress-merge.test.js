import { describe, expect, it } from 'vitest';
import { mergeQuestionProgress, questionProgressNeedsSync, syllabusReviewClock } from '../../src/core/domain/progress-merge.ts';

const stats = (overrides = {}) => ({ attempts: 1, correct: 0, lastSeenAt: 10, ...overrides });

describe('question progress merge', () => {
  it('merges the newest answer and syllabus mark using their independent clocks', () => {
    const local = stats({ attempts: 2, correct: 1, lastSeenAt: 20, failureStreak: 1, syllabusReviewed: true, syllabusReviewedAt: 30 });
    const remote = stats({ attempts: 4, correct: 2, lastSeenAt: 40, failureStreak: 0, syllabusReviewed: false, syllabusReviewedAt: 25 });

    expect(mergeQuestionProgress(local, remote)).toEqual({
      ...remote,
      syllabusReviewed: true,
      syllabusReviewedAt: 30,
    });
    expect(local.lastSeenAt).toBe(20);
    expect(remote.syllabusReviewedAt).toBe(25);
  });

  it('keeps local values when clocks tie and preserves the old unextended shape', () => {
    expect(mergeQuestionProgress(stats(), stats({ attempts: 9 }))).toEqual(stats());
    expect(mergeQuestionProgress(stats(), stats({ lastSeenAt: 20 }))).toEqual(stats({ lastSeenAt: 20 }));
  });

  it('uses answer time for old reviewed records and compares both sync clocks', () => {
    const oldReviewed = stats({ syllabusReviewed: true });
    expect(syllabusReviewClock(oldReviewed)).toBe(10);
    expect(questionProgressNeedsSync(stats({ lastSeenAt: 11 }), oldReviewed)).toBe(true);
    expect(questionProgressNeedsSync(stats({ syllabusReviewed: true, syllabusReviewedAt: 12 }), stats({ lastSeenAt: 11, syllabusReviewed: true, syllabusReviewedAt: 10 }))).toBe(true);
  });
});
