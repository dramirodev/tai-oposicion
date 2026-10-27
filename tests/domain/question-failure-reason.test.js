import { describe, expect, it } from 'vitest';
import { recordQuestionFailureReason } from '../../src/core/domain/question-progress.js';

const failedQuestion = {
  attempts: 2,
  correct: 1,
  lastSeenAt: 100,
  intervalStep: 0,
  dueAt: 86_500_000,
  lastResult: 0,
  errorReason: 0,
};

describe('recordQuestionFailureReason', () => {
  it('records the reason and updates the failure timestamp without mutating input', () => {
    const updated = recordQuestionFailureReason(failedQuestion, 2, 200);

    expect(updated).toEqual({ ...failedQuestion, errorReason: 2, lastSeenAt: 200 });
    expect(failedQuestion.errorReason).toBe(0);
    expect(failedQuestion.lastSeenAt).toBe(100);
  });

  it('removes a careless mistake from the spaced-repetition queue', () => {
    expect(recordQuestionFailureReason(failedQuestion, 4, 200)).toEqual({
      ...failedQuestion,
      errorReason: 4,
      lastSeenAt: 200,
      intervalStep: -1,
      dueAt: 0,
    });
  });

  it.each([
    [undefined, 2],
    [{ ...failedQuestion, lastResult: 1 }, 2],
    [failedQuestion, 0],
    [failedQuestion, 6],
    [failedQuestion, 8],
  ])('ignores invalid reason data', (current, reason) => {
    expect(recordQuestionFailureReason(current, reason, 200)).toBeUndefined();
  });
});
