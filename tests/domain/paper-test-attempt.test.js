import { describe, expect, it } from 'vitest';
import { createPaperTestAttemptSegment, isPaperTestAttemptSegment, mergePaperTestAttemptSegments } from '../../src/core/domain/paper-test-attempt.ts';

describe('registro agregado de tests en papel', () => {
  const timestamp = Date.parse('2026-11-02T20:00:00Z');
  const base = {
    id:'attempt-1:segment:1', attemptId:'attempt-1', segment:1, startedAt:timestamp, completedAt:timestamp + 1000,
    correctionStatus:'unavailable', topicId:'T1.01', sectionIds:['ci-0123456789abcdefabcd'], selfRating:'partial',
  };

  it('permite registrar que se practicó sin inventar fuente, respuestas ni nota', () => {
    const saved = createPaperTestAttemptSegment(base, timestamp + 2000);
    expect(saved).toMatchObject({ id:base.id, attemptId:base.attemptId, segment:1, dateKey:'2026-11-02', correctionStatus:'unavailable' });
    expect(saved).not.toHaveProperty('correctCount');
    expect(saved).not.toHaveProperty('sourceLabel');
  });

  it('valida recuentos parciales y relaciones solo cuando se aportan', () => {
    expect(isPaperTestAttemptSegment({ ...base, dateKey:'2026-11-02', updatedAt:timestamp + 2000, questionCount:50, answeredCount:45, blankCount:5, correctCount:30, incorrectCount:15, doubtfulCount:8 })).toBe(true);
    expect(isPaperTestAttemptSegment({ ...base, dateKey:'2026-11-02', updatedAt:timestamp + 2000, questionCount:50, answeredCount:45, blankCount:5, correctCount:31, incorrectCount:15 })).toBe(false);
    expect(createPaperTestAttemptSegment({ ...base, id:'attempt-1:segment:2', segment:2, answeredCount:3, correctCount:2, incorrectCount:1 }, timestamp + 2000)).toBeTruthy();
    expect(createPaperTestAttemptSegment({ ...base, id:'attempt-1:segment:2', segment:2, answeredCount:3, correctCount:2, incorrectCount:2 }, timestamp + 2000)).toBeNull();
  });

  it('fusiona por segmento idempotente y conserva cada tramo del mismo test', () => {
    const first = createPaperTestAttemptSegment(base, timestamp + 2000);
    const second = createPaperTestAttemptSegment({ ...base, id:'attempt-1:segment:2', segment:2, startedAt:timestamp + 3000, completedAt:timestamp + 4000 }, timestamp + 5000);
    expect(mergePaperTestAttemptSegments([], [first, first, second])).toHaveLength(2);
    expect(mergePaperTestAttemptSegments([first], [{ ...first, updatedAt:timestamp + 3000, sourceLabel:'Test de academia' }])[0].sourceLabel).toBe('Test de academia');
  });
});
