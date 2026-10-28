export interface TopicMasteryStats {
  attempts: number;
  correct: number;
  lastSeenAt: number;
  intervalStep?: number;
  dueAt?: number;
  lastResult?: number;
}

export type TopicMasteryStatus = 'new' | 'red' | 'yellow' | 'green';
export type TopicMasteryReason =
  | 'not-started'
  | 'few-responses'
  | 'recent-failures'
  | 'low-coverage'
  | 'stale-30-days'
  | 'many-failures'
  | 'cooling'
  | 'recent';

export interface TopicMasteryResult<Topic> {
  topic: Topic;
  seen: number;
  precision: number;
  coverage: number;
  score: number;
  daysSinceLastSeen: number | null;
  due: number;
  status: TopicMasteryStatus;
  reason: TopicMasteryReason;
}

export const COVERAGE_OBJECTIVE = 0.6;

/** Keeps mastery results within topics the learner has explicitly marked as studied. */
export function filterTopicMasteryToSeen<Topic extends { id: string }>(
  topics: readonly Topic[],
  seenTopicIds: readonly string[],
): Topic[] {
  const seen = new Set(seenTopicIds);
  return topics.filter(topic => seen.has(topic.id));
}

export function analyzeTopicMastery<Topic extends { id: string; questionCount: number }>(
  topics: readonly Topic[],
  questionIdsForTopic: (topicId: string) => readonly string[] | undefined,
  statisticsForQuestion: (questionId: string) => TopicMasteryStats | undefined,
  now: number,
): TopicMasteryResult<Topic>[] {
  return topics.map(topic => {
    let seen = 0;
    let currentCorrect = 0;
    let lastSeenAt = 0;
    let due = 0;
    let attempts = 0;
    for (const questionId of questionIdsForTopic(topic.id) || []) {
      const statistics = statisticsForQuestion(questionId);
      if (!statistics || !statistics.attempts) continue;
      seen++;
      attempts += statistics.attempts;
      if (statistics.lastResult === 1) currentCorrect++;
      if (statistics.lastSeenAt > lastSeenAt) lastSeenAt = statistics.lastSeenAt;
      if ((statistics.intervalStep ?? -1) >= 0 && statistics.dueAt && statistics.dueAt <= now) due++;
    }
    const precision = seen ? currentCorrect / seen : 0;
    const coverageRatio = Math.min(1, seen / Math.max(1, topic.questionCount * COVERAGE_OBJECTIVE));
    const daysSinceLastSeen = lastSeenAt ? Math.floor((now - lastSeenAt) / 86400000) : null;
    const score = Math.round(100 * (0.65 * precision + 0.35 * coverageRatio));
    let status: TopicMasteryStatus;
    let reason: TopicMasteryReason;
    if (!seen || attempts < 5) {
      status = 'new';
      reason = seen ? 'few-responses' : 'not-started';
    } else if (score < 50) {
      status = 'red';
      reason = precision < 0.5 ? 'recent-failures' : 'low-coverage';
    } else if (daysSinceLastSeen! > 30) {
      status = 'red';
      reason = 'stale-30-days';
    } else if (score < 75) {
      status = 'yellow';
      reason = precision < 0.75 ? 'many-failures' : 'low-coverage';
    } else if (daysSinceLastSeen! > 14) {
      status = 'yellow';
      reason = 'cooling';
    } else {
      status = 'green';
      reason = 'recent';
    }
    return {
      topic,
      seen,
      precision: Math.round(100 * precision),
      coverage: Math.round(100 * coverageRatio),
      score,
      daysSinceLastSeen,
      due,
      status,
      reason,
    };
  });
}
