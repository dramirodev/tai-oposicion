import { httpBankRepository } from '../adapters/http/bank-repository.js';
import { localAttemptRepository } from '../adapters/local/attempt-repository.js';
import * as store from '../adapters/local/legacy-store.js';
import { getStrategyReport } from '../core/application/attempts/get-strategy-report.js';
import { flushAttemptTracking } from '../core/application/legacy-engine.js';
import { getQuestionEvolution } from '../core/application/attempts/get-question-evolution.js';

export async function loadStrategyReport(from: number, to: number) {
  await flushAttemptTracking();
  const report = await getStrategyReport({
    repository: localAttemptRepository,
    bank: httpBankRepository,
    scope: store.accountId() || 'guest',
    from,
    to,
    generatedAt: Date.now(),
    reward: 1,
    penalty: 1 / 3,
    blankValue: 0,
  });
  return report;
}

export function loadStrategyReportForPeriod(days: number) {
  const to = Date.now();
  return loadStrategyReport(to - days * 86400000, to + 1);
}

export async function loadQuestionEvolution(weeks: number) {
  await flushAttemptTracking();
  return getQuestionEvolution({
    repository: localAttemptRepository,
    scope: store.accountId() || 'guest',
    weeks,
    now: Date.now(),
  });
}
