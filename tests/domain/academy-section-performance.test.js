import { questionSemanticRevision } from '../../src/core/domain/attempts/question-semantic-revision.js';
import { describe, expect, it } from 'vitest';
import { summarizeAcademySectionPerformance } from '../../src/core/application/stats/academy-section-performance.ts';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.ts';

const hash = value => value.repeat(64);
const question = { id: 'q-1', topicId: 'T3.01', origin: 'A', statement: 'Enunciado', options: ['A', 'B'], correctIndex: 0 };
const section = {
  id: 'ci-0123456789abcdefabcd', topicId: 'T1.09', title: 'Apartado destino', materialPath: 'T1.09/temario.pdf', printedPage: 12,
  sourceOrdinal: 1, sourceHash: hash('a'), materialKind: 'syllabus', outlineFingerprint: hash('b'), outlineStructureFingerprint: hash('c'), verification: 'pending',
};
const link = {
  status: 'approved', questionId: question.id, semanticRevision: questionSemanticRevision(question), contentRevision: questionContentRevision(question.statement, question.options),
  questionTopicId: question.topicId, testMaterialTopicId: 'T1.04', sectionTopicId: section.topicId, sectionId: section.id,
  testEvidence: { path: 'T1.04/test.pdf', sourceHash: hash('d'), page: 3 },
  sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
  rationale: 'El test contiene evidencia precisa del concepto.', reviewedAt: 100, reviewer: 'editor-1',
};
const base = { sessionId: 'session-1', questionId: question.id, contentRevision: link.contentRevision, semanticRevision: link.semanticRevision, mode: 'practice', position: 0,
  exposure: 1, state: 'answered', response: 0, confidence: null, discardedOptions: [], highlights: [], createdAt: 100,
  lastSequence: 2, appliedEventIds: [], terminalEventId: 'answer' };
const input = (overrides = {}) => ({
  manifest: { schemaVersion: 2, revision: 'review-1', links: [link] }, questions: [question], sections: [section],
  availableTestMaterials: new Map([[link.testEvidence.path, { topicId: link.testMaterialTopicId, sourceHash: link.testEvidence.sourceHash }]]),
  attempts: [], ...overrides,
});

describe('objective academy section performance', () => {
  it('returns explicit empty states instead of inferring from topic or candidate data', () => {
    expect(summarizeAcademySectionPerformance(input({ manifest: { schemaVersion: 2, revision: 'empty', links: [] } })))
      .toEqual({ status: 'no-approved-links', rows: [] });
    expect(summarizeAcademySectionPerformance(input({ manifest: null }))).toEqual({ status: 'invalid-manifest', rows: [] });
    const stale = { ...link, contentRevision: 'fnv1a-deadbeef' };
    expect(summarizeAcademySectionPerformance(input({ manifest: { schemaVersion: 2, revision: 'stale', links: [stale] } })))
      .toEqual({ status: 'no-current-links', rows: [], staleLinks: 1 });
  });

  it('uses only current exact links and separates immediate retries from ordinary outcomes', () => {
    const attempts = [
      { ...base, id: 'attempt-wrong', outcome: 'wrong', confidence: 'guess', completedAt: 200 },
      { ...base, id: 'attempt-retry', outcome: 'correct', exposureKind: 'immediate-retry', completedAt: 300 },
      { ...base, id: 'attempt-latest', outcome: 'correct', confidence: 'betweenTwo', selfAssessment: 'needs-help', completedAt: 400 },
      { ...base, id: 'simulation-attempt', mode: 'simulation', outcome: 'wrong', confidence: 'sure', completedAt: 350 },
      { ...base, id: 'attempt-other-version', contentRevision: 'fnv1a-deadbeef', outcome: 'wrong', completedAt: 500 },
      { ...base, id: 'attempt-reveal', state: 'revealed', outcome: null, completedAt: 600 },
    ];
    const result = summarizeAcademySectionPerformance(input({ attempts }));
    expect(result.status).toBe('ready');
    expect(result.rows).toEqual([expect.objectContaining({
      topicId: 'T1.09', linkedQuestions: 1, manifestRevision: 'review-1',
      practice: { observedQuestions: 1, latestCorrect: 1, latestWrong: 0, answeredAttempts: 2, immediateRetryAttempts: 1,
        confidence: { sure: 0, betweenTwo: 1, guess: 0, notRecorded: 0 },
        selfAssessment: { couldExplain: 0, needsHelp: 1, notRecorded: 0 } },
      simulation: { observedQuestions: 1, latestCorrect: 0, latestWrong: 1, answeredAttempts: 1, immediateRetryAttempts: 0,
        confidence: { sure: 1, betweenTwo: 0, guess: 0, notRecorded: 0 },
        selfAssessment: { couldExplain: 0, needsHelp: 0, notRecorded: 1 } },
    })]);
  });

  it('keeps linked questions with no objective attempt visible without presenting a score', () => {
    const result = summarizeAcademySectionPerformance(input());
    expect(result).toMatchObject({ status: 'ready', rows: [{ linkedQuestions: 1,
      practice: { observedQuestions: 0, latestCorrect: 0, latestWrong: 0 },
      simulation: { observedQuestions: 0, latestCorrect: 0, latestWrong: 0 },
    }] });
  });

  it('rejects a link when either referenced material version changes', () => {
    const result = summarizeAcademySectionPerformance(input({
      availableTestMaterials: new Map([[link.testEvidence.path, { topicId: link.testMaterialTopicId, sourceHash: hash('e') }]]),
    }));
    expect(result).toEqual({ status: 'no-current-links', rows: [], staleLinks: 1 });
  });
});

