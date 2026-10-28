import type { DailyTrainingSession, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import type { StudyReviewMode, TrainingActivity } from '../../core/domain/entities.js';
import type { TrainingPlanReason } from '../../core/domain/study-training-plan.js';
import { localTrainingDateKey } from '../../core/domain/study-training-session.js';

const activities = new Set<TrainingActivity>(['activeRecall', 'topicTest', 'failures', 'spacedReviews']);
const reasons = new Set<TrainingPlanReason>(['active-recall', 'new-topic-day', 'weak-topics', 'coverage', 'recurring-failures', 'due-reviews']);
const reviewModes = new Set<StudyReviewMode>(['initial-study', 'active-retrieval', 'selective-reading', 'broad-reading']);
const keyFor = (accountId: string | null) => `tai.training-session.v1.${encodeURIComponent(accountId || 'guest')}`;

type StoredTrainingSessionStep = Pick<TrainingSessionStep, 'activity' | 'minutes'>
  & Partial<Pick<TrainingSessionStep, 'reason' | 'topicId' | 'reviewMode'>>;
type StoredTrainingSession = Omit<DailyTrainingSession, 'activities'> & { activities: readonly StoredTrainingSessionStep[] };

function isSessionStep(value: unknown): value is StoredTrainingSessionStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const step = value as Partial<StoredTrainingSessionStep>;
  return activities.has(step.activity as TrainingActivity)
    && Number.isInteger(step.minutes) && step.minutes! > 0 && step.minutes! <= 240
    && (step.reason === undefined || reasons.has(step.reason as TrainingPlanReason))
    && (step.reviewMode === undefined || reviewModes.has(step.reviewMode as StudyReviewMode))
    && (step.topicId === undefined || (typeof step.topicId === 'string' && /^T[1-4]\.\d{2}$/.test(step.topicId)));
}

function isDailyTrainingSession(value: unknown, timestamp: number): value is StoredTrainingSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<StoredTrainingSession>;
  if (session.dateKey !== localTrainingDateKey(timestamp) || !Array.isArray(session.activities)
    || !session.activities.length || session.activities.length > 4 || !session.activities.every(isSessionStep)
    || new Set(session.activities.map(step => step.activity)).size !== session.activities.length
    || !Number.isInteger(session.currentIndex) || session.currentIndex! < 0 || session.currentIndex! > session.activities.length
    || !Number.isFinite(session.startedAt) || session.startedAt! < 0
    || (session.currentStartedAt !== null && (!Number.isFinite(session.currentStartedAt) || session.currentStartedAt! < session.startedAt!))
    || (session.completedAt !== null && (!Number.isFinite(session.completedAt) || session.completedAt! < session.startedAt!))) return false;
  if (session.completedAt !== null && session.currentIndex !== session.activities.length) return false;
  if (session.completedAt === null && session.currentIndex === session.activities.length) return false;
  return true;
}

const defaultReason: Record<TrainingActivity, TrainingPlanReason> = {
  activeRecall: 'active-recall', topicTest: 'coverage', failures: 'recurring-failures', spacedReviews: 'due-reviews',
};

export function readTrainingSession(accountId: string | null, timestamp: number): DailyTrainingSession | null {
  const key = keyFor(accountId);
  let serialized: string | null;
  try { serialized = localStorage.getItem(key); }
  catch { return null; }
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isDailyTrainingSession(parsed, timestamp)) return {
      ...parsed,
      activities: parsed.activities.map(step => ({
        activity: step.activity,
        minutes: step.minutes,
        reason: step.reason ?? defaultReason[step.activity],
        ...(step.topicId ? { topicId: step.topicId } : {}),
        ...(step.reviewMode ? { reviewMode: step.reviewMode } : {}),
      })),
    };
  } catch { /* Invalid local checkpoints are removed below. */ }
  try { localStorage.removeItem(key); }
  catch { /* Storage may be unavailable in private browsing modes. */ }
  return null;
}

export function saveTrainingSession(accountId: string | null, session: DailyTrainingSession): void {
  try { localStorage.setItem(keyFor(accountId), JSON.stringify(session)); }
  catch { /* The daily plan remains usable if storage is unavailable. */ }
}

export function clearTrainingSession(accountId: string | null): void {
  try { localStorage.removeItem(keyFor(accountId)); }
  catch { /* Clearing a checkpoint must not block study navigation. */ }
}
