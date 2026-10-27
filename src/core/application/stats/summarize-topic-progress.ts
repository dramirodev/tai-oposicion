import type { TopicProgress } from './statistics-model.js';

export interface TopicPerformanceRecord {
  topicId: string;
  attempts: number;
  correct: number;
  seen: number;
}

export interface TopicCatalogueEntry {
  id: string;
  name: string;
  total: number;
}

export interface TopicProgressSummary {
  answers: number;
  correct: number;
  accuracy: number;
  topics: readonly TopicProgress[];
  weakTopics: readonly TopicProgress[];
}

const accuracyPercent = (correct: number, attempts: number) => attempts ? Math.round(100 * correct / attempts) : 0;

/** Applies the study dashboard's topic totals and reinforcement rule to normalized records. */
export function summarizeTopicProgress(
  records: readonly TopicPerformanceRecord[],
  catalogue: readonly TopicCatalogueEntry[],
  minimumWeakTopicAttempts = 8,
  weakTopicLimit = 5,
): TopicProgressSummary {
  const totals = new Map<string, { attempts: number; correct: number; seen: number }>();
  let answers = 0;
  let correct = 0;

  for (const record of records) {
    answers += record.attempts;
    correct += record.correct;
    const topic = totals.get(record.topicId) ?? { attempts: 0, correct: 0, seen: 0 };
    topic.attempts += record.attempts;
    topic.correct += record.correct;
    topic.seen += record.seen;
    totals.set(record.topicId, topic);
  }

  const topics = catalogue.map(({ id, name, total }) => {
    const progress = totals.get(id) ?? { attempts: 0, correct: 0, seen: 0 };
    return { id, name, interactions: progress.attempts, correct: progress.correct, seen: progress.seen, total, accuracy: accuracyPercent(progress.correct, progress.attempts) };
  });
  const weakTopics = topics
    .filter(topic => topic.interactions >= minimumWeakTopicAttempts)
    .sort((first, second) => first.accuracy - second.accuracy)
    .slice(0, weakTopicLimit);

  return { answers, correct, accuracy: accuracyPercent(correct, answers), topics, weakTopics };
}
