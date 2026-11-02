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
export type SectionFollowUpStatus = 'scheduled' | 'completed' | 'cancelled';

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
  | { kind: 'follow-up'; followUpId: string; sourceSelfCheckEventId: string; dueDateKey: string; status: SectionFollowUpStatus; sectionTitle?: string; printedPage?: number }
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
const followUpStatuses = new Set<SectionFollowUpStatus>(['scheduled', 'completed', 'cancelled']);

/** Stable per-follow-up close event ID so retries cannot append duplicate completion evidence. */
export function sectionFollowUpCompletionEventId(followUpId: string): string {
  let hash = 14695981039346656037n;
  for (let index = 0; index < followUpId.length; index++) {
    hash ^= BigInt(followUpId.charCodeAt(index));
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return `section_done_${hash.toString(16).padStart(16, '0')}`;
}

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
  if (value.kind === 'follow-up') return eventIdPattern.test(String(value.followUpId ?? ''))
    && eventIdPattern.test(String(value.sourceSelfCheckEventId ?? ''))
    && isStudyDateKey(value.dueDateKey) && followUpStatuses.has(value.status as SectionFollowUpStatus)
    && (value.sectionTitle === undefined || (typeof value.sectionTitle === 'string' && value.sectionTitle.length <= 500))
    && (value.printedPage === undefined || (Number.isInteger(value.printedPage) && (value.printedPage as number) >= 0));
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

/** Latest append-only state per explicit follow-up ID; legacy `timing: delayed` events are not schedules. */
export function sectionFollowUps(events: readonly AcademySectionStudyEvent[]): readonly (AcademySectionStudyEvent & { kind: 'follow-up' })[] {
  const latest = new Map<string, AcademySectionStudyEvent & { kind: 'follow-up' }>();
  for (const event of events) {
    if (event.kind !== 'follow-up') continue;
    const previous = latest.get(event.followUpId);
    if (!previous || event.occurredAt > previous.occurredAt
      || (event.occurredAt === previous.occurredAt && event.id.localeCompare(previous.id) > 0)) latest.set(event.followUpId, event);
  }
  return [...latest.values()].sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey) || a.id.localeCompare(b.id));
}

export function canScheduleSectionFollowUp(events: readonly AcademySectionStudyEvent[], sourceSelfCheckEventId: string): boolean {
  const source = events.find(event => event.id === sourceSelfCheckEventId && event.kind === 'self-check');
  return !!source && !events.some(event => event.kind === 'follow-up' && event.followUpId === sourceSelfCheckEventId);
}

function isStudyDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    && [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') === value;
}
