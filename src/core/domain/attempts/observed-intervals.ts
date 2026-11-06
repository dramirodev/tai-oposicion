import type { AttemptEvent } from './transitions.js';

export interface ObservedInterval { start: number; end: number }
export interface ObservedIntervals { intervals: ObservedInterval[]; unplacedMilliseconds: number; partial: boolean }
const starts = new Set(['open', 'resume']);
const stops = new Set(['leave', 'pause', 'close']);

/** Civil placement is accepted only when it agrees with the proven monotonic duration. */
export function observedIntervals(events: readonly AttemptEvent[]): ObservedIntervals {
  const unique = new Map<string, AttemptEvent>();
  for (const event of events) if (!unique.has(event.id)) unique.set(event.id, event);
  const ordered = [...unique.values()].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const result: ObservedIntervals = { intervals: [], unplacedMilliseconds: 0, partial: false };
  let open: AttemptEvent | undefined;
  let lastSequence = -1;
  for (const event of ordered) {
    if (event.sequence <= lastSequence) { result.partial = true; continue; }
    lastSequence = event.sequence;
    if (starts.has(event.type)) {
      if (open) result.partial = true;
      open = event;
    } else if (stops.has(event.type)) {
      if (!open || open.clockContext !== event.clockContext || open.monotonicAt === undefined || event.monotonicAt === undefined) {
        result.partial = true; open = undefined; continue;
      }
      const duration = event.monotonicAt - open.monotonicAt;
      const civilDuration = event.at - open.at;
      if (!Number.isFinite(duration) || duration < 0) result.partial = true;
      else if (Number.isFinite(civilDuration) && civilDuration >= 0 && Math.abs(civilDuration - duration) <= 1000) {
        // Use the monotonic duration, anchored at the civil start; never manufacture a long clock jump.
        result.intervals.push({ start: open.at, end: open.at + duration });
      } else { result.unplacedMilliseconds += duration; result.partial = true; }
      open = undefined;
    }
  }
  if (open) result.partial = true;
  return result;
}
export function unionObservedIntervals(intervals: readonly ObservedInterval[], from: number, to: number): ObservedInterval[] {
  const ordered = intervals.map(interval => ({ start: Math.max(from, interval.start), end: Math.min(to, interval.end) }))
    .filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const result: ObservedInterval[] = [];
  for (const interval of ordered) {
    const last = result.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}
