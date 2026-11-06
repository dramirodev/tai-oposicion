import { expect, it } from 'vitest';
import { createSectionProposal, mergeSectionProposals } from '../../src/core/domain/academy-section-proposals.js';
import { questionSemanticRevision, questionRecordSemanticRevision } from '../../src/core/domain/attempts/question-semantic-revision.js';
const question = { i: 'q1', t: 'T1.01', o: 'G', q: 'Pregunta', a: ['a', 'b'], c: 0 };
it('exports reproducible unapproved proposals without inventing a test, hash, page or reviewer', () => {
  const proposal = createSectionProposal({ question, status: 'pending-review', rationale: 'Falta localizar el apartado' });
  expect(proposal).toMatchObject({ status: 'without-evidence', sourceCandidates: [] });
  expect(proposal).not.toHaveProperty('reviewer'); expect(proposal).not.toHaveProperty('reviewedAt');
  expect(proposal).not.toHaveProperty('sectionEvidence');
  expect(mergeSectionProposals([proposal], [proposal])).toHaveLength(1);
});
it('keeps canonical bank/domain semantics equal and changes revision for key, context and source', () => {
  const revision = questionRecordSemanticRevision(question);
  expect(revision).toBe(questionSemanticRevision({ id: 'q1', topicId: 'T1.01', origin: 'G', statement: 'Pregunta', options: ['a', 'b'], correctIndex: 0 }));
  for (const change of [{ c: 1 }, { cp: 'Contexto' }, { supTexto: 'Supuesto' }, { source: { url: 'source.pdf', verified: true } }]) expect(questionRecordSemanticRevision({ ...question, ...change })).not.toBe(revision);
});
