import { describe, expect, it } from 'vitest';
import { createPaperRecallAssessment, latestPaperRecallByTopic, mergePaperRecallAssessments, needsPaperRecallFollowUp, PAPER_RECALL_PRIORITY_WINDOW_MS } from '../../src/core/domain/paper-recall-assessment.ts';

describe('autoevaluación del recuerdo del temario en papel', () => {
  const timestamp = new Date(2026, 9, 29, 12).getTime();

  it('crea valoraciones con identificador diario y rechaza temas o resultados inválidos', () => {
    expect(createPaperRecallAssessment('T1.01', 'partial', timestamp)).toMatchObject({
      id:'2026-10-29:T1.01', topicId:'T1.01', dateKey:'2026-10-29', rating:'partial', ratedAt:timestamp,
    });
    expect(createPaperRecallAssessment('T9.01', 'partial', timestamp)).toBeNull();
    expect(createPaperRecallAssessment('T1.01', 'wrong', timestamp)).toBeNull();
  });

  it('conserva una sola valoración por tema y día, permitiendo corregirla después', () => {
    const initial = createPaperRecallAssessment('T1.01', 'remembered', timestamp);
    const correction = { ...initial, rating:'not-remembered', ratedAt:timestamp + 1 };
    expect(mergePaperRecallAssessments([], [initial, correction, { ...correction, rating:'partial', ratedAt:timestamp }])).toEqual([correction]);
  });

  it('usa la valoración más reciente como señal provisional y deja de priorizarla pasados 30 días', () => {
    const old = createPaperRecallAssessment('T1.01', 'not-remembered', timestamp);
    const recent = createPaperRecallAssessment('T1.01', 'partial', timestamp + 2);
    expect(latestPaperRecallByTopic([old, recent]).get('T1.01')).toEqual(recent);
    expect(needsPaperRecallFollowUp(recent, timestamp + 2 + PAPER_RECALL_PRIORITY_WINDOW_MS)).toBe(true);
    expect(needsPaperRecallFollowUp(recent, timestamp + 3 + PAPER_RECALL_PRIORITY_WINDOW_MS)).toBe(false);
    expect(needsPaperRecallFollowUp({ ...recent, rating:'remembered' }, timestamp + 3)).toBe(false);
  });
});
