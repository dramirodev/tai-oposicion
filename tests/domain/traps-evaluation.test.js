import { describe, expect, it } from 'vitest';
import { evaluateTrapAnswer, recordTrapDetections } from '../../src/core/domain/traps.ts';

describe('trap answer evaluation', () => {
  it('counts hits, misses, and false alarms independently of storage', () => {
    expect(evaluateTrapAnswer([1, 3], [1, 2])).toEqual({
      hits: 1,
      missed: 1,
      falseAlarms: 1,
      total: 2,
      correctIds: [1, 3],
      selectedIds: [1, 2],
    });
  });

  it('copies and updates legacy detection counters without mutating the previous values', () => {
    const previous = { 1: [2, 1] };
    const next = recordTrapDetections(previous, [1, 3], [1]);

    expect(next).toEqual({ 1: [3, 2], 3: [1, 0] });
    expect(previous).toEqual({ 1: [2, 1] });
  });
});
