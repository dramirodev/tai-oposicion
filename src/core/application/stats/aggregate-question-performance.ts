import type { TopicPerformanceRecord } from './summarize-topic-progress.js';

export interface QuestionPerformanceInput {
  topicId: string;
  attempts: number;
  correct: number;
  origin: string;
  type?: string;
  traps: readonly (string | number)[];
}

export interface QuestionPerformanceAggregates {
  topicProgress: TopicPerformanceRecord[];
  traps: Record<string, [attempts: number, failures: number]>;
  origins: Record<string, [attempts: number, correct: number]>;
  types: Record<string, [attempts: number, correct: number]>;
}

/** Groups question-level performance into the dimensions shown by study statistics. */
export function aggregateQuestionPerformance(records: readonly QuestionPerformanceInput[]): QuestionPerformanceAggregates {
  const result: QuestionPerformanceAggregates = { topicProgress: [], traps: {}, origins: {}, types: {} };

  for (const record of records) {
    const failures = record.attempts - record.correct;
    result.topicProgress.push({ topicId: record.topicId, attempts: record.attempts, correct: record.correct, seen: 1 });

    const origin = result.origins[record.origin] ||= [0, 0];
    origin[0] += record.attempts;
    origin[1] += record.correct;

    if (record.type) {
      const type = result.types[record.type] ||= [0, 0];
      type[0] += record.attempts;
      type[1] += record.correct;
    }

    for (const trapId of record.traps) {
      const trap = result.traps[trapId] ||= [0, 0];
      trap[0] += record.attempts;
      trap[1] += failures;
    }
  }

  return result;
}
