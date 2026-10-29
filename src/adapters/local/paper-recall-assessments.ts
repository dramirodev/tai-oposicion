import { MAX_PAPER_RECALL_ASSESSMENTS, createPaperRecallAssessment, isPaperRecallAssessment, mergePaperRecallAssessments, type PaperRecallAssessment, type PaperRecallRating } from '../../core/domain/paper-recall-assessment.js';
import { localTrainingDateKey } from '../../core/domain/study-training-session.js';

const keyFor = (accountId: string | null) => `tai.paper-recall.v1.${encodeURIComponent(accountId || 'guest')}`;

export function readPaperRecallAssessments(accountId: string | null): readonly PaperRecallAssessment[] {
  try {
    const serialized = localStorage.getItem(keyFor(accountId));
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return mergePaperRecallAssessments([], parsed);
  } catch { return []; }
}

export function mergePaperRecallAssessmentRecords(accountId: string | null, incoming: readonly unknown[]): boolean {
  const current = readPaperRecallAssessments(accountId);
  const merged = mergePaperRecallAssessments(current, incoming);
  if (merged.length === current.length && merged.every((item, index) => item.id === current[index]?.id && item.ratedAt === current[index]?.ratedAt && item.rating === current[index]?.rating)) return false;
  try { localStorage.setItem(keyFor(accountId), JSON.stringify(merged)); }
  catch { return false; /* Paper study and the session remain usable when browser storage is unavailable. */ }
  return true;
}

export function recordPaperRecallAssessment(accountId: string | null, topicId: string, rating: PaperRecallRating, timestamp: number): PaperRecallAssessment | null {
  const existing = readPaperRecallAssessments(accountId).find(item => item.id === `${localTrainingDateKey(timestamp)}:${topicId}`);
  const assessment = createPaperRecallAssessment(topicId, rating, existing ? Math.max(timestamp, existing.ratedAt + 1) : timestamp);
  if (!assessment) return null;
  return mergePaperRecallAssessmentRecords(accountId, [assessment]) ? assessment : null;
}

export function isPaperRecallAssessmentList(value: unknown): value is readonly PaperRecallAssessment[] {
  return Array.isArray(value) && value.length <= MAX_PAPER_RECALL_ASSESSMENTS && value.every(isPaperRecallAssessment);
}
