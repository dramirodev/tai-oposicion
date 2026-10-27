import { describe, expect, it } from 'vitest';
import { aggregateQuestionPerformance } from '../src/core/application/stats/aggregate-question-performance.js';

describe('aggregateQuestionPerformance', () => {
  it('groups answers by topic, origin, type and each associated trap', () => {
    const result = aggregateQuestionPerformance([
      { topicId: 'A', attempts: 4, correct: 3, origin: 'O', type: 'caso', traps: ['1', '2'] },
      { topicId: 'A', attempts: 2, correct: 1, origin: 'O', traps: ['1'] },
      { topicId: 'B', attempts: 3, correct: 3, origin: 'G', type: 'caso', traps: [] },
    ]);

    expect(result.topicProgress).toEqual([
      { topicId: 'A', attempts: 4, correct: 3, seen: 1 },
      { topicId: 'A', attempts: 2, correct: 1, seen: 1 },
      { topicId: 'B', attempts: 3, correct: 3, seen: 1 },
    ]);
    expect(result.origins).toEqual({ O: [6, 4], G: [3, 3] });
    expect(result.types).toEqual({ caso: [7, 6] });
    expect(result.traps).toEqual({ '1': [6, 2], '2': [4, 1] });
  });

  it('returns empty groups when there is no question performance', () => {
    expect(aggregateQuestionPerformance([])).toEqual({ topicProgress: [], traps: {}, origins: {}, types: {} });
  });
});
