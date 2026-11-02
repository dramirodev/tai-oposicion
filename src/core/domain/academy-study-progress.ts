import { isStudyTopicId } from './topic-id.js';

export const ACADEMY_STUDY_PROGRESS_VERSION = 1 as const;

export interface AcademyMaterialReference {
  path: string;
  sourceHash: string;
  outlineFingerprint: string;
  outlineStructureFingerprint: string;
  role: 'syllabus' | 'supplementary';
}

export interface AcademyMaterialSelection {
  topicId: string;
  materials: readonly AcademyMaterialReference[];
  revision: number;
  updatedAt: number;
}

export type SectionCoverage = 'not-started' | 'partial' | 'covered';
export type SectionRecallTiming = 'assisted' | 'immediate' | 'delayed';
export type SectionRecallRating = 'not-recalled' | 'partial' | 'recalled';

interface SectionEventBase {
  id: string;
  topicId: string;
  sectionId: string;
  materialPath: string;
  sourceHash: string;
  outlineFingerprint: string;
  occurredAt: number;
  trainingSessionId?: string;
  trainingActivityId?: string;
}

export type AcademySectionStudyEvent = SectionEventBase & (
  | { kind: 'coverage'; coverage: SectionCoverage }
  | { kind: 'self-check'; timing: SectionRecallTiming; rating: SectionRecallRating }
);

export interface AcademyTopicProgressSnapshot {
  selection: AcademyMaterialSelection | null;
  events: readonly AcademySectionStudyEvent[];
}

export interface AcademyStudyProgressOverviewSnapshot {
  selections: readonly AcademyMaterialSelection[];
  events: readonly AcademySectionStudyEvent[];
}

const hashPattern = /^[a-f0-9]{64}$/i;
const sectionIdPattern = /^ci-[a-f0-9]{20}$/i;
const eventIdPattern = /^[a-zA-Z0-9_-]{8,128}$/;
const coverages = new Set<SectionCoverage>(['not-started', 'partial', 'covered']);
const timings = new Set<SectionRecallTiming>(['assisted', 'immediate', 'delayed']);
const ratings = new Set<SectionRecallRating>(['not-recalled', 'partial', 'recalled']);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function isAcademyMaterialReference(value: unknown): value is AcademyMaterialReference {
  if (!isRecord(value)) return false;
  return typeof value.path === 'string' && value.path.length > 0 && value.path.length <= 500
    && typeof value.sourceHash === 'string' && hashPattern.test(value.sourceHash)
    && typeof value.outlineFingerprint === 'string' && hashPattern.test(value.outlineFingerprint)
    && typeof value.outlineStructureFingerprint === 'string' && hashPattern.test(value.outlineStructureFingerprint)
    && (value.role === 'syllabus' || value.role === 'supplementary');
}

export function isAcademyMaterialSelection(value: unknown): value is AcademyMaterialSelection {
  if (!isRecord(value)) return false;
  return isStudyTopicId(value.topicId)
    && Array.isArray(value.materials) && value.materials.length <= 30
    && value.materials.every(isAcademyMaterialReference)
    && new Set(value.materials.map(material => material.path)).size === value.materials.length
    && Number.isInteger(value.revision) && (value.revision as number) >= 0
    && Number.isFinite(value.updatedAt) && (value.updatedAt as number) >= 0;
}

export function isAcademySectionStudyEvent(value: unknown): value is AcademySectionStudyEvent {
  if (!isRecord(value) || !eventIdPattern.test(String(value.id ?? '')) || !isStudyTopicId(value.topicId)
    || typeof value.sectionId !== 'string' || !sectionIdPattern.test(value.sectionId)
    || typeof value.materialPath !== 'string' || value.materialPath.length === 0 || value.materialPath.length > 500
    || typeof value.sourceHash !== 'string' || !hashPattern.test(value.sourceHash)
    || typeof value.outlineFingerprint !== 'string' || !hashPattern.test(value.outlineFingerprint)
    || !Number.isFinite(value.occurredAt) || (value.occurredAt as number) < 0
    || (value.trainingSessionId !== undefined && (typeof value.trainingSessionId !== 'string' || value.trainingSessionId.length > 128))
    || (value.trainingActivityId !== undefined && (typeof value.trainingActivityId !== 'string' || value.trainingActivityId.length > 128))) return false;
  if (value.kind === 'coverage') return coverages.has(value.coverage as SectionCoverage);
  if (value.kind === 'self-check') return timings.has(value.timing as SectionRecallTiming) && ratings.has(value.rating as SectionRecallRating);
  return false;
}

export function isCurrentAcademyMaterialSelection(topic: {
  files: readonly { path: string; sha256?: string; outlineFingerprint?: string; outlineStructureFingerprint?: string; kind: string }[];
}, selection: AcademyMaterialSelection | null): boolean {
  if (!selection) return false;
  return selection.materials.every(selected => {
    const file = topic.files.find(candidate => candidate.path === selected.path);
    return !!file && file.sha256 === selected.sourceHash && file.outlineFingerprint === selected.outlineFingerprint
      && file.outlineStructureFingerprint === selected.outlineStructureFingerprint
      && (file.kind === 'syllabus' ? selected.role === 'syllabus' : selected.role === 'supplementary');
  });
}

export function sectionCoverage(events: readonly AcademySectionStudyEvent[]): SectionCoverage {
  const latest = events.filter((event): event is AcademySectionStudyEvent & { kind: 'coverage' } => event.kind === 'coverage')
    .sort((first, second) => first.occurredAt - second.occurredAt || first.id.localeCompare(second.id)).at(-1);
  return latest?.coverage ?? 'not-started';
}

export function sectionRecallHistory(events: readonly AcademySectionStudyEvent[]): readonly (AcademySectionStudyEvent & { kind: 'self-check' })[] {
  return events.filter((event): event is AcademySectionStudyEvent & { kind: 'self-check' } => event.kind === 'self-check')
    .sort((first, second) => first.occurredAt - second.occurredAt || first.id.localeCompare(second.id));
}
