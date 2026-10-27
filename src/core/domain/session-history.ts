export const MAX_SESSION_HISTORY = 300;

/** Adds unseen sessions, newest first, while keeping the local history bound. */
export function mergeSessionHistory<T extends { id: string; ts: number }>(
  current: readonly T[],
  incoming: readonly T[],
  limit = MAX_SESSION_HISTORY,
): { sessions: readonly T[]; changed: boolean } {
  const knownIds = new Set(current.map(session => session.id));
  const merged = [...current];
  let changed = false;

  for (const session of incoming) {
    if (knownIds.has(session.id)) continue;
    knownIds.add(session.id);
    merged.push(session);
    changed = true;
  }

  if (!changed) return { sessions: current, changed: false };
  merged.sort((left, right) => right.ts - left.ts);
  return { sessions: merged.slice(0, limit), changed: true };
}
