import { describe, expect, it } from 'vitest';
import { buildAiStudyExport } from '../../src/core/domain/attempts/ai-study-export.ts';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.ts';

const session = (id, mode = 'practice') => ({ id, sourceSessionId: `legacy-${id}`, mode, status: 'completed', startedAt: 100, endedAt: 200, lastSequence: 2 });
const currentRevision = questionContentRevision('áé code', ['ok', 'no']);
const attempt = (id, sessionId, questionId, contentRevision = currentRevision) => ({
  id, sessionId, questionId, contentRevision, mode: 'practice', position: 0, exposure: 1,
  state: 'answered', response: 0, outcome: 'correct', confidence: 'sure', discardedOptions: [1],
  highlights: [{ id: `highlight-${id}`, field: 'statement', start: 0, end: 2, text: 'áé', before: '', after: ' code', category: 'key', contentRevision, createdAt: 150, timing: 'before-answer' }],
  createdAt: 110, completedAt: 180, lastSequence: 2, terminalEventId: `event-${id}`, appliedEventIds: [`event-${id}`],
});
const report = {
  period: { from: 0, to: 300 }, scoring: { reward: 1, penalty: 0.333, blankValue: 0 },
  completedSessionCount: 2, excludedSessionCount: 0, orphanAttemptCount: 0,
  overall: { attempts: 2, answered: 2, correct: 2, wrong: 0, blankPending: 0, blankConsulted: 0, blankUnanswered: 0, sessionCount: 2, changedAnswerAttempts: 0, discardedOptions: 2, confidence: { sure: 2, betweenTwo: 0, guess: 0, unset: 0 }, highlights: { beforeAnswer: 2, afterAnswer: 0, afterReveal: 0 }, activeTime: { observedMilliseconds: 20, completeAttempts: 2, partialAttempts: 0, unavailableAttempts: 0, p50Milliseconds: 10, p75Milliseconds: 10 } },
  segments: [],
};
const question = id => ({ id, topicId: 'T1.01', origin: 'O', statement: 'áé code', options: ['ok', 'no'], correctIndex: 0, kind: 'code', note: 'warning', source: { url: 'https://example.test/ref', title: 'Ref', verified: true } });

it('anonimiza referencias, incluye soluciones solo en JSON y marca contenido ausente o de otra revisión', () => {
  const archive = {
    createdAt: 250,
    sessions: [session('uid-like-secret'), session('second-session', 'simulation')],
    attempts: [attempt('attempt-secret', 'uid-like-secret', 'Q1'), attempt('attempt-2', 'second-session', 'Q2', 'old-revision')],
    events: [
      { id: 'event-secret', attemptId: 'attempt-secret', sequence: 2, type: 'answer', at: 180, monotonicAt: 20, payload: { optionIndex: 0, outcome: 'correct' } },
      { id: 'event-2', attemptId: 'attempt-2', sequence: 2, type: 'answer', at: 180, payload: { optionIndex: 0, outcome: 'correct' } },
    ],
  };
  const result = buildAiStudyExport({
    archive, report, questions: new Map([['Q1', question('Q1')], ['Q2', question('Q2')]]),
    explanations: new Map([['Q1', { questionId: 'Q1', contentRevision: currentRevision, editorialStatus: 'reviewed', language: 'Java', snippet: 'int x = 1;', result: { kind: 'output', value: '1' }, steps: [], distractors: [], limitation: 'Límite', sources: [] }], ['Q2', { questionId: 'Q2', contentRevision: 'old-revision', editorialStatus: 'draft', language: 'Java', snippet: 'draft', result: { kind: 'logic' }, steps: [], distractors: [], limitation: 'Límite', sources: [] }]]),
    generatedAt: 300, filters: { from: 0, to: 300, modes: ['practice', 'simulation'], sessionIds: ['uid-like-secret', 'second-session'] }, maxPartBytes: 100,
  });
  const json = JSON.stringify(result);
  expect(result.parts).toHaveLength(2);
  const currentPart = result.parts.find(part => part.attempts.some(item => item.questionId === 'Q1'));
  const stalePart = result.parts.find(part => part.attempts.some(item => item.questionId === 'Q2'));
  expect(currentPart.sessions[0].id).toMatch(/^part-\d{3}-session-/);
  expect(currentPart.attempts[0]).toMatchObject({ id: `part-${String(currentPart.partNumber).padStart(3, '0')}-attempt-000001`, sessionId: currentPart.sessions[0].id, questionId: 'Q1' });
  expect(currentPart.attempts[0].highlights[0].id).toBe(`part-${String(currentPart.partNumber).padStart(3, '0')}-highlight-000001`);
  expect(currentPart.questions.find(item => item.questionId === 'Q1')).toMatchObject({ contentStatus: 'current', explanationStatus: 'reviewed-current', content: { correctIndex: 0, statement: 'áé code', note: 'warning' } });
  expect(stalePart.questions.find(item => item.questionId === 'Q2')).toMatchObject({ contentStatus: 'revision-mismatch', explanationStatus: 'not-included', content: null });
  expect(currentPart.explanations).toHaveLength(1);
  expect(json).not.toContain('uid-like-secret');
  expect(json).not.toContain('attempt-secret');
  expect(json).not.toContain('event-secret');
  expect(json).not.toContain('draft');
  expect(result.manifest.parts).toMatchObject([{ sessionCount: 1, attemptCount: 1 }, { sessionCount: 1, attemptCount: 1 }]);
});

it('never drops a large single session and marks the part exceeding the preferred size', () => {
  const result = buildAiStudyExport({
    archive: { createdAt: 1, sessions: [session('one')], attempts: [attempt('a1', 'one', 'Q1')], events: [] },
    report: { ...report, completedSessionCount: 1 }, questions: new Map([['Q1', question('Q1')]]), explanations: new Map(),
    generatedAt: 2, filters: { from: 50, to: 200, modes: ['practice'], sessionIds: ['one'] }, maxPartBytes: 1,
  });
  expect(result.parts).toHaveLength(1);
  expect(result.manifest.parts[0].oversized).toBe(true);
  expect(result.parts[0].attempts).toHaveLength(1);
});
