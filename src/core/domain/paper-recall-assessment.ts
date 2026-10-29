import { localTrainingDateKey } from './study-training-session.js';

export type PaperRecallRating = 'remembered' | 'partial' | 'not-remembered';

/** Self-reported recall after studying the printed syllabus; it is not an objective score. */
export interface PaperRecallAssessment {
  id: string;
  topicId: string;
  dateKey: string;
  ratedAt: number;
  rating: PaperRecallRating;
}

export const MAX_PAPER_RECALL_ASSESSMENTS = 90;
/** Product heuristic: a weak self-report is a planning signal for 30 days, not a mastery score. */
export const PAPER_RECALL_PRIORITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const validRatings = new Set<PaperRecallRating>(['remembered', 'partial', 'not-remembered']);

export function isPaperRecallAssessment(value: unknown): value is PaperRecallAssessment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const assessment = value as Partial<PaperRecallAssessment>;
  return typeof assessment.topicId === 'string' && /^T[1-4]\.\d{2}$/.test(assessment.topicId)
    && typeof assessment.dateKey === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(assessment.dateKey)
    && assessment.id === `${assessment.dateKey}:${assessment.topicId}`
    && Number.isFinite(assessment.ratedAt) && assessment.ratedAt! >= 0
    && validRatings.has(assessment.rating as PaperRecallRating);
}

export function createPaperRecallAssessment(
  topicId: string,
  rating: PaperRecallRating,
  timestamp: number,
): PaperRecallAssessment | null {
  if (!/^T[1-4]\.\d{2}$/.test(topicId) || !validRatings.has(rating) || !Number.isFinite(timestamp) || timestamp < 0) return null;
  const dateKey = localTrainingDateKey(timestamp);
  return { id: `${dateKey}:${topicId}`, topicId, dateKey, ratedAt: timestamp, rating };
}

/** Merge by stable day/topic id; a later correction replaces only that day's self-rating. */
export function mergePaperRecallAssessments(
  current: readonly PaperRecallAssessment[],
  incoming: readonly unknown[],
): PaperRecallAssessment[] {
  const byId = new Map(current.filter(isPaperRecallAssessment).map(item => [item.id, item]));
  for (const value of incoming) {
    if (!isPaperRecallAssessment(value)) continue;
    const previous = byId.get(value.id);
    if (!previous || value.ratedAt > previous.ratedAt) byId.set(value.id, value);
  }
  return [...byId.values()].sort((left, right) => right.ratedAt - left.ratedAt).slice(0, MAX_PAPER_RECALL_ASSESSMENTS);
}

/** Most recent self-report per topic. These values remain explicitly separate from test scores. */
export function latestPaperRecallByTopic(
  assessments: readonly PaperRecallAssessment[],
): ReadonlyMap<string, PaperRecallAssessment> {
  const latest = new Map<string, PaperRecallAssessment>();
  for (const assessment of [...assessments].sort((left, right) => right.ratedAt - left.ratedAt)) {
    if (!latest.has(assessment.topicId)) latest.set(assessment.topicId, assessment);
  }
  return latest;
}

export function needsPaperRecallFollowUp(assessment: PaperRecallAssessment, timestamp: number): boolean {
  return assessment.rating !== 'remembered' && Number.isFinite(timestamp)
    && timestamp >= assessment.ratedAt && timestamp - assessment.ratedAt <= PAPER_RECALL_PRIORITY_WINDOW_MS;
}
