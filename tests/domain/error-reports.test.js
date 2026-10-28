import { describe, expect, it } from 'vitest';
import { mergeErrorReports } from '../../src/core/domain/error-reports.ts';

const report = (questionId, reportedAt, reason = 'confusa') => ({
  questionId,
  reportedAt,
  topicId: 'T1.01',
  reason,
  note: '',
  state: 'abierto',
});

describe('error report merge', () => {
  it('keeps current records on older or equal timestamps and accepts newer records', () => {
    const current = [report('q1', 20, 'current')];
    const incoming = [report('q1', 10, 'old'), report('q1', 20, 'tie'), report('q2', 5), report('q1', 30, 'new')];

    expect(mergeErrorReports(current, incoming)).toEqual({
      reports: [report('q1', 30, 'new'), report('q2', 5)],
      changed: true,
    });
    expect(current).toEqual([report('q1', 20, 'current')]);
    expect(incoming[0]).toEqual(report('q1', 10, 'old'));
  });

  it('reports no change when every incoming record is older or tied', () => {
    const current = [report('q1', 20, 'current')];

    expect(mergeErrorReports(current, [report('q1', 10), report('q1', 20, 'tie')])).toEqual({
      reports: current,
      changed: false,
    });
  });
});
