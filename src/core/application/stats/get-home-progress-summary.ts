import type { ProgressRepository } from '../../ports/ProgressRepository.js';
import { estimateQuickQuestionCount } from '../../domain/selection.js';
import { summarizeReadingSpeedFailures } from '../../domain/question-performance.js';

export interface HomeProgressSummary {
  seen: number;
  answers: number;
  answerTimestamps: number[];
  quickCount: number;
  slowCount: number;
}

/** Reads validated progress and prepares the study metrics shown on Home. */
export async function getHomeProgressSummary(progressRepository: Pick<ProgressRepository, 'getStats'>): Promise<HomeProgressSummary> {
  const statistics = await progressRepository.getStats();
  const records = Object.entries(statistics);
  const speed = summarizeReadingSpeedFailures(records.map(([id, record]) => ({ id, lastOutcome: record.lastResult ?? -1, lastReasonCode: record.errorReason })));

  return {
    seen: records.length,
    answers: records.reduce((total, [, record]) => total + record.attempts, 0),
    answerTimestamps: records.map(([, record]) => record.lastSeenAt),
    quickCount: estimateQuickQuestionCount(records.map(([, record]) => ({ totalSeconds: record.secondsStudied ?? 0, count: record.timedAnswers ?? 0 })), 5),
    slowCount: speed.count,
  };
}
