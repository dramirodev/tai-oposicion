import { beforeEach, describe, expect, it } from 'vitest';
import { mergePaperTestAttemptSegmentRecords, readPaperTestAttemptSegments, recordPaperTestAttemptSegment } from '../../src/adapters/local/paper-test-attempts.ts';

describe('persistencia local por cuenta del registro en papel', () => {
  beforeEach(() => localStorage.clear());

  it('aísla cuentas, no duplica segmentos y permite fusionar actualizaciones remotas', () => {
    const segment = { id:'attempt-1:segment:1', attemptId:'attempt-1', segment:1, dateKey:'2026-11-02', startedAt:100, completedAt:200, updatedAt:200, correctionStatus:'unavailable' };
    expect(recordPaperTestAttemptSegment('a', segment)).toBe(true);
    expect(recordPaperTestAttemptSegment('a', segment)).toBe(false);
    expect(readPaperTestAttemptSegments('a')).toEqual([segment]);
    expect(readPaperTestAttemptSegments('b')).toEqual([]);
    expect(mergePaperTestAttemptSegmentRecords('a', [{ ...segment, updatedAt:300, sourceLabel:'Prueba en papel' }])).toBe(true);
    expect(readPaperTestAttemptSegments('a')[0]).toMatchObject({ updatedAt:300, sourceLabel:'Prueba en papel' });
  });
});
