import type { AttemptEvent } from './transitions.js';

export type ActiveTimeQuality = 'complete' | 'partial' | 'unavailable';
export interface ActiveTime { milliseconds: number; quality: ActiveTimeQuality }

const starts = new Set<AttemptEvent['type']>(['open', 'resume']);
const stops = new Set<AttemptEvent['type']>(['leave', 'pause', 'close']);

interface ActiveTimeState {
  activeSince: number | null;
  clockContext?: string;
  milliseconds: number;
  partial: boolean;
  intervals: number;
  lastSequence: number;
}

function processEvent(state: ActiveTimeState, event: AttemptEvent): void {
  if (event.sequence <= state.lastSequence) {
    state.partial = true;
    return;
  }
  state.lastSequence = event.sequence;
  const monotonicAt = event.monotonicAt;
  if (monotonicAt === undefined || !Number.isFinite(monotonicAt) || monotonicAt < 0) {
    state.partial = true;
    if (stops.has(event.type)) state.activeSince = null;
    return;
  }
  if (starts.has(event.type)) {
    if (state.activeSince !== null) state.partial = true;
    else { state.activeSince = monotonicAt; state.clockContext = event.clockContext; }
    return;
  }
  if (!stops.has(event.type)) return;
  if (state.activeSince === null) {
    state.partial = true;
    return;
  }
  if (state.clockContext !== event.clockContext || monotonicAt < state.activeSince) {
    state.partial = true;
    state.activeSince = null;
    return;
  }
  state.milliseconds += monotonicAt - state.activeSince;
  state.intervals++;
  state.activeSince = null;
}

function getQuality(state: ActiveTimeState): ActiveTimeQuality {
  if (state.activeSince !== null) state.partial = true;
  if (state.intervals === 0) return state.partial ? 'partial' : 'unavailable';
  return state.partial ? 'partial' : 'complete';
}

/** Computes proven visible intervals; an unmatched start contributes no estimated duration. */
export function computeActiveTime(events: readonly AttemptEvent[]): ActiveTime {
  const unique = new Map<string, AttemptEvent>();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  const ordered = [...unique.values()].sort((left, right) => left.sequence - right.sequence);
  const state: ActiveTimeState = { activeSince: null, milliseconds: 0, partial: false, intervals: 0, lastSequence: -1 };
  for (const event of ordered) processEvent(state, event);
  return { milliseconds: state.milliseconds, quality: getQuality(state) };
}
