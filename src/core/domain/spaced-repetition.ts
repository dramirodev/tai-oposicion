export interface SpacedReview {
  topicId: string;
  dueAt: number;
}

export interface ReviewScheduleEntry {
  intervalStep?: number;
  dueAt?: number;
}

export interface FailureStreakStats {
  attempts: number;
  lastResult?: number;
  intervalStep?: number;
  failureStreak?: number;
}

/** Derive the streak for records from before the explicit streak field existed. */
export function failureStreak(statistics?: FailureStreakStats): number {
  if (!statistics) return -1;
  if (statistics.failureStreak !== undefined) return Math.floor(statistics.failureStreak);
  return (statistics.attempts > 0 && statistics.lastResult === 0 || (statistics.intervalStep ?? -1) >= 0) ? 0 : -1;
}

export function hasPendingFailure(statistics?: FailureStreakStats): boolean {
  const streak = failureStreak(statistics);
  return streak >= 0 && streak < 3;
}

/** Select overdue reviews first, interleaving topics whenever possible. */
export function selectSpacedReviews<T extends SpacedReview>(items: readonly T[], count: number): T[] {
  const top = [...items].sort((a, b) => a.dueAt - b.dueAt).slice(0, count);
  const byTopic = new Map<string, T[]>();
  for (const item of top) {
    if (!byTopic.has(item.topicId)) byTopic.set(item.topicId, []);
    byTopic.get(item.topicId)!.push(item);
  }
  const selected: T[] = [];
  let lastTopic: string | null = null;
  while (selected.length < top.length) {
    const topics = [...byTopic.keys()].filter(topic => byTopic.get(topic)!.length);
    topics.sort((a, b) => byTopic.get(b)!.length - byTopic.get(a)!.length);
    const topic = topics.find(candidate => candidate !== lastTopic) ?? topics[0];
    selected.push(byTopic.get(topic)!.shift()!);
    lastTopic = topic;
  }
  return selected;
}

/** Count due reviews by local calendar day; overdue entries belong to today. */
export function countReviewsByDay(entries: readonly ReviewScheduleEntry[], now: number, days = 14): number[] {
  const dayMilliseconds = 86400000;
  const dayOrdinal = (timestamp: number) => {
    const date = new Date(timestamp);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMilliseconds;
  };
  const today = dayOrdinal(now);
  const counts = new Array<number>(days).fill(0);
  for (const entry of entries) {
    if (!(entry.intervalStep! >= 0) || !entry.dueAt) continue;
    const offset = dayOrdinal(entry.dueAt) - today;
    if (offset < days) counts[Math.max(0, offset)]++;
  }
  return counts;
}
