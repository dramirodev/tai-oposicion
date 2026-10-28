import type { ErrorReport } from './entities.js';

/** Merges report records by question, keeping the strictly newer report. Ties keep the current value. */
export function mergeErrorReports(
  currentReports: readonly ErrorReport[],
  incomingReports: readonly ErrorReport[],
): { reports: ErrorReport[]; changed: boolean } {
  const reportsByQuestion = new Map(currentReports.map(report => [report.questionId, report]));
  let changed = false;

  for (const incomingReport of incomingReports) {
    const currentReport = reportsByQuestion.get(incomingReport.questionId);
    if (!currentReport || incomingReport.reportedAt > currentReport.reportedAt) {
      reportsByQuestion.set(incomingReport.questionId, incomingReport);
      changed = true;
    }
  }

  return { reports: [...reportsByQuestion.values()], changed };
}
