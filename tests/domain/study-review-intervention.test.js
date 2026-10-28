import { describe, expect, it } from 'vitest';
import { recommendTopicIntervention } from '../../src/core/domain/study-review-intervention.ts';

const baseEvidence = {
  topicId: 'T1.02', topicName: 'Organización del Estado', hasStudyMarker: true,
  distinctQuestionsAttempted: 2, latestAnswerAccuracy: 50, daysSinceLastQuestionAttempt: 8,
};

describe('recomendación de intervención de estudio', () => {
  it('sugiere estudio inicial provisional si no hay marca ni respuestas', () => {
    expect(recommendTopicIntervention({ ...baseEvidence, hasStudyMarker: false, distinctQuestionsAttempted: 0, latestAnswerAccuracy: null, daysSinceLastQuestionAttempt: null })).toMatchObject({ mode: 'initial-study', confidence: 'provisional', reason: 'study-not-marked' });
  });

  it('comprueba mediante recuperación antes de recomendar relectura con evidencia limitada', () => {
    expect(recommendTopicIntervention({ ...baseEvidence, distinctQuestionsAttempted: 1 })).toMatchObject({ mode: 'active-retrieval', confidence: 'provisional', reason: 'check-before-rereading' });
  });

  it('ante resultados bajos comprueba primero el recuerdo y no infiere que haga falta releer todo', () => {
    expect(recommendTopicIntervention({ ...baseEvidence, distinctQuestionsAttempted: 5, latestAnswerAccuracy: 40 })).toMatchObject({ mode: 'active-retrieval', confidence: 'product-rule', reason: 'low-results-need-diagnosis', explanation: expect.stringContaining('40 %') });
  });

  it('prioriza apartados explícitamente identificados sobre una revisión completa', () => {
    expect(recommendTopicIntervention({ ...baseEvidence, distinctQuestionsAttempted: 5, latestAnswerAccuracy: 40, weakSections: [{ id: 'section-2', title: 'Competencias del Congreso' }] })).toMatchObject({ mode: 'selective-reading', reason: 'weak-sections-identified', targets: [{ id: 'section-2', title: 'Competencias del Congreso' }] });
  });

  it('no inventa apartados ni una fecha de lectura', () => {
    const recommendation = recommendTopicIntervention(baseEvidence);
    expect(recommendation.targets).toEqual([]);
    expect(recommendation.explanation).not.toMatch(/hace \d+ días que leíste/i);
    expect(recommendation.evidence.daysSinceLastQuestionAttempt).toBe(8);
  });

  it('respeta una modalidad elegida manualmente aunque la recomendación automática fuera otra', () => {
    expect(recommendTopicIntervention({ ...baseEvidence, distinctQuestionsAttempted: 6, latestAnswerAccuracy: 40 }, 'active-retrieval')).toMatchObject({ mode: 'active-retrieval', confidence: 'user-selected', reason: 'manual-choice' });
  });
});
