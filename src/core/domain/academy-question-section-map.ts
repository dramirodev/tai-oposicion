import type { Question } from './entities.js';
import type { AcademyCurriculumSection } from './academy-curriculum-types.js';
import { questionContentRevision } from './attempts/highlights.js';
import { isStudyTopicId } from './topic-id.js';

export const ACADEMY_QUESTION_SECTION_MAP_VERSION = 1 as const;

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

/** A reviewed editorial link. Draft candidates must live outside the active manifest. */
export interface AcademyQuestionSectionLink {
  status: 'approved';
  questionId: string;
  contentRevision: string;
  topicId: string;
  sectionId: string;
  testEvidence: TestMaterialEvidence;
  sectionEvidence: SectionMaterialEvidence;
  reviewedAt: number;
  reviewer: string;
}

export interface AcademyQuestionSectionManifest {
  schemaVersion: typeof ACADEMY_QUESTION_SECTION_MAP_VERSION;
  revision: string;
  links: readonly AcademyQuestionSectionLink[];
}

const hashPattern = /^[a-f0-9]{64}$/i;
const revisionPattern = /^fnv1a-[a-f0-9]{8}$/i;
const sectionIdPattern = /^ci-[a-f0-9]{20}$/i;
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

export function isAcademyQuestionSectionLink(value: unknown): value is AcademyQuestionSectionLink {
  if (!isRecord(value) || value.status !== 'approved'
    || typeof value.questionId !== 'string' || !value.questionId || value.questionId.length > 200
    || typeof value.contentRevision !== 'string' || !revisionPattern.test(value.contentRevision)
    || !isStudyTopicId(value.topicId)
    || typeof value.sectionId !== 'string' || !sectionIdPattern.test(value.sectionId)
    || !validTestEvidence(value.testEvidence) || !validSectionEvidence(value.sectionEvidence)
    || !Number.isFinite(value.reviewedAt) || (value.reviewedAt as number) <= 0
    || typeof value.reviewer !== 'string' || !value.reviewer.trim() || value.reviewer.length > 200) return false;
  return true;
}

export function isAcademyQuestionSectionManifest(value: unknown): value is AcademyQuestionSectionManifest {
  if (!isRecord(value) || value.schemaVersion !== ACADEMY_QUESTION_SECTION_MAP_VERSION
    || typeof value.revision !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(value.revision)
    || !Array.isArray(value.links) || !value.links.every(isAcademyQuestionSectionLink)) return false;
  const identities = value.links.map(link => `${link.questionId}\u0000${link.contentRevision}`);
  return new Set(identities).size === identities.length;
}

/** Resolve only an approved link that still matches the exact question and both source versions. */
export function resolveAcademyQuestionSectionLink(input: {
  link: AcademyQuestionSectionLink;
  question: Question;
  section: AcademyCurriculumSection | undefined;
  availableMaterialHashes: ReadonlyMap<string, string>;
}): AcademyCurriculumSection | undefined {
  const { link, question, section, availableMaterialHashes } = input;
  if (!isAcademyQuestionSectionLink(link) || !section || link.questionId !== question.id
    || link.topicId !== question.topicId || link.sectionId !== section.id || section.topicId !== question.topicId
    || link.contentRevision !== questionContentRevision(question.statement, question.options)
    || link.testEvidence.sourceHash !== availableMaterialHashes.get(link.testEvidence.path)
    || link.sectionEvidence.path !== section.materialPath || link.sectionEvidence.sourceHash !== section.sourceHash
    || link.sectionEvidence.outlineFingerprint !== section.outlineFingerprint
    || link.sectionEvidence.page !== section.printedPage) return undefined;
  return section;
}
