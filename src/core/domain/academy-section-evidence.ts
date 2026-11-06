import type { AcademyCurriculumSection } from './academy-curriculum-types.js';
import type { Question } from './entities.js';
import { parseAcademyQuestionSectionManifest, resolveAcademyQuestionSectionLink, validReviewedSectionLinkBase, type AcademyQuestionSectionLink, type AcademyQuestionSectionManifest } from './academy-question-section-map.js';
import { questionContentRevision } from './attempts/highlights.js';
import { questionSemanticRevision } from './attempts/question-semantic-revision.js';
import { isStudyTopicId } from './topic-id.js';

/** v3 permits curriculum-only evidence without pretending a generated question came from a test PDF. */
export interface CurriculumSectionLink extends Omit<AcademyQuestionSectionLink, 'testEvidence' | 'testMaterialTopicId' | 'semanticRevision'> {
  semanticRevision: string;
  evidence: { kind: 'curriculum-only' } | { kind: 'test-and-curriculum'; testMaterialTopicId: string; testEvidence: AcademyQuestionSectionLink['testEvidence'] };
}
export interface CurriculumSectionManifest { schemaVersion: 3; revision: string; links: readonly CurriculumSectionLink[] }
export type PublishedSectionManifest = AcademyQuestionSectionManifest | CurriculumSectionManifest;
export type PublishedSectionLink = AcademyQuestionSectionLink | CurriculumSectionLink;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function parsePublishedSectionManifest(value: unknown): PublishedSectionManifest | undefined {
  const legacy = parseAcademyQuestionSectionManifest(value);
  if (legacy) return legacy;
  if (!record(value) || value.schemaVersion !== 3 || typeof value.revision !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(value.revision) || !Array.isArray(value.links)) return undefined;
  const identities = new Set<string>();
  for (const link of value.links) {
    if (!record(link) || !record(link.evidence) || typeof link.semanticRevision !== 'string' || !/^semantic-v1-[a-f0-9]{8}$/.test(link.semanticRevision)) return undefined;
    const evidence = link.evidence;
    if (evidence.kind !== 'curriculum-only' && evidence.kind !== 'test-and-curriculum') return undefined;
    if (!validReviewedSectionLinkBase(link) || !isStudyTopicId(link.questionTopicId) || !isStudyTopicId(link.sectionTopicId)) return undefined;
    if (evidence.kind === 'test-and-curriculum') {
      if (!parseAcademyQuestionSectionManifest({ schemaVersion: 2, revision: value.revision,
        links: [{ ...link, testMaterialTopicId: evidence.testMaterialTopicId, testEvidence: evidence.testEvidence }] })) return undefined;
    }
    const identity = `${link.questionId}\u0000${link.contentRevision}`;
    if (identities.has(identity)) return undefined;
    identities.add(identity);
  }
  return value as unknown as CurriculumSectionManifest;
}
export function sourceTopicForSectionLink(link: PublishedSectionLink): string | undefined {
  return 'evidence' in link ? link.evidence.kind === 'test-and-curriculum' ? link.evidence.testMaterialTopicId : undefined : link.testMaterialTopicId;
}
export function resolvePublishedSectionLink(input: {
  link: PublishedSectionLink; question: Question; section: AcademyCurriculumSection | undefined;
  availableTestMaterials: ReadonlyMap<string, { topicId: string; sourceHash: string }>;
}): AcademyCurriculumSection | undefined {
  const { link, question, section } = input;
  if (!link.semanticRevision || link.semanticRevision !== questionSemanticRevision(question)) return undefined;
  if (!('evidence' in link)) return resolveAcademyQuestionSectionLink({ ...input, link });
  if (!section || question.id !== link.questionId || question.topicId !== link.questionTopicId || section.id !== link.sectionId || section.topicId !== link.sectionTopicId
    || link.contentRevision !== questionContentRevision(question.statement, question.options)
    || link.sectionEvidence.path !== section.materialPath || link.sectionEvidence.sourceHash !== section.sourceHash
    || link.sectionEvidence.outlineFingerprint !== section.outlineFingerprint || link.sectionEvidence.page !== section.printedPage) return undefined;
  if (link.evidence.kind === 'test-and-curriculum') {
    const source = input.availableTestMaterials.get(link.evidence.testEvidence.path);
    if (!source || source.topicId !== link.evidence.testMaterialTopicId || source.sourceHash !== link.evidence.testEvidence.sourceHash) return undefined;
  }
  return section;
}
