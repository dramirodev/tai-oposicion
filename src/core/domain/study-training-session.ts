import type { StudyReviewMode, TrainingActivity } from './entities.js';
import type { DailyTrainingPlan, TrainingPlanReason } from './study-training-plan.js';

export interface TrainingSessionStep {
  activity: TrainingActivity;
  minutes: number;
  reason: TrainingPlanReason;
  topicId?: string;
  topicIds?: readonly string[];
  reviewMode?: StudyReviewMode;
}

export interface DailyTrainingSession {
  dateKey: string;
  activities: readonly TrainingSessionStep[];
  currentIndex: number;
  currentStartedAt: number | null;
  /** Measured foreground study time per activity, retained when paused. */
  elapsedSecondsByActivity?: readonly number[];
  /** Monotonic-ish local checkpoint time used to resolve cross-device updates. */
  updatedAt?: number;
  startedAt: number;
  completedAt: number | null;
}

/** Immutable summary of one completed daily training session. */
export interface TrainingSessionHistoryEntry {
  id: string;
  dateKey: string;
  startedAt: number;
  completedAt: number;
  plannedMinutes: number;
  activities: readonly TrainingSessionStep[];
  elapsedSecondsByActivity: readonly number[];
}

export const MAX_TRAINING_SESSION_HISTORY = 30;

export function toTrainingSessionHistoryEntry(session: DailyTrainingSession): TrainingSessionHistoryEntry | null {
  if (session.completedAt === null || session.currentIndex !== session.activities.length || !session.activities.length) return null;
  return {
    id: session.dateKey,
    dateKey: session.dateKey,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    plannedMinutes: session.activities.reduce((sum, activity) => sum + activity.minutes, 0),
    activities: session.activities.map(activity => ({ ...activity, ...(activity.topicIds ? { topicIds: [...activity.topicIds] } : {}) })),
    elapsedSecondsByActivity: session.activities.map((_, index) => session.elapsedSecondsByActivity?.[index] ?? 0),
  };
}

export function localTrainingDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDailyTrainingSession(plan: DailyTrainingPlan, timestamp: number): DailyTrainingSession | null {
  if (plan.restDay || !plan.activities.length) return null;
  return {
    dateKey: localTrainingDateKey(timestamp),
    activities: plan.activities.map(({ activity, minutes, reason, topicId, topicIds, reviewIntervention }) => ({ activity, minutes, reason, ...(topicId ? { topicId } : {}), ...(topicIds ? { topicIds: [...topicIds] } : {}), ...(reviewIntervention ? { reviewMode: reviewIntervention.mode } : {}) })),
    currentIndex: 0,
    currentStartedAt: null,
    elapsedSecondsByActivity: plan.activities.map(() => 0),
    updatedAt: timestamp,
    startedAt: timestamp,
    completedAt: null,
  };
}

export function startTrainingSessionActivity(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  if (session.completedAt !== null || session.currentIndex >= session.activities.length || session.currentStartedAt !== null) return session;
  return { ...session, currentStartedAt: Math.max(timestamp, session.startedAt), updatedAt: timestamp };
}

export function pauseTrainingSessionActivity(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  const startedAt = session.currentStartedAt;
  if (session.completedAt !== null || startedAt === null || session.currentIndex >= session.activities.length) return session;
  const elapsedSecondsByActivity = [...(session.elapsedSecondsByActivity ?? session.activities.map(() => 0))];
  elapsedSecondsByActivity[session.currentIndex] += Math.max(0, Math.floor((timestamp - startedAt) / 1000));
  return { ...session, currentStartedAt: null, elapsedSecondsByActivity, updatedAt: timestamp };
}

export function completeTrainingSessionActivity(
  session: DailyTrainingSession,
  activity: TrainingActivity,
  timestamp: number,
): DailyTrainingSession {
  if (session.completedAt !== null || session.currentStartedAt === null
    || session.activities[session.currentIndex]?.activity !== activity) return session;
  const currentIndex = session.currentIndex + 1;
  const isComplete = currentIndex >= session.activities.length;
  const elapsedSecondsByActivity = [...(session.elapsedSecondsByActivity ?? session.activities.map(() => 0))];
  elapsedSecondsByActivity[session.currentIndex] += Math.max(0, Math.floor((timestamp - session.currentStartedAt) / 1000));
  return {
    ...session,
    currentIndex,
    currentStartedAt: null,
    elapsedSecondsByActivity,
    updatedAt: timestamp,
    completedAt: isComplete ? Math.max(timestamp, session.currentStartedAt, session.startedAt) : null,
  };
}