it('does not silently attribute old text-only attempts or a changed answer key', () => {
  const old = { ...base, id: 'old', semanticRevision: undefined, outcome: 'wrong', completedAt: 300 };
  expect(summarizeAcademySectionPerformance(input({ attempts: [old] }))).toMatchObject({ status: 'ready', rows: [{ practice: { observedQuestions: 0 } }] });
  expect(summarizeAcademySectionPerformance(input({ questions: [{ ...question, correctIndex: 1 }] }))).toMatchObject({ status: 'no-current-links', staleLinks: 1 });
});
it('supports v3 curriculum-only evidence and rejects changed context/source', () => {
  const { testEvidence, testMaterialTopicId, ...curriculum } = link;
  const manifest = { schemaVersion: 3, revision: 'fixture-v3', links: [{ ...curriculum, evidence: { kind: 'curriculum-only' } }] };
  expect(summarizeAcademySectionPerformance(input({ manifest, availableTestMaterials: new Map() }))).toMatchObject({ status: 'ready', rows: [{ linkedQuestions: 1 }] });
  expect(summarizeAcademySectionPerformance(input({ manifest, questions: [{ ...question, context: 'Nuevo supuesto' }] })).status).toBe('no-current-links');
  expect(summarizeAcademySectionPerformance(input({ manifest, questions: [{ ...question, source: { url: 'new-source', verified: true } }] })).status).toBe('no-current-links');
});
it('breaks equal error-count and recency ties by section ID, not title or input order', () => {
  const first = { ...section, id: 'ci-11111111111111111111', title: 'Zeta' };
  const second = { ...section, id: 'ci-22222222222222222222', title: 'Alfa' };
  const other = { ...question, id: 'q-2' };
  const firstLink = { ...link, sectionId: first.id };
  const secondLink = { ...link, questionId: other.id, sectionId: second.id };
  const result = summarizeAcademySectionPerformance(input({ manifest: { schemaVersion: 2, revision: 'tie-fixture', links: [secondLink, firstLink] }, questions: [question, other], sections: [second, first],
    attempts: [{ ...base, id: 'a-1', outcome: 'wrong', completedAt: 200 }, { ...base, id: 'a-2', questionId: other.id, outcome: 'wrong', completedAt: 200 }] }));
  expect(result.rows.map(row => row.sectionId)).toEqual([first.id, second.id]);
});
