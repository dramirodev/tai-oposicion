import type { AttemptEvent } from './transitions.js';

export type ActiveTimeQuality = 'complete' | 'partial' | 'unavailable';
export interface ActiveTime { milliseconds: number; quality: ActiveTimeQuality }

const starts = new Set<AttemptEvent['type']>(['open', 'resume']);
const stops = new Set<AttemptEvent['type']>(['leave', 'pause', 'close']);

/** Computes proven visible intervals; an unmatched start contributes no estimated duration. */
export function computeActiveTime(events: readonly AttemptEvent[]): ActiveTime {
  const unique = new Map<string, AttemptEvent>();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  const ordered = [...unique.values()].sort((left, right) => left.sequence - right.sequence);
  let activeSince: number | null = null;
  let milliseconds = 0;
  let partial = false;
  let intervals = 0;
  let lastSequence = -1;

  for (const event of ordered) {
    if (event.sequence <= lastSequence) {
      partial = true;
      continue;
    }
    lastSequence = event.sequence;
    const monotonicAt = event.monotonicAt;
    if (monotonicAt === undefined || !Number.isFinite(monotonicAt) || monotonicAt < 0) {
      partial = true;
      if (stops.has(event.type)) activeSince = null;
      continue;
    }

    if (starts.has(event.type)) {
      if (activeSince !== null) partial = true;
      else activeSince = monotonicAt;
      continue;
    }

    if (!stops.has(event.type)) continue;
    if (activeSince === null) {
      partial = true;
      continue;
    }
    if (monotonicAt < activeSince) {
      partial = true;
      activeSince = null;
      continue;
    }
    milliseconds += monotonicAt - activeSince;
    intervals++;
    activeSince = null;
  }

  if (activeSince !== null) partial = true;
  const quality: ActiveTimeQuality = intervals === 0
    ? (partial ? 'partial' : 'unavailable')
    : (partial ? 'partial' : 'complete');
  return { milliseconds, quality };
}
