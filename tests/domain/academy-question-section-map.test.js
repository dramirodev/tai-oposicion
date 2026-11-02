import { describe, expect, it } from 'vitest';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.js';
import {
  isAcademyQuestionSectionManifest,
  resolveAcademyQuestionSectionLink,
} from '../../src/core/domain/academy-question-section-map.ts';

const hash = character => character.repeat(64);
const section = {
  id: 'ci-0123456789abcdefabcd', topicId: 'T3.01', title: 'Modelo conceptual',
  materialPath: 'T3.01/temario.pdf', printedPage: 12, sourceOrdinal: 1, sourceHash: hash('a'),
  materialKind: 'syllabus', outlineFingerprint: hash('b'), outlineStructureFingerprint: hash('c'), verification: 'pending',
};
const question = { id: 'q-1', topicId: 'T3.01', origin: 'A', statement: 'Enunciado', options: ['A', 'B'], correctIndex: 0 };
const link = {
  status: 'approved', questionId: question.id, contentRevision: questionContentRevision(question.statement, question.options),
  topicId: question.topicId, sectionId: section.id,
  testEvidence: { path: 'T3.01/test.pdf', sourceHash: hash('d'), page: 3, questionNumber: 2 },
  sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
  rationale: 'El enunciado evalúa este concepto concreto.',
  reviewedAt: 100, reviewer: 'editor-1',
};

describe('academy question to section editorial links', () => {
  it('accepts an empty versioned manifest and unique, fully evidenced approved links', () => {
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 1, revision: 'drive-review-1', links: [] })).toBe(true);
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 1, revision: 'drive-review-1', links: [link] })).toBe(true);
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 1, revision: 'drive-review-1', links: [link, link] })).toBe(false);
  });

  it('resolves only while question content, topic, test file and selected outline page still match', () => {
    const input = { link, question, section, availableMaterialHashes: new Map([[link.testEvidence.path, hash('d')]]) };
    expect(resolveAcademyQuestionSectionLink(input)).toEqual(section);
    expect(resolveAcademyQuestionSectionLink({ ...input, question: { ...question, statement: 'Modificada' } })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, availableMaterialHashes: new Map() })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, section: { ...section, printedPage: 13 } })).toBeUndefined();
  });

  it('rejects malformed evidence and never infers a link from topic equality', () => {
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 1, revision: 'v1', links: [{ ...link, sectionEvidence: { ...link.sectionEvidence, sourceHash: 'old' } }] })).toBe(false);
    expect(resolveAcademyQuestionSectionLink({ link, question, section: undefined, availableMaterialHashes: new Map() })).toBeUndefined();
  });
});
