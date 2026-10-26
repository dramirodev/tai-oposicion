import type { ErrorReportRecord } from '../../shared/ui/study-services.js';
export type ErrorReportRow = ErrorReportRecord;

export function selectErrorReports(reports: readonly ErrorReportRow[], filter: string): ErrorReportRow[] {
  return reports.filter(report => report.state !== 'quitado')
    .filter(report => filter === 'todos' || report.state === filter)
    .slice().sort((first, second) => second.ts - first.ts);
}

