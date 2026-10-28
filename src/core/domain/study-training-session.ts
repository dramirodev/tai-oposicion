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
  startedAt: number;
  completedAt: number | null;
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
    startedAt: timestamp,
    completedAt: null,
  };
}

export function startTrainingSessionActivity(session: DailyTrainingSession, timestamp: number): DailyTrainingSession {
  if (session.completedAt !== null || session.currentIndex >= session.activities.length || session.currentStartedAt !== null) return session;
  return { ...session, currentStartedAt: Math.max(timestamp, session.startedAt) };
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
  return {
    ...session,
    currentIndex,
    currentStartedAt: null,
    completedAt: isComplete ? Math.max(timestamp, session.currentStartedAt, session.startedAt) : null,
  };
}
