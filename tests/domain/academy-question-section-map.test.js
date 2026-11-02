import { describe, expect, it } from 'vitest';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.js';
import {
  isAcademyQuestionSectionManifest,
  parseAcademyQuestionSectionManifest,
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
  questionTopicId: question.topicId, testMaterialTopicId: 'T1.04', sectionTopicId: 'T1.09', sectionId: section.id,
  testEvidence: { path: 'T3.01/test.pdf', sourceHash: hash('d'), page: 3, questionNumber: 2 },
  sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
  rationale: 'El enunciado evalúa este concepto concreto.',
  reviewedAt: 100, reviewer: 'editor-1',
};

describe('academy question to section editorial links', () => {
  it('accepts a v2 manifest with distinct question, test-source and destination topics', () => {
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 2, revision: 'drive-review-1', links: [] })).toBe(true);
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 2, revision: 'drive-review-1', links: [link] })).toBe(true);
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 2, revision: 'drive-review-1', links: [link, link] })).toBe(false);
  });

  it('resolves only while question content, topic, test file and selected outline page still match', () => {
    const input = { link, question, section: { ...section, topicId: link.sectionTopicId }, availableTestMaterials: new Map([[link.testEvidence.path, { topicId: link.testMaterialTopicId, sourceHash: hash('d') }]]) };
    expect(resolveAcademyQuestionSectionLink(input)).toEqual(input.section);
    expect(resolveAcademyQuestionSectionLink({ ...input, question: { ...question, statement: 'Modificada' } })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, availableTestMaterials: new Map() })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, section: { ...input.section, printedPage: 13 } })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, availableTestMaterials: new Map([[link.testEvidence.path, { topicId: 'T3.01', sourceHash: hash('d') }]]) })).toBeUndefined();
    expect(resolveAcademyQuestionSectionLink({ ...input, section: { ...input.section, topicId: 'T3.02' } })).toBeUndefined();
  });

  it('rejects malformed evidence and never infers a link from topic equality', () => {
    expect(isAcademyQuestionSectionManifest({ schemaVersion: 2, revision: 'v2', links: [{ ...link, sectionEvidence: { ...link.sectionEvidence, sourceHash: 'old' } }] })).toBe(false);
    expect(resolveAcademyQuestionSectionLink({ link, question, section: undefined, availableTestMaterials: new Map() })).toBeUndefined();
  });

  it('upgrades v1 links in memory without changing their same-topic meaning', () => {
    const legacy = {
      schemaVersion: 1, revision: 'old-review', links: [{
        status: 'approved', questionId: question.id, contentRevision: link.contentRevision, topicId: 'T3.01', sectionId: section.id,
        testEvidence: link.testEvidence, sectionEvidence: link.sectionEvidence, rationale: link.rationale, reviewedAt: 100, reviewer: 'editor-1',
      }],
    };
    const migrated = parseAcademyQuestionSectionManifest(legacy);
    expect(migrated).toMatchObject({ schemaVersion: 2, links: [{ questionTopicId: 'T3.01', testMaterialTopicId: 'T3.01', sectionTopicId: 'T3.01' }] });
    expect(legacy.schemaVersion).toBe(1);
    expect(parseAcademyQuestionSectionManifest({ schemaVersion: 9, revision: 'future', links: [] })).toBeUndefined();
  });
});
