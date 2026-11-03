import { localTrainingDateKey } from './study-training-session.js';
import { isStudyTopicId } from './topic-id.js';

export type PaperTestCorrectionStatus = 'unavailable' | 'answer-key-only' | 'reviewed';
export type PaperTestSelfRating = 'remembered' | 'partial' | 'not-remembered';

/** Aggregate notes for one paper-test segment. It never creates question-level answers or scores. */
export interface PaperTestAttemptSegment {
  id: string;
  attemptId: string;
  segment: number;
  dateKey: string;
  startedAt: number;
  completedAt: number;
  updatedAt: number;
  topicId?: string;
  sectionIds?: readonly string[];
  sourceLabel?: string;
  questionCount?: number;
  answeredCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  blankCount?: number;
  doubtfulCount?: number;
  correctionStatus: PaperTestCorrectionStatus;
  selfRating?: PaperTestSelfRating;
}

export const MAX_PAPER_TEST_SEGMENTS = 300;
/** Product heuristic shared with paper recall: a weak self-report can guide review for 30 days. */
export const PAPER_TEST_PRIORITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const correctionStatuses = new Set<PaperTestCorrectionStatus>(['unavailable', 'answer-key-only', 'reviewed']);
const selfRatings = new Set<PaperTestSelfRating>(['remembered', 'partial', 'not-remembered']);

const optionalCount = (value: unknown) => value === undefined || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1000);

export function isPaperTestAttemptSegment(value: unknown): value is PaperTestAttemptSegment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<PaperTestAttemptSegment>;
  if (typeof item.id !== 'string' || item.id.length < 8 || item.id.length > 160
    || typeof item.attemptId !== 'string' || item.attemptId.length < 8 || item.attemptId.length > 128
    || !Number.isInteger(item.segment) || item.segment! < 1 || item.segment! > 100
    || typeof item.dateKey !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(item.dateKey)
    || !Number.isFinite(item.startedAt) || item.startedAt! < 0
    || !Number.isFinite(item.completedAt) || item.completedAt! < item.startedAt!
    || !Number.isFinite(item.updatedAt) || item.updatedAt! < item.completedAt!
    || !correctionStatuses.has(item.correctionStatus as PaperTestCorrectionStatus)
    || (item.topicId !== undefined && !isStudyTopicId(item.topicId))
    || (item.sourceLabel !== undefined && (typeof item.sourceLabel !== 'string' || item.sourceLabel.length > 160))
    || (item.sectionIds !== undefined && (!Array.isArray(item.sectionIds) || item.sectionIds.length > 100 || item.sectionIds.some(id => typeof id !== 'string' || id.length < 4 || id.length > 160) || new Set(item.sectionIds).size !== item.sectionIds.length))
    || !optionalCount(item.questionCount) || !optionalCount(item.answeredCount) || !optionalCount(item.correctCount)
    || !optionalCount(item.incorrectCount) || !optionalCount(item.blankCount) || !optionalCount(item.doubtfulCount)
    || (item.selfRating !== undefined && !selfRatings.has(item.selfRating))) return false;
  if (item.answeredCount !== undefined && item.questionCount !== undefined && item.answeredCount > item.questionCount) return false;
  if (item.blankCount !== undefined && item.questionCount !== undefined && item.blankCount > item.questionCount) return false;
  if (item.answeredCount !== undefined && item.blankCount !== undefined && item.questionCount !== undefined
    && item.answeredCount + item.blankCount !== item.questionCount) return false;
  if (item.correctCount !== undefined && item.incorrectCount !== undefined && item.answeredCount !== undefined
    && item.correctCount + item.incorrectCount !== item.answeredCount) return false;
  if (item.doubtfulCount !== undefined && item.answeredCount !== undefined && item.doubtfulCount > item.answeredCount) return false;
  return true;
}

export function createPaperTestAttemptSegment(input: Omit<PaperTestAttemptSegment, 'dateKey' | 'updatedAt'>, now: number): PaperTestAttemptSegment | null {
  if (!Number.isFinite(now) || now < input.completedAt) return null;
  const result: PaperTestAttemptSegment = { ...input, dateKey:localTrainingDateKey(input.completedAt), updatedAt:now };
  return isPaperTestAttemptSegment(result) ? result : null;
}

/** Merge stable segment IDs; later edits replace only that segment and never affect objective question history. */
export function mergePaperTestAttemptSegments(current: readonly PaperTestAttemptSegment[], incoming: readonly unknown[]): PaperTestAttemptSegment[] {
  const byId = new Map(current.filter(isPaperTestAttemptSegment).map(item => [item.id, item]));
  for (const value of incoming) {
    if (!isPaperTestAttemptSegment(value)) continue;
    const previous = byId.get(value.id);
    if (!previous || value.updatedAt > previous.updatedAt) byId.set(value.id, value);
  }
  return [...byId.values()].sort((a, b) => b.completedAt - a.completedAt || a.id.localeCompare(b.id)).slice(0, MAX_PAPER_TEST_SEGMENTS);
}

/** Latest optional self-rating per topic; counts and answer-key outcomes are intentionally ignored. */
export function latestPaperTestSelfRatingByTopic(segments: readonly PaperTestAttemptSegment[]): ReadonlyMap<string, PaperTestAttemptSegment> {
  const latest = new Map<string, PaperTestAttemptSegment>();
  for (const segment of [...segments].sort((left, right) => right.completedAt - left.completedAt)) {
    if (segment.topicId && segment.selfRating && !latest.has(segment.topicId)) latest.set(segment.topicId, segment);
  }
  return latest;
}

export function needsPaperTestFollowUp(segment: PaperTestAttemptSegment, timestamp: number): boolean {
  return segment.selfRating !== undefined && segment.selfRating !== 'remembered'
    && Number.isFinite(timestamp) && timestamp >= segment.completedAt
    && timestamp - segment.completedAt <= PAPER_TEST_PRIORITY_WINDOW_MS;
}

/** Return only already-studied topics whose latest paper self-rating requests follow-up. */
export function paperTestFollowUpTopicIds(segments: readonly PaperTestAttemptSegment[], studiedTopicIds: readonly string[], timestamp: number): string[] {
  const studied = new Set(studiedTopicIds);
  return [...latestPaperTestSelfRatingByTopic(segments).values()]
    .filter(segment => !!segment.topicId && studied.has(segment.topicId) && needsPaperTestFollowUp(segment, timestamp))
    .map(segment => segment.topicId!);
}
