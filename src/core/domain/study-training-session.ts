import type { StudyReviewMode, TrainingActivity } from './entities.js';
import type { DailyTrainingPlan, TrainingPlanReason } from './study-training-plan.js';

export interface TrainingSessionStep {
  /** Stable within its parent checkpoint; legacy steps are derived from dateKey and position. */
  id?: string;
  activity: TrainingActivity;
  minutes: number;
  reason: TrainingPlanReason;
  topicId?: string;
  topicIds?: readonly string[];
  reviewMode?: StudyReviewMode;
  /** Detailed question-session IDs produced while this planned activity was active. */
  attemptSessionIds?: readonly string[];
}

export interface DailyTrainingSession {
  schemaVersion: 2;
  id: string;
  dateKey: string;
  activities: readonly TrainingSessionStep[];
  currentIndex: number;
  currentStartedAt: number | null;
  /** A timed rest checkpoint; current activity stays selected and is never duplicated. */
  breakStartedAt?: number | null;
  breakDurationMinutes?: number;
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
  sessionId?: string;
  dateKey: string;
  startedAt: number;
  completedAt: number;
  plannedMinutes: number;
  activities: readonly TrainingSessionStep[];
  elapsedSecondsByActivity: readonly number[];
}

export const MAX_TRAINING_SESSION_HISTORY = 30;

export interface TrainingActivityReference { sessionId: string; activityId: string }

export function trainingActivityReference(session: DailyTrainingSession): TrainingActivityReference | null {
  const activity = session.activities[session.currentIndex];
  return activity ? { sessionId: session.id, activityId: activity.id ?? `${session.id}:activity:${session.currentIndex + 1}` } : null;
}

export function toTrainingSessionHistoryEntry(session: DailyTrainingSession): TrainingSessionHistoryEntry | null {
  if (session.completedAt === null || session.currentIndex !== session.activities.length || !session.activities.length) return null;
  return {
    id: session.dateKey,
    sessionId: session.id,
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

/** Medianoche local de `dateKey` (YYYY-MM-DD) desplazada `offsetDays` días de calendario; NaN si no hay fecha. */
export function localDayStart(dateKey: string, offsetDays = 0): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day + offsetDays).getTime();
}

export function createDailyTrainingSession(plan: DailyTrainingPlan, timestamp: number): DailyTrainingSession | null {
  if (plan.restDay || !plan.activities.length) return null;
  const dateKey = localTrainingDateKey(timestamp);
  const id = `training:${dateKey}`;
  return {
    schemaVersion: 2,
    id,
    dateKey,
    activities: plan.activities.map(({ activity, minutes, reason, topicId, topicIds, reviewIntervention }, index) => ({ id: `${id}:activity:${index + 1}`, activity, minutes, reason, ...(topicId ? { topicId } : {}), ...(topicIds ? { topicIds: [...topicIds] } : {}), ...(reviewIntervention ? { reviewMode: reviewIntervention.mode } : {}) })),
    currentIndex: 0,
    currentStartedAt: null,
    elapsedSecondsByActivity: plan.activities.map(() => 0),
    updatedAt: timestamp,
    startedAt: timestamp,
    completedAt: null,
  };
}

export function startTrainingSessionActivity(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  if (session.completedAt !== null || session.currentIndex >= session.activities.length || session.currentStartedAt !== null || session.breakStartedAt != null) return session;
  return { ...session, currentStartedAt: Math.max(timestamp, session.startedAt), updatedAt: timestamp };
}

export function pauseTrainingSessionActivity(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  const startedAt = session.currentStartedAt;
  if (session.completedAt !== null || startedAt === null || session.currentIndex >= session.activities.length) return session;
  const elapsedSecondsByActivity = [...(session.elapsedSecondsByActivity ?? session.activities.map(() => 0))];
  elapsedSecondsByActivity[session.currentIndex] += Math.max(0, Math.floor((timestamp - startedAt) / 1000));
  return { ...session, currentStartedAt: null, elapsedSecondsByActivity, updatedAt: timestamp };
}

export function beginTrainingSessionBreak(session: DailyTrainingSession, timestamp: number, durationMinutes = 5): DailyTrainingSession {
  if (session.completedAt !== null || session.currentIndex >= session.activities.length || session.breakStartedAt != null
    || !Number.isInteger(durationMinutes) || durationMinutes < 3 || durationMinutes > 15) return session;
  const paused = pauseTrainingSessionActivity(session, timestamp);
  return { ...paused, breakStartedAt: timestamp, breakDurationMinutes: durationMinutes, updatedAt: timestamp };
}

export function endTrainingSessionBreak(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  if (session.breakStartedAt == null) return session;
  return { ...session, breakStartedAt: null, updatedAt: timestamp };
}

export function completeTrainingSessionActivity(
  session: DailyTrainingSession,
  activity: TrainingActivity,
  timestamp: number,
  expected?: TrainingActivityReference,
): DailyTrainingSession {
  if (session.completedAt !== null || session.currentStartedAt === null
    || session.activities[session.currentIndex]?.activity !== activity) return session;
  if (expected && (expected.sessionId !== session.id || expected.activityId !== (session.activities[session.currentIndex]?.id ?? `${session.id}:activity:${session.currentIndex + 1}`))) return session;
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

/** Links a question-attempt session to the active planned step exactly once. */
export function attachTrainingAttemptSession(
  session: DailyTrainingSession,
  attemptSessionId: string,
  timestamp: number,
  expected?: TrainingActivityReference,
): DailyTrainingSession {
  const activity = session.activities[session.currentIndex];
  if (session.completedAt !== null || session.currentStartedAt === null || !activity || !attemptSessionId.trim()) return session;
  if (expected && (expected.sessionId !== session.id || expected.activityId !== (activity.id ?? `${session.id}:activity:${session.currentIndex + 1}`))) return session;
  if (activity.attemptSessionIds?.includes(attemptSessionId)) return session;
  const activities = [...session.activities];
  activities[session.currentIndex] = { ...activity, attemptSessionIds: [...(activity.attemptSessionIds ?? []), attemptSessionId] };
  return { ...session, activities, updatedAt: timestamp };
}
