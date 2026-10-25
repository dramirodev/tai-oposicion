import type { BankRepository } from '../../ports/BankRepository.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import { analyzeAttemptStrategy } from '../../domain/attempts/strategy-report.js';
import { exportAttemptArchive } from './export-attempt-archive.js';

export interface GetStrategyReportInput {
  repository: AttemptRepository;
  bank: BankRepository;
  scope: string;
  from: number;
  to: number;
  generatedAt: number;
  reward: number;
  penalty: number;
  blankValue: number;
}

/** Loads completed detailed history and maps question metadata once per unique question ID. */
export async function getStrategyReport(input: GetStrategyReportInput) {
  const archive = await exportAttemptArchive(input.repository, input.scope, input.generatedAt);
  const questionIds = [...new Set(archive.attempts.map(attempt => attempt.questionId))];
  const questionPairs = await Promise.all(questionIds.map(async id => [id, await input.bank.getQuestion(id)] as const));
  const questions = new Map(questionPairs.filter((pair): pair is readonly [string, NonNullable<typeof pair[1]>] => pair[1] !== undefined));
  const report = analyzeAttemptStrategy({
    sessions: archive.sessions,
    attempts: archive.attempts,
    events: archive.events,
    questions,
    from: input.from,
    to: input.to,
    reward: input.reward,
    penalty: input.penalty,
    blankValue: input.blankValue,
  });
  return report;
}
