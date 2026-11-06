import type { Question } from './entities.js';
import type { AcademyCurriculumSection } from './academy-curriculum-types.js';
import { questionContentRevision } from './attempts/highlights.js';
import { isStudyTopicId } from './topic-id.js';

export const ACADEMY_QUESTION_SECTION_MAP_VERSION = 2 as const;

export interface QuestionMaterialEvidence {
  path: string;
  sourceHash: string;
  page: number;
}

interface SectionMaterialEvidence extends QuestionMaterialEvidence {
  outlineFingerprint: string;
}

interface TestMaterialEvidence extends QuestionMaterialEvidence {
  questionNumber?: number;
}

/** A reviewed link keeps question, source document and destination curriculum topics distinct. */
export interface AcademyQuestionSectionLink {
  status: 'approved';
  questionId: string;
  contentRevision: string;
  semanticRevision?: string;
  questionTopicId: string;
  testMaterialTopicId: string;
  sectionTopicId: string;
  sectionId: string;
  testEvidence: TestMaterialEvidence;
  sectionEvidence: SectionMaterialEvidence;
  rationale: string;
  reviewedAt: number;
  reviewer: string;
}

export interface AcademyQuestionSectionManifest {
  schemaVersion: typeof ACADEMY_QUESTION_SECTION_MAP_VERSION;
  revision: string;
  links: readonly AcademyQuestionSectionLink[];
}

interface LegacyQuestionSectionLink extends Omit<AcademyQuestionSectionLink, 'questionTopicId' | 'testMaterialTopicId' | 'sectionTopicId'> {
  topicId: string;
}

interface LegacyQuestionSectionManifest {
  schemaVersion: 1;
  revision: string;
  links: readonly LegacyQuestionSectionLink[];
}

const hashPattern = /^[a-f0-9]{64}$/i;
const revisionPattern = /^fnv1a-[a-f0-9]{8}$/i;
const sectionIdPattern = /^ci-[a-f0-9]{20}$/i;
const revisionIdPattern = /^[a-zA-Z0-9._-]{1,100}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function validEvidence(value: unknown): value is QuestionMaterialEvidence {
  return isRecord(value)
    && typeof value.path === 'string' && value.path.length > 0 && value.path.length <= 500
    && typeof value.sourceHash === 'string' && hashPattern.test(value.sourceHash)
    && Number.isInteger(value.page) && (value.page as number) > 0;
}

function validSectionEvidence(value: unknown): value is SectionMaterialEvidence {
  return validEvidence(value) && isRecord(value)
    && typeof value.outlineFingerprint === 'string' && hashPattern.test(value.outlineFingerprint);
}

function validTestEvidence(value: unknown): value is TestMaterialEvidence {
  return validEvidence(value) && isRecord(value)
    && (value.questionNumber === undefined || (Number.isInteger(value.questionNumber) && (value.questionNumber as number) > 0));
}

export function validReviewedSectionLinkBase(value: Record<string, unknown>): boolean {
  return value.status === 'approved'
    && typeof value.questionId === 'string' && !!value.questionId && value.questionId.length <= 200
    && typeof value.contentRevision === 'string' && revisionPattern.test(value.contentRevision)
    && (value.semanticRevision === undefined || (typeof value.semanticRevision === 'string' && /^semantic-v1-[a-f0-9]{8}$/.test(value.semanticRevision)))
    && typeof value.sectionId === 'string' && sectionIdPattern.test(value.sectionId)
    && validSectionEvidence(value.sectionEvidence)
    && typeof value.rationale === 'string' && value.rationale.trim().length >= 10 && value.rationale.length <= 1000
    && Number.isFinite(value.reviewedAt) && (value.reviewedAt as number) > 0
    && typeof value.reviewer === 'string' && !!value.reviewer.trim() && value.reviewer.length <= 200;
}

function validLinkBase(value: Record<string, unknown>): boolean {
  return validReviewedSectionLinkBase(value) && validTestEvidence(value.testEvidence);
}

export function isAcademyQuestionSectionLink(value: unknown): value is AcademyQuestionSectionLink {
  if (!isRecord(value) || !validLinkBase(value)
    || !isStudyTopicId(value.questionTopicId)
    || !isStudyTopicId(value.testMaterialTopicId)
    || !isStudyTopicId(value.sectionTopicId)) return false;
  return true;
}

function validManifestEnvelope(value: Record<string, unknown>, version: number): value is Record<string, unknown> & { revision: string; links: unknown[] } {
  return value.schemaVersion === version && typeof value.revision === 'string' && revisionIdPattern.test(value.revision)
    && Array.isArray(value.links);
}

function hasUniqueQuestionRevisions(links: readonly { questionId: string; contentRevision: string }[]): boolean {
  const identities = links.map(link => `${link.questionId}\u0000${link.contentRevision}`);
  return new Set(identities).size === identities.length;
}

export function isAcademyQuestionSectionManifest(value: unknown): value is AcademyQuestionSectionManifest {
  return isRecord(value) && validManifestEnvelope(value, ACADEMY_QUESTION_SECTION_MAP_VERSION)
    && value.links.every(isAcademyQuestionSectionLink)
    && hasUniqueQuestionRevisions(value.links as AcademyQuestionSectionLink[]);
}

function isLegacyLink(value: unknown): value is LegacyQuestionSectionLink {
  if (!isRecord(value) || !validLinkBase(value) || !isStudyTopicId(value.topicId)) return false;
  return true;
}

function isLegacyManifest(value: unknown): value is LegacyQuestionSectionManifest {
  return isRecord(value) && validManifestEnvelope(value, 1)
    && value.links.every(isLegacyLink)
    && hasUniqueQuestionRevisions(value.links as LegacyQuestionSectionLink[]);
}

/** Reads v1 without mutating it and upgrades its same-topic assumption to explicit v2 fields. */
export function parseAcademyQuestionSectionManifest(value: unknown): AcademyQuestionSectionManifest | undefined {
  if (isAcademyQuestionSectionManifest(value)) return value;
  if (!isLegacyManifest(value)) return undefined;
  return {
    schemaVersion: ACADEMY_QUESTION_SECTION_MAP_VERSION,
    revision: `migrated-v1-${value.revision}`.slice(0, 100),
    links: value.links.map(({ topicId, ...link }) => ({
      ...link,
      questionTopicId: topicId,
      testMaterialTopicId: topicId,
      sectionTopicId: topicId,
    })),
  };
}

/** Resolve only an approved link whose question and both source/destination materials still match. */
export function resolveAcademyQuestionSectionLink(input: {
  link: AcademyQuestionSectionLink;
  question: Question;
  section: AcademyCurriculumSection | undefined;
  availableTestMaterials: ReadonlyMap<string, { topicId: string; sourceHash: string }>;
}): AcademyCurriculumSection | undefined {
  const { link, question, section, availableTestMaterials } = input;
  const testMaterial = availableTestMaterials.get(link.testEvidence.path);
  if (!isAcademyQuestionSectionLink(link) || !section || link.questionId !== question.id
    || link.questionTopicId !== question.topicId || link.sectionId !== section.id
    || link.sectionTopicId !== section.topicId
    || link.contentRevision !== questionContentRevision(question.statement, question.options)
    || !testMaterial || testMaterial.topicId !== link.testMaterialTopicId
    || link.testEvidence.sourceHash !== testMaterial.sourceHash
    || link.sectionEvidence.path !== section.materialPath || link.sectionEvidence.sourceHash !== section.sourceHash
    || link.sectionEvidence.outlineFingerprint !== section.outlineFingerprint
    || link.sectionEvidence.page !== section.printedPage) return undefined;
  return section;
}
