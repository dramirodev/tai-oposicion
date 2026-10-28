export interface SpacedReview {
  topicId: string;
  dueAt: number;
}

export interface ReviewScheduleEntry {
  intervalStep?: number;
  dueAt?: number;
  lastSeenAt?: number;
  lastResult?: number;
  syllabusReviewed?: boolean;
  syllabusReviewedAt?: number;
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
  const top = [...items].sort((leftReviewEntry, rightReviewEntry) => leftReviewEntry.dueAt - rightReviewEntry.dueAt).slice(0, count);
  const byTopic = new Map<string, T[]>();
  for (const item of top) {
    if (!byTopic.has(item.topicId)) byTopic.set(item.topicId, []);
    byTopic.get(item.topicId)!.push(item);
  }
  const selected: T[] = [];
  let lastTopic: string | null = null;
  while (selected.length < top.length) {
    const topics = [...byTopic.keys()].filter(topic => byTopic.get(topic)!.length);
    topics.sort((leftTopic, rightTopic) => byTopic.get(rightTopic)!.length - byTopic.get(leftTopic)!.length);
    const topic = topics.find(candidate => candidate !== lastTopic) ?? topics[0];
    selected.push(byTopic.get(topic)!.shift()!);
    lastTopic = topic;
  }
  return selected;
}

/** The existing first interval is a product default, not a scientifically optimal delay. */
export function questionReviewDueAt(entry: ReviewScheduleEntry): number | undefined {
  const scheduledDueAt = (entry.intervalStep ?? -1) >= 0 && (entry.dueAt ?? 0) > 0
    ? entry.dueAt
    : undefined;
  const reviewedAt = entry.syllabusReviewedAt;
  const hasReviewTimestamp = typeof reviewedAt === 'number' && Number.isFinite(reviewedAt) && reviewedAt > 0;
  const delayedCheckAt = entry.syllabusReviewed === true && hasReviewTimestamp
    ? reviewedAt + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS
    : undefined;
  const delayedCheckPending = delayedCheckAt !== undefined
    && ((entry.lastSeenAt ?? 0) < delayedCheckAt || entry.lastResult === 2);
  const activeDueDates = [scheduledDueAt, delayedCheckPending ? delayedCheckAt : undefined]
    .filter((dueAt): dueAt is number => dueAt !== undefined);
  return activeDueDates.length ? Math.min(...activeDueDates) : undefined;
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
    const dueAt = questionReviewDueAt(entry);
    if (dueAt === undefined) continue;
    const offset = dayOrdinal(dueAt) - today;
    if (offset < days) counts[Math.max(0, offset)]++;
  }
  return counts;
}

export interface CardReviewScheduleState {
  attempts: number;
  intervalStep: number;
}

export const CARD_REVIEW_INTERVALS_DAYS = [2, 5, 14, 30, 60] as const;
export const CALENDAR_DAY_MILLISECONDS = 86400000;

/** Predict the next card review date from an explicit grade and clock value. */
export function previewCardDueAt(
  review: CardReviewScheduleState | undefined,
  grade: number,
  now: number,
): number {
  if (grade < 2 || !review || review.attempts === 0 || review.intervalStep < 0) {
    return now + CARD_REVIEW_INTERVALS_DAYS[0] * CALENDAR_DAY_MILLISECONDS;
  }
  const nextStep = review.intervalStep + 1;
  if (nextStep >= CARD_REVIEW_INTERVALS_DAYS.length) return 0;
  return now + CARD_REVIEW_INTERVALS_DAYS[nextStep] * CALENDAR_DAY_MILLISECONDS;
}
