import { mergeRemoteScheduledStudyActivities, readScheduledStudyActivities, saveScheduledStudyActivities } from '../../../adapters/local/training-calendar.js';
import { proposeStudyActivity, proposeStudyActivityReschedule, type ScheduleDecision, type ScheduledStudyActivity, type ScheduledStudyActivityKind } from '../../../core/domain/study-training-calendar.js';
import type { TrainingPreferences } from '../../../core/domain/entities.js';

type CalendarDecision = ScheduleDecision | { ok:false; reason:'storage-failed' };
let fallbackIdSequence = 0;

function newActivityId(): string {
  try {
    const values = globalThis.crypto?.getRandomValues(new Uint32Array(4));
    if (values) return `review-${Array.from(values, value => value.toString(16).padStart(8, '0')).join('')}`;
  } catch { /* Older or restricted browser: use a local unique fallback. */ }
  return `review-${Date.now()}-${fallbackIdSequence++}-${Math.random().toString(36).slice(2)}`;
}

/** Coordinates the tested calendar rules with account-scoped persistence and cloud sync. */
export function createTrainingCalendarComposition(dependencies: {
  accountId(): string | null; now(): number; getSeenTopics(): readonly string[];
  getPreferences(): TrainingPreferences; push?(activities: readonly ScheduledStudyActivity[]): void; createId?(): string;
}) {
  const get = () => readScheduledStudyActivities(dependencies.accountId());
  const store = (activities: readonly ScheduledStudyActivity[]): boolean => {
    const accountId = dependencies.accountId();
    if (!saveScheduledStudyActivities(accountId, activities)) return false;
    dependencies.push?.(readScheduledStudyActivities(accountId));
    return true;
  };

  return {
    get,
    mergeRemote(value: unknown): boolean { return mergeRemoteScheduledStudyActivities(dependencies.accountId(), value); },
    schedule(input: { dateKey: string; activity: ScheduledStudyActivityKind; topicId: string; minutes: number }): CalendarDecision {
      const existing = get();
      const decision = proposeStudyActivity({ ...input, now:dependencies.now(), preferences:dependencies.getPreferences(), seenTopicIds:dependencies.getSeenTopics(), existing });
      if (!decision.ok) return decision;
      const activity = { ...decision.activity, id:dependencies.createId?.() ?? newActivityId() };
      const created = { ...decision, activity };
      return store([...existing, activity]) ? created : { ok:false, reason:'storage-failed' };
    },
    reschedule(input: { id: string; dateKey: string }): CalendarDecision {
      const existing = get();
      const decision = proposeStudyActivityReschedule({ ...input, now:dependencies.now(), preferences:dependencies.getPreferences(), seenTopicIds:dependencies.getSeenTopics(), existing });
      if (!decision.ok) return decision;
      return store([...existing, decision.activity]) ? decision : { ok:false, reason:'storage-failed' };
    },
  };
}
