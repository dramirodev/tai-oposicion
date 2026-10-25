import { describe, expect, it } from 'vitest';
import { renderAiStudyExportMarkdown } from '../../src/shared/presentation/ai-study-export-markdown.ts';

it('explica muestras, datos ausentes, penalización y límites del análisis sin incluir identificadores internos', () => {
  const value = {
    format: 'tai-study-ai-export', schemaVersion: 1, createdAt: 3,
    filters: { from: 1, to: 2, modes: ['simulation'], sessionCount: 2 },
    report: {
      period: { from: 1, to: 2 }, scoring: { reward: 1, penalty: 0.333, blankValue: 0 },
      completedSessionCount: 2, excludedSessionCount: 1, orphanAttemptCount: 0,
      overall: { attempts: 5, answered: 3, correct: 2, wrong: 1, blankPending: 1, blankConsulted: 0, blankUnanswered: 1, sessionCount: 2, changedAnswerAttempts: 0, discardedOptions: 2, confidence: { sure: 1, betweenTwo: 0, guess: 1, unset: 1 }, highlights: { beforeAnswer: 1, afterAnswer: 0, afterReveal: 0 }, activeTime: { observedMilliseconds: 100, completeAttempts: 2, partialAttempts: 1, unavailableAttempts: 2, p50Milliseconds: 40, p75Milliseconds: 60 } },
      segments: [{ dimension: 'mode', value: 'practice', correct: 1, answered: 1, sessionCount: 1,
        observedAccuracy: 1, recommendation: null,
        activeTime: { p50Milliseconds: null, p75Milliseconds: null, completeAttempts: 0, partialAttempts: 0, unavailableAttempts: 1 } }],
    },
    manifest: { format: 'tai-study-ai-export', schemaVersion: 1, partCount: 1, totalSizeBytes: 12, parts: [{ fileName: 'p.json', partNumber: 1, sessionCount: 2, attemptCount: 5, eventCount: 10, sizeBytes: 12, oversized: false }] },
    parts: [],
  };
  const markdown = renderAiStudyExportMarkdown(value);
  expect(markdown).toContain('2 aciertos de 3 respuestas evaluables (66,7 %)');
  expect(markdown).toContain('0,333');
  expect(markdown).toContain('No conviertas valores ausentes en cero');
  expect(markdown).toContain('puede contener soluciones de examen');
  expect(markdown).toContain('identificadores anonimizados');
  expect(markdown).not.toMatch(/"(?:uid|email|token|firebaseConfig)"\s*:/i);
});

it('usa el singular cuando el informe contiene una sola respuesta', () => {
  const value = {
    createdAt: 3,
    filters: { modes: [], sessionCount: 1 },
    report: {
      period: { from: 1, to: 2 }, scoring: { reward: 1, penalty: 0, blankValue: 0 },
      completedSessionCount: 1, excludedSessionCount: 0, orphanAttemptCount: 0,
      overall: { correct: 1, answered: 1, wrong: 0, blankPending: 0, blankConsulted: 0, blankUnanswered: 0,
        confidence: { sure: 0, betweenTwo: 0, guess: 0, unset: 0 }, discardedOptions: 0, changedAnswerAttempts: 0,
        highlights: { beforeAnswer: 0, afterAnswer: 0, afterReveal: 0 },
        activeTime: { p50Milliseconds: null, p75Milliseconds: null, completeAttempts: 0, partialAttempts: 0, unavailableAttempts: 1 } },
      segments: [{ dimension: 'mode', value: 'practice', correct: 1, answered: 1, sessionCount: 1,
        observedAccuracy: 1, recommendation: null,
        activeTime: { p50Milliseconds: null, p75Milliseconds: null, completeAttempts: 0, partialAttempts: 0, unavailableAttempts: 1 } }],
    },
    manifest: { partCount: 1, totalSizeBytes: 1, parts: [{ fileName: 'part.json', sessionCount: 1, attemptCount: 1, eventCount: 0, sizeBytes: 1, oversized: false }] },
    parts: [{ questions: [] }],
  };

  const markdown = renderAiStudyExportMarkdown(value);
  expect(markdown).toContain('1 acierto de 1 respuesta evaluable');
  expect(markdown).toContain('1 acierto / 1 respuesta evaluable; 1 sesión');
});
