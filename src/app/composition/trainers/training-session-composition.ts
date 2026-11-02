import type { TrainingActivity } from '../../../core/domain/entities.js';
import type { DailyTrainingPlan } from '../../../core/domain/study-training-plan.js';
import {
  completeTrainingSessionActivity,
  attachTrainingAttemptSession,
  createDailyTrainingSession,
  pauseTrainingSessionActivity,
  startTrainingSessionActivity,
  type DailyTrainingSession,
  type TrainingActivityReference,
  type TrainingSessionHistoryEntry,
} from '../../../core/domain/study-training-session.js';
import { mergeRemoteTrainingSession, mergeRemoteTrainingSessionHistory, readTrainingSession, readTrainingSessionHistory, saveTrainingSession } from '../../../adapters/local/training-session.js';

export function createTrainingSessionComposition(dependencies: {
  accountId(): string | null;
  now(): number;
  push?(session: DailyTrainingSession): void;
}) {
  const getSession = () => readTrainingSession(dependencies.accountId(), dependencies.now());
  const save = (session: DailyTrainingSession) => {
    const updatedAt = Math.max(dependencies.now(), (session.updatedAt ?? session.startedAt) + 1);
    const checkpoint = { ...session, updatedAt };
    saveTrainingSession(dependencies.accountId(), checkpoint);
    dependencies.push?.(checkpoint);
    return checkpoint;
  };
  return {
    getSession,
    getHistory(): readonly TrainingSessionHistoryEntry[] {
      return readTrainingSessionHistory(dependencies.accountId());
    },
    mergeRemote(session: unknown, updatedAt: number): boolean {
      return mergeRemoteTrainingSession(dependencies.accountId(), dependencies.now(), session, updatedAt);
    },
    mergeRemoteHistory(history: unknown): boolean {
      return mergeRemoteTrainingSessionHistory(dependencies.accountId(), history);
    },
    start(plan: DailyTrainingPlan): DailyTrainingSession | null {
      const existing = getSession();
      if (existing) return existing;
      const created = createDailyTrainingSession(plan, dependencies.now());
      if (created) return save(created);
      return created;
    },
    startCurrentActivity(): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const started = startTrainingSessionActivity(session, dependencies.now());
      return started !== session ? save(started) : started;
    },
    pauseCurrentActivity(): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const paused = pauseTrainingSessionActivity(session, dependencies.now());
      return paused !== session ? save(paused) : paused;
    },
    completeActivity(activity: TrainingActivity, expected?: TrainingActivityReference): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const completed = completeTrainingSessionActivity(session, activity, dependencies.now(), expected);
      return completed !== session ? save(completed) : completed;
    },
    attachAttemptSession(attemptSessionId: string, expected?: TrainingActivityReference): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const updated = attachTrainingAttemptSession(session, attemptSessionId, dependencies.now(), expected);
      return updated !== session ? save(updated) : updated;
    },
    getCurrentActivityReference(): TrainingActivityReference | null {
      const session = getSession();
      if (!session) return null;
      const activity = session.activities[session.currentIndex];
      return activity
        ? { sessionId: session.id, activityId: activity.id ?? `${session.id}:activity:${session.currentIndex + 1}` }
        : null;
    },
  };
}
