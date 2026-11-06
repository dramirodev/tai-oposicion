import { expect, it } from 'vitest';
import { canonicalOption, summarizeConceptEvidence } from '../../src/core/application/stats/concept-evidence.js';
const link = { questionId: 'q1', semanticRevision: 'r', conceptId: 'c1', role: 'necessary', status: 'approved', reviewer: 'human-fixture', reviewedAt: 1,
  evidence: { materialPath: 'fixture.pdf', sourceHash: 'a'.repeat(64), page: 2, rationale: 'Explicación documentada' }, distractors: [{ canonicalOptionIndex: 1, confusionId: 'x1', description: 'X' }] };
const catalogue = { schemaVersion: 1, revision: 'synthetic-v1', concepts: [{ id: 'c1', label: 'Concepto', status: 'approved', reviewer: 'human-fixture', reviewedAt: 1 }], links: [link] };
const attempt = { id: 'a', questionId: 'q1', semanticRevision: 'r', state: 'answered', outcome: 'wrong', response: 0, completedAt: 2 };
const input = { catalogue, attempts: [attempt], currentQuestions: new Map([['q1', { semanticRevision: 'r', optionCount: 2 }]]), approvedSectionQuestionIds: new Set(['q1']), optionOrders: new Map([['a', [1, 0]]]) };
it('normalizes shuffled distractors and counts ten attempts as one observed question', () => {
  expect(canonicalOption(0, [1, 0])).toBe(1);
  const result = summarizeConceptEvidence({ ...input, attempts: Array.from({ length: 10 }, () => attempt) });
  expect(result.nonAdditive).toBe(true); expect(result.rows[0]).toMatchObject({ observedQuestions: 1, latestWrong: 1, lowEvidence: true });
  expect(result.rows[0].confusions[0].description).toContain('Respuesta compatible');
});
it('does not attribute blank, missing response, stale, immediate or unreviewed confusion', () => {
  for (const change of [{ response: null }, { semanticRevision: 'old' }, { exposureKind: 'immediate-retry' }, { state: 'revealed', outcome: null }]) {
    expect(summarizeConceptEvidence({ ...input, attempts: [{ ...attempt, ...change }] }).rows.flatMap(row => row.confusions)).toEqual([]);
  }
  expect(summarizeConceptEvidence({ ...input, catalogue: { ...catalogue, links: [{ ...link, status: 'pending-review' }] } }).rows).toEqual([]);
  expect(summarizeConceptEvidence({ ...input, catalogue: { ...catalogue, links: [{ ...link, role: 'mentioned' }] } }).rows).toEqual([]);
});
it('requires a completed simulation before attributing a distractor confusion', () => {
  const exam = { ...attempt, mode: 'simulation', sessionId: 'exam' };
  expect(summarizeConceptEvidence({ ...input, attempts: [exam] }).rows).toEqual([]);
  expect(summarizeConceptEvidence({ ...input, attempts: [exam], sessions: [{ id: 'exam', status: 'active' }] }).rows).toEqual([]);
  expect(summarizeConceptEvidence({ ...input, attempts: [exam], sessions: [{ id: 'exam', status: 'completed' }] }).rows[0].latestWrong).toBe(1);
});
