import type { TrainingActivity } from '../../../core/domain/entities.js';
import type { DailyTrainingPlan } from '../../../core/domain/study-training-plan.js';
import {
  completeTrainingSessionActivity,
  createDailyTrainingSession,
  startTrainingSessionActivity,
  type DailyTrainingSession,
} from '../../../core/domain/study-training-session.js';
import { readTrainingSession, saveTrainingSession } from '../../../adapters/local/training-session.js';

export function createTrainingSessionComposition(dependencies: {
  accountId(): string | null;
  now(): number;
}) {
  const getSession = () => readTrainingSession(dependencies.accountId(), dependencies.now());
  const save = (session: DailyTrainingSession) => saveTrainingSession(dependencies.accountId(), session);
  return {
    getSession,
    start(plan: DailyTrainingPlan): DailyTrainingSession | null {
      const existing = getSession();
      if (existing) return existing;
      const created = createDailyTrainingSession(plan, dependencies.now());
      if (created) save(created);
      return created;
    },
    startCurrentActivity(): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const started = startTrainingSessionActivity(session, dependencies.now());
      if (started !== session) save(started);
      return started;
    },
    completeActivity(activity: TrainingActivity): DailyTrainingSession | null {
      const session = getSession();
      if (!session) return null;
      const completed = completeTrainingSessionActivity(session, activity, dependencies.now());
      if (completed !== session) save(completed);
      return completed;
    },
  };
}
