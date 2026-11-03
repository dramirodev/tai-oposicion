import { describe, expect, it } from 'vitest';
import { createPaperTestAttemptSegment, isPaperTestAttemptSegment, latestPaperTestSelfRatingByTopic, mergePaperTestAttemptSegments, needsPaperTestFollowUp, paperTestFollowUpTopicIds, voidPaperTestAttemptSegment, PAPER_TEST_PRIORITY_WINDOW_MS } from '../../src/core/domain/paper-test-attempt.ts';

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

  it('usa solo la última autoevaluación declarada como señal temporal y nunca los recuentos', () => {
    const weak = createPaperTestAttemptSegment({ ...base, questionCount:50, answeredCount:50, correctCount:1, incorrectCount:49 }, timestamp + 2000);
    const unassessedNewer = createPaperTestAttemptSegment({ ...base, id:'attempt-1:segment:2', segment:2, startedAt:timestamp + 3000, completedAt:timestamp + 4000, selfRating:undefined }, timestamp + 5000);
    const latest = latestPaperTestSelfRatingByTopic([weak, unassessedNewer]);
    expect(latest.get('T1.01')).toEqual(weak);
    expect(needsPaperTestFollowUp(weak, weak.completedAt + 10)).toBe(true);
    expect(needsPaperTestFollowUp(weak, weak.completedAt + PAPER_TEST_PRIORITY_WINDOW_MS + 1)).toBe(false);
    const recovered = createPaperTestAttemptSegment({ ...base, id:'attempt-1:segment:3', segment:3, startedAt:timestamp + 6000, completedAt:timestamp + 7000, selfRating:'remembered' }, timestamp + 8000);
    expect(latestPaperTestSelfRatingByTopic([weak, recovered]).get('T1.01')).toEqual(recovered);
    expect(needsPaperTestFollowUp(recovered, recovered.completedAt + 1)).toBe(false);
    expect(paperTestFollowUpTopicIds([weak, recovered], ['T1.01'], recovered.completedAt + 1)).toEqual([]);
    expect(paperTestFollowUpTopicIds([weak], [], weak.completedAt + 1)).toEqual([]);
    expect(paperTestFollowUpTopicIds([weak], ['T1.01'], weak.completedAt + 1)).toEqual(['T1.01']);
  });

  it('anula sin borrar, conserva la fecha de práctica y retira su señal de refuerzo', () => {
    const segment = createPaperTestAttemptSegment(base, timestamp + 2000);
    const voided = voidPaperTestAttemptSegment(segment, timestamp + 3000);
    expect(voided).toMatchObject({ id:segment.id, completedAt:segment.completedAt, voidedAt:timestamp + 3000, updatedAt:timestamp + 3000 });
    expect(needsPaperTestFollowUp(voided, timestamp + 4000)).toBe(false);
    expect(voidPaperTestAttemptSegment(voided, timestamp + 4000)).toBeNull();
  });
});
