import type { AttemptArchive } from './archive.js';
import { computeActiveTime } from './active-time.js';
import type { AttemptEvent } from './transitions.js';

export interface ObservedStudyTime {
  observedMilliseconds: number;
  questionAttempts: number;
  completeAttempts: number;
  partialAttempts: number;
  unavailableAttempts: number;
}

/** Sums recorded visible-question intervals without estimating missing time. */
export function summarizeObservedStudyTime(archive: AttemptArchive): ObservedStudyTime {
  const eventsByAttempt = new Map<string, AttemptEvent[]>();
  for (const event of archive.events) {
    const events = eventsByAttempt.get(event.attemptId) ?? [];
    events.push(event);
    eventsByAttempt.set(event.attemptId, events);
  }

  const summary: ObservedStudyTime = {
    observedMilliseconds: 0,
    questionAttempts: 0,
    completeAttempts: 0,
    partialAttempts: 0,
    unavailableAttempts: 0,
  };
  const seenAttempts = new Set<string>();
  for (const attempt of archive.attempts) {
    if (seenAttempts.has(attempt.id)) continue;
    seenAttempts.add(attempt.id);
    const activeTime = computeActiveTime(eventsByAttempt.get(attempt.id) ?? []);
    summary.questionAttempts++;
    summary.observedMilliseconds += activeTime.milliseconds;
    if (activeTime.quality === 'complete') summary.completeAttempts++;
    else if (activeTime.quality === 'partial') summary.partialAttempts++;
    else summary.unavailableAttempts++;
  }
  return summary;
}
