import type { ProgressRepository } from '../../ports/ProgressRepository.js';
import { countLuckyCorrectAnswers, countFailureReasons, summarizeReadingSpeedFailures } from '../../domain/question-performance.js';
import { countReviewsByDay } from '../../domain/spaced-repetition.js';
import { slowestQuestions } from '../../domain/study-analytics.js';
import { aggregateQuestionPerformance } from './aggregate-question-performance.js';
import { summarizeTopicProgress, type TopicCatalogueEntry } from './summarize-topic-progress.js';

export interface QuestionPerformanceMetadata {
  topicId: string;
  origin: string;
  type: string;
  traps: readonly (string | number)[];
}

export interface ProgressStatistics {
  answers: number;
  correct: number;
  accuracy: number;
  topics: ReturnType<typeof summarizeTopicProgress>['topics'];
  weakTopics: ReturnType<typeof summarizeTopicProgress>['weakTopics'];
  failureReasons: number[];
  lucky: number;
  speed: { count: number; total: number; percent: number; ids: string[] };
  reviewLoad: number[];
  traps: Record<string, [attempts: number, failures: number]>;
  origins: Record<string, [attempts: number, correct: number]>;
  types: Record<string, [attempts: number, correct: number]>;
  slow: ReturnType<typeof slowestQuestions>;
}

/** Builds the study statistics shown by Progress from validated domain progress. */
export async function getProgressStatistics(
  progressRepository: ProgressRepository,
  metadata: Readonly<Record<string, QuestionPerformanceMetadata | undefined>>,
  catalogue: readonly TopicCatalogueEntry[],
  now: number,
): Promise<ProgressStatistics> {
  const statistics = await progressRepository.getStats();
  const performance = aggregateQuestionPerformance(Object.entries(statistics).flatMap(([id, record]) => {
    const question = metadata[id];
    return question ? [{ topicId: question.topicId, attempts: record.attempts, correct: record.correct, origin: question.origin, type: question.type, traps: question.traps }] : [];
  }));
  const summary = summarizeTopicProgress(performance.topicProgress, catalogue);
  const questionPerformance = Object.entries(statistics).map(([id, record]) => ({
    id,
    lastOutcome: record.lastResult ?? -1,
    lastReasonCode: record.errorReason,
  }));
  const timing = Object.entries(statistics).map(([id, record]) => ({
    id,
    attempts: record.attempts,
    correct: record.correct,
    lastOutcome: record.lastResult ?? -1,
    totalSeconds: record.secondsStudied ?? 0,
    timedAnswers: record.timedAnswers ?? 0,
  }));
  const speed = summarizeReadingSpeedFailures(questionPerformance);

  return {
    ...summary,
    failureReasons: countFailureReasons(questionPerformance),
    lucky: countLuckyCorrectAnswers(questionPerformance),
    speed: { count: speed.count, total: speed.taggedFailureCount, percent: speed.percent, ids: speed.questionIds },
    reviewLoad: countReviewsByDay(Object.values(statistics).map(({ intervalStep, dueAt }) => ({ intervalStep, dueAt })), now, 14),
    traps: performance.traps,
    origins: performance.origins,
    types: performance.types,
    slow: slowestQuestions(timing),
  };
}
