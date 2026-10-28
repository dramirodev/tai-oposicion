import { describe, expect, it } from 'vitest';
import { summarizeObservedStudyTime } from '../../src/core/domain/attempts/observed-study-time.js';

const attempt = id => ({
  id, sessionId: 'session-1', questionId: id, contentRevision: 'rev-1', mode: 'practice',
  position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null,
  discardedOptions: [], highlights: [], createdAt: 0, lastSequence: 0, appliedEventIds: [],
});
const event = (id, attemptId, sequence, type, monotonicAt) => ({
  id, attemptId, sequence, type, at: monotonicAt, monotonicAt, payload: {},
});

describe('summarizeObservedStudyTime', () => {
  it('sums only recorded intervals and reports complete, partial, and unavailable attempts', () => {
    const archive = {
      createdAt: 0,
      sessions: [],
      attempts: [attempt('complete'), attempt('partial'), attempt('unavailable')],
      events: [
        event('complete-open', 'complete', 1, 'open', 10),
        event('complete-close', 'complete', 2, 'close', 60_010),
        event('partial-open', 'partial', 1, 'open', 20),
        event('partial-leave', 'partial', 2, 'leave', 30_020),
        event('partial-resume', 'partial', 3, 'resume', 50_000),
      ],
    };

    expect(summarizeObservedStudyTime(archive)).toEqual({
      observedMilliseconds: 90_000,
      questionAttempts: 3,
      completeAttempts: 1,
      partialAttempts: 1,
      unavailableAttempts: 1,
    });
  });

  it('does not count duplicate attempts or estimate an interval without a stop event', () => {
    const duplicatedAttempt = attempt('same');
    const archive = {
      createdAt: 0,
      sessions: [],
      attempts: [duplicatedAttempt, duplicatedAttempt],
      events: [event('open', 'same', 1, 'open', 100)],
    };

    expect(summarizeObservedStudyTime(archive)).toEqual({
      observedMilliseconds: 0,
      questionAttempts: 1,
      completeAttempts: 0,
      partialAttempts: 1,
      unavailableAttempts: 0,
    });
  });
});
